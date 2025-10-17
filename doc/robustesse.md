# Conseils de robustesse JSON

	•	Toujours parse-server → si échec, retenter avec message système: “Ta dernière sortie n’était PAS un JSON valide. Renvoie UNIQUEMENT un JSON valide sans commentaire.”
	•	Limiter la taille des batchs (≤ ~2k tokens) en live.
	•	Normaliser les dates avec regex côté serveur si Claude renvoie du “25/10” → transformer en “YYYY-MM-DD” quand possible.


---

## 🏗️ ARCHITECTURE_DIAGRAMME.md

```markdown
# Architecture — Meeting Copilot (POC realtime + post)

## 0) Vue d’ensemble (ASCII)
Client (Next.js) ──WebRTC──▶ OpenAI Realtime
     │                               │
     │ (WS/polling /api/suggestions) │
     ▼                               │
Next.js API (Node) ◀───────────────┘
     │
     ├─▶ /api/suggestions  (Claude Sonnet: micro-batch → JSON LIVE)
     ├─▶ /api/summary      (Claude Sonnet: post-meeting → JSON FINAL)
     └─▶ Storage volatile (in-memory / tmp files)


+––––––––––+      WebRTC      +————————+
|  Browser (Next.js) | ─────────────────▶ OpenAI Realtime (LLM)  |
|  - Mic capture     |                  | - ASR + reasoning      |
|  - Live transcript | ◀────────────────┘ - Partial transcripts  |
|  - UI suggestions  |   text/events
+———▲–––––+
│ polling / WS
│
│  JSON LIVE/FNAL
+———┴–––––+
| Next.js API (Node) |
| - /api/realtime    |
| - /api/suggestions |
| - /api/summary     |
| - merge/dedupe     |
+––▲–––––┬––+
│          │
│Claude    │temp storage
│Sonnet    │(Map/FS)
▼          ▼
+––––––––––+
|  Anthropic API     |
|  (Sonnet)          |
+––––––––––+



## 1) Séquence — Live

1. **Client** ouvre `/meeting/:id` → demande micro.
2. **Client ↔ OpenAI Realtime** via **WebRTC**.
3. OpenAI envoie **partial transcripts** (événements texte).
4. **Client** append le texte localement (buffer de 5–10 s).
5. Toutes les 5 s, **Client** POST `/api/suggestions` avec:
   - meeting_id
   - transcript_delta (texte des N dernières secondes)
6. **API** appelle **Claude Sonnet** (prompt LIVE) → renvoie JSON.
7. **API** fusionne/dédoublonne l’état courant en mémoire.
8. **Client** rafraîchit le panneau “Suggestions”.

## 2) Séquence — Fin de réunion (post)

1. **Client** clique “Terminer”.
2. **Client** envoie transcript complet à **/api/summary**.
3. **API** appelle **Claude Sonnet** (prompt FINAL).
4. **API** renvoie JSON final (summary / actions / decisions / topics).
5. **Client** affiche `/summary/:id` (avec liens audio/quotes si timestamp).

## 3) Composants & responsabilités

- **Client Next.js**
  - Mic → WebRTC → OpenAI Realtime
  - UI Transcript (auto-scroll)
  - UI Suggestions (éditable, validable)
  - Stockage local minimal (localStorage) si refresh

- **Next.js API**
  - `/api/realtime`: init session (si tu fais aussi passer des tokens côté serveur)
  - `/api/suggestions`: 
     - reçoit `transcript_delta`
     - appelle Claude (prompt LIVE)
     - merge/dedupe state
     - renvoie JSON LIVE agrégé
  - `/api/summary`:
     - reçoit `transcript_full` + liste validée (optionnel)
     - appelle Claude (prompt FINAL)
     - renvoie JSON FINAL

- **OpenAI Realtime**
  - STT temps réel + événements texte
  - Très faible latence

- **Claude Sonnet**
  - Extraction sémantique live
  - Synthèse finale

## 4) États & erreurs

- **États meeting**: `idle` → `listening` → `analyzing` → `finalizing` → `archived`
- **Erreurs**:
  - WebRTC bloqué → fallback: upload WAV
  - JSON invalide de Claude → re-prompt “JSON ONLY” + validation/repair
  - Déconnexion Realtime → bouton “Reprendre”

## 5) Sécurité & config

- **.env**
  - `OPENAI_API_KEY=...`
  - `ANTHROPIC_API_KEY=...`
- **Jamais** exposer les clés au client.
- CORS: restreindre aux origines Vercel.
- Logs: minimaux, pas de données sensibles.

## 6) Déploiement (Vercel)

- Next.js (App Router)
- Edge pour les routes simples, Node pour les appels Claude (si besoin lib non-edge)
- Variables d’environnement dans Vercel Project Settings
- Feature flags:
  - `USE_WEBSOCKET_SUGGESTIONS=false` (MVP en polling)
  - `LANG_AUTO=true`

## 7) Évolution rapide

- Remplacer polling par **WebSocket** sur `/api/suggestions` (push server → client).
- Ajouter **export Markdown/PDF**.
- Indexer le transcript (pgvector) pour **Q&A** post-meeting.
- Intégrer **Google Calendar** pour proposer des créneaux de follow-ups.