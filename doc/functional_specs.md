# Spécification Fonctionnelle — Meeting Copilot (POC)

## 🎯 Objectif
Développer une application web temps réel capable :
1. D’enregistrer l’audio d’un meeting (micro ou upload fichier).
2. De transcrire en direct la conversation.
3. D’analyser le flux pour détecter et suggérer en live :
    - Les **thèmes abordés**
    - Les **décisions prises**
    - Les **actions à suivre / follow-ups**
4. D’afficher ces suggestions dynamiquement dans une UI modifiable.
5. De générer un **résumé complet post-meeting**, enrichi avec :
    - Les extraits audio liés aux moments clés
    - Les actions finales validées
    - Les décisions principales
6. De permettre l’accès au résumé et à l’audio après coup.

Ce POC doit être testable rapidement (moins de 10 minutes de setup), fonctionnel seul, et hébergeable sur **Vercel**.

---

## 👤 Utilisateur cible
Managers, dirigeants ou équipes souhaitant capturer, structurer et suivre leurs réunions sans saisie manuelle.

---

## 🪶 Expérience utilisateur (MVP)

### 1. Page principale `/`
- Bouton **"Démarrer un meeting"**
- Option **"Uploader un enregistrement"** (fichier `.mp3` / `.wav`)

### 2. Page Meeting `/meeting/:id`
- Vue principale :
    - Panneau **Transcription live** (texte qui s’affiche en temps réel)
    - Panneau latéral **Suggestions IA** :
        - Liste des **Thèmes détectés**
        - Liste des **Décisions**
        - Liste des **Actions / Follow-ups**
    - Chaque élément est :
        - Éditable inline (texte libre)
        - Supprimable
        - Marquable comme “Validé”
- Indicateur d’état : “Écoute active / en pause / en traitement final”
- Bouton “Terminer le meeting”

### 3. Page Résumé `/summary/:id`
- Résumé complet (généré 1 à 2 minutes après la fin du meeting) :
    - Synthèse textuelle claire, structurée.
    - Sections :
        - **Thèmes abordés**
        - **Décisions**
        - **Actions** (avec assigné/due date si détecté)
    - Lien vers les extraits audio (timestamps)
    - Export possible : Markdown / Copie / PDF (facultatif MVP)

---

## ⚙️ Parcours utilisateur simplifié
1. L’utilisateur lance un meeting.
2. L’app capte le micro (via WebRTC).
3. La transcription s’affiche en live.
4. L’IA génère et met à jour les suggestions en parallèle.
5. À la fin, un job asynchrone génère le résumé complet.
6. L’utilisateur peut revenir consulter le résumé et l’audio.

---

## 🧩 Contraintes
- MVP **single-user**, pas de compte.
- Aucune donnée persistée durablement (stockage temporaire en mémoire / localStorage).
- Support navigateur Chrome/Edge uniquement.
- Pas d’authentification requise (clé API côté serveur).

---

## ✅ Critères de succès POC
- Latence transcription < 2 secondes
- Suggestions visibles et modifiables pendant la réunion
- Résumé final cohérent avec le contenu audio
- Déploiement possible sur Vercel sans config complexe