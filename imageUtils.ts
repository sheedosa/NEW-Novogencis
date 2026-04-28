/**
 * Image Pipeline Utilities for Novogenics Platform
 * Handles client-side compression, validation, and sanitization
 * before uploading to Firebase Storage.
 */

// Maximum file size allowed (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum dimension for compressed output (1080px)
const MAX_DIMENSION = 1080;

// JPEG compression quality (0-1)
const COMPRESSION_QUALITY = 0.8;

// Allowed MIME types (excludes HEIC which browsers can't render)
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Validates file size and type before processing.
 * @returns null if valid, error string if invalid.
 */
export function validateImageFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is 10MB.`;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return `Unsupported file type (${file.type || 'unknown'}). Please use JPEG, PNG, or WebP images.`;
  }

  return null;
}

/**
 * Sanitizes the filename by removing special characters.
 * Returns a clean, URL-safe filename.
 */
export function sanitizeFileName(originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
  const timestamp = Date.now();
  const uniqueId = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${uniqueId}.${safeExt}`;
}

/**
 * Compresses an image file using HTML5 Canvas.
 * Resizes to max 1080px on the longest side and compresses to ~80% JPEG quality.
 * Returns a compressed Blob ready for upload.
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions, preserving aspect ratio
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas compression failed'));
          }
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Full processing pipeline: validate → compress → return ready-to-upload Blob.
 */
export async function processImageForUpload(file: File): Promise<{ blob: Blob; fileName: string }> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const compressed = await compressImage(file);
  const fileName = sanitizeFileName(file.name);

  return { blob: compressed, fileName };
}
