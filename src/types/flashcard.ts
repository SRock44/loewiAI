export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: Date;
  lastReviewed?: Date;
  reviewCount: number;
  masteryLevel: number; // 0-3 scale (0=Unassigned, 1=Needs Review, 2=Needs Improvement, 3=Understand)
  sourceDocumentId?: string;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description?: string;
  flashcards: Flashcard[];
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date; // Track last activity for cleanup
  expiresAt?: Date; // 24-hour expiration for flashcard sets
  sourceDocumentIds?: string[];
  tags?: string[];
}

export interface FlashcardGenerationRequest {
  documentId?: string;
  textContent?: string;
  topic?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  format?: 'q&a' | 'definition' | 'concept';
  sourceType?: 'document' | 'text';
}

export interface FlashcardGenerationResponse {
  flashcards: Flashcard[];
  setTitle: string;
  setDescription: string;
  sourceDocumentId?: string;
  sourceText?: string;
}
