import type { Suggestions, Decision, Action } from '@/lib/types'

/**
 * Calcule la similarité entre deux chaînes (distance de Levenshtein normalisée)
 */
function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1

  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1

  const distance = levenshteinDistance(s1, s2)
  return 1 - distance / maxLen
}

/**
 * Distance de Levenshtein entre deux chaînes
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Vérifie si un topic est contenu dans un autre ou vice versa
 */
function isTopicSubstring(topic1: string, topic2: string): boolean {
  const t1 = topic1.toLowerCase().trim()
  const t2 = topic2.toLowerCase().trim()
  return t1.includes(t2) || t2.includes(t1)
}

/**
 * Déduplique les topics en gardant le plus long/précis
 */
export function deduplicateTopics(topics: string[]): string[] {
  const unique: string[] = []
  const SIMILARITY_THRESHOLD = 0.7

  for (const topic of topics) {
    let isDuplicate = false

    for (let i = 0; i < unique.length; i++) {
      const existingTopic = unique[i]

      // Si très similaire (> 70%)
      if (similarity(topic, existingTopic) > SIMILARITY_THRESHOLD) {
        // Garder le plus long
        if (topic.length > existingTopic.length) {
          unique[i] = topic
        }
        isDuplicate = true
        break
      }

      // Si l'un est contenu dans l'autre
      if (isTopicSubstring(topic, existingTopic)) {
        // Garder le plus long (plus précis)
        if (topic.length > existingTopic.length) {
          unique[i] = topic
        }
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      unique.push(topic)
    }
  }

  return unique
}

/**
 * Déduplique les décisions
 */
export function deduplicateDecisions(decisions: Decision[]): Decision[] {
  const unique: Decision[] = []
  const SIMILARITY_THRESHOLD = 0.75

  for (const decision of decisions) {
    let isDuplicate = false

    for (const existingDecision of unique) {
      if (similarity(decision.text, existingDecision.text) > SIMILARITY_THRESHOLD) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      unique.push(decision)
    }
  }

  return unique
}

/**
 * Déduplique les actions
 */
export function deduplicateActions(actions: Action[]): Action[] {
  const unique: Action[] = []
  const SIMILARITY_THRESHOLD = 0.75

  for (const action of actions) {
    let isDuplicate = false

    for (const existingAction of unique) {
      if (similarity(action.text, existingAction.text) > SIMILARITY_THRESHOLD) {
        // Si similaire, garder celle avec le plus d'infos (assignee, due_date)
        if (
          (action.assignee && !existingAction.assignee) ||
          (action.due_date && !existingAction.due_date)
        ) {
          // Remplacer par la version avec plus d'infos
          const index = unique.indexOf(existingAction)
          unique[index] = action
        }
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      unique.push(action)
    }
  }

  return unique
}

/**
 * Déduplique toutes les suggestions
 */
export function deduplicateSuggestions(suggestions: Suggestions): Suggestions {
  return {
    topics: deduplicateTopics(suggestions.topics),
    decisions: deduplicateDecisions(suggestions.decisions),
    actions: deduplicateActions(suggestions.actions),
  }
}
