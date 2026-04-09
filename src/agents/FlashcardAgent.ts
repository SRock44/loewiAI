import { ChatMessage, ChatContext } from '../types/chat';
import { FlashcardGenerationRequest } from '../types/flashcard';
import { flashcardService } from '../services/flashcardService';
import { allFlashcardEventTarget } from '../hooks/useAllFlashcards';
import { firebaseService } from '../services/firebaseService';

export class FlashcardAgent {
  private messageCounter: () => number;
  private getSessions: () => Map<string, import('../types/chat').ChatSession>;
  private getCurrentUserId: () => string | null;

  constructor(
    messageCounter: () => number,
    getSessions: () => Map<string, import('../types/chat').ChatSession>,
    getCurrentUserId: () => string | null
  ) {
    this.messageCounter = messageCounter;
    this.getSessions = getSessions;
    this.getCurrentUserId = getCurrentUserId;
  }

  /**
   * Detects whether the message is a flashcard generation request.
   * Returns the request object if detected, null otherwise.
   */
  detect(message: string, context: ChatContext): FlashcardGenerationRequest | null {
    const lowerMessage = message.toLowerCase();

    const flashcardKeywords = [
      'create flashcards', 'generate flashcards', 'make flashcards',
      'flashcards for', 'flashcards about', 'study cards', 'quiz cards',
      'flashcard', 'study set', 'quiz set', 'learning cards', 'memory cards',
    ];

    if (!flashcardKeywords.some(kw => lowerMessage.includes(kw))) return null;

    // Extract topic
    let topic = '';
    const topicPatterns = [
      /flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /create\s+flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /generate\s+flashcards?\s+(?:for|about|on)\s+(.+)/i,
      /make\s+flashcards?\s+(?:for|about|on)\s+(.+)/i,
    ];
    for (const pattern of topicPatterns) {
      const match = message.match(pattern);
      if (match?.[1]) { topic = match[1].trim(); break; }
    }
    if (!topic) {
      topic = message.replace(/create\s+flashcards?|generate\s+flashcards?|make\s+flashcards?|flashcards?\s+(?:for|about|on)/gi, '').trim();
    }

    const hasDocuments = context.processedDocuments && context.processedDocuments.length > 0;
    if (hasDocuments) {
      const doc = context.processedDocuments![0];
      return { documentId: doc.id, topic: topic || undefined, count: 10, difficulty: 'medium', format: 'q&a', sourceType: 'document' };
    }
    return { textContent: message, topic: topic || undefined, count: 10, difficulty: 'medium', format: 'q&a', sourceType: 'text' };
  }

  async handle(
    request: FlashcardGenerationRequest,
    context: ChatContext,
    userMessage: ChatMessage
  ): Promise<ChatMessage> {
    const sessions = this.getSessions();

    let response;
    if (request.sourceType === 'document' && request.documentId) {
      const doc = context.processedDocuments?.find(d => d.id === request.documentId);
      if (doc) {
        response = await flashcardService.generateFlashcards(request, doc);
      } else {
        throw new Error('Document not found');
      }
    } else {
      response = await flashcardService.generateFlashcardsFromText(request);
    }

    const flashcardSet = flashcardService.createFlashcardSet(
      '', '', response.flashcards, response.sourceDocumentId ? [response.sourceDocumentId] : undefined
    );
    await flashcardService.saveFlashcardSet(flashcardSet);
    allFlashcardEventTarget.dispatchEvent(new CustomEvent('flashcardUpdate'));

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${this.messageCounter()}`,
      role: 'assistant',
      content: `I've successfully created ${response.flashcards.length} flashcards for you.\n\nYour flashcards are now ready for study. You can view them by clicking the "View Flashcards" button in the header, or simply ask me to "show my flashcards" to study them directly in the chat.`,
      timestamp: new Date(),
      flashcardSet,
    };

    if (context.sessionId && sessions.has(context.sessionId)) {
      const session = sessions.get(context.sessionId)!;
      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = new Date();
      const userId = this.getCurrentUserId();
      if (userId) {
        await firebaseService.saveChatSession(session, userId);
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      }
    }

    return assistantMessage;
  }
}
