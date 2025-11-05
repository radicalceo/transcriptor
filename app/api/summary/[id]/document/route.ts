import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params
    console.log('DEBUG - Saving document for meeting:', meetingId)

    const { editedDocument } = await request.json()

    if (!editedDocument) {
      console.log('DEBUG - No editedDocument provided')
      return NextResponse.json(
        { success: false, error: 'editedDocument is required' },
        { status: 400 }
      )
    }

    console.log('DEBUG - Document length:', editedDocument.length)

    // Vérifier que le meeting existe
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    })

    if (!meeting) {
      console.log('DEBUG - Meeting not found:', meetingId)
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    console.log('DEBUG - Meeting found, has summary:', !!meeting.summary)

    if (!meeting.summary) {
      return NextResponse.json(
        { success: false, error: 'Meeting has no summary' },
        { status: 400 }
      )
    }

    // Parser le summary actuel et ajouter/mettre à jour le champ editedDocument
    const currentSummary = JSON.parse(meeting.summary)
    currentSummary.editedDocument = editedDocument

    // Mettre à jour le meeting avec le nouveau summary
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: JSON.stringify(currentSummary),
      },
    })

    // Convertir les JSON strings en objets pour la réponse
    return NextResponse.json({
      success: true,
      meeting: {
        id: updatedMeeting.id,
        status: updatedMeeting.status,
        title: updatedMeeting.title,
        audioPath: updatedMeeting.audioPath,
        transcript: JSON.parse(updatedMeeting.transcript),
        transcriptSegments: JSON.parse(updatedMeeting.transcriptSegments),
        suggestions: {
          topics: JSON.parse(updatedMeeting.topics),
          decisions: JSON.parse(updatedMeeting.decisions),
          actions: JSON.parse(updatedMeeting.actions),
        },
        summary: updatedMeeting.summary ? JSON.parse(updatedMeeting.summary) : undefined,
        duration: updatedMeeting.duration ?? undefined,
        createdAt: updatedMeeting.createdAt,
      },
    })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    )
  }
}
