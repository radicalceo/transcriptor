import { NextResponse } from 'next/server'
import { meetingStore } from '@/lib/services/meetingStore'
import { generateFinalSummary } from '@/lib/services/claudeService'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { meetingId, async = true } = await request.json()

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
        type: dbMeeting.type as 'live' | 'upload',
        duration: dbMeeting.duration ?? undefined,
      }
    }

    // Check if there's enough content to generate a summary
    const fullTranscript = meeting.transcript.join(' ')
    console.log('DEBUG - Full transcript length:', fullTranscript.length)

    if (!fullTranscript || fullTranscript.trim().length < 10) {
      console.log('DEBUG - Not enough content to generate summary')
      return NextResponse.json(
        { success: false, error: 'Not enough content to generate summary' },
        { status: 400 }
      )
    }

    // Update status to processing
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'processing' },
    })

    if (meetingStore.get(meetingId)) {
      meetingStore.updateStatus(meetingId, 'processing')
    }

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

    console.log(`✅ Async summary generation completed for meeting ${meetingId}`)
  } catch (error) {
    console.error(`❌ Async summary generation failed for meeting ${meetingId}:`, error)

    // Update status to error in database
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'error' },
    })

    throw error
  }
}
