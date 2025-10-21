import { test, expect } from '@playwright/test'

test.describe('Page Historique', () => {
  test.beforeEach(async ({ page }) => {
    // Mock l'API pour retourner des meetings
    await page.route('**/api/meetings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meetings: [
            {
              id: 'meeting-1',
              title: 'Test Meeting 1',
              status: 'completed',
              type: 'live',
              createdAt: new Date().toISOString(),
              duration: 1800,
              transcript: ['Test 1', 'Test 2'],
              summary: { summary: 'Summary 1', topics: [], decisions: [], actions: [] },
            },
            {
              id: 'meeting-2',
              title: 'Test Meeting 2',
              status: 'completed',
              type: 'upload',
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              duration: 3600,
              transcript: ['Test 3'],
              summary: { summary: 'Summary 2', topics: [], decisions: [], actions: [] },
            },
          ],
        }),
      })
    })
  })

  test('affiche le titre de la page', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que le titre est visible
    await expect(page.getByRole('heading', { name: /Historique des meetings/i })).toBeVisible()
  })

  test('affiche la liste des meetings passés', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que les meetings apparaissent
    await expect(page.getByText('Test Meeting 1')).toBeVisible()
    await expect(page.getByText('Test Meeting 2')).toBeVisible()
  })

  test('affiche les informations de chaque meeting', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que le statut est affiché
    await expect(page.getByText(/Terminé/i).first()).toBeVisible()

    // Vérifier que la durée est affichée (30:00 pour 1800s, 60:00 pour 3600s)
    await expect(page.getByText(/30:00|60:00/i).first()).toBeVisible()

    // Vérifier que le nombre de segments est affiché
    await expect(page.getByText(/segments/i).first()).toBeVisible()
  })

  test('affiche le bouton Nouveau meeting', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que le bouton est visible
    await expect(page.getByRole('button', { name: /Nouveau meeting/i })).toBeVisible()
  })

  test('affiche le bouton Retour à l\'accueil', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que le bouton retour est visible
    await expect(page.getByRole('button', { name: /Retour à l'accueil/i })).toBeVisible()
  })

  test('affiche un message si aucun meeting n\'existe', async ({ page }) => {
    // Mock l'API pour retourner une liste vide
    await page.route('**/api/meetings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meetings: [],
        }),
      })
    })

    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier qu'un message approprié s'affiche
    await expect(page.getByText(/Aucun meeting/i)).toBeVisible()
  })

  test('permet de naviguer vers un meeting', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que les boutons Transcript et Résumé sont visibles
    const transcriptButtons = page.getByRole('button', { name: /Transcript/i })
    const summaryButtons = page.getByRole('button', { name: /Résumé/i })

    // Au moins un bouton doit être visible
    const transcriptCount = await transcriptButtons.count()
    const summaryCount = await summaryButtons.count()

    expect(transcriptCount + summaryCount).toBeGreaterThan(0)
  })

  test('affiche le type de meeting (Live ou Upload)', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier qu'au moins un type est affiché
    const hasLive = await page.getByText('Live').isVisible().catch(() => false)
    const hasUpload = await page.getByText('Upload').isVisible().catch(() => false)

    expect(hasLive || hasUpload).toBeTruthy()
  })

  test('affiche le nombre total d\'enregistrements', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Vérifier que le compteur s'affiche
    await expect(page.getByText(/2 enregistrements|2 enregistrement/i)).toBeVisible()
  })

  test('permet de retourner à l\'accueil via le bouton', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Cliquer sur le bouton "Retour à l'accueil"
    await page.getByRole('button', { name: /Retour à l'accueil/i }).click()

    // Vérifier la redirection
    await page.waitForURL('/', { timeout: 5000 })
  })
})
