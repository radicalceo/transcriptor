# Guide React Components

> **Objectif**: Standardiser la création de composants React pour garantir maintenabilité, réutilisabilité et performances optimales.

---

## 🎯 Client vs Server Components

### Server Components (par défaut)

**Quand utiliser:**
- ✅ Fetching de données depuis la DB
- ✅ Accès aux variables d'environnement serveur
- ✅ Pas d'interactivité requise
- ✅ Optimisation SEO importante

**Exemple:**
```tsx
// app/meeting/[id]/page.tsx
// ✅ Server Component (pas de 'use client')

import { prisma } from '@/lib/prisma'
import type { Meeting } from '@/lib/types/meeting'

export default async function MeetingPage({
  params
}: {
  params: { id: string }
}) {
  // ✅ Fetch direct depuis la DB
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id }
  })

  if (!meeting) {
    return <div>Meeting not found</div>
  }

  return (
    <div>
      <h1>{meeting.title}</h1>
      <p>Status: {meeting.status}</p>
    </div>
  )
}
```

### Client Components

**Quand utiliser:**
- ✅ useState, useEffect, useRef, etc.
- ✅ Event handlers (onClick, onChange, etc.)
- ✅ Browser APIs (MediaRecorder, Web Audio, etc.)
- ✅ Context providers
- ✅ Animations et interactions

**Exemple:**
```tsx
// components/AudioRecorder.tsx
'use client'  // ✅ Directive obligatoire

import { useState, useRef, useEffect } from 'react'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void
}

export default function AudioRecorder({
  onRecordingComplete
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const startRecording = async () => {
    // ✅ Browser API
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)

    recorder.ondataavailable = (e) => {
      onRecordingComplete(e.data)
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>
    </div>
  )
}
```

---

## 📝 Structure de Composant

### Template Standard

```tsx
'use client'  // Si client component

import { useState, useEffect, useMemo } from 'react'
import type { Meeting } from '@/lib/types/meeting'

// 1. Types/Interfaces
interface MyComponentProps {
  meetingId: string
  initialData?: Meeting
  onUpdate?: (data: Meeting) => void
  className?: string
}

// 2. Component
export default function MyComponent({
  meetingId,
  initialData,
  onUpdate,
  className = ''
}: MyComponentProps) {
  // 3. State
  const [data, setData] = useState<Meeting | null>(initialData || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 4. Refs
  const mountedRef = useRef(true)

  // 5. Effects
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchData()
    }
  }, [meetingId, initialData])

  // 6. Computed values (memoized)
  const formattedData = useMemo(() => {
    if (!data) return null
    return formatMeeting(data)
  }, [data])

  // 7. Event handlers
  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/meeting/${meetingId}`)
      const result = await response.json()

      if (mountedRef.current) {
        setData(result)
        onUpdate?.(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleClick = () => {
    // Handle interaction
  }

  // 8. Render
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!data) return null

  return (
    <div className={`my-component ${className}`}>
      <h2>{data.title}</h2>
      <button onClick={handleClick}>Action</button>
    </div>
  )
}

// 9. Helper functions (outside component)
function formatMeeting(meeting: Meeting): string {
  return `${meeting.title} - ${meeting.status}`
}
```

---

## 🔧 Hooks Patterns

### useState

```tsx
// ✅ Typage explicite
const [count, setCount] = useState<number>(0)
const [meeting, setMeeting] = useState<Meeting | null>(null)
const [data, setData] = useState<Meeting[]>([])

// ✅ Mise à jour immutable
setMeeting({
  ...meeting,
  title: 'New title'
})

setData(prev => [...prev, newItem])

// ❌ Mutation directe
meeting.title = 'New'  // NON
setMeeting(meeting)
```

### useEffect

```tsx
// ✅ Effect avec cleanup
useEffect(() => {
  const interval = setInterval(() => {
    fetchSuggestions()
  }, 5000)

  // Cleanup
  return () => {
    clearInterval(interval)
  }
}, [meetingId])

// ✅ Effect conditionnel
useEffect(() => {
  if (!isRecording) return

  startRecordingProcess()
}, [isRecording])

// ✅ Effect avec dépendances correctes
useEffect(() => {
  const handler = () => console.log(count)
  window.addEventListener('click', handler)

  return () => {
    window.removeEventListener('click', handler)
  }
}, [count])  // ✅ count dans les dépendances

// ❌ Dépendances manquantes
useEffect(() => {
  console.log(count)
}, [])  // ❌ count devrait être en dépendance
```

### useRef

```tsx
// ✅ DOM reference
const inputRef = useRef<HTMLInputElement>(null)

const focusInput = () => {
  inputRef.current?.focus()
}

<input ref={inputRef} />

// ✅ Mutable value (ne déclenche pas de re-render)
const mountedRef = useRef(true)
const audioChunksRef = useRef<Blob[]>([])

useEffect(() => {
  return () => {
    mountedRef.current = false
  }
}, [])

// ✅ Previous value
const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}
```

### useMemo

```tsx
// ✅ Calcul coûteux
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.timestamp - b.timestamp)
}, [data])

// ✅ Object/array reference stability
const config = useMemo(() => ({
  threshold: 0.7,
  maxItems: 10
}), [])

// ❌ Sur-utilisation (calcul simple)
const doubled = useMemo(() => count * 2, [count])  // Inutile
```

### useCallback

```tsx
// ✅ Fonction passée en prop
const handleUpdate = useCallback((id: string, data: Partial<Meeting>) => {
  updateMeeting(id, data)
}, [])

<ChildComponent onUpdate={handleUpdate} />

// ✅ Fonction avec dépendances
const handleSave = useCallback(() => {
  saveMeeting(meetingId, data)
}, [meetingId, data])

// ❌ Sur-utilisation
const handleClick = useCallback(() => {
  console.log('clicked')
}, [])  // Inutile si pas passé en prop
```

### Custom Hooks

```tsx
// ✅ Hook réutilisable
export function useMeeting(meetingId: string) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchMeeting = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (mounted) {
          setMeeting(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error')
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
  }, [meetingId])

  return { meeting, loading, error }
}

// Utilisation
function MeetingView({ meetingId }: { meetingId: string }) {
  const { meeting, loading, error } = useMeeting(meetingId)

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

  return <div>{meeting?.title}</div>
}
```

---

## 🎨 Styling avec Tailwind

### Conventions

```tsx
// ✅ Classes Tailwind
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-md">
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click me
  </button>
</div>

// ✅ Classes conditionnelles
<button
  className={`
    px-4 py-2 rounded
    ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}
  `}
>
  Button
</button>

// ✅ Avec classnames/clsx
import clsx from 'clsx'

<button
  className={clsx(
    'px-4 py-2 rounded',
    {
      'bg-blue-500 text-white': isActive,
      'bg-gray-200 text-gray-700': !isActive,
      'opacity-50 cursor-not-allowed': disabled
    }
  )}
>
  Button
</button>

// ✅ Props className
interface ButtonProps {
  className?: string
}

function Button({ className = '' }: ButtonProps) {
  return (
    <button className={`px-4 py-2 bg-blue-500 ${className}`}>
      Click
    </button>
  )
}

<Button className="mt-4" />
```

### Dark Mode

```tsx
// ✅ Classes dark mode
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
    Title
  </h1>
</div>
```

---

## 📊 State Management

### Local State (useState)

```tsx
// ✅ Pour state local au composant
function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  )
}
```

### Lifting State Up

```tsx
// ✅ Partager state entre enfants via parent
function MeetingPage() {
  const [suggestions, setSuggestions] = useState<Suggestions>({
    topics: [],
    decisions: [],
    actions: []
  })

  return (
    <div>
      <SuggestionsPanel
        suggestions={suggestions}
        onUpdate={setSuggestions}
      />
      <SuggestionsExport suggestions={suggestions} />
    </div>
  )
}
```

### Context API (pour state global)

```tsx
// ✅ Context pour state partagé entre plusieurs composants
import { createContext, useContext, useState } from 'react'

interface MeetingContextType {
  meetingId: string | null
  setMeetingId: (id: string) => void
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined)

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [meetingId, setMeetingId] = useState<string | null>(null)

  return (
    <MeetingContext.Provider value={{ meetingId, setMeetingId }}>
      {children}
    </MeetingContext.Provider>
  )
}

export function useMeetingContext() {
  const context = useContext(MeetingContext)
  if (!context) {
    throw new Error('useMeetingContext must be used within MeetingProvider')
  }
  return context
}

// Utilisation
function App() {
  return (
    <MeetingProvider>
      <MeetingView />
    </MeetingProvider>
  )
}

function MeetingView() {
  const { meetingId } = useMeetingContext()
  return <div>{meetingId}</div>
}
```

---

## 🚀 Performance Optimization

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
    <div className="flex items-center justify-between">
      <span>{text}</span>
      <button onClick={onDelete}>Delete</button>
    </div>
  )
})

export default SuggestionItem
```

### Lazy Loading

```tsx
// ✅ Load composants lourds à la demande
import { lazy, Suspense } from 'react'

const RichTextEditor = lazy(() => import('@/components/RichTextEditor'))

function SummaryPage() {
  return (
    <div>
      <h1>Summary</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <RichTextEditor />
      </Suspense>
    </div>
  )
}
```

### Virtual Scrolling

```tsx
// ✅ Pour listes longues
import { useVirtualizer } from '@tanstack/react-virtual'

function TranscriptList({ segments }: { segments: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50
  })

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`
            }}
          >
            {segments[item.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## ✅ Checklist Composant

Avant de créer un composant:

- [ ] Déterminer si Client ou Server Component
- [ ] Définir l'interface des props avec TypeScript
- [ ] Identifier le state local nécessaire
- [ ] Planifier les effects et cleanup
- [ ] Gérer les états de chargement et erreur
- [ ] Optimiser avec memo/useMemo si nécessaire
- [ ] Ajouter className prop pour personnalisation
- [ ] Documenter les props complexes
- [ ] Tester les cas limites

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```tsx
// ❌ Fetch dans un Client Component
'use client'
export default function Page() {
  const [data, setData] = useState()
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData)
  }, [])
  // → Utiliser Server Component ou API route
}

// ❌ Logique métier dans composant
function MeetingList() {
  const meetings = await prisma.meeting.findMany()  // NON
  // → Faire dans Server Component ou service
}

// ❌ Mutation directe du state
const handleAdd = () => {
  data.push(newItem)  // NON
  setData(data)
}

// ❌ Pas de cleanup
useEffect(() => {
  const interval = setInterval(fetchData, 5000)
  // Pas de return cleanup → memory leak
}, [])

// ❌ Dépendances incorrectes
useEffect(() => {
  console.log(count)
}, [])  // count devrait être en dépendance
```

### ✅ FAIRE

```tsx
// ✅ Server Component pour fetch
export default async function Page() {
  const data = await fetchData()
  return <ClientComponent data={data} />
}

// ✅ Logique dans service
function MeetingList({ meetings }: { meetings: Meeting[] }) {
  return <div>{meetings.map(m => <MeetingItem key={m.id} {...m} />)}</div>
}

// ✅ Immutabilité
const handleAdd = () => {
  setData([...data, newItem])
}

// ✅ Cleanup
useEffect(() => {
  const interval = setInterval(fetchData, 5000)
  return () => clearInterval(interval)
}, [])

// ✅ Dépendances correctes
useEffect(() => {
  console.log(count)
}, [count])
```

---

## 🔗 Références

- [React 19 Documentation](https://react.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript React Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
