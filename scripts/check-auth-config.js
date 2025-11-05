#!/usr/bin/env node

/**
 * Script de vérification de la configuration d'authentification
 * Vérifie que toutes les variables d'environnement nécessaires sont présentes
 */

const requiredVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'DATABASE_URL',
];

const optionalVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
];

console.log('🔍 Vérification de la configuration d\'authentification...\n');

let hasErrors = false;

// Vérification des variables requises
console.log('✅ Variables obligatoires:');
requiredVars.forEach(varName => {
  if (process.env[varName]) {
    const value = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')
      ? '***' + process.env[varName].slice(-4)
      : process.env[varName];
    console.log(`  ✓ ${varName}: ${value}`);
  } else {
    console.log(`  ✗ ${varName}: MANQUANT`);
    hasErrors = true;
  }
});

// Vérification des variables optionnelles
console.log('\n📋 Variables optionnelles:');
optionalVars.forEach(varName => {
  if (process.env[varName]) {
    const value = varName.includes('SECRET') || varName.includes('KEY')
      ? '***' + process.env[varName].slice(-4)
      : process.env[varName];
    console.log(`  ✓ ${varName}: ${value}`);
  } else {
    console.log(`  - ${varName}: non configuré`);
  }
});

// Vérifications spécifiques
console.log('\n🔧 Vérifications spécifiques:');

// NEXTAUTH_URL
if (process.env.NEXTAUTH_URL) {
  const url = process.env.NEXTAUTH_URL;
  if (url.endsWith('/')) {
    console.log('  ⚠️  NEXTAUTH_URL ne doit pas se terminer par "/"');
    hasErrors = true;
  }

  if (process.env.NODE_ENV === 'production' && url.includes('localhost')) {
    console.log('  ⚠️  NEXTAUTH_URL pointe vers localhost en production');
    hasErrors = true;
  }

  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    console.log('  ⚠️  NEXTAUTH_URL devrait utiliser HTTPS en production');
    hasErrors = true;
  }
}

// NEXTAUTH_SECRET
if (process.env.NEXTAUTH_SECRET) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret.length < 32) {
    console.log('  ⚠️  NEXTAUTH_SECRET devrait faire au moins 32 caractères');
    hasErrors = true;
  }
}

// DATABASE_URL
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.log('  ⚠️  DATABASE_URL ne semble pas être une URL PostgreSQL');
  }
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('❌ Des problèmes ont été détectés dans la configuration');
  console.log('\nConsultez VERCEL_AUTH_DEBUG.md pour plus d\'informations');
  process.exit(1);
} else {
  console.log('✅ Configuration OK');
  process.exit(0);
}
