import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transcribeAudio } from '@/lib/services/whisperService'
import { generateFinalSummary } from '@/lib/services/claudeService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`🔄 Retranscribing audio for meeting: ${id}`)

    // Récupérer le meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (!meeting.audioPath) {
      return NextResponse.json(
        { error: 'No audio file found for this meeting' },
        { status: 400 }
      )
    }

    // Mettre le statut en processing
    await prisma.meeting.update({
      where: { id },
      data: { status: 'processing' },
    })

    // Démarrer la re-transcription en arrière-plan
    retranscribeAudioFile(id, meeting.audioPath).catch((error) => {
      console.error('Error retranscribing audio file:', error)
      prisma.meeting
        .update({
          where: { id },
          data: { status: 'completed' },
        })
        .catch(console.error)
    })

    return NextResponse.json({
      success: true,
      message: 'Retranscription started. This may take a few minutes...',
    })
  } catch (error: any) {
    console.error('❌ Error retranscribing:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retranscribe' },
      { status: 500 }
    )
  }
}

async function retranscribeAudioFile(meetingId: string, filePath: string) {
  try {
    console.log(`🎙️  Re-transcribing audio for meeting ${meetingId}`)

    // Étape 1: Transcrire avec Whisper (avec les nouveaux seuils de fusion)
    const segments = await transcribeAudio(filePath)

    console.log(`✅ Retranscription completed: ${segments.length} segments`)

    // Étape 2: Stocker les nouveaux segments
    const transcriptArray = segments.map((s) => s.text)
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcript: JSON.stringify(transcriptArray),
        transcriptSegments: JSON.stringify(segments),
      },
    })

    // Étape 3: Régénérer le résumé avec Claude
    const fullTranscript = transcriptArray.join(' ')

    console.log('🤖 Re-analyzing transcript with Claude...')
    const summary = await generateFinalSummary(transcriptArray, undefined)

    // Extraire les suggestions
    const limitedSuggestions = {
      topics: summary.topics.slice(0, 8),
      decisions: summary.decisions.slice(0, 10),
      actions: summary.actions.slice(0, 15),
    }

    // Étape 4: Sauvegarder
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        topics: JSON.stringify(limitedSuggestions.topics),
        decisions: JSON.stringify(limitedSuggestions.decisions),
        actions: JSON.stringify(limitedSuggestions.actions),
        summary: JSON.stringify(summary),
        status: 'completed',
      },
    })

    console.log('✅ Retranscription completed successfully')
  } catch (error) {
    console.error('Error in retranscribeAudioFile:', error)

    await prisma.meeting
      .update({
        where: { id: meetingId },
        data: { status: 'completed' },
      })
      .catch(console.error)

    throw error
  }
}
