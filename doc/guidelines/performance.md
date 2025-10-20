# Guide Performance et Optimisation

> **Objectif**: Garantir des performances optimales de l'application en suivant les meilleures pratiques et en évitant les pièges courants.

---

## 🎯 Principes de Performance

### 1. Mesurer Avant d'Optimiser
- Identifier les bottlenecks réels
- Utiliser des outils de profiling
- Prioriser les optimisations à fort impact

### 2. Optimiser le Chemin Critique
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Largest Contentful Paint (LCP)

### 3. Progressive Enhancement
- Charger le minimum nécessaire
- Lazy loading des ressources
- Code splitting intelligent

---

## 💾 Caching Strategies

### In-Memory Cache (meetingStore)

```typescript
// ✅ Cache en mémoire pour meetings actifs
class MeetingStore {
  private cache = new Map<string, Meeting>()

  get(id: string): Meeting | undefined {
    // 1. Check cache
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }

    // 2. Fallback to DB
    const meeting = await this.loadFromDb(id)

    if (meeting) {
      this.cache.set(id, meeting)
    }

    return meeting
  }

  private async loadFromDb(id: string): Promise<Meeting | null> {
    return await prisma.meeting.findUnique({
      where: { id }
    })
  }

  // Eviction policy (LRU)
  private evictOldEntries() {
    const MAX_SIZE = 100

    if (this.cache.size > MAX_SIZE) {
      // Supprimer les plus anciennes
      const entriesToDelete = this.cache.size - MAX_SIZE
      const keys = Array.from(this.cache.keys())

      for (let i = 0; i < entriesToDelete; i++) {
        this.cache.delete(keys[i])
      }
    }
  }
}
```

### HTTP Caching

```typescript
// ✅ Cache headers pour ressources statiques
export async function GET(request: NextRequest) {
  const data = await fetchData()

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=3600',
      'ETag': generateETag(data)
    }
  })
}

// ✅ Cache busting pour assets
// next.config.ts
export default {
  images: {
    minimumCacheTTL: 60
  },
  // Hash automatique des assets
  generateBuildId: async () => {
    return crypto.randomUUID()
  }
}
```

---

## 🗄️ Database Optimization

### Query Optimization

```typescript
// ❌ SELECT * - charge tout
const meetings = await prisma.meeting.findMany()

// ✅ SELECT spécifique - charge uniquement nécessaire
const meetings = await prisma.meeting.findMany({
  select: {
    id: true,
    title: true,
    status: true,
    createdAt: true
    // Ne pas charger transcript, summary (gros champs)
  }
})

// ✅ Pagination pour grandes listes
const meetings = await prisma.meeting.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' }
})
```

### Indexes

```prisma
// ✅ Indexes sur colonnes filtrées/triées
model Meeting {
  id        String   @id
  status    String
  createdAt DateTime

  // Indexes pour requêtes fréquentes
  @@index([status])             // WHERE status = 'active'
  @@index([createdAt])          // ORDER BY createdAt DESC
  @@index([status, createdAt])  // Composite pour les deux
}
```

### Batch Operations

```typescript
// ❌ N+1 queries
for (const id of meetingIds) {
  const meeting = await prisma.meeting.findUnique({
    where: { id }
  })
  process(meeting)
}

// ✅ Single batch query
const meetings = await prisma.meeting.findMany({
  where: {
    id: { in: meetingIds }
  }
})

meetings.forEach(process)
```

---

## ⚛️ React Performance

### React.memo

```tsx
// ✅ Éviter re-renders inutiles
import { memo } from 'react'

interface SuggestionItemProps {
  text: string
  onDelete: () => void
}

const SuggestionItem = memo(function SuggestionItem({
  text,
  onDelete
}: SuggestionItemProps) {
  return (
    <div>
      <span>{text}</span>
      <button onClick={onDelete}>Delete</button>
    </div>
  )
})

export default SuggestionItem
```

### useMemo & useCallback

```tsx
// ✅ Memoize expensive computations
function MeetingList({ meetings }: { meetings: Meeting[] }) {
  // Calcul coûteux memoized
  const sortedMeetings = useMemo(() => {
    return meetings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter(m => m.status === 'active')
  }, [meetings])

  // Callback stable
  const handleDelete = useCallback((id: string) => {
    deleteMeeting(id)
  }, [])

  return (
    <div>
      {sortedMeetings.map(meeting => (
        <MeetingItem
          key={meeting.id}
          meeting={meeting}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
```

### Lazy Loading

```tsx
// ✅ Load composants lourds à la demande
import { lazy, Suspense } from 'react'

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'))
const AudioPlayer = lazy(() => import('@/components/AudioPlayer'))

export default function SummaryPage() {
  return (
    <div>
      <h1>Summary</h1>

      <Suspense fallback={<LoadingSpinner />}>
        <RichTextEditor />
      </Suspense>

      <Suspense fallback={<div>Loading audio...</div>}>
        <AudioPlayer src="/audio.mp3" />
      </Suspense>
    </div>
  )
}
```

### Virtual Scrolling

```tsx
// ✅ Pour listes très longues (1000+ items)
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

function TranscriptList({ segments }: { segments: TranscriptSegment[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,  // Hauteur estimée par item
    overscan: 5  // Nombre d'items à pré-render
  })

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {segments[virtualItem.index].text}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 📦 Bundle Optimization

### Code Splitting

```typescript
// ✅ Route-based code splitting (automatique avec Next.js)
// app/meeting/[id]/page.tsx
// app/upload/page.tsx
// app/history/page.tsx
// → Chaque page = bundle séparé

// ✅ Dynamic imports
const analyzeWithClaude = async (text: string) => {
  const { analyzeLiveTranscript } = await import('@/lib/services/claudeService')
  return analyzeLiveTranscript([text])
}
```

### Tree Shaking

```typescript
// ✅ Named imports (tree-shakeable)
import { format } from 'date-fns'

// ❌ Default import (importe tout)
import dateFns from 'date-fns'

// ✅ Import spécifique
import formatDistance from 'date-fns/formatDistance'
```

### Bundle Analysis

```bash
# Analyser la taille du bundle
npm run build
npx @next/bundle-analyzer
```

```typescript
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true'
})

export default withBundleAnalyzer({
  // ... config
})
```

---

## 🖼️ Image Optimization

### Next.js Image Component

```tsx
// ✅ Utiliser next/image
import Image from 'next/image'

export default function MeetingThumbnail({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt="Meeting thumbnail"
      width={300}
      height={200}
      placeholder="blur"
      blurDataURL="/placeholder.jpg"
      loading="lazy"
    />
  )
}
```

### Image Formats

```typescript
// next.config.ts
export default {
  images: {
    formats: ['image/avif', 'image/webp'],  // Formats modernes
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96]
  }
}
```

---

## 🌐 Network Optimization

### Request Batching

```typescript
// ✅ Batch multiple requests
async function loadMeetingData(meetingId: string) {
  // Parallel requests
  const [meeting, suggestions, summary] = await Promise.all([
    fetch(`/api/meeting/${meetingId}`),
    fetch(`/api/suggestions?meetingId=${meetingId}`),
    fetch(`/api/summary/${meetingId}`)
  ])

  return {
    meeting: await meeting.json(),
    suggestions: await suggestions.json(),
    summary: await summary.json()
  }
}
```

### Request Deduplication

```typescript
// ✅ Dedup requêtes identiques
const pendingRequests = new Map<string, Promise<any>>()

async function fetchWithDedup(url: string) {
  // Check si requête en cours
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)
  }

  // Créer nouvelle requête
  const promise = fetch(url).then(r => r.json()).finally(() => {
    pendingRequests.delete(url)
  })

  pendingRequests.set(url, promise)

  return promise
}
```

### Polling Optimization

```typescript
// ✅ Polling intelligent avec backoff
function useSuggestions(meetingId: string) {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const intervalRef = useRef<number>(5000)  // Start at 5s

  useEffect(() => {
    let mounted = true
    let lastUpdateTime = Date.now()

    const poll = async () => {
      const response = await fetch(`/api/suggestions?meetingId=${meetingId}`)
      const data = await response.json()

      if (!mounted) return

      // Si pas de nouvelles suggestions, augmenter intervalle
      if (JSON.stringify(data) === JSON.stringify(suggestions)) {
        intervalRef.current = Math.min(intervalRef.current * 1.5, 30000)  // Max 30s
      } else {
        intervalRef.current = 5000  // Reset à 5s
        lastUpdateTime = Date.now()
      }

      setSuggestions(data)

      // Stop polling si pas d'updates depuis 5min
      if (Date.now() - lastUpdateTime > 5 * 60 * 1000) {
        return
      }

      setTimeout(poll, intervalRef.current)
    }

    poll()

    return () => {
      mounted = false
    }
  }, [meetingId])

  return suggestions
}
```

---

## 🔊 Audio Optimization

### Chunked Upload

```typescript
// ✅ Upload par chunks pour éviter timeout
async function uploadAudioInChunks(
  audioBlob: Blob,
  chunkSize = 5 * 1024 * 1024  // 5MB
) {
  const chunks = []
  let offset = 0

  while (offset < audioBlob.size) {
    const chunk = audioBlob.slice(offset, offset + chunkSize)
    chunks.push(chunk)
    offset += chunkSize
  }

  // Upload séquentiel
  for (let i = 0; i < chunks.length; i++) {
    const formData = new FormData()
    formData.append('chunk', chunks[i])
    formData.append('index', i.toString())
    formData.append('total', chunks.length.toString())

    await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData
    })
  }
}
```

### Audio Compression

```typescript
// ✅ Convertir en format compressé
import ffmpeg from 'fluent-ffmpeg'

async function compressAudio(inputPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate('64k')     // Réduire bitrate
      .audioChannels(1)         // Mono
      .audioFrequency(22050)    // Réduire sample rate
      .toFormat('mp3')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath)
  })
}
```

---

## 📊 Monitoring

### Performance Metrics

```typescript
// ✅ Mesurer performance
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await fn()

    const duration = performance.now() - startTime

    logger.info('Performance metric', {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      success: true
    })

    // Alert si > 1s
    if (duration > 1000) {
      logger.warn('Slow operation detected', {
        operation,
        duration: `${duration.toFixed(2)}ms`
      })
    }

    return result

  } catch (error) {
    const duration = performance.now() - startTime

    logger.error('Performance metric', error, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      success: false
    })

    throw error
  }
}

// Utilisation
const suggestions = await measurePerformance(
  'analyze_transcript',
  () => analyzeLiveTranscript(transcript)
)
```

### Web Vitals

```tsx
// app/layout.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric)

    // Send to analytics
    if (metric.name === 'FCP' && metric.value > 3000) {
      console.warn('Slow FCP:', metric.value)
    }
  })

  return null
}
```

---

## ✅ Checklist Performance

### Frontend
- [ ] React.memo sur composants purs
- [ ] useMemo pour calculs coûteux
- [ ] useCallback pour callbacks stables
- [ ] Lazy loading des composants lourds
- [ ] Virtual scrolling pour listes longues
- [ ] Next.js Image pour images
- [ ] Code splitting par route

### Backend
- [ ] In-memory cache pour données hot
- [ ] DB indexes sur colonnes filtrées
- [ ] SELECT spécifique (pas de *)
- [ ] Batch queries (éviter N+1)
- [ ] Pagination pour grandes listes
- [ ] Compression des réponses API
- [ ] Rate limiting

### Network
- [ ] HTTP caching headers
- [ ] Request batching/dedup
- [ ] Polling intelligent
- [ ] Compression gzip/brotli
- [ ] CDN pour assets statiques

### Assets
- [ ] Images optimisées (WebP, AVIF)
- [ ] Audio compressé
- [ ] Bundle size < 200KB (first load)
- [ ] Tree shaking activé
- [ ] Minification CSS/JS

---

## 🚫 Anti-Patterns Performance

### ❌ NE PAS FAIRE

```typescript
// ❌ Re-render à chaque keystroke
function SearchInput() {
  const [query, setQuery] = useState('')
  const results = searchMeetings(query)  // Coûteux !

  return <input onChange={(e) => setQuery(e.target.value)} />
}

// ❌ N+1 queries
for (const id of ids) {
  await prisma.meeting.findUnique({ where: { id } })
}

// ❌ Charger tout en mémoire
const allMeetings = await prisma.meeting.findMany()

// ❌ Polling constant sans condition
setInterval(() => fetch('/api/data'), 1000)

// ❌ Import complet de librairie
import _ from 'lodash'
```

### ✅ FAIRE

```typescript
// ✅ Debounce
const debouncedSearch = useMemo(
  () => debounce((q: string) => searchMeetings(q), 300),
  []
)

function SearchInput() {
  const [query, setQuery] = useState('')

  useEffect(() => {
    debouncedSearch(query)
  }, [query])

  return <input onChange={(e) => setQuery(e.target.value)} />
}

// ✅ Batch query
const meetings = await prisma.meeting.findMany({
  where: { id: { in: ids } }
})

// ✅ Pagination
const meetings = await prisma.meeting.findMany({
  take: 20,
  skip: (page - 1) * 20
})

// ✅ Polling intelligent
useEffect(() => {
  const poll = async () => {
    const data = await fetch('/api/data')
    if (shouldContinue(data)) {
      setTimeout(poll, 5000)
    }
  }
  poll()
}, [])

// ✅ Import spécifique
import debounce from 'lodash/debounce'
```

---

## 🔗 Références

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Web Vitals](https://web.dev/vitals/)
- [Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization)
