# Guide Gestion d'Erreurs et Logging

> **Objectif**: Standardiser la gestion des erreurs et le logging pour faciliter le debugging et améliorer l'expérience utilisateur.

---

## 🎯 Principes Fondamentaux

### 1. Fail Fast, Fail Loud
- Détecter les erreurs tôt
- Logger avec contexte
- Ne jamais masquer les erreurs

### 2. User-Friendly Messages
- Messages techniques → logs
- Messages clairs → utilisateur
- Pas de stack traces en production

### 3. Graceful Degradation
- Continuer si possible
- Fallback values
- Recovery automatique

---

## 🔧 Patterns de Gestion d'Erreurs

### Try-Catch Standard

```typescript
// ✅ API Route avec error handling
export async function GET(request: NextRequest) {
  try {
    // 1. Validation
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      )
    }

    // 2. Business logic
    const meeting = await meetingStore.get(id)

    // 3. Not found check
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // 4. Success
    return NextResponse.json(meeting, { status: 200 })

  } catch (error) {
    // 5. Error handling
    console.error('Error fetching meeting:', {
      error,
      url: request.url,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Try-Catch dans Services

```typescript
// ✅ Service avec error handling
export async function analyzeLiveTranscript(
  transcript: string[]
): Promise<Suggestions> {
  try {
    // Validation entrée
    if (!transcript || transcript.length === 0) {
      throw new ValidationError('Transcript is empty')
    }

    // API call
    const response = await anthropic.messages.create({ ... })

    // Validation sortie
    const suggestions = JSON.parse(response.content[0].text)
    validateSuggestions(suggestions)

    return suggestions

  } catch (error) {
    // Log avec contexte
    console.error('Failed to analyze transcript:', {
      error,
      transcriptLength: transcript.length,
      service: 'claude'
    })

    // Re-throw avec message clair
    if (error instanceof ValidationError) {
      throw error
    }

    throw new Error('Failed to analyze transcript')
  }
}
```

### Client Component Error Handling

```tsx
// ✅ Component avec states d'erreur
'use client'
import { useState, useEffect } from 'react'

export default function MeetingView({ id }: { id: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchMeeting = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/meeting/${id}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch meeting')
        }

        const data = await response.json()

        if (mounted) {
          setMeeting(data)
        }

      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'An error occurred')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchMeeting()

    return () => {
      mounted = false
    }
  }, [id])

  // Render states
  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (!meeting) return <div>Meeting not found</div>

  return <div>{meeting.title}</div>
}
```

---

## 🚨 Custom Error Classes

### Définir des Erreurs Typées

```typescript
// lib/errors.ts

// ✅ Base error class
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// ✅ Validation errors
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context)
  }
}

// ✅ Not found errors
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      `${resource} not found`,
      'NOT_FOUND',
      404,
      { resource, id }
    )
  }
}

// ✅ External API errors
export class ExternalApiError extends AppError {
  constructor(
    service: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(
      `${service} API error: ${message}`,
      'EXTERNAL_API_ERROR',
      503,
      { service, ...context }
    )
  }
}

// ✅ Rate limit errors
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      'Too many requests',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    )
  }
}
```

### Utilisation

```typescript
// ✅ Throw custom errors
export async function getMeeting(id: string): Promise<Meeting> {
  // Validation
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Invalid meeting ID', { id })
  }

  const meeting = await prisma.meeting.findUnique({ where: { id } })

  if (!meeting) {
    throw new NotFoundError('Meeting', id)
  }

  return meeting
}

// ✅ Handle custom errors
try {
  const meeting = await getMeeting(id)
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.context },
      { status: error.statusCode }
    )
  }

  throw error
}
```

---

## 📝 Logging

### Structured Logging

```typescript
// lib/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

// ✅ Structured logger
export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog('debug', message, context))
    }
  },

  info(message: string, context?: LogContext) {
    console.info(formatLog('info', message, context))
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatLog('warn', message, context))
  },

  error(message: string, error?: unknown, context?: LogContext) {
    console.error(formatLog('error', message, {
      ...context,
      error: serializeError(error)
    }))
  }
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  }

  return JSON.stringify(log)
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof AppError && {
        code: error.code,
        statusCode: error.statusCode,
        context: error.context
      })
    }
  }

  return error
}
```

### Utilisation du Logger

```typescript
// ✅ Dans services
import { logger } from '@/lib/logger'

export async function analyzeLiveTranscript(
  transcript: string[]
): Promise<Suggestions> {
  logger.info('Analyzing transcript', {
    service: 'claude',
    transcriptLength: transcript.length
  })

  try {
    const startTime = Date.now()
    const result = await anthropic.messages.create({ ... })

    logger.info('Transcript analyzed successfully', {
      service: 'claude',
      duration: Date.now() - startTime
    })

    return result

  } catch (error) {
    logger.error('Failed to analyze transcript', error, {
      service: 'claude',
      transcriptLength: transcript.length
    })

    throw new ExternalApiError('Claude', 'Failed to analyze transcript')
  }
}
```

---

## 🔄 Error Recovery

### Retry avec Backoff

```typescript
// ✅ Retry automatique
export async function retryableOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    backoffFactor?: number
    onRetry?: (attempt: number, error: unknown) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffFactor = 2,
    onRetry
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) break

      const delay = initialDelay * Math.pow(backoffFactor, attempt)

      logger.warn('Operation failed, retrying', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: serializeError(error)
      })

      onRetry?.(attempt + 1, error)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Utilisation
const suggestions = await retryableOperation(
  () => analyzeLiveTranscript(transcript),
  {
    maxRetries: 3,
    onRetry: (attempt) => {
      console.log(`Retry attempt ${attempt}`)
    }
  }
)
```

### Fallback Values

```typescript
// ✅ Fallback si échec
export async function getSuggestionsWithFallback(
  meetingId: string
): Promise<Suggestions> {
  try {
    const meeting = await meetingStore.get(meetingId)

    if (!meeting) {
      throw new NotFoundError('Meeting', meetingId)
    }

    return meeting.suggestions

  } catch (error) {
    logger.error('Failed to get suggestions, using fallback', error, {
      meetingId
    })

    // Fallback vide
    return {
      topics: [],
      decisions: [],
      actions: []
    }
  }
}
```

---

## 🎨 UI Error Components

### Error Message Component

```tsx
// components/ErrorMessage.tsx
'use client'

interface ErrorMessageProps {
  message: string
  title?: string
  onRetry?: () => void
  className?: string
}

export default function ErrorMessage({
  message,
  title = 'An error occurred',
  onRetry,
  className = ''
}: ErrorMessageProps) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="text-red-500">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-red-800 font-semibold mb-1">{title}</h3>
          <p className="text-red-700 text-sm">{message}</p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Loading Spinner Component

```tsx
// components/LoadingSpinner.tsx
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`} />
    </div>
  )
}
```

---

## 🧪 Error Boundaries (React)

### Global Error Boundary

```tsx
// app/error.tsx
'use client'

import { useEffect } from 'react'
import ErrorMessage from '@/components/ErrorMessage'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ErrorMessage
        title="Something went wrong"
        message={error.message}
        onRetry={reset}
      />
    </div>
  )
}
```

---

## ✅ Checklist Error Handling

- [ ] Try-catch sur toutes les async operations
- [ ] Validation des entrées (API routes, services)
- [ ] Custom error classes avec codes
- [ ] Logging structuré avec contexte
- [ ] Messages user-friendly (pas de stack traces)
- [ ] Retry logic pour APIs externes
- [ ] Fallback values où approprié
- [ ] Error boundaries React
- [ ] States loading/error dans composants
- [ ] Cleanup en cas d'erreur (streams, files, etc.)

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```typescript
// ❌ Swallow errors
try {
  await operation()
} catch {}  // Silent fail

// ❌ Generic error messages
catch (error) {
  throw new Error('Error')  // Pas de contexte
}

// ❌ Exposer stack traces
catch (error) {
  return NextResponse.json({ error: error.stack }, { status: 500 })
}

// ❌ Pas de logging
catch (error) {
  throw error  // Pas de log
}

// ❌ Pas de cleanup
const stream = await getStream()
throw new Error('Fail')  // Stream pas fermé
```

### ✅ FAIRE

```typescript
// ✅ Log et re-throw
try {
  await operation()
} catch (error) {
  logger.error('Operation failed', error, { context })
  throw new AppError('Operation failed', 'OPERATION_ERROR')
}

// ✅ Messages clairs
catch (error) {
  throw new Error(`Failed to process meeting ${id}: ${error.message}`)
}

// ✅ Messages safe pour utilisateur
catch (error) {
  logger.error('Internal error', error)
  return NextResponse.json(
    { error: 'An error occurred. Please try again.' },
    { status: 500 }
  )
}

// ✅ Log avec contexte
catch (error) {
  logger.error('Operation failed', error, {
    meetingId,
    operation: 'analyze_transcript'
  })
  throw error
}

// ✅ Cleanup
try {
  const stream = await getStream()
  // Use stream
} catch (error) {
  // Handle error
} finally {
  await stream?.close()  // Cleanup
}
```

---

## 🔗 Références

- [Error Handling Best Practices](https://nodejs.org/en/docs/guides/error-handling/)
- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [TypeScript Error Handling](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
