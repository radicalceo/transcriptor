import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingStore } from '@/lib/services/meetingStore'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Convert JSON strings back to objects
    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        status: meeting.status,
        title: meeting.title,
        audioPath: meeting.audioPath,
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
    console.error('Error fetching meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch meeting' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { transcript } = await request.json()

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript text required' },
        { status: 400 }
      )
    }

    // Get current transcript and add new line
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    const currentTranscript = JSON.parse(meeting.transcript)
    currentTranscript.push(transcript)

    console.log('DEBUG - Adding transcript:', transcript)
    console.log('DEBUG - Updated transcript array length:', currentTranscript.length)

    await prisma.meeting.update({
      where: { id },
      data: {
        transcript: JSON.stringify(currentTranscript),
      },
    })

    // Also update in-memory store for live suggestions
    meetingStore.addTranscript(id, transcript)
    console.log('DEBUG - Transcript added to both stores')

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error adding transcript:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add transcript' },
      { status: 500 }
    )
  }
}
