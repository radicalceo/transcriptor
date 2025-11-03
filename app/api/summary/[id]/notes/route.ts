import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { rawNotes, enhancedNotes } = body

    // Récupérer le meeting actuel
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Parse le summary actuel
    const currentSummary = meeting.summary ? JSON.parse(meeting.summary) : {}

    // Mettre à jour uniquement les notes spécifiées
    if (rawNotes !== undefined) {
      currentSummary.rawNotes = rawNotes
    }

    if (enhancedNotes !== undefined) {
      currentSummary.enhancedNotes = enhancedNotes
    }

    // Sauvegarder le summary mis à jour
    await prisma.meeting.update({
      where: { id },
      data: {
        summary: JSON.stringify(currentSummary),
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error updating notes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notes' },
      { status: 500 }
    )
  }
}
