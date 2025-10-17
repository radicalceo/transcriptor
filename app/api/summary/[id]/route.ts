import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingStore } from '@/lib/services/meetingStore'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { summary } = await request.json()

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary required' },
        { status: 400 }
      )
    }

    // Update in database
    await prisma.meeting.update({
      where: { id },
      data: {
        summary: JSON.stringify(summary),
        topics: JSON.stringify(summary.topics || []),
        decisions: JSON.stringify(summary.decisions || []),
        actions: JSON.stringify(summary.actions || []),
      },
    })

    // Also update in memory store if exists
    if (meetingStore.get(id)) {
      meetingStore.setSummary(id, summary)
    }

    return NextResponse.json({
      success: true,
      message: 'Summary updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating summary:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update summary' },
      { status: 500 }
    )
  }
}
