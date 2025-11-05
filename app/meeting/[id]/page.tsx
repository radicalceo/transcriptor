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

export default function MeetingPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [notes, setNotes] = useState<string>('')
  const [isEnding, setIsEnding] = useState(false)
  const [isUploadedFile, setIsUploadedFile] = useState(false)
  const [showDetailedSegments, setShowDetailedSegments] = useState(false)
  const [showAudioModeSelector, setShowAudioModeSelector] = useState(false)
  const [audioMode, setAudioMode] = useState<'microphone' | 'tab-and-mic' | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notesSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const lastNotesUpdateRef = useRef<number>(0)
  const audioChunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<Blob[]>([])
  const isRecordingRef = useRef<boolean>(false)
  const speechStreamRef = useRef<MediaStream | null>(null)
  const recordStreamRef = useRef<MediaStream | null>(null)
  const tabStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastSpeechRestartRef = useRef<number>(0)

  // Load meeting data
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()
        if (data.success) {
          setMeeting(data.meeting)
          setTranscript(data.meeting.transcript)
          setNotes(data.meeting.notes || '')

          // Détecter si c'est un fichier uploadé (status initial = processing)
          if (data.meeting.status === 'processing') {
            setIsUploadedFile(true)
          } else if (data.meeting.status === 'active') {
            // Afficher le sélecteur de mode audio pour les nouvelles sessions
            setShowAudioModeSelector(true)
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

          // Ne mettre à jour les notes que si l'utilisateur n'a pas édité récemment (5 secondes)
          const timeSinceLastUpdate = Date.now() - lastNotesUpdateRef.current
          if (timeSinceLastUpdate > 5000) {
            setNotes(data.meeting.notes || '')
          }

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
    if (isRecordingRef.current) return // Éviter de démarrer plusieurs fois
    if (!meeting) return
    if (meeting.status === 'processing' || meeting.status === 'completed') return // Skip mic for uploads and completed meetings
    if (!audioMode) return // Attendre que l'utilisateur choisisse un mode

    const startRecording = async () => {
      try {
        let micStream: MediaStream
        let combinedStream: MediaStream

        // Obtenir le flux du microphone
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        })

        console.log('🎙️ Microphone stream obtained')

        if (audioMode === 'tab-and-mic') {
          // Mode visio: capturer aussi l'audio de l'onglet
          try {
            console.log('🖥️ Requesting tab audio capture...')

            const tabStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'browser', // Privilégier les onglets
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
              preferCurrentTab: false,
            } as any) // Cast en any car preferCurrentTab n'est pas standard

            console.log('🖥️ Tab stream obtained')
            console.log(`📊 Video tracks: ${tabStream.getVideoTracks().length}`)
            console.log(`📊 Audio tracks: ${tabStream.getAudioTracks().length}`)

            // Arrêter la piste vidéo immédiatement (on ne veut que l'audio)
            tabStream.getVideoTracks().forEach(track => {
              track.stop()
              console.log('🛑 Video track stopped (not needed)')
            })

            tabStreamRef.current = tabStream

            // Vérifier qu'on a bien de l'audio
            if (tabStream.getAudioTracks().length === 0) {
              console.warn('⚠️ No audio track in shared tab')
              throw new Error('Aucune piste audio dans le partage. Assurez-vous de cocher "Partager l\'audio" dans la fenêtre de sélection.')
            }

            // Mixer les deux flux avec Web Audio API
            const audioContext = new AudioContext()
            audioContextRef.current = audioContext

            const destination = audioContext.createMediaStreamDestination()

            // Connecter le micro
            const micSource = audioContext.createMediaStreamSource(micStream)
            micSource.connect(destination)

            // Connecter l'audio de l'onglet
            const tabSource = audioContext.createMediaStreamSource(tabStream)
            tabSource.connect(destination)

            combinedStream = destination.stream
            console.log('🎵 Audio streams mixed successfully')

            // Détecter si l'utilisateur arrête le partage d'écran
            const firstAudioTrack = tabStream.getAudioTracks()[0]
            if (firstAudioTrack) {
              firstAudioTrack.onended = () => {
                console.log('⚠️ Tab sharing stopped by user')
                alert('Le partage audio de l\'onglet a été arrêté. Seul le microphone sera enregistré.')
              }
            }
          } catch (error: any) {
            console.error('Error capturing tab audio:', error)

            // Gérer le cas où l'utilisateur annule
            if (error.name === 'NotAllowedError') {
              console.log('User cancelled screen share')
              alert('Partage d\'écran annulé. Seul le microphone sera utilisé.')
            } else {
              const errorMsg = error.message || 'Erreur inconnue'
              alert(`Impossible de capturer l'audio de l'onglet: ${errorMsg}\n\nSeul le microphone sera utilisé.`)
            }

            combinedStream = micStream
          }
        } else {
          // Mode micro seul
          combinedStream = micStream
        }

        console.log(`📊 Audio tracks: ${combinedStream.getAudioTracks().length}`)
        combinedStream.getAudioTracks().forEach((track, index) => {
          console.log(`   Track ${index}: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`)
        })

        // Stocker le stream principal
        speechStreamRef.current = micStream

        // Cloner le stream combiné pour MediaRecorder (pour éviter les conflits)
        const recordStream = combinedStream.clone()
        console.log('🎙️ Recording stream cloned')
        recordStreamRef.current = recordStream

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
            console.log(`🔊 Speech recognition error: ${event.error}`)

            // Ignorer l'erreur "aborted" qui est normale lors de l'arrêt
            if (event.error === 'aborted') {
              return
            }

            // Pour "no-speech", on log mais on laisse le mécanisme onend redémarrer
            if (event.error === 'no-speech') {
              console.log('⏸️ No speech detected, will auto-restart via onend')
              return
            }

            // Pour les autres erreurs, on log et on tente de redémarrer
            console.error('❌ Speech recognition error:', event.error)

            // Redémarrer après une erreur (sauf aborted)
            if (isRecordingRef.current && event.error !== 'aborted') {
              setTimeout(() => {
                if (isRecordingRef.current && recognitionRef.current) {
                  console.log('🔄 Restarting after error...')
                  try {
                    recognition.start()
                  } catch (error) {
                    console.error('Failed to restart after error:', error)
                  }
                }
              }, 500)
            }
          }

          // Redémarrer automatiquement la reconnaissance si elle s'arrête
          recognition.onend = () => {
            console.log('🏁 Speech recognition ended')

            // Si isRecordingRef est encore true, c'est que l'utilisateur n'a pas arrêté manuellement
            // Donc on redémarre automatiquement, mais avec une limite pour éviter les boucles
            if (isRecordingRef.current && recognitionRef.current) {
              const now = Date.now()
              const timeSinceLastRestart = now - lastSpeechRestartRef.current

              // Ne redémarrer que si ça fait plus d'1 seconde depuis le dernier redémarrage
              if (timeSinceLastRestart > 1000) {
                console.log('🔄 Speech recognition stopped unexpectedly, restarting...')
                lastSpeechRestartRef.current = now
                try {
                  recognition.start()
                } catch (error) {
                  console.error('Error restarting recognition:', error)
                }
              } else {
                console.warn('⚠️ Speech recognition restarting too frequently, skipping restart')
              }
            }
          }

          recognition.start()
          recognitionRef.current = recognition
          setIsRecording(true)
          isRecordingRef.current = true
        } else {
          alert(
            'La reconnaissance vocale n\'est pas supportée par votre navigateur. Utilisez Chrome ou Edge.'
          )
        }

        // Setup MediaRecorder for audio recording
        // Détecter le meilleur format supporté (priorité à MP4)
        let options: MediaRecorderOptions = {}
        let fileExtension = 'webm' // default

        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' }
          fileExtension = 'mp4'
          console.log('✅ Using audio/mp4')
        } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
          options = { mimeType: 'audio/mp4;codecs=mp4a.40.2' }
          fileExtension = 'mp4'
          console.log('✅ Using audio/mp4;codecs=mp4a.40.2')
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' }
          fileExtension = 'webm'
          console.log('✅ Using audio/webm;codecs=opus (MP4 not supported)')
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' }
          fileExtension = 'webm'
          console.log('✅ Using audio/webm (MP4 not supported)')
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options = { mimeType: 'audio/ogg;codecs=opus' }
          fileExtension = 'ogg'
          console.log('✅ Using audio/ogg;codecs=opus (MP4 not supported)')
        } else {
          console.log('⚠️ Using default audio format')
        }

        const mediaRecorder = new MediaRecorder(recordStream, options)
        const mimeType = options.mimeType || 'audio/webm' // Stocker pour usage ultérieur

        mediaRecorder.ondataavailable = (event) => {
          console.log(`🎤 ondataavailable triggered, data size: ${event.data.size} bytes`)
          if (event.data.size > 0) {
            // Ajouter au buffer local pour la fin du meeting
            audioChunksRef.current.push(event.data)
            // Ajouter aux chunks en attente d'envoi
            pendingChunksRef.current.push(event.data)
            console.log(`✅ Chunk added. Total chunks: ${audioChunksRef.current.length}, Pending: ${pendingChunksRef.current.length}`)
          } else {
            console.log('⚠️ Empty chunk received')
          }
        }

        // Start recording with chunks every 1 second (pour tester)
        console.log('🎬 Starting MediaRecorder...')
        mediaRecorder.start(1000) // Générer des chunks toutes les secondes
        console.log(`📊 MediaRecorder started, state: ${mediaRecorder.state}`)
        mediaRecorderRef.current = mediaRecorder

        // Sauvegarder les chunks audio périodiquement (toutes les 30 secondes)
        const saveInterval = setInterval(async () => {
          console.log('🔄 Audio save interval triggered')
          console.log(`📊 MediaRecorder state: ${mediaRecorder.state}`)
          console.log(`📦 Pending chunks: ${pendingChunksRef.current.length}`)
          console.log(`📦 All chunks: ${audioChunksRef.current.length}`)

          // Forcer la récupération des données disponibles
          if (mediaRecorder.state === 'recording') {
            console.log('📢 Calling requestData()...')
            mediaRecorder.requestData()
          } else {
            console.log(`⚠️ MediaRecorder not recording (state: ${mediaRecorder.state})`)
          }

          // Attendre un peu pour que ondataavailable se déclenche
          await new Promise(resolve => setTimeout(resolve, 100))

          console.log(`📦 After requestData, pending chunks: ${pendingChunksRef.current.length}`)

          if (pendingChunksRef.current.length > 0) {
            // Créer un blob avec tous les chunks en attente
            const blob = new Blob(pendingChunksRef.current, { type: mimeType })

            // Vider les chunks en attente
            pendingChunksRef.current = []

            // Envoyer au serveur
            const formData = new FormData()
            formData.append('audio', blob, `meeting-${meetingId}-chunk.${fileExtension}`)
            formData.append('meetingId', meetingId)
            formData.append('isPartial', 'true')

            try {
              console.log(`📤 Sending audio chunk (${blob.size} bytes)...`)
              await fetch('/api/meeting/save-audio', {
                method: 'POST',
                body: formData,
              })
              console.log(`✅ Audio chunk sent successfully (${blob.size} bytes)`)
            } catch (error) {
              console.error('❌ Error sending audio chunk:', error)
            }
          } else {
            console.log('⚠️ No audio chunks to send yet')
          }
        }, 30000) // Toutes les 30 secondes

        console.log(`✅ Audio save interval created (ID: ${saveInterval})`)

        audioSaveIntervalRef.current = saveInterval
      } catch (error) {
        console.error('Error starting recording:', error)
        alert('Impossible d\'accéder au microphone')
      }
    }

    startRecording()

    return () => {
      console.log('🧹 useEffect cleanup called')
      isRecordingRef.current = false // Empêcher le redémarrage automatique lors du démontage
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      if (audioSaveIntervalRef.current) {
        console.log('🧹 Cleaning up audio save interval')
        clearInterval(audioSaveIntervalRef.current)
        audioSaveIntervalRef.current = null
      }
      // Arrêter les streams
      if (speechStreamRef.current) {
        speechStreamRef.current.getTracks().forEach(track => track.stop())
        speechStreamRef.current = null
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach(track => track.stop())
        recordStreamRef.current = null
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
  }, [meetingId, meeting, audioMode])


  // Save notes before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Cancel any pending debounced save
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current)
      }

      // Save immediately using fetch with keepalive (works even if page is closing)
      if (notes) {
        fetch(`/api/meeting/${meetingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
          keepalive: true, // Allows request to complete even if page is unloading
        }).catch(error => {
          console.error('Error saving notes on unload:', error)
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [meetingId, notes])

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
    console.log('🛑 handleEndMeeting called')
    setIsEnding(true)

    // Stop recording
    setIsRecording(false)
    isRecordingRef.current = false // Empêcher le redémarrage automatique
    console.log('🛑 Recording stopped')

    if (recognitionRef.current) {
      console.log('🛑 Stopping recognition')
      recognitionRef.current.stop()
    }
    if (audioSaveIntervalRef.current) {
      console.log('🛑 Clearing audio save interval')
      clearInterval(audioSaveIntervalRef.current)
    }

    // Arrêter les streams
    if (speechStreamRef.current) {
      console.log('🛑 Stopping speech stream')
      speechStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (recordStreamRef.current) {
      console.log('🛑 Stopping record stream')
      recordStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (tabStreamRef.current) {
      console.log('🛑 Stopping tab stream')
      tabStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      console.log('🛑 Closing audio context')
      audioContextRef.current.close()
    }

    console.log('🛑 About to check media recorder')
    // Stop media recorder (simplifié pour éviter les blocages)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('🛑 Stopping media recorder')
      try {
        // Forcer la récupération des dernières données
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData()
        }

        // Arrêter le recorder
        mediaRecorderRef.current.stop()

        // Petit délai pour laisser ondataavailable se déclencher
        await new Promise(resolve => setTimeout(resolve, 500))

        console.log('🛑 Media recorder stopped')
      } catch (error) {
        console.error('⚠️ Error stopping media recorder:', error)
      }

      // Envoyer les derniers chunks qui n'ont pas encore été envoyés
      if (audioChunksRef.current.length > 0) {
        console.log(`🛑 Saving final audio (${audioChunksRef.current.length} chunks)`)
        const allChunks = [...audioChunksRef.current]
        // Récupérer le type mime et extension du recorder
        const recorderMimeType = mediaRecorderRef.current.mimeType || 'audio/webm'
        const recorderExtension = recorderMimeType.includes('mp4') ? 'mp4' :
                                 recorderMimeType.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(allChunks, { type: recorderMimeType })
        const formData = new FormData()
        formData.append('audio', blob, `meeting-${meetingId}-final.${recorderExtension}`)
        formData.append('meetingId', meetingId)
        formData.append('isPartial', 'false')

        try {
          const response = await fetch('/api/meeting/save-audio', {
            method: 'POST',
            body: formData,
          })
          const data = await response.json()
          console.log(`✅ Final audio saved: ${data.audioPath} (${blob.size} bytes)`)
        } catch (error) {
          console.error('❌ Error sending final audio chunk:', error)
        }
      } else {
        console.log('⚠️ No audio chunks to save at meeting end')
      }
    } else {
      console.log('⚠️ Media recorder already inactive or not initialized')
    }

    console.log('🛑 About to call /api/summary')

    // Start summary generation in background (non-blocking)
    // The summary page will handle polling for completion
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, async: true }),
    }).catch((error) => {
      console.error('Error starting summary generation:', error)
      // Error will be handled on summary page
    })

    // Redirect immediately to summary page
    // The page will show a loader and poll for the summary
    console.log('🛑 Redirecting to summary page immediately')
    router.push(`/summary/${meetingId}`)
  }

  const saveNotes = async (notesContent: string) => {
    try {
      await fetch(`/api/meeting/${meetingId}`, {
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

    // Debounce: save notes after 2 seconds of inactivity
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

  // Audio mode selector modal
  if (showAudioModeSelector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Choisissez votre mode d&apos;enregistrement
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Sélectionnez comment vous souhaitez enregistrer l&apos;audio de votre réunion.
          </p>

          <div className="space-y-4">
            {/* Mode microphone seul */}
            <button
              onClick={() => {
                setAudioMode('microphone')
                setShowAudioModeSelector(false)
              }}
              className="w-full text-left p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <svg
                    className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Microphone uniquement
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Enregistrez uniquement votre voix via le microphone. Idéal pour les réunions en
                    présentiel ou les notes vocales personnelles.
                  </p>
                </div>
              </div>
            </button>

            {/* Mode capture d'onglet + micro */}
            <button
              onClick={() => {
                setAudioMode('tab-and-mic')
                setShowAudioModeSelector(false)
              }}
              className="w-full text-left p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <svg
                    className="w-6 h-6 text-green-600 dark:text-green-400"
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
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Microphone + Audio de l&apos;onglet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    Capturez à la fois votre voix ET l&apos;audio de votre visioconférence (Zoom, Meet, Teams...).
                    Vous devrez sélectionner l&apos;onglet de la visio et activer le partage audio.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-amber-800 dark:text-amber-200 text-xs">
                      <strong>Recommandé pour les visios</strong> - Après avoir cliqué, sélectionnez l&apos;onglet
                      de votre visioconférence et cochez &quot;Partager l&apos;audio&quot;.
                    </p>
                  </div>
                </div>
              </div>
            </button>
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
        {/* Transcript panel - 50% */}
        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900">
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
