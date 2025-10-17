#!/usr/bin/env node

/**
 * Script de test de la clé API OpenAI
 */

const fs = require('fs')
const path = require('path')

// Charger .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

console.log('🔍 Test de la clé API OpenAI\n')

// Vérifier que la clé existe
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY non trouvée dans .env.local')
  console.error('   Cette clé est nécessaire pour l\'upload de fichiers audio\n')
  process.exit(1)
}

const apiKey = process.env.OPENAI_API_KEY

console.log(`✅ Clé API trouvée`)
console.log(`   Longueur: ${apiKey.length} caractères`)
console.log(`   Préfixe: ${apiKey.substring(0, 7)}...`)
console.log(
  `   Format: ${apiKey.startsWith('sk-') ? '✅ Correct' : '❌ Incorrect (devrait commencer par sk-)'}`
)

// Test simple de l'API
async function testAPI() {
  try {
    const OpenAI = require('openai')
    const client = new OpenAI({ apiKey })

    console.log('\n📡 Test de connexion à l\'API...')

    // Tester avec l'endpoint le plus simple
    const response = await client.models.list()

    console.log('✅ Connexion réussie!')
    console.log(`   ${response.data.length} modèles disponibles`)

    // Vérifier que Whisper est disponible
    const whisperModel = response.data.find((m) => m.id === 'whisper-1')
    if (whisperModel) {
      console.log('✅ Modèle Whisper disponible')
    } else {
      console.warn('⚠️  Modèle Whisper non trouvé (peut nécessiter des crédits)')
    }

    console.log('\n🎉 La clé API OpenAI fonctionne correctement!')
    console.log('   Vous pouvez maintenant uploader des fichiers audio.\n')
  } catch (error) {
    console.error('\n❌ Erreur lors du test de l\'API:')
    console.error(`   ${error.message}`)

    if (error.status === 401) {
      console.error('\n💡 La clé API est invalide.')
      console.error('   Vérifiez votre clé sur https://platform.openai.com/api-keys')
    }

    if (error.code === 'insufficient_quota') {
      console.error('\n💡 Quota dépassé ou crédits insuffisants.')
      console.error(
        '   Ajoutez des crédits sur https://platform.openai.com/account/billing'
      )
    }

    console.log('')
    process.exit(1)
  }
}

testAPI()
