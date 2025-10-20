import OpenAI from 'openai'
import { createReadStream, readFileSync } from 'fs'
import type { TranscriptSegment } from '@/lib/types'
import { splitAudioFile, needsChunking } from '@/lib/utils/audioChunker'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { tmpdir } from 'os'

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not set - audio upload will not work')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Fusionne les segments incomplets qui devraient être regroupés
 * Détecte les segments sans ponctuation de fin et les fusionne avec le suivant
 */
function mergeIncompleteSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return []

  const merged: TranscriptSegment[] = []
  let currentSegment = { ...segments[0] }
  let lastSegmentTimestamp = segments[0].timestamp // Track le timestamp du dernier segment fusionné

  for (let i = 1; i < segments.length; i++) {
    const prevText = currentSegment.text.trim()
    const nextSegment = segments[i]
    const nextText = nextSegment.text.trim()
    const timeDiff = nextSegment.timestamp - lastSegmentTimestamp // Utiliser le dernier timestamp

    // Détection de segment incomplet :
    const endsWithStrongPunctuation = /[.!?]$/.test(prevText)
    const nextStartsLowercase = /^[a-zàâäéèêëïîôùûüÿœæç]/.test(nextText)

    // Cas 1: Le segment suivant commence par une minuscule -> TOUJOURS fusionner (continuation évidente)
    // sauf si le délai est vraiment énorme (> 5s = pause significative)
    if (nextStartsLowercase && timeDiff < 5) {
      currentSegment.text += ' ' + nextSegment.text
      lastSegmentTimestamp = nextSegment.timestamp
      continue
    }

    // Cas 2: Le segment actuel se termine sans ponctuation forte -> fusionner si délai raisonnable
    // Pour les segments incomplets, on accepte des pauses modérées (jusqu'à 4s)
    if (!endsWithStrongPunctuation && timeDiff < 4) {
      currentSegment.text += ' ' + nextSegment.text
      lastSegmentTimestamp = nextSegment.timestamp
      continue
    }

    // Cas 3: Pause très courte (< 1s) -> fusionner même avec ponctuation
    if (timeDiff < 1) {
      currentSegment.text += ' ' + nextSegment.text
      lastSegmentTimestamp = nextSegment.timestamp
      continue
    }

    // Sinon, créer un nouveau segment
    merged.push(currentSegment)
    currentSegment = { ...nextSegment }
    lastSegmentTimestamp = nextSegment.timestamp
  }

  // Ajouter le dernier segment
  merged.push(currentSegment)

  console.log(`🔄 Merged ${segments.length} segments into ${merged.length} segments`)
  return merged
}

/**
 * Transcrit un chunk individuel avec Whisper
 */
async function transcribeChunk(
  chunkBuffer: Buffer,
  language: string = 'fr',
  chunkIndex: number,
  extension: string = 'mp3'
): Promise<TranscriptSegment[]> {
  const tempPath = path.join(tmpdir(), `chunk-${Date.now()}-${chunkIndex}.${extension}`)

  try {
    // Écrire le buffer dans un fichier temporaire
    await writeFile(tempPath, chunkBuffer)

    // Créer un stream du fichier
    const audioStream = createReadStream(tempPath) as any

    // Appeler l'API Whisper
    const timeoutMs = 10 * 60 * 1000
    const response = await Promise.race([
      openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Whisper API timeout after 10 minutes')),
          timeoutMs
        )
      ),
    ])

    // Convertir les segments Whisper en notre format
    const segments: TranscriptSegment[] = []

    if (response.segments) {
      for (const segment of response.segments) {
        segments.push({
          text: segment.text.trim(),
          timestamp: segment.start,
          speaker: undefined,
        })
      }
    } else {
      segments.push({
        text: response.text || '',
        timestamp: 0,
        speaker: undefined,
      })
    }

    return segments
  } finally {
    // Nettoyer le fichier temporaire
    try {
      await unlink(tempPath)
    } catch (error) {
      console.warn(`Failed to clean up temp file: ${tempPath}`)
    }
  }
}

/**
 * Transcrit un fichier audio avec Whisper
 * Gère automatiquement le découpage pour les fichiers > 20MB
 * Retourne les segments de transcription avec timestamps
 */
export async function transcribeAudio(
  filePath: string,
  language: string = 'fr'
): Promise<TranscriptSegment[]> {
  try {
    console.log(`📝 Transcribing audio file: ${filePath}`)

    // Lire le fichier pour vérifier sa taille
    const fileBuffer = readFileSync(filePath)
    const fileSizeMB = fileBuffer.length / (1024 * 1024)
    const maxChunkSize = 20 * 1024 * 1024 // 20MB pour avoir de la marge

    console.log(`📊 File size: ${fileSizeMB.toFixed(2)} MB`)

    // Déterminer l'extension du fichier
    const extension = path.extname(filePath).slice(1) || 'mp3'

    // Si le fichier est petit, traitement direct
    if (!needsChunking(fileBuffer.length, maxChunkSize)) {
      console.log(`✅ File size OK, processing directly`)

      const audioStream = createReadStream(filePath) as any
      const timeoutMs = 10 * 60 * 1000
      const response = await Promise.race([
        openai.audio.transcriptions.create({
          file: audioStream,
          model: 'whisper-1',
          language,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Whisper API timeout after 10 minutes')),
            timeoutMs
          )
        ),
      ])

      console.log(`✅ Transcription completed: ${response.text?.length || 0} chars`)

      const segments: TranscriptSegment[] = []
      if (response.segments) {
        for (const segment of response.segments) {
          segments.push({
            text: segment.text.trim(),
            timestamp: segment.start,
            speaker: undefined,
          })
        }
      } else {
        segments.push({
          text: response.text || '',
          timestamp: 0,
          speaker: undefined,
        })
      }

      // Post-traitement : fusionner les segments incomplets
      return mergeIncompleteSegments(segments)
    }

    // Fichier trop gros, découpage nécessaire
    console.log(`⚠️ File too large, splitting into chunks...`)
    const chunks = await splitAudioFile(fileBuffer, maxChunkSize, extension)
    console.log(`📦 Split into ${chunks.length} chunks`)

    // Transcrire chaque chunk
    const allSegments: TranscriptSegment[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length} (start: ${chunk.startTime.toFixed(1)}s)`)

      const chunkSegments = await transcribeChunk(chunk.buffer, language, i, extension)

      // Ajuster les timestamps avec l'offset du chunk
      const adjustedSegments = chunkSegments.map((seg) => ({
        ...seg,
        timestamp: seg.timestamp + chunk.startTime,
      }))

      allSegments.push(...adjustedSegments)
    }

    console.log(`✅ Transcription completed: ${allSegments.length} segments, ${allSegments.map(s => s.text).join(' ').length} chars`)

    // Post-traitement : fusionner les segments incomplets
    return mergeIncompleteSegments(allSegments)
  } catch (error: any) {
    console.error('❌ Error transcribing audio:', error)

    if (error.code === 'insufficient_quota') {
      throw new Error(
        'OpenAI API quota exceeded. Please check your billing at https://platform.openai.com/account/billing'
      )
    }

    if (error.status === 401) {
      throw new Error(
        'Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env.local'
      )
    }

    throw new Error(`Transcription failed: ${error.message}`)
  }
}

/**
 * Estime la durée de transcription basée sur la taille du fichier
 * Whisper traite environ en temps réel (1 min d'audio = ~1 min de processing)
 */
export function estimateTranscriptionTime(fileSizeMB: number): number {
  // Approximation: 1 MB ≈ 1 minute d'audio MP3
  // Whisper prend environ 30-60s par minute d'audio
  const estimatedMinutes = fileSizeMB
  return Math.max(10, Math.ceil(estimatedMinutes * 45)) // En secondes
}

/**
 * Valide qu'un fichier audio est supporté
 */
export function validateAudioFile(
  filename: string,
  fileSizeMB: number
): { valid: boolean; error?: string } {
  // Extensions supportées par Whisper
  const supportedExtensions = [
    '.mp3',
    '.mp4',
    '.mpeg',
    '.mpga',
    '.m4a',
    '.wav',
    '.webm',
  ]

  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'))

  if (!supportedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Format non supporté. Formats acceptés: ${supportedExtensions.join(', ')}`,
    }
  }

  // Limite raisonnable: 200 MB (sera découpé automatiquement si nécessaire)
  if (fileSizeMB > 200) {
    return {
      valid: false,
      error: `Fichier trop volumineux (${fileSizeMB.toFixed(1)} MB). Maximum: 200 MB`,
    }
  }

  return { valid: true }
}
