import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * Génère une URL de upload direct client-side vers Vercel Blob
 * Cela contourne complètement la limite de 4.5MB des API routes
 */
export async function POST(request: Request) {
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

    const { filename } = await request.json()

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename is required' },
        { status: 400 }
      )
    }

    // Générer une URL de upload signée
    const response = await fetch(
      `https://blob.vercel-storage.com/upload?filename=${encodeURIComponent(filename)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
        body: JSON.stringify({
          access: 'public',
          addRandomSuffix: true,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.statusText}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      uploadUrl: data.url,
      blobUrl: data.downloadUrl,
    })
  } catch (error: any) {
    console.error('Error getting upload URL:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get upload URL' },
      { status: 500 }
    )
  }
}
