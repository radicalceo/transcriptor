# 🔧 Dépannage des Tests E2E

Guide de résolution des problèmes courants avec les tests Playwright.

## Problèmes courants

### 1. Tests qui timeout ou prennent trop de temps

**Symptôme** : Les tests dépassent le timeout de 60s

**Causes possibles** :
- Next.js met du temps à démarrer
- Port 3000 déjà utilisé
- Ressources système insuffisantes

**Solutions** :

```bash
# 1. Vérifier que le port 3000 est libre
lsof -ti:3000 | xargs kill -9

# 2. Augmenter le timeout dans playwright.config.ts (déjà à 60s)
# 3. Lancer un seul test pour voir s'il passe
npx playwright test e2e/homepage.spec.ts
```

### 2. "Element not found" ou "toBeVisible failed"

**Symptôme** : Les tests ne trouvent pas les éléments attendus

**Causes possibles** :
- Structure de la page différente de ce qu'attend le test
- Page pas complètement chargée
- Mock API pas appliqué

**Solutions** :

```typescript
// Ajouter une attente explicite
await page.waitForLoadState('networkidle')

// Ou attendre un élément spécifique
await page.waitForSelector('h1')

// Déboguer avec screenshot
await page.screenshot({ path: 'debug.png' })
```

### 3. Mocks qui ne fonctionnent pas

**Symptôme** : L'application fait des vrais appels API au lieu d'utiliser les mocks

**Solution** :

```typescript
// S'assurer que le mock est défini AVANT page.goto()
await page.route('**/api/meetings', async (route) => {
  // ...mock
})

await page.goto('/history') // Après le mock
```

### 4. Tests qui passent localement mais échouent en CI

**Causes possibles** :
- Différences d'environnement
- Timeout trop court
- Dépendances manquantes

**Solutions** :

```yaml
# Dans .github/workflows/e2e-tests.yml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

# Augmenter le timeout du job
timeout-minutes: 60
```

### 5. "Browser not found"

**Symptôme** : Playwright ne trouve pas Chromium/Firefox/Webkit

**Solution** :

```bash
# Réinstaller les navigateurs
npx playwright install

# Ou avec dépendances système
npx playwright install --with-deps
```

### 6. Tests lents sur Mac M1/M2

**Cause** : Rosetta ou architecture ARM

**Solution** :

```bash
# Utiliser la version ARM native de Node
# S'assurer d'utiliser Node 18+ ARM64

# Ou limiter les workers
npx playwright test --workers=1
```

## Commandes utiles de débogage

### Voir ce qui se passe en temps réel

```bash
# Mode headed (navigateur visible)
npx playwright test --headed

# Mode debug (pas à pas)
npx playwright test --debug

# Mode UI (interface graphique)
npm run test:e2e:ui
```

### Capturer des informations

```bash
# Avec trace
npx playwright test --trace on

# Puis voir la trace
npx playwright show-trace trace.zip

# Screenshot de toutes les pages
npx playwright test --screenshot=on
```

### Tester seulement ce qui échoue

```bash
# Relancer uniquement les tests qui ont échoué
npx playwright test --last-failed

# Relancer avec plus de verbosité
npx playwright test --reporter=list
```

## Analyser les échecs

### 1. Voir le rapport HTML

```bash
npm run test:e2e:report
```

Le rapport contient :
- Screenshots des échecs
- Vidéos des tests
- Stack traces complètes
- Timeline des événements

### 2. Examiner les screenshots

Les screenshots sont dans `test-results/[test-name]/test-failed-*.png`

### 3. Regarder les vidéos

Les vidéos sont dans `test-results/[test-name]/video.webm`

## Problèmes spécifiques aux pages

### Page History

**Problème** : "Historique des meetings" not found

**Vérification** :
```bash
# Vérifier que la page existe
curl http://localhost:3000/history
```

**Solution** : Le titre exact est "Historique des meetings" (pas juste "Historique")

### Page Summary

**Problème** : Summary content not visible

**Vérification** :
```typescript
// Ajouter waitForLoadState
await page.waitForLoadState('networkidle')

// Vérifier que le mock inclut summary
meeting: {
  summary: {
    summary: 'Text...',
    topics: [...],
    decisions: [...],
    actions: [...]
  }
}
```

### Page Meeting

**Problème** : Microphone permissions

**Solution** :
```typescript
// Accorder les permissions dans le test
await context.grantPermissions(['microphone'])
```

## Performance

### Tests trop lents

```typescript
// Dans playwright.config.ts
workers: 5, // Augmenter pour paralléliser

// Ou utiliser seulement Chromium
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  // Commenter Firefox et Webkit
]
```

### Réduire le temps de démarrage de Next.js

```typescript
// Dans playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: true, // Réutiliser le serveur si déjà démarré
}
```

## Nettoyer l'environnement

```bash
# Supprimer les résultats de test
rm -rf test-results/ playwright-report/

# Supprimer le cache
rm -rf playwright/.cache/

# Réinstaller Playwright
npm install @playwright/test --save-dev --legacy-peer-deps
npx playwright install
```

## Obtenir de l'aide

### Logs détaillés

```bash
# Avec debug complet
DEBUG=pw:api npx playwright test

# Ou avec tous les logs
DEBUG=* npx playwright test
```

### Documentation officielle

- [Playwright Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

### Vérifier la configuration

```bash
# Voir la config effective
npx playwright show-config
```

## Checklist de dépannage

Avant d'ouvrir une issue, vérifiez :

- [ ] Port 3000 est libre
- [ ] Navigateurs Playwright installés (`npx playwright install`)
- [ ] Dépendances à jour (`npm install --legacy-peer-deps`)
- [ ] Tests passent en mode UI (`npm run test:e2e:ui`)
- [ ] Mocks définis avant `page.goto()`
- [ ] `waitForLoadState('networkidle')` ajouté si nécessaire
- [ ] Screenshots/vidéos examinés
- [ ] Rapport HTML consulté

---

**Besoin d'aide ?** Consultez d'abord ce guide, puis les docs Playwright, puis ouvrez une issue avec :
- Le message d'erreur complet
- Le screenshot du test qui échoue
- Votre configuration (OS, Node version, etc.)
