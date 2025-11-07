import { join } from 'path'
import { mkdir } from 'fs/promises'

/**
 * Get the temporary directory path that works both locally and on Vercel
 * Vercel (AWS Lambda) requires /tmp, while local dev can use process.cwd()/data/temp
 */
export function getTempDir(): string {
  // On Vercel/serverless environments, use /tmp which is writable
  // Otherwise use local data/temp directory
  const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME

  if (isVercel) {
    return '/tmp'
  }

  return join(process.cwd(), 'data', 'temp')
}

/**
 * Ensure the temp directory exists
 */
export async function ensureTempDir(): Promise<string> {
  const tempDir = getTempDir()

  try {
    await mkdir(tempDir, { recursive: true })
  } catch (error: any) {
    // Ignore error if directory already exists or on read-only filesystem
    if (error?.code !== 'EEXIST') {
      console.warn(`Warning: Could not create temp directory: ${error?.message}`)
    }
  }

  return tempDir
}
