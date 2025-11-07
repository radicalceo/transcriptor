'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Wrapper page that detects the meeting type and redirects to the appropriate route
 */
export default function MeetingRouterPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const detectAndRedirect = async () => {
      try {
        // Fetch meeting to detect type
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (!data.success) {
          setError('Meeting not found')
          return
        }

        const meeting = data.meeting

        // Redirect to appropriate route based on type
        switch (meeting.type) {
          case 'audio-only':
            router.replace(`/meeting/audio-only/${meetingId}`)
            break
          case 'screen-share':
            router.replace(`/meeting/screen-share/${meetingId}`)
            break
          case 'upload':
            router.replace(`/meeting/upload/${meetingId}`)
            break
          default:
            // Fallback for legacy 'live' type -> assume audio-only
            router.replace(`/meeting/audio-only/${meetingId}`)
        }
      } catch (error) {
        console.error('Error detecting meeting type:', error)
        setError('Failed to load meeting')
      }
    }

    detectAndRedirect()
  }, [meetingId, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-indigo-600 hover:underline"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}
