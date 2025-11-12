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
    const chunkIndex = formData.get('chunkIndex') as string

    if (!audioChunk || !meetingId || !chunkIndex) {
      return NextResponse.json(
        { error: 'Missing audio file, meeting ID, or chunk index' },
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

    // Utiliser un nom de chunk numéroté pour permettre la concaténation
    const fileName = `${meetingId}-chunk-${chunkIndex}.${originalExtension}`

    console.log(`📝 Uploading audio chunk ${chunkIndex} for meeting ${meetingId}`)

    // Upload vers Vercel Blob Storage
    const blob = await put(fileName, audioChunk, {
      access: 'public',
      addRandomSuffix: false, // Pas de suffix pour garder l'ordre des chunks
      allowOverwrite: true, // Permettre l'écrasement des chunks (au cas où)
    })

    console.log(`✅ Audio chunk ${chunkIndex} uploaded to Blob Storage: ${blob.url}`)

    // Récupérer les chunks existants et ajouter le nouveau
    const existingChunks = JSON.parse(meeting.audioChunks || '[]') as string[]
    const chunkIndexNum = parseInt(chunkIndex, 10)

    // Insérer ou remplacer le chunk à l'index approprié
    existingChunks[chunkIndexNum] = blob.url

    // Mettre à jour le meeting avec le nouveau tableau de chunks
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        audioChunks: JSON.stringify(existingChunks),
        audioPath: blob.url // Garder le dernier chunk pour compatibilité
      }
    })

    return NextResponse.json({
      success: true,
      chunkUrl: blob.url,
      chunkIndex: chunkIndexNum
    })
  } catch (error) {
    console.error('Error saving audio chunk:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
