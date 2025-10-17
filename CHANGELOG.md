# Changelog - Meeting Copilot

## [0.2.0] - 2025-10-16

### Added
- 🎉 **Upload de fichiers audio** : Nouvelle fonctionnalité majeure
  - Interface drag & drop pour upload de fichiers audio
  - Support formats : MP3, MP4, WAV, M4A, WebM (max 25 MB)
  - Transcription automatique avec Whisper API
  - Analyse automatique avec Claude après transcription
  - Page dédiée `/upload` avec validation côté client

- ✨ **Service Whisper** (`lib/services/whisperService.ts`)
  - Transcription audio avec timestamps
  - Validation des formats et tailles de fichiers
  - Estimation du temps de traitement
  - Support multi-langues (défaut: français)

- 📄 **Documentation upload** (`UPLOAD_FEATURE.md`)
  - Guide d'utilisation complet
  - Configuration des API keys
  - Informations sur les coûts
  - Limitations et améliorations futures

### Changed
- 🔄 Page d'accueil : Bouton "Uploader un enregistrement" maintenant actif
- 📝 `.env.example` : Ajout de OPENAI_API_KEY avec documentation
- 🏗️ Architecture : Support du traitement asynchrone des fichiers audio

## [Unreleased] - 2025-10-16

### Fixed
- 🐛 **Déduplication des suggestions** : Résolution du problème de doublons dans les suggestions
  - Implémentation d'un algorithme de similarité (distance de Levenshtein)
  - Détection des topics en sous-chaînes (ex: "Back office" vs "Création back office application")
  - Fusion intelligente conservant les versions les plus complètes
  - Limitation du nombre de suggestions (8 topics, 10 décisions, 15 actions max)

- 🐛 **Erreur Client Component** : Correction de l'utilisation de `use()` avec Promise
  - Utilisation directe de `params.id` au lieu de `use(Promise.resolve(params.id))`
  - Compatible avec Next.js 15 Client Components

### Added
- ✨ **Service de déduplication** (`lib/services/deduplication.ts`)
  - `deduplicateTopics()` : Fusionne topics similaires, garde le plus précis
  - `deduplicateDecisions()` : Élimine décisions en doublon (>75% similarité)
  - `deduplicateActions()` : Fusionne actions similaires, garde celles avec le plus d'infos

- 🧪 **Scripts de test**
  - `scripts/test-api-key.js` : Vérifie la validité de la clé API Anthropic
  - `scripts/test-deduplication.js` : Test de la logique de déduplication

### Technical Details

#### Algorithme de Déduplication

**Topics**
- Seuil de similarité : 70%
- Vérification sous-chaînes (ex: "Application" dans "Back office application")
- Conservation du topic le plus long (plus précis)

**Décisions**
- Seuil de similarité : 75%
- Comparaison textuelle uniquement

**Actions**
- Seuil de similarité : 75%
- Priorisation des actions avec assignee/due_date
- Conservation de la version la plus complète

#### Exemples de Fusion

```
Avant :
- "Création back office application"
- "Back office"
- "Application"
- "Création back office"

Après :
- "Création back office application"
```

```
Avant :
- "Julien prépare le deck" (sans assignee)
- "Julien prépare le deck avant lundi" (avec assignee)
- "Préparer le deck" (sans assignee)

Après :
- "Julien prépare le deck avant lundi" (avec assignee)
```

## [0.1.0] - 2025-10-16

### Initial Release
- ✅ Next.js 15 + TypeScript + TailwindCSS
- ✅ Transcription temps réel (Web Speech API)
- ✅ Analyse IA avec Claude Sonnet 3.5
- ✅ Suggestions live (polling 5s)
- ✅ Édition inline des suggestions
- ✅ Génération résumé post-meeting
- ✅ Interface responsive + dark mode

### Known Issues
- Stockage en mémoire uniquement (pas de persistance)
- Chrome/Edge uniquement (Web Speech API)
- Single-user (pas d'authentification)

---

## Prochaines Versions

### v0.2.0 (Prévu)
- [ ] Persistance en base de données (PostgreSQL/Supabase)
- [ ] Upload fichiers audio
- [ ] Amélioration diarisation (distinction speakers)
- [ ] Export PDF/Word

### v0.3.0 (Prévu)
- [ ] Authentification utilisateur
- [ ] Historique des meetings
- [ ] Support multi-langues (EN/ES)
- [ ] Intégration calendrier

---

## Notes de Migration

### De v0.1.0 à Unreleased

Aucune migration nécessaire. Les améliorations sont rétrocompatibles.

Si vous avez modifié `app/api/suggestions/route.ts` :
- Ajoutez l'import : `import { deduplicateSuggestions } from '@/lib/services/deduplication'`
- Remplacez la fusion simple par : `deduplicateSuggestions({...})`

---

## Contributeurs

- Initial implementation: Claude Code
- Bug reports & testing: [Votre nom]
