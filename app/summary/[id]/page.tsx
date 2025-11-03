'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import type { Meeting, Summary, TopicDetail } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedSummary, setEditedSummary] = useState<Summary | null>(null)

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false)

  // Notes toggle state
  const [showEnhancedNotes, setShowEnhancedNotes] = useState(true)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const response = await fetch(`/api/meeting/${meetingId}`)
        const data = await response.json()

        if (data.success) {
          setMeeting(data.meeting)

          // If summary is not ready yet, poll every 2 seconds
          if (!data.meeting.summary && data.meeting.status === 'processing') {
            setTimeout(loadMeeting, 2000)
          } else {
            setIsLoading(false)
          }
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleEdit = () => {
    if (meeting?.summary) {
      setEditedSummary(JSON.parse(JSON.stringify(meeting.summary)))
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    setEditedSummary(null)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!editedSummary) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/summary/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: editedSummary }),
      })

      const data = await response.json()
      if (data.success) {
        setMeeting((prev) => prev ? { ...prev, summary: editedSummary } : null)
        setIsEditing(false)
        setEditedSummary(null)
      } else {
        alert('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error saving summary:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsChatLoading(true)

    try {
      const response = await fetch(`/api/chat/${meetingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const data = await response.json()
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Désolé, une erreur est survenue.'
        }])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue.'
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const startEditingTitle = () => {
    if (meeting) {
      setEditedTitle(meeting.title || `Meeting ${meeting.id.slice(0, 8)}`)
      setIsEditingTitle(true)
    }
  }

  const cancelEditingTitle = () => {
    setIsEditingTitle(false)
    setEditedTitle('')
  }

  const saveTitle = async () => {
    if (!editedTitle.trim()) {
      alert('Le titre ne peut pas être vide')
      return
    }

    setIsUpdatingTitle(true)
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editedTitle.trim() }),
      })
      const data = await response.json()

      if (data.success) {
        setMeeting((prev) => prev ? { ...prev, title: editedTitle.trim() } : null)
        setIsEditingTitle(false)
        setEditedTitle('')
      } else {
        console.error('Error updating title:', data.error)
        alert('Erreur lors de la mise à jour du titre')
      }
    } catch (error) {
      console.error('Error updating title:', error)
      alert('Erreur lors de la mise à jour du titre')
    } finally {
      setIsUpdatingTitle(false)
    }
  }

  const handleDownloadAudio = () => {
    if (!meeting?.audioPath) return

    // Télécharger le fichier audio
    const downloadUrl = `/api/meeting/${meetingId}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = '' // Le nom sera géré par l'API
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyToClipboard = () => {
    if (!meeting?.summary) return

    // Check if topics is new format (TopicDetail[]) or old format (string[])
    const isNewFormat = meeting.summary.topics.length > 0 &&
                       typeof meeting.summary.topics[0] === 'object' &&
                       'title' in meeting.summary.topics[0]

    const topicsText = isNewFormat
      ? (meeting.summary.topics as TopicDetail[]).map((t) => `### ${t.title}\n${t.summary}`).join('\n\n')
      : (meeting.summary.topics as string[]).map((t) => `- ${t}`).join('\n')

    const text = `# Résumé de réunion

## Synthèse
${meeting.summary.summary}

## Actions à suivre
${meeting.summary.actions
  .map(
    (a) =>
      `- ${a.text}${a.assignee ? ` (${a.assignee})` : ''}${
        a.due_date ? ` - ${a.due_date}` : ''
      }`
  )
  .join('\n')}

## Grands sujets abordés
${topicsText}

## Décisions
${meeting.summary.decisions.map((d) => `- ${d.text}`).join('\n')}

${
  meeting.summary.open_questions && meeting.summary.open_questions.length > 0
    ? `## Questions ouvertes et follow-ups\n${meeting.summary.open_questions.map((q) => `- ${q}`).join('\n')}`
    : ''
}`

    navigator.clipboard.writeText(text)
    alert('Copié dans le presse-papier !')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Génération du résumé en cours...
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

  const summary = isEditing && editedSummary ? editedSummary : meeting.summary

  // Check if topics is new format or old format
  const isNewTopicFormat = summary.topics.length > 0 &&
                           typeof summary.topics[0] === 'object' &&
                           'title' in summary.topics[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <button
              onClick={() => router.push('/')}
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
              Retour
            </button>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </>
              ) : (
                <>
                  {meeting.audioPath && (
                    <button
                      onClick={handleDownloadAudio}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Télécharger l'enregistrement audio"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Audio
                    </button>
                  )}
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Modifier
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 flex gap-2">
            <button
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white"
            >
              Vue synthétique
            </button>
            <button
              onClick={() => router.push(`/summary/${meetingId}/detailed`)}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Vue détaillée
            </button>
          </div>
        </div>

        {/* Content - 2 columns layout */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Summary (2/3 width) */}
          <div className="lg:col-span-2 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* Title */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveTitle()
                      } else if (e.key === 'Escape') {
                        cancelEditingTitle()
                      }
                    }}
                    className="flex-1 text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-indigo-500 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    disabled={isUpdatingTitle}
                  />
                  <button
                    onClick={saveTitle}
                    disabled={isUpdatingTitle}
                    className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                    title="Enregistrer"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelEditingTitle}
                    disabled={isUpdatingTitle}
                    className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                    title="Annuler"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-2 group">
                  <h1 className="flex-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {meeting.title || `Meeting ${meeting.id.slice(0, 8)}`}
                  </h1>
                  <button
                    onClick={startEditingTitle}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                    title="Modifier le titre"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(meeting.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            {/* 1. Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Synthèse
              </h2>
              {isEditing ? (
                <textarea
                  value={summary.summary}
                  onChange={(e) =>
                    setEditedSummary((prev) =>
                      prev ? { ...prev, summary: e.target.value } : null
                    )
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[80px] text-sm"
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                  {summary.summary}
                </p>
              )}
            </div>

            {/* 1.5. Notes */}
            {(summary.rawNotes || summary.enhancedNotes) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    Notes de réunion
                  </h2>
                  {summary.rawNotes && summary.enhancedNotes && (
                    <div className="flex gap-2 text-sm">
                      <button
                        onClick={() => setShowEnhancedNotes(false)}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          !showEnhancedNotes
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Notes brutes
                      </button>
                      <button
                        onClick={() => setShowEnhancedNotes(true)}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          showEnhancedNotes
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Notes enrichies
                      </button>
                    </div>
                  )}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  {showEnhancedNotes && summary.enhancedNotes ? (
                    <div dangerouslySetInnerHTML={{ __html: summary.enhancedNotes }} />
                  ) : summary.rawNotes ? (
                    <div dangerouslySetInnerHTML={{ __html: summary.rawNotes }} />
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">Aucune note disponible</p>
                  )}
                </div>
              </div>
            )}

            {/* 2. Actions */}
            {summary.actions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Actions à suivre
                </h2>
                {isEditing ? (
                  <div className="space-y-3">
                    {summary.actions.map((action, index) => (
                      <div key={index} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={action.text}
                            onChange={(e) => {
                              const newActions = [...summary.actions]
                              newActions[index] = { ...action, text: e.target.value }
                              setEditedSummary((prev) =>
                                prev ? { ...prev, actions: newActions } : null
                              )
                            }}
                            placeholder="Description de l'action"
                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={() => {
                              const newActions = summary.actions.filter((_, i) => i !== index)
                              setEditedSummary((prev) =>
                                prev ? { ...prev, actions: newActions } : null
                              )
                            }}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={action.assignee || ''}
                            onChange={(e) => {
                              const newActions = [...summary.actions]
                              newActions[index] = { ...action, assignee: e.target.value || undefined }
                              setEditedSummary((prev) =>
                                prev ? { ...prev, actions: newActions } : null
                              )
                            }}
                            placeholder="Assigné à"
                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                          />
                          <input
                            type="date"
                            value={action.due_date || ''}
                            onChange={(e) => {
                              const newActions = [...summary.actions]
                              newActions[index] = { ...action, due_date: e.target.value || undefined }
                              setEditedSummary((prev) =>
                                prev ? { ...prev, actions: newActions } : null
                              )
                            }}
                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newActions = [...summary.actions, { text: '', assignee: undefined, due_date: undefined }]
                        setEditedSummary((prev) =>
                          prev ? { ...prev, actions: newActions } : null
                        )
                      }}
                      className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
                    >
                      + Ajouter
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {summary.actions.map((action, index) => (
                      <li
                        key={index}
                        className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded text-sm"
                      >
                        <p className="text-gray-900 dark:text-white font-medium">
                          {action.text}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {action.assignee && <span>👤 {action.assignee}</span>}
                          {action.due_date && <span>📅 {action.due_date}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 3. Topics */}
            {summary.topics.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Grands sujets abordés
                </h2>
                {isEditing ? (
                  <div className="space-y-3">
                    {isNewTopicFormat ? (
                      <>
                        {(summary.topics as TopicDetail[]).map((topic, index) => (
                          <div key={index} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={topic.title}
                                onChange={(e) => {
                                  const newTopics = [...(summary.topics as TopicDetail[])]
                                  newTopics[index] = { ...topic, title: e.target.value }
                                  setEditedSummary((prev) =>
                                    prev ? { ...prev, topics: newTopics } : null
                                  )
                                }}
                                placeholder="Titre du sujet"
                                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
                              />
                              <button
                                onClick={() => {
                                  const newTopics = (summary.topics as TopicDetail[]).filter((_, i) => i !== index)
                                  setEditedSummary((prev) =>
                                    prev ? { ...prev, topics: newTopics } : null
                                  )
                                }}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                              >
                                ✕
                              </button>
                            </div>
                            <textarea
                              value={topic.summary}
                              onChange={(e) => {
                                const newTopics = [...(summary.topics as TopicDetail[])]
                                newTopics[index] = { ...topic, summary: e.target.value }
                                setEditedSummary((prev) =>
                                  prev ? { ...prev, topics: newTopics } : null
                                )
                              }}
                              placeholder="Résumé du sujet"
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs min-h-[60px]"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newTopics = [...(summary.topics as TopicDetail[]), { title: '', summary: '' }]
                            setEditedSummary((prev) =>
                              prev ? { ...prev, topics: newTopics } : null
                            )
                          }}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm"
                        >
                          + Ajouter
                        </button>
                      </>
                    ) : (
                      <>
                        {(summary.topics as string[]).map((topic, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={topic}
                              onChange={(e) => {
                                const newTopics = [...(summary.topics as string[])]
                                newTopics[index] = e.target.value
                                setEditedSummary((prev) =>
                                  prev ? { ...prev, topics: newTopics } : null
                                )
                              }}
                              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <button
                              onClick={() => {
                                const newTopics = (summary.topics as string[]).filter((_, i) => i !== index)
                                setEditedSummary((prev) =>
                                  prev ? { ...prev, topics: newTopics } : null
                                )
                              }}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newTopics = [...(summary.topics as string[]), '']
                            setEditedSummary((prev) =>
                              prev ? { ...prev, topics: newTopics } : null
                            )
                          }}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm"
                        >
                          + Ajouter
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isNewTopicFormat ? (
                      (summary.topics as TopicDetail[]).map((topic, index) => (
                        <div key={index} className="border-l-4 border-amber-500 pl-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {topic.title}
                          </h3>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {topic.summary}
                          </p>
                        </div>
                      ))
                    ) : (
                      <ul className="space-y-1">
                        {(summary.topics as string[]).map((topic, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-gray-700 dark:text-gray-300 text-sm"
                          >
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Decisions */}
            {summary.decisions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Décisions
                </h2>
                {isEditing ? (
                  <div className="space-y-2">
                    {summary.decisions.map((decision, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={decision.text}
                          onChange={(e) => {
                            const newDecisions = [...summary.decisions]
                            newDecisions[index] = { ...decision, text: e.target.value }
                            setEditedSummary((prev) =>
                              prev ? { ...prev, decisions: newDecisions } : null
                            )
                          }}
                          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <button
                          onClick={() => {
                            const newDecisions = summary.decisions.filter((_, i) => i !== index)
                            setEditedSummary((prev) =>
                              prev ? { ...prev, decisions: newDecisions } : null
                            )
                          }}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newDecisions = [...summary.decisions, { text: '' }]
                        setEditedSummary((prev) =>
                          prev ? { ...prev, decisions: newDecisions } : null
                        )
                      }}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                    >
                      + Ajouter
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {summary.decisions.map((decision, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm"
                      >
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {decision.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 5. Open Questions */}
            {summary.open_questions && summary.open_questions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Questions ouvertes et follow-ups
                </h2>
                {isEditing ? (
                  <div className="space-y-2">
                    {summary.open_questions.map((question, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => {
                            const newQuestions = [...summary.open_questions!]
                            newQuestions[index] = e.target.value
                            setEditedSummary((prev) =>
                              prev ? { ...prev, open_questions: newQuestions } : null
                            )
                          }}
                          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <button
                          onClick={() => {
                            const newQuestions = summary.open_questions!.filter((_, i) => i !== index)
                            setEditedSummary((prev) =>
                              prev ? { ...prev, open_questions: newQuestions } : null
                            )
                          }}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newQuestions = [...(summary.open_questions || []), '']
                        setEditedSummary((prev) =>
                          prev ? { ...prev, open_questions: newQuestions } : null
                        )
                      }}
                      className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm"
                    >
                      + Ajouter
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {summary.open_questions.map((question, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-gray-700 dark:text-gray-300 text-sm"
                      >
                        <span className="text-orange-500 mt-0.5">?</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right column - Chat (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-200px)] sticky top-4">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  Assistant IA
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Posez des questions sur cette réunion
                </p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                    <p>Posez une question sur la réunion</p>
                    <p className="text-xs mt-2">Par exemple:</p>
                    <p className="text-xs mt-1 italic">&quot;Quelles sont les actions prioritaires ?&quot;</p>
                  </div>
                )}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Votre question..."
                    disabled={isChatLoading}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
