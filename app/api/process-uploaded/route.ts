import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { estimateTranscriptionTime } from '@/lib/services/whisperService'
import { ensureTempDir } from '@/lib/tempDir'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max sur Vercel Pro

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

    // Sur Vercel, on ne peut pas faire du traitement vraiment asynchrone
    // On a deux options :
    // 1. Traiter synchroniquement (mais risque de timeout après 300s)
    // 2. Retourner immédiatement et faire du polling côté client

    // Pour les petits fichiers (< 3 min estimé), on traite synchroniquement
    // Pour les gros fichiers, on lance en arrière-plan et le client poll
    const processSynchronously = estimatedTime < 180 // moins de 3 minutes

    if (processSynchronously) {
      console.log('📦 Processing synchronously (estimated time < 3min)')
      try {
        await processAudioFromBlob(meetingId, blobUrl)
        console.log('✅ Synchronous processing completed')
      } catch (error: any) {
        console.error('❌ Error during synchronous processing:', error)
        console.error('Error stack:', error.stack)
        // Le meeting reste en status 'processing', le client peut réessayer
      }
    } else {
      console.log('📦 Processing asynchronously (large file)')
      // Démarrer en arrière-plan (risque de timeout Vercel)
      processAudioFromBlob(meetingId, blobUrl).catch((error) => {
        console.error('❌ Error processing audio file:', error)
        console.error('Error stack:', error.stack)

        // Mettre à jour le meeting avec l'erreur
        prisma.meeting
          .update({
            where: { id: meetingId },
            data: {
              status: 'completed',
            },
          })
          .catch((updateError) => {
            console.error('❌ Failed to update meeting after error:', updateError)
          })
      })
    }

    return NextResponse.json({
      success: true,
      meetingId,
      estimatedTime,
      processingMode: processSynchronously ? 'sync' : 'async',
      message: processSynchronously
        ? 'File processed successfully'
        : 'File uploaded successfully. Processing in background...',
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
    console.log(`📦 Blob URL: ${blobUrl}`)

    // Télécharger depuis Blob et transcrire
    console.log(`⬇️  Downloading from Blob Storage...`)
    const response = await fetch(blobUrl)

    if (!response.ok) {
      throw new Error(`Failed to download from Blob: ${response.status} ${response.statusText}`)
    }

    console.log(`📥 Blob response OK, reading buffer...`)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeMB = buffer.length / (1024 * 1024)

    console.log(`✅ Downloaded ${sizeMB.toFixed(2)} MB from Blob`)

    // Créer un fichier temporaire pour Whisper
    const { writeFile, unlink } = await import('fs/promises')
    const { join } = await import('path')
    const { transcribeAudio } = await import('@/lib/services/whisperService')

    // Créer le dossier temp s'il n'existe pas (compatible Vercel)
    console.log(`📁 Creating temp directory...`)
    const tempDir = await ensureTempDir()
    console.log(`✅ Temp directory ready: ${tempDir}`)

    // Extract extension from the audio path URL
    const urlWithoutQuery = blobUrl.split('?')[0]
    const pathParts = urlWithoutQuery.split('/')
    const filename = pathParts[pathParts.length - 1]
    const filenameParts = filename.split('.')
    let extension = filenameParts[filenameParts.length - 1] || 'mp4'

    // Validate extension is a known audio format
    const validExtensions = ['mp4', 'mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac']
    if (!validExtensions.includes(extension.toLowerCase())) {
      console.log(`⚠️ Invalid extension "${extension}", defaulting to mp4`)
      extension = 'mp4'
    }

    const tempFile = join(tempDir, `${meetingId}-temp.${extension}`)
    console.log(`📁 Temp file path: ${tempFile}`)

    console.log(`💾 Writing to temp file: ${tempFile}`)
    await writeFile(tempFile, buffer)
    console.log(`✅ Temp file written successfully`)

    try {
      // Étape 1: Transcrire avec Whisper (avec callback progressif)
      console.log(`🎤 Starting Whisper transcription...`)

      let allSegments: any[] = []

      // Callback pour sauvegarder progressivement
      const onProgress = async (newSegments: any[]) => {
        allSegments.push(...newSegments)

        console.log(`💾 Saving ${newSegments.length} new segments (total: ${allSegments.length})`)
        const transcriptArray = allSegments.map((s) => s.text)

        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            transcript: JSON.stringify(transcriptArray),
            transcriptSegments: JSON.stringify(allSegments),
          },
        })
      }

      const segments = await transcribeAudio(tempFile, 'fr', onProgress)

      console.log(`✅ Transcription completed: ${segments.length} segments`)

      // Étape 2: Sauvegarder les segments fusionnés finaux
      console.log(`💾 Saving final merged segments to database...`)
      const transcriptArray = segments.map((s) => s.text)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcript: JSON.stringify(transcriptArray),
          transcriptSegments: JSON.stringify(segments),
        },
      })
      console.log(`✅ Transcript saved to database`)

      // Étape 3: Générer le résumé avec Claude
      const fullTranscript = transcriptArray.join(' ')

      // Tenter de générer le résumé avec Claude (même pour les courts extraits)
      let summary = null
      try {
        console.log(`🤖 Analyzing with Claude... (${fullTranscript.length} chars)`)
        const { generateFinalSummary } = await import('@/lib/services/claudeService')

        summary = await generateFinalSummary(transcriptArray, undefined)
        console.log(`✅ Claude analysis completed`)
      } catch (claudeError: any) {
        console.error('⚠️ Claude analysis failed:', claudeError.message)
        console.error('Transcript will be saved without summary')
      }

      // Étape 4: Sauvegarder (avec ou sans résumé)
      if (summary) {
        const limitedSuggestions = {
          topics: summary.topics.slice(0, 8),
          decisions: summary.decisions.slice(0, 10),
          actions: summary.actions.slice(0, 15),
        }

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
      } else {
        // Juste marquer comme complété sans résumé
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'completed' },
        })
      }

      console.log(`✅ Processing completed for meeting ${meetingId}`)

      // Envoyer l'email de notification
      try {
        const meetingWithUser = await prisma.meeting.findUnique({
          where: { id: meetingId },
          include: { user: true },
        })

        if (meetingWithUser?.user) {
          const { sendTranscriptionCompleteEmail } = await import('@/lib/email')
          await sendTranscriptionCompleteEmail({
            userEmail: meetingWithUser.user.email,
            userName: meetingWithUser.user.name,
            meetingId: meetingId,
            meetingTitle: meetingWithUser.title || 'Enregistrement audio',
          })
        }
      } catch (emailError) {
        console.error('⚠️ Failed to send completion email:', emailError)
        // Ne pas bloquer si l'email échoue
      }
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
