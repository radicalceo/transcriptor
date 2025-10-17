import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title } = body

    if (title === undefined) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    // Update meeting title
    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: { title },
    })

    return NextResponse.json({
      success: true,
      meeting: updatedMeeting,
    })
  } catch (error: any) {
    console.error('Error updating meeting:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update meeting' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Delete associated audio file if it exists
    if (meeting.audioPath) {
      try {
        const audioFilePath = path.join(process.cwd(), 'public', meeting.audioPath)
        await fs.unlink(audioFilePath)
      } catch (error) {
        console.error('Error deleting audio file:', error)
        // Continue even if file deletion fails
      }
    }

    // Delete meeting from database
    await prisma.meeting.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Meeting deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting meeting:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete meeting' },
      { status: 500 }
    )
  }
}
