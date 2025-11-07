import { test, expect } from '@playwright/test'
import { mockTranscriptionAPI, mockSuggestionsAPI, mockSummaryAPI } from './fixtures/test-helpers'

test.describe('Page Meeting Audio-Only', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranscriptionAPI(page)
    await mockSuggestionsAPI(page)
    await mockSummaryAPI(page)
  })

  test('affiche la transcription en cours', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    //Mock pour avoir une transcription
    await page.route('**/api/audio-only/test-audio-only-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-audio-only-id',
              type: 'audio-only',
              status: 'active',
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

    await page.goto('/meeting/audio-only/test-audio-only-id')

    // Vérifier que la section transcription est visible
    await expect(page.getByText(/Transcription en direct/i)).toBeVisible()

    // Vérifier que les segments de transcription apparaissent
    await expect(page.getByText('Bonjour à tous')).toBeVisible()
    await expect(page.getByText('Commençons la réunion')).toBeVisible()
  })

  test('affiche le panel de notes', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/audio-only/test-audio-only-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-audio-only-id',
              type: 'audio-only',
              status: 'active',
              transcript: ['Test transcript'],
              transcriptSegments: [],
              notes: '',
              suggestions: {
                topics: [],
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

    await page.goto('/meeting/audio-only/test-audio-only-id')

    // Vérifier que le panel de notes est visible (utiliser heading pour éviter la duplication)
    await expect(page.getByRole('heading', { name: /Notes/i })).toBeVisible()
  })

  test('affiche le bouton terminer le meeting', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    await page.route('**/api/audio-only/test-audio-only-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-audio-only-id',
              type: 'audio-only',
              status: 'active',
              transcript: [],
              transcriptSegments: [],
              suggestions: {
                topics: [],
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

    await page.goto('/meeting/audio-only/test-audio-only-id')

    // Vérifier que le bouton "Terminer" est visible
    await expect(page.getByRole('button', { name: /Terminer/i })).toBeVisible()
  })

  test('peut naviguer vers le résumé depuis un meeting terminé', async ({ page }) => {
    await page.route('**/api/audio-only/test-audio-only-id', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            meeting: {
              id: 'test-audio-only-id',
              type: 'audio-only',
              status: 'completed',
              transcript: ['Test'],
              transcriptSegments: [],
              suggestions: {
                topics: [],
                decisions: [],
                actions: [],
              },
              summary: {
                summary: 'Test summary',
                topics: [],
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

    await page.goto('/meeting/audio-only/test-audio-only-id')

    // Vérifier qu'on a un lien/bouton vers le résumé
    await expect(page.getByText(/Résumé|Summary/i)).toBeVisible()
  })
})
