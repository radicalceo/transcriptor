import { Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Helpers et utilitaires pour les tests e2e
 */

/**
 * Créer un fichier audio de test simple
 * Note: Dans un environnement réel, vous voudriez utiliser un vrai fichier audio
 */
export function createTestAudioFile(filename: string = 'test-audio.mp3'): string {
  const fixturesDir = path.join(process.cwd(), 'e2e/fixtures')
  const filePath = path.join(fixturesDir, filename)

  // Créer un fichier MP3 minimal (header MP3)
  // Pour les tests, on utilise un fichier vide ou minimal
  // Dans un vrai projet, vous utiliseriez un vrai fichier audio
  if (!fs.existsSync(filePath)) {
    // Créer un fichier vide pour les tests (à remplacer par un vrai fichier audio)
    const buffer = Buffer.alloc(1024)
    fs.writeFileSync(filePath, buffer)
  }

  return filePath
}

/**
 * Mocker l'API de transcription (audio-only et screen-share)
 */
export async function mockTranscriptionAPI(page: Page) {
  // Mock audio-only routes
  await page.route('**/api/audio-only/**', async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'POST' && url.includes('/api/audio-only/start')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-audio-only-id',
            status: 'active',
            type: 'audio-only',
            transcript: [],
            suggestions: {
              topics: [],
              decisions: [],
              actions: [],
            },
          },
        }),
      })
    } else if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-meeting-id',
            status: 'active',
            transcript: ['Test transcript segment'],
            transcriptSegments: [
              {
                text: 'Test transcript segment',
                timestamp: 0,
                speaker: 'Speaker 1',
              },
            ],
            suggestions: {
              topics: ['Test topic'],
              decisions: ['Test decision'],
              actions: [{ text: 'Test action', assignee: 'John' }],
            },
          },
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Mock screen-share routes
  await page.route('**/api/screen-share/**', async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'POST' && url.includes('/api/screen-share/start')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-screen-share-id',
            status: 'active',
            type: 'screen-share',
            transcript: [],
            suggestions: {
              topics: [],
              decisions: [],
              actions: [],
            },
          },
        }),
      })
    } else if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-screen-share-id',
            status: 'active',
            type: 'screen-share',
            transcript: ['Test transcript segment'],
            transcriptSegments: [
              {
                text: 'Test transcript segment',
                timestamp: 0,
                speaker: 'Speaker 1',
              },
            ],
            suggestions: {
              topics: ['Test topic'],
              decisions: ['Test decision'],
              actions: [{ text: 'Test action', assignee: 'John' }],
            },
          },
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Mock generic meeting routes (for GET requests)
  await page.route('**/api/meeting/**', async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-meeting-id',
            status: 'active',
            type: 'audio-only',
            transcript: ['Test transcript segment'],
            transcriptSegments: [
              {
                text: 'Test transcript segment',
                timestamp: 0,
                speaker: 'Speaker 1',
              },
            ],
            suggestions: {
              topics: ['Test topic'],
              decisions: ['Test decision'],
              actions: [{ text: 'Test action', assignee: 'John' }],
            },
          },
        }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mocker l'API d'upload
 */
export async function mockUploadAPI(page: Page) {
  await page.route('**/api/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        meetingId: 'test-upload-meeting-id',
      }),
    })
  })
}

/**
 * Mocker l'API de suggestions
 */
export async function mockSuggestionsAPI(page: Page) {
  await page.route('**/api/suggestions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        suggestions: {
          topics: ['Budget', 'Roadmap Q1'],
          decisions: ['Lancer le projet le 1er novembre'],
          actions: [
            { text: 'Préparer le deck', assignee: 'Julien', due_date: '2025-10-25' },
            { text: 'Planifier une démo client', assignee: 'Sarah' },
          ],
        },
      }),
    })
  })
}

/**
 * Mocker l'API de résumé
 */
export async function mockSummaryAPI(page: Page) {
  await page.route('**/api/summary**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'POST') {
      // POST /api/summary - génération du résumé
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          summary: {
            summary: 'Résumé de test de la réunion',
            topics: ['Budget', 'Planning'],
            decisions: [{ text: 'Décision de test' }],
            actions: [{ text: 'Action de test', assignee: 'Test User' }],
          },
        }),
      })
    } else if (method === 'GET') {
      // GET /api/summary/[id]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meeting: {
            id: 'test-meeting-id',
            status: 'completed',
            transcript: ['Test transcript'],
            summary: {
              summary: 'Résumé de test de la réunion',
              topics: ['Budget', 'Planning'],
              decisions: [{ text: 'Décision de test' }],
              actions: [{ text: 'Action de test', assignee: 'Test User' }],
            },
          },
        }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mocker l'API de l'historique
 */
export async function mockHistoryAPI(page: Page) {
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
            createdAt: new Date().toISOString(),
            duration: 1800,
          },
          {
            id: 'meeting-2',
            title: 'Test Meeting 2',
            status: 'completed',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            duration: 3600,
          },
        ],
      }),
    })
  })
}

/**
 * Attendre que la navigation soit terminée
 */
export async function waitForNavigation(page: Page, timeout: number = 5000) {
  await page.waitForLoadState('networkidle', { timeout })
}

/**
 * Nettoyer les fichiers de test
 */
export function cleanupTestFiles() {
  const fixturesDir = path.join(process.cwd(), 'e2e/fixtures')
  const testFiles = fs.readdirSync(fixturesDir).filter((file) => file.startsWith('test-'))

  testFiles.forEach((file) => {
    const filePath = path.join(fixturesDir, file)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })
}
