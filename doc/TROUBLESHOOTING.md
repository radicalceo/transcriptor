# Troubleshooting Guide

## Transcription s'arrête après quelques secondes

### Symptôme
La transcription live fonctionne pendant quelques secondes puis s'arrête, même si vous continuez à parler.

### Cause
Le Web Speech API utilisé pour la transcription en temps réel a des limitations :
- **Timeout de silence** : Si aucun son n'est détecté pendant ~10 secondes, l'API s'arrête
- **Limite de durée** : Certains navigateurs arrêtent l'API après 60-90 secondes
- **Erreur "no-speech"** : Déclenchée quand aucun son n'est détecté

### Solution automatique
Le code redémarre automatiquement la reconnaissance vocale quand elle s'arrête (voir logs dans la console).

### Vérifications
1. **Ouvrir la console du navigateur** (F12) et vérifier les logs :
   - `🔄 Speech recognition stopped unexpectedly, restarting...` → Le système redémarre automatiquement
   - `⏸️ No speech detected, will auto-restart via onend` → Pas de son détecté
   - `❌ Speech recognition error: network` → Problème de connexion

2. **Vérifier le microphone** :
   - Le navigateur a bien accès au micro (pas d'erreur de permission)
   - Le micro n'est pas en mute
   - Le niveau audio est suffisant

3. **Navigateur supporté** :
   - ✅ Chrome/Edge (recommandé)
   - ✅ Safari (support partiel)
   - ❌ Firefox (pas de support Web Speech API)

### Contournement
Si la transcription ne fonctionne pas :
1. **Enregistrer uniquement l'audio** : L'audio est sauvegardé même si la transcription échoue
2. **Utiliser l'upload** : Uploader un fichier audio après la réunion
   - Support : MP3, WAV, M4A, WebM
   - Transcription automatique via Whisper API

## Téléchargement audio ne fonctionne pas

### Symptôme
Le bouton de téléchargement audio ne fonctionne pas ou télécharge un fichier JSON avec une erreur.

### Cause
- **Production (Vercel)** : Les fichiers sont maintenant stockés dans Vercel Blob Storage (URLs)
- **Ancienne version** : Le code essayait de lire depuis le système de fichiers local

### Solution
La route de download a été mise à jour pour gérer les deux cas :
- **Vercel Blob** : Redirige vers l'URL du blob
- **Fichier local** : Lit depuis le système de fichiers (dev only)

### Vérification
1. Vérifier dans les logs Vercel :
   ```
   🔗 Redirecting to Blob Storage URL: https://...
   ```

2. Si erreur "Audio file not found" :
   - Vérifier que `BLOB_READ_WRITE_TOKEN` est configuré
   - Vérifier que le Blob Store est créé et connecté au projet

## Erreurs de génération de summary

### Symptôme
```
Error: require() of ES Module .../jsdom/... not supported
```

### Cause
Conflit entre modules ESM et CommonJS avec `jsdom` (dépendance de `isomorphic-dompurify`).

### Solution
✅ **Corrigé** : Le code a été migré vers `dompurify` (sans jsdom)
- Sanitization côté serveur : désactivée (HTML déjà échappé)
- Sanitization côté client : utilise DOMPurify natif du browser

### Vérification
```bash
npm list jsdom
# Devrait retourner : (empty)
```

## Erreurs Vercel Blob Storage

### Symptôme
```
Error saving audio: ENOENT: no such file or directory, open '/var/task/data/uploads/...'
```

### Cause
Le système de fichiers sur Vercel est read-only (sauf `/tmp`).

### Solution
✅ **Corrigé** : Migration vers Vercel Blob Storage
- Les fichiers audio sont uploadés directement vers Blob
- URLs publiques générées automatiquement

### Configuration requise
1. Créer un Blob Store dans Vercel :
   - Dashboard → Storage → Create Blob Store
   - Le connecter au projet
2. La variable `BLOB_READ_WRITE_TOKEN` sera auto-configurée

## Logs utiles

### Console navigateur (F12)
```
🎙️ Microphone stream obtained
🖥️ Tab stream obtained
🔊 Speech recognition error: no-speech
🏁 Speech recognition ended
🔄 Speech recognition stopped unexpectedly, restarting...
```

### Logs Vercel
```
📝 Uploading audio chunk for meeting xxx
✅ Audio uploaded to Blob Storage: https://...
🔄 Starting async summary generation for meeting xxx
✅ Async summary generation completed for meeting xxx
```

## Support

Pour obtenir de l'aide :
1. Consulter les logs (console + Vercel)
2. Vérifier les variables d'environnement
3. Ouvrir une issue sur GitHub avec les logs pertinents
