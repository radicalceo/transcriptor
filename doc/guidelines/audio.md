# Guide Gestion Audio

> **Objectif**: Standardiser la capture, le traitement et le stockage audio pour garantir qualité et compatibilité.

---

## 🎙️ Enregistrement Live

### MediaRecorder API

```typescript
// ✅ Setup de l'enregistrement
'use client'
import { useRef, useState } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async () => {
    try {
      // 1. Demander permission microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // 2. Détecter format supporté
      const mimeType = getSupportedMimeType()

      // 3. Créer MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      // 4. Collecter chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // 5. Démarrer avec chunks de 1s
      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

    } catch (error) {
      console.error('Error starting recording:', error)
      throw new Error('Failed to start recording')
    }
  }

  const stopRecording = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current

      if (!mediaRecorder) {
        reject(new Error('No active recording'))
        return
      }

      mediaRecorder.onstop = () => {
        // Créer blob final
        const audioBlob = new Blob(
          audioChunksRef.current,
          { type: mediaRecorder.mimeType }
        )

        // Cleanup
        streamRef.current?.getTracks().forEach(track => track.stop())
        audioChunksRef.current = []
        setIsRecording(false)

        resolve(audioBlob)
      }

      mediaRecorder.stop()
    })
  }

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioChunks: audioChunksRef.current
  }
}

// ✅ Détecter format supporté
function getSupportedMimeType(): string {
  const types = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return ''  // Fallback au format par défaut du navigateur
}
```

### Capture Audio Tab + Microphone

```typescript
// ✅ Mixer audio système + micro (pour calls)
export async function startMixedRecording() {
  try {
    // 1. Capture audio tab (partage d'écran)
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: false,
      audio: true
    })

    // 2. Capture microphone
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: true
    })

    // 3. Créer AudioContext pour mixer
    const audioContext = new AudioContext()

    // Sources
    const displaySource = audioContext.createMediaStreamSource(displayStream)
    const micSource = audioContext.createMediaStreamSource(micStream)

    // Destination (mixer)
    const destination = audioContext.createMediaStreamDestination()

    // Connecter
    displaySource.connect(destination)
    micSource.connect(destination)

    // 4. Stream mixé
    const mixedStream = destination.stream

    // 5. MediaRecorder sur stream mixé
    const mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: getSupportedMimeType()
    })

    return {
      mediaRecorder,
      streams: [displayStream, micStream],
      audioContext,
      cleanup: () => {
        displayStream.getTracks().forEach(t => t.stop())
        micStream.getTracks().forEach(t => t.stop())
        audioContext.close()
      }
    }

  } catch (error) {
    console.error('Error starting mixed recording:', error)
    throw error
  }
}
```

---

## 💾 Upload Progressif

### Chunked Upload

```typescript
// ✅ Upload par chunks de 30s
export function useChunkedUpload(meetingId: string) {
  const pendingChunksRef = useRef<Blob[]>([])
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startUploadTimer = () => {
    // Upload toutes les 30 secondes
    uploadIntervalRef.current = setInterval(async () => {
      await uploadPendingChunks()
    }, 30000)
  }

  const uploadPendingChunks = async () => {
    if (pendingChunksRef.current.length === 0) return

    const chunksToUpload = [...pendingChunksRef.current]
    pendingChunksRef.current = []

    try {
      // Créer blob combiné
      const audioBlob = new Blob(chunksToUpload, { type: 'audio/webm' })

      // Upload
      const formData = new FormData()
      formData.append('meetingId', meetingId)
      formData.append('audio', audioBlob, `chunk-${Date.now()}.webm`)

      await fetch('/api/meeting/save-audio', {
        method: 'POST',
        body: formData
      })

      console.log(`Uploaded ${chunksToUpload.length} chunks`)

    } catch (error) {
      console.error('Upload failed:', error)
      // Remettre dans la queue
      pendingChunksRef.current.unshift(...chunksToUpload)
    }
  }

  const addChunk = (chunk: Blob) => {
    pendingChunksRef.current.push(chunk)
  }

  const stopUpload = async () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current)
    }

    // Upload final des chunks restants
    await uploadPendingChunks()
  }

  return {
    startUploadTimer,
    addChunk,
    stopUpload
  }
}
```

---

## 📤 Upload de Fichiers

### Validation et Upload

```typescript
// ✅ Component upload avec validation
'use client'
import { useState } from 'react'

export default function AudioUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = async (file: File) => {
    // 1. Validation
    const validation = validateAudioFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    // 2. Upload avec progress
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('audio', file)

      const xhr = new XMLHttpRequest()

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 100)
        }
      })

      // Upload
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve()
          } else {
            reject(new Error('Upload failed'))
          }
        }

        xhr.onerror = () => reject(new Error('Network error'))

        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      alert('Upload successful!')

    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />

      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {progress.toFixed(0)}% uploaded
          </p>
        </div>
      )}
    </div>
  )
}

// ✅ Validation fichier
interface ValidationResult {
  valid: boolean
  error?: string
}

function validateAudioFile(file: File): ValidationResult {
  // Formats supportés
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/x-m4a'
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Format non supporté. Formats acceptés: MP3, MP4, WAV, WebM, OGG, M4A`
    }
  }

  // Taille max: 200 MB
  const maxSize = 200 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux (max 200 MB)`
    }
  }

  return { valid: true }
}
```

---

## ✂️ Chunking Audio (FFmpeg)

### Server-Side Chunking

```typescript
// lib/utils/audioChunker.ts
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'

interface ChunkResult {
  path: string
  startTime: number
  duration: number
}

interface ChunkOptions {
  chunkDurationMinutes?: number
  minChunkDuration?: number
}

// ✅ Découper fichier audio en chunks
export async function chunkAudioFile(
  inputPath: string,
  options: ChunkOptions = {}
): Promise<ChunkResult[]> {
  const {
    chunkDurationMinutes = 10,
    minChunkDuration = 30  // Minimum 30s par chunk
  } = options

  try {
    // 1. Obtenir durée totale
    const metadata = await getAudioMetadata(inputPath)
    const totalDuration = metadata.duration

    if (totalDuration <= chunkDurationMinutes * 60) {
      // Pas besoin de chunking
      return [{
        path: inputPath,
        startTime: 0,
        duration: totalDuration
      }]
    }

    // 2. Calculer chunks
    const chunkDuration = chunkDurationMinutes * 60
    const chunks: ChunkResult[] = []

    const tempDir = path.join(process.cwd(), 'data/temp')
    await fs.mkdir(tempDir, { recursive: true })

    // 3. Créer chunks
    for (let startTime = 0; startTime < totalDuration; startTime += chunkDuration) {
      const duration = Math.min(chunkDuration, totalDuration - startTime)

      // Skip si trop court
      if (duration < minChunkDuration) break

      const chunkPath = path.join(
        tempDir,
        `chunk_${startTime}_${Date.now()}.mp3`
      )

      await extractChunk(inputPath, chunkPath, startTime, duration)

      chunks.push({
        path: chunkPath,
        startTime,
        duration
      })
    }

    return chunks

  } catch (error) {
    console.error('Error chunking audio:', error)
    throw new Error('Failed to chunk audio file')
  }
}

// ✅ Extraire un segment
function extractChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run()
  })
}

// ✅ Métadonnées audio
interface AudioMetadata {
  duration: number
  format: string
  bitrate: number
}

function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error)
        return
      }

      resolve({
        duration: metadata.format.duration || 0,
        format: metadata.format.format_name || '',
        bitrate: metadata.format.bit_rate || 0
      })
    })
  })
}
```

---

## 🎧 Lecture Audio

### Player avec Contrôles

```typescript
// ✅ Component audio player
'use client'
import { useRef, useState } from 'react'

interface AudioPlayerProps {
  src: string
  onTimeUpdate?: (currentTime: number) => void
}

export default function AudioPlayer({ src, onTimeUpdate }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }

    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return

    setCurrentTime(audio.currentTime)
    onTimeUpdate?.(audio.currentTime)
  }

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return

    setDuration(audio.duration)
  }

  const seek = (time: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = time
    setCurrentTime(time)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-2">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <span className="text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}
```

---

## 📊 Formats Audio

### Formats Supportés

| Format | MIME Type | Navigateur | Transcription |
|--------|-----------|------------|---------------|
| MP3 | audio/mpeg | ✅ Tous | ✅ Whisper |
| MP4/M4A | audio/mp4 | ✅ Tous | ✅ Whisper |
| WAV | audio/wav | ✅ Desktop | ✅ Whisper |
| WebM | audio/webm | ✅ Chrome/FF | ✅ Whisper |
| OGG | audio/ogg | ✅ Chrome/FF | ✅ Whisper |

### Conversion de Format

```typescript
// ✅ Convertir en MP3 avec FFmpeg
export async function convertToMP3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioBitrate('128k')
      .audioChannels(1)  // Mono pour réduire taille
      .audioFrequency(44100)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run()
  })
}
```

---

## ✅ Checklist Audio

- [ ] Demander permission utilisateur avant capture
- [ ] Détecter format MIME supporté
- [ ] Cleanup des streams à l'arrêt
- [ ] Validation format et taille des uploads
- [ ] Chunking pour fichiers > 20MB
- [ ] Upload progressif toutes les 30s
- [ ] Conversion en format compatible si nécessaire
- [ ] Cleanup des fichiers temporaires
- [ ] Gestion d'erreurs microphone/permission

---

## 🚫 Anti-Patterns

### ❌ NE PAS FAIRE

```typescript
// ❌ Pas de vérification format
const recorder = new MediaRecorder(stream)

// ❌ Pas de cleanup
const stream = await getUserMedia({ audio: true })
// Stream jamais fermé → ressource

// ❌ Upload tout en mémoire
const blob = new Blob(allChunks)  // Peut être > 1GB
await uploadBlob(blob)

// ❌ Pas de validation
await handleUpload(file)  // N'importe quel fichier
```

### ✅ FAIRE

```typescript
// ✅ Vérifier format supporté
const mimeType = getSupportedMimeType()
const recorder = new MediaRecorder(stream, { mimeType })

// ✅ Cleanup systématique
useEffect(() => {
  return () => {
    stream?.getTracks().forEach(track => track.stop())
  }
}, [stream])

// ✅ Upload par chunks
await uploadChunks(chunks)  // Chunks de 30s

// ✅ Validation stricte
const validation = validateAudioFile(file)
if (!validation.valid) return
```

---

## 🔗 Références

- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
