See also documentation in [docs](/doc/).
Avant tout développement, assures toi de bien respecter les guidelines techniques.

Architecture générale

L'application supporte 3 modes de capture isolés :

**1. Audio-only** (`/meeting/audio-only/[id]`)
- Enregistrement micro seul avec Web Speech API
- Transcription en temps réel
- Suggestions live via Claude

**2. Screen-share** (`/meeting/screen-share/[id]`)
- Capture micro + audio de l'onglet (pour visioconférences)
- Mixage audio avec Web Audio API
- Transcription et suggestions en temps réel

**3. Upload** (`/meeting/upload/[id]`)
- Upload de fichier audio/vidéo
- Transcription différée via Whisper
- Génération de résumé automatique

## Routes API

### Audio-only
- `POST /api/audio-only/start` - Créer un meeting audio-only
- `GET/PATCH /api/audio-only/[id]` - Récupérer/mettre à jour un meeting

### Screen-share
- `POST /api/screen-share/start` - Créer un meeting screen-share
- `GET/PATCH /api/screen-share/[id]` - Récupérer/mettre à jour un meeting

### Upload
- `POST /api/upload` - Upload d'un fichier audio/vidéo
- `POST /api/process-uploaded` - Lancer la transcription

### Routes partagées
- `GET /api/meeting/[id]` - Récupérer les détails d'un meeting (tous types)
- `POST /api/suggestions` - Génération de suggestions live
- `POST /api/summary` - Génération du résumé final


# PROMPTS

## Suggestions en direct (Claude ou GPT-4o-mini)
Tu reçois un extrait de transcription de réunion.
Analyse le contenu et renvoie les informations suivantes au format JSON :
{
"topics": [...],
"decisions": [...],
"actions": [...]
}
Réponds uniquement en JSON.


## Résumé post-meeting (Claude Sonnet)

Voici la transcription complète d'une réunion.

Génère un résumé structuré et synthétique.
Retourne un JSON suivant :
{
"summary": "Résumé clair de la réunion",
"topics": ["Thème 1", "Thème 2"],
"decisions": [{"text": "..."}],
"actions": [{"text": "...", "assignee": "...", "due_date": "..."}]
}

# Modèle de données

interface Meeting {
id: string;
type: 'audio-only' | 'screen-share' | 'upload';
status: 'active' | 'processing' | 'completed';
transcript: string[];
transcriptSegments: TranscriptSegment[];
topics: string[];
decisions: string[];
actions: Action[];
summary?: {
summary: string;
topics: string[];
decisions: { text: string }[];
actions: { text: string; assignee?: string; due_date?: string }[];
};
}

interface TranscriptSegment {
text: string;
timestamp: number;
speaker?: string;
}

interface Action {
text: string;
assignee?: string;
due_date?: string;
}

# Flux global

## Flux Audio-only
1. `POST /api/audio-only/start` → Crée un meeting (type: audio-only)
2. Redirection vers `/meeting/audio-only/[id]`
3. Capture micro avec MediaRecorder
4. Transcription live via Web Speech API
5. Polling `/api/suggestions` toutes les 5s pour récupérer suggestions
6. `PATCH /api/audio-only/[id]` → Sauvegarde transcript + audio
7. `POST /api/summary` → Génération résumé final
8. Redirection vers `/summary/[id]`

## Flux Screen-share
1. `POST /api/screen-share/start` → Crée un meeting (type: screen-share)
2. Redirection vers `/meeting/screen-share/[id]`
3. Modal de sélection : "Micro seul" ou "Micro + onglet"
4. Capture avec getDisplayMedia + mixage audio via Web Audio API
5. Transcription live via Web Speech API
6. Polling `/api/suggestions` toutes les 5s
7. `PATCH /api/screen-share/[id]` → Sauvegarde
8. `POST /api/summary` → Génération résumé
9. Redirection vers `/summary/[id]`

## Flux Upload
1. Upload fichier via `/api/upload`
2. Redirection vers `/meeting/upload/[id]`
3. `POST /api/process-uploaded` → Lance transcription Whisper
4. Polling toutes les 3s pour vérifier status
5. Quand status = 'completed' → redirection automatique vers `/summary/[id]`


# Meeting Copilot

[ Démarrer un meeting ]
[ Uploader un enregistrement ]

### Écran 2 — Meeting en cours
+———————————————————––+
Transcription live (scrollable)
Speaker A : Bonjour à tous…
Speaker B : Commençons par le planning…
+———————————————————––+
> Micro : 🔴 On Air
+———————————————————––+
Panneau Suggestions
- Thèmes : [Planning] [Budget] [Marketing]
- Décisions : [Lancer la campagne en nov.]
- Actions : [Julien prépare le deck avant lundi]
  +———————————————————––+


### Écran 3 — Résumé
Résumé de la réunion
Thèmes :
•	Budget
•	Roadmap Q1

Décisions :
•	Lancer le projet le 1er novembre

Actions :
•	Julien → Préparer le deck (25/10)
•	Sarah → Planifier une démo client