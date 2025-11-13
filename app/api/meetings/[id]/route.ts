import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/session'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { title, folderId } = body

    if (title === undefined && folderId === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one field is required (title or folderId)' },
        { status: 400 }
      )
    }

    // Check if meeting belongs to user
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    if (meeting.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 403 }
      )
    }

    // If folderId is provided and not null, verify it exists and belongs to user
    if (folderId !== undefined && folderId !== null) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          userId: user.id,
        },
      })

      if (!folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (folderId !== undefined) updateData.folderId = folderId

    // Update meeting
    const updatedMeeting = await prisma.meeting.update({
      where: { id },
      data: updateData,
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

    const { id } = await params

    // Check if meeting exists and belongs to user
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    if (meeting.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 403 }
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
