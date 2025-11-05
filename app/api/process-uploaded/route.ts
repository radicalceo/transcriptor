import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { estimateTranscriptionTime } from '@/lib/services/whisperService'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Traite un fichier déjà uploadé vers Blob Storage
 * Appelé après un upload client-side direct
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
        },
        { status: 500 }
      )
    }

    const { blobUrl, filename, fileSize } = await request.json()

    if (!blobUrl || !filename) {
      return NextResponse.json(
        { success: false, error: 'Missing blobUrl or filename' },
        { status: 400 }
      )
    }

    console.log(`📤 Processing uploaded file: ${filename} from ${blobUrl}`)

    const fileSizeMB = fileSize ? fileSize / (1024 * 1024) : 0

    // Créer un meeting dans la base de données
    const meeting = await prisma.meeting.create({
      data: {
        status: 'processing',
        type: 'upload',
        title: filename,
        transcript: '[]',
        transcriptSegments: '[]',
        topics: '[]',
        decisions: '[]',
        actions: '[]',
        userId: user.id,
        audioPath: blobUrl,
      },
    })

    const meetingId = meeting.id
    const estimatedTime = fileSizeMB > 0 ? estimateTranscriptionTime(fileSizeMB) : 60

    console.log(`⏱️  Estimated transcription time: ${estimatedTime}s`)

    // Démarrer la transcription en arrière-plan
    processAudioFromBlob(meetingId, blobUrl).catch((error) => {
      console.error('Error processing audio file:', error)
      prisma.meeting
        .update({
          where: { id: meetingId },
          data: { status: 'completed' },
        })
        .catch(console.error)
    })

    return NextResponse.json({
      success: true,
      meetingId,
      estimatedTime,
      message: 'File uploaded successfully. Processing in background...',
    })
  } catch (error: any) {
    console.error('Error processing upload:', error)

    return NextResponse.json(
      { success: false, error: error.message || 'Processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Traite le fichier audio depuis Blob Storage
 */
async function processAudioFromBlob(meetingId: string, blobUrl: string) {
  try {
    console.log(`🎙️  Starting transcription from Blob for meeting ${meetingId}`)

    // Télécharger depuis Blob et transcrire
    const response = await fetch(blobUrl)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Créer un fichier temporaire pour Whisper
    const { writeFile, unlink, mkdir } = await import('fs/promises')
    const { join } = await import('path')
    const { transcribeAudio } = await import('@/lib/services/whisperService')

    const tempDir = join(process.cwd(), 'data', 'temp')

    // Créer le dossier temp s'il n'existe pas
    await mkdir(tempDir, { recursive: true })

    const tempFile = join(tempDir, `${meetingId}-temp.audio`)

    await writeFile(tempFile, buffer)

    try {
      // Étape 1: Transcrire avec Whisper
      const segments = await transcribeAudio(tempFile)

      console.log(`✅ Transcription completed: ${segments.length} segments`)

      // Étape 2: Stocker les segments
      const transcriptArray = segments.map((s) => s.text)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcript: JSON.stringify(transcriptArray),
          transcriptSegments: JSON.stringify(segments),
        },
      })

      // Étape 3: Générer le résumé avec Claude
      const fullTranscript = transcriptArray.join(' ')

      if (fullTranscript.length < 100) {
        console.log('⚠️ Transcript too short, skipping analysis')
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'completed' },
        })
        return
      }

      console.log('🤖 Analyzing with Claude...')
      const { generateFinalSummary } = await import('@/lib/services/claudeService')

      const summary = await generateFinalSummary(transcriptArray, undefined)

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

      console.log(`✅ Processing completed for meeting ${meetingId}`)
    } finally {
      // Nettoyer le fichier temporaire
      await unlink(tempFile).catch(console.error)
    }
  } catch (error) {
    console.error('Error in processAudioFromBlob:', error)

    await prisma.meeting
      .update({
        where: { id: meetingId },
        data: { status: 'completed' },
      })
      .catch(console.error)

    throw error
  }
}
