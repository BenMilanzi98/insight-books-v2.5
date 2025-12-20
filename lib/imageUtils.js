/**
 * Normalizes logo/image URLs to use API route for serving uploads
 * This ensures images work correctly in production where nginx may not serve /uploads directly
 * 
 * @param {string} url - The image URL from the database
 * @returns {string} - Normalized URL that works in both dev and production
 */
export function normalizeImageUrl(url) {
  if (!url) return '';
  
  // If it's already a full URL (external), use it as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Remove leading slash if present
  let normalized = url.replace(/^\/+/, '');
  
  // If it starts with 'uploads/', convert to API route
  if (normalized.startsWith('uploads/')) {
    // Remove 'uploads/' prefix and use API route
    const pathWithoutUploads = normalized.replace(/^uploads\//, '');
    return `/api/uploads/${pathWithoutUploads}`;
  }
  
  // If it doesn't start with uploads but looks like a path, try as-is with API route
  // This handles cases where the URL might be stored without 'uploads/' prefix
  if (normalized.includes('/')) {
    return `/api/uploads/${normalized}`;
  }
  
  // Fallback: return as-is if it doesn't match any pattern
  return url.startsWith('/') ? url : `/${normalized}`;
}

