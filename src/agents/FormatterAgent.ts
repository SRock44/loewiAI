import { IntentClassificationResult, ProfessionalDocumentMetadata, CitationStyle } from '../types/documentIntent';
import { firebaseAuthService } from '../services/firebaseAuthService';

export class FormatterAgent {
  /**
   * Extracts structured metadata from a user message + classification result.
   * All regex extraction is synchronous — no AI call.
   */
  extractMetadata(
    message: string,
    classification: IntentClassificationResult
  ): ProfessionalDocumentMetadata {
    const citationStyle = this.extractCitationStyle(message, classification);
    const documentType = this.resolveDocumentType(message, classification);
    const title = this.extractDocumentTitle(message, documentType);
    const courseName = this.extractCourse(message);
    const professorName = this.extractProfessor(message);
    const authorName = firebaseAuthService.getCurrentUser()?.name ?? undefined;
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      documentType,
      citationStyle,
      authorName,
      courseName,
      professorName,
      date,
      title,
    };
  }

  private extractCitationStyle(
    message: string,
    classification: IntentClassificationResult
  ): CitationStyle {
    if (classification.citationStyle) return classification.citationStyle;
    const match = message.match(/\b(MLA|APA|Chicago)\b/i);
    if (!match) return null;
    const s = match[1].toUpperCase();
    if (s === 'MLA') return 'MLA';
    if (s === 'APA') return 'APA';
    if (s === 'CHICAGO') return 'Chicago';
    return null;
  }

  private resolveDocumentType(
    message: string,
    classification: IntentClassificationResult
  ): string {
    if (classification.documentType) return classification.documentType;
    const lower = message.toLowerCase();
    if (lower.includes('research paper')) return 'Research Paper';
    if (lower.includes('lab report')) return 'Lab Report';
    if (lower.includes('term paper')) return 'Term Paper';
    if (lower.includes('thesis')) return 'Thesis';
    if (lower.includes('cover letter')) return 'Cover Letter';
    if (lower.includes('resume')) return 'Resume';
    if (lower.includes('argumentative')) return 'Argumentative Essay';
    if (lower.includes('analytical')) return 'Analytical Essay';
    if (lower.includes('position paper')) return 'Position Paper';
    if (lower.includes('essay')) return 'Essay';
    if (lower.includes('report')) return 'Report';
    return 'Essay';
  }

  /**
   * Extracts a human-readable title for the document.
   * Public so MasterAgent can keep using it via the same path.
   */
  extractDocumentTitle(message: string, docType: string): string {
    const patterns = [
      /(?:write|create|draft|compose|generate)\s+(?:a\s+|an\s+)?(?:[\w\s]+)\s+(?:on|about|regarding)\s+(.+?)(?:\s+(?:for|in|using|with|by)|\s*$)/i,
      /(?:on|about|regarding)\s+(.+?)(?:\s+(?:for|in|MLA|APA|Chicago|class|course|Dr\.|professor)|\s*$)/i,
      /(?:write|create|draft|compose|generate)\s+(?:a\s+|an\s+)?\w+\s+(.+)/i,
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match?.[1]) {
        const topic = match[1].trim().replace(/[^\w\s\-']/g, '').trim();
        if (topic.length > 0 && topic.length < 80) {
          return `${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
        }
      }
    }
    return docType;
  }

  /**
   * Extracts the course name from phrases like "for Biology 101" or "in CHEM 200".
   */
  extractCourse(message: string): string | undefined {
    const match = message.match(/(?:for|in)\s+(?:my\s+)?([A-Za-z]+\s*\d+[A-Za-z]*)/i);
    return match?.[1]?.trim() ?? undefined;
  }

  /**
   * Extracts professor name from phrases like "for Dr. Smith" or "with Professor Johnson".
   */
  extractProfessor(message: string): string | undefined {
    const match = message.match(/(?:with|for)\s+(?:Dr\.?|Professor|Prof\.?)\s+([A-Za-z]+)/i);
    return match?.[1]?.trim() ?? undefined;
  }

  /**
   * Extracts the first meaningful paragraph as a chat-visible summary of a long document.
   */
  extractDocumentSummary(fullContent: string): string {
    const match = fullContent.match(/^([\s\S]*?)(?=\n#{1,3} |\n---)/);
    const intro = match ? match[1].trim() : fullContent.slice(0, 400).trim();
    const capped = intro.length > 400 ? intro.slice(0, 400).replace(/\s+\S*$/, '') + '…' : intro;
    return capped || fullContent.slice(0, 200);
  }
}

export const formatterAgent = new FormatterAgent();
