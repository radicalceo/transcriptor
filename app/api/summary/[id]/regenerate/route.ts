import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateFinalSummary } from '@/lib/services/claudeService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId } = await params
    const { templateId } = await request.json()

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get meeting (must belong to the user)
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        userId: user.id,
      },
    })

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Get template (must be system template or user's template)
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        OR: [
          { isDefault: true, userId: null },
          { userId: user.id },
        ],
      },
    })

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Update meeting status
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'processing' },
    })

    // Parse transcript and suggestions
    const transcript = JSON.parse(meeting.transcript)
    const suggestions = {
      topics: JSON.parse(meeting.topics),
      decisions: JSON.parse(meeting.decisions),
      actions: JSON.parse(meeting.actions),
    }

    // Parse template structure
    const templateStructure = JSON.parse(template.structure)

    // Generate new summary with template
    console.log(`🔄 Regenerating summary with template: ${template.name}`)
    const summary = await generateFinalSummary(
      transcript,
      suggestions,
      meeting.notes || undefined,
      templateStructure // Pass template structure
    )

    // Save new summary and update templateId
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: JSON.stringify(summary),
        templateId: template.id,
        topics: JSON.stringify(summary.topics.slice(0, 8)),
        decisions: JSON.stringify(summary.decisions.slice(0, 10)),
        actions: JSON.stringify(summary.actions.slice(0, 15)),
        status: 'completed',
      },
    })

    return NextResponse.json({
      success: true,
      summary,
      template: {
        id: template.id,
        name: template.name,
      },
    })
  } catch (error) {
    console.error('Error regenerating summary:', error)

    // Try to update status back to completed
    try {
      const { id: meetingId } = await params
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'completed' },
      })
    } catch (updateError) {
      console.error('Failed to update meeting status:', updateError)
    }

    return NextResponse.json(
      { success: false, error: 'Failed to regenerate summary' },
      { status: 500 }
    )
  }
}
