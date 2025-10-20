# Guide API Routes

> **Objectif**: Standardiser la création et la maintenance des API routes Next.js pour garantir cohérence, sécurité et maintenabilité.

---

## 📁 Structure des API Routes

### Convention Next.js App Router

```
app/api/
├── meeting/
│   ├── start/
│   │   └── route.ts           # POST /api/meeting/start
│   ├── [id]/
│   │   ├── route.ts           # GET/POST /api/meeting/:id
│   │   ├── download/
│   │   │   └── route.ts       # GET /api/meeting/:id/download
│   │   └── retranscribe/
│   │       └── route.ts       # POST /api/meeting/:id/retranscribe
│   └── save-audio/
│       └── route.ts           # POST /api/meeting/save-audio
├── suggestions/
│   └── route.ts               # POST /api/suggestions
├── summary/
│   ├── route.ts               # POST /api/summary
│   └── [id]/
│       ├── route.ts           # GET /api/summary/:id
│       └── document/
│           └── route.ts       # POST /api/summary/:id/document
├── upload/
│   └── route.ts               # POST /api/upload
└── meetings/
    └── route.ts               # GET /api/meetings
```

**Règles:**
- Un fichier `route.ts` par endpoint
- Méthodes HTTP en named exports: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Paramètres dynamiques dans `[param]` folders

---

## 🔧 Template de Base

### Pattern Standard

```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { Meeting } from '@/lib/types/meeting'

// GET /api/meeting/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Validation des paramètres
    const { id } = params
    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      )
    }

    // 2. Logique métier (via service)
    const meeting = await meetingService.findById(id)

    // 3. Vérification existence
    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // 4. Retour succès
    return NextResponse.json(meeting, { status: 200 })

  } catch (error) {
    // 5. Gestion erreur globale
    console.error('Error fetching meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/meeting/:id
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Parse request body
    const body = await request.json()

    // 2. Validation
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Invalid title' },
        { status: 400 }
      )
    }

    // 3. Business logic
    const updated = await meetingService.update(params.id, body)

    // 4. Success response
    return NextResponse.json(updated, { status: 200 })

  } catch (error) {
    console.error('Error updating meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## ✅ Gestion des Méthodes HTTP

### GET - Lecture de Données

```typescript
// ✅ Lecture simple
export async function GET(request: NextRequest) {
  const meetings = await meetingStore.getAll()
  return NextResponse.json(meetings)
}

// ✅ Avec query params
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') || 'all'
  const limit = parseInt(searchParams.get('limit') || '10')

  const meetings = await meetingStore.filter({ status, limit })
  return NextResponse.json(meetings)
}

// ✅ Avec paramètres dynamiques
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const meeting = await meetingStore.get(params.id)

  if (!meeting) {
    return NextResponse.json(
      { error: 'Meeting not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(meeting)
}
```

### POST - Création/Action

```typescript
// ✅ Création de ressource
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation
    const validated = createMeetingSchema.parse(body)

    // Création
    const meeting = await meetingStore.create(validated)

    // Retour avec statut 201 (Created)
    return NextResponse.json(meeting, { status: 201 })

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    throw error
  }
}

// ✅ Action sur ressource existante
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  await meetingStore.addTranscript(params.id, body.text)

  return NextResponse.json({ success: true })
}
```

### PUT/PATCH - Mise à Jour

```typescript
// ✅ Mise à jour complète (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Remplace toutes les propriétés
  const updated = await meetingStore.replace(params.id, body)

  return NextResponse.json(updated)
}

// ✅ Mise à jour partielle (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Mise à jour sélective
  const updated = await meetingStore.update(params.id, body)

  return NextResponse.json(updated)
}
```

### DELETE - Suppression

```typescript
// ✅ Suppression avec confirmation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const deleted = await meetingStore.delete(params.id)

  if (!deleted) {
    return NextResponse.json(
      { error: 'Meeting not found' },
      { status: 404 }
    )
  }

  // 204 No Content (pas de body)
  return new NextResponse(null, { status: 204 })
}
```

---

## 📝 Validation des Entrées

### Validation Manuelle

```typescript
// ✅ Validation simple
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Type checking
  if (typeof body.title !== 'string') {
    return NextResponse.json(
      { error: 'Title must be a string' },
      { status: 400 }
    )
  }

  // Range checking
  if (body.title.length > 256) {
    return NextResponse.json(
      { error: 'Title too long (max 256 chars)' },
      { status: 400 }
    )
  }

  // Required fields
  if (!body.title.trim()) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 }
    )
  }

  // Continue...
}
```

### Validation avec Zod (Recommandé)

```typescript
import { z } from 'zod'

// Définir le schéma
const createMeetingSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  type: z.enum(['live', 'upload']),
  audioPath: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation automatique
    const validated = createMeetingSchema.parse(body)

    // Body validé et typé
    const meeting = await meetingStore.create(validated)

    return NextResponse.json(meeting, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    // Autres erreurs
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## 🔄 Gestion des Réponses

### Codes de Statut HTTP

| Code | Signification | Utilisation |
|------|---------------|-------------|
| `200` | OK | Succès (GET, POST, PATCH) |
| `201` | Created | Création réussie (POST) |
| `204` | No Content | Suppression réussie (DELETE) |
| `400` | Bad Request | Validation échouée |
| `404` | Not Found | Ressource inexistante |
| `500` | Internal Server Error | Erreur serveur |
| `503` | Service Unavailable | Service externe indisponible |

### Format de Réponse Standard

#### Succès
```typescript
// ✅ Ressource unique
return NextResponse.json({
  id: '123',
  title: 'My Meeting',
  status: 'active'
}, { status: 200 })

// ✅ Liste de ressources
return NextResponse.json({
  data: [...meetings],
  total: 42,
  page: 1
}, { status: 200 })

// ✅ Action réussie
return NextResponse.json({
  success: true,
  message: 'Meeting created successfully'
}, { status: 201 })
```

#### Erreur
```typescript
// ✅ Erreur simple
return NextResponse.json({
  error: 'Meeting not found'
}, { status: 404 })

// ✅ Erreur avec détails
return NextResponse.json({
  error: 'Validation failed',
  details: [
    { field: 'title', message: 'Title is required' },
    { field: 'type', message: 'Invalid type' }
  ]
}, { status: 400 })

// ✅ Erreur avec code
return NextResponse.json({
  error: 'MEETING_NOT_FOUND',
  message: 'The requested meeting does not exist',
  meetingId: params.id
}, { status: 404 })
```

---

## 📤 Upload de Fichiers

### FormData Pattern

```typescript
// ✅ Upload de fichier audio
export async function POST(request: NextRequest) {
  try {
    // 1. Parse FormData
    const formData = await request.formData()
    const file = formData.get('audio') as File | null

    // 2. Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validation type MIME
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm'
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Validation taille (200 MB)
    const maxSize = 200 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large (max 200MB)' },
        { status: 400 }
      )
    }

    // 3. Sauvegarder le fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'data/uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const filePath = path.join(uploadDir, `${meetingId}-${file.name}`)
    await fs.writeFile(filePath, buffer)

    // 4. Traitement async (transcription, etc.)
    processAudioInBackground(meetingId, filePath)

    // 5. Réponse immédiate
    return NextResponse.json({
      success: true,
      meetingId
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
```

---

## 🔒 Headers et CORS

### Headers Personnalisés

```typescript
// ✅ Ajouter des headers
export async function GET(request: NextRequest) {
  const data = await fetchData()

  return NextResponse.json(data, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60',
      'X-Custom-Header': 'value'
    }
  })
}
```

### CORS (si nécessaire)

```typescript
// ✅ Activer CORS pour un endpoint
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export async function POST(request: NextRequest) {
  // ... logique

  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
}
```

---

## ⚡ Streaming et Événements

### Server-Sent Events (SSE)

```typescript
// ✅ Stream de transcription live
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Envoyer des events périodiques
      const interval = setInterval(() => {
        const data = JSON.stringify({
          text: 'Nouvelle transcription...',
          timestamp: Date.now()
        })

        controller.enqueue(
          encoder.encode(`data: ${data}\n\n`)
        )
      }, 1000)

      // Cleanup
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

---

## 🎯 Patterns Avancés

### Middleware pour Auth

```typescript
// ✅ Vérifier l'authentification
async function requireAuth(request: NextRequest) {
  const token = request.headers.get('Authorization')

  if (!token) {
    throw new Error('Unauthorized')
  }

  // Valider le token
  const user = await validateToken(token)
  return user
}

// Utilisation
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Continue avec user authentifié
    const meetings = await meetingStore.getByUser(user.id)

    return NextResponse.json(meetings)

  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    throw error
  }
}
```

### Rate Limiting

```typescript
// ✅ Rate limiting simple (in-memory)
const rateLimiter = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string, maxRequests = 100, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimiter.get(ip)

  if (!record || now > record.reset) {
    rateLimiter.set(ip, { count: 1, reset: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // Continue...
}
```

### Pagination

```typescript
// ✅ Pagination standard
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')

  // Validation
  if (page < 1 || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'Invalid pagination params' },
      { status: 400 }
    )
  }

  const offset = (page - 1) * limit

  const [meetings, total] = await Promise.all([
    meetingStore.paginate({ offset, limit }),
    meetingStore.count()
  ])

  return NextResponse.json({
    data: meetings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}
```

---

## 🧪 Testing des API Routes

### Test Unitaire

```typescript
// __tests__/api/meeting.test.ts
import { GET } from '@/app/api/meeting/[id]/route'
import { NextRequest } from 'next/server'

describe('GET /api/meeting/:id', () => {
  it('should return meeting', async () => {
    const request = new NextRequest('http://localhost/api/meeting/123')
    const params = { id: '123' }

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('123')
  })

  it('should return 404 if not found', async () => {
    const request = new NextRequest('http://localhost/api/meeting/999')
    const params = { id: '999' }

    const response = await GET(request, { params })

    expect(response.status).toBe(404)
  })
})
```

---

## ✅ Checklist API Route

Avant de créer/modifier une API route:

- [ ] Définir clairement la méthode HTTP (GET/POST/etc.)
- [ ] Valider tous les paramètres d'entrée
- [ ] Gérer les erreurs avec try/catch
- [ ] Utiliser les bons codes de statut HTTP
- [ ] Logger les erreurs avec contexte
- [ ] Typer les paramètres et retours
- [ ] Déléguer la logique métier aux services
- [ ] Documenter les paramètres et réponses
- [ ] Tester les cas d'erreur

---

## 🚫 Anti-Patterns à Éviter

### ❌ NE PAS FAIRE

```typescript
// ❌ Pas de gestion d'erreur
export async function GET() {
  const data = await fetchData()  // Peut throw
  return NextResponse.json(data)
}

// ❌ Logique métier dans la route
export async function POST(request: NextRequest) {
  const body = await request.json()
  const meeting = await prisma.meeting.create({ data: body })  // NON
  return NextResponse.json(meeting)
}

// ❌ Pas de validation
export async function POST(request: NextRequest) {
  const body = await request.json()
  // Utilise body directement sans valider
  await save(body)
}

// ❌ Erreur générique sans contexte
catch (error) {
  return NextResponse.json({ error: 'Error' }, { status: 500 })
}
```

### ✅ FAIRE

```typescript
// ✅ Error handling complet
export async function GET() {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

// ✅ Logique dans service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const meeting = await meetingService.create(body)
    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    // ...
  }
}

// ✅ Validation stricte
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)
    await save(validated)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    throw error
  }
}

// ✅ Erreurs contextuelles
catch (error) {
  console.error('Error creating meeting:', {
    error,
    body,
    timestamp: new Date().toISOString()
  })
  return NextResponse.json(
    { error: 'Failed to create meeting' },
    { status: 500 }
  )
}
```

---

## 🔗 Références

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Zod Validation](https://zod.dev/)
