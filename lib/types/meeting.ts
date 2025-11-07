export interface Action {
  text: string
  assignee?: string
  due_date?: string
  priority?: 'low' | 'medium' | 'high'
  confidence?: number
}

export interface Decision {
  text: string
  confidence?: number
}

export interface Suggestions {
  topics: string[]
  decisions: Decision[]
  actions: Action[]
}

export interface TopicDetail {
  title: string
  summary: string
}

export interface Summary {
  summary: string // Synthèse générale
  actions: Action[] // Actions à suivre
  decisions: Decision[] // Décisions
  open_questions?: string[] // Questions ouvertes et follow-ups
  topics: TopicDetail[] // Grands sujets abordés avec mini synthèse
  // Detailed summaries (5-10 lignes chacun)
  detailed?: {
    summary_detailed?: string // Résumé général détaillé
    actions_detailed?: string // Contexte détaillé des actions
    decisions_detailed?: string // Contexte détaillé des décisions
    open_questions_detailed?: string // Contexte détaillé des questions ouvertes
    topics_detailed?: Array<{
      title: string
      detailed_summary: string // Résumé détaillé du sujet (5-10 lignes)
    }>
  }
  // Notes taken during the meeting
  rawNotes?: string // Original HTML notes from user
  enhancedNotes?: string // AI-enhanced version of notes
  // Document édité au format HTML (pour la vue détaillée WYSIWYG)
  editedDocument?: string
  // Deprecated fields (kept for backward compatibility)
  highlights?: Array<{
    quote: string
    timestamp_sec?: number
  }>
  risks?: string[]
  next_steps?: string[]
}

export interface Meeting {
  id: string
  title?: string // Optional title for the meeting
  audioPath?: string // Path to saved audio file
  transcript: string[] // For backward compatibility (live recording)
  transcriptSegments?: TranscriptSegment[] // For uploaded files with timestamps
  suggestions: Suggestions
  summary?: Summary
  notes?: string // HTML notes taken during the meeting
  createdAt: string
  updatedAt?: string // Last update timestamp
  status: 'active' | 'processing' | 'completed'
  type: 'audio-only' | 'screen-share' | 'upload' // Track the recording method
  duration?: number // Duration in seconds (for uploaded files)
}

export interface TranscriptSegment {
  text: string
  timestamp: number
  speaker?: string
}
