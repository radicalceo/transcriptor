# Guidelines Techniques - Meeting Copilot

> **🎯 Objectif**: Ce document et les guides associés définissent les standards techniques à respecter pour maintenir la cohérence, la qualité et la stabilité de l'application.

## 📚 Table des matières

1. [Architecture et Structure](#architecture) - [architecture.md](./guidelines/architecture.md)
2. [API Routes](#api-routes) - [api-routes.md](./guidelines/api-routes.md)
3. [React Components](#components) - [components.md](./guidelines/components.md)
4. [TypeScript et Types](#typescript) - [typescript.md](./guidelines/typescript.md)
5. [Services et APIs Externes](#services) - [services.md](./guidelines/services.md)
6. [Gestion Audio](#audio) - [audio.md](./guidelines/audio.md)
7. [Base de Données](#database) - [database.md](./guidelines/database.md)
8. [Gestion d'Erreurs](#errors) - [error-handling.md](./guidelines/error-handling.md)
9. [Performance](#performance) - [performance.md](./guidelines/performance.md)

---

## 🎯 Principes Fondamentaux

### 1. Cohérence avant Innovation
- **Suivez les patterns existants** avant d'en créer de nouveaux
- Si vous devez modifier un pattern, documentez-le et appliquez-le partout
- Consultez les guides avant chaque nouveau développement

### 2. Type Safety First
- **TypeScript strict** activé
- Aucun `any` sans justification documentée
- Interfaces partagées dans `/lib/types/`
- Validation runtime pour les données externes

### 3. Séparation des Responsabilités
- **UI** (components) ≠ **Logic** (services) ≠ **Data** (Prisma)
- Un fichier = une responsabilité claire
- Services réutilisables et testables

### 4. Gestion d'Erreurs Exhaustive
- Toutes les promesses doivent être `try/catch`
- Erreurs logguées avec contexte
- Messages d'erreur clairs pour l'utilisateur
- Codes HTTP appropriés

### 5. Performance par Défaut
- In-memory cache pour les meetings actifs
- Lazy loading des composants lourds
- Optimisation des requêtes DB (indexes, sélection de champs)
- Chunking pour les gros fichiers audio

---

## 🚀 Workflow de Développement

### Avant de Commencer
1. ✅ Lire le guide correspondant à votre tâche
2. ✅ Vérifier les patterns existants similaires
3. ✅ Identifier les types TypeScript nécessaires
4. ✅ Planifier la gestion d'erreurs

### Pendant le Développement
1. ✅ Respecter la structure de dossiers
2. ✅ Typer toutes les fonctions et variables
3. ✅ Ajouter error handling à chaque niveau
4. ✅ Tester les cas limites (fichiers volumineux, erreurs réseau, etc.)

### Après le Développement
1. ✅ Vérifier la cohérence avec les guides
2. ✅ Tester les intégrations (ne pas casser les features existantes)
3. ✅ Mettre à jour la documentation si nécessaire
4. ✅ Vérifier les performances (pas de régressions)

---

## 📖 Guides Détaillés

### [1. Architecture et Structure](./guidelines/architecture.md)
- Organisation des dossiers
- Conventions de nommage
- Structure Next.js App Router
- Séparation client/serveur

### [2. API Routes](./guidelines/api-routes.md)
- Patterns de requêtes/réponses
- Gestion d'erreurs HTTP
- Validation des entrées
- Streaming et uploads

### [3. React Components](./guidelines/components.md)
- Client vs Server Components
- Hooks patterns
- State management
- Styling avec Tailwind

### [4. TypeScript et Types](./guidelines/typescript.md)
- Définition des interfaces
- Types partagés
- Validation runtime
- Casting et assertions

### [5. Services et APIs Externes](./guidelines/services.md)
- Pattern Singleton
- Intégration Claude/Whisper
- Retry logic
- Rate limiting

### [6. Gestion Audio](./guidelines/audio.md)
- Recording avec MediaRecorder
- Upload progressif
- Chunking FFmpeg
- Formats supportés

### [7. Base de Données](./guidelines/database.md)
- Schéma Prisma
- Migrations
- JSON storage patterns
- Optimisation requêtes

### [8. Gestion d'Erreurs](./guidelines/error-handling.md)
- Try/catch patterns
- Error boundaries
- Logging
- User feedback

### [9. Performance](./guidelines/performance.md)
- In-memory caching
- DB query optimization
- Component optimization
- Bundle size

---

## ⚠️ Anti-Patterns à Éviter

### ❌ NE PAS FAIRE
```typescript
// ❌ any sans typage
const data: any = await fetch(...)

// ❌ Pas de gestion d'erreur
const result = await someAsyncOperation()

// ❌ Logique métier dans les composants
function MyComponent() {
  const data = await db.meeting.findMany() // NON !
}

// ❌ Mutation directe du state
meeting.transcript.push(newText) // NON !
setMeeting(meeting)
```

### ✅ FAIRE
```typescript
// ✅ Typage strict
const data: Meeting = await fetchMeeting(id)

// ✅ Error handling
try {
  const result = await someAsyncOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('User-friendly message')
}

// ✅ Logique dans les services
// Component:
const { data } = await fetch('/api/meetings')
// API Route:
const meetings = await meetingStore.getAll()

// ✅ Immutabilité
setMeeting({
  ...meeting,
  transcript: [...meeting.transcript, newText]
})
```

---

## 🔧 Configuration et Outils

### Environnement
```bash
# Variables requises
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=file:./prisma/dev.db
```

### Scripts
```bash
npm run dev          # Dev avec Turbopack
npm run build        # Build production
npm run start        # Start production
npx prisma studio    # Interface DB
npx prisma migrate   # Migrations
```

### Extensions VSCode Recommandées
- ESLint
- Prisma
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

---

## 📞 Contacts et Support

- **Documentation projet**: `/doc/`
- **Architecture détaillée**: `/doc/architecture/`
- **Issues**: Documenter tout bug ou limitation découvert

---

## 📝 Mise à Jour des Guidelines

Ces guidelines sont vivantes et doivent évoluer avec le projet:

1. **Nouveau pattern identifié** → Documenter dans le guide approprié
2. **Pattern obsolète** → Mettre à jour + migration plan
3. **Amélioration** → Pull request avec justification

**Dernière mise à jour**: 2025-01-20
