import { geminiAIService } from './geminiService';
import { 
  Flashcard, 
  FlashcardSet, 
  FlashcardGenerationRequest, 
  FlashcardGenerationResponse 
} from '../types/flashcard';
import { ProcessedDocument } from './documentProcessor';
import { UserProfileService } from './userProfileService';

export interface FlashcardService {
  generateFlashcards(request: FlashcardGenerationRequest, document?: ProcessedDocument): Promise<FlashcardGenerationResponse>;
  generateFlashcardsFromText(request: FlashcardGenerationRequest): Promise<FlashcardGenerationResponse>;
  createFlashcardSet(title: string, description: string, flashcards: Flashcard[], sourceDocumentIds?: string[]): FlashcardSet;
  updateFlashcardMastery(flashcardId: string, masteryLevel: number): void;
  getFlashcardSets(): FlashcardSet[];
  saveFlashcardSet(flashcardSet: FlashcardSet): void;
  deleteFlashcardSet(setId: string): void;
}

class RealFlashcardService implements FlashcardService {
  private flashcardSets: FlashcardSet[] = [];

  constructor() {
    this.loadFlashcardSets();
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
    
    console.log('🎴 Generating flashcards for document:', document.fileName);
    
    try {
      const prompt = this.buildFlashcardPrompt(request, document);
      let response = await geminiAIService.generateResponse(prompt);
      
      // Try to parse the response
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        console.warn('⚠️ First attempt failed, retrying with more explicit prompt...');
        // Retry with a more explicit prompt
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await geminiAIService.generateResponse(retryPrompt);
        flashcards = this.parseFlashcardResponse(response.content, request);
      }
      
      console.log('✅ Generated flashcards:', flashcards.length);

      return {
        flashcards,
        setTitle: '',
        setDescription: '',
        sourceDocumentId: document.id
      };
    } catch (error) {
      console.error('❌ Error generating flashcards:', error);
      
      // Check if this is an API overload error (503)
      if (error instanceof Error && error.message.includes('503')) {
        throw new Error('The AI service is currently overloaded. Please try again in a few minutes.');
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
    
    console.log('🎴 Generating flashcards from text content');
    
    try {
      const prompt = this.buildTextFlashcardPrompt(request);
      let response = await geminiAIService.generateResponse(prompt);
      
      // Try to parse the response
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        console.warn('⚠️ First attempt failed, retrying with more explicit prompt...');
        // Retry with a more explicit prompt
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await geminiAIService.generateResponse(retryPrompt);
        flashcards = this.parseFlashcardResponse(response.content, request);
      }
      
      console.log('✅ Generated flashcards from text:', flashcards.length);

      return {
        flashcards,
        setTitle: '',
        setDescription: '',
        sourceText: request.textContent
      };
    } catch (error) {
      console.error('❌ Error generating flashcards from text:', error);
      
      // Check if this is an API overload error (503)
      if (error instanceof Error && error.message.includes('503')) {
        throw new Error('The AI service is currently overloaded. Please try again in a few minutes.');
      }
      
      // Check if this is a fallback response that's not JSON
      if (error instanceof Error && error.message.includes('No JSON found in response')) {
        throw new Error('Unable to generate flashcards at this time. The AI service is experiencing issues. Please try again later.');
      }
      
      throw new Error(`Failed to generate flashcards from text: ${error}`);
    }
  }

  private buildFlashcardPrompt(request: FlashcardGenerationRequest, document: ProcessedDocument): string {
    const { count = 10, difficulty = 'medium', format = 'q&a', topic } = request;
    
    // Get user profile context for personalization
    const userProfileContext = UserProfileService.buildPersonalizationContext();
    
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
      console.log('🔍 Parsing flashcard response:', response.substring(0, 200) + '...');
      
      // Try to extract JSON from the response
      let jsonString = response.trim();
      
      // First, try to find JSON block between ```json and ``` or just ``` and ```
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
        console.log('✅ Found JSON in code block');
      } else {
        // Try to find JSON object - look for the first { and last }
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
          console.log('✅ Found JSON object in response');
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

      console.log('🧹 Cleaned JSON string:', jsonString.substring(0, 100) + '...');

      const parsed = JSON.parse(jsonString);
      
      if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error('Invalid flashcard format - missing flashcards array');
      }

      console.log(`✅ Successfully parsed ${parsed.flashcards.length} flashcards`);

      return parsed.flashcards.map((card: any, index: number) => ({
        id: `flashcard_${Date.now()}_${index}`,
        question: card.question || 'No question provided',
        answer: card.answer || 'No answer provided',
        category: card.category || 'General',
        difficulty: card.difficulty || request.difficulty || 'medium',
        tags: card.tags || [],
        createdAt: new Date(),
        reviewCount: 0,
        masteryLevel: 0,
        sourceDocumentId: request.documentId
      }));
    } catch (error) {
      console.error('❌ Error parsing flashcard response:', error);
      
      // Fallback: create simple flashcards from the response
      return this.createFallbackFlashcards(response, request);
    }
  }

  private createFallbackFlashcards(response: string, request: FlashcardGenerationRequest): Flashcard[] {
    console.log('Creating fallback flashcards from response:', response);
    
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


  private buildTextFlashcardPrompt(request: FlashcardGenerationRequest): string {
    const { count = 10, difficulty = 'medium', format = 'q&a', topic, textContent } = request;
    
    // Get user profile context for personalization
    const userProfileContext = UserProfileService.buildPersonalizationContext();
    
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
      description,
      flashcards,
      createdAt: new Date(),
      updatedAt: new Date(),
      sourceDocumentIds,
      tags: []
    };
  }

  updateFlashcardMastery(flashcardId: string, masteryLevel: number): void {
    // Find and update the flashcard in all sets
    this.flashcardSets.forEach(set => {
      const flashcard = set.flashcards.find(card => card.id === flashcardId);
      if (flashcard) {
        flashcard.masteryLevel = masteryLevel;
        flashcard.lastReviewed = new Date();
        flashcard.reviewCount += 1;
        set.updatedAt = new Date();
      }
    });
    
    this.saveFlashcardSets();
  }

  getFlashcardSets(): FlashcardSet[] {
    return [...this.flashcardSets];
  }

  saveFlashcardSet(flashcardSet: FlashcardSet): void {
    const existingIndex = this.flashcardSets.findIndex(set => set.id === flashcardSet.id);
    
    if (existingIndex >= 0) {
      this.flashcardSets[existingIndex] = flashcardSet;
    } else {
      this.flashcardSets.push(flashcardSet);
    }
    
    this.saveFlashcardSets();
  }

  deleteFlashcardSet(setId: string): void {
    this.flashcardSets = this.flashcardSets.filter(set => set.id !== setId);
    this.saveFlashcardSets();
  }

  private loadFlashcardSets(): void {
    try {
      const saved = localStorage.getItem('flashcard_sets');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.flashcardSets = parsed.map((set: any) => ({
          ...set,
          createdAt: new Date(set.createdAt),
          updatedAt: new Date(set.updatedAt),
          flashcards: set.flashcards.map((card: any) => ({
            ...card,
            createdAt: new Date(card.createdAt),
            lastReviewed: card.lastReviewed ? new Date(card.lastReviewed) : undefined
          }))
        }));
        console.log('📚 Loaded flashcard sets:', this.flashcardSets.length);
      }
    } catch (error) {
      console.error('❌ Error loading flashcard sets:', error);
      this.flashcardSets = [];
    }
  }

  private saveFlashcardSets(): void {
    try {
      localStorage.setItem('flashcard_sets', JSON.stringify(this.flashcardSets));
      console.log('💾 Saved flashcard sets:', this.flashcardSets.length);
    } catch (error) {
      console.error('❌ Error saving flashcard sets:', error);
    }
  }
}

// Export singleton instance
export const flashcardService = new RealFlashcardService();
