import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { TranscriptSegment } from '@/lib/types'

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
    // sauf si le délai est vraiment énorme (> 60s = changement de sujet probable)
    if (nextStartsLowercase && timeDiff < 60) {
      currentSegment.text += ' ' + nextSegment.text
      lastSegmentTimestamp = nextSegment.timestamp
      continue
    }

    // Cas 2: Le segment actuel se termine sans ponctuation forte -> fusionner si délai raisonnable
    // Pour les segments incomplets, on accepte des pauses plus longues (jusqu'à 30s)
    if (!endsWithStrongPunctuation && timeDiff < 30) {
      currentSegment.text += ' ' + nextSegment.text
      lastSegmentTimestamp = nextSegment.timestamp
      continue
    }

    // Cas 3: Pause très courte (< 2s) -> fusionner même avec ponctuation
    if (timeDiff < 2) {
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

  return merged
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`🔄 Reprocessing segments for meeting: ${id}`)

    // Récupérer le meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Parser les segments existants
    const existingSegments: TranscriptSegment[] = JSON.parse(meeting.transcriptSegments)
    console.log(`📊 Original segments: ${existingSegments.length}`)

    // Appliquer le nouveau traitement de fusion
    const mergedSegments = mergeIncompleteSegments(existingSegments)
    console.log(`✅ Merged segments: ${mergedSegments.length}`)

    // Mettre à jour le meeting
    await prisma.meeting.update({
      where: { id },
      data: {
        transcriptSegments: JSON.stringify(mergedSegments),
      },
    })

    return NextResponse.json({
      success: true,
      originalCount: existingSegments.length,
      mergedCount: mergedSegments.length,
      reduction: existingSegments.length - mergedSegments.length,
    })
  } catch (error: any) {
    console.error('❌ Error reprocessing segments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reprocess segments' },
      { status: 500 }
    )
  }
}
