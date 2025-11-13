import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

export async function GET() {
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

    const dbMeetings = await prisma.meeting.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Convert to the format expected by the frontend
    const meetings = dbMeetings.map((meeting) => ({
      id: meeting.id,
      status: meeting.status,
      title: meeting.title,
      type: meeting.type,
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
      folderId: meeting.folderId,
      templateId: meeting.templateId,
    }))

    return NextResponse.json({
      success: true,
      meetings,
    })
  } catch (error: any) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}
