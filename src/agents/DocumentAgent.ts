import { ChatMessage, ChatContext } from '../types/chat';
import { DocumentIntent, IntentClassificationResult } from '../types/documentIntent';
import { ClassifierAgent } from './ClassifierAgent';
import { WriterAgent } from './WriterAgent';
import { FormatterAgent } from './FormatterAgent';
import { firebaseService } from '../services/firebaseService';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';

export class DocumentAgent {
  constructor(
    private classifier: ClassifierAgent,
    private writer: WriterAgent,
    private formatter: FormatterAgent,
    private messageCounter: () => number,
    private getSessions: () => Map<string, import('../types/chat').ChatSession>,
    private getCurrentUserId: () => string | null
  ) {}

  /**
   * Classifies the message intent. Returns 'none' if not a document request.
   */
  async classify(message: string): Promise<{ intent: DocumentIntent; classification: IntentClassificationResult }> {
    if (!this.classifier.mightBeDocument(message)) {
      return { intent: 'none', classification: { intent: 'none', documentType: null, citationStyle: null, confidence: 1 } };
    }
    const classification = await this.classifier.classify(message);
    return { intent: classification.intent, classification };
  }

  async handle(
    intent: DocumentIntent,
    classification: IntentClassificationResult,
    message: string,
    context: ChatContext,
    userMessage: ChatMessage,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const sessions = this.getSessions();
    const documentContext = this.buildDocumentContext(context.documentIds, context.processedDocuments);
    const conversationContext = this.buildConversationContext(context.sessionId, sessions);

    if (intent === 'professional-document') {
      return this.handleProfessionalDocument(classification, message, context, userMessage, documentContext, conversationContext, onStreamChunk);
    }
    // academic-resource — same pipeline as before
    return this.handleAcademicResource(message, context, userMessage, documentContext, conversationContext, onStreamChunk);
  }

  private async handleProfessionalDocument(
    classification: IntentClassificationResult,
    message: string,
    context: ChatContext,
    userMessage: ChatMessage,
    documentContext: string,
    conversationContext: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const sessions = this.getSessions();
    const metadata = this.formatter.extractMetadata(message, classification);

    const aiResponse = await this.writer.generateProfessionalDocument(
      message, metadata, documentContext, conversationContext, onStreamChunk
    );

    const cleanedContent = this.cleanProfessionalDocumentContent(aiResponse.content, metadata.title);
    const summary = this.formatter.extractDocumentSummary(cleanedContent);

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${this.messageCounter()}`,
      role: 'assistant',
      content: summary,
      timestamp: new Date(),
      isDocument: true,
      documentTitle: metadata.title,
      documentContent: cleanedContent,
      isProfessionalDocument: true,
      documentMetadata: metadata,
    };

    await this.persistMessage(context, userMessage, assistantMessage, sessions);
    return assistantMessage;
  }

  private async handleAcademicResource(
    message: string,
    context: ChatContext,
    userMessage: ChatMessage,
    documentContext: string,
    conversationContext: string,
    onStreamChunk?: (partial: string) => void
  ): Promise<ChatMessage> {
    const sessions = this.getSessions();

    const aiResponse = await this.writer.generateAcademicResource(
      message, documentContext, conversationContext, onStreamChunk
    );

    const summary = this.formatter.extractDocumentSummary(aiResponse.content);
    const title = this.formatter.extractDocumentTitle(message, 'Document');

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${this.messageCounter()}`,
      role: 'assistant',
      content: summary,
      timestamp: new Date(),
      isDocument: true,
      documentTitle: title,
      documentContent: aiResponse.content,
    };

    await this.persistMessage(context, userMessage, assistantMessage, sessions);
    return assistantMessage;
  }

  private async persistMessage(
    context: ChatContext,
    userMessage: ChatMessage,
    assistantMessage: ChatMessage,
    sessions: Map<string, import('../types/chat').ChatSession>
  ) {
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
  }

  /**
   * Strips AI preamble/disclaimers and the leading title heading from professional document output.
   * The TitleBlock component already renders the title, so a duplicate heading in the body
   * would cause it to appear twice.
   */
  private cleanProfessionalDocumentContent(content: string, title: string): string {
    let cleaned = content.trim();

    // Remove known AI disclaimer patterns that appear before the actual document
    const disclaimerPatterns = [
      /^I(?:'m| am) (?:a |an )?(?:large language model|AI|artificial intelligence)[^\n]*\n+/i,
      /^(?:Certainly|Sure|Of course|Here(?:'s| is)|I(?:'ve| have) (?:written|generated|created|drafted))[^\n]*\n+/i,
      /^(?:As an AI|As a language model|Note:|Please note)[^\n]*\n+/i,
      // Multi-line preamble ending before a heading or blank line + content
      /^(?:[^\n#]+\n)+(?=\n|##? )/,
    ];

    for (const pattern of disclaimerPatterns) {
      const match = cleaned.match(pattern);
      if (match && match.index === 0) {
        const after = cleaned.slice(match[0].length).trim();
        // Only strip if what follows looks like actual document content (starts with ## or a word)
        if (after.length > 100) {
          cleaned = after;
          break;
        }
      }
    }

    // Strip a leading # or ## heading that matches the document title (TitleBlock shows it already)
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleHeadingPattern = new RegExp(`^#{1,2}\\s+${escapedTitle}\\s*\\n+`, 'i');
    cleaned = cleaned.replace(titleHeadingPattern, '');

    // Also strip any generic first-line # heading (AI often outputs "# Essay Title" first)
    cleaned = cleaned.replace(/^#\s+[^\n]+\n+/, '');

    return cleaned.trim();
  }

  private buildDocumentContext(documentIds: string[], processedDocuments?: ProcessedDocument[]): string {
    if (documentIds.length === 0) return '';
    if (!processedDocuments || processedDocuments.length === 0) {
      return `The user has uploaded ${documentIds.length} document(s) that may be relevant.`;
    }
    try {
      const summaries = documentProcessor.getDocumentSummaries(processedDocuments);
      const content = documentProcessor.getDocumentContent(processedDocuments, 24000);
      if (!content?.trim()) return `The user has uploaded ${processedDocuments.length} document(s), but content could not be extracted.`;
      return `The user has uploaded ${processedDocuments.length} document(s):\n\n${summaries}\n\nACTUAL DOCUMENT CONTENT:\n${content}\n\nUse this as the source of truth.`;
    } catch {
      return `The user has uploaded ${processedDocuments.length} document(s), but there was an error processing content.`;
    }
  }

  private buildConversationContext(
    sessionId: string,
    sessions: Map<string, import('../types/chat').ChatSession>
  ): string {
    if (!sessionId || !sessions.has(sessionId)) return '';
    const session = sessions.get(sessionId)!;
    const recentMessages = session.messages.slice(-8);
    if (recentMessages.length <= 1) return '';
    let context = '\n\nCURRENT CONVERSATION:\n';
    for (let i = 0; i < recentMessages.length - 1; i++) {
      const msg = recentMessages[i];
      const role = msg.role === 'user' ? 'User' : 'Newton';
      const content = msg.content.length > 400 ? msg.content.substring(0, 400) + '...' : msg.content;
      context += `${role}: ${content}\n\n`;
    }
    return context;
  }
}
