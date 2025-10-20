# Guide Architecture et Structure

> **Objectif**: Maintenir une organisation claire et cohérente du code pour faciliter la navigation, l'évolution et la maintenance.

---

## 📁 Structure de Dossiers

### Vue d'ensemble
```
transcriptor/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Page d'accueil
│   ├── layout.tsx         # Layout racine
│   ├── globals.css        # Styles globaux
│   ├── meeting/           # Pages meeting
│   │   └── [id]/          # Meeting dynamique
│   ├── upload/            # Upload de fichiers
│   ├── history/           # Historique meetings
│   ├── summary/           # Pages de résumé
│   │   └── [id]/
│   │       ├── page.tsx           # Résumé simple
│   │       └── detailed/page.tsx  # Résumé détaillé
│   └── api/               # API Routes
│       ├── meeting/
│       ├── suggestions/
│       ├── summary/
│       └── upload/
├── components/            # Composants React réutilisables
│   ├── SuggestionsPanel.tsx
│   └── RichTextEditor.tsx
├── lib/                   # Code serveur / utilitaires
│   ├── types/            # Types TypeScript partagés
│   │   ├── index.ts
│   │   └── meeting.ts
│   ├── services/         # Services métier
│   │   ├── claudeService.ts
│   │   ├── whisperService.ts
│   │   ├── meetingStore.ts
│   │   ├── deduplication.ts
│   │   └── transcriptGrouping.ts
│   ├── utils/            # Utilitaires génériques
│   │   ├── audioChunker.ts
│   │   └── summaryFormatter.ts
│   └── prisma.ts         # Client Prisma (singleton)
├── prisma/               # Base de données
│   ├── schema.prisma     # Schéma DB
│   └── migrations/       # Migrations SQL
├── data/                 # Données runtime
│   └── uploads/          # Fichiers audio uploadés
├── doc/                  # Documentation
│   ├── TECHNICAL_GUIDELINES.md
│   └── guidelines/       # Guides détaillés
└── public/               # Assets statiques
```

---

## 🎯 Règles de Placement

### Composants React (`/components`)

**✅ Placer ici:**
- Composants **réutilisables** entre plusieurs pages
- Composants **sans logique métier** complexe
- Composants **UI purs** (présentation)

**❌ Ne PAS placer:**
- Composants spécifiques à une seule page (→ colocalisés avec la page)
- Logique de fetching de données (→ API routes ou services)
- Logique métier (→ services)

**Exemple:**
```tsx
// ✅ components/SuggestionsPanel.tsx
'use client'
import { Suggestions } from '@/lib/types/meeting'

interface SuggestionsPanelProps {
  suggestions: Suggestions
  onUpdate?: (suggestions: Suggestions) => void
}

export default function SuggestionsPanel({
  suggestions,
  onUpdate
}: SuggestionsPanelProps) {
  // Uniquement logique d'affichage et interactions UI
}
```

### Pages (`/app`)

**✅ Structure:**
```
app/
├── page.tsx                    # Route: /
├── layout.tsx                  # Layout parent
├── meeting/
│   └── [id]/
│       ├── page.tsx           # Route: /meeting/:id
│       └── ClientComponent.tsx # Si logique client complexe
└── api/
    └── meeting/
        └── [id]/
            └── route.ts       # API: /api/meeting/:id
```

**Règles:**
- Un fichier `page.tsx` = une route
- Les composants spécifiques à une page peuvent être colocalisés dans le même dossier
- Préfixer les composants clients avec `'use client'`

### Services (`/lib/services`)

**✅ Placer ici:**
- Logique métier réutilisable
- Intégrations API externes (Claude, Whisper)
- State management (meetingStore)
- Algorithmes complexes (deduplication)

**❌ Ne PAS placer:**
- UI ou composants React
- Routes API (→ `/app/api`)
- Types (→ `/lib/types`)

**Pattern Singleton pour Services:**
```typescript
// ✅ lib/services/meetingStore.ts
class MeetingStore {
  private meetings = new Map<string, Meeting>()

  get(id: string): Meeting | undefined {
    return this.meetings.get(id)
  }

  // ... autres méthodes
}

// Export singleton
export const meetingStore = new MeetingStore()
```

### Types (`/lib/types`)

**✅ Structure:**
```
lib/types/
├── index.ts           # Exports publics
└── meeting.ts         # Types métier (Meeting, Suggestions, etc.)
```

**Règles:**
- Un fichier par domaine métier
- Interfaces partagées entre client et serveur
- Pas de logique, uniquement des définitions

### Utilitaires (`/lib/utils`)

**✅ Placer ici:**
- Fonctions pures sans état
- Helpers de formatting
- Helpers de validation
- Transformations de données

**Exemple:**
```typescript
// ✅ lib/utils/summaryFormatter.ts
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
```

---

## 🔄 Conventions de Nommage

### Fichiers

| Type | Convention | Exemple |
|------|-----------|---------|
| **React Component** | PascalCase | `SuggestionsPanel.tsx` |
| **Page Next.js** | lowercase | `page.tsx`, `layout.tsx` |
| **API Route** | lowercase | `route.ts` |
| **Service** | camelCase + Service | `claudeService.ts` |
| **Utility** | camelCase | `audioChunker.ts` |
| **Type file** | camelCase | `meeting.ts` |

### Fonctions et Variables

```typescript
// ✅ Conventions correctes

// Fonctions: camelCase
function analyzeLiveTranscript(text: string) { }

// Constantes: UPPER_SNAKE_CASE
const MAX_AUDIO_SIZE = 200 * 1024 * 1024

// Variables: camelCase
const meetingId = crypto.randomUUID()

// Interfaces/Types: PascalCase
interface Meeting { }
type SuggestionType = 'topic' | 'decision'

// Composants: PascalCase
function SuggestionsPanel() { }

// Classes: PascalCase
class MeetingStore { }
```

### Dossiers

```typescript
// ✅ Dossiers lowercase avec tirets si nécessaire
app/meeting/[id]/
app/api/meeting/start/
lib/services/
components/suggestions-panel/  // Si sous-composants
```

---

## 🌐 Séparation Client / Serveur

### Next.js App Router

#### Server Components (par défaut)
```tsx
// app/meeting/[id]/page.tsx
// ✅ Server Component (pas de 'use client')

import { prisma } from '@/lib/prisma'

export default async function MeetingPage({
  params
}: {
  params: { id: string }
}) {
  // ✅ Accès direct à la DB
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id }
  })

  return <div>{meeting?.title}</div>
}
```

#### Client Components
```tsx
// app/meeting/[id]/LiveRecording.tsx
'use client'  // ✅ Directive obligatoire

import { useState, useEffect } from 'react'

export default function LiveRecording({ meetingId }: { meetingId: string }) {
  // ✅ Hooks React, event handlers, Web APIs
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    // ✅ Browser APIs (MediaRecorder, etc.)
  }, [])

  return <button onClick={() => setIsRecording(true)}>Record</button>
}
```

#### Quand utiliser Client Components?
- **Hooks React** (useState, useEffect, useRef, etc.)
- **Event handlers** (onClick, onChange, etc.)
- **Browser APIs** (MediaRecorder, Web Audio, localStorage, etc.)
- **Animations et interactions** complexes

#### Quand utiliser Server Components?
- **Data fetching** direct depuis la DB
- **Opérations serveur** (filesystem, env vars)
- **Pas d'interactivité** requise
- **SEO** important

---

## 📦 Imports et Exports

### Alias de Path

**Configuration** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**✅ Utilisation:**
```typescript
// ✅ Avec alias
import { Meeting } from '@/lib/types/meeting'
import { meetingStore } from '@/lib/services/meetingStore'

// ❌ Sans alias (éviter)
import { Meeting } from '../../../lib/types/meeting'
```

### Pattern d'Export

**Services (Named Export):**
```typescript
// ✅ lib/services/meetingStore.ts
export const meetingStore = new MeetingStore()

// ✅ Importation
import { meetingStore } from '@/lib/services/meetingStore'
```

**Composants (Default Export):**
```typescript
// ✅ components/SuggestionsPanel.tsx
export default function SuggestionsPanel() { }

// ✅ Importation
import SuggestionsPanel from '@/components/SuggestionsPanel'
```

**Types (Named Export):**
```typescript
// ✅ lib/types/meeting.ts
export interface Meeting { }
export interface Suggestions { }

// ✅ Importation
import type { Meeting, Suggestions } from '@/lib/types/meeting'
```

### Barrel Exports (Index Files)

```typescript
// ✅ lib/types/index.ts
export * from './meeting'
export * from './suggestion'

// ✅ Importation simplifiée
import type { Meeting, Suggestion } from '@/lib/types'
```

---

## 🚀 Patterns Architecturaux

### 1. Layered Architecture

```
┌─────────────────────────────────┐
│      Presentation Layer         │  Components, Pages
│         (React UI)              │
└─────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────┐
│       API Layer                 │  API Routes
│    (Request Handling)           │
└─────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────┐
│      Business Logic Layer       │  Services
│   (Claude, Whisper, Store)      │
└─────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────┐
│      Data Access Layer          │  Prisma, DB
│       (Persistence)             │
└─────────────────────────────────┘
```

**Règles:**
- ❌ Jamais de DB direct dans les composants
- ❌ Jamais de logique métier dans les API routes
- ✅ Chaque couche communique uniquement avec la couche adjacente

### 2. Dependency Injection

```typescript
// ✅ Service avec dépendances injectées
export async function analyzeLiveTranscript(
  transcript: string[],
  anthropic: Anthropic  // Injecté, testable
): Promise<Suggestions> {
  // ...
}

// ❌ Service avec dépendance en dur
export async function analyzeLiveTranscript(
  transcript: string[]
): Promise<Suggestions> {
  const anthropic = new Anthropic()  // Difficile à tester
}
```

### 3. Repository Pattern (Prisma)

```typescript
// ✅ lib/services/meetingRepository.ts
export class MeetingRepository {
  async findById(id: string): Promise<Meeting | null> {
    return prisma.meeting.findUnique({ where: { id } })
  }

  async create(data: CreateMeetingInput): Promise<Meeting> {
    return prisma.meeting.create({ data })
  }
}

export const meetingRepository = new MeetingRepository()
```

**Avantages:**
- Abstraction de la DB
- Facilite les tests
- Centralise les requêtes

---

## 📝 Exemples Complets

### Nouvelle Feature: Ajout d'un Label aux Meetings

#### 1. **Type** (`lib/types/meeting.ts`)
```typescript
export interface Meeting {
  // ... existing fields
  label?: string  // ✅ Nouveau champ
}
```

#### 2. **Migration DB** (`prisma/schema.prisma`)
```prisma
model Meeting {
  // ... existing fields
  label String?  // ✅ Nouveau champ
}
```

```bash
npx prisma migrate dev --name add_meeting_label
```

#### 3. **Service** (`lib/services/meetingStore.ts`)
```typescript
export class MeetingStore {
  setLabel(id: string, label: string): void {
    const meeting = this.meetings.get(id)
    if (!meeting) throw new Error('Meeting not found')

    meeting.label = label
    this.meetings.set(id, meeting)

    // Sync to DB
    prisma.meeting.update({
      where: { id },
      data: { label }
    })
  }
}
```

#### 4. **API Route** (`app/api/meeting/[id]/label/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { meetingStore } from '@/lib/services/meetingStore'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { label } = await request.json()

    if (typeof label !== 'string') {
      return NextResponse.json(
        { error: 'Invalid label' },
        { status: 400 }
      )
    }

    meetingStore.setLabel(params.id, label)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting label:', error)
    return NextResponse.json(
      { error: 'Failed to set label' },
      { status: 500 }
    )
  }
}
```

#### 5. **Component** (`components/LabelInput.tsx`)
```tsx
'use client'

import { useState } from 'react'

interface LabelInputProps {
  meetingId: string
  initialLabel?: string
}

export default function LabelInput({
  meetingId,
  initialLabel = ''
}: LabelInputProps) {
  const [label, setLabel] = useState(initialLabel)

  const handleSave = async () => {
    await fetch(`/api/meeting/${meetingId}/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    })
  }

  return (
    <div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button onClick={handleSave}>Save</button>
    </div>
  )
}
```

#### 6. **Intégration** (`app/meeting/[id]/page.tsx`)
```tsx
import LabelInput from '@/components/LabelInput'

export default function MeetingPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* ... */}
      <LabelInput meetingId={params.id} />
    </div>
  )
}
```

---

## ✅ Checklist Architecture

Avant de coder une nouvelle feature:

- [ ] Définir les types TypeScript nécessaires dans `/lib/types`
- [ ] Créer/modifier le schéma Prisma si nécessaire
- [ ] Implémenter la logique métier dans `/lib/services`
- [ ] Créer les API routes dans `/app/api`
- [ ] Créer les composants UI dans `/components` ou `/app`
- [ ] Gérer les erreurs à chaque niveau
- [ ] Vérifier la cohérence avec les patterns existants
- [ ] Tester l'intégration complète

---

## 🔗 Références

- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
