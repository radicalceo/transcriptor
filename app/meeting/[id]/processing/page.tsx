'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function ProcessingPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const meetingId = params.id as string
  const [timeElapsed, setTimeElapsed] = useState(0)

  // Timer pour afficher le temps écoulé
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // State for error handling
  const [meetingStatus, setMeetingStatus] = useState<string>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Poll le statut du meeting toutes les 5 secondes
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (data.success) {
          setMeetingStatus(data.meeting.status)

          if (data.meeting.status === 'completed' && data.meeting.summary) {
            // Si le résumé est prêt, rediriger vers la page de résumé
            router.push(`/summary/${meetingId}`)
          } else if (data.meeting.status === 'error') {
            // Si erreur, arrêter le polling et afficher l'erreur
            setErrorMessage(data.meeting.notes || 'Une erreur est survenue lors de la génération du résumé')
            return 'stop'
          }
        }
      } catch (error) {
        console.error('Error checking meeting status:', error)
      }
    }

    // Check immédiatement
    checkStatus()

    // Puis toutes les 5 secondes
    const interval = setInterval(async () => {
      const result = await checkStatus()
      if (result === 'stop') {
        clearInterval(interval)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [meetingId, router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show error state
  if (meetingStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
            {/* Error Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-12 h-12 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Erreur lors de la génération
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Une erreur est survenue lors de l&apos;analyse de votre réunion.
              </p>

              {/* Error Details */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 dark:text-red-300 text-left">
                  {errorMessage}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  setMeetingStatus('processing')
                  setErrorMessage('')
                  // Retry summary generation
                  try {
                    await fetch('/api/summary', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ meetingId, async: true, force: true })
                    })
                  } catch (error) {
                    console.error('Error retrying:', error)
                  }
                }}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => router.push('/history')}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Voir l&apos;historique
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Animated Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="animate-spin rounded-full h-24 w-24 border-4 border-indigo-200 border-t-indigo-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-indigo-600 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Main Message */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Analyse en cours...
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              Claude analyse votre réunion et génère un résumé détaillé.
            </p>

            {/* Timer */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-mono font-medium">{formatTime(timeElapsed)}</span>
            </div>
          </div>

          {/* Email Notification */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-6 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Vous recevrez un email
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Dès que le résumé sera prêt, nous vous enverrons un email à{' '}
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    {session?.user?.email || 'votre adresse'}
                  </span>{' '}
                  avec un lien direct vers le résumé.
                </p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Transcription terminée
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Analyse IA en cours (topics, décisions, actions)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-500">
                Génération du résumé final
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Cette page se mettra à jour automatiquement</p>
                <p className="text-blue-700 dark:text-blue-400">
                  Vous n&apos;avez rien à faire. Vous pouvez fermer cet onglet en toute sécurité et consulter votre résumé plus tard via l&apos;email ou l&apos;historique.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => router.push('/history')}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Voir l&apos;historique
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Nouveau meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
