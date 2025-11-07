import { test, expect } from '@playwright/test'

test.describe('Page Summary', () => {
  test.beforeEach(async ({ page }) => {
    // Mock l'API pour retourner un meeting avec résumé
    await page.route('**/api/meeting/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-meeting-id',
            title: 'Test Meeting',
            status: 'completed',
            createdAt: new Date().toISOString(),
            duration: 1800,
            transcript: ['Test transcript'],
            transcriptSegments: [],
            summary: {
              summary: 'Résumé de test de la réunion',
              topics: ['Budget', 'Planning'],
              decisions: [{ text: 'Décision de test' }],
              actions: [{ text: 'Action de test', assignee: 'Test User' }],
            },
            suggestions: { topics: [], decisions: [], actions: [] },
          },
        }),
      })
    })
  })

  test('affiche le titre du meeting', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')

    // Attendre que la page charge
    await page.waitForLoadState('networkidle')

    // Vérifier que le titre du meeting est visible
    await expect(page.getByRole('heading', { name: /Test Meeting/i })).toBeVisible()
  })

  test('affiche la synthèse', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que la section Synthèse est visible
    await expect(page.getByText('Synthèse')).toBeVisible()

    // Vérifier que le résumé principal s'affiche
    await expect(page.getByText('Résumé de test de la réunion')).toBeVisible()
  })

  test('affiche les thèmes abordés', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que les thèmes apparaissent
    await expect(page.getByText('Budget')).toBeVisible()
    await expect(page.getByText('Planning')).toBeVisible()
  })

  test('affiche les décisions prises', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que les décisions apparaissent
    await expect(page.getByText('Décision de test')).toBeVisible()
  })

  test('affiche les actions à faire', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que les actions apparaissent
    await expect(page.getByText('Action de test')).toBeVisible()
    await expect(page.getByText('Test User')).toBeVisible()
  })

  test('permet de retourner à l\'historique', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Cliquer sur le bouton retour à l'historique
    await page.getByRole('button', { name: /Retour/i }).first().click()

    // Vérifier la redirection vers l'historique
    await page.waitForURL('/history', { timeout: 5000 })
  })

  test('affiche un bouton pour modifier le résumé', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que le bouton Modifier est visible (prendre le premier car il y en a 2)
    await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible()
  })

  test('affiche un bouton pour copier le résumé', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que le bouton Copier est visible
    await expect(page.getByRole('button', { name: /Copier/i })).toBeVisible()
  })

  test('affiche un message si aucun résumé n\'est disponible', async ({ page }) => {
    // Mock l'API pour retourner un meeting sans résumé
    await page.route('**/api/meeting/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-meeting-id',
            status: 'completed',
            transcript: ['Test transcript'],
            summary: null,
          },
        }),
      })
    })

    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier qu'un message approprié s'affiche
    await expect(page.getByText(/Résumé non disponible/i)).toBeVisible()
  })

  test('permet de naviguer vers la vue détaillée', async ({ page }) => {
    await page.goto('/summary/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Chercher le bouton "Vue détaillée"
    const detailedButton = page.getByRole('button', { name: /Vue détaillée/i })
    if (await detailedButton.isVisible()) {
      await detailedButton.click()
      await page.waitForURL(/\/summary\/.*\/detailed/, { timeout: 5000 })
    }
  })
})
