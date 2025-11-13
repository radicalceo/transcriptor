import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/folders - List all folders for the current user
export async function GET(request: NextRequest) {
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

    // Get all folders for this user with their meeting counts
    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { meetings: true },
        },
        parent: true,
        children: true,
      },
      orderBy: [
        { parentId: 'asc' }, // Root folders first
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, folders })
  } catch (error) {
    console.error('Error fetching folders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
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

    const { name, description, color, parentId } = await request.json()

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // If parentId is provided, verify it exists and belongs to the user
    if (parentId) {
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
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        description,
        color,
        parentId,
        userId: user.id,
      },
      include: {
        _count: {
          select: { meetings: true },
        },
      },
    })

    return NextResponse.json({ success: true, folder })
  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
