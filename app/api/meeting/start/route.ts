import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingStore } from '@/lib/services/meetingStore'
import { requireAuth } from '@/lib/session'

export async function POST() {
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

    const meeting = await prisma.meeting.create({
      data: {
        status: 'active',
        title: null,
        transcript: '[]',
        transcriptSegments: '[]',
        topics: '[]',
        decisions: '[]',
        actions: '[]',
        userId: user.id,
      },
    })

    // Also create in memory store for live suggestions
    meetingStore.create(meeting.id, 'live', meeting.title || undefined)

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        status: meeting.status,
        title: meeting.title,
        transcript: JSON.parse(meeting.transcript),
        transcriptSegments: JSON.parse(meeting.transcriptSegments),
        suggestions: {
          topics: JSON.parse(meeting.topics),
          decisions: JSON.parse(meeting.decisions),
          actions: JSON.parse(meeting.actions),
        },
        summary: meeting.summary ? JSON.parse(meeting.summary) : null,
        duration: meeting.duration,
        createdAt: meeting.createdAt,
      },
    })
  } catch (error) {
    console.error('Error starting meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start meeting' },
      { status: 500 }
    )
  }
}
