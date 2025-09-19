// AI Integration Framework Types

export interface DocumentMetadata {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: Date;
  processed: boolean;
  extractedText?: string;
  summary?: string;
  keyTopics?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface AIAnalysis {
  documentId: string;
  analysisType: 'syllabus' | 'lecture' | 'assignment' | 'general';
  summary: string;
  keyTopics: string[];
  learningObjectives?: string[];
  estimatedStudyTime?: number; // in hours
  prerequisites?: string[];
  recommendedResources?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  confidence: number; // 0-1
  processedAt: Date;
}

export interface AIQuery {
  id: string;
  documentId?: string;
  question: string;
  context?: string;
  response?: string;
  timestamp: Date;
  confidence?: number;
}

export interface AIRecommendation {
  id: string;
  type: 'study_plan' | 'resource' | 'reminder' | 'goal';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  completed: boolean;
}

export interface AIService {
  processDocument(file: File): Promise<DocumentMetadata>;
  analyzeDocument(documentId: string): Promise<AIAnalysis>;
  queryDocument(documentId: string, question: string): Promise<AIQuery>;
  generateRecommendations(documentId: string): Promise<AIRecommendation[]>;
  generateStudyPlan(documentIds: string[]): Promise<AIRecommendation[]>;
}

// File upload validation types
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileType?: string;
  fileSize?: number;
}

export const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt'
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
