import { NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import {
  transcribeAudio,
  validateAudioFile,
  estimateTranscriptionTime,
} from '@/lib/services/whisperService'

export async function POST(request: Request) {
  let tempFilePath: string | null = null

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

    // Vérifier que la clé OpenAI est configurée
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file to enable audio file uploads.',
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validation du fichier
    const fileSizeMB = file.size / (1024 * 1024)
    const validation = validateAudioFile(file.name, fileSizeMB)

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    console.log(`📤 Uploading file: ${file.name} (${fileSizeMB.toFixed(2)} MB)`)

    // Créer un meeting dans la base de données
    const meeting = await prisma.meeting.create({
      data: {
        status: 'processing',
        type: 'upload',
        title: file.name,
        transcript: '[]',
        transcriptSegments: '[]',
        topics: '[]',
        decisions: '[]',
        actions: '[]',
        userId: user.id,
      },
    })

    const meetingId = meeting.id

    // Sauvegarder le fichier de manière persistante
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), 'data', 'uploads')
    const fileName = `${meetingId}-${file.name}`
    const filePath = join(uploadDir, fileName)

    await writeFile(filePath, buffer)
    console.log(`💾 File saved to: ${filePath}`)

    // Mettre à jour le chemin du fichier dans la DB
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { audioPath: filePath },
    })

    tempFilePath = filePath

    // Estimer le temps de transcription
    const estimatedTime = estimateTranscriptionTime(fileSizeMB)
    console.log(`⏱️  Estimated transcription time: ${estimatedTime}s`)

    // Démarrer la transcription en arrière-plan
    // Note: En production, utilisez un job queue (Bull, etc.)
    processAudioFile(meetingId, filePath).catch((error) => {
      console.error('Error processing audio file:', error)
      prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'completed' }
      }).catch(console.error)
    })

    return NextResponse.json({
      success: true,
      meetingId,
      estimatedTime,
      message: 'File uploaded successfully. Processing in background...',
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)

    // Nettoyer le fichier temporaire en cas d'erreur
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
      } catch (unlinkError) {
        console.error('Error deleting temp file:', unlinkError)
      }
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * Traite le fichier audio en arrière-plan
 */
async function processAudioFile(meetingId: string, filePath: string) {
  try {
    console.log(`🎙️  Starting transcription for meeting ${meetingId}`)

    // Étape 1: Transcrire avec Whisper
    const segments = await transcribeAudio(filePath)

    console.log(`✅ Transcription completed: ${segments.length} segments`)

    // Étape 2: Stocker les segments avec timestamps
    const transcriptArray = segments.map((s) => s.text)
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcript: JSON.stringify(transcriptArray),
        transcriptSegments: JSON.stringify(segments),
      },
    })

    // Étape 3: Générer le résumé complet avec Claude (1 seul appel)
    const fullTranscript = transcriptArray.join(' ')

    if (fullTranscript.length < 100) {
      console.log('⚠️ Transcript too short, skipping analysis')
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'completed' },
      })
      return
    }

    console.log('🤖 Analyzing full transcript with Claude (single call)...')
    const { generateFinalSummary } = await import('@/lib/services/claudeService')

    const summary = await generateFinalSummary(transcriptArray, undefined)

    // Extraire les suggestions du résumé pour l'affichage live
    const limitedSuggestions = {
      topics: summary.topics.slice(0, 8),
      decisions: summary.decisions.slice(0, 10),
      actions: summary.actions.slice(0, 15),
    }

    // Étape 4: Sauvegarder les suggestions et le résumé
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

    console.log('✅ Analysis completed in single call')
    console.log(`✅ Processing completed for meeting ${meetingId}`)
  } catch (error) {
    console.error('Error in processAudioFile:', error)

    // Marquer comme complété même en cas d'erreur
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'completed' },
    }).catch(console.error)

    throw error
  }
}
