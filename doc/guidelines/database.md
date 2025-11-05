# Guide Base de Données et Prisma

> **Objectif**: Standardiser l'utilisation de Prisma et PostgreSQL pour garantir performance, cohérence et maintenabilité.

---

## 🗄️ Architecture Base de Données

### PostgreSQL avec Prisma ORM

**Pourquoi PostgreSQL?**
- ✅ Production-ready et scalable
- ✅ Compatible avec Vercel (serverless)
- ✅ Support JSON natif
- ✅ Transactions ACID complètes
- ✅ Connection pooling intégré

**Configuration actuelle:**
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Pour le déploiement Vercel:**
- Voir [VERCEL_DEPLOYMENT.md](/dev_doc/VERCEL_DEPLOYMENT2.md) pour le guide complet
- Utiliser Vercel Postgres (powered by Neon)
- Connection string automatiquement configurée via `POSTGRES_PRISMA_URL`

---

## 📋 Schéma Prisma

### Schema Actuel

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Meeting {
  id                  String   @id @default(uuid())
  title               String?
  status              String   @default("active")  // active|processing|completed
  audioPath           String?
  duration            Int?     // Seconds

  // Transcript storage
  transcript          String   @default("[]")     // JSON array of strings
  transcriptSegments  String   @default("[]")     // JSON array of TranscriptSegment

  // AI Suggestions (JSON strings)
  topics              String   @default("[]")     // JSON array
  decisions           String   @default("[]")     // JSON array
  actions             String   @default("[]")     // JSON array

  // Summary (JSON string)
  summary             String?

  // Timestamps
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Indexes for performance
  @@index([status])
  @@index([createdAt])
}
```

### Pourquoi JSON en String?

**Note**: PostgreSQL supporte le type JSON natif, mais nous utilisons String pour:

**Avantages:**
- ✅ Flexibilité du schéma (pas de migration pour chaque champ)
- ✅ Compatibilité avec migration depuis SQLite
- ✅ Facilite évolution des structures (Suggestions, Summary)
- ✅ Simplicité du code (pas de mappage complexe)

**Inconvénients:**
- ❌ Pas de validation DB native
- ❌ Requêtes JSON complexes non optimisées
- ⚠️ Validation TypeScript + runtime requise

**Alternative future**: Migrer vers colonnes JSON natives PostgreSQL si nécessaire

---

## 🔧 Client Prisma

### Pattern Singleton

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// ✅ Prevent multiple instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ✅ Cleanup on exit
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
```

**Utilisation:**
```typescript
import { prisma } from '@/lib/prisma'

const meetings = await prisma.meeting.findMany()
```

---

## 📝 Opérations CRUD

### Create

```typescript
// ✅ Créer un meeting
export async function createMeeting(
  type: MeetingType,
  title?: string
): Promise<Meeting> {
  const meeting = await prisma.meeting.create({
    data: {
      id: crypto.randomUUID(),
      type,
      title,
      status: 'active',
      transcript: JSON.stringify([]),
      transcriptSegments: JSON.stringify([]),
      topics: JSON.stringify([]),
      decisions: JSON.stringify([]),
      actions: JSON.stringify([])
    }
  })

  // Parse JSON fields
  return parseMeetingFromDb(meeting)
}

// ✅ Parser pour convertir JSON strings
function parseMeetingFromDb(dbMeeting: any): Meeting {
  return {
    ...dbMeeting,
    transcript: JSON.parse(dbMeeting.transcript),
    transcriptSegments: JSON.parse(dbMeeting.transcriptSegments),
    suggestions: {
      topics: JSON.parse(dbMeeting.topics),
      decisions: JSON.parse(dbMeeting.decisions),
      actions: JSON.parse(dbMeeting.actions)
    },
    summary: dbMeeting.summary ? JSON.parse(dbMeeting.summary) : undefined
  }
}
```

### Read

```typescript
// ✅ Récupérer un meeting
export async function getMeeting(id: string): Promise<Meeting | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id }
  })

  if (!meeting) return null

  return parseMeetingFromDb(meeting)
}

// ✅ Lister avec pagination
export async function listMeetings(
  page = 1,
  limit = 10
): Promise<{ data: Meeting[]; total: number }> {
  const offset = (page - 1) * limit

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        duration: true,
        createdAt: true,
        updatedAt: true
        // Ne pas charger les gros champs JSON
      }
    }),
    prisma.meeting.count()
  ])

  return {
    data: meetings as Meeting[],
    total
  }
}

// ✅ Filtrer par status
export async function getMeetingsByStatus(
  status: MeetingStatus
): Promise<Meeting[]> {
  const meetings = await prisma.meeting.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' }
  })

  return meetings.map(parseMeetingFromDb)
}
```

### Update

```typescript
// ✅ Update partiel
export async function updateMeeting(
  id: string,
  updates: Partial<Meeting>
): Promise<Meeting> {
  // Préparer données pour DB (stringify JSON)
  const data: any = {}

  if (updates.title !== undefined) data.title = updates.title
  if (updates.status) data.status = updates.status
  if (updates.audioPath) data.audioPath = updates.audioPath
  if (updates.duration !== undefined) data.duration = updates.duration

  if (updates.transcript) {
    data.transcript = JSON.stringify(updates.transcript)
  }

  if (updates.transcriptSegments) {
    data.transcriptSegments = JSON.stringify(updates.transcriptSegments)
  }

  if (updates.suggestions) {
    data.topics = JSON.stringify(updates.suggestions.topics)
    data.decisions = JSON.stringify(updates.suggestions.decisions)
    data.actions = JSON.stringify(updates.suggestions.actions)
  }

  if (updates.summary) {
    data.summary = JSON.stringify(updates.summary)
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data
  })

  return parseMeetingFromDb(updated)
}

// ✅ Update atomique (éviter race conditions)
export async function addTranscriptSegment(
  id: string,
  segment: string
): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { transcript: true }
  })

  if (!meeting) {
    throw new Error('Meeting not found')
  }

  const transcript: string[] = JSON.parse(meeting.transcript)
  transcript.push(segment)

  await prisma.meeting.update({
    where: { id },
    data: {
      transcript: JSON.stringify(transcript)
    }
  })
}
```

### Delete

```typescript
// ✅ Suppression avec cleanup
export async function deleteMeeting(id: string): Promise<void> {
  // 1. Récupérer meeting pour cleanup
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { audioPath: true }
  })

  if (!meeting) {
    throw new Error('Meeting not found')
  }

  // 2. Supprimer fichier audio si existe
  if (meeting.audioPath) {
    try {
      await fs.unlink(meeting.audioPath)
    } catch (error) {
      console.warn('Failed to delete audio file:', error)
    }
  }

  // 3. Supprimer de la DB
  await prisma.meeting.delete({
    where: { id }
  })
}
```

---

## 🚀 Optimisation des Requêtes

### Select Spécifique

```typescript
// ❌ Charger toutes les colonnes (lourd)
const meetings = await prisma.meeting.findMany()

// ✅ Sélectionner uniquement les champs nécessaires
const meetings = await prisma.meeting.findMany({
  select: {
    id: true,
    title: true,
    status: true,
    createdAt: true
    // Ne pas charger transcript, summary, etc.
  }
})
```

### Indexes

```prisma
// ✅ Indexes sur champs fréquemment filtrés
model Meeting {
  // ...

  @@index([status])      // WHERE status = 'active'
  @@index([createdAt])   // ORDER BY createdAt DESC
  @@index([type])        // WHERE type = 'live'
}
```

### Batching

```typescript
// ✅ Batch updates (transaction)
export async function updateMultipleMeetings(
  updates: Array<{ id: string; status: MeetingStatus }>
): Promise<void> {
  await prisma.$transaction(
    updates.map(({ id, status }) =>
      prisma.meeting.update({
        where: { id },
        data: { status }
      })
    )
  )
}
```

---

## 🔄 Migrations

### Créer une Migration

```bash
# 1. Modifier schema.prisma
# 2. Générer migration
npx prisma migrate dev --name add_meeting_label

# 3. Appliquer en production
npx prisma migrate deploy
```

### Exemple de Migration

```prisma
// Avant
model Meeting {
  id     String @id
  title  String?
}

// Après - ajout d'un champ
model Meeting {
  id     String @id
  title  String?
  label  String?  // ✅ Nouveau champ optionnel
}
```

```bash
npx prisma migrate dev --name add_meeting_label
```

### Reset Database (Dev uniquement)

```bash
# ⚠️ Efface toutes les données
npx prisma migrate reset
```

---

## 🧪 Prisma Studio

### Interface Visuelle

```bash
# Lancer Prisma Studio
npx prisma studio

# Accessible sur http://localhost:5555
```

**Fonctionnalités:**
- Visualiser les données
- Éditer manuellement
- Exécuter requêtes
- Debugger schéma

---

## 🔒 Bonnes Pratiques

### 1. Transactions

```typescript
// ✅ Opérations atomiques
export async function completeMeeting(
  id: string,
  summary: Summary
): Promise<Meeting> {
  return await prisma.$transaction(async (tx) => {
    // 1. Update status
    await tx.meeting.update({
      where: { id },
      data: { status: 'completed' }
    })

    // 2. Save summary
    const updated = await tx.meeting.update({
      where: { id },
      data: {
        summary: JSON.stringify(summary)
      }
    })

    return parseMeetingFromDb(updated)
  })
}
```

### 2. Error Handling

```typescript
// ✅ Gestion d'erreurs Prisma
import { Prisma } from '@prisma/client'

try {
  await prisma.meeting.create({ data: { ... } })
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Erreur connue (ex: unique constraint)
    if (error.code === 'P2002') {
      throw new Error('Meeting already exists')
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Erreur de validation
    throw new Error('Invalid data')
  }

  // Erreur générique
  console.error('Database error:', error)
  throw new Error('Database operation failed')
}
```

### 3. Connection Pooling

```typescript
// ✅ Configuration automatique avec Vercel Postgres
// Utiliser POSTGRES_PRISMA_URL au lieu de POSTGRES_URL
// Vercel configure automatiquement le pooling avec PgBouncer

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // Points to POSTGRES_PRISMA_URL on Vercel
}
```

**Vercel Postgres:**
- Connection pooling via PgBouncer (automatique)
- `POSTGRES_PRISMA_URL` - Optimisé pour Prisma avec pooling
- `POSTGRES_URL_NON_POOLING` - Connexion directe (migrations uniquement)

---

## 📊 Logging et Monitoring

### Query Logging

```typescript
// lib/prisma.ts
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query'
    },
    {
      emit: 'stdout',
      level: 'error'
    },
    {
      emit: 'stdout',
      level: 'warn'
    }
  ]
})

// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 1000) {  // > 1 seconde
    console.warn('Slow query detected:', {
      query: e.query,
      duration: `${e.duration}ms`,
      params: e.params
    })
  }
})
```

---

## ✅ Checklist Database

- [ ] Client Prisma en singleton
- [ ] JSON fields parsés correctement
- [ ] Indexes sur champs filtrés/triés
- [ ] Select spécifique (pas de SELECT *)
- [ ] Transactions pour opérations atomiques
- [ ] Error handling pour erreurs Prisma
- [ ] Cleanup des ressources (audio, etc.)
- [ ] Migrations versionnées et appliquées
- [ ] Logging des requêtes lentes
- [ ] Connection pooling configuré (Vercel: `POSTGRES_PRISMA_URL`)
- [ ] Variables d'environnement configurées sur Vercel
- [ ] Migrations déployées en production

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```typescript
// ❌ Multiple instances Prisma
const prisma1 = new PrismaClient()
const prisma2 = new PrismaClient()

// ❌ SELECT * sur gros champs
const meetings = await prisma.meeting.findMany()  // Charge tout

// ❌ N+1 queries
for (const id of ids) {
  const meeting = await prisma.meeting.findUnique({ where: { id } })
}

// ❌ JSON parsing oublié
const meeting = await prisma.meeting.findUnique({ where: { id } })
console.log(meeting.transcript)  // String, pas Array !

// ❌ Pas de transaction pour opérations liées
await prisma.meeting.update({ ... })
await prisma.meeting.update({ ... })  // Peut échouer partiellement
```

### ✅ FAIRE

```typescript
// ✅ Singleton
import { prisma } from '@/lib/prisma'

// ✅ Select spécifique
const meetings = await prisma.meeting.findMany({
  select: { id: true, title: true }
})

// ✅ Batch query
const meetings = await prisma.meeting.findMany({
  where: { id: { in: ids } }
})

// ✅ Parse JSON
const meeting = await prisma.meeting.findUnique({ where: { id } })
const transcript = JSON.parse(meeting.transcript)

// ✅ Transaction
await prisma.$transaction([
  prisma.meeting.update({ ... }),
  prisma.meeting.update({ ... })
])
```

---

## 🔗 Références

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [VERCEL_DEPLOYMENT.md](/dev_doc/VERCEL_DEPLOYMENT2.md) - Guide de déploiement complet
