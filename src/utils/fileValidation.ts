import { FileValidationResult, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from '../types/ai';

export function validateFile(file: File): FileValidationResult {
  // Check file type
  if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
    return {
      isValid: false,
      error: `Unsupported file type. Please upload: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return {
    isValid: true,
    fileType: file.type,
    fileSize: file.size
  };
}

export function getFileIcon(fileType: string): string {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
  return '📎';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
