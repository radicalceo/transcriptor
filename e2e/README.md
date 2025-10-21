# Tests End-to-End (E2E) avec Playwright

Ce dossier contient la suite de tests end-to-end pour l'application Meeting Copilot, utilisant [Playwright](https://playwright.dev/).

## Structure des tests

```
e2e/
├── fixtures/
│   └── test-helpers.ts    # Utilitaires et mocks pour les tests
├── homepage.spec.ts        # Tests de la page d'accueil
├── upload.spec.ts          # Tests de la page d'upload
├── meeting.spec.ts         # Tests de la page meeting en cours
├── summary.spec.ts         # Tests de la page de résumé
└── history.spec.ts         # Tests de la page d'historique
```

## Fonctionnalités couvertes

### Page d'accueil (`homepage.spec.ts`)
- ✅ Affichage des éléments principaux (titre, boutons, fonctionnalités)
- ✅ Navigation vers le démarrage d'un meeting
- ✅ Navigation vers la page d'upload
- ✅ Navigation vers l'historique
- ✅ Support du mode sombre

### Page Upload (`upload.spec.ts`)
- ✅ Affichage de l'interface d'upload
- ✅ Sélection de fichier via input
- ✅ Validation du format de fichier
- ✅ Changement de fichier après sélection
- ✅ Upload et redirection vers la page meeting
- ✅ Gestion des erreurs d'upload

### Page Meeting (`meeting.spec.ts`)
- ✅ Sélection du mode audio (microphone seul ou + onglet)
- ✅ Affichage de la transcription en temps réel
- ✅ Affichage du panel de suggestions (thèmes, décisions, actions)
- ✅ Bouton terminer le meeting
- ✅ Redirection vers le résumé
- ✅ Statut de traitement pour fichiers uploadés
- ✅ Basculement entre vue groupée et détaillée

### Page Summary (`summary.spec.ts`)
- ✅ Affichage du résumé de la réunion
- ✅ Affichage des thèmes abordés
- ✅ Affichage des décisions prises
- ✅ Affichage des actions à faire
- ✅ Navigation de retour
- ✅ Gestion des résumés manquants
- ✅ Affichage de la durée

### Page History (`history.spec.ts`)
- ✅ Affichage de la liste des meetings
- ✅ Informations de chaque meeting (statut, durée, date)
- ✅ Navigation vers le résumé d'un meeting
- ✅ Gestion de la liste vide
- ✅ Navigation vers l'accueil

## Prérequis

Les dépendances Playwright sont déjà installées. Si vous avez besoin de réinstaller les navigateurs :

```bash
npx playwright install
```

## Exécution des tests

### Lancer tous les tests

```bash
npm run test:e2e
```

### Lancer les tests en mode UI (interface graphique)

Mode recommandé pour le développement et le débogage :

```bash
npm run test:e2e:ui
```

Cette interface vous permet de :
- Voir les tests s'exécuter en direct
- Examiner les étapes de chaque test
- Voir les captures d'écran et vidéos
- Relancer facilement des tests spécifiques

### Lancer les tests avec navigateur visible

```bash
npm run test:e2e:headed
```

### Lancer un fichier de test spécifique

```bash
npx playwright test e2e/homepage.spec.ts
```

### Mode debug

Pour déboguer un test pas à pas :

```bash
npm run test:e2e:debug
```

Ou pour un test spécifique :

```bash
npx playwright test e2e/meeting.spec.ts --debug
```

### Voir le rapport des tests

Après l'exécution des tests, vous pouvez voir un rapport HTML détaillé :

```bash
npm run test:e2e:report
```

## Développement de nouveaux tests

### Structure d'un test

```typescript
import { test, expect } from '@playwright/test'
import { mockTranscriptionAPI } from './fixtures/test-helpers'

test.describe('Ma fonctionnalité', () => {
  test.beforeEach(async ({ page }) => {
    // Préparation avant chaque test
    await mockTranscriptionAPI(page)
  })

  test('doit faire quelque chose', async ({ page }) => {
    // Naviguer vers la page
    await page.goto('/ma-page')

    // Interagir avec les éléments
    await page.getByRole('button', { name: 'Mon Bouton' }).click()

    // Vérifier le résultat
    await expect(page.getByText('Résultat attendu')).toBeVisible()
  })
})
```

### Helpers disponibles

Les helpers suivants sont disponibles dans `fixtures/test-helpers.ts` :

- `mockTranscriptionAPI(page)` - Mock l'API de transcription
- `mockUploadAPI(page)` - Mock l'API d'upload
- `mockSuggestionsAPI(page)` - Mock l'API de suggestions
- `mockSummaryAPI(page)` - Mock l'API de résumé
- `mockHistoryAPI(page)` - Mock l'API de l'historique
- `createTestAudioFile(filename)` - Crée un fichier audio de test
- `waitForNavigation(page, timeout)` - Attend la fin de la navigation

### Bonnes pratiques

1. **Utilisez les rôles et labels** : Privilégiez `getByRole()` et `getByLabel()` plutôt que des sélecteurs CSS
2. **Mockez les API externes** : Utilisez les helpers pour mocker OpenAI et Claude
3. **Tests isolés** : Chaque test doit être indépendant
4. **Attentes explicites** : Utilisez `expect()` pour vérifier les résultats
5. **Gestion des timeouts** : Configurez des timeouts appropriés pour les opérations longues

## Intégration continue (CI)

Les tests peuvent être exécutés dans votre pipeline CI. Exemple pour GitHub Actions :

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Résolution des problèmes

### Les tests échouent avec "Could not connect to server"

Assurez-vous que le serveur de développement est bien démarré. Le serveur démarre automatiquement grâce à `webServer` dans `playwright.config.ts`, mais si vous avez des problèmes :

```bash
# Vérifier que le port 3000 est libre
lsof -ti:3000 | xargs kill -9  # Mac/Linux
```

### Les tests échouent avec des permissions microphone

Les tests mockent les APIs, donc les permissions microphone ne devraient pas être nécessaires. Si vous voyez cette erreur, vérifiez que les mocks sont bien appliqués.

### Les captures d'écran ne sont pas générées

Par défaut, les captures d'écran sont générées uniquement en cas d'échec. Pour forcer leur génération :

```typescript
await page.screenshot({ path: 'debug.png' })
```

## Maintenance

### Après chaque développement majeur

Il est recommandé de lancer les tests après chaque :
- Ajout de nouvelle fonctionnalité
- Modification d'une fonctionnalité existante
- Refactoring important
- Mise à jour de dépendances majeures

```bash
# Lancer tous les tests
npm run test:e2e

# Vérifier le rapport
npm run test:e2e:report
```

### Mise à jour des tests

Si vous modifiez l'interface utilisateur, pensez à mettre à jour les tests correspondants pour refléter les changements.

## Ressources

- [Documentation Playwright](https://playwright.dev/)
- [Meilleures pratiques Playwright](https://playwright.dev/docs/best-practices)
- [API Playwright](https://playwright.dev/docs/api/class-playwright)
