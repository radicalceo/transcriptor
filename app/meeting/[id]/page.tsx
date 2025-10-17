'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import SuggestionsPanel from '@/components/SuggestionsPanel'
import type { Meeting, Suggestions } from '@/lib/types'
import {
  groupTranscriptSegments,
  formatTimestamp,
  type TranscriptBlock,
} from '@/lib/services/transcriptGrouping'

export default function MeetingPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Suggestions>({
    topics: [],
    decisions: [],
    actions: [],
  })
  const [isEnding, setIsEnding] = useState(false)
  const [isUploadedFile, setIsUploadedFile] = useState(false)
  const [showDetailedSegments, setShowDetailedSegments] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Load meeting data
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)
          setSuggestions(data.meeting.suggestions)

          // Détecter si c'est un fichier uploadé (status initial = processing)
          if (data.meeting.status === 'processing') {
            setIsUploadedFile(true)
          }
        }
      } catch (error) {
        console.error('Error loading meeting:', error)
      }
    }
    loadMeeting()

    // Poll meeting data if processing
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          const prevStatus = meeting?.status
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)
          setSuggestions(data.meeting.suggestions)

          // Si c'était un upload et que le statut passe à 'completed', rediriger vers le résumé
          if (
            isUploadedFile &&
            prevStatus === 'processing' &&
            data.meeting.status === 'completed'
          ) {
            console.log('🎉 Upload processing completed, redirecting to summary...')
            router.push(`/summary/${meetingId}`)
          }
        }
      } catch (error) {
        console.error('Error polling meeting:', error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [meetingId, meeting?.status, isUploadedFile, router])

  // Start recording (only for live mode, not for completed uploads)
  useEffect(() => {
    if (!meeting || isRecording) return
    if (meeting.status === 'processing' || meeting.status === 'completed') return // Skip mic for uploads and completed meetings

    const startRecording = async () => {
      try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        // Setup Web Speech API for transcription (Chrome/Edge)
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition =
            (window as any).webkitSpeechRecognition ||
            (window as any).SpeechRecognition
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = 'fr-FR'

          recognition.onresult = async (event: any) => {
            const current = event.resultIndex
            const transcriptText = event.results[current][0].transcript

            if (event.results[current].isFinal) {
              // Final transcript - send to API
              setTranscript((prev) => [...prev, transcriptText])

              try {
                await fetch(`/api/meeting/${meetingId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transcript: transcriptText }),
                })
              } catch (error) {
                console.error('Error sending transcript:', error)
              }
            }
          }

          recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error)
          }

          recognition.start()
          recognitionRef.current = recognition
          setIsRecording(true)
        } else {
          alert(
            'La reconnaissance vocale n\'est pas supportée par votre navigateur. Utilisez Chrome ou Edge.'
          )
        }

        // Setup MediaRecorder for audio recording (optional - for future upload)
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
      } catch (error) {
        console.error('Error starting recording:', error)
        alert('Impossible d\'accéder au microphone')
      }
    }

    startRecording()

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [meeting, meetingId, isRecording])

  // Poll for suggestions every 5 seconds
  useEffect(() => {
    if (!isRecording || !meetingId) return

    const pollSuggestions = async () => {
      try {
        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId }),
        })

        const data = await response.json()
        if (data.success) {
          setSuggestions(data.suggestions)
        }
      } catch (error) {
        console.error('Error polling suggestions:', error)
      }
    }

    pollIntervalRef.current = setInterval(pollSuggestions, 5000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [isRecording, meetingId])

  // Group transcript segments for better display
  const transcriptBlocks = useMemo(() => {
    if (meeting?.transcriptSegments && meeting.transcriptSegments.length > 0) {
      return groupTranscriptSegments(meeting.transcriptSegments)
    }
    return null
  }, [meeting?.transcriptSegments])

  // Auto-scroll transcript only if user is at bottom (and not viewing completed transcript)
  useEffect(() => {
    // Don't auto-scroll for completed meetings (viewing past transcripts)
    if (!transcriptRef.current || meeting?.status === 'completed') return

    const element = transcriptRef.current
    const { scrollTop, scrollHeight, clientHeight } = element

    // Check if user is already at bottom (within 100px threshold)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100

    // Only auto-scroll if user is at bottom or hasn't scrolled yet
    if (isAtBottom || scrollTop === 0) {
      element.scrollTop = element.scrollHeight
    }
  }, [transcript, transcriptBlocks, meeting?.status])

  const handleEndMeeting = async () => {
    setIsEnding(true)

    // Stop recording
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    setIsRecording(false)

    try {
      // Generate summary
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })

      const data = await response.json()
      if (data.success) {
        router.push(`/summary/${meetingId}`)
      } else {
        alert('Erreur lors de la génération du résumé')
        setIsEnding(false)
      }
    } catch (error) {
      console.error('Error ending meeting:', error)
      alert('Erreur lors de la génération du résumé')
      setIsEnding(false)
    }
  }

  const handleUpdateSuggestions = (updated: Suggestions) => {
    setSuggestions(updated)
    // Could save to API here
  }

  if (!meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/history')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title="Retour à l'historique"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {meeting.title ||
                  (meeting.status === 'processing'
                    ? 'Traitement en cours'
                    : meeting.status === 'completed'
                      ? 'Transcript'
                      : 'Meeting en cours')}
              </h1>
              {meeting.duration && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Durée: {Math.floor(meeting.duration / 60)}:
                  {(meeting.duration % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>
            {meeting.status === 'processing' && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm font-medium">Transcription audio...</span>
              </div>
            )}
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium">Enregistrement</span>
              </div>
            )}
          </div>

          {meeting.status === 'completed' && meeting.summary ? (
            <button
              onClick={() => router.push(`/summary/${meetingId}`)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Voir le résumé
            </button>
          ) : (
            <button
              onClick={handleEndMeeting}
              disabled={isEnding || meeting.status === 'processing'}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {isEnding
                ? 'Génération du résumé...'
                : meeting.status === 'processing'
                  ? 'Traitement en cours...'
                  : 'Terminer le meeting'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Transcript panel */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transcription en direct
            </h2>
            {meeting.transcriptSegments && meeting.transcriptSegments.length > 0 && (
              <button
                onClick={() => setShowDetailedSegments(!showDetailedSegments)}
                className="text-sm px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {showDetailedSegments ? 'Vue groupée' : 'Vue détaillée'}
              </button>
            )}
          </div>
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {meeting.status === 'processing' && transcript.length === 0 ? (
              <div className="text-center mt-8 space-y-4">
                <div className="animate-pulse bg-blue-50 dark:bg-blue-900/20 rounded-xl p-8 max-w-md mx-auto">
                  <svg
                    className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <p className="text-blue-900 dark:text-blue-100 font-medium mb-2">
                    Transcription en cours avec Whisper
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    Cela peut prendre quelques minutes selon la longueur de l&apos;audio...
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-4">
                    La transcription apparaîtra automatiquement ici
                  </p>
                </div>
              </div>
            ) : showDetailedSegments && meeting.transcriptSegments && meeting.transcriptSegments.length > 0 ? (
              // Vue détaillée : tous les segments individuels
              meeting.transcriptSegments.map((segment, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {formatTimestamp(segment.timestamp || 0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {segment.speaker && (
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                          {segment.speaker}
                        </p>
                      )}
                      <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : transcriptBlocks && transcriptBlocks.length > 0 ? (
              // Vue groupée : blocs regroupés par pauses
              transcriptBlocks.map((block, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                        {formatTimestamp(block.startTime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {block.speaker && (
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                          {block.speaker}
                        </p>
                      )}
                      <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                        {block.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : transcript.length === 0 ? (
              <p className="text-gray-500 italic text-center mt-8">
                En attente de parole...
              </p>
            ) : (
              // Fallback: Display simple transcript (for live recording)
              transcript.map((text, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                >
                  <p className="text-gray-900 dark:text-gray-100">{text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Suggestions panel */}
        <div className="w-96">
          <SuggestionsPanel
            suggestions={suggestions}
            onUpdate={handleUpdateSuggestions}
          />
        </div>
      </div>
    </div>
  )
}
