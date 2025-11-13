# Granola.ai - Gap Analysis

*Dernière mise à jour : 13 novembre 2025*

Ce document analyse les fonctionnalités de Granola.ai et identifie les écarts avec Transcriptor.

## 🎯 Fonctionnalités principales de Granola.ai

### 1. **Capture Audio Intelligente**
- ✅ Capture audio directe de l'ordinateur (pas de bot visible dans le meeting)
- ✅ Support multi-plateformes : Google Meet, Slack, Teams, Webex, Zoom
- ⚠️ **Transcriptor** : capture micro seul ou micro + onglet (screen-share)

### 2. **Prise de Notes Hybride**
- ✅ L'utilisateur écrit des notes brutes PENDANT le meeting
- ✅ Après le meeting, l'IA restructure et améliore ces notes
- ✅ **Transcriptor** : éditeur de notes en temps réel avec Quill (IMPLÉMENTÉ)

### 3. **Templates Personnalisables**
- ✅ Templates par type de meeting :
  - Customer discovery calls
  - One-on-one discussions
  - Interviews
  - Pitches
  - Standups
- ✅ Sections structurées : key takeaways, next steps
- ❌ **Transcriptor** : format de résumé fixe (topics, decisions, actions)
- **GAP** : Besoin d'implémenter des templates personnalisables

### 4. **Chat IA / Query Post-Meeting**
- ✅ Possibilité de poser des questions sur le meeting :
  - "Compose un email de suivi"
  - "Extrait les action items"
  - "Quelles objections ont été soulevées ?"
  - "Résume le budget et timeline"
  - "Génère un blog post à partir du contenu"
  - "Extrait les détails de fundraising"
- ✅ **Transcriptor** : Chat IA interactif sur la page summary (IMPLÉMENTÉ)

### 5. **Intégrations**
- ✅ Export vers : Notion, Slack, HubSpot, Affinity, Zapier, Attio
- ❌ **Transcriptor** : pas d'intégrations
- **GAP** : Besoin d'implémenter des exports (au minimum PDF/Markdown)

### 6. **Organisation & Collaboration**
- ✅ Dossiers partagés
- ✅ Historique searchable
- ⚠️ **Transcriptor** : historique basique (liste des meetings)
- **GAP** : Système de dossiers manquant

### 7. **Mobile & Multi-Device**
- ✅ App iPhone dédiée
- ✅ Sync multi-devices
- ❌ **Transcriptor** : web uniquement
- **GAP** : Pas de mobile (future PWA possible)

### 8. **Support Multilingue**
- ✅ Support de plusieurs langues
- ⚠️ **Transcriptor** : probablement via Claude/Whisper mais pas explicite

---

## 📊 État actuel de Transcriptor

### ✅ Fonctionnalités déjà implémentées
1. **Éditeur de notes en temps réel** - Quill editor pendant le meeting
2. **Chat IA interactif** - Interface chat sur la page summary pour dialoguer avec le transcript
3. **3 modes de capture** :
   - Audio-only (micro seul)
   - Screen-share (micro + onglet)
   - Upload (fichier audio/vidéo)
4. **Transcription** :
   - En temps réel (Web Speech API)
   - Différée (Whisper pour upload)
5. **Suggestions live** - Topics, decisions, actions pendant le meeting
6. **Résumé IA** - Génération automatique après le meeting
7. **Édition du résumé** - Modification manuelle des sections
8. **Export basique** - Copier dans le presse-papier (Markdown)

### ❌ Fonctionnalités manquantes (priorités)

#### **Priority 1 : Organisation (2-3 semaines)**
1. **Templates de meeting** ⚠️ EN COURS
   - Templates pré-définis par type
   - Sections personnalisables
   - Application du template au résumé
   - Régénération à la demande

2. **Système de dossiers** ⚠️ EN COURS
   - Organisation en dossiers/folders
   - Déplacement de meetings entre dossiers
   - Vue hiérarchique
   - Filtres avancés

#### **Priority 2 : Export & Intégrations (2-3 semaines)**
3. **Export vers outils externes**
   - PDF (haute priorité)
   - Markdown download (haute priorité)
   - Notion (priorité moyenne)
   - Slack (priorité moyenne)
   - Email (priorité basse)

4. **Recherche globale**
   - Recherche full-text dans tous les meetings
   - Filtres par date, type, participants, dossier
   - Suggestions de recherche

#### **Priority 3 : Collaboration (3-4 semaines)**
5. **Partage & Collaboration**
   - Partage de meetings via lien
   - Partage de dossiers
   - Permissions (view/edit)
   - Commentaires sur le résumé

#### **Priority 4 : Mobile (future)**
6. **Multi-device**
   - Progressive Web App (PWA)
   - App mobile native (React Native ou Flutter)
   - Sync temps réel

---

## 🚀 Roadmap suggérée

### **Phase 1 : Organisation (2-3 semaines)** 🔥 PRIORITÉ
- [x] Explorer le code existant
- [ ] Système de templates
  - [ ] Modèle de données (Template entity)
  - [ ] CRUD des templates
  - [ ] Sélection du template à la génération
  - [ ] Régénération avec un autre template
  - [ ] Templates pré-définis (5 types)
- [ ] Système de dossiers
  - [ ] Modèle de données (Folder entity)
  - [ ] CRUD des dossiers
  - [ ] Association meeting <-> folder
  - [ ] Vue hiérarchique dans l'historique
  - [ ] Drag & drop pour déplacer

### **Phase 2 : Export (1-2 semaines)**
- [ ] Export PDF (react-pdf ou jsPDF)
- [ ] Export Markdown (download)
- [ ] Export JSON (pour intégrations futures)

### **Phase 3 : Recherche (1 semaine)**
- [ ] Endpoint de recherche full-text
- [ ] Interface de recherche
- [ ] Filtres avancés

### **Phase 4 : Intégrations (2-3 semaines)**
- [ ] Intégration Notion
- [ ] Intégration Slack (webhook)
- [ ] Zapier webhooks

### **Phase 5 : Mobile (future)**
- [ ] Progressive Web App (PWA)
- [ ] Manifest & Service Worker
- [ ] Native mobile app (si besoin)

---

## 📈 Métriques de succès

Pour être iso-fonctionnel avec Granola :

1. **Templates** : Au moins 5 templates pré-définis + possibilité d'en créer
2. **Dossiers** : Organisation hiérarchique des meetings
3. **Export** : PDF + Markdown minimum
4. **Recherche** : Full-text search dans tous les meetings
5. **Intégrations** : Au moins Notion + export manuel

---

## 💡 Différenciateurs potentiels de Transcriptor

Pour se démarquer de Granola, Transcriptor pourrait :

1. **Capture vidéo** : Support du screen recording (déjà partiellement implémenté)
2. **Modèles IA multiples** : Choix entre Claude, GPT-4, Gemini
3. **Pricing agressif** : Free tier plus généreux que Granola
4. **Open source** : Possibilité de self-host
5. **Webhooks** : Intégration avec n'importe quel outil via webhooks
6. **API publique** : Permettre aux développeurs d'intégrer Transcriptor

---

## 📝 Notes techniques

### Stack actuel de Transcriptor
- **Frontend** : Next.js 14 (App Router)
- **Backend** : Next.js API Routes
- **Database** : PostgreSQL (Prisma ORM)
- **Auth** : NextAuth.js
- **Storage** : Fichiers locaux (public/uploads)
- **IA** : Claude (Anthropic), Whisper (OpenAI)
- **Editor** : Quill 2.x

### Considérations pour l'implémentation

#### Templates
- Stocker les templates en DB (table `Template`)
- Format JSON pour la structure des templates
- Permettre la création de templates custom
- Templates pré-définis chargés au seed de la DB

#### Dossiers
- Relation many-to-one : Meeting -> Folder
- Folder peut contenir plusieurs meetings
- Possibilité de créer des sous-dossiers (hiérarchie)
- Filtrer l'historique par dossier

#### Export
- PDF : utiliser jsPDF ou react-pdf
- Markdown : générer le contenu et déclencher download
- S'assurer que les exports respectent le template sélectionné
