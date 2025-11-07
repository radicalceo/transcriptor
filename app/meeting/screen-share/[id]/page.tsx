'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import RichTextEditor from '@/components/RichTextEditor'
import type { Meeting } from '@/lib/types'

export default function ScreenShareMeetingPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [interimTranscript, setInterimTranscript] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isEnding, setIsEnding] = useState(false)
  const [isRequestingScreenShare, setIsRequestingScreenShare] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const lastNotesUpdateRef = useRef<number>(0)
  const audioChunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<Blob[]>([])
  const isRecordingRef = useRef<boolean>(false)
  const micStreamRef = useRef<MediaStream | null>(null)
  const tabStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastSpeechRestartRef = useRef<number>(0)

  // Load meeting data
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/screen-share/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)
          setNotes(data.meeting.notes || '')
        }
      } catch (error) {
        console.error('Error loading meeting:', error)
      }
    }
    loadMeeting()

    // Poll meeting data
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/screen-share/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)

          const timeSinceLastUpdate = Date.now() - lastNotesUpdateRef.current
          if (timeSinceLastUpdate > 5000) {
            setNotes(data.meeting.notes || '')
          }
        }
      } catch (error) {
        console.error('Error polling meeting:', error)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [meetingId])

  // Start recording (screen-share mode - microphone + tab audio)
  useEffect(() => {
    console.log('🔍 Recording useEffect triggered', {
      isRecordingRef: isRecordingRef.current,
      hasMeeting: !!meeting,
      meetingStatus: meeting?.status,
    })

    if (isRecordingRef.current) {
      console.log('⏭️ Already recording, skipping')
      return
    }
    if (!meeting) {
      console.log('⏭️ No meeting yet, skipping')
      return
    }
    if (meeting.status !== 'active') {
      console.log('⏭️ Meeting not active, skipping')
      return
    }

    console.log('✅ All conditions met, starting screen-share recording...')

    const startRecording = async () => {
      try {
        // Get microphone stream
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        })

        micStreamRef.current = micStream
        console.log('✅ Microphone ready')

        let combinedStream: MediaStream

        // Capture tab audio with screen share
        try {
          setIsRequestingScreenShare(true)

          const getDisplayMediaWithTimeout = () => {
            return Promise.race([
              navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                },
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: screen share selection took too long')), 60000)
              ),
            ]) as Promise<MediaStream>
          }

          const tabStream = await getDisplayMediaWithTimeout()
          setIsRequestingScreenShare(false)
          console.log(`✅ Tab audio ready (${tabStream.getAudioTracks().length} tracks)`)

          // Stop video track immediately (we only want audio)
          tabStream.getVideoTracks().forEach(track => {
            track.stop()
          })

          tabStreamRef.current = tabStream

          if (tabStream.getAudioTracks().length === 0) {
            console.warn('⚠️ No audio track in shared tab')
            throw new Error('Aucune piste audio dans le partage. Assurez-vous de cocher "Partager l\'audio".')
          }

          // Mix microphone + tab audio with Web Audio API
          const audioContext = new AudioContext()
          audioContextRef.current = audioContext

          const destination = audioContext.createMediaStreamDestination()

          const micSource = audioContext.createMediaStreamSource(micStream)
          micSource.connect(destination)

          const tabSource = audioContext.createMediaStreamSource(tabStream)
          tabSource.connect(destination)

          combinedStream = destination.stream
          console.log('✅ Audio streams mixed (mic + tab)')

          // Detect if user stops screen sharing
          const firstAudioTrack = tabStream.getAudioTracks()[0]
          if (firstAudioTrack) {
            firstAudioTrack.onended = () => {
              alert('Le partage audio de l\'onglet a été arrêté. Seul le microphone sera enregistré.')
            }
          }
        } catch (error: any) {
          setIsRequestingScreenShare(false)
          console.error('Error capturing tab audio:', error)

          if (error.name === 'NotAllowedError') {
            console.log('User cancelled screen share')
            micStream.getTracks().forEach(track => track.stop())
            alert('Partage d\'écran annulé. Veuillez réessayer.')
            return
          } else if (error.name === 'NotFoundError') {
            alert('Impossible de trouver un onglet avec audio.')
          } else {
            const errorMsg = error.message || 'Erreur inconnue'
            alert(`Impossible de capturer l'audio de l'onglet: ${errorMsg}\n\nSeul le microphone sera utilisé.`)
          }

          combinedStream = micStream
        }

        // Setup Web Speech API for transcription
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
            const isFinal = event.results[current].isFinal

            if (isFinal) {
              console.log(`🎤 Final transcript: "${transcriptText}"`)
              setTranscript((prev) => [...prev, transcriptText])
              setInterimTranscript('')

              try {
                await fetch(`/api/screen-share/${meetingId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transcript: transcriptText }),
                })
              } catch (error) {
                console.error('❌ Error sending transcript:', error)
              }
            } else {
              setInterimTranscript(transcriptText)
            }
          }

          recognition.onerror = (event: any) => {
            if (event.error === 'aborted' || event.error === 'no-speech') return
            if (event.error === 'network') {
              console.warn('⚠️ Network error, retrying...')
              return
            }
            console.error('❌ Speech recognition error:', event.error)

            if (isRecordingRef.current && event.error !== 'aborted') {
              setTimeout(() => {
                if (isRecordingRef.current && recognitionRef.current) {
                  try {
                    recognition.start()
                  } catch (error) {
                    console.error('Failed to restart:', error)
                  }
                }
              }, 500)
            }
          }

          recognition.onend = () => {
            if (isRecordingRef.current && recognitionRef.current) {
              const now = Date.now()
              const timeSinceLastRestart = now - lastSpeechRestartRef.current

              if (timeSinceLastRestart > 500) {
                lastSpeechRestartRef.current = now
                try {
                  recognition.start()
                } catch (error) {
                  console.error('Error restarting:', error)
                }
              } else {
                setTimeout(() => {
                  if (isRecordingRef.current && recognitionRef.current) {
                    try {
                      recognition.start()
                    } catch (error) {
                      console.error('Error restarting after throttle:', error)
                    }
                  }
                }, 1000)
              }
            }
          }

          recognition.start()
          recognitionRef.current = recognition
          setIsRecording(true)
          isRecordingRef.current = true
        } else {
          alert('La reconnaissance vocale n\'est pas supportée. Utilisez Chrome ou Edge.')
        }

        // Setup MediaRecorder for audio recording
        let options: MediaRecorderOptions = {}
        let fileExtension = 'webm'

        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' }
          fileExtension = 'mp4'
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' }
          fileExtension = 'webm'
        }

        const mediaRecorder = new MediaRecorder(combinedStream, options)
        const mimeType = options.mimeType || 'audio/webm'

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
            pendingChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.start(1000)
        mediaRecorderRef.current = mediaRecorder

        // Save audio chunks every 30 seconds
        const saveInterval = setInterval(async () => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.requestData()
          }

          await new Promise(resolve => setTimeout(resolve, 100))

          if (pendingChunksRef.current.length > 0) {
            const blob = new Blob(pendingChunksRef.current, { type: mimeType })
            pendingChunksRef.current = []

            const formData = new FormData()
            formData.append('audio', blob, `meeting-${meetingId}-chunk.${fileExtension}`)
            formData.append('meetingId', meetingId)
            formData.append('isPartial', 'true')

            try {
              console.log(`📤 Saving audio chunk (${(blob.size / 1024).toFixed(1)}KB)`)
              await fetch('/api/meeting/save-audio', {
                method: 'POST',
                body: formData,
              })
            } catch (error) {
              console.error('❌ Error saving audio:', error)
            }
          }
        }, 30000)

        audioSaveIntervalRef.current = saveInterval
      } catch (error) {
        console.error('Error starting recording:', error)
        alert('Impossible d\'accéder au microphone')
      }
    }

    startRecording()

    return () => {
      console.log('🧹 useEffect cleanup called')
      isRecordingRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      if (audioSaveIntervalRef.current) {
        clearInterval(audioSaveIntervalRef.current)
        audioSaveIntervalRef.current = null
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop())
        micStreamRef.current = null
      }
      if (tabStreamRef.current) {
        tabStreamRef.current.getTracks().forEach(track => track.stop())
        tabStreamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [meetingId, meeting?.status])

  // Save notes before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current)
      }

      if (notes) {
        fetch(`/api/screen-share/${meetingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
          keepalive: true,
        }).catch(error => {
          console.error('Error saving notes on unload:', error)
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [meetingId, notes])

  // Auto-scroll transcript
  useEffect(() => {
    if (!transcriptRef.current || meeting?.status === 'completed') return

    const element = transcriptRef.current
    const { scrollTop, scrollHeight, clientHeight } = element
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100

    if (isAtBottom || scrollTop === 0) {
      element.scrollTop = element.scrollHeight
    }
  }, [transcript, interimTranscript, meeting?.status])

  const handleEndMeeting = async () => {
    setIsEnding(true)
    setIsRecording(false)
    isRecordingRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (audioSaveIntervalRef.current) {
      clearInterval(audioSaveIntervalRef.current)
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (tabStreamRef.current) {
      tabStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    // Stop media recorder and save final audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData()
        }
        mediaRecorderRef.current.stop()
        await new Promise(resolve => setTimeout(resolve, 500))

        if (audioChunksRef.current.length > 0) {
          const allChunks = [...audioChunksRef.current]
          const recorderMimeType = mediaRecorderRef.current.mimeType || 'audio/webm'
          const recorderExtension = recorderMimeType.includes('mp4') ? 'mp4' : 'webm'
          const blob = new Blob(allChunks, { type: recorderMimeType })
          const formData = new FormData()
          formData.append('audio', blob, `meeting-${meetingId}-final.${recorderExtension}`)
          formData.append('meetingId', meetingId)
          formData.append('isPartial', 'false')

          await fetch('/api/meeting/save-audio', {
            method: 'POST',
            body: formData,
          })
        }
      } catch (error) {
        console.error('Error stopping media recorder:', error)
      }
    }

    // Start summary generation
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, async: true }),
    }).catch((error) => {
      console.error('Error starting summary generation:', error)
    })

    router.push(`/summary/${meetingId}`)
  }

  const saveNotes = async (notesContent: string) => {
    try {
      await fetch(`/api/screen-share/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesContent }),
      })
    } catch (error) {
      console.error('Error saving notes:', error)
    }
  }

  const handleNotesChange = async (html: string) => {
    setNotes(html)
    lastNotesUpdateRef.current = Date.now()

    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current)
    }

    notesSaveTimeoutRef.current = setTimeout(() => {
      saveNotes(html)
    }, 2000)
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

  // Show screen share selection UI
  if (isRequestingScreenShare) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md">
          <div className="animate-pulse mb-6">
            <svg
              className="w-24 h-24 mx-auto text-indigo-600 dark:text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            En attente de sélection
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Veuillez sélectionner un onglet à partager dans la fenêtre qui vient de s&apos;ouvrir.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 N&apos;oubliez pas de cocher <strong>&quot;Partager l&apos;audio&quot;</strong> pour capturer le son de la visioconférence.
            </p>
          </div>
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
              onClick={() => router.push(meeting?.status === 'completed' ? '/history' : '/')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              title={meeting?.status === 'completed' ? 'Retour à l\'historique' : 'Retour à l\'accueil'}
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
                {meeting.title || 'Meeting en cours'}
              </h1>
              {meeting.duration && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Durée: {Math.floor(meeting.duration / 60)}:
                  {(meeting.duration % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium">Enregistrement (micro + onglet)</span>
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
              disabled={isEnding}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {isEnding ? 'Génération du résumé...' : 'Terminer le meeting'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Transcript panel - 50% */}
        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transcription en direct
            </h2>
          </div>
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {transcript.length === 0 && !interimTranscript ? (
              <p className="text-gray-500 italic text-center mt-8">
                En attente de parole...
              </p>
            ) : (
              <>
                {transcript.map((text, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                  >
                    <p className="text-gray-900 dark:text-gray-100">{text}</p>
                  </div>
                ))}
                {interimTranscript && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow-sm border-2 border-blue-200 dark:border-blue-800">
                    <p className="text-gray-600 dark:text-gray-300 italic">
                      {interimTranscript}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Notes panel - 50% */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notes
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Prenez des notes pendant la réunion
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <RichTextEditor value={notes} onChange={handleNotesChange} />
          </div>
        </div>
      </div>
    </div>
  )
}
