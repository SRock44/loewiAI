import { ChatMessage, ChatContext } from '../types/chat';
import { AIResponse } from '../services/firebaseAILogicService';
import { firebaseAILogicService } from '../services/firebaseAILogicService';
import { firebaseService } from '../services/firebaseService';
import { codeValidator, CodeValidationResult } from '../services/codeValidator';
import { codeExecutor } from '../services/codeExecutor';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';

export class ChatAgent {
  private messageCounter: () => number;
  private getSessions: () => Map<string, import('../types/chat').ChatSession>;
  private getCurrentUserId: () => string | null;
  // Injected by MasterAgent before routing
  private userMemoryCache: string = '';
  private userContextCache: string = '';

  constructor(
    messageCounter: () => number,
    getSessions: () => Map<string, import('../types/chat').ChatSession>,
    getCurrentUserId: () => string | null
  ) {
    this.messageCounter = messageCounter;
    this.getSessions = getSessions;
    this.getCurrentUserId = getCurrentUserId;
  }

  setUserCaches(memory: string, context: string) {
    this.userMemoryCache = memory;
    this.userContextCache = context;
  }

  async handle(
    message: string,
    context: ChatContext,
    userMessage: ChatMessage,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const sessions = this.getSessions();
    const documentContext = this.buildDocumentContext(context.documentIds, context.processedDocuments);
    const conversationContext = this.buildConversationContext(context.sessionId, sessions);

    const isDoc = this.isDocumentRequest(message);

    const aiResponse: AIResponse = onStreamChunk
      ? await firebaseAILogicService.generateResponseStream(message, documentContext, conversationContext, onStreamChunk)
      : await firebaseAILogicService.generateResponse(message, documentContext, conversationContext);

    // Validate + silently correct code blocks
    const validationResults = codeValidator.validateCodeBlocks(aiResponse.content);
    const hasErrors = validationResults.some(r => !r.isValid || r.errors.length > 0);
    let finalContent = aiResponse.content;
    if (hasErrors) {
      const corrected = await this.attemptCodeCorrection(aiResponse.content, validationResults, documentContext);
      if (corrected) finalContent = corrected;
    }
    await codeExecutor.executeCodeBlocks(finalContent);

    const chatContent = isDoc ? this.extractDocumentSummary(finalContent) : finalContent;

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${this.messageCounter()}`,
      role: 'assistant',
      content: chatContent,
      timestamp: new Date(),
      ...(isDoc ? {
        isDocument: true,
        documentTitle: this.extractDocumentTitle(message),
        documentContent: finalContent,
      } : {}),
    };

    // Persist to session
    if (context.sessionId && sessions.has(context.sessionId)) {
      const session = sessions.get(context.sessionId)!;
      session.messages.push(userMessage, assistantMessage);
      session.updatedAt = new Date();
      this.updateSessionTitleIfNeeded(session, message);
      const userId = this.getCurrentUserId();
      if (userId) {
        await firebaseService.saveChatSession(session, userId);
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      }
    }

    return assistantMessage;
  }

  private isDocumentRequest(message: string): boolean {
    const creationVerbs = /\b(?:create|make|generate|write|build|produce|give me|can you make|can you create|can you generate)\b/i;
    if (!creationVerbs.test(message)) return false;
    const documentTypes = /\b(?:study guide|formula sheet|cheat sheet|reference sheet|summary sheet|review sheet|fact sheet|reference card|quick reference|study sheet|notes sheet|pdf)\b/i;
    return documentTypes.test(message);
  }

  private extractDocumentTitle(message: string): string {
    const lower = message.toLowerCase();
    let docType = 'Document';
    if (lower.includes('study guide')) docType = 'Study Guide';
    else if (lower.includes('formula sheet')) docType = 'Formula Sheet';
    else if (lower.includes('cheat sheet')) docType = 'Cheat Sheet';
    else if (lower.includes('reference sheet') || lower.includes('quick reference')) docType = 'Reference Sheet';
    else if (lower.includes('review sheet') || lower.includes('summary sheet')) docType = 'Review Sheet';
    else if (lower.includes('fact sheet')) docType = 'Fact Sheet';

    const topicPatterns = [
      /(?:create|generate|make|write)\s+(?:a\s+|an\s+)?(?:study guide|formula sheet|cheat sheet|reference sheet|review sheet|summary sheet|fact sheet|guide|sheet)\s+(?:for|about|on)\s+(.+)/i,
      /(?:study guide|formula sheet|cheat sheet|reference sheet|review sheet|fact sheet)\s+(?:for|about|on)\s+(.+)/i,
      /(?:for|about|on)\s+(.+?)(?:\s+(?:study guide|formula sheet|cheat sheet|sheet|guide))?$/i,
    ];
    for (const pattern of topicPatterns) {
      const match = message.match(pattern);
      if (match?.[1]) {
        const topic = match[1].trim().replace(/[^a-zA-Z0-9 ]/g, '').trim();
        if (topic.length > 0 && topic.length < 60) {
          return `${topic.charAt(0).toUpperCase() + topic.slice(1)} ${docType}`;
        }
      }
    }
    return docType;
  }

  private extractDocumentSummary(fullContent: string): string {
    const match = fullContent.match(/^([\s\S]*?)(?=\n#{1,3} |\n---)/);
    const intro = match ? match[1].trim() : fullContent.slice(0, 400).trim();
    const capped = intro.length > 400 ? intro.slice(0, 400).replace(/\s+\S*$/, '') + '…' : intro;
    return capped || fullContent.slice(0, 200);
  }

  private buildDocumentContext(documentIds: string[], processedDocuments?: ProcessedDocument[]): string {
    if (documentIds.length === 0) return '';
    if (!processedDocuments || processedDocuments.length === 0) {
      return `The user has uploaded ${documentIds.length} document(s) that may be relevant to their question.`;
    }
    try {
      const summaries = documentProcessor.getDocumentSummaries(processedDocuments);
      const content = documentProcessor.getDocumentContent(processedDocuments, 24000);
      if (!content?.trim()) {
        return `The user has uploaded ${processedDocuments.length} document(s), but the content could not be extracted.`;
      }
      return `The user has uploaded ${processedDocuments.length} document(s):\n\n${summaries}\n\nACTUAL DOCUMENT CONTENT:\n${content}\n\nUse this content as the source of truth.`;
    } catch {
      return `The user has uploaded ${processedDocuments.length} document(s), but there was an error processing the content.`;
    }
  }

  private buildConversationContext(
    sessionId: string,
    sessions: Map<string, import('../types/chat').ChatSession>
  ): string {
    let context = '';

    // Inject user memory (persisted facts about the user — preferences, feedback)
    if (this.userMemoryCache) {
      context += '\n\nUSER MEMORY:\n';
      context += this.userMemoryCache;
      context += '\n';
    }

    // Inject user study history context
    if (this.userContextCache) {
      context += '\n\nUSER STUDY HISTORY:\n';
      context += this.userContextCache;
      context += '\n';
    }

    if (!sessionId || !sessions.has(sessionId)) return context;
    const session = sessions.get(sessionId)!;
    const recentMessages = session.messages.slice(-8);
    if (recentMessages.length <= 1) return context;

    context += '\n\nCURRENT CONVERSATION:\n';
    for (let i = 0; i < recentMessages.length - 1; i++) {
      const msg = recentMessages[i];
      const role = msg.role === 'user' ? 'User' : 'Newton';
      const content = msg.content.length > 400 ? msg.content.substring(0, 400) + '...' : msg.content;
      context += `${role}: ${content}\n\n`;
    }
    return context;
  }

  private updateSessionTitleIfNeeded(session: import('../types/chat').ChatSession, firstMessage: string): void {
    if (session.title.startsWith('Chat ') && session.messages.length === 2) {
      const lower = firstMessage.toLowerCase();
      let newTitle = session.title;
      if (lower.includes('statistics') || lower.includes('probability')) newTitle = 'Statistics & Probability';
      else if (lower.includes('calculus') || lower.includes('derivative') || lower.includes('integral')) newTitle = 'Calculus Help';
      else if (lower.includes('homework') || lower.includes('assignment')) newTitle = 'Homework Help';
      else if (lower.includes('exam') || lower.includes('test') || lower.includes('quiz')) newTitle = 'Exam Preparation';
      else if (lower.includes('essay') || lower.includes('writing') || lower.includes('paper')) newTitle = 'Writing Help';
      else if (lower.includes('research') || lower.includes('project')) newTitle = 'Research Project';
      else if (lower.includes('programming') || lower.includes('code') || lower.includes('algorithm')) newTitle = 'Programming Help';
      else if (lower.includes('physics') || lower.includes('chemistry') || lower.includes('biology')) newTitle = 'Science Help';
      else if (lower.includes('math') || lower.includes('algebra') || lower.includes('geometry')) newTitle = 'Mathematics Help';
      if (newTitle !== session.title) session.title = newTitle;
    }
  }

  private async attemptCodeCorrection(
    originalContent: string,
    validationResults: CodeValidationResult[],
    documentContext: string
  ): Promise<string | null> {
    try {
      let errorSummary = 'Code validation found the following issues:\n\n';
      for (let i = 0; i < validationResults.length; i++) {
        const result = validationResults[i];
        if (result.errors.length === 0 && result.warnings.length === 0) continue;
        errorSummary += `Code Block ${i + 1} (${result.language}):\n`;
        if (result.errors.length > 0) {
          errorSummary += 'Errors:\n';
          for (const error of result.errors) errorSummary += `- Line ${error.line}: ${error.message}\n`;
        }
      }

      const correctionPrompt = `Please fix these code errors:\n\n${errorSummary}\n\nOriginal:\n${originalContent}`;
      const corrected = await firebaseAILogicService.generateResponse(correctionPrompt, documentContext);
      const stillHasErrors = codeValidator.validateCodeBlocks(corrected.content).some(r => !r.isValid || r.errors.length > 0);
      return stillHasErrors ? null : corrected.content;
    } catch {
      return null;
    }
  }
}
