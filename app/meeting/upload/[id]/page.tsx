'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import type { Meeting } from '@/lib/types'
import {
  groupTranscriptSegments,
  formatTimestamp,
  type TranscriptBlock,
} from '@/lib/services/transcriptGrouping'

export default function UploadMeetingPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [transcript, setTranscript] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [wasProcessing, setWasProcessing] = useState(false) // Track if meeting was processing
  const [folders, setFolders] = useState<any[]>([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

  // Group transcript into blocks with timestamps
  const transcriptBlocks: TranscriptBlock[] = useMemo(() => {
    if (!meeting?.transcriptSegments || meeting.transcriptSegments.length === 0) {
      return []
    }
    return groupTranscriptSegments(meeting.transcriptSegments)
  }, [meeting?.transcriptSegments])

  // Handle title save
  const handleSaveTitle = async () => {
    if (!titleValue.trim()) return

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: titleValue.trim() }),
      })

      const data = await response.json()

      if (data.success) {
        setMeeting({ ...meeting!, title: titleValue.trim() })
        setEditingTitle(false)
      }
    } catch (error) {
      console.error('Error saving title:', error)
    }
  }

  // Handle folder change
  const handleFolderChange = async (folderId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: folderId || null }),
      })

      const data = await response.json()

      if (data.success) {
        setMeeting({ ...meeting!, folderId: folderId || null })
      }
    } catch (error) {
      console.error('Error changing folder:', error)
    }
  }

  // Load meeting data and poll for updates
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Failed to load meeting')
          setLoading(false)
          return
        }

        // Verify this is an upload meeting
        if (data.meeting.type !== 'upload') {
          router.replace(`/meeting/${data.meeting.type}/${meetingId}`)
          return
        }

        setMeeting(data.meeting)
        setTranscript(data.meeting.transcript)
        setTitleValue(data.meeting.title || '')
        setLoading(false)

        // Track if meeting is currently processing (for auto-redirect on completion)
        if (data.meeting.status === 'processing') {
          setWasProcessing(true)
        }
      } catch (error) {
        console.error('Error loading meeting:', error)
        setError('Failed to load meeting')
        setLoading(false)
      }
    }

    const loadFolders = async () => {
      try {
        const response = await fetch('/api/folders')
        const data = await response.json()

        if (data.success) {
          setFolders(data.folders)
        }
      } catch (error) {
        console.error('Error loading folders:', error)
      }
    }

    loadMeeting()
    loadFolders()

    // Poll meeting status every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (data.success) {
          const previousStatus = meeting?.status
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)

          // Only redirect if we transitioned from processing to completed
          if (wasProcessing && previousStatus === 'processing' && data.meeting.status === 'completed') {
            clearInterval(pollInterval)
            setTimeout(() => {
              router.push(`/summary/${meetingId}`)
            }, 1000)
          }
        }
      } catch (error) {
        console.error('Error polling meeting:', error)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [meetingId, router, wasProcessing, meeting?.status])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Erreur</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    )
  }

  const isProcessing = meeting?.status === 'processing'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => router.push(meeting?.status === 'completed' ? '/history' : '/')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                title={meeting?.status === 'completed' ? 'Retour à l\'historique' : 'Retour à l\'accueil'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="flex-1">
                {editingTitle ? (
                  <input
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle()
                      }
                      if (e.key === 'Escape') {
                        setEditingTitle(false)
                        setTitleValue(meeting?.title || '')
                      }
                    }}
                    onBlur={handleSaveTitle}
                    className="text-xl font-semibold bg-transparent border-b-2 border-indigo-500 text-gray-900 dark:text-white outline-none w-full max-w-md"
                    placeholder="Nom du meeting"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {meeting?.title || 'Traitement en cours'}
                    </h1>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                      title="Modifier le titre"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isProcessing ? '🔄 Transcription et analyse en cours...' : '✅ Traitement terminé'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Folder selector */}
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <select
                  value={meeting?.folderId || ''}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Non classé</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width Transcript */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isProcessing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Traitement en cours...
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Nous transcrivons votre fichier audio avec Whisper et analysons le contenu avec Claude.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Cette page se mettra à jour automatiquement. Vous serez redirigé vers le résumé une fois le traitement terminé.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transcript Display */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transcription
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {transcript.length > 0
                ? `${transcript.length} segments transcrits`
                : 'En attente de la transcription...'}
            </p>
          </div>

          <div className="p-6">
            {transcript.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  {isProcessing ? 'Transcription en cours...' : 'Aucune transcription disponible'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {transcriptBlocks.length > 0 ? (
                  transcriptBlocks.map((block, index) => (
                    <div key={index} className="border-l-4 border-indigo-500 pl-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                          {formatTimestamp(block.startTime)}
                        </span>
                        {block.speaker && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {block.speaker}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                        {block.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="space-y-3">
                    {transcript.map((text, index) => (
                      <p
                        key={index}
                        className="text-gray-900 dark:text-gray-100 leading-relaxed border-l-4 border-gray-300 dark:border-gray-600 pl-4"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Processing Stats */}
        {meeting && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Thèmes détectés</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {meeting.suggestions?.topics?.length || 0}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Décisions</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {meeting.suggestions?.decisions?.length || 0}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Actions</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {meeting.suggestions?.actions?.length || 0}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
