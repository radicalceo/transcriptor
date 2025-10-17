# Spécification Technique — Meeting Copilot (POC)

## 🧱 Stack
- **Frontend** : Next.js 15 (App Router) + TypeScript + TailwindCSS
- **Backend** : API Routes Next.js (Edge Functions / Node runtime)
- **Realtime** : WebRTC + OpenAI Realtime API
- **LLM secondaire** : Claude Sonnet (pour structuration & résumé)
- **Stockage temporaire** :
    - Transcription → mémoire (Map en Node.js)
    - Résumé → fichier JSON temporaire
- **Déploiement** : Vercel
- **Langue** : Français/Anglais détecté automatiquement

---

## 🔌 APIs et intégrations

### OpenAI Realtime API
- Entrée : flux audio (WebRTC)
- Sortie :
    - Transcription live
    - Événements JSON `partial_transcript`
- Configuration :
    - modèle : `gpt-4o-realtime-preview`
    - paramètres : `voice=none`, `response_format=json`

### Claude API (Anthropic Sonnet)
- Entrée : texte complet du transcript
- Sortie : résumé JSON structuré :
  ```json
  {
    "topics": ["string"],
    "decisions": [{"text": "string"}],
    "actions": [{"text": "string", "assignee": "string?", "due_date": "string?"}],
    "summary": "string"
  }