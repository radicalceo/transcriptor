import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

// Fonction pour obtenir les chemins ffmpeg (appelée dynamiquement pour éviter les problèmes avec Turbopack)
function getFfmpegPaths() {
  const cwd = process.cwd()
  const ffmpegPath = path.join(cwd, 'node_modules', 'ffmpeg-static', 'ffmpeg')
  const ffprobePath = path.join(
    cwd,
    'node_modules',
    'ffprobe-static',
    'bin',
    process.platform === 'darwin' ? 'darwin' : 'linux',
    process.arch,
    'ffprobe'
  )

  console.log('🎬 Dynamic ffmpeg path:', ffmpegPath)
  console.log('🔍 Dynamic ffprobe path:', ffprobePath)

  return { ffmpegPath, ffprobePath }
}

async function convertToMP3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Obtenir les chemins dynamiquement
    const { ffmpegPath, ffprobePath } = getFfmpegPaths()

    // Configurer la commande avec les bons chemins
    const command = ffmpeg(inputPath)
    command.setFfmpegPath(ffmpegPath)
    command.setFfprobePath(ffprobePath)

    command
      .audioCodec('libmp3lame')
      .audioBitrate('96k')
      .audioChannels(1) // Mono pour économiser de l'espace (suffisant pour la voix)
      .audioFrequency(44100)
      .format('mp3')
      .on('start', (cmd) => {
        console.log('🎬 Starting conversion with ffmpeg:', ffmpegPath)
        console.log('📝 Command:', cmd)
      })
      .on('end', () => {
        console.log('✅ Conversion to MP3 completed')
        resolve()
      })
      .on('error', (err) => {
        console.error('❌ Conversion error:', err)
        reject(err)
      })
      .save(outputPath)
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioChunk = formData.get('audio') as File
    const meetingId = formData.get('meetingId') as string
    const isPartial = formData.get('isPartial') === 'true' // Nouveau: chunk partiel ou final

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

    // Créer le dossier uploads s'il n'existe pas
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads')
    try {
      await fs.mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Dossier existe déjà, c'est OK
    }

    // Définir le chemin du fichier temporaire (avec extension originale)
    const originalFileName = audioChunk.name || 'audio.webm'
    const originalExtension = originalFileName.split('.').pop() || 'webm'
    const tempFileName = `${meetingId}-temp.${originalExtension}`
    const tempFilePath = path.join(uploadsDir, tempFileName)

    const arrayBuffer = await audioChunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Si c'est un chunk partiel, ajouter au fichier existant (append)
    // Sinon, écraser le fichier (cas final ou première écriture)
    if (isPartial) {
      await fs.appendFile(tempFilePath, buffer)
      console.log(`📝 Audio chunk appended for meeting ${meetingId} (${buffer.length} bytes)`)

      // Pour les chunks partiels, on ne convertit pas encore
      // Mettre à jour avec le chemin temporaire
      const tempRelativePath = `data/uploads/${tempFileName}`
      if (!meeting.audioPath) {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { audioPath: tempRelativePath }
        })
      }

      return NextResponse.json({
        success: true,
        audioPath: tempRelativePath
      })
    } else {
      // C'est le fichier final
      await fs.writeFile(tempFilePath, buffer)
      console.log(`✅ Final audio saved for meeting ${meetingId}`)

      // Convertir en MP3 si ce n'est pas déjà un MP3
      const finalFileName = `${meetingId}-live.mp3`
      const finalFilePath = path.join(uploadsDir, finalFileName)
      const finalRelativePath = `data/uploads/${finalFileName}`

      if (originalExtension !== 'mp3') {
        console.log(`🔄 Converting ${originalExtension} to MP3...`)
        try {
          await convertToMP3(tempFilePath, finalFilePath)
          // Supprimer le fichier temporaire après conversion
          await fs.unlink(tempFilePath)
          console.log(`✅ Conversion completed, temp file deleted`)
        } catch (error) {
          console.error('❌ Conversion failed, keeping original file:', error)
          // Si la conversion échoue, renommer le fichier temp en final
          await fs.rename(tempFilePath, finalFilePath.replace('.mp3', `.${originalExtension}`))
          const fallbackPath = `data/uploads/${meetingId}-live.${originalExtension}`
          await prisma.meeting.update({
            where: { id: meetingId },
            data: { audioPath: fallbackPath }
          })
          return NextResponse.json({
            success: true,
            audioPath: fallbackPath,
            warning: 'Conversion to MP3 failed, original format kept'
          })
        }
      } else {
        // Déjà en MP3, juste renommer
        await fs.rename(tempFilePath, finalFilePath)
      }

      // Mettre à jour le meeting avec le chemin final MP3
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { audioPath: finalRelativePath }
      })

      return NextResponse.json({
        success: true,
        audioPath: finalRelativePath
      })
    }
  } catch (error) {
    console.error('Error saving audio:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
