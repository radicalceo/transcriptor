See also documentation in [docs](/doc/).
Avant tout développement, assures toi de bien respecter les guidelines techniques.

Architecture générale

1. Client (Next.js)
   •	Gère l’enregistrement audio avec MediaRecorder et l’envoi via WebRTC.
   •	Affiche la transcription en live.
   •	Appelle /api/suggestions toutes les 5s pour récupérer les suggestions (polling simple au MVP).
   •	À la fin de la réunion, appelle /api/summary pour lancer la génération finale.

2. Serveur (Next.js API Routes)
   •	/api/realtime → init session WebRTC avec OpenAI Realtime
   •	/api/suggestions →
   •	Récupère la transcription courante
   •	Appelle Claude pour extraire thèmes / décisions / actions (prompt optimisé)
   •	/api/summary →
   •	Appelle Claude pour produire le résumé complet final
   •	Renvoie JSON structuré


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
transcript: string[];
suggestions: {
topics: string[];
decisions: string[];
actions: { text: string; assignee?: string; due_date?: string }[];
};
summary?: {
summary: string;
topics: string[];
decisions: { text: string }[];
actions: { text: string; assignee?: string; due_date?: string }[];
};
}

# Flux global

	1.	/meeting/start → Crée une session (UUID)
	2.	WebRTC → streaming audio vers OpenAI Realtime
	3.	WebSocket → reçoit texte partiel
	4.	Texte → concaténé localement → suggestions via Claude
	5.	/meeting/end → envoie transcript complet → Claude résumé final
	6.	/summary/:id → affiche le résultat


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