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
  getFlashcardSets(): Promise<FlashcardSet[]>;
  saveFlashcardSet(flashcardSet: FlashcardSet): Promise<void>;
  deleteFlashcardSet(setId: string): Promise<void>;
  cleanupLocalIds(): Promise<void>;
}

// this service handles all flashcard operations - generating them from documents/text,
// saving them, updating mastery levels, etc.
// it works for both authenticated users (saves to firebase) and unauthenticated (localStorage)
class RealFlashcardService implements FlashcardService {
  // track which user is logged in so we know where to save flashcards
  private currentUserId: string | null = null;

  constructor() {
    // listen for when user signs in/out so we can update where we save data
    this.setupAuthListener();
  }

  private setupAuthListener() {
    // when auth state changes, update our current user id
    // if user signs in, we'll save to firebase. if they sign out, we'll use localStorage
    firebaseAuthService.onAuthStateChange((user) => {
      if (user && user.id !== this.currentUserId) {
        this.currentUserId = user.id;
      } else if (!user && this.currentUserId) {
        this.currentUserId = null;
      }
    });
  }

  // helper to get current user id - checks auth service if we don't have it cached
  private getCurrentUserId(): string | null {
    if (!this.currentUserId) {
      const currentUser = firebaseAuthService.getCurrentUser();
      if (!currentUser) {
        return null; // not logged in - that's ok, we'll use localStorage
      }
      this.currentUserId = currentUser.id;
    }
    return this.currentUserId;
  }

  // main function to generate flashcards from a document
  // the AI reads the document content and creates question/answer pairs
  async generateFlashcards(
    request: FlashcardGenerationRequest, 
    document?: ProcessedDocument
  ): Promise<FlashcardGenerationResponse> {
    // if user provided text directly instead of a document, use that path
    if (request.sourceType === 'text' || request.textContent) {
      return this.generateFlashcardsFromText(request);
    }
    
    if (!document) {
      throw new Error('Document is required for document-based flashcard generation');
    }
    
    try {
      // build a prompt that tells the AI what kind of flashcards to make
      // includes document content, user preferences (count, difficulty, format), etc.
      const prompt = await this.buildFlashcardPrompt(request, document);
      // Use dedicated flashcard generation method that bypasses system prompt
      let response = await firebaseAILogicService.generateFlashcards(prompt);
      
      // try to parse the AI response as JSON (it should return flashcards in JSON format)
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        // sometimes the AI adds extra text around the JSON (like markdown code blocks)
        // if parsing fails, we retry with a more explicit prompt telling it to return ONLY json
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await firebaseAILogicService.generateFlashcards(retryPrompt);
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
      // Use dedicated flashcard generation method that bypasses system prompt
      let response = await firebaseAILogicService.generateFlashcards(prompt);
      
      // Try to parse the response
      let flashcards: Flashcard[];
      try {
        flashcards = this.parseFlashcardResponse(response.content, request);
      } catch (parseError) {
        // First attempt failed, retrying with more explicit prompt
        // Retry with a more explicit prompt
        const retryPrompt = `You must respond with ONLY valid JSON. No explanatory text, no code examples, no markdown. Start with { and end with }.

${prompt}`;
        response = await firebaseAILogicService.generateFlashcards(retryPrompt);
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
      // Raw AI response received
      
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
      // Parsed JSON successfully
      
      if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error('Invalid flashcard format - missing flashcards array');
      }

      // Successfully parsed flashcards

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
      id: '', // Will be set by Firebase when saved
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
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      // For unauthenticated users, update local storage
      this.updateLocalFlashcardMastery(flashcardId, masteryLevel);
      return;
    }
    
    try {
      // Get all flashcard sets from Firebase
      const flashcardSets = await firebaseService.getFlashcardSets(userId);
      
      // Find the flashcard set containing the flashcard to update
      let updatedSet: FlashcardSet | undefined;
      for (const set of flashcardSets) {
        const flashcard = set.flashcards.find(card => card.id === flashcardId);
        if (flashcard) {
          // Update the flashcard
          flashcard.masteryLevel = masteryLevel;
          flashcard.lastReviewed = new Date();
          flashcard.reviewCount += 1;
          set.updatedAt = new Date();
          updatedSet = set;
          break;
        }
      }
      
      // Save to Firebase if we found an updated set
      if (updatedSet) {
        await firebaseService.updateFlashcardSet(updatedSet.id, updatedSet);
        // Successfully updated flashcard mastery in Firebase
      } else {
        // Flashcard not found for mastery update
      }
    } catch (error) {
      console.error('Failed to update flashcard mastery:', error);
      throw new Error('Failed to update flashcard mastery');
    }
  }

  async getFlashcardSets(): Promise<FlashcardSet[]> {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      // For unauthenticated users, get from local storage
      return this.getLocalFlashcardSets();
    }
    
    try {
      return await firebaseService.getFlashcardSets(userId);
    } catch (error) {
      console.error('Error fetching flashcard sets from Firebase:', error);
      return [];
    }
  }

  async saveFlashcardSet(flashcardSet: FlashcardSet): Promise<void> {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      // For unauthenticated users, save to local storage
      this.saveLocalFlashcardSet(flashcardSet);
      return;
    }
    
    try {
      // Saving flashcard set to Firebase
      
      const firebaseId = await firebaseService.saveFlashcardSet(flashcardSet, userId);
      
      // Successfully saved flashcard set to Firebase
      
      // Update the flashcard set with the Firebase ID
      flashcardSet.id = firebaseId;
      
    } catch (error) {
      console.error('Failed to save flashcard set:', error);
      throw new Error('Failed to save flashcard set');
    }
  }


  async deleteFlashcardSet(setId: string): Promise<void> {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      // For unauthenticated users, delete from local storage
      this.deleteLocalFlashcardSet(setId);
      return;
    }
    
    try {
      // Attempting to delete flashcard set
      
      // If it's a local ID, we need to find the actual Firebase document
      if (setId.startsWith('set_')) {
        // Local ID detected, finding Firebase document
        
        // Get all flashcard sets from Firebase
        const allSets = await firebaseService.getFlashcardSets(userId);
        // Available flashcard sets retrieved
        
        // Since we can't find the exact match, delete ALL flashcard sets to clean up
        // Local ID not found in Firebase, performing complete cleanup
        let deletedCount = 0;
        for (const set of allSets) {
          try {
            await firebaseService.deleteFlashcardSet(set.id, userId);
            // Deleted set successfully
            deletedCount++;
          } catch (error) {
            // Failed to delete set
          }
        }
        // Cleanup completed
      } else {
        // It's already a Firebase document ID
        // Firebase document ID detected, deleting directly
        await firebaseService.deleteFlashcardSet(setId, userId);
        // Successfully deleted flashcard set from Firebase
      }
      
    } catch (error) {
      console.error('Failed to delete flashcard set:', error);
      throw new Error('Failed to delete flashcard set');
    }
  }

  // Cleanup method to remove all flashcard sets with local IDs
  async cleanupLocalIds(): Promise<void> {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      // For unauthenticated users, cleanup local storage
      this.cleanupLocalStorage();
      return;
    }
    
    try {
      // Starting cleanup of flashcard sets with local IDs
      
      // Get all flashcard sets from Firebase
      const allSets = await firebaseService.getFlashcardSets(userId);
      
      // Find sets that have local IDs (stored in the document data)
      const setsWithLocalIds = allSets.filter(set => {
        const data = set as any;
        return data.originalId && data.originalId.startsWith('set_');
      });
      
      // Found sets with local IDs to cleanup
      
      // Delete all sets with local IDs
      for (const set of setsWithLocalIds) {
        try {
          await firebaseService.deleteFlashcardSet(set.id, userId);
          // Cleaned up set with local ID
        } catch (error) {
          // Failed to cleanup set
        }
      }
      
      // Cleanup completed
      
    } catch (error) {
      console.error('Failed to cleanup local IDs:', error);
      throw new Error('Failed to cleanup local IDs');
    }
  }

  // Local storage methods for unauthenticated users
  private getLocalFlashcardSets(): FlashcardSet[] {
    try {
      const stored = localStorage.getItem('flashcardSets');
      if (stored) {
        const sets = JSON.parse(stored);
        // Convert date strings back to Date objects
        return sets.map((set: any) => ({
          ...set,
          createdAt: new Date(set.createdAt),
          updatedAt: new Date(set.updatedAt),
          flashcards: set.flashcards.map((card: any) => ({
            ...card,
            createdAt: new Date(card.createdAt),
            lastReviewed: card.lastReviewed ? new Date(card.lastReviewed) : undefined
          }))
        }));
      }
      return [];
    } catch (error) {
      console.error('Error loading flashcard sets from local storage:', error);
      return [];
    }
  }

  private saveLocalFlashcardSet(flashcardSet: FlashcardSet): void {
    try {
      const existingSets = this.getLocalFlashcardSets();
      const updatedSets = [...existingSets, flashcardSet];
      localStorage.setItem('flashcardSets', JSON.stringify(updatedSets));
    } catch (error) {
      console.error('Error saving flashcard set to local storage:', error);
    }
  }

  private deleteLocalFlashcardSet(setId: string): void {
    try {
      const existingSets = this.getLocalFlashcardSets();
      const updatedSets = existingSets.filter(set => set.id !== setId);
      localStorage.setItem('flashcardSets', JSON.stringify(updatedSets));
    } catch (error) {
      console.error('Error deleting flashcard set from local storage:', error);
    }
  }

  private updateLocalFlashcardMastery(flashcardId: string, masteryLevel: number): void {
    try {
      const existingSets = this.getLocalFlashcardSets();
      const updatedSets = existingSets.map(set => ({
        ...set,
        flashcards: set.flashcards.map(card => 
          card.id === flashcardId 
            ? { ...card, masteryLevel, lastReviewed: new Date(), reviewCount: (card.reviewCount || 0) + 1 }
            : card
        )
      }));
      localStorage.setItem('flashcardSets', JSON.stringify(updatedSets));
    } catch (error) {
      console.error('Error updating flashcard mastery in local storage:', error);
    }
  }

  private cleanupLocalStorage(): void {
    try {
      // Remove flashcard sets older than 24 hours from local storage
      const existingSets = this.getLocalFlashcardSets();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSets = existingSets.filter(set => 
        new Date(set.createdAt) > twentyFourHoursAgo
      );
      localStorage.setItem('flashcardSets', JSON.stringify(recentSets));
    } catch (error) {
      console.error('Error cleaning up local storage:', error);
    }
  }


}

// Export singleton instance
export const flashcardService = new RealFlashcardService();
