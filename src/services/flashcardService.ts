import { firebaseAILogicService } from './firebaseAILogicService';
import { 
  Flashcard, 
  FlashcardSet, 
  FlashcardGenerationRequest, 
  FlashcardGenerationResponse 
} from '../types/flashcard';
import { ProcessedDocument } from './documentProcessor';
import { UserProfileService } from './userProfileService';
import { firebaseService } from './firebaseService';
import { firebaseAuthService } from './firebaseAuthService';

export interface FlashcardService {
  generateFlashcards(request: FlashcardGenerationRequest, document?: ProcessedDocument): Promise<FlashcardGenerationResponse>;
  generateFlashcardsFromText(request: FlashcardGenerationRequest): Promise<FlashcardGenerationResponse>;
  createFlashcardSet(title: string, description: string, flashcards: Flashcard[], sourceDocumentIds?: string[]): FlashcardSet;
  updateFlashcardMastery(flashcardId: string, masteryLevel: number): Promise<void>;
  getFlashcardSets(): FlashcardSet[];
  saveFlashcardSet(flashcardSet: FlashcardSet): Promise<void>;
  deleteFlashcardSet(setId: string): Promise<void>;
  loadFlashcardSets(): Promise<void>;
}

class RealFlashcardService implements FlashcardService {
  private flashcardSets: FlashcardSet[] = [];
  private currentUserId: string | null = null;

  constructor() {
    this.setupAuthListener();
  }

  private setupAuthListener() {
    // Listen for auth state changes using the proper auth service listener
    firebaseAuthService.onAuthStateChange((user) => {
      if (user && user.id !== this.currentUserId) {
        this.currentUserId = user.id;
        this.loadFlashcardSets().catch(error => {
          console.error('❌ Error loading flashcard sets on auth change:', error);
        });
      } else if (!user && this.currentUserId) {
        this.currentUserId = null;
        this.flashcardSets = [];
      }
    });
  }

  async loadFlashcardSets() {
    if (!this.currentUserId) {
      console.log('🔐 No current user, clearing flashcard sets');
      this.flashcardSets = [];
      return;
    }

    try {
      console.log('📥 Loading flashcard sets for user:', this.currentUserId);
      this.flashcardSets = await firebaseService.getFlashcardSets(this.currentUserId);
      console.log('✅ Loaded flashcard sets:', this.flashcardSets.length, this.flashcardSets);
    } catch (error) {
      console.error('❌ Error loading flashcard sets from Firebase:', error);
      // Error loading flashcard sets from Firebase
      this.flashcardSets = [];
    }
  }

  async generateFlashcards(
    request: FlashcardGenerationRequest, 
    document?: ProcessedDocument
  ): Promise<FlashcardGenerationResponse> {
    if (request.sourceType === 'text' || request.textContent) {
      return this.generateFlashcardsFromText(request);
    }
    
    if (!document) {
      throw new Error('Document is required for document-based flashcard generation');
    }
    
    
    try {
      const prompt = await this.buildFlashcardPrompt(request, document);
      let response = await firebaseAILogicService.generateResponse(prompt);
      
      // Try to parse the response
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        console.warn('⚠️ First attempt failed, retrying with more explicit prompt...');
        // Retry with a more explicit prompt
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await firebaseAILogicService.generateResponse(retryPrompt);
        flashcards = this.parseFlashcardResponse(response.content, request);
      }
      
      // Generated flashcards

      return {
        flashcards,
        setTitle: '',
        setDescription: '',
        sourceDocumentId: document.id
      };
    } catch (error) {
      // Error generating flashcards
      
      // Check if this is an API overload error (503) or quota error (429)
      if (error instanceof Error && (error.message.includes('503') || error.message.includes('429'))) {
        throw new Error('The AI service is currently unavailable due to high demand or quota limits. Please try again in a few minutes.');
      }
      
      // Check if this is a fallback response that's not JSON
      if (error instanceof Error && error.message.includes('No JSON found in response')) {
        throw new Error('Unable to generate flashcards at this time. The AI service is experiencing issues. Please try again later.');
      }
      
      throw new Error(`Failed to generate flashcards: ${error}`);
    }
  }

  async generateFlashcardsFromText(request: FlashcardGenerationRequest): Promise<FlashcardGenerationResponse> {
    if (!request.textContent) {
      throw new Error('Text content is required for text-based flashcard generation');
    }
    
    
    try {
      const prompt = await this.buildTextFlashcardPrompt(request);
      let response = await firebaseAILogicService.generateResponse(prompt);
      
      // Try to parse the response
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        console.warn('⚠️ First attempt failed, retrying with more explicit prompt...');
        // Retry with a more explicit prompt
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await firebaseAILogicService.generateResponse(retryPrompt);
        flashcards = this.parseFlashcardResponse(response.content, request);
      }
      
      // Generated flashcards from text

      return {
        flashcards,
        setTitle: '',
        setDescription: '',
        sourceText: request.textContent
      };
    } catch (error) {
      // Error generating flashcards from text
      
      // Check if this is an API overload error (503) or quota error (429)
      if (error instanceof Error && (error.message.includes('503') || error.message.includes('429'))) {
        throw new Error('The AI service is currently unavailable due to high demand or quota limits. Please try again in a few minutes.');
      }
      
      // Check if this is a fallback response that's not JSON
      if (error instanceof Error && error.message.includes('No JSON found in response')) {
        throw new Error('Unable to generate flashcards at this time. The AI service is experiencing issues. Please try again later.');
      }
      
      throw new Error(`Failed to generate flashcards from text: ${error}`);
    }
  }

  private async buildFlashcardPrompt(request: FlashcardGenerationRequest, document: ProcessedDocument): Promise<string> {
    const { count = 10, difficulty = 'medium', format = 'q&a', topic } = request;
    
    // Get user profile context for personalization
    const userProfileContext = await UserProfileService.buildPersonalizationContext();
    
    let prompt = `You are an expert educational content creator. Generate ${count} high-quality flashcards based on the following document content.

Document: ${document.fileName}
Content: ${document.extractedContent.substring(0, 3000)}...

Requirements:
- Create ${count} flashcards
- Difficulty level: ${difficulty}
- Format: ${format}
- ${topic ? `Focus on: ${topic}` : 'Cover key concepts from the document'}
- Each flashcard should have a clear question and comprehensive answer
- Questions should test understanding, not just memorization
- Answers should be educational and help with learning
- For answers with lists, use proper spacing and formatting
- Use line breaks and bullet points for better readability

CRITICAL INSTRUCTIONS - READ CAREFULLY:
- You MUST respond with ONLY valid JSON - absolutely no other text
- Do NOT include explanatory text, code examples, or any other content
- Do NOT use markdown formatting like \`\`\`json\`\`\`
- Do NOT include "Here are the flashcards:" or similar introductory text
- Categories and tags must reflect the ACTUAL subject matter of the content, not user preferences
- Your response must start with { and end with }

REQUIRED JSON FORMAT (copy this exactly):
{
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Comprehensive, educational answer",
      "category": "Topic category based on actual content",
      "difficulty": "${difficulty}",
      "tags": ["tag1", "tag2"]
    }
  ]
}

FINAL REMINDER:
- Your entire response must be valid JSON only
- No explanatory text, no code blocks, no markdown
- Start with { and end with }
- Each flashcard must have all required fields
- Categories and tags must reflect the actual subject matter, not user preferences`;

    // Add user profile context if available (for personalization, not categorization)
    if (userProfileContext) {
      prompt += `\n\nPERSONALIZATION CONTEXT (use for explanation style, not for categories/tags):\n${userProfileContext}`;
    }

    return prompt;
  }

  private parseFlashcardResponse(response: string, request: FlashcardGenerationRequest): Flashcard[] {
    try {
      console.log('🔍 Raw AI response:', response);
      
      // Try to extract JSON from the response
      let jsonString = response.trim();
      
      // First, try to find JSON block between ```json and ``` or just ``` and ```
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
        // Found JSON in code block
      } else {
        // Try to find JSON object - look for the first { and last }
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
          // Found JSON object in response
        } else {
          throw new Error('No JSON found in response');
        }
      }

      // Clean up common JSON issues
      jsonString = jsonString
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
        .replace(/\n/g, ' ')     // Replace newlines with spaces
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();


      const parsed = JSON.parse(jsonString);
      console.log('📋 Parsed JSON:', parsed);
      
      if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error('Invalid flashcard format - missing flashcards array');
      }

      // Successfully parsed flashcards
      console.log('✅ Successfully parsed flashcards:', parsed.flashcards);

      return parsed.flashcards.map((card: any, index: number) => ({
        id: `flashcard_${Date.now()}_${index}`,
        question: card.question || 'No question provided',
        answer: card.answer || 'No answer provided',
        category: card.category || 'General',
        difficulty: card.difficulty || request.difficulty || 'medium',
        tags: Array.isArray(card.tags) ? card.tags : [],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
        sourceDocumentId: request.documentId
      }));
    } catch (error) {
      // Error parsing flashcard response
      
      // Fallback: create simple flashcards from the response
      return this.createFallbackFlashcards(response, request);
    }
  }

  private createFallbackFlashcards(response: string, request: FlashcardGenerationRequest): Flashcard[] {
    
    // Try to extract questions and answers from the response
    const flashcards: Flashcard[] = [];
    const count = request.count || 5;
    
    // Look for Q: and A: patterns
    const qaMatches = response.match(/Q:\s*([^\n]+)\s*A:\s*([^\n]+)/gi);
    if (qaMatches && qaMatches.length > 0) {
      for (let i = 0; i < Math.min(qaMatches.length, count); i++) {
        const match = qaMatches[i];
        const parts = match.split(/A:\s*/i);
        if (parts.length === 2) {
          flashcards.push({
            id: `flashcard_${Date.now()}_${i}`,
            question: parts[0].replace(/Q:\s*/i, '').trim(),
            answer: parts[1].trim(),
            category: 'General',
            difficulty: request.difficulty || 'medium',
            tags: [],
            createdAt: new Date(),
            reviewCount: 0,
            masteryLevel: 0,
            sourceDocumentId: request.documentId
          });
        }
      }
    }
    
    // If no Q/A pattern found, try to split by lines
    if (flashcards.length === 0) {
      const lines = response.split('\n').filter(line => line.trim().length > 10);
      for (let i = 0; i < Math.min(lines.length, count * 2); i += 2) {
        if (i + 1 < lines.length) {
          flashcards.push({
            id: `flashcard_${Date.now()}_${i}`,
            question: lines[i].trim(),
            answer: lines[i + 1].trim(),
            category: 'General',
            difficulty: request.difficulty || 'medium',
            tags: [],
            createdAt: new Date(),
            reviewCount: 0,
            masteryLevel: 0,
            sourceDocumentId: request.documentId
          });
        }
      }
    }
    
    // If still no flashcards, create a simple one
    if (flashcards.length === 0) {
      flashcards.push({
        id: `flashcard_${Date.now()}_0`,
        question: 'What is the main topic?',
        answer: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        category: 'General',
        difficulty: request.difficulty || 'medium',
        tags: [],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
        sourceDocumentId: request.documentId
      });
    }

    return flashcards;
  }


  private async buildTextFlashcardPrompt(request: FlashcardGenerationRequest): Promise<string> {
    const { count = 10, difficulty = 'medium', format = 'q&a', topic, textContent } = request;
    
    // Get user profile context for personalization
    const userProfileContext = await UserProfileService.buildPersonalizationContext();
    
    let prompt = `You are an expert educational content creator. Generate ${count} high-quality flashcards based on the following text content.

Text Content: ${textContent}

Requirements:
- Create ${count} flashcards
- Difficulty level: ${difficulty}
- Format: ${format}
- ${topic ? `Focus on: ${topic}` : 'Cover key concepts from the text'}
- Each flashcard should have a clear question and comprehensive answer
- Questions should test understanding, not just memorization
- Answers should be educational and help with learning
- For answers with lists, use proper spacing and formatting
- Use line breaks and bullet points for better readability

CRITICAL INSTRUCTIONS - READ CAREFULLY:
- You MUST respond with ONLY valid JSON - absolutely no other text
- Do NOT include explanatory text, code examples, or any other content
- Do NOT use markdown formatting like \`\`\`json\`\`\`
- Do NOT include "Here are the flashcards:" or similar introductory text
- Categories and tags must reflect the ACTUAL subject matter of the content, not user preferences
- Your response must start with { and end with }

REQUIRED JSON FORMAT (copy this exactly):
{
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Comprehensive, educational answer",
      "category": "Topic category based on actual content",
      "difficulty": "${difficulty}",
      "tags": ["tag1", "tag2"]
    }
  ]
}

FINAL REMINDER:
- Your entire response must be valid JSON only
- No explanatory text, no code blocks, no markdown
- Start with { and end with }
- Each flashcard must have all required fields
- Categories and tags must reflect the actual subject matter, not user preferences`;

    // Add user profile context if available (for personalization, not categorization)
    if (userProfileContext) {
      prompt += `\n\nPERSONALIZATION CONTEXT (use for explanation style, not for categories/tags):\n${userProfileContext}`;
    }

    return prompt;
  }


  createFlashcardSet(
    title: string, 
    description: string, 
    flashcards: Flashcard[], 
    sourceDocumentIds?: string[]
  ): FlashcardSet {
    return {
      id: `set_${Date.now()}`,
      title,
      description: description || '',
      flashcards,
      createdAt: new Date(),
      updatedAt: new Date(),
      sourceDocumentIds: sourceDocumentIds || [],
      tags: []
    };
  }

  async updateFlashcardMastery(flashcardId: string, masteryLevel: number): Promise<void> {
    // Find and update the flashcard in all sets
    let updatedSet: FlashcardSet | undefined;
    this.flashcardSets.forEach(set => {
      const flashcard = set.flashcards.find(card => card.id === flashcardId);
      if (flashcard) {
        flashcard.masteryLevel = masteryLevel;
        flashcard.lastReviewed = new Date();
        flashcard.reviewCount += 1;
        set.updatedAt = new Date();
        updatedSet = set;
      }
    });
    
    // Save to Firebase if we found an updated set
    if (updatedSet && this.currentUserId) {
      try {
        await firebaseService.updateFlashcardSet(updatedSet.id, updatedSet);
      } catch (error) {
        // Failed to update flashcard set in Firebase
      }
    }
  }

  getFlashcardSets(): FlashcardSet[] {
    return [...this.flashcardSets];
  }

  async saveFlashcardSet(flashcardSet: FlashcardSet): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User must be authenticated to save flashcard sets');
    }

    try {
      console.log('💾 Saving flashcard set to Firebase:', flashcardSet.id);
      await firebaseService.saveFlashcardSet(flashcardSet, this.currentUserId);
      
      // Update local cache
      const existingIndex = this.flashcardSets.findIndex(set => set.id === flashcardSet.id);
      if (existingIndex >= 0) {
        console.log('🔄 Updating existing flashcard set in cache:', flashcardSet.id);
        this.flashcardSets[existingIndex] = flashcardSet;
      } else {
        console.log('➕ Adding new flashcard set to cache:', flashcardSet.id);
        this.flashcardSets.push(flashcardSet);
      }
      console.log('📚 Current flashcard sets in cache:', this.flashcardSets.length);
    } catch (error) {
      console.error('❌ Failed to save flashcard set:', error);
      throw new Error('Failed to save flashcard set');
    }
  }

  async deleteFlashcardSet(setId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('User must be authenticated to delete flashcard sets');
    }

    try {
      await firebaseService.deleteFlashcardSet(setId, this.currentUserId);
      this.flashcardSets = this.flashcardSets.filter(set => set.id !== setId);
    } catch (error) {
      throw new Error('Failed to delete flashcard set');
    }
  }

}

// Export singleton instance
export const flashcardService = new RealFlashcardService();
