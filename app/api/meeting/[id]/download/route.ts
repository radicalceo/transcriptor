import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params

    // Récupérer le meeting depuis la base de données
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { audioPath: true, audioChunks: true, title: true, createdAt: true }
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Parse audioChunks array
    const chunkUrls = JSON.parse(meeting.audioChunks || '[]') as string[]

    // If we have multiple chunks, concatenate them
    if (chunkUrls.length > 0) {
      console.log(`🔗 Fetching ${chunkUrls.length} audio chunks for concatenation`)

      // Fetch all chunks in parallel
      const chunkBuffers = await Promise.all(
        chunkUrls.map(async (url) => {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch chunk: ${url}`)
          }
          return response.arrayBuffer()
        })
      )

      // Concatenate all chunks into a single buffer
      const totalLength = chunkBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
      const concatenated = new Uint8Array(totalLength)
      let offset = 0
      for (const buffer of chunkBuffers) {
        concatenated.set(new Uint8Array(buffer), offset)
        offset += buffer.byteLength
      }

      console.log(`✅ Concatenated ${chunkUrls.length} chunks into ${(totalLength / 1024 / 1024).toFixed(2)}MB file`)

      // Determine MIME type from first chunk URL
      const firstChunkUrl = chunkUrls[0]
      const extension = firstChunkUrl.split('.').pop()?.toLowerCase() || 'webm'
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'mp4': 'audio/mp4',
        'm4a': 'audio/mp4',
        'wav': 'audio/wav',
        'webm': 'audio/webm',
        'ogg': 'audio/ogg',
      }
      const mimeType = mimeTypes[extension] || 'audio/webm'

      // Create a friendly filename
      const date = new Date(meeting.createdAt).toISOString().split('T')[0]
      const fileName = meeting.title
        ? `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_${date}.${extension}`
        : `meeting_${meetingId.slice(0, 8)}_${date}.${extension}`

      // Return the concatenated file
      return new NextResponse(concatenated, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': totalLength.toString(),
        },
      })
    }

    // Legacy path: single audioPath file (for backward compatibility and uploads)
    if (!meeting.audioPath) {
      return NextResponse.json(
        { error: 'No audio file available for this meeting' },
        { status: 404 }
      )
    }

    // Check if audioPath is a URL (Vercel Blob) or a local path
    const isUrl = meeting.audioPath.startsWith('http://') || meeting.audioPath.startsWith('https://')

    if (isUrl) {
      // Vercel Blob: redirect to the blob URL
      // The blob URL is already public and downloadable
      console.log('🔗 Redirecting to Blob Storage URL:', meeting.audioPath)
      return NextResponse.redirect(meeting.audioPath)
    }

    // Legacy: local file system (for development/backward compatibility)
    const fs = await import('fs/promises')
    const path = await import('path')

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
