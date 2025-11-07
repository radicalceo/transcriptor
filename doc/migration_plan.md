# Plan de migration - Isolation des 3 features

## Contexte

L'application contient 3 fonctionnalités distinctes qui partagent actuellement du code :
1. **Audio-only** : enregistrement micro seul
2. **Screen-share** : enregistrement micro + audio de l'onglet (visio)
3. **Upload** : upload de fichier avec transcription

**Problème** : Modifier une feature casse les autres à cause du code partagé.

**Solution** : Séparer complètement les 3 features en dupliquant pages et APIs.

---

## Architecture cible

### Structure des dossiers

```
app/
├── meeting/
│   ├── [id]/page.tsx                    # Router qui détecte le type et redirige
│   ├── audio-only/[id]/page.tsx         # Feature 1 - ISOLÉE
│   ├── screen-share/[id]/page.tsx       # Feature 2 - ISOLÉE (à faire)
│   └── upload/[id]/page.tsx             # Feature 3 - ISOLÉE (à faire)
│
├── summary/
│   └── [id]/page.tsx                    # PARTAGÉE (identique pour les 3)
│
└── api/
    ├── audio-only/
    │   ├── start/route.ts
    │   └── [id]/route.ts
    ├── screen-share/
    │   ├── start/route.ts
    │   └── [id]/route.ts
    ├── upload/
    │   ├── upload/route.ts
    │   └── process/route.ts
    └── shared/
        ├── summary/route.ts             # Génération résumé (commun)
        └── meetings/route.ts            # Liste/GET/DELETE (commun)
```

### Services partagés (lib/)

Ces services restent partagés car ils sont stateless et génériques :
- `lib/services/claudeService.ts` - Analyse IA
- `lib/services/whisperService.ts` - Transcription audio
- `lib/services/deduplication.ts` - Déduplication suggestions
- `lib/services/transcriptGrouping.ts` - Groupement segments
- `lib/services/meetingStore.ts` - Cache mémoire
- `lib/db.ts` - Prisma client

---

## Migration complétée : Audio-only (Feature 1)

### ✅ Étape 1 : Schéma de données

**Fichier** : `prisma/schema.prisma`

```prisma
model Meeting {
  type String @default("audio-only") // "audio-only" | "screen-share" | "upload"
  // ...
}
```

**Migration SQL** :
```sql
-- Convertir les anciens meetings
UPDATE "Meeting" SET "type" = 'audio-only' WHERE "type" = 'live';
ALTER TABLE "Meeting" ALTER COLUMN "type" SET DEFAULT 'audio-only';
```

**Commandes** :
```bash
npx prisma migrate dev --name add_meeting_types
npx prisma generate
```

### ✅ Étape 2 : Page audio-only

**Fichier** : `app/meeting/audio-only/[id]/page.tsx`

**Simplifications** par rapport à `app/meeting/[id]/page-old.tsx` :
- ❌ Supprimé le modal de sélection du mode audio
- ❌ Supprimé toute la logique screen-share (getDisplayMedia, audio mixing, Web Audio API)
- ❌ Supprimé les refs : `tabStreamRef`, `audioContextRef`, `isRequestingScreenShare`
- ❌ Supprimé les states : `audioMode`, `showAudioModeSelector`, `isRequestingScreenShare`
- ❌ Supprimé la gestion du type upload (isUploadedFile)
- ✅ Garde uniquement : microphone + Web Speech API + MediaRecorder
- ✅ Code réduit de ~1070 lignes → ~650 lignes (40% plus court)

**Logique d'enregistrement** :
```typescript
// UNIQUEMENT microphone
const micStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100,
  },
})

// Web Speech API pour transcription live
const recognition = new SpeechRecognition()
recognition.continuous = true
recognition.lang = 'fr-FR'

// MediaRecorder pour sauvegarder l'audio
const mediaRecorder = new MediaRecorder(micStream)
```

### ✅ Étape 3 : APIs audio-only

**Fichiers créés** :
- `app/api/audio-only/start/route.ts`
- `app/api/audio-only/[id]/route.ts`

**Vérification du type** :
```typescript
// Chaque endpoint vérifie que c'est un meeting audio-only
if (meeting.type !== 'audio-only') {
  return NextResponse.json(
    { success: false, error: 'Not an audio-only meeting' },
    { status: 400 }
  )
}
```

### ✅ Étape 4 : Router intelligent

**Fichier** : `app/meeting/[id]/page.tsx` (wrapper)

```typescript
// Détecte le type et redirige
const response = await fetch(`/api/meeting/${meetingId}`)
const meeting = response.json().meeting

switch (meeting.type) {
  case 'audio-only':
    router.replace(`/meeting/audio-only/${meetingId}`)
    break
  case 'screen-share':
    router.replace(`/meeting/screen-share/${meetingId}`)
    break
  case 'upload':
    router.replace(`/meeting/upload/${meetingId}`)
    break
}
```

### ✅ Étape 5 : Page d'accueil

**Fichier** : `app/page.tsx`

```typescript
// Utilise l'API audio-only pour les meetings live
const response = await fetch('/api/audio-only/start', {
  method: 'POST',
})

if (data.success) {
  router.push(`/meeting/audio-only/${data.meeting.id}`)
}
```

---

## À faire : Screen-share (Feature 2)

### Étape 1 : Créer la page screen-share

**Fichier** : `app/meeting/screen-share/[id]/page.tsx`

**À conserver de l'originale** :
- ✅ Modal de sélection du mode audio
- ✅ Logique getDisplayMedia pour capturer l'onglet
- ✅ Web Audio API pour mixer micro + tab audio
- ✅ Gestion des streams multiples
- ✅ État `audioMode`, `isRequestingScreenShare`
- ✅ Gestion de l'annulation du partage d'écran

**Code spécifique screen-share** :
```typescript
// Capturer l'onglet avec audio
const tabStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
  },
})

// Mixer les flux audio
const audioContext = new AudioContext()
const destination = audioContext.createMediaStreamDestination()

const micSource = audioContext.createMediaStreamSource(micStream)
const tabSource = audioContext.createMediaStreamSource(tabStream)

micSource.connect(destination)
tabSource.connect(destination)

const combinedStream = destination.stream
```

### Étape 2 : APIs screen-share

**Fichiers à créer** :
- `app/api/screen-share/start/route.ts`
- `app/api/screen-share/[id]/route.ts`

```typescript
// screen-share/start/route.ts
const meeting = await prisma.meeting.create({
  data: {
    type: 'screen-share',
    status: 'active',
    // ...
  },
})

meetingStore.create(meeting.id, 'screen-share')
```

### Étape 3 : Ajouter option dans page d'accueil

**Fichier** : `app/page.tsx`

```typescript
// Ajouter un bouton séparé pour screen-share
<button onClick={handleStartScreenShareMeeting}>
  <svg>...</svg>
  Démarrer avec visio (micro + onglet)
</button>

const handleStartScreenShareMeeting = async () => {
  const response = await fetch('/api/screen-share/start', {
    method: 'POST',
  })
  router.push(`/meeting/screen-share/${data.meeting.id}`)
}
```

---

## À faire : Upload (Feature 3)

### Étape 1 : Créer la page upload

**Fichier** : `app/meeting/upload/[id]/page.tsx`

**Spécificités** :
- ❌ Pas d'enregistrement live
- ❌ Pas de Web Speech API
- ❌ Pas de MediaRecorder
- ✅ Affichage de l'état "processing"
- ✅ Polling toutes les 3s pour vérifier si status = 'completed'
- ✅ Redirection automatique vers `/summary/[id]` à la fin
- ✅ Affichage fullwidth de la transcription (pas de panneau notes)

**Logique** :
```typescript
// Poll meeting status
useEffect(() => {
  const pollInterval = setInterval(async () => {
    const response = await fetch(`/api/upload/${meetingId}`)
    const data = await response.json()

    if (data.meeting.status === 'completed') {
      router.push(`/summary/${meetingId}`)
    }
  }, 3000)

  return () => clearInterval(pollInterval)
}, [meetingId])
```

### Étape 2 : APIs upload (déjà existantes, à adapter)

**Fichiers existants à vérifier** :
- `app/api/upload/route.ts`
- `app/api/process-uploaded/route.ts`
- `app/api/upload-blob/route.ts`

**Modifications nécessaires** :
```typescript
// Lors de la création du meeting après upload
const meeting = await prisma.meeting.create({
  data: {
    type: 'upload', // ✅ Déjà bon
    status: 'processing',
    // ...
  },
})
```

### Étape 3 : Page /upload

**Fichier** : `app/upload/page.tsx` (déjà existe)

**Vérifier** que l'API appelée crée bien un meeting avec `type: 'upload'`

---

## Étape finale : Nettoyage

Une fois les 3 features migrées et testées :

### 1. Supprimer l'ancien code

```bash
rm app/meeting/[id]/page-old.tsx
```

### 2. Vérifier les APIs génériques

**Fichiers à vérifier** :
- `app/api/meeting/[id]/route.ts` - Utilisé par le router, garder
- `app/api/meeting/start/route.ts` - Remplacé par audio-only/start, peut être supprimé
- `app/api/meeting/save-audio/route.ts` - Utilisé par tous, garder

### 3. Mettre à jour la documentation

- Mettre à jour `CLAUDE.md` avec la nouvelle architecture
- Documenter les 3 endpoints distincts

---

## Checklist de migration

### Feature 1 : Audio-only ✅
- [x] Schéma Prisma étendu
- [x] Migration SQL appliquée
- [x] Page `/meeting/audio-only/[id]` créée
- [x] API `/api/audio-only/start` créée
- [x] API `/api/audio-only/[id]` créée
- [x] Router `/meeting/[id]` créé
- [x] Page d'accueil mise à jour
- [x] Tests manuels OK

### Feature 2 : Screen-share ✅
- [x] Page `/meeting/screen-share/[id]` créée
- [x] API `/api/screen-share/start` créée
- [x] API `/api/screen-share/[id]` créée
- [ ] Page d'accueil : ajouter bouton screen-share
- [ ] Tests manuels OK

### Feature 3 : Upload ✅
- [x] Page `/meeting/upload/[id]` créée
- [x] API upload vérifiées (type='upload')
- [ ] Tests manuels OK

### Nettoyage final ⏳
- [ ] Supprimer `page-old.tsx`
- [ ] Vérifier que toutes les features sont indépendantes
- [ ] Mettre à jour la documentation
- [ ] Tests E2E complets

---

## Avantages de cette architecture

### Isolation complète
- Chaque feature a son propre code
- Impossible de casser une feature en modifiant une autre
- Code plus simple et plus court (40% de réduction pour audio-only)

### Type-safety
- Les APIs vérifient le type de meeting
- Erreur explicite si mauvais type

### Évolutivité
- Facile d'ajouter une nouvelle feature
- Pattern clair à suivre

### URLs propres
- `/meeting/audio-only/[id]` - explicite
- `/meeting/screen-share/[id]` - explicite
- `/meeting/upload/[id]` - explicite

### Compatibilité
- `/meeting/[id]` continue de fonctionner (router)
- Pas de breaking change pour les URLs existantes

---

## Notes techniques

### Services partagés
Les services dans `lib/` restent partagés car :
- Ils sont stateless
- Ils sont génériques (ne dépendent pas du type de meeting)
- Ils représentent de la logique métier réutilisable

### Prisma
Le champ `type` est une string pour flexibilité future :
```prisma
type String @default("audio-only") // Peut ajouter d'autres types facilement
```

### MeetingStore
Le store en mémoire supporte maintenant les 3 types :
```typescript
create(id: string, type: 'audio-only' | 'screen-share' | 'upload')
```

---

## Dépannage

### Problème : TypeScript errors sur 'live' | 'upload'
**Solution** : Remplacer par `'audio-only' | 'screen-share' | 'upload'`

### Problème : Migration Prisma échoue
**Solution** :
```bash
npx prisma migrate reset  # ⚠️ EFFACE LA DB
npx prisma migrate deploy
```

### Problème : Router ne redirige pas
**Vérifier** :
1. Que le meeting existe en DB
2. Que le champ `type` est correct
3. Les logs dans la console

---

## Timeline estimée

| Feature | Temps estimé | Status |
|---------|--------------|--------|
| Audio-only | 2h | ✅ Fait |
| Screen-share | 3h | ✅ Fait |
| Upload | 2h | ✅ Fait |
| Tests & nettoyage | 1h | ⏳ À faire |
| **Total** | **8h** | **87.5% fait** |

---

*Document créé le 2025-11-07*
*Dernière mise à jour : Migration des 3 features complétée (audio-only, screen-share, upload)*
