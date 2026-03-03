// API Service for backend integration
// This will be used to replace the mock AI service when backend is ready

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface UploadResponse {
  documentId: string;
  uploadUrl?: string;
  status: 'uploaded' | 'processing' | 'completed';
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // In production, this would come from environment variables
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  }

  // Document upload endpoint
  async uploadDocument(file: File): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/documents/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type, let browser set it with boundary
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        data: {} as UploadResponse,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  // Get document status
  async getDocumentStatus(documentId: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/${documentId}/status`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      };
    }
  }

  // AI analysis endpoint
  async analyzeDocument(documentId: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  // Query document endpoint
  async queryDocument(documentId: string, question: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/${documentId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }

  // Get user's documents
  async getUserDocuments(): Promise<ApiResponse<unknown[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/documents`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get documents: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        data: [],
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get documents'
      };
    }
  }

  // Delete document
  async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      return {
        data: undefined,
        success: true
      };
    } catch (error) {
      return {
        data: undefined,
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  private getAuthToken(): string {
    // In a real app, this would get the token from localStorage, cookies, or context
    return localStorage.getItem('authToken') || '';
  }
}

export const apiService = new ApiService();
