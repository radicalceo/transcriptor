import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { Readable } from 'stream'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Set ffmpeg and ffprobe paths
// Workaround for Turbopack/Next.js issue with native binaries
const cwd = process.cwd()
const ffmpegPath = path.join(cwd, 'node_modules', 'ffmpeg-static', 'ffmpeg')
const ffprobePath = path.join(cwd, 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe')

console.log('🎬 Setting ffmpeg path:', ffmpegPath)
console.log('🔍 Setting ffprobe path:', ffprobePath)

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

interface AudioChunk {
  buffer: Buffer
  startTime: number // in seconds
  duration: number // in seconds
}

/**
 * Get audio duration in seconds
 */
async function getAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      const duration = metadata.format.duration
      if (!duration) {
        reject(new Error('Could not determine audio duration'))
        return
      }
      resolve(duration)
    })
  })
}

/**
 * Extract audio chunk between start and end time
 */
async function extractChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

/**
 * Split audio file into chunks of approximately targetSize (in bytes)
 * Returns array of audio chunks with their timing information
 */
export async function splitAudioFile(
  fileBuffer: Buffer,
  targetSize: number = 20 * 1024 * 1024, // 20MB default
  fileExtension: string = 'mp3'
): Promise<AudioChunk[]> {
  const tempDir = path.join(tmpdir(), 'audio-chunks-' + Date.now())
  const inputPath = path.join(tempDir, `input.${fileExtension}`)

  try {
    // Create temp directory
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // Write input buffer to temp file
    await writeFile(inputPath, fileBuffer)

    // Get total duration
    const totalDuration = await getAudioDuration(inputPath)

    // Estimate chunk duration based on file size and target size
    const fileSizeRatio = targetSize / fileBuffer.length
    const chunkDuration = Math.floor(totalDuration * fileSizeRatio)

    // Ensure minimum chunk duration of 30 seconds
    const effectiveChunkDuration = Math.max(chunkDuration, 30)

    const chunks: AudioChunk[] = []
    let currentTime = 0

    // Split into chunks
    while (currentTime < totalDuration) {
      const remainingTime = totalDuration - currentTime
      const duration = Math.min(effectiveChunkDuration, remainingTime)

      const chunkPath = path.join(tempDir, `chunk-${chunks.length}.${fileExtension}`)

      await extractChunk(inputPath, chunkPath, currentTime, duration)

      // Read chunk file
      const fs = await import('fs/promises')
      const chunkBuffer = await fs.readFile(chunkPath)

      chunks.push({
        buffer: chunkBuffer,
        startTime: currentTime,
        duration: duration,
      })

      currentTime += duration
    }

    // Cleanup temp files
    await cleanupTempFiles(tempDir)

    return chunks
  } catch (error) {
    // Cleanup on error
    await cleanupTempFiles(tempDir)
    throw error
  }
}

/**
 * Cleanup temporary directory and files
 */
async function cleanupTempFiles(dirPath: string): Promise<void> {
  try {
    if (existsSync(dirPath)) {
      const fs = await import('fs/promises')
      const files = await fs.readdir(dirPath)

      for (const file of files) {
        await unlink(path.join(dirPath, file))
      }

      await fs.rmdir(dirPath)
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error)
  }
}

/**
 * Estimate if a file needs to be chunked
 */
export function needsChunking(fileSize: number, maxSize: number = 20 * 1024 * 1024): boolean {
  return fileSize > maxSize
}
