# Upload Feature - Documentation

## 🎯 Fonctionnalité

L'application supporte maintenant l'upload de fichiers audio pour transcription et analyse automatique.

## 🚀 Utilisation

### 1. Accéder à la page d'upload

Depuis la page d'accueil, cliquez sur **"Uploader un enregistrement"**

Ou accédez directement à : http://localhost:3000/upload

### 2. Sélectionner un fichier

**Méthode 1 : Drag & Drop**
- Glissez-déposez votre fichier audio dans la zone prévue

**Méthode 2 : Sélection**
- Cliquez sur "Parcourir les fichiers"
- Sélectionnez votre fichier audio

### 3. Formats supportés

- **MP3** (.mp3)
- **MP4** (.mp4)
- **MPEG** (.mpeg, .mpga)
- **M4A** (.m4a)
- **WAV** (.wav)
- **WebM** (.webm)

**Limite de taille** : 25 MB (limite de l'API OpenAI Whisper)

### 4. Traitement

Une fois le fichier uploadé :

1. **Transcription** : Whisper transcrit l'audio (temps réel approximatif)
2. **Analyse** : Claude analyse la transcription et extrait :
   - Thèmes abordés
   - Décisions prises
   - Actions à suivre
3. **Redirection** : Vous êtes redirigé vers la page du meeting avec les résultats

## ⚙️ Configuration Requise

### API Keys

Ajoutez dans votre `.env.local` :

```env
# OpenAI API Key (obligatoire pour l'upload)
OPENAI_API_KEY=sk-...

# Anthropic API Key (obligatoire pour l'analyse)
ANTHROPIC_API_KEY=sk-ant-...
```

### Obtenir les clés API

**OpenAI** : https://platform.openai.com/api-keys
- Créez un compte
- Naviguez vers "API Keys"
- Créez une nouvelle clé
- **Note** : Nécessite des crédits (pay-as-you-go)

**Anthropic** : https://console.anthropic.com/
- Créez un compte
- Naviguez vers "API Keys"
- Créez une nouvelle clé

## 🔧 Architecture Technique

### Flow de traitement

```
User Upload → API Route → Temp Storage → Whisper API
                                              ↓
                                         Transcription
                                              ↓
                                         Claude Analysis
                                              ↓
                                         Meeting Store
                                              ↓
                                         Redirect to Meeting
```

### Fichiers créés

- `app/upload/page.tsx` - Page UI avec drag & drop
- `app/api/upload/route.ts` - API route pour l'upload
- `lib/services/whisperService.ts` - Service Whisper

### Stockage temporaire

Les fichiers audio sont stockés temporairement dans `/tmp` pendant le traitement, puis supprimés automatiquement après transcription.

**Important** : Les fichiers ne sont pas persistés. Pour une solution production, utilisez :
- AWS S3 / Google Cloud Storage
- Job queue (Bull, BullMQ) pour traitement asynchrone
- Base de données pour historique

## ⏱️ Temps de traitement

Le temps de traitement dépend de la durée de l'audio :

- **1 min d'audio** ≈ 30-60s de traitement
- **5 min d'audio** ≈ 2-4 min de traitement
- **10 min d'audio** ≈ 5-8 min de traitement

L'API Whisper traite approximativement en temps réel.

## 💰 Coûts

### OpenAI Whisper

**Prix** : $0.006 par minute d'audio

Exemples :
- 10 minutes → $0.06
- 1 heure → $0.36
- 10 heures → $3.60

### Anthropic Claude

**Prix** : ~$3 par million de tokens (input)

Une transcription de 1h ≈ 10k tokens ≈ $0.03

**Total pour 1h d'audio** : ~$0.40

## 🐛 Debugging

### Upload échoue

1. **Vérifier la clé API OpenAI**
```bash
node scripts/test-api-key.js
```

2. **Vérifier les logs serveur**
Regardez la console où tourne `npm run dev`

3. **Erreur de quota**
```
Error: insufficient_quota
```
→ Ajoutez des crédits sur https://platform.openai.com/account/billing

### Transcription incomplète

- Vérifiez la qualité audio (pas trop de bruit de fond)
- Assurez-vous que la langue est correcte (défaut: français)
- Pour changer la langue, modifiez `whisperService.ts:18`

### Analyse Claude manquante

Si la transcription fonctionne mais pas l'analyse :
1. Vérifiez ANTHROPIC_API_KEY
2. Regardez les logs : "Analyzing transcript with Claude..."
3. Vérifiez que la transcription > 100 caractères

## 🧪 Test avec un fichier sample

Pour tester, vous pouvez :

1. **Enregistrer votre voix** avec QuickTime / Voice Memos
2. **Utiliser un fichier de test** :
   - https://www2.cs.uic.edu/~i101/SoundFiles/ (samples WAV)
   - Enregistrez une courte phrase avec votre micro

3. **Tester l'upload** :
   - Uploadez le fichier
   - Vérifiez les logs
   - Attendez la redirection

## 📊 Limitations MVP

- ❌ Pas de diarisation (distinction speakers)
- ❌ Pas de timestamps précis dans l'UI
- ❌ Pas de progress bar pendant transcription
- ❌ Pas de stockage permanent des fichiers
- ❌ Pas de réessai en cas d'échec
- ❌ Un seul fichier à la fois

## 🔜 Améliorations Futures

- [ ] Progress bar avec estimation temps restant
- [ ] Diarisation avec Whisper large-v3
- [ ] Stockage permanent (S3)
- [ ] Job queue pour traitement asynchrone
- [ ] Support fichiers > 25 MB (chunking)
- [ ] Batch upload (plusieurs fichiers)
- [ ] Preview audio avant upload
- [ ] Édition de la transcription

## 🔐 Sécurité

### Production

Pour la production, ajoutez :
- **Rate limiting** sur `/api/upload`
- **Validation fichier** côté serveur (magic numbers)
- **Scan antivirus** des fichiers
- **Authentification** utilisateur
- **Quotas** par utilisateur

### Exemple rate limiting (Next.js middleware)

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  // Implement rate limiting here
  // Ex: Redis + Upstash Rate Limit
}

export const config = {
  matcher: '/api/upload',
}
```

## 📝 Exemple d'utilisation

```typescript
// Upload programmatique
const file = document.querySelector('input[type="file"]').files[0]
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
})

const { success, meetingId } = await response.json()

if (success) {
  window.location.href = `/meeting/${meetingId}`
}
```

---

**Status** : ✅ Fonctionnalité complète et testable
**Version** : 0.2.0
**Date** : 16 octobre 2025
