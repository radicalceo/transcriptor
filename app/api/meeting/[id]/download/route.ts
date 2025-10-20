import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params

    // Récupérer le meeting depuis la base de données
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { audioPath: true, title: true, createdAt: true }
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    if (!meeting.audioPath) {
      return NextResponse.json(
        { error: 'No audio file available for this meeting' },
        { status: 404 }
      )
    }

    // Vérifier que le fichier existe
    // Si le chemin est absolu, l'utiliser tel quel, sinon le joindre avec process.cwd()
    const filePath = path.isAbsolute(meeting.audioPath)
      ? meeting.audioPath
      : path.join(process.cwd(), meeting.audioPath)

    try {
      await fs.access(filePath)
    } catch (error) {
      return NextResponse.json(
        { error: 'Audio file not found on disk' },
        { status: 404 }
      )
    }

    // Lire le fichier
    const fileBuffer = await fs.readFile(filePath)

    // Déterminer le type MIME basé sur l'extension
    const extension = path.extname(meeting.audioPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
    }
    const mimeType = mimeTypes[extension] || 'application/octet-stream'

    // Créer un nom de fichier convivial
    const date = new Date(meeting.createdAt).toISOString().split('T')[0]
    const fileName = meeting.title
      ? `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_${date}${extension}`
      : `meeting_${meetingId.slice(0, 8)}_${date}${extension}`

    // Retourner le fichier avec les headers appropriés
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading audio:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
