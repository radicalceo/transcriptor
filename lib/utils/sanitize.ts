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

/**
 * Sanitize and parse JSON from Claude responses
 * Handles common issues like trailing commas, unescaped quotes, etc.
 */
export function sanitizeAndParseJSON(text: string): any {
  try {
    // Extract JSON from text (handle markdown code blocks)
    let jsonText = text.trim()

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const lines = jsonText.split('\n')
      lines.shift() // Remove opening ```json or ```
      if (lines[lines.length - 1].trim() === '```') {
        lines.pop() // Remove closing ```
      }
      jsonText = lines.join('\n')
    }

    // Try to extract JSON object - use greedy matching to get complete object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON object found in response')
    }

    let jsonStr = jsonMatch[0]

    // Common fixes for malformed JSON from LLMs
    // 1. Remove trailing commas before closing braces/brackets
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')

    // 2. Fix common escaping issues in multi-line strings
    // Replace literal newlines in strings with escaped versions
    jsonStr = jsonStr.replace(/: ?"([^"\\]*(?:\\.[^"\\]*)*)"(?=\s*[,}\]])/g, (match, content) => {
      // Only process if there are unescaped problematic characters
      if (content.includes('\n') || content.includes('\r') || content.includes('\t')) {
        const escaped = content
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .replace(/\r/g, '')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ') // Collapse multiple spaces
          .trim()
        return `: "${escaped}"`
      }
      return match
    })

    // Try to parse
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('JSON parsing error:', error)
    console.error('Problematic text (first 1000 chars):', text.substring(0, 1000))
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Safely extract and clean JSON from LLM response with fallback strategies
 */
export function robustJSONParse(text: string): any {
  // Strategy 1: Try direct sanitization
  try {
    return sanitizeAndParseJSON(text)
  } catch (firstError) {
    console.warn('First parsing attempt failed, trying fallback strategies...')

    // Strategy 2: Try to find and fix the error by truncating
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        let jsonStr = jsonMatch[0]

        // More aggressive JSON fixes
        // 1. Remove trailing commas
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')

        // 2. Fix incomplete strings at the end (common when output is truncated)
        // Find the last complete property
        jsonStr = jsonStr.replace(/"[^"]*$/g, '') // Remove incomplete strings at the end

        // 3. Try progressively smaller chunks if parsing still fails
        for (let i = jsonStr.length; i > jsonStr.length * 0.5; i -= 100) {
          try {
            const truncated = jsonStr.substring(0, i)
            // Find last complete closing brace
            let depth = 0
            let arrayDepth = 0
            let lastValidPos = -1
            let inString = false
            let escapeNext = false

            for (let j = 0; j < truncated.length; j++) {
              const char = truncated[j]

              if (escapeNext) {
                escapeNext = false
                continue
              }

              if (char === '\\') {
                escapeNext = true
                continue
              }

              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }

              if (!inString) {
                if (char === '{') depth++
                if (char === '}') {
                  depth--
                  if (depth === 0 && arrayDepth === 0) lastValidPos = j
                }
                if (char === '[') arrayDepth++
                if (char === ']') arrayDepth--
              }
            }

            if (lastValidPos > 0) {
              let validJSON = truncated.substring(0, lastValidPos + 1)

              // Final cleanup: remove trailing commas and incomplete properties
              validJSON = validJSON.replace(/,(\s*[}\]])/g, '$1')
              validJSON = validJSON.replace(/,\s*$/, '')

              return JSON.parse(validJSON)
            }
          } catch (e) {
            // Continue to next iteration
            continue
          }
        }
      }
    } catch (secondError) {
      console.error('All parsing strategies failed:', secondError)
    }

    throw new Error('Unable to extract valid JSON from response')
  }
}
