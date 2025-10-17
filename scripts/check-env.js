#!/usr/bin/env node

/**
 * Script de vérification de l'environnement
 * Vérifie que toutes les dépendances et configurations sont en place
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Vérification de l\'environnement...\n')

let hasErrors = false

// Check 1: Node version
const nodeVersion = process.version
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1))
if (majorVersion < 18) {
  console.error('❌ Node.js version trop ancienne. Version requise: >= 18')
  console.error(`   Version actuelle: ${nodeVersion}`)
  hasErrors = true
} else {
  console.log(`✅ Node.js version: ${nodeVersion}`)
}

// Check 2: package.json
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json introuvable')
  hasErrors = true
} else {
  console.log('✅ package.json trouvé')
}

// Check 3: node_modules
if (!fs.existsSync('node_modules')) {
  console.error('❌ node_modules introuvable. Lancez: npm install')
  hasErrors = true
} else {
  console.log('✅ node_modules installé')
}

// Check 4: .env.local
if (!fs.existsSync('.env.local')) {
  console.warn('⚠️  .env.local introuvable')
  console.warn('   Créez ce fichier et ajoutez votre ANTHROPIC_API_KEY')
  hasErrors = true
} else {
  const envContent = fs.readFileSync('.env.local', 'utf-8')

  if (!envContent.includes('ANTHROPIC_API_KEY')) {
    console.error('❌ ANTHROPIC_API_KEY manquant dans .env.local')
    hasErrors = true
  } else if (envContent.includes('sk-ant-your-key-here') || envContent.includes('sk-ant-...')) {
    console.error('❌ ANTHROPIC_API_KEY non configuré (placeholder détecté)')
    hasErrors = true
  } else {
    console.log('✅ .env.local configuré avec ANTHROPIC_API_KEY')
  }
}

// Check 5: Required directories
const requiredDirs = ['app', 'lib', 'components', 'doc']
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Dossier manquant: ${dir}`)
    hasErrors = true
  } else {
    console.log(`✅ Dossier ${dir} trouvé`)
  }
})

// Check 6: Required API routes
const apiRoutes = [
  'app/api/meeting/start/route.ts',
  'app/api/meeting/[id]/route.ts',
  'app/api/suggestions/route.ts',
  'app/api/summary/route.ts'
]

apiRoutes.forEach(route => {
  if (!fs.existsSync(route)) {
    console.error(`❌ API route manquante: ${route}`)
    hasErrors = true
  }
})

if (apiRoutes.every(route => fs.existsSync(route))) {
  console.log('✅ Toutes les API routes sont en place')
}

// Check 7: Required pages
const pages = [
  'app/page.tsx',
  'app/meeting/[id]/page.tsx',
  'app/summary/[id]/page.tsx'
]

pages.forEach(page => {
  if (!fs.existsSync(page)) {
    console.error(`❌ Page manquante: ${page}`)
    hasErrors = true
  }
})

if (pages.every(page => fs.existsSync(page))) {
  console.log('✅ Toutes les pages sont en place')
}

// Summary
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.error('\n❌ Certaines vérifications ont échoué.')
  console.error('Corrigez les erreurs ci-dessus avant de continuer.\n')
  process.exit(1)
} else {
  console.log('\n✅ Tout est prêt ! Lancez: npm run dev')
  console.log('Puis ouvrez http://localhost:3000 dans Chrome ou Edge.\n')
}
