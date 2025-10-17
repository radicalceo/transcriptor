import Anthropic from '@anthropic-ai/sdk'
import type { Suggestions, Summary } from '@/lib/types'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required but not set in environment variables')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const LIVE_SYSTEM_PROMPT = `Tu es un extracteur temps réel d'informations de réunion.
Rôle: transformer des extraits de transcription en JSON exploitable pour l'UI.
Exigences:
- Ne répondre QU'EN JSON conforme au schéma LIVE.
- Zéro texte hors JSON, zéro explication.
- Si l'extrait est bruité ou peu informatif, renvoyer des tableaux vides.
- Ne pas halluciner d'assignations ou de dates si non mentionnées.
- Détecter et ignorer les apartés sans rapport (blagues, bruits).`

const FINAL_SYSTEM_PROMPT = `Tu es un synthétiseur de réunions. Tu produis un rapport concis et actionnable.
Exigences:
- Sortie stricte en JSON conforme au schéma FINAL.
- Zéro texte hors JSON.
- Pas d'hallucinations: s'abstenir quand l'info n'existe pas.
- Écrire en français s'il y a majoritairement du FR, sinon en anglais.
- Style: clair, factuel, sans jargon superflu.
- Pour les sujets (topics): identifier les grands thèmes discutés et fournir une mini-synthèse de chaque sujet.
- IMPORTANT: Même si la conversation est courte ou informelle, analyse le contenu et produis un résumé basé sur ce qui a été dit. Ne pas dire "Aucun contenu" si du texte est fourni.`

export async function analyzeLiveTranscript(
  transcript: string
): Promise<Suggestions> {
  try {
    const userPrompt = `TRANSCRIPT_RAW:
${transcript}

Contrainte:
- Si un même item est répété, reviens avec la version la plus courte et la plus claire.
- Utilise "confidence" ∈ [0.0,1.0] pour "decisions" et "actions".

Réponds EXCLUSIVEMENT avec un JSON valide selon ce schéma:
{
  "topics": ["string"],
  "decisions": [{"text":"string","confidence":0.0}],
  "actions": [{"text":"string","assignee":"string|null","due_date":"YYYY-MM-DD|null","confidence":0.0}]
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0.2,
      system: LIVE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    console.log('DEBUG - Claude raw response (full):', JSON.stringify(content.text))

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log('DEBUG - No JSON found in response')
      return { topics: [], decisions: [], actions: [] }
    }

    const parsed = JSON.parse(jsonMatch[0])
    console.log('DEBUG - Parsed suggestions (full):', JSON.stringify(parsed))

    return {
      topics: parsed.topics || [],
      decisions: parsed.decisions || [],
      actions: parsed.actions || [],
    }
  } catch (error) {
    console.error('Error analyzing live transcript:', error)
    return { topics: [], decisions: [], actions: [] }
  }
}

export async function generateFinalSummary(
  transcript: string[],
  validatedSuggestions?: Suggestions
): Promise<Summary> {
  try {
    const fullTranscript = transcript.join('\n')

    let userPrompt = `TRANSCRIPT_COMPLET:
${fullTranscript}`

    if (validatedSuggestions) {
      userPrompt += `

LISTES_VALIDÉES_PAR_UTILISATEUR:
${JSON.stringify(validatedSuggestions, null, 2)}`
    }

    userPrompt += `

Contrainte:
- Prioriser les éléments VALIDÉS si fournis.
- Pour "topics": identifier les grands sujets abordés et fournir une mini-synthèse pour chacun.
- Pour "open_questions": lister les questions restées sans réponse et les follow-ups nécessaires.

Réponds EXCLUSIVEMENT avec un JSON valide selon ce schéma:
{
  "summary": "string (synthèse générale de la réunion)",
  "actions": [{"text":"string","assignee":"string|null","due_date":"YYYY-MM-DD|null","priority":"low|medium|high|null"}],
  "decisions": [{"text":"string"}],
  "open_questions": ["string (questions ouvertes et follow-ups)"],
  "topics": [{"title":"string","summary":"string (mini synthèse du sujet)"}]
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.3,
      system: FINAL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      summary: parsed.summary || '',
      actions: parsed.actions || [],
      decisions: parsed.decisions || [],
      open_questions: parsed.open_questions || [],
      topics: parsed.topics || [],
      // Keep deprecated fields for backward compatibility
      highlights: parsed.highlights || [],
      risks: parsed.risks || [],
      next_steps: parsed.next_steps || [],
    }
  } catch (error) {
    console.error('Error generating final summary:', error)
    throw error
  }
}
