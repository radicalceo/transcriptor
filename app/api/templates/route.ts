import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/templates - List all available templates (system + user's custom templates)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from session
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get all system templates (isDefault=true, userId=null) + user's custom templates
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { isDefault: true, userId: null },
          { userId: user.id },
        ],
      },
      orderBy: [
        { isDefault: 'desc' }, // System templates first
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new custom template
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

    const { name, description, structure } = await request.json()

    if (!name || !structure) {
      return NextResponse.json(
        { success: false, error: 'Name and structure are required' },
        { status: 400 }
      )
    }

    const template = await prisma.template.create({
      data: {
        name,
        description,
        structure: typeof structure === 'string' ? structure : JSON.stringify(structure),
        userId: user.id,
        isDefault: false,
      },
    })

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
