// Image Utilities for Student Portraits
// Handles image resizing, compression, and format conversion

const RECOMMENDED_SIZE = {
    width: 300,
    height: 400,
    maxWidth: 500,
    maxHeight: 600,
    quality: 0.8,
    format: 'image/jpeg'
};

/**
 * Resize and compress an image to recommended size
 * @param {string} dataUrl - Base64 image data URL
 * @param {object} options - Resize options
 * @returns {Promise<string>} Resized image as data URL
 */
export async function resizeImage(dataUrl, options = {}) {
    const {
        width = RECOMMENDED_SIZE.width,
        height = RECOMMENDED_SIZE.height,
        maxWidth = RECOMMENDED_SIZE.maxWidth,
        maxHeight = RECOMMENDED_SIZE.maxHeight,
        quality = RECOMMENDED_SIZE.quality,
        format = RECOMMENDED_SIZE.format
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate dimensions maintaining aspect ratio
            let targetWidth = width;
            let targetHeight = height;

            const aspectRatio = img.width / img.height;

            if (img.width > maxWidth || img.height > maxHeight) {
                if (aspectRatio > 1) {
                    targetWidth = Math.min(img.width, maxWidth);
                    targetHeight = targetWidth / aspectRatio;
                } else {
                    targetHeight = Math.min(img.height, maxHeight);
                    targetWidth = targetHeight * aspectRatio;
                }
            } else {
                targetWidth = img.width;
                targetHeight = img.height;
            }

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Draw and resize
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // Export with compression
            const resizedDataUrl = canvas.toDataURL(format, quality);
            resolve(resizedDataUrl);
        };

        img.onerror = (error) => {
            console.error('Image resize error:', error);
            reject(new Error('Failed to resize image'));
        };

        img.src = dataUrl;
    });
}

/**
 * Compress image without resizing
 * @param {string} dataUrl - Base64 image data URL
 * @param {number} quality - Compression quality (0-1)
 * @returns {Promise<string>} Compressed image as data URL
 */
export async function compressImage(dataUrl, quality = RECOMMENDED_SIZE.quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        };

        img.onerror = (error) => {
            console.error('Image compression error:', error);
            reject(new Error('Failed to compress image'));
        };

        img.src = dataUrl;
    });
}

/**
 * Get image dimensions from data URL
 * @param {string} dataUrl - Base64 image data URL
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => reject(new Error('Failed to get image dimensions'));
        img.src = dataUrl;
    });
}

/**
 * Validate if data URL is a valid image
 * @param {string} dataUrl - Base64 data URL to validate
 * @returns {boolean}
 */
export function isValidImageDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return false;
    return dataUrl.startsWith('data:image/') && dataUrl.includes('base64,');
}

/**
 * Get file size in KB from data URL
 * @param {string} dataUrl - Base64 data URL
 * @returns {number} Size in KB
 */
export function getDataUrlSize(dataUrl) {
    if (!dataUrl) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    const sizeInBytes = (base64.length * 3) / 4;
    return Math.round(sizeInBytes / 1024); // Convert to KB
}

/**
 * Convert file to data URL
 * @param {File} file - Image file
 * @returns {Promise<string>} Data URL
 */
export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

export default {
    resizeImage,
    compressImage,
    getImageDimensions,
    isValidImageDataUrl,
    getDataUrlSize,
    fileToDataUrl,
    RECOMMENDED_SIZE
};
