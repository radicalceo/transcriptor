import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/folders/[id] - Get a specific folder with its meetings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const { id: folderId } = await params

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: user.id,
      },
      include: {
        meetings: {
          orderBy: { createdAt: 'desc' },
        },
        parent: true,
        children: true,
        _count: {
          select: { meetings: true },
        },
      },
    })

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, folder })
  } catch (error) {
    console.error('Error fetching folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folder' },
      { status: 500 }
    )
  }
}

// PATCH /api/folders/[id] - Update a folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const { id: folderId } = await params
    const { name, description, color, parentId } = await request.json()

    // Verify folder exists and belongs to user
    const existingFolder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: user.id,
      },
    })

    if (!existingFolder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    // If parentId is changing, verify new parent exists and belongs to user
    // Also prevent circular references
    if (parentId !== undefined && parentId !== existingFolder.parentId) {
      if (parentId !== null) {
        const parentFolder = await prisma.folder.findFirst({
          where: {
            id: parentId,
            userId: user.id,
          },
        })

        if (!parentFolder) {
          return NextResponse.json(
            { success: false, error: 'Parent folder not found' },
            { status: 404 }
          )
        }

        // Prevent setting a child as parent (circular reference)
        if (parentId === folderId) {
          return NextResponse.json(
            { success: false, error: 'Cannot set folder as its own parent' },
            { status: 400 }
          )
        }

        // Check if parentId is a descendant of folderId (would create a cycle)
        let current = parentFolder
        while (current.parentId) {
          if (current.parentId === folderId) {
            return NextResponse.json(
              { success: false, error: 'Cannot create circular folder structure' },
              { status: 400 }
            )
          }
          const next = await prisma.folder.findUnique({
            where: { id: current.parentId },
          })
          if (!next) break
          current = next
        }
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (parentId !== undefined) updateData.parentId = parentId

    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: updateData,
      include: {
        _count: {
          select: { meetings: true },
        },
      },
    })

    return NextResponse.json({ success: true, folder })
  } catch (error) {
    console.error('Error updating folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update folder' },
      { status: 500 }
    )
  }
}

// DELETE /api/folders/[id] - Delete a folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const { id: folderId } = await params

    // Verify folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: user.id,
      },
      include: {
        _count: {
          select: { meetings: true, children: true },
        },
      },
    })

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    // Check if folder has meetings or children
    if (folder._count.meetings > 0 || folder._count.children > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete folder with meetings or subfolders',
          hasContent: true,
        },
        { status: 400 }
      )
    }

    await prisma.folder.delete({
      where: { id: folderId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
