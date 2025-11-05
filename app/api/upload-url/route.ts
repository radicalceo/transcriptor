import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * Génère une URL de upload direct client-side vers Vercel Blob
 * Cela contourne complètement la limite de 4.5MB des API routes
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get authenticated user
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel Blob Storage not configured',
        },
        { status: 500 }
      )
    }

    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validation côté serveur
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/mp4',
            'audio/m4a',
            'audio/wav',
            'audio/webm',
            'video/mp4',
            'video/webm',
          ],
          maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('✅ Blob uploaded:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error: any) {
    console.error('Error getting upload URL:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get upload URL' },
      { status: 500 }
    )
  }
}
