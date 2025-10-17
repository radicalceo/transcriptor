#!/usr/bin/env node

/**
 * Test de la logique de déduplication
 */

// Import via require car on ne peut pas utiliser import dans un script Node.js simple
const path = require('path')

console.log('🧪 Test de la déduplication\n')

// Test des topics
const testTopics = [
  'Création back office application',
  'Back office',
  'Application',
  'Création back office',
  'back office application',
  'Budget marketing',
  'Marketing',
  'Budget',
]

console.log('📋 Topics avant déduplication:')
testTopics.forEach((t, i) => console.log(`   ${i + 1}. ${t}`))

// Logique de déduplication simplifiée pour le test
function similarity(str1, str2) {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  if (s1 === s2) return 1

  // Simple check: si l'un contient l'autre
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8
  }

  // Distance de Levenshtein simplifiée
  const maxLen = Math.max(s1.length, s2.length)
  let matches = 0
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) matches++
  }
  return matches / maxLen
}

function deduplicateTopics(topics) {
  const unique = []
  const SIMILARITY_THRESHOLD = 0.7

  for (const topic of topics) {
    let isDuplicate = false

    for (let i = 0; i < unique.length; i++) {
      const existingTopic = unique[i]
      const sim = similarity(topic, existingTopic)

      if (sim > SIMILARITY_THRESHOLD) {
        // Garder le plus long
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

const deduplicatedTopics = deduplicateTopics(testTopics)

console.log('\n✅ Topics après déduplication:')
deduplicatedTopics.forEach((t, i) => console.log(`   ${i + 1}. ${t}`))

console.log(`\n📊 Résultat: ${testTopics.length} topics → ${deduplicatedTopics.length} topics`)

// Test des actions/décisions
const testActions = [
  { text: 'Julien prépare le deck avant lundi', assignee: 'Julien' },
  { text: 'Julien prépare le deck', assignee: null },
  { text: 'Préparer le deck avant lundi', assignee: 'Julien' },
  { text: 'Sarah planifie une démo', assignee: 'Sarah' },
  { text: 'Sarah planifie la démo client', assignee: 'Sarah' },
]

console.log('\n📋 Actions avant déduplication:')
testActions.forEach((a, i) =>
  console.log(`   ${i + 1}. ${a.text} ${a.assignee ? `(${a.assignee})` : ''}`)
)

function deduplicateActions(actions) {
  const unique = []
  const SIMILARITY_THRESHOLD = 0.75

  for (const action of actions) {
    let isDuplicate = false

    for (let i = 0; i < unique.length; i++) {
      const existingAction = unique[i]
      const sim = similarity(action.text, existingAction.text)

      if (sim > SIMILARITY_THRESHOLD) {
        // Garder celle avec le plus d'infos
        if (
          (action.assignee && !existingAction.assignee) ||
          action.text.length > existingAction.text.length
        ) {
          unique[i] = action
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

const deduplicatedActions = deduplicateActions(testActions)

console.log('\n✅ Actions après déduplication:')
deduplicatedActions.forEach((a, i) =>
  console.log(`   ${i + 1}. ${a.text} ${a.assignee ? `(${a.assignee})` : ''}`)
)

console.log(
  `\n📊 Résultat: ${testActions.length} actions → ${deduplicatedActions.length} actions`
)

console.log('\n✅ Tests de déduplication terminés!\n')
