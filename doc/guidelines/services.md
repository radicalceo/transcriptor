# Guide Services et APIs Externes

> **Objectif**: Standardiser l'intégration des services externes (Claude, Whisper, etc.) pour garantir fiabilité, maintenabilité et performances.

---

## 🏗️ Architecture des Services

### Pattern Singleton

```typescript
// ✅ lib/services/meetingStore.ts
class MeetingStore {
  private meetings = new Map<string, Meeting>()

  create(id: string, type: MeetingType, title?: string): Meeting {
    const meeting: Meeting = {
      id,
      type,
      title,
      status: 'active',
      transcript: [],
      suggestions: {
        topics: [],
        decisions: [],
        actions: []
      },
      createdAt: new Date().toISOString()
    }

    this.meetings.set(id, meeting)
    return meeting
  }

  get(id: string): Meeting | undefined {
    return this.meetings.get(id)
  }

  // ... autres méthodes
}

// Export singleton
export const meetingStore = new MeetingStore()
```

**Avantages:**
- Instance unique partagée
- État persistant en mémoire
- Pas de création répétée

---

## 🤖 Service Claude (Anthropic)

### Configuration

```typescript
// lib/services/claudeService.ts
import Anthropic from '@anthropic-ai/sdk'

// ✅ Initialisation avec validation
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Configuration par défaut
const DEFAULT_CONFIG = {
  model: 'claude-3-5-sonnet-20241022
  temperature: 0.2,
  max_tokens: 1024
} as const
```

### Suggestions Live

```typescript
// ✅ Analyse de transcription avec retry
export async function analyzeLiveTranscript(
  transcript: string[],
  retries = 3
): Promise<Suggestions> {
  // Validation entrée
  if (transcript.length === 0) {
    return {
      topics: [],
      decisions: [],
      actions: []
    }
  }

  // Limiter contexte (derniers 15 segments)
  const recentTranscript = transcript.slice(-15)
  const transcriptText = recentTranscript.join('\n')

  // Prompt optimisé
  const prompt = `Tu reçois un extrait de transcription de réunion.
Analyse le contenu et renvoie les informations suivantes au format JSON :
{
  "topics": [...],
  "decisions": [...],
  "actions": [...]
}
Réponds uniquement en JSON valide.

Transcription:
${transcriptText}`

  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_CONFIG.model,
      temperature: DEFAULT_CONFIG.temperature,
      max_tokens: DEFAULT_CONFIG.max_tokens,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    // Parse réponse
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const suggestions: Suggestions = JSON.parse(content.text)

    // Validation structure
    if (!suggestions.topics || !suggestions.decisions || !suggestions.actions) {
      throw new Error('Invalid response structure')
    }

    return suggestions

  } catch (error) {
    if (retries > 0) {
      console.warn(`Claude API error, retrying... (${retries} left)`)
      await delay(1000)
      return analyzeLiveTranscript(transcript, retries - 1)
    }

    console.error('Error analyzing transcript:', error)
    throw new Error('Failed to analyze transcript')
  }
}

// Helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Résumé Final

```typescript
// ✅ Génération résumé complet
export async function generateFinalSummary(
  transcript: string[],
  validatedSuggestions?: Suggestions
): Promise<Summary> {
  const transcriptText = transcript.join('\n')

  // Prompt avec suggestions validées optionnelles
  let prompt = `Voici la transcription complète d'une réunion.

Génère un résumé structuré et synthétique.
Retourne un JSON suivant :
{
  "summary": "Résumé clair de la réunion",
  "topics": [{"title": "...", "summary": "..."}],
  "decisions": [{"text": "..."}],
  "actions": [{"text": "...", "assignee": "...", "due_date": "..."}],
  "open_questions": ["..."],
  "highlights": [{"quote": "...", "timestamp_sec": 0}],
  "risks": ["..."],
  "next_steps": ["..."]
}

Transcription:
${transcriptText}`

  if (validatedSuggestions) {
    prompt += `\n\nSuggestions pré-validées à utiliser:
${JSON.stringify(validatedSuggestions, null, 2)}`
  }

  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_CONFIG.model,
      temperature: 0.3,
      max_tokens: 8192,  // Plus de tokens pour résumé complet
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const summary: Summary = JSON.parse(content.text)
    return summary

  } catch (error) {
    console.error('Error generating summary:', error)
    throw new Error('Failed to generate summary')
  }
}
```

---

## 🎤 Service Whisper (OpenAI)

### Configuration

```typescript
// lib/services/whisperService.ts
import OpenAI from 'openai'
import fs from 'fs/promises'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const WHISPER_CONFIG = {
  model: 'whisper-1',
  language: 'fr',
  response_format: 'verbose_json' as const,
  timestamp_granularities: ['segment'] as const
}
```

### Transcription Simple

```typescript
// ✅ Transcription fichier audio
export async function transcribeAudio(
  audioPath: string,
  language = 'fr'
): Promise<TranscriptSegment[]> {
  try {
    // Vérifier que le fichier existe
    await fs.access(audioPath)

    // Créer stream
    const audioFile = await fs.readFile(audioPath)
    const file = new File([audioFile], 'audio.mp3', { type: 'audio/mpeg' })

    // Appel Whisper
    const response = await openai.audio.transcriptions.create({
      ...WHISPER_CONFIG,
      file,
      language
    })

    // Extraire segments avec timestamps
    if (!response.segments) {
      throw new Error('No segments in response')
    }

    return response.segments.map(segment => ({
      text: segment.text.trim(),
      timestamp: segment.start,
      speaker: segment.speaker || undefined
    }))

  } catch (error) {
    console.error('Error transcribing audio:', error)
    throw new Error('Failed to transcribe audio')
  }
}
```

### Transcription avec Chunking

```typescript
// ✅ Pour fichiers volumineux (>20MB)
import { chunkAudioFile } from '@/lib/utils/audioChunker'

export async function transcribeAudioLarge(
  audioPath: string,
  language = 'fr'
): Promise<TranscriptSegment[]> {
  try {
    // Vérifier taille
    const stats = await fs.stat(audioPath)
    const fileSizeMB = stats.size / (1024 * 1024)

    // Si < 20MB, transcription directe
    if (fileSizeMB < 20) {
      return transcribeAudio(audioPath, language)
    }

    // Sinon, chunking
    console.log(`Large file detected (${fileSizeMB.toFixed(2)}MB), chunking...`)

    const chunks = await chunkAudioFile(audioPath, {
      chunkDurationMinutes: 10
    })

    // Transcrire chaque chunk en parallèle (max 3 concurrents)
    const allSegments: TranscriptSegment[] = []
    const batchSize = 3

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const segments = await transcribeAudio(chunk.path, language)

          // Ajuster timestamps avec l'offset
          return segments.map(seg => ({
            ...seg,
            timestamp: seg.timestamp + chunk.startTime
          }))
        })
      )

      allSegments.push(...batchResults.flat())

      // Cleanup chunks
      await Promise.all(
        batch.map(chunk => fs.unlink(chunk.path).catch(() => { }))
      )
    }

    // Merger segments consécutifs incomplets
    return mergeIncompleteSegments(allSegments)

  } catch (error) {
    console.error('Error transcribing large audio:', error)
    throw new Error('Failed to transcribe audio')
  }
}
```

### Merge de Segments

```typescript
// ✅ Merger phrases incomplètes
function mergeIncompleteSegments(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  if (segments.length === 0) return []

  const merged: TranscriptSegment[] = []
  let current = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]

    // Conditions de merge:
    // 1. Phrase incomplète (pas de ponctuation forte)
    // 2. Segment suivant commence en minuscule (continuation)
    // 3. Temps entre segments < 4s
    const shouldMerge =
      !hasStrongPunctuation(current.text) &&
      (startsWithLowercase(next.text) || (next.timestamp - current.timestamp < 4))

    if (shouldMerge) {
      current = {
        text: `${current.text} ${next.text}`,
        timestamp: current.timestamp,  // Garder timestamp du premier
        speaker: current.speaker
      }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

function hasStrongPunctuation(text: string): boolean {
  return /[.!?]$/.test(text.trim())
}

function startsWithLowercase(text: string): boolean {
  return /^[a-z]/.test(text.trim())
}
```

---

## 🔄 Retry Logic

### Pattern de Retry Générique

```typescript
// ✅ Retry avec backoff exponentiel
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options

  let lastError: Error | unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        break
      }

      // Calculer délai avec backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      )

      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        error
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Utilisation
const result = await retryWithBackoff(
  () => anthropic.messages.create({ ... }),
  { maxRetries: 3, initialDelay: 1000 }
)
```

---

## ⚡ Rate Limiting

### Simple In-Memory Rate Limiter

```typescript
// ✅ Rate limiter pour API externes
class RateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async acquire(): Promise<void> {
    const now = Date.now()

    // Cleanup anciens timestamps
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    )

    if (this.requests.length >= this.maxRequests) {
      // Attendre que la fenêtre se libère
      const oldestRequest = this.requests[0]
      const waitTime = this.windowMs - (now - oldestRequest)

      console.log(`Rate limit reached, waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      return this.acquire()  // Réessayer
    }

    this.requests.push(now)
  }
}

// Utilisation
const claudeRateLimiter = new RateLimiter(50, 60000)  // 50 req/min

export async function analyzeLiveTranscriptWithRateLimit(
  transcript: string[]
): Promise<Suggestions> {
  await claudeRateLimiter.acquire()
  return analyzeLiveTranscript(transcript)
}
```

---

## 🔒 Gestion des Secrets

### Environment Variables

```typescript
// ✅ Validation au démarrage
// lib/config.ts
interface Config {
  anthropicApiKey: string
  openaiApiKey: string
  databaseUrl: string
}

function loadConfig(): Config {
  const required = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    databaseUrl: process.env.DATABASE_URL
  }

  // Valider présence
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  return required as Config
}

export const config = loadConfig()
```

---

## 📊 Monitoring et Logging

### Logging Structuré

```typescript
// ✅ Logger avec contexte
interface LogContext {
  service: string
  operation: string
  meetingId?: string
  duration?: number
  error?: unknown
}

function log(level: 'info' | 'warn' | 'error', message: string, context: LogContext) {
  const timestamp = new Date().toISOString()

  console[level](JSON.stringify({
    timestamp,
    level,
    message,
    ...context
  }))
}

// Utilisation
export async function analyzeLiveTranscript(
  transcript: string[]
): Promise<Suggestions> {
  const startTime = Date.now()

  try {
    const result = await anthropic.messages.create({ ... })

    log('info', 'Transcript analyzed successfully', {
      service: 'claude',
      operation: 'analyze_transcript',
      duration: Date.now() - startTime
    })

    return result

  } catch (error) {
    log('error', 'Failed to analyze transcript', {
      service: 'claude',
      operation: 'analyze_transcript',
      duration: Date.now() - startTime,
      error
    })

    throw error
  }
}
```

---

## ✅ Checklist Services

- [ ] Validation des API keys au démarrage
- [ ] Pattern singleton pour services stateful
- [ ] Retry logic avec backoff exponentiel
- [ ] Rate limiting pour APIs externes
- [ ] Timeout sur requêtes longues
- [ ] Logging structuré avec contexte
- [ ] Gestion d'erreurs exhaustive
- [ ] Type safety complet
- [ ] Cleanup des ressources temporaires

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```typescript
// ❌ Pas de validation API key
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY  // Peut être undefined
})

// ❌ Pas de retry
const result = await apiCall()  // Fail immédiatement

// ❌ Création répétée de clients
function analyze() {
  const client = new Anthropic({ ... })  // Nouveau client à chaque appel
  return client.messages.create({ ... })
}

// ❌ Pas de timeout
const result = await fetch(url)  // Peut pendre indéfiniment

// ❌ Secrets en dur
const apiKey = 'sk-ant-...'  // NON !
```

### ✅ FAIRE

```typescript
// ✅ Validation au démarrage
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY required')
}

// ✅ Retry avec backoff
const result = await retryWithBackoff(() => apiCall())

// ✅ Singleton
const anthropic = new Anthropic({ apiKey })  // Créé une fois

export function analyze() {
  return anthropic.messages.create({ ... })  // Réutilise l'instance
}

// ✅ Timeout
const controller = new AbortController()
setTimeout(() => controller.abort(), 10000)

const result = await fetch(url, { signal: controller.signal })

// ✅ Secrets en env vars
const apiKey = process.env.ANTHROPIC_API_KEY
```

---

## 🔗 Références

- [Anthropic API Docs](https://docs.anthropic.com/)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [Retry Patterns](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
