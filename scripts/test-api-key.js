#!/usr/bin/env node

/**
 * Script de test de la clé API Anthropic
 */

const fs = require('fs')
const path = require('path')

// Charger .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

console.log('🔍 Test de la clé API Anthropic\n')

// Vérifier que la clé existe
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY non trouvée dans .env.local')
  process.exit(1)
}

const apiKey = process.env.ANTHROPIC_API_KEY

console.log(`✅ Clé API trouvée`)
console.log(`   Longueur: ${apiKey.length} caractères`)
console.log(`   Préfixe: ${apiKey.substring(0, 12)}...`)
console.log(`   Format: ${apiKey.startsWith('sk-ant-') ? '✅ Correct' : '❌ Incorrect (devrait commencer par sk-ant-)'}`)

// Test simple de l'API
async function testAPI() {
  try {
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })

    console.log('\n📡 Test de connexion à l\'API...')

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Réponds juste "OK" si tu reçois ce message.',
        },
      ],
    })

    console.log('✅ Connexion réussie!')
    console.log(`   Réponse: ${message.content[0].text}`)
    console.log('\n🎉 La clé API fonctionne correctement!\n')
  } catch (error) {
    console.error('\n❌ Erreur lors du test de l\'API:')
    console.error(`   ${error.message}`)

    if (error.status === 401) {
      console.error('\n💡 La clé API est invalide ou expirée.')
      console.error('   Vérifiez votre clé sur https://console.anthropic.com/')
    }

    console.log('')
    process.exit(1)
  }
}

testAPI()
