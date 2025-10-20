# Guidelines Techniques - Navigation Rapide

Bienvenue dans les guidelines techniques du projet Meeting Copilot. Ces guides définissent les standards à respecter pour maintenir la qualité, la cohérence et la stabilité de l'application.

## 📚 Guides Disponibles

### 1. [Architecture et Structure](./architecture.md)
Organisation des dossiers, conventions de nommage, séparation client/serveur.

**Quand consulter:**
- Avant de créer un nouveau fichier/dossier
- Pour comprendre où placer du code
- Quand vous ajoutez une nouvelle feature

**Concepts clés:**
- Structure App Router Next.js
- Séparation des responsabilités (UI/Logic/Data)
- Patterns d'import/export

---

### 2. [API Routes](./api-routes.md)
Patterns pour créer des API routes Next.js robustes et cohérentes.

**Quand consulter:**
- Avant de créer une nouvelle API route
- Pour gérer erreurs HTTP correctement
- Quand vous uploadez des fichiers

**Concepts clés:**
- Méthodes HTTP (GET/POST/PUT/DELETE)
- Validation des entrées
- Codes de statut HTTP
- Upload de fichiers

---

### 3. [React Components](./components.md)
Standards pour composants React (hooks, state, performance).

**Quand consulter:**
- Avant de créer un composant
- Pour optimiser les performances
- Quand vous utilisez des hooks

**Concepts clés:**
- Client vs Server Components
- Hooks patterns (useState, useEffect, etc.)
- Optimisation (memo, useMemo, useCallback)
- Styling Tailwind

---

### 4. [TypeScript et Types](./typescript.md)
Typage strict, validation runtime, type guards.

**Quand consulter:**
- Avant de définir de nouvelles interfaces
- Pour valider des données externes
- Quand vous avez des erreurs TypeScript

**Concepts clés:**
- Définition d'interfaces
- Type guards
- Validation avec Zod
- Utility types

---

### 5. [Services et APIs Externes](./services.md)
Intégration Claude, Whisper, retry logic, rate limiting.

**Quand consulter:**
- Avant d'intégrer une API externe
- Pour gérer les erreurs d'API
- Quand vous ajoutez retry logic

**Concepts clés:**
- Pattern Singleton
- Retry avec backoff
- Rate limiting
- Gestion des secrets

---

### 6. [Gestion Audio](./audio.md)
Capture, upload, processing, chunking audio.

**Quand consulter:**
- Pour tout ce qui touche à l'audio
- Upload de fichiers audio
- Enregistrement microphone

**Concepts clés:**
- MediaRecorder API
- Upload progressif
- Chunking FFmpeg
- Formats supportés

---

### 7. [Base de Données](./database.md)
Prisma, SQLite, migrations, optimisation requêtes.

**Quand consulter:**
- Avant de modifier le schéma Prisma
- Pour optimiser des requêtes
- Quand vous créez des migrations

**Concepts clés:**
- Schéma Prisma
- CRUD operations
- Indexes et performance
- Migrations

---

### 8. [Gestion d'Erreurs](./error-handling.md)
Try-catch, logging, error boundaries, messages utilisateur.

**Quand consulter:**
- Pour gérer des erreurs correctement
- Avant d'ajouter du logging
- Quand vous créez des error messages

**Concepts clés:**
- Try-catch patterns
- Custom error classes
- Logging structuré
- Error recovery

---

### 9. [Performance](./performance.md)
Caching, optimisation DB, bundle size, lazy loading.

**Quand consulter:**
- Quand l'app est lente
- Avant d'ajouter des features lourdes
- Pour optimiser le bundle

**Concepts clés:**
- In-memory caching
- React optimization (memo, lazy)
- DB query optimization
- Bundle analysis

---

## 🚀 Workflow Recommandé

### Avant de Coder
1. ✅ Identifier le type de tâche (feature, bug fix, etc.)
2. ✅ Lire les guides pertinents
3. ✅ Vérifier les patterns existants similaires
4. ✅ Planifier la structure (types, services, API, UI)

### Pendant le Développement
1. ✅ Respecter les conventions de nommage
2. ✅ Typer strictement (TypeScript)
3. ✅ Gérer les erreurs à tous les niveaux
4. ✅ Logger avec contexte

### Après le Développement
1. ✅ Vérifier cohérence avec les guides
2. ✅ Tester les cas limites
3. ✅ Vérifier que les features existantes fonctionnent
4. ✅ Optimiser si nécessaire

---

## 🎯 Principes Transversaux

### 1. Type Safety First
Typage strict activé, aucun `any` sans justification.

### 2. Error Handling Exhaustif
Toutes les async operations doivent avoir try-catch.

### 3. Performance par Défaut
In-memory cache, lazy loading, optimisation DB.

### 4. Cohérence avant Innovation
Suivre les patterns existants avant d'en créer de nouveaux.

### 5. Logging avec Contexte
Toutes les erreurs loggées avec métadonnées utiles.

---

## 📖 Index par Tâche

### Créer une Nouvelle Feature
1. [Architecture](./architecture.md) - Structure des fichiers
2. [TypeScript](./typescript.md) - Définir les types
3. [Database](./database.md) - Schéma Prisma si besoin
4. [API Routes](./api-routes.md) - Créer endpoints
5. [Components](./components.md) - UI
6. [Error Handling](./error-handling.md) - Gestion d'erreurs

### Intégrer une API Externe
1. [Services](./services.md) - Pattern d'intégration
2. [Error Handling](./error-handling.md) - Retry logic
3. [TypeScript](./typescript.md) - Typer les réponses

### Optimiser les Performances
1. [Performance](./performance.md) - Guide complet
2. [Database](./database.md) - Optimisation requêtes
3. [Components](./components.md) - React optimization

### Gérer l'Audio
1. [Audio](./audio.md) - Guide complet
2. [API Routes](./api-routes.md) - Upload de fichiers
3. [Services](./services.md) - Transcription Whisper

---

## 🔧 Outils et Commandes

```bash
# Dev
npm run dev              # Dev avec Turbopack

# Build
npm run build            # Build production

# Database
npx prisma studio        # Interface DB visuelle
npx prisma migrate dev   # Créer migration

# Analysis
npx @next/bundle-analyzer  # Analyser bundle size
```

---

## 📞 Besoin d'Aide?

- **Documentation projet**: `/doc/`
- **Guidelines techniques**: Ce dossier
- **Exemples de code**: Dans chaque guide

---

**Dernière mise à jour**: 2025-01-20
