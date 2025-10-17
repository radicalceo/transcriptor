import type { Meeting, Suggestions, Summary, TranscriptSegment } from '@/lib/types'

// In-memory store for meetings (MVP - no persistence)
const meetings = new Map<string, Meeting>()

export const meetingStore = {
  create(id: string, type: 'live' | 'upload' = 'live', title?: string): Meeting {
    const meeting: Meeting = {
      id,
      title,
      transcript: [],
      transcriptSegments: [],
      suggestions: {
        topics: [],
        decisions: [],
        actions: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      type,
    }
    meetings.set(id, meeting)
    return meeting
  },

  get(id: string): Meeting | undefined {
    return meetings.get(id)
  },

  addTranscript(id: string, text: string): void {
    const meeting = meetings.get(id)
    if (meeting) {
      meeting.transcript.push(text)
    }
  },

  setTranscriptSegments(id: string, segments: TranscriptSegment[]): void {
    const meeting = meetings.get(id)
    if (meeting) {
      meeting.transcriptSegments = segments
      // Also populate transcript array for backward compatibility
      meeting.transcript = segments.map((s) => s.text)
      meeting.updatedAt = new Date().toISOString()

      // Calculate duration from last segment timestamp
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1]
        meeting.duration = Math.ceil(lastSegment.timestamp)
      }
    }
  },

  updateSuggestions(id: string, suggestions: Suggestions): void {
    const meeting = meetings.get(id)
    if (meeting) {
      meeting.suggestions = suggestions
    }
  },

  setSummary(id: string, summary: Summary): void {
    const meeting = meetings.get(id)
    if (meeting) {
      meeting.summary = summary
      meeting.status = 'completed'
    }
  },

  updateStatus(id: string, status: Meeting['status']): void {
    const meeting = meetings.get(id)
    if (meeting) {
      meeting.status = status
    }
  },

  getAll(): Meeting[] {
    return Array.from(meetings.values())
  },
}
