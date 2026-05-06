/**
 * MasterAgent — owns all application state (sessions, auth, user caches) and routes
 * incoming messages to the appropriate sub-agent.
 *
 * Public method signatures are identical to the old ChatServiceImpl so that
 * chatService.ts (the thin facade) requires zero changes in ChatInterface.tsx.
 */
import { ChatMessage, ChatSession, ChatContext } from '../types/chat';
import { firebaseAuthService } from '../services/firebaseAuthService';
import { firebaseService } from '../services/firebaseService';
import { firebaseAILogicService } from '../services/firebaseAILogicService';
import Groq from 'groq-sdk';

import { ClassifierAgent } from './ClassifierAgent';
import { FormatterAgent } from './FormatterAgent';
import { WriterAgent } from './WriterAgent';
import { ChatAgent } from './ChatAgent';
import { FlashcardAgent } from './FlashcardAgent';
import { DocumentAgent } from './DocumentAgent';
import { ThinkingAgent } from './ThinkingAgent';

export class MasterAgent {
  // ── State ─────────────────────────────────────────────────────────────────
  private sessions: Map<string, ChatSession> = new Map();
  private groqClient: Groq | null = null;
  private messageCounter = 0;
  private currentUserId: string | null = null;
  private realtimeUnsubscribe: (() => void) | null = null;
  private userContextCache: string = '';
  private userMemoryCache: string = '';
  private lastContextSaveTime = 0;
  private recentMessageTimestamps: number[] = [];
  private static IDLE_SAVE_INTERVAL_MS = 2 * 60 * 60 * 1000;
  private static ACTIVE_SAVE_INTERVAL_MS = 20 * 60 * 1000;

  // ── Sub-agents ────────────────────────────────────────────────────────────
  private classifierAgent: ClassifierAgent;
  private formatterAgent: FormatterAgent;
  private writerAgent: WriterAgent;
  private chatAgent: ChatAgent;
  private flashcardAgent: FlashcardAgent;
  private documentAgent: DocumentAgent;
  private thinkingAgent: ThinkingAgent;

  constructor() {
    // Init Groq first so sub-agents that need it can receive the client
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (apiKey) {
      this.groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    }

    // Helpers passed into sub-agents so they share session/user state
    const getCounter = () => ++this.messageCounter;
    const getSessions = () => this.sessions;
    const getUserId = () => this.currentUserId;

    this.classifierAgent = new ClassifierAgent();
    this.formatterAgent = new FormatterAgent();
    this.writerAgent = new WriterAgent();
    this.chatAgent = new ChatAgent(getCounter, getSessions, getUserId);
    this.flashcardAgent = new FlashcardAgent(getCounter, getSessions, getUserId);
    this.documentAgent = new DocumentAgent(
      this.classifierAgent,
      this.writerAgent,
      this.formatterAgent,
      getCounter,
      getSessions,
      getUserId
    );
    this.thinkingAgent = new ThinkingAgent(this.groqClient, getCounter, getSessions, getUserId);

    this.setupAuthStateListener();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  private setupAuthStateListener() {
    firebaseAuthService.onAuthStateChange((user) => {
      if (user && user.id !== this.currentUserId) {
        this.currentUserId = user.id;
        this.loadSessionsFromFirebase();
        this.loadUserContext();
        this.loadUserMemory();
      } else if (!user && this.currentUserId) {
        this.realtimeUnsubscribe?.();
        this.realtimeUnsubscribe = null;
        this.currentUserId = null;
        this.sessions.clear();
        this.messageCounter = 0;
        this.userContextCache = '';
        this.userMemoryCache = '';
        this.lastContextSaveTime = 0;
        this.recentMessageTimestamps = [];
      }
    });
  }

  private async loadSessionsFromFirebase() {
    if (!this.currentUserId) { this.sessions.clear(); return; }
    try {
      const firebaseSessions = await firebaseService.getChatSessions(this.currentUserId);
      const sorted = firebaseSessions
        .filter(s => this.hasValidConversation(s))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      this.sessions = new Map();
      sorted.forEach(s => this.sessions.set(s.id, s));
      this.setupRealtimeListener();
    } catch (error) {
      console.error('❌ Error loading chat sessions from Firebase:', error);
      this.sessions.clear();
    }
  }

  private setupRealtimeListener() {
    if (!this.currentUserId) return;
    this.realtimeUnsubscribe?.();
    this.realtimeUnsubscribe = null;
    try {
      const unsubscribe = firebaseService.subscribeToChatSessions(this.currentUserId, (sessions) => {
        const firestoreIds = new Set(sessions.map(s => s.id));
        const localOnly: ChatSession[] = [];
        for (const [id, session] of this.sessions) {
          if (!firestoreIds.has(id)) localOnly.push(session);
        }
        const merged = new Map<string, ChatSession>();
        sessions.filter(s => this.hasValidConversation(s)).forEach(s => merged.set(s.id, s));
        localOnly.forEach(s => merged.set(s.id, s));
        this.sessions = merged;
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      });
      this.realtimeUnsubscribe = unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up real-time listener:', error);
    }
  }

  private async loadUserContext() {
    if (!this.currentUserId) return;
    try { this.userContextCache = await firebaseService.getUserContext(this.currentUserId); }
    catch { this.userContextCache = ''; }
  }

  private async loadUserMemory() {
    if (!this.currentUserId) return;
    try { this.userMemoryCache = await firebaseService.getUserMemory(this.currentUserId); }
    catch { this.userMemoryCache = ''; }
  }

  appendToUserMemory(note: string) {
    if (!this.currentUserId) return;
    const updated = this.userMemoryCache
      ? `${this.userMemoryCache}\n${note}`
      : `# User Memory\n\n${note}`;
    this.userMemoryCache = updated;
    firebaseService.saveUserMemory(this.currentUserId, updated).catch(() => {});
  }

  // ── Core routing ──────────────────────────────────────────────────────────
  async sendMessage(
    message: string,
    context: ChatContext,
    onStreamChunk?: (partialContent: string) => void
  ): Promise<ChatMessage> {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${++this.messageCounter}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      ...(context.imageUrls?.length ? { imageUrls: context.imageUrls } : {}),
      ...(context.fullImageUrls?.length ? { fullImageUrls: context.fullImageUrls } : {}),
      ...(context.storagePaths?.length ? { storagePaths: context.storagePaths } : {}),
    };

    // Share user caches with ChatAgent so conversation context includes memory
    this.chatAgent.setUserCaches(this.userMemoryCache, this.userContextCache);

    try {
      // 1. Flashcards (fast heuristic, no AI call)
      const flashcardRequest = this.flashcardAgent.detect(message, context);
      if (flashcardRequest) {
        const result = await this.flashcardAgent.handle(flashcardRequest, context, userMessage);
        this.maybeGenerateSessionTitle(context.sessionId, message);
        return result;
      }

      // 2. Code execution guard
      if (this.isCodeExecutionRequest(message)) {
        return this.codeExecutionGuidance(context.sessionId, userMessage);
      }

      // 3. Document routing (heuristic gate + AI classifier)
      const { intent, classification } = await this.documentAgent.classify(message);
      if (intent !== 'none') {
        const result = await this.documentAgent.handle(
          intent, classification, message, context, userMessage, onStreamChunk
        );
        this.maybeUpdateUserContext(context.sessionId);
        this.maybeGenerateSessionTitle(context.sessionId, message);
        return result;
      }

      // 4. Thinking mode (swarm: research + analysis sub-agents → synthesis)
      // Triggered by: explicit toggle in UI OR complex prompts (≥ 150 chars)
      const shouldThink = context.isThinkingMode || message.length >= 150;
      if (shouldThink) {
        this.chatAgent.setUserCaches(this.userMemoryCache, this.userContextCache);
        const result = await this.thinkingAgent.handle(
          message, context, userMessage,
          this.userMemoryCache, this.userContextCache, onStreamChunk
        );
        this.maybeUpdateUserContext(context.sessionId);
        this.maybeGenerateSessionTitle(context.sessionId, message);
        return result;
      }

      // 5. Regular chat
      const result = await this.chatAgent.handle(message, context, userMessage, onStreamChunk);
      this.maybeUpdateUserContext(context.sessionId);
      this.maybeGenerateSessionTitle(context.sessionId, message);
      return result;
    } catch (error) {
      console.error('Error in MasterAgent.sendMessage:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: "I'm having trouble processing your request right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      if (context.sessionId && this.sessions.has(context.sessionId)) {
        const session = this.sessions.get(context.sessionId)!;
        session.messages.push(userMessage, errorMessage);
        session.updatedAt = new Date();
        if (this.currentUserId) {
          firebaseService.saveChatSession(session, this.currentUserId).catch(() => {});
          window.dispatchEvent(new CustomEvent('sessionUpdated'));
        }
      }
      return errorMessage;
    }
  }

  // ── Session management ────────────────────────────────────────────────────
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  async createNewSession(title?: string): Promise<ChatSession> {
    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const defaultTitle = title || this.generateSessionTitle();
    const session: ChatSession = {
      id: sessionId,
      title: defaultTitle,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      documentIds: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    let userId = this.currentUserId;
    if (!userId) {
      const currentUser = firebaseAuthService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');
      userId = currentUser.id;
    }
    if (userId) {
      await firebaseService.deleteChatSession(sessionId);
      await this.loadSessionsFromFirebase();
    }
    this.sessions.delete(sessionId);
    window.dispatchEvent(new CustomEvent('sessionUpdated'));
  }

  async updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (context.documentIds) session.documentIds = context.documentIds;
      session.updatedAt = new Date();
      if (this.currentUserId) {
        await firebaseService.saveChatSession(session, this.currentUserId);
      }
    }
  }

  getSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(s => this.hasValidConversation(s))
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });
  }

  addMessagesToSession(sessionId: string, messages: ChatMessage[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(...messages);
      session.updatedAt = new Date();
    }
  }

  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (this.currentUserId) {
      await firebaseService.saveChatSession(session, this.currentUserId);
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
    }
  }

  async reloadForUser(): Promise<void> {
    await this.loadSessionsFromFirebase();
  }

  // ── Ratings & Retry ───────────────────────────────────────────────────────
  async removeRating(messageId: string): Promise<void> {
    await firebaseService.deleteMessageRating(messageId);
  }

  async rateMessage(
    messageId: string,
    sessionId: string,
    rating: 'good' | 'bad',
    assistantContent: string,
    userContent: string,
    feedback?: string
  ): Promise<void> {
    if (!this.currentUserId) return;
    await firebaseService.saveMessageRating({ messageId, sessionId, userId: this.currentUserId, rating, assistantContent, userContent, feedback });
    if (rating === 'bad' && feedback) {
      const topicPreview = userContent.substring(0, 80).replace(/\n/g, ' ');
      this.appendToUserMemory(`- [${new Date().toLocaleDateString()}] Improvement requested for: "${topicPreview}" — Feedback: "${feedback}"`);
    }
  }

  async retryMessage(
    sessionId: string,
    assistantMessageId: string,
    feedback?: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const assistantIdx = session.messages.findIndex(m => m.id === assistantMessageId);
    if (assistantIdx < 0) throw new Error('Assistant message not found');

    const removed = session.messages.splice(assistantIdx);
    const userMsg = session.messages[session.messages.length - 1];
    if (!userMsg || userMsg.role !== 'user') {
      session.messages.push(...removed);
      throw new Error('No preceding user message found');
    }

    if (feedback) {
      const topicPreview = userMsg.content.substring(0, 80).replace(/\n/g, ' ');
      this.appendToUserMemory(`- [${new Date().toLocaleDateString()}] User preference (from retry): "${feedback}" (context: "${topicPreview}")`);
    }

    // Build conversation context (with user memory injected)
    this.chatAgent.setUserCaches(this.userMemoryCache, this.userContextCache);
    const documentContext = this.buildDocumentContextForSession(session);
    const conversationContext = this.buildConversationContextForRetry(sessionId);

    const messageForAI = feedback
      ? `${userMsg.content}\n\n[The previous response was unsatisfactory. Please provide a significantly improved answer addressing this feedback: "${feedback}"]`
      : userMsg.content;

    try {
      // Call AI directly — do NOT go through chatAgent.handle() because that would
      // push userMsg to the session again, duplicating it.
      const aiResponse = onStreamChunk
        ? await firebaseAILogicService.generateResponseStream(messageForAI, documentContext, conversationContext, onStreamChunk)
        : await firebaseAILogicService.generateResponse(messageForAI, documentContext, conversationContext);

      const isDoc = this.isDocumentRequest(userMsg.content);
      const chatContent = isDoc
        ? this.formatterAgent.extractDocumentSummary(aiResponse.content)
        : aiResponse.content;

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${++this.messageCounter}`,
        role: 'assistant',
        content: chatContent,
        timestamp: new Date(),
        ...(isDoc ? {
          isDocument: true,
          documentTitle: this.formatterAgent.extractDocumentTitle(userMsg.content, 'Document'),
          documentContent: aiResponse.content,
        } : {}),
      };

      session.messages.push(newMsg);
      session.updatedAt = new Date();

      if (this.currentUserId) {
        firebaseService.saveChatSession(session, this.currentUserId).catch(() => {});
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      }

      return newMsg;
    } catch (error) {
      session.messages.push(...removed);
      throw error;
    }
  }

  private buildDocumentContextForSession(session: import('../types/chat').ChatSession): string {
    if (!session.documentIds || session.documentIds.length === 0) return '';
    return `The user has uploaded ${session.documentIds.length} document(s) that may be relevant.`;
  }

  private buildConversationContextForRetry(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    let context = '';
    if (this.userMemoryCache) {
      context += '\n\nUSER MEMORY:\n' + this.userMemoryCache + '\n';
    }
    if (this.userContextCache) {
      context += '\n\nUSER STUDY HISTORY:\n' + this.userContextCache + '\n';
    }
    const recentMessages = session.messages.slice(-8);
    if (recentMessages.length > 1) {
      context += '\n\nCURRENT CONVERSATION:\n';
      for (let i = 0; i < recentMessages.length - 1; i++) {
        const msg = recentMessages[i];
        const role = msg.role === 'user' ? 'User' : 'Newton';
        const content = msg.content.length > 400 ? msg.content.substring(0, 400) + '...' : msg.content;
        context += `${role}: ${content}\n\n`;
      }
    }
    return context;
  }

  // ── Document helpers (kept for ChatInterface.tsx compatibility) ───────────
  isDocumentRequest(message: string): boolean {
    const creationVerbs = /\b(?:create|make|generate|write|build|produce|give me|can you make|can you create|can you generate)\b/i;
    if (!creationVerbs.test(message)) return false;
    const documentTypes = /\b(?:study guide|formula sheet|cheat sheet|reference sheet|summary sheet|review sheet|fact sheet|reference card|quick reference|study sheet|notes sheet|pdf)\b/i;
    return documentTypes.test(message);
  }

  extractDocumentTitle(message: string): string {
    return this.formatterAgent.extractDocumentTitle(message, 'Document');
  }

  mightBeDocument(message: string): boolean {
    return this.classifierAgent.mightBeDocument(message);
  }

  /** Returns true if the message is complex enough to auto-trigger thinking mode. */
  mightNeedThinking(message: string): boolean {
    return message.length >= 150;
  }

  /** Generate a short contextual first loading message (~10-20 tokens). */
  generateLoadingHint(
    query: string,
    type: 'thinking' | 'document' | 'flashcard'
  ): Promise<string> {
    return this.thinkingAgent.generateLoadingHint(query, type);
  }

  mightBeFlashcard(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const flashcardKeywords = [
      'create flashcards', 'generate flashcards', 'make flashcards',
      'flashcards for', 'flashcards about', 'study cards', 'quiz cards',
      'flashcard', 'study set', 'quiz set', 'learning cards', 'memory cards',
    ];
    return flashcardKeywords.some(kw => lowerMessage.includes(kw));
  }

  // ── AI provider info ──────────────────────────────────────────────────────
  getAIProviderInfo(): string {
    return firebaseAILogicService.getCurrentProvider();
  }

  getAvailableAIProviders(): string[] {
    return firebaseAILogicService.getAvailableProviders();
  }

  async testAIConnection(): Promise<boolean> {
    return firebaseAILogicService.testConnection();
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  private isCodeExecutionRequest(message: string): boolean {
    const keywords = [
      'run this code', 'execute this code', 'run the code', 'execute the code',
      'test this code', 'run it', 'execute it', 'can you run', 'please run',
      'how do i run', 'how to run', 'run the program', 'execute the program',
      'test the program', 'run this program', 'execute this program',
      'does this work', 'will this work', 'can you test', 'please test',
      'try running', 'run and see', 'execute and see',
    ];
    const lower = message.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }

  private codeExecutionGuidance(sessionId: string, userMessage: ChatMessage): ChatMessage {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${++this.messageCounter}`,
      role: 'assistant',
      content: `I understand you'd like to run the code! While I can help you write and validate code, I can't execute it directly in this interface.

**To run your code, you can:**

🖥️ **Desktop IDEs:**
- **VS Code** - Free, excellent for most languages
- **Cursor** - AI-powered code editor
- **IntelliJ IDEA** - Great for Java, Python, and more

🌐 **Online Compilers:**
- **Replit** - Supports 50+ languages, collaborative
- **CodePen** - Great for HTML/CSS/JavaScript
- **JSFiddle** - JavaScript playground
- **OnlineGDB** - C, C++, Python, Java, and more

Would you like me to help you with anything else about the code?`,
      timestamp: new Date(),
    };
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.messages.push(userMessage, msg);
      session.updatedAt = new Date();
      if (this.currentUserId) {
        firebaseService.saveChatSession(session, this.currentUserId).catch(() => {});
        window.dispatchEvent(new CustomEvent('sessionUpdated'));
      }
    }
    return msg;
  }

  private generateSessionTitle(): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Chat ${dateStr} ${timeStr}`;
  }

  private hasValidConversation(session: ChatSession): boolean {
    return session.messages?.some(msg =>
      msg.content?.trim().length > 0 && (msg.role === 'user' || msg.role === 'assistant')
    ) ?? false;
  }

  private buildSessionSummary(session: ChatSession): string {
    if (!session.messages || session.messages.length < 2) return '';
    const userMessages = session.messages
      .filter(m => m.role === 'user')
      .map(m => m.content.length > 150 ? m.content.substring(0, 150) + '...' : m.content);
    const title = session.title || 'Untitled';
    const date = session.updatedAt instanceof Date ? session.updatedAt.toLocaleDateString() : new Date().toLocaleDateString();
    const topics = userMessages.slice(0, 5).join(' | ');
    return `- ${title} (${date}): ${topics}`;
  }

  /**
   * After the first exchange in a session, use a fast AI call to generate a concise
   * descriptive title and replace the generic "Chat {timestamp}" placeholder.
   * Runs in the background — does not block the response.
   */
  private maybeGenerateSessionTitle(sessionId: string, firstUserMessage: string) {
    const session = this.sessions.get(sessionId);
    // Only run after the first exchange and only if still using the generic timestamp title
    if (!session || !session.title.startsWith('Chat ') || session.messages.length > 4) return;
    if (!this.groqClient) return;

    const userId = this.currentUserId;

    this.groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 20,
      messages: [
        {
          role: 'system',
          content: 'Generate a concise 3–5 word title for a chat conversation based on the first user message. Respond with ONLY the title — no quotes, no punctuation at the end, no explanation.',
        },
        {
          role: 'user',
          content: firstUserMessage.substring(0, 200),
        },
      ],
    }).then(completion => {
      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      const title = raw
        .replace(/^["']|["']$/g, '')   // strip surrounding quotes if any
        .replace(/[.!?]$/, '')          // strip trailing punctuation
        .trim();
      if (title.length < 3 || title.length >= 60) return;

      // IMPORTANT: re-fetch the session from this.sessions at callback time.
      // The closure-captured `session` is a stale snapshot — if new messages arrived
      // during the Groq call, saving the old object would overwrite them in Firestore.
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession || !currentSession.title.startsWith('Chat ')) return;

      currentSession.title = title;
      if (userId) {
        firebaseService.saveChatSession(currentSession, userId).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('sessionUpdated'));
    }).catch(() => {
      // Non-critical — leave the timestamp title if this fails
    });
  }

  private maybeUpdateUserContext(_sessionId: string) {
    if (!this.currentUserId) return;
    const now = Date.now();
    this.recentMessageTimestamps.push(now);
    const tenMinAgo = now - 10 * 60 * 1000;
    this.recentMessageTimestamps = this.recentMessageTimestamps.filter(t => t > tenMinAgo);
    const isVeryActive = this.recentMessageTimestamps.length >= 5;
    const interval = isVeryActive ? MasterAgent.ACTIVE_SAVE_INTERVAL_MS : MasterAgent.IDLE_SAVE_INTERVAL_MS;
    if (now - this.lastContextSaveTime < interval) return;
    this.lastContextSaveTime = now;

    const allSummaries = Array.from(this.sessions.values())
      .filter(s => s.messages.length >= 2)
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 15)
      .map(s => this.buildSessionSummary(s))
      .filter(s => s.length > 0);

    if (allSummaries.length === 0) return;

    const md = `# User Study Context\nUpdated: ${new Date().toISOString()}\n\nRecent topics and questions:\n${allSummaries.join('\n')}\n`;
    this.userContextCache = md;
    firebaseService.saveUserContext(this.currentUserId, md).catch(() => {});
  }
}
