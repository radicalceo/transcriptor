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
  transcript: string[] // For backward compatibility (live recording)
  transcriptSegments?: TranscriptSegment[] // For uploaded files with timestamps
  suggestions: Suggestions
  summary?: Summary
  createdAt: string
  updatedAt?: string // Last update timestamp
  status: 'active' | 'processing' | 'completed'
  type: 'live' | 'upload' // Track if it was recorded live or uploaded
  duration?: number // Duration in seconds (for uploaded files)
}

export interface TranscriptSegment {
  text: string
  timestamp: number
  speaker?: string
}
