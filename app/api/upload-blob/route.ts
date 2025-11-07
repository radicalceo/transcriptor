import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import {
  validateAudioFile,
  estimateTranscriptionTime,
} from '@/lib/services/whisperService'
import { ensureTempDir } from '@/lib/tempDir'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

/**
 * Upload via Vercel Blob Storage (contourne la limite de 4.5MB)
 * Le client upload directement vers Blob, puis on traite le fichier
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

    // Vérifier que les clés sont configurées
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
        },
        { status: 500 }
      )
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel Blob Storage not configured. Please add BLOB_READ_WRITE_TOKEN to your environment variables.',
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

    console.log(`📤 Uploading to Blob: ${file.name} (${fileSizeMB.toFixed(2)} MB)`)

    // Upload vers Vercel Blob Storage
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    console.log(`✅ Blob uploaded: ${blob.url}`)

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
        audioPath: blob.url, // Stocker l'URL Blob
      },
    })

    const meetingId = meeting.id
    const estimatedTime = estimateTranscriptionTime(fileSizeMB)

    console.log(`⏱️  Estimated transcription time: ${estimatedTime}s`)

    // Démarrer la transcription en arrière-plan
    processAudioFromBlob(meetingId, blob.url).catch((error) => {
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
      message: 'File uploaded to Blob Storage. Processing in background...',
    })
  } catch (error: any) {
    console.error('Error uploading to blob:', error)

    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
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
    const { writeFile, unlink } = await import('fs/promises')
    const { join } = await import('path')
    const { transcribeAudio } = await import('@/lib/services/whisperService')

    const tempDir = await ensureTempDir()
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
