import { NextResponse } from 'next/server'
import { meetingStore } from '@/lib/services/meetingStore'
import { analyzeLiveTranscript } from '@/lib/services/claudeService'
import { deduplicateSuggestions } from '@/lib/services/deduplication'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { meetingId } = await request.json()

    if (!meetingId) {
      return NextResponse.json(
        { success: false, error: 'Meeting ID required' },
        { status: 400 }
      )
    }

    // Try to get from meetingStore first (faster for live meetings)
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
        title: dbMeeting.title,
        transcript: JSON.parse(dbMeeting.transcript),
        transcriptSegments: JSON.parse(dbMeeting.transcriptSegments),
        suggestions: {
          topics: JSON.parse(dbMeeting.topics),
          decisions: JSON.parse(dbMeeting.decisions),
          actions: JSON.parse(dbMeeting.actions),
        },
        createdAt: dbMeeting.createdAt.toISOString(),
        updatedAt: dbMeeting.updatedAt.toISOString(),
        status: dbMeeting.status,
        type: dbMeeting.type,
        duration: dbMeeting.duration,
      }

      // Re-add to memory store or sync transcript from DB
      const existingMeeting = meetingStore.get(meeting.id)
      if (!existingMeeting) {
        // Meeting not in memory, reload from DB
        console.log('DEBUG - Meeting not in memory, reloading from DB')
        meetingStore.create(meeting.id, meeting.type, meeting.title || undefined)
        if (meeting.transcript.length > 0) {
          meeting.transcript.forEach(text => meetingStore.addTranscript(meeting.id, text))
        }
        meetingStore.updateSuggestions(meeting.id, meeting.suggestions)
        // Use reloaded meeting from memory
        meeting = meetingStore.get(meeting.id)!
      } else {
        // Meeting exists in memory, but sync transcript from DB if memory is empty
        console.log('DEBUG - Meeting found in memory')
        console.log('DEBUG - Memory transcript length:', existingMeeting.transcript.length)
        console.log('DEBUG - DB transcript length:', meeting.transcript.length)

        if (existingMeeting.transcript.length === 0 && meeting.transcript.length > 0) {
          console.log('DEBUG - Syncing transcript from DB to memory')
          meeting.transcript.forEach(text => meetingStore.addTranscript(meeting.id, text))
        }
        // Use memory version (now synced)
        meeting = meetingStore.get(meeting.id)!
      }
    }

    // Get recent transcript (larger window for better context)
    // Use last 15 segments or all if less than 15
    const segmentCount = Math.min(meeting.transcript.length, 15)
    const recentTranscript = meeting.transcript.slice(-segmentCount).join(' ')

    console.log('DEBUG - Meeting ID:', meetingId)
    console.log('DEBUG - Meeting transcript array length:', meeting.transcript.length)
    console.log('DEBUG - Recent transcript:', recentTranscript.substring(0, 100) + '...')
    console.log('DEBUG - Recent transcript length:', recentTranscript.length)
    console.log('DEBUG - Current suggestions topics count:', meeting.suggestions.topics.length)
    console.log('DEBUG - Current suggestions decisions count:', meeting.suggestions.decisions.length)
    console.log('DEBUG - Current suggestions actions count:', meeting.suggestions.actions.length)

    if (!recentTranscript || recentTranscript.length < 20) {
      // Not enough content yet
      console.log('DEBUG - Not enough content yet (length < 20), returning existing suggestions')
      return NextResponse.json({
        success: true,
        suggestions: meeting.suggestions,
      })
    }

    console.log('DEBUG - Calling Claude API for suggestions...')
    console.log('DEBUG - Text sent to Claude:', recentTranscript)

    // Analyze with Claude
    const newSuggestions = await analyzeLiveTranscript(recentTranscript)
    console.log('DEBUG - Suggestions received from Claude:', JSON.stringify(newSuggestions))

    // Merge with existing suggestions and deduplicate
    const mergedSuggestions = deduplicateSuggestions({
      topics: [...meeting.suggestions.topics, ...newSuggestions.topics],
      decisions: [...meeting.suggestions.decisions, ...newSuggestions.decisions],
      actions: [...meeting.suggestions.actions, ...newSuggestions.actions],
    })

    // Limiter le nombre de suggestions pour éviter une liste trop longue
    const limitedSuggestions = {
      topics: mergedSuggestions.topics.slice(0, 8), // Max 8 topics
      decisions: mergedSuggestions.decisions.slice(0, 10), // Max 10 decisions
      actions: mergedSuggestions.actions.slice(0, 15), // Max 15 actions
    }

    // Update in memory store
    meetingStore.updateSuggestions(meetingId, limitedSuggestions)

    // Also save to database for persistence
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        topics: JSON.stringify(limitedSuggestions.topics),
        decisions: JSON.stringify(limitedSuggestions.decisions),
        actions: JSON.stringify(limitedSuggestions.actions),
      },
    })

    return NextResponse.json({
      success: true,
      suggestions: limitedSuggestions,
    })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
