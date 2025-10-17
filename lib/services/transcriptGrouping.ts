import type { TranscriptSegment } from '@/lib/types'

export interface TranscriptBlock {
  text: string
  startTime: number
  endTime: number
  speaker?: string
  segmentCount: number
}

/**
 * Regroupe les segments de transcription en paragraphes naturels
 * Combine les segments proches et utilise la ponctuation pour détecter les fins de phrases
 */
export function groupTranscriptSegments(
  segments: TranscriptSegment[]
): TranscriptBlock[] {
  if (segments.length === 0) return []

  const blocks: TranscriptBlock[] = []

  // Seuils de regroupement
  const SHORT_PAUSE = 1.0 // Toujours regrouper si pause < 1s
  const LONG_PAUSE = 3.0 // Toujours créer un nouveau bloc si pause > 3s
  const MIN_BLOCK_LENGTH = 50 // Longueur minimale d'un bloc en caractères

  let currentBlock: TranscriptBlock = {
    text: segments[0].text,
    startTime: segments[0].timestamp || 0,
    endTime: segments[0].timestamp || 0,
    speaker: segments[0].speaker,
    segmentCount: 1,
  }

  for (let i = 1; i < segments.length; i++) {
    const prevSegment = segments[i - 1]
    const currentSegment = segments[i]

    const prevTime = prevSegment.timestamp || 0
    const currentTime = currentSegment.timestamp || 0
    const pause = currentTime - prevTime

    // Changement de speaker : toujours créer un nouveau bloc
    if (
      currentSegment.speaker &&
      prevSegment.speaker &&
      currentSegment.speaker !== prevSegment.speaker
    ) {
      blocks.push(currentBlock)
      currentBlock = {
        text: currentSegment.text,
        startTime: currentTime,
        endTime: currentTime,
        speaker: currentSegment.speaker,
        segmentCount: 1,
      }
      continue
    }

    // Pause courte : toujours regrouper
    if (pause < SHORT_PAUSE) {
      currentBlock.text += ' ' + currentSegment.text
      currentBlock.endTime = currentTime
      currentBlock.segmentCount++
      continue
    }

    // Pause longue : toujours créer un nouveau bloc
    if (pause > LONG_PAUSE) {
      blocks.push(currentBlock)
      currentBlock = {
        text: currentSegment.text,
        startTime: currentTime,
        endTime: currentTime,
        speaker: currentSegment.speaker,
        segmentCount: 1,
      }
      continue
    }

    // Pause moyenne (entre 1s et 3s) : décider en fonction de la ponctuation
    const prevTextEndsWithPunctuation = /[.!?]$/.test(prevSegment.text.trim())
    const currentBlockIsTooShort = currentBlock.text.length < MIN_BLOCK_LENGTH

    // Continuer le bloc si :
    // - Le bloc actuel est encore trop court
    // - OU il n'y a pas de ponctuation de fin
    if (currentBlockIsTooShort || !prevTextEndsWithPunctuation) {
      currentBlock.text += ' ' + currentSegment.text
      currentBlock.endTime = currentTime
      currentBlock.segmentCount++
    } else {
      // Créer un nouveau bloc
      blocks.push(currentBlock)
      currentBlock = {
        text: currentSegment.text,
        startTime: currentTime,
        endTime: currentTime,
        speaker: currentSegment.speaker,
        segmentCount: 1,
      }
    }
  }

  // Ajouter le dernier bloc
  blocks.push(currentBlock)

  return blocks
}

/**
 * Formate un timestamp en minutes:secondes
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
