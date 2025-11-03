'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Meeting } from '@/lib/types'
import RichTextEditor from '@/components/RichTextEditor'
import { summaryToHtml } from '@/lib/utils/summaryFormatter'

export default function DetailedSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editedContent, setEditedContent] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [notesMode, setNotesMode] = useState<'document' | 'raw' | 'enhanced'>('document')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (data.success) {
          setMeeting(data.meeting)

          // Initialiser le contenu édité selon le mode
          if (data.meeting.summary) {
            const htmlContent = data.meeting.summary.editedDocument || summaryToHtml(
              data.meeting.summary,
              data.meeting.title,
              new Date(data.meeting.createdAt).toLocaleString('fr-FR', {
                dateStyle: 'long',
                timeStyle: 'short',
              })
            )
            setEditedContent(htmlContent)
          }

          setIsLoading(false)
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error loading meeting:', error)
        setIsLoading(false)
      }
    }

    loadMeeting()
  }, [meetingId])

  // Charger le bon contenu quand le mode change
  useEffect(() => {
    if (!meeting?.summary) return

    let content = ''
    switch (notesMode) {
      case 'raw':
        content = meeting.summary.rawNotes || meeting.notes || '<p>Aucune note brute disponible</p>'
        break
      case 'enhanced':
        content = meeting.summary.enhancedNotes || '<p>Aucune note enrichie disponible</p>'
        break
      case 'document':
        content = meeting.summary.editedDocument || summaryToHtml(
          meeting.summary,
          meeting.title,
          new Date(meeting.createdAt).toLocaleString('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
          })
        )
        break
    }
    setEditedContent(content)
  }, [notesMode, meeting])

  // Auto-save avec debounce
  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent)
    setSaveStatus('unsaved')

    // Annuler le timeout précédent si existe
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Créer un nouveau timeout pour l'auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        let endpoint = ''
        let payload: any = {}

        switch (notesMode) {
          case 'raw':
            endpoint = `/api/summary/${meetingId}/notes`
            payload = { rawNotes: newContent }
            break
          case 'enhanced':
            endpoint = `/api/summary/${meetingId}/notes`
            payload = { enhancedNotes: newContent }
            break
          case 'document':
            endpoint = `/api/summary/${meetingId}/document`
            payload = { editedDocument: newContent }
            break
        }

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (data.success) {
          // Mettre à jour le meeting local selon le mode
          setMeeting((prev) => {
            if (!prev || !prev.summary) return prev

            const updatedSummary = { ...prev.summary }
            switch (notesMode) {
              case 'raw':
                updatedSummary.rawNotes = newContent
                break
              case 'enhanced':
                updatedSummary.enhancedNotes = newContent
                break
              case 'document':
                updatedSummary.editedDocument = newContent
                break
            }

            return { ...prev, summary: updatedSummary }
          })
          setSaveStatus('saved')
        } else {
          setSaveStatus('unsaved')
          console.error('Error auto-saving content')
        }
      } catch (error) {
        console.error('Error auto-saving content:', error)
        setSaveStatus('unsaved')
      }
    }, 2000) // Attendre 2 secondes après la dernière modification
  }, [meetingId, notesMode])

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleRegenerateSummary = async () => {
    if (!meeting) return

    const confirmed = confirm(
      'Voulez-vous vraiment régénérer le résumé ? Cela écrasera le résumé actuel avec une nouvelle version plus détaillée.'
    )

    if (!confirmed) return

    setIsRegenerating(true)
    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      })

      const data = await response.json()
      if (data.success) {
        // Reload meeting to get new summary
        const reloadResponse = await fetch(`/api/meeting/${meetingId}`)
        const reloadData = await reloadResponse.json()
        if (reloadData.success) {
          setMeeting(reloadData.meeting)

          // Réinitialiser le contenu édité avec le nouveau résumé
          const htmlContent = summaryToHtml(
            reloadData.meeting.summary,
            reloadData.meeting.title,
            new Date(reloadData.meeting.createdAt).toLocaleString('fr-FR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })
          )
          setEditedContent(htmlContent)

          alert('Résumé régénéré avec succès !')
        }
      } else {
        alert('Erreur lors de la régénération du résumé')
      }
    } catch (error) {
      console.error('Error regenerating summary:', error)
      alert('Erreur lors de la régénération du résumé')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleCopyToClipboard = () => {
    // Créer un élément temporaire pour extraire le texte
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = editedContent
    const text = tempDiv.innerText

    navigator.clipboard.writeText(text)
    alert('Copié dans le presse-papier !')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Chargement...
          </p>
        </div>
      </div>
    )
  }

  if (!meeting || !meeting.summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Résumé non disponible
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <button
              onClick={() => router.push(`/summary/${meetingId}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Retour au résumé
            </button>

            <div className="flex items-center gap-4">
              {/* Save Status Indicator */}
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Sauvegardé</span>
                  </div>
                )}
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <span>Sauvegarde...</span>
                  </div>
                )}
                {saveStatus === 'unsaved' && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>Modifications non sauvegardées</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  title="Copier le texte dans le presse-papier"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copier
                </button>
                <button
                  onClick={handleRegenerateSummary}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Régénérer le résumé avec le prompt amélioré"
                >
                  {isRegenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Régénération...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>Régénérer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 flex gap-2">
            <button
              onClick={() => router.push(`/summary/${meetingId}`)}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Vue synthétique
            </button>
            <button
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white"
            >
              Compte-rendu éditable
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Document éditable */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            {/* Boutons de mode */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setNotesMode('document')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    notesMode === 'document'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  📄 Compte-rendu
                </button>
                {(meeting.summary?.rawNotes || meeting.notes) && (
                  <button
                    onClick={() => setNotesMode('raw')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      notesMode === 'raw'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    📝 Notes brutes
                  </button>
                )}
                {meeting.summary?.enhancedNotes && (
                  <button
                    onClick={() => setNotesMode('enhanced')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      notesMode === 'enhanced'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    ✨ Notes enrichies
                  </button>
                )}
              </div>

              {/* Indicateur du mode actif */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {notesMode === 'document' && 'Édition du compte-rendu final'}
                {notesMode === 'raw' && 'Édition des notes brutes'}
                {notesMode === 'enhanced' && 'Édition des notes enrichies'}
              </div>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💡 Astuce :</strong> Ce document est automatiquement sauvegardé pendant que vous tapez.
                {notesMode !== 'document' && ' Les notes brutes et enrichies sont sauvegardées séparément.'}
              </p>
            </div>
            <RichTextEditor
              value={editedContent}
              onChange={handleContentChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
