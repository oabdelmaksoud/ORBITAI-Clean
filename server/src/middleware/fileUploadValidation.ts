/**
 * File Upload Validation Middleware
 * Validates file types, sizes, and content
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
  'text/csv',
  
  // Code files
  'text/javascript',
  'text/typescript',
  'application/json',
  'text/x-python',
  'text/x-java',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'text/x-php',
  'text/x-ruby',
  'text/x-go',
  'text/x-rust',
  'text/x-swift',
  'text/x-kotlin',
  
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
  
  // Other
  'application/xml',
  'text/xml',
  'text/html',
  'text/css',
  'text/markdown',
];

// Allowed file extensions (as backup validation)
const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
  
  // Code
  '.js', '.jsx', '.ts', '.tsx', '.json', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
  
  // Archives
  '.zip', '.rar', '.tar', '.gz',
  
  // Other
  '.xml', '.html', '.css', '.md',
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Validate file upload
 */
export function validateFileUpload(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file].filter(Boolean);

  for (const file of files) {
    if (!file) continue;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        `File "${file.originalname}" exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        400
      );
    }

    // Check MIME type
    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.slice(0, 5).join(', ')}...`,
        400
      );
    }

    // Check file extension as backup
    if (file.originalname) {
      const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw new AppError(
          `File extension "${extension}" is not allowed`,
          400
        );
      }
    }

    // Additional security: Check for potentially dangerous file names
    const dangerousPatterns = [
      /\.\./,           // Path traversal
      /[<>:"|?*]/,      // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    ];

    if (file.originalname) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(file.originalname)) {
          throw new AppError(
            `File name "${file.originalname}" contains invalid characters`,
            400
          );
        }
      }
    }
  }

  next();
}

/**
 * Get allowed MIME types (for API documentation)
 */
export function getAllowedMimeTypes(): string[] {
  return [...ALLOWED_MIME_TYPES];
}

/**
 * Get maximum file size
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}













