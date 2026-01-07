#!/usr/bin/env tsx
/**
 * Script pour régénérer manuellement un résumé de meeting
 * Usage: tsx scripts/regenerate-summary.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client'
import { generateFinalSummary } from '../lib/services/claudeService'

const prisma = new PrismaClient()

async function regenerateSummary(meetingId: string) {
  try {
    console.log(`\n🔍 Recherche du meeting ${meetingId}...`)

    // Get meeting from database
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    })

    if (!meeting) {
      console.error('❌ Meeting not found')
      process.exit(1)
    }

    console.log(`✅ Meeting trouvé: ${meeting.title || 'Sans titre'}`)
    console.log(`   Type: ${meeting.type}`)
    console.log(`   Status: ${meeting.status}`)
    console.log(`   Created: ${meeting.createdAt}`)

    // Parse transcript
    const transcript = JSON.parse(meeting.transcript)
    const transcriptSegments = JSON.parse(meeting.transcriptSegments)

    console.log(`\n📝 Transcript: ${transcript.length} segments`)

    if (transcript.length === 0 || transcript.join('').trim().length === 0) {
      console.error('❌ No transcript available')
      process.exit(1)
    }

    // Parse suggestions
    const suggestions = {
      topics: JSON.parse(meeting.topics),
      decisions: JSON.parse(meeting.decisions),
      actions: JSON.parse(meeting.actions),
    }

    console.log(`\n📊 Suggestions:`)
    console.log(`   Topics: ${suggestions.topics.length}`)
    console.log(`   Decisions: ${suggestions.decisions.length}`)
    console.log(`   Actions: ${suggestions.actions.length}`)

    // Update status to processing
    console.log(`\n⏳ Mise à jour du status à 'processing'...`)
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'processing' },
    })

    // Generate summary
    // Use Sonnet for long transcripts (>300 segments)
    const useSonnet = transcript.length > 300
    if (useSonnet) {
      console.log(`\n🤖 Transcription longue (${transcript.length} segments), utilisation de Sonnet...`)
    } else {
      console.log(`\n🤖 Génération du résumé avec Claude Haiku...`)
    }

    const summary = await generateFinalSummary(
      transcript,
      suggestions,
      meeting.notes || undefined
    )

    console.log(`\n✅ Résumé généré:`)
    console.log(`   Summary: ${summary.summary.substring(0, 100)}...`)
    console.log(`   Topics: ${summary.topics.length}`)
    console.log(`   Decisions: ${summary.decisions.length}`)
    console.log(`   Actions: ${summary.actions.length}`)

    // Save summary to database
    console.log(`\n💾 Sauvegarde du résumé en base...`)
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: JSON.stringify(summary),
        topics: JSON.stringify(summary.topics.slice(0, 8)),
        decisions: JSON.stringify(summary.decisions.slice(0, 10)),
        actions: JSON.stringify(summary.actions.slice(0, 15)),
        status: 'completed',
      },
    })

    console.log(`\n✅ Résumé régénéré avec succès!`)
    console.log(`\n🔗 Voir le résumé: https://transcriptor-xi.vercel.app/summary/${meetingId}`)

  } catch (error) {
    console.error('\n❌ Erreur:', error)

    // Try to update status back to completed
    try {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'error',
          notes: `Error during manual regeneration: ${error instanceof Error ? error.message : String(error)}`
        },
      })
    } catch (updateError) {
      console.error('Failed to update meeting status:', updateError)
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get meeting ID from command line
const meetingId = process.argv[2]

if (!meetingId) {
  console.error('Usage: tsx scripts/regenerate-summary.ts <meetingId>')
  process.exit(1)
}

regenerateSummary(meetingId)
