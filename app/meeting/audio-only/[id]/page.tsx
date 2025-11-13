'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import RichTextEditor from '@/components/RichTextEditor'
import type { Meeting, Suggestions } from '@/lib/types'
import {
  groupTranscriptSegments,
  formatTimestamp,
  type TranscriptBlock,
} from '@/lib/services/transcriptGrouping'

export default function AudioOnlyMeetingPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [interimTranscript, setInterimTranscript] = useState<string>('') // Texte en cours de reconnaissance
  const [notes, setNotes] = useState<string>('')
  const [isEnding, setIsEnding] = useState(false)
  const [folders, setFolders] = useState<any[]>([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

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
  const lastSpeechRestartRef = useRef<number>(0)
  const chunkIndexRef = useRef<number>(0)

  // Load meeting data
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/audio-only/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)
          setNotes(data.meeting.notes || '')
          setTitleValue(data.meeting.title || '')
        }
      } catch (error) {
        console.error('Error loading meeting:', error)
      }
    }
    loadMeeting()

    // Load folders
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
    loadFolders()

    // Poll meeting data
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/audio-only/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)

          // Only update notes if user hasn't edited recently (5 seconds)
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

  // Start recording (audio-only mode - microphone only)
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

    console.log('✅ All conditions met, starting recording...')

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
        console.log('✅ Microphone ready (audio-only mode)')

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
              // Résultat final : ajouter au transcript et sauvegarder en DB
              console.log(`🎤 Final transcript: "${transcriptText}"`)
              setTranscript((prev) => [...prev, transcriptText])
              setInterimTranscript('') // Effacer le texte intermédiaire

              try {
                await fetch(`/api/audio-only/${meetingId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transcript: transcriptText }),
                })
              } catch (error) {
                console.error('❌ Error sending transcript:', error)
              }
            } else {
              // Résultat intermédiaire : afficher en temps réel (pas de sauvegarde)
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
          alert(
            'La reconnaissance vocale n\'est pas supportée. Utilisez Chrome ou Edge.'
          )
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

        const mediaRecorder = new MediaRecorder(micStream, options)
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

            const currentChunkIndex = chunkIndexRef.current
            chunkIndexRef.current += 1

            const formData = new FormData()
            formData.append('audio', blob, `meeting-${meetingId}-chunk-${currentChunkIndex}.${fileExtension}`)
            formData.append('meetingId', meetingId)
            formData.append('chunkIndex', currentChunkIndex.toString())

            try {
              console.log(`📤 Saving audio chunk ${currentChunkIndex} (${(blob.size / 1024).toFixed(1)}KB)`)
              await fetch('/api/meeting/save-audio', {
                method: 'POST',
                body: formData,
              })
            } catch (error) {
              console.error('❌ Error saving audio chunk:', error)
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, meeting?.status]) // Only depend on status, not the whole meeting object

  // Save notes before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current)
      }

      if (notes) {
        fetch(`/api/audio-only/${meetingId}`, {
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

    // Stop media recorder and save only remaining chunks
    // Note: Audio is already being saved every 30 seconds during recording,
    // so we only need to save the final pending chunks (not all chunks)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData()
        }
        mediaRecorderRef.current.stop()
        await new Promise(resolve => setTimeout(resolve, 500))

        // Only upload pending chunks that haven't been saved yet
        if (pendingChunksRef.current.length > 0) {
          const recorderMimeType = mediaRecorderRef.current.mimeType || 'audio/webm'
          const recorderExtension = recorderMimeType.includes('mp4') ? 'mp4' : 'webm'
          const blob = new Blob(pendingChunksRef.current, { type: recorderMimeType })

          const finalChunkIndex = chunkIndexRef.current

          const formData = new FormData()
          formData.append('audio', blob, `meeting-${meetingId}-chunk-${finalChunkIndex}.${recorderExtension}`)
          formData.append('meetingId', meetingId)
          formData.append('chunkIndex', finalChunkIndex.toString())

          console.log(`📤 Saving final audio chunk ${finalChunkIndex} (${(blob.size / 1024).toFixed(1)}KB)`)
          await fetch('/api/meeting/save-audio', {
            method: 'POST',
            body: formData,
          })
        } else {
          console.log('✅ No pending chunks to save (all audio already saved)')
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
      await fetch(`/api/audio-only/${meetingId}`, {
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

  const handleSaveTitle = async () => {
    if (!titleValue.trim()) return
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const handleFolderChange = async (folderId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
            <div className="flex items-center gap-4">
              <div>
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') {
                          setEditingTitle(false)
                          setTitleValue(meeting.title || '')
                        }
                      }}
                      onBlur={handleSaveTitle}
                      className="text-xl font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-indigo-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Nom du meeting"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {meeting.title || 'Meeting en cours'}
                    </h1>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                      title="Modifier le titre"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                {meeting.duration && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Durée: {Math.floor(meeting.duration / 60)}:
                    {(meeting.duration % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Dossier</label>
                <select
                  value={meeting.folderId || ''}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Non classé</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-medium">Enregistrement (micro seul)</span>
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
