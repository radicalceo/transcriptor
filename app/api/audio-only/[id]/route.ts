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

    // Verify it's an audio-only meeting
    if (meeting.type !== 'audio-only') {
      return NextResponse.json(
        { success: false, error: 'Not an audio-only meeting' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        status: meeting.status,
        type: meeting.type,
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
        notes: meeting.notes || '',
        duration: meeting.duration,
        createdAt: meeting.createdAt,
      },
    })
  } catch (error) {
    console.error('Error fetching audio-only meeting:', error)
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

    // Get current meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Verify it's an audio-only meeting
    if (meeting.type !== 'audio-only') {
      return NextResponse.json(
        { success: false, error: 'Not an audio-only meeting' },
        { status: 400 }
      )
    }

    const currentTranscript = JSON.parse(meeting.transcript)
    currentTranscript.push(transcript)

    await prisma.meeting.update({
      where: { id },
      data: {
        transcript: JSON.stringify(currentTranscript),
      },
    })

    // Update in-memory store for live suggestions
    meetingStore.addTranscript(id, transcript)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error adding transcript to audio-only meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add transcript' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { notes } = await request.json()

    if (notes === undefined) {
      return NextResponse.json(
        { success: false, error: 'Notes required' },
        { status: 400 }
      )
    }

    // Verify it's an audio-only meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { type: true },
    })

    if (!meeting || meeting.type !== 'audio-only') {
      return NextResponse.json(
        { success: false, error: 'Not an audio-only meeting' },
        { status: 400 }
      )
    }

    await prisma.meeting.update({
      where: { id },
      data: { notes },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error updating notes for audio-only meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notes' },
      { status: 500 }
    )
  }
}
