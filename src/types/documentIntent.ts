export type DocumentIntent = 'none' | 'academic-resource' | 'professional-document';
export type CitationStyle = 'MLA' | 'APA' | 'Chicago' | null;

export interface IntentClassificationResult {
  intent: DocumentIntent;
  documentType: string | null;
  citationStyle: CitationStyle;
  confidence: number;
}

export interface ProfessionalDocumentMetadata {
  documentType: string;        // "Research Paper", "Essay", "Lab Report"
  citationStyle: CitationStyle;
  authorName?: string;
  courseName?: string;
  professorName?: string;
  date: string;
  title: string;
}
