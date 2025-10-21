#!/bin/bash

# Script de test rapide pour vérifier que Playwright fonctionne

echo "🧪 Test rapide Playwright..."
echo ""

# Test uniquement la page d'accueil
npx playwright test e2e/homepage.spec.ts --reporter=line

echo ""
echo "✅ Test rapide terminé !"
echo "Pour lancer tous les tests : npm run test:e2e"
echo "Pour voir l'interface : npm run test:e2e:ui"
