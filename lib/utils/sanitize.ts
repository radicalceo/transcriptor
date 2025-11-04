import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes potentially dangerous elements and attributes while preserving safe HTML formatting
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe to render with dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return ''

  // Configure DOMPurify to allow common formatting tags
  const config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'span', 'div',
      'blockquote', 'pre', 'code'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'class', 'id'
    ],
    // Only allow http, https, and mailto protocols for links
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  }

  return DOMPurify.sanitize(html, config)
}

/**
 * Sanitize HTML and create props for dangerouslySetInnerHTML
 *
 * @param html - The HTML string to sanitize
 * @returns Object with __html property safe to use with dangerouslySetInnerHTML
 */
export function createSafeHTML(html: string | undefined | null): { __html: string } {
  return { __html: sanitizeHtml(html) }
}
