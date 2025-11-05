import type { Summary, TopicDetail } from '@/lib/types'

/**
 * Convertit un objet Summary en document HTML formaté pour l'édition WYSIWYG
 */
export function summaryToHtml(summary: Summary, meetingTitle?: string, meetingDate?: string): string {
  const sections: string[] = []

  // En-tête du document
  if (meetingTitle) {
    sections.push(`<h1>${escapeHtml(meetingTitle)}</h1>`)
  }
  if (meetingDate) {
    sections.push(`<p><em>${escapeHtml(meetingDate)}</em></p>`)
  }

  // Section Summary
  if (summary.detailed?.summary_detailed || summary.summary) {
    sections.push('<h2>Summary</h2>')
    const summaryText = summary.detailed?.summary_detailed || summary.summary
    const paragraphs = summaryText.split('\n\n')
    paragraphs.forEach(para => {
      if (para.trim()) {
        sections.push(`<p>${escapeHtml(para.trim())}</p>`)
      }
    })
  }

  // Section Action Items
  if (summary.actions.length > 0) {
    sections.push('<h2>Action Items</h2>')
    sections.push('<ul>')
    summary.actions.forEach(action => {
      const parts: string[] = [escapeHtml(action.text)]
      if (action.assignee || action.due_date || action.priority) {
        const metadata: string[] = []
        if (action.due_date) metadata.push(escapeHtml(action.due_date))
        if (action.assignee) metadata.push(escapeHtml(action.assignee))
        if (action.priority) {
          const priorityText = action.priority === 'high' ? 'Haute' : action.priority === 'medium' ? 'Moyenne' : 'Basse'
          metadata.push(priorityText)
        }
        if (metadata.length > 0) {
          parts.push(`<em>(${metadata.join(' – ')})</em>`)
        }
      }
      sections.push(`<li>${parts.join(' ')}</li>`)
    })
    sections.push('</ul>')

    // Texte détaillé des actions si disponible
    if (summary.detailed?.actions_detailed) {
      const paragraphs = summary.detailed.actions_detailed.split('\n\n')
      paragraphs.forEach(para => {
        if (para.trim()) {
          sections.push(`<p>${escapeHtml(para.trim())}</p>`)
        }
      })
    }
  }

  // Sections des topics détaillés
  if (summary.detailed?.topics_detailed && summary.detailed.topics_detailed.length > 0) {
    summary.detailed.topics_detailed.forEach(topic => {
      sections.push(`<h2>${escapeHtml(topic.title)}</h2>`)
      const paragraphs = topic.detailed_summary.split('\n\n')
      paragraphs.forEach(para => {
        const trimmed = para.trim()
        if (trimmed) {
          // Vérifier si c'est une liste
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const items = trimmed.split('\n').filter(line => line.trim())
            sections.push('<ul>')
            items.forEach(item => {
              const cleanItem = item.replace(/^[-•]\s*/, '').trim()
              if (cleanItem) {
                sections.push(`<li>${escapeHtml(cleanItem)}</li>`)
              }
            })
            sections.push('</ul>')
          } else {
            sections.push(`<p>${escapeHtml(trimmed)}</p>`)
          }
        }
      })
    })
  } else if (summary.topics.length > 0) {
    // Format simple des topics
    const isNewFormat = typeof summary.topics[0] === 'object' && 'title' in summary.topics[0]

    if (isNewFormat) {
      (summary.topics as TopicDetail[]).forEach(topic => {
        sections.push(`<h2>${escapeHtml(topic.title)}</h2>`)
        sections.push(`<p>${escapeHtml(topic.summary)}</p>`)
      })
    } else {
      sections.push('<h2>Grands sujets abordés</h2>')
      sections.push('<ul>')
      ;(summary.topics as unknown as string[]).forEach(topic => {
        sections.push(`<li>${escapeHtml(topic)}</li>`)
      })
      sections.push('</ul>')
    }
  }

  // Section Décisions
  if (summary.decisions.length > 0) {
    sections.push('<h2>Décisions</h2>')

    // Texte détaillé des décisions si disponible
    if (summary.detailed?.decisions_detailed) {
      const paragraphs = summary.detailed.decisions_detailed.split('\n\n')
      paragraphs.forEach(para => {
        if (para.trim()) {
          sections.push(`<p>${escapeHtml(para.trim())}</p>`)
        }
      })
    }

    sections.push('<ul>')
    summary.decisions.forEach(decision => {
      sections.push(`<li><strong>${escapeHtml(decision.text)}</strong></li>`)
    })
    sections.push('</ul>')
  }

  // Section Questions ouvertes
  if (summary.open_questions && summary.open_questions.length > 0) {
    sections.push('<h2>Open Questions / Follow-Ups</h2>')

    // Texte détaillé des questions si disponible
    if (summary.detailed?.open_questions_detailed) {
      const paragraphs = summary.detailed.open_questions_detailed.split('\n\n')
      paragraphs.forEach(para => {
        if (para.trim()) {
          sections.push(`<p>${escapeHtml(para.trim())}</p>`)
        }
      })
    }

    sections.push('<ul>')
    summary.open_questions.forEach(question => {
      sections.push(`<li>${escapeHtml(question)}</li>`)
    })
    sections.push('</ul>')
  }

  return sections.join('\n')
}

/**
 * Échappe les caractères HTML spéciaux
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Parse le HTML du document édité et retourne un objet Summary mis à jour
 * Note: Cette fonction est une version simplifiée qui préserve le HTML édité
 * dans le champ `editedDocument` du summary
 */
export function htmlToSummary(html: string, originalSummary: Summary): Summary {
  // Pour l'instant, on stocke simplement le HTML édité dans le summary
  // On pourrait plus tard parser le HTML pour extraire les structures
  return {
    ...originalSummary,
    editedDocument: html
  }
}
