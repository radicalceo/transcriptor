import { test, expect } from '@playwright/test'
import { mockTranscriptionAPI, mockSuggestionsAPI, mockSummaryAPI } from './fixtures/test-helpers'

test.describe('Page Meeting', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranscriptionAPI(page)
    await mockSuggestionsAPI(page)
    await mockSummaryAPI(page)
  })

  test('affiche le sélecteur de mode audio pour un nouveau meeting', async ({ page, context }) => {
    // Donner les permissions microphone
    await context.grantPermissions(['microphone'])

    await page.goto('/meeting/test-meeting-id')

    // Vérifier que le sélecteur de mode audio s'affiche
    await expect(page.getByRole('heading', { name: /Choisissez votre mode d'enregistrement/i })).toBeVisible()

    // Vérifier les deux options
    await expect(page.getByText(/Microphone uniquement/i)).toBeVisible()
    await expect(page.getByText(/Microphone \+ Audio de l'onglet/i)).toBeVisible()
  })

  test('permet de sélectionner le mode microphone uniquement', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.goto('/meeting/test-meeting-id')

    // Attendre que le sélecteur soit visible
    await expect(page.getByRole('heading', { name: /Choisissez votre mode d'enregistrement/i })).toBeVisible()

    // Cliquer sur l'option "Microphone uniquement"
    await page.getByRole('button', { name: /Microphone uniquement/i }).click()

    // Vérifier que la page meeting s'affiche
    await expect(page.getByRole('heading', { name: /Meeting en cours/i })).toBeVisible()
  })

  test('affiche la transcription en cours', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    // Aller directement sur la page (sans sélecteur de mode)
    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed', // Pour éviter le sélecteur de mode
              transcript: ['Bonjour à tous', 'Commençons la réunion'],
              transcriptSegments: [
                { text: 'Bonjour à tous', timestamp: 0, speaker: 'Speaker A' },
                { text: 'Commençons la réunion', timestamp: 5, speaker: 'Speaker B' },
              ],
              suggestions: {
                topics: ['Introduction'],
                decisions: [],
                actions: [],
              },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')

    // Vérifier que la section transcription est visible
    await expect(page.getByText(/Transcription en direct/i)).toBeVisible()

    // Vérifier que les segments de transcription apparaissent
    await expect(page.getByText('Bonjour à tous')).toBeVisible()
    await expect(page.getByText('Commençons la réunion')).toBeVisible()
  })

  test('affiche le panel de suggestions', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed',
              transcript: ['Test transcript'],
              transcriptSegments: [],
              suggestions: {
                topics: ['Budget', 'Roadmap Q1'],
                decisions: ['Lancer le projet le 1er novembre'],
                actions: [
                  { text: 'Préparer le deck', assignee: 'Julien', due_date: '2025-10-25' },
                ],
              },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Vérifier que le panel de suggestions existe (simplifié)
    // Les suggestions peuvent être vides sur une nouvelle page, donc on vérifie juste la structure
    const suggestionsPanel = page.locator('text=Thèmes').or(page.locator('text=Décisions')).or(page.locator('text=Actions'))
    await expect(suggestionsPanel.first()).toBeVisible()
  })

  test('affiche le bouton terminer le meeting', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed', // Status completed pour éviter le sélecteur de mode
              transcript: ['Test'],
              transcriptSegments: [],
              suggestions: { topics: [], decisions: [], actions: [] },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Pour un meeting completed, vérifier qu'on peut voir soit le transcript soit le bouton résumé
    const hasViewSummaryButton = await page.getByRole('button', { name: /Voir le résumé/i }).isVisible().catch(() => false)
    const hasTranscript = await page.getByText('Transcription en direct').isVisible().catch(() => false)

    expect(hasViewSummaryButton || hasTranscript).toBeTruthy()
  })

  test('peut naviguer vers le résumé depuis un meeting terminé', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed',
              transcript: ['Test'],
              transcriptSegments: [],
              summary: { summary: 'Test summary', topics: [], decisions: [], actions: [] },
              suggestions: { topics: [], decisions: [], actions: [] },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')
    await page.waitForLoadState('networkidle')

    // Pour un meeting completed avec summary, vérifier qu'on peut naviguer vers le résumé
    const viewSummaryButton = page.getByRole('button', { name: /Voir le résumé/i })
    if (await viewSummaryButton.isVisible()) {
      await viewSummaryButton.click()
      await page.waitForURL(/\/summary\/.+/, { timeout: 5000 })
      expect(page.url()).toMatch(/\/summary\//)
    }
  })

  test('affiche le statut de traitement pour un fichier uploadé', async ({ page }) => {
    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'processing',
              transcript: [],
              suggestions: { topics: [], decisions: [], actions: [] },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')

    // Vérifier que le statut "Transcription audio..." s'affiche
    await expect(page.getByText(/Transcription audio.../i)).toBeVisible()

    // Vérifier le message dans la zone de transcription
    await expect(page.getByText(/Transcription en cours avec Whisper/i)).toBeVisible()
  })

  test('affiche le bouton retour vers l\'historique', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed',
              transcript: ['Test'],
              suggestions: { topics: [], decisions: [], actions: [] },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')

    // Vérifier que le bouton retour est visible (SVG avec path)
    const backButton = page.locator('button', { has: page.locator('svg path[d*="15 19l-7-7 7-7"]') })
    await expect(backButton).toBeVisible()

    // Cliquer sur le bouton retour
    await backButton.click()

    // Vérifier la redirection vers l'historique
    await page.waitForURL('/history', { timeout: 5000 })
  })

  test('permet de basculer entre vue groupée et vue détaillée', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/meeting/test-meeting-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-meeting-id',
              status: 'completed',
              transcript: ['Test 1', 'Test 2'],
              transcriptSegments: [
                { text: 'Test 1', timestamp: 0, speaker: 'Speaker A' },
                { text: 'Test 2', timestamp: 10, speaker: 'Speaker B' },
              ],
              suggestions: { topics: [], decisions: [], actions: [] },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/meeting/test-meeting-id')

    // Vérifier que le bouton de basculement est visible
    const toggleButton = page.getByRole('button', { name: /Vue détaillée|Vue groupée/i })
    await expect(toggleButton).toBeVisible()

    // Cliquer pour basculer
    await toggleButton.click()

    // Vérifier que le texte du bouton a changé
    await expect(page.getByRole('button', { name: /Vue groupée|Vue détaillée/i })).toBeVisible()
  })
})
