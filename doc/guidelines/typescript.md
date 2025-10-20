# Guide TypeScript et Types

> **Objectif**: Assurer un typage strict et cohérent dans toute l'application pour éviter les bugs et améliorer la maintenabilité.

---

## 🎯 Configuration TypeScript

### tsconfig.json

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,              // ✅ Mode strict activé
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      { "name": "next" }
    ],
    "paths": {
      "@/*": ["./*"]             // ✅ Alias de path
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 📝 Définition des Types

### Structure Recommandée

```
lib/types/
├── index.ts           # Exports publics
├── meeting.ts         # Types Meeting
├── suggestion.ts      # Types Suggestion
└── api.ts            # Types API
```

### Types vs Interfaces

```typescript
// ✅ Interface pour objets extensibles
interface Meeting {
  id: string
  title?: string
  status: 'active' | 'processing' | 'completed'
}

// Extension d'interface
interface DetailedMeeting extends Meeting {
  duration?: number
  summary?: Summary
}

// ✅ Type pour unions, primitives, computed
type MeetingStatus = 'active' | 'processing' | 'completed'
type MeetingType = 'live' | 'upload'

type ApiResponse<T> = {
  data: T
  error?: string
}

// ✅ Type pour mapped types
type Partial<T> = {
  [P in keyof T]?: T[P]
}
```

### Types Partagés (meeting.ts)

```typescript
// lib/types/meeting.ts

// Enums ou string literals
export type MeetingStatus = 'active' | 'processing' | 'completed'
export type MeetingType = 'live' | 'upload'
export type Priority = 'low' | 'medium' | 'high'

// Interfaces principales
export interface Meeting {
  id: string
  title?: string
  status: MeetingStatus
  type: MeetingType
  audioPath?: string
  transcript: string[]
  transcriptSegments?: TranscriptSegment[]
  duration?: number
  suggestions: Suggestions
  summary?: Summary
  createdAt: string
  updatedAt?: string
}

export interface TranscriptSegment {
  text: string
  timestamp: number
  speaker?: string
}

export interface Suggestions {
  topics: string[]
  decisions: Decision[]
  actions: Action[]
}

export interface Decision {
  text: string
  confidence?: number
}

export interface Action {
  text: string
  assignee?: string
  due_date?: string
  priority?: Priority
  confidence?: number
}

export interface Summary {
  summary: string
  topics: TopicDetail[]
  decisions: Decision[]
  actions: Action[]
  open_questions?: string[]
  highlights?: Highlight[]
  risks?: string[]
  next_steps?: string[]
  detailed?: DetailedSummary
  editedDocument?: string
}

export interface TopicDetail {
  title: string
  summary?: string
}

export interface Highlight {
  quote: string
  timestamp_sec?: number
}

export interface DetailedSummary {
  summary_detailed: string
  topics_detailed: Array<{
    title: string
    detailed_summary: string
  }>
  decisions_detailed: string
  actions_detailed: string
  open_questions_detailed: string
}
```

### Types API

```typescript
// lib/types/api.ts

// Request types
export interface CreateMeetingRequest {
  title?: string
  type: MeetingType
}

export interface UpdateMeetingRequest {
  title?: string
  transcript?: string[]
}

export interface GenerateSummaryRequest {
  meetingId: string
  useValidatedSuggestions?: boolean
}

// Response types
export interface ApiSuccessResponse<T> {
  data: T
  success: true
}

export interface ApiErrorResponse {
  error: string
  details?: unknown
  success: false
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// Type guards
export function isApiError(response: ApiResponse<unknown>): response is ApiErrorResponse {
  return response.success === false
}
```

---

## 🔧 Typage des Fonctions

### Fonctions Basiques

```typescript
// ✅ Typage explicite des paramètres et retour
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// ✅ Paramètres optionnels
function createMeeting(
  type: MeetingType,
  title?: string
): Meeting {
  return {
    id: crypto.randomUUID(),
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
}

// ✅ Paramètres avec valeurs par défaut
function fetchMeetings(
  limit: number = 10,
  offset: number = 0
): Promise<Meeting[]> {
  return prisma.meeting.findMany({
    take: limit,
    skip: offset
  })
}
```

### Fonctions Async

```typescript
// ✅ Async avec Promise typée
async function analyzeLiveTranscript(
  transcript: string[]
): Promise<Suggestions> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: transcript.join('\n') }]
  })

  return JSON.parse(response.content[0].text)
}

// ✅ Error handling typé
async function fetchMeeting(id: string): Promise<Meeting | null> {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id }
    })
    return meeting
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Prisma error:', error.code)
    }
    throw error
  }
}
```

### Generics

```typescript
// ✅ Fonction générique
function findById<T extends { id: string }>(
  items: T[],
  id: string
): T | undefined {
  return items.find(item => item.id === id)
}

// Utilisation
const meeting = findById(meetings, 'abc123')  // Type: Meeting | undefined
const action = findById(actions, 'xyz789')    // Type: Action | undefined

// ✅ Generic avec contrainte
function updateItem<T extends { id: string }>(
  items: T[],
  id: string,
  updates: Partial<T>
): T[] {
  return items.map(item =>
    item.id === id ? { ...item, ...updates } : item
  )
}

// ✅ Generic API response
async function fetchApi<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url)
  return response.json()
}

const result = await fetchApi<Meeting>('/api/meeting/123')
if (isApiError(result)) {
  console.error(result.error)
} else {
  console.log(result.data.title)  // Type: Meeting
}
```

---

## 🎨 Typage des Composants

### Props Typing

```typescript
// ✅ Interface pour props
interface SuggestionsPanelProps {
  suggestions: Suggestions
  meetingId: string
  onUpdate?: (suggestions: Suggestions) => void
  className?: string
}

export default function SuggestionsPanel({
  suggestions,
  meetingId,
  onUpdate,
  className = ''
}: SuggestionsPanelProps) {
  // ...
}

// ✅ Props avec children
interface LayoutProps {
  children: React.ReactNode
  title?: string
}

// ✅ Props avec render props
interface DataListProps<T> {
  data: T[]
  renderItem: (item: T) => React.ReactNode
}
```

### Event Handlers

```typescript
// ✅ Typage des événements
function InputField() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    console.log('clicked')
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button onClick={handleClick}>Submit</button>
    </form>
  )
}
```

### Refs

```typescript
// ✅ Typage des refs
function AudioRecorder() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    audioRef.current?.play()
  }, [])
}
```

---

## 🔍 Type Guards

### Built-in Type Guards

```typescript
// ✅ typeof
function processValue(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase()  // Type: string
  }
  return value.toFixed(2)  // Type: number
}

// ✅ instanceof
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(error.message)  // Type: Error
  }
}

// ✅ in operator
function processMeeting(meeting: Meeting | DetailedMeeting) {
  if ('summary' in meeting && meeting.summary) {
    console.log(meeting.summary)  // Type: DetailedMeeting
  }
}
```

### Custom Type Guards

```typescript
// ✅ Type predicate
function isMeeting(obj: unknown): obj is Meeting {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'status' in obj &&
    'transcript' in obj
  )
}

// Utilisation
const data: unknown = await response.json()
if (isMeeting(data)) {
  console.log(data.title)  // Type: Meeting
}

// ✅ Array type guard
function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every(item => typeof item === 'string')
}

// ✅ Validation Zod comme type guard
import { z } from 'zod'

const MeetingSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: z.enum(['active', 'processing', 'completed'])
})

function validateMeeting(data: unknown): Meeting {
  return MeetingSchema.parse(data)  // Throws si invalide
}
```

---

## 📦 Validation Runtime

### Avec Zod

```typescript
import { z } from 'zod'

// ✅ Définir schéma
const CreateMeetingSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  type: z.enum(['live', 'upload']),
  audioPath: z.string().optional()
})

// Inférer type depuis schéma
type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>

// Utilisation
async function createMeeting(data: unknown): Promise<Meeting> {
  // Validation + typage
  const validated = CreateMeetingSchema.parse(data)

  return prisma.meeting.create({
    data: {
      ...validated,
      transcript: [],
      suggestions: JSON.stringify({
        topics: [],
        decisions: [],
        actions: []
      })
    }
  })
}

// ✅ SafeParse (ne throw pas)
const result = CreateMeetingSchema.safeParse(data)
if (result.success) {
  console.log(result.data)  // Type: CreateMeetingInput
} else {
  console.error(result.error.errors)
}
```

---

## 🔄 Utility Types

### Built-in Utilities

```typescript
// ✅ Partial - tous les champs optionnels
type PartialMeeting = Partial<Meeting>
// { id?: string; title?: string; ... }

// ✅ Required - tous les champs requis
type RequiredMeeting = Required<Meeting>
// { id: string; title: string; ... }

// ✅ Pick - sélectionner certains champs
type MeetingPreview = Pick<Meeting, 'id' | 'title' | 'status'>
// { id: string; title?: string; status: MeetingStatus }

// ✅ Omit - exclure certains champs
type MeetingWithoutSummary = Omit<Meeting, 'summary'>

// ✅ Record - type objet avec clés/valeurs
type MeetingById = Record<string, Meeting>
// { [key: string]: Meeting }

// ✅ Exclude - exclure des unions
type ActiveStatus = Exclude<MeetingStatus, 'completed'>
// 'active' | 'processing'

// ✅ Extract - extraire des unions
type InProgressStatus = Extract<MeetingStatus, 'active' | 'processing'>
```

### Custom Utilities

```typescript
// ✅ Deep Partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

type PartialSummary = DeepPartial<Summary>

// ✅ Require specific fields
type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

type MeetingWithTitle = RequireFields<Meeting, 'title'>
// title est maintenant requis

// ✅ Nullable fields
type Nullable<T> = {
  [P in keyof T]: T[P] | null
}
```

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```typescript
// ❌ any sans justification
const data: any = await fetch('/api/data')

// ❌ Type assertion sans vérification
const meeting = data as Meeting  // Dangereux !

// ❌ Ignorer les erreurs TypeScript
// @ts-ignore
const result = someFunction()

// ❌ Types trop larges
function process(data: object) { }  // Inutile

// ❌ Non-null assertion sans garantie
const meeting = meetings.find(m => m.id === id)!
console.log(meeting.title)  // Peut crash

// ❌ Duplication de types
interface ApiMeeting {
  id: string
  title: string
}
interface DbMeeting {
  id: string
  title: string
}
```

### ✅ FAIRE

```typescript
// ✅ Typage strict
const data: Meeting = await fetch('/api/data').then(r => r.json())

// ✅ Type guard avant assertion
if (isMeeting(data)) {
  const meeting: Meeting = data
}

// ✅ Justifier les exceptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = oldApi.getData()  // API externe non typée

// ✅ Types précis
function process(meeting: Meeting) { }

// ✅ Vérification avant utilisation
const meeting = meetings.find(m => m.id === id)
if (meeting) {
  console.log(meeting.title)
}

// ✅ Réutiliser les types
import type { Meeting } from '@/lib/types/meeting'

interface ApiResponse {
  meeting: Meeting
}
```

---

## 🔗 Import/Export de Types

### Best Practices

```typescript
// ✅ Import de types avec 'type'
import type { Meeting, Suggestions } from '@/lib/types/meeting'
import { meetingStore } from '@/lib/services/meetingStore'

// ✅ Export named
export interface Meeting { }
export type MeetingStatus = 'active' | 'processing' | 'completed'

// ✅ Export depuis index
// lib/types/index.ts
export * from './meeting'
export * from './suggestion'

// Import simplifié
import type { Meeting, Suggestion } from '@/lib/types'
```

---

## ✅ Checklist TypeScript

- [ ] Mode strict activé dans tsconfig.json
- [ ] Aucun `any` sans justification
- [ ] Interfaces définies dans `/lib/types`
- [ ] Validation runtime pour données externes (Zod)
- [ ] Type guards pour narrowing
- [ ] Props de composants typées
- [ ] Event handlers typés
- [ ] Refs typées
- [ ] Fonctions async avec Promise<T>
- [ ] Utiliser utility types (Partial, Pick, etc.)

---

## 🔗 Références

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Zod Documentation](https://zod.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
