import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required but not set in environment variables')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CHAT_SYSTEM_PROMPT = `Tu es un assistant expert en analyse de réunions.
Tu réponds aux questions sur la transcription d'une réunion de manière précise et concise.
Rôle:
- Répondre aux questions en te basant UNIQUEMENT sur la transcription fournie
- Si l'information n'est pas dans la transcription, le dire clairement
- Être factuel et synthétique
- Citer des extraits pertinents si nécessaire
- Répondre en français de manière claire et professionnelle`

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message required' },
        { status: 400 }
      )
    }

    // Get meeting from database
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    })

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Parse transcript
    const transcript = JSON.parse(meeting.transcript)
    const fullTranscript = transcript.join('\n')

    if (!fullTranscript || fullTranscript.length < 10) {
      return NextResponse.json({
        success: true,
        response: "La transcription de cette réunion est vide ou trop courte pour que je puisse répondre à des questions."
      })
    }

    // Build user prompt with transcript context
    const userPrompt = `TRANSCRIPTION DE LA RÉUNION:
${fullTranscript}

QUESTION DE L'UTILISATEUR:
${message}

Réponds à la question en te basant uniquement sur la transcription ci-dessus. Si l'information n'est pas présente, dis-le clairement.`

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      temperature: 0.3,
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    return NextResponse.json({
      success: true,
      response: content.text,
    })
  } catch (error: any) {
    console.error('Error in chat endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process chat message'
      },
      { status: 500 }
    )
  }
}
