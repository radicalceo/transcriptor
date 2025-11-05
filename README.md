# Meeting Copilot

Application web de transcription et d'analyse de réunions en temps réel, alimentée par l'IA.

## Fonctionnalités

- **Transcription en temps réel** : Capture audio via microphone et transcription automatique
- **Upload de fichiers audio** : Support MP3, WAV, M4A, etc. avec transcription Whisper
- **Analyse intelligente** : Détection automatique des thèmes, décisions et actions
- **Suggestions live** : Mise à jour des suggestions toutes les 5 secondes pendant le meeting
- **Édition interactive** : Modification/suppression des suggestions en direct
- **Résumé post-meeting** : Génération d'un rapport structuré et complet
- **Interface moderne** : Design responsive avec mode sombre

## Technologies

- **Frontend** : Next.js 15 (App Router) + TypeScript + TailwindCSS
- **Backend** : API Routes Next.js
- **IA** :
  - Web Speech API (transcription live via microphone)
  - OpenAI Whisper (transcription fichiers audio)
  - Claude Sonnet (analyse et résumé)
- **Déploiement** : Vercel

## Installation

### Prérequis

- Node.js 18+ et npm
- Navigateur Chrome ou Edge (pour Web Speech API)
- Clés API :
  - Anthropic API Key (Claude) - Obligatoire
  - OpenAI API Key (Whisper) - Optionnel (uniquement pour upload)

### Configuration

1. Cloner le projet et installer les dépendances :

\`\`\`bash
npm install
\`\`\`

2. Créer un fichier \`.env.local\` à la racine :

\`\`\`env
# Obligatoire
ANTHROPIC_API_KEY=sk-ant-...

# Optionnel (pour upload de fichiers audio)
OPENAI_API_KEY=sk-...
\`\`\`

3. Lancer le serveur de développement :

\`\`\`bash
npm run dev
\`\`\`

4. Ouvrir [http://localhost:3000](http://localhost:3000)

## Utilisation

### Démarrer un meeting (Live)

1. Cliquer sur "Démarrer un meeting"
2. Autoriser l'accès au microphone
3. Parler normalement - la transcription s'affiche en temps réel
4. Observer les suggestions d'IA dans le panneau de droite
5. Modifier/supprimer les suggestions si nécessaire
6. Cliquer sur "Terminer le meeting" pour générer le résumé final

### Uploader un enregistrement

1. Cliquer sur "Uploader un enregistrement"
2. Glisser-déposer ou sélectionner un fichier audio (MP3, WAV, etc.)
3. Attendre la transcription automatique (Whisper)
4. Consulter les suggestions générées automatiquement
5. Générer le résumé final

📖 **Documentation complète** : Voir [UPLOAD_FEATURE.md](dev_doc/UPLOAD_FEATURE.md)

### Navigation

- **/** : Page d'accueil
- **/meeting/[id]** : Page du meeting en cours
- **/summary/[id]** : Page du résumé post-meeting

## Architecture

### Structure des dossiers

\`\`\`
transcriptor/
├── app/
│   ├── api/
│   │   ├── meeting/
│   │   │   ├── start/      # Création de session
│   │   │   └── [id]/       # Get/Update meeting
│   │   ├── suggestions/    # Analyse live
│   │   └── summary/        # Résumé final
│   ├── meeting/[id]/       # Page meeting
│   ├── summary/[id]/       # Page résumé
│   └── page.tsx            # Page d'accueil
├── components/
│   └── SuggestionsPanel.tsx
├── lib/
│   ├── types/
│   │   └── meeting.ts
│   └── services/
│       ├── claudeService.ts
│       └── meetingStore.ts
└── doc/                    # Documentation
\`\`\`

### Flux de données

1. **Démarrage** : \`POST /api/meeting/start\` → Crée une session UUID
2. **Enregistrement** : Web Speech API → Transcription continue
3. **Transcription** : \`POST /api/meeting/[id]\` → Enregistre le texte
4. **Suggestions** : Polling \`POST /api/suggestions\` toutes les 5s
5. **Analyse** : Claude analyse le transcript et génère suggestions
6. **Fin** : \`POST /api/summary\` → Génère résumé complet
7. **Affichage** : Redirection vers \`/summary/[id]\`

### Stockage

Le MVP utilise un stockage en mémoire (Map) côté serveur. Les données sont perdues au redémarrage du serveur.

Pour un environnement de production, remplacer \`meetingStore.ts\` par une base de données (PostgreSQL, MongoDB, etc.).

## Déploiement sur Vercel

1. Push le code sur GitHub

2. Connecter le repository à Vercel

3. Configurer les variables d'environnement :
   - \`ANTHROPIC_API_KEY\`

4. Déployer

## Limitations MVP

- **Pas de persistance** : Données en mémoire uniquement
- **Single-user** : Pas d'authentification
- **Pas d'upload** : Fichiers audio pas encore supportés
- **Navigateurs** : Chrome/Edge uniquement (Web Speech API)
- **Langue** : Français par défaut

## Prochaines étapes

- [x] Upload de fichiers audio ✅ (v0.2.0)
- [ ] Persistance en base de données
- [ ] Diarisation (distinction speakers)
- [ ] Support multi-langues
- [ ] Authentification utilisateur
- [ ] Export PDF/Word
- [ ] Gestion de l'historique
- [ ] Intégration calendrier
- [ ] Partage de résumés

## Documentation

Voir le dossier \`doc/\` pour plus de détails :

- [Spécifications fonctionnelles](doc/functional_specs.md)
- [Spécifications techniques](doc/technical_specs.md)
- [Prompts Claude](doc/PROMPTS.md)
- [Variables d'environnement](doc/env_example.md)

## Support

Navigateurs supportés :
- Chrome 25+
- Edge 79+

La reconnaissance vocale nécessite une connexion HTTPS en production.

## License

MIT
