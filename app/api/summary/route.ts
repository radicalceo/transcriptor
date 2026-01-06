import { NextResponse } from 'next/server'
import { meetingStore } from '@/lib/services/meetingStore'
import { generateFinalSummary } from '@/lib/services/claudeService'
import { prisma } from '@/lib/prisma'
import { ensureTempDir } from '@/lib/tempDir'
import { sendSummaryReadyEmail } from '@/lib/services/emailService'

// Utility function to retry database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries
      const isRetryableError = error?.code === 'P1001' || error?.message?.includes('database server')

      if (!isRetryableError || isLastAttempt) {
        throw error
      }

      console.log(`⚠️ Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  throw new Error('Max retries reached')
}

export async function POST(request: Request) {
  try {
    const { meetingId, async = true, force = false } = await request.json()

    if (!meetingId) {
      return NextResponse.json(
        { success: false, error: 'Meeting ID required' },
        { status: 400 }
      )
    }

    // Try to get from meetingStore first (for live meetings)
    let meeting = meetingStore.get(meetingId)

    // If not in memory, get from database
    if (!meeting) {
      const dbMeeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!dbMeeting) {
        return NextResponse.json(
          { success: false, error: 'Meeting not found' },
          { status: 404 }
        )
      }

      // Convert database meeting to in-memory format
      meeting = {
        id: dbMeeting.id,
        title: dbMeeting.title ?? undefined,
        transcript: JSON.parse(dbMeeting.transcript),
        transcriptSegments: JSON.parse(dbMeeting.transcriptSegments),
        suggestions: {
          topics: JSON.parse(dbMeeting.topics),
          decisions: JSON.parse(dbMeeting.decisions),
          actions: JSON.parse(dbMeeting.actions),
        },
        notes: dbMeeting.notes ?? undefined,
        createdAt: dbMeeting.createdAt.toISOString(),
        updatedAt: dbMeeting.updatedAt.toISOString(),
        status: dbMeeting.status as 'active' | 'processing' | 'completed',
        type: dbMeeting.type as 'audio-only' | 'screen-share' | 'upload',
        duration: dbMeeting.duration ?? undefined,
      }
    }

    // If force is true, bypass status check and regenerate
    if (force) {
      console.log(`🔄 Force regenerating summary for meeting ${meetingId}`)
    }

    // Update status to processing first with retry
    await retryOperation(() =>
      prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'processing' },
      })
    )

    if (meetingStore.get(meetingId)) {
      meetingStore.updateStatus(meetingId, 'processing')
    }

    // Check if there's enough content - but don't fail yet,
    // we'll try to transcribe audio in generateSummaryAsync if needed
    const fullTranscript = meeting.transcript.join(' ')
    console.log('DEBUG - Full transcript length:', fullTranscript.length)

    // If async mode (default), start generation in background and return immediately
    if (async) {
      // Launch generation in background (non-blocking)
      generateSummaryAsync(meetingId, meeting).catch((error) => {
        console.error('Background summary generation failed:', error)
        // Update status to error
        prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'error' },
        }).catch(console.error)
      })

      return NextResponse.json({
        success: true,
        status: 'processing',
        message: 'Summary generation started',
      })
    }

    // Sync mode (for backwards compatibility): wait for generation
    const summary = await generateFinalSummary(
      meeting.transcript,
      meeting.suggestions,
      meeting.notes || undefined
    )

    // Save summary to database
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: JSON.stringify(summary),
        status: 'completed',
      },
    })

    // Also update in memory store if it exists
    if (meetingStore.get(meetingId)) {
      meetingStore.setSummary(meetingId, summary)
    }

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

// Background async function to generate summary
async function generateSummaryAsync(meetingId: string, meeting: any) {
  try {
    console.log(`🔄 Starting async summary generation for meeting ${meetingId}`)

    // IMPORTANT: Si le meeting a un audioPath mais pas de transcription, il faut d'abord transcrire
    const dbMeeting = await retryOperation(() =>
      prisma.meeting.findUnique({
        where: { id: meetingId },
      })
    )

    if (!dbMeeting) {
      throw new Error('Meeting not found in database')
    }

    let transcript = meeting.transcript
    let transcriptSegments = meeting.transcriptSegments

    // Si le meeting a un audio mais pas de transcription, transcrire d'abord
    if (dbMeeting.audioPath && (!transcript || transcript.length === 0 || transcript.join('').trim().length === 0)) {
      console.log(`🎤 Meeting has audio but no transcript, transcribing first...`)
      console.log(`📦 Audio path: ${dbMeeting.audioPath}`)

      try {
        // Télécharger l'audio depuis Blob
        const audioResponse = await fetch(dbMeeting.audioPath)
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.status}`)
        }

        const arrayBuffer = await audioResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        console.log(`✅ Downloaded audio: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`)

        // Créer un fichier temporaire
        const { writeFile, unlink } = await import('fs/promises')
        const { join } = await import('path')
        const { transcribeAudio } = await import('@/lib/services/whisperService')

        const tempDir = await ensureTempDir()

        // Déterminer l'extension depuis l'URL
        // URL format: https://...vercel-storage.com/meeting-id-temp.mp4 ou meeting-id-live-hash.mp4
        const urlWithoutQuery = dbMeeting.audioPath.split('?')[0]
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

        const tempFile = join(tempDir, `${meetingId}-transcribe.${extension}`)
        console.log(`📁 Temp file path: ${tempFile}`)
        await writeFile(tempFile, buffer)

        try {
          // Transcrire avec Whisper
          console.log(`🎙️ Transcribing audio with Whisper...`)
          const segments = await transcribeAudio(tempFile)
          console.log(`✅ Transcription completed: ${segments.length} segments`)

          // Mettre à jour la transcription
          transcript = segments.map((s) => s.text)
          transcriptSegments = segments

          // Sauvegarder en base
          await retryOperation(() =>
            prisma.meeting.update({
              where: { id: meetingId },
              data: {
                transcript: JSON.stringify(transcript),
                transcriptSegments: JSON.stringify(transcriptSegments),
              },
            })
          )

          console.log(`💾 Transcript saved to database`)
        } finally {
          // Nettoyer le fichier temporaire
          await unlink(tempFile).catch(console.error)
        }
      } catch (transcriptionError) {
        console.error(`❌ Transcription failed:`, transcriptionError)
        throw new Error(`Audio transcription failed: ${transcriptionError}`)
      }
    }

    // Vérifier qu'on a maintenant une transcription
    if (!transcript || transcript.length === 0 || transcript.join('').trim().length === 0) {
      throw new Error('No transcript available after transcription attempt')
    }

    console.log(`🤖 Generating summary with Claude...`)
    const summary = await generateFinalSummary(
      transcript,
      meeting.suggestions,
      meeting.notes || undefined
    )

    // Save summary to database with retry
    await retryOperation(() =>
      prisma.meeting.update({
        where: { id: meetingId },
        data: {
          summary: JSON.stringify(summary),
          topics: JSON.stringify(summary.topics.slice(0, 8)),
          decisions: JSON.stringify(summary.decisions.slice(0, 10)),
          actions: JSON.stringify(summary.actions.slice(0, 15)),
          status: 'completed',
        },
      })
    )

    // Also update in memory store if it exists
    if (meetingStore.get(meetingId)) {
      meetingStore.setSummary(meetingId, summary)
    }

    console.log(`✅ Async summary generation completed for meeting ${meetingId}`)

    // Send email notification
    try {
      // Get the updated meeting with user info
      const meetingWithUser = await retryOperation(() =>
        prisma.meeting.findUnique({
          where: { id: meetingId },
          include: { user: true },
        })
      )

      if (meetingWithUser && meetingWithUser.user.email) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const meetingTitle = meetingWithUser.title || `Meeting ${meetingId.slice(0, 8)}`

        console.log(`📧 Sending email notification to ${meetingWithUser.user.email}`)
        await sendSummaryReadyEmail(
          meetingWithUser.user.email,
          meetingId,
          meetingTitle,
          summary,
          baseUrl
        )
        console.log(`✅ Email notification sent successfully`)
      }
    } catch (emailError) {
      // Log error but don't fail the whole process
      console.error(`⚠️ Failed to send email notification:`, emailError)
    }
  } catch (error) {
    console.error(`❌ Async summary generation failed for meeting ${meetingId}:`, error)

    // Update status to error in database with retry
    await retryOperation(() =>
      prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'error',
          // Store error message for debugging
          notes: `Error during summary generation: ${error instanceof Error ? error.message : String(error)}`
        },
      })
    ).catch(console.error) // Don't throw if status update fails

    throw error
  }
}
