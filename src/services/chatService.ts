/**
 * chatService — public singleton facade.
 *
 * All logic now lives in MasterAgent. This file exists solely to preserve the
 * existing import path (`import { chatService } from './chatService'`) used
 * throughout ChatInterface.tsx and other callers. No behavior has changed.
 */
import { ChatMessage, ChatSession, ChatContext, ChatService } from '../types/chat';
import { MasterAgent } from '../agents/MasterAgent';

class ChatServiceImpl implements ChatService {
  private master = new MasterAgent();

  // ── Core messaging ────────────────────────────────────────────────────────
  sendMessage(
    message: string,
    context: ChatContext,
    onStreamChunk?: (partialContent: string) => void
  ): Promise<ChatMessage> {
    return this.master.sendMessage(message, context, onStreamChunk);
  }

  getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.master.getChatHistory(sessionId);
  }

  // ── Session management ────────────────────────────────────────────────────
  createNewSession(title?: string): Promise<ChatSession> {
    return this.master.createNewSession(title);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.master.deleteSession(sessionId);
  }

  updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void> {
    return this.master.updateContext(sessionId, context);
  }

  getSessions(): ChatSession[] {
    return this.master.getSessions();
  }

  addMessagesToSession(sessionId: string, messages: ChatMessage[]): void {
    this.master.addMessagesToSession(sessionId, messages);
  }

  saveSession(sessionId: string): Promise<void> {
    return this.master.saveSession(sessionId);
  }

  reloadForUser(): Promise<void> {
    return this.master.reloadForUser();
  }

  // ── Ratings & retry ───────────────────────────────────────────────────────
  removeRating(messageId: string): Promise<void> {
    return this.master.removeRating(messageId);
  }

  rateMessage(
    messageId: string,
    sessionId: string,
    rating: 'good' | 'bad',
    assistantContent: string,
    userContent: string,
    feedback?: string
  ): Promise<void> {
    return this.master.rateMessage(messageId, sessionId, rating, assistantContent, userContent, feedback);
  }

  retryMessage(
    sessionId: string,
    assistantMessageId: string,
    feedback?: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    return this.master.retryMessage(sessionId, assistantMessageId, feedback, onStreamChunk);
  }

  // ── Document helpers ──────────────────────────────────────────────────────
  isDocumentRequest(message: string): boolean {
    return this.master.isDocumentRequest(message);
  }

  extractDocumentTitle(message: string): string {
    return this.master.extractDocumentTitle(message);
  }

  /** Heuristic gate — true if this message might be any document request. */
  mightBeDocument(message: string): boolean {
    return this.master.mightBeDocument(message);
  }

  /** Heuristic gate — true if this message might be a flashcard request. */
  mightBeFlashcard(message: string): boolean {
    return this.master.mightBeFlashcard(message);
  }

  /** Heuristic gate — true if this message warrants deep thinking mode. */
  mightNeedThinking(message: string): boolean {
    return this.master.mightNeedThinking(message);
  }

  /** Generate a short contextual loading hint (~20 tokens) for the spinner. */
  generateLoadingHint(
    query: string,
    type: 'thinking' | 'document' | 'flashcard'
  ): Promise<string> {
    return this.master.generateLoadingHint(query, type);
  }

  // ── AI provider info ──────────────────────────────────────────────────────
  getAIProviderInfo(): string {
    return this.master.getAIProviderInfo();
  }

  getAvailableAIProviders(): string[] {
    return this.master.getAvailableAIProviders();
  }

  testAIConnection(): Promise<boolean> {
    return this.master.testAIConnection();
  }
}

export const chatService = new ChatServiceImpl();
