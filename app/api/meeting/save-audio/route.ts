import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

// Note: ffmpeg conversion is disabled on Vercel due to binary size limits
// Audio is stored in original format (webm/mp3) directly to Blob Storage

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioChunk = formData.get('audio') as File
    const meetingId = formData.get('meetingId') as string
    const isPartial = formData.get('isPartial') === 'true'

    if (!audioChunk || !meetingId) {
      return NextResponse.json(
        { error: 'Missing audio file or meeting ID' },
        { status: 400 }
      )
    }

    // Vérifier que le meeting existe
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Déterminer le nom du fichier et l'extension
    const originalFileName = audioChunk.name || 'audio.webm'
    const originalExtension = originalFileName.split('.').pop() || 'webm'

    // Pour les chunks partiels, utiliser un nom temporaire
    // Pour le chunk final, utiliser le nom définitif
    const fileName = isPartial
      ? `${meetingId}-temp.${originalExtension}`
      : `${meetingId}-live.${originalExtension}`

    console.log(`📝 Uploading audio ${isPartial ? 'chunk' : 'final file'} for meeting ${meetingId}`)

    // Upload vers Vercel Blob Storage
    const blob = await put(fileName, audioChunk, {
      access: 'public',
      addRandomSuffix: false, // Garder le même nom pour les chunks partiels
    })

    console.log(`✅ Audio uploaded to Blob Storage: ${blob.url}`)

    // Mettre à jour le meeting avec l'URL du blob
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { audioPath: blob.url }
    })

    return NextResponse.json({
      success: true,
      audioPath: blob.url,
      isPartial
    })
  } catch (error) {
    console.error('Error saving audio:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
