import { test, expect } from '@playwright/test'
import { createTestAudioFile, mockUploadAPI, mockTranscriptionAPI } from './fixtures/test-helpers'
import * as path from 'path'

test.describe('Page Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/upload')
  })

  test('affiche correctement la page upload', async ({ page }) => {
    // Vérifier le titre
    await expect(page.getByRole('heading', { name: /Uploader un enregistrement/i })).toBeVisible()

    // Vérifier la description
    await expect(
      page.getByText(/Chargez un fichier audio pour obtenir la transcription/i)
    ).toBeVisible()

    // Vérifier le bouton retour
    await expect(page.getByRole('button', { name: /Retour/i })).toBeVisible()

    // Vérifier la zone de drop
    await expect(page.getByText(/Glissez-déposez votre fichier audio ici/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Parcourir les fichiers/i })).toBeVisible()

    // Vérifier les formats supportés
    await expect(page.getByText(/Formats supportés: MP3, MP4, WAV/i)).toBeVisible()

    // Vérifier la section "Comment ça marche"
    await expect(page.getByText(/Comment ça marche/i)).toBeVisible()
  })

  test('le bouton retour redirige vers la page d\'accueil', async ({ page }) => {
    await page.getByRole('button', { name: /Retour/i }).click()

    await page.waitForURL('/', { timeout: 5000 })
    expect(page.url()).toContain('/')
  })

  test('permet de sélectionner un fichier via l\'input', async ({ page }) => {
    await mockUploadAPI(page)
    await mockTranscriptionAPI(page)

    // Créer un fichier de test
    const testFilePath = createTestAudioFile('test-upload.mp3')

    // Sélectionner le fichier
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath)

    // Vérifier que le fichier est sélectionné (le nom du fichier devrait apparaître)
    await expect(page.getByText('test-upload.mp3')).toBeVisible()

    // Vérifier que le bouton "Analyser" est visible
    await expect(page.getByRole('button', { name: /Analyser/i })).toBeVisible()
  })

  test('valide le format du fichier', async ({ page }) => {
    // Créer un fichier avec une mauvaise extension
    const invalidFilePath = path.join(process.cwd(), 'e2e/fixtures/test-invalid.txt')
    const fs = require('fs')
    fs.writeFileSync(invalidFilePath, 'test content')

    // Essayer de sélectionner un fichier avec une mauvaise extension
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(invalidFilePath)

    // Vérifier qu'un message d'erreur s'affiche
    await expect(page.getByText(/Format non supporté/i)).toBeVisible()

    // Nettoyer
    fs.unlinkSync(invalidFilePath)
  })

  test('permet de changer de fichier après sélection', async ({ page }) => {
    await mockUploadAPI(page)

    // Créer un premier fichier
    const testFilePath1 = createTestAudioFile('test-file-1.mp3')

    // Sélectionner le premier fichier
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath1)

    // Vérifier que le fichier est sélectionné
    await expect(page.getByText('test-file-1.mp3')).toBeVisible()

    // Cliquer sur le bouton "Changer"
    await page.getByRole('button', { name: /Changer/i }).click()

    // Vérifier que l'interface de sélection réapparaît
    await expect(page.getByText(/Glissez-déposez votre fichier audio ici/i)).toBeVisible()
  })

  test('upload un fichier et redirige vers la page meeting', async ({ page }) => {
    await mockUploadAPI(page)
    await mockTranscriptionAPI(page)

    // Créer un fichier de test
    const testFilePath = createTestAudioFile('test-upload-success.mp3')

    // Sélectionner le fichier
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath)

    // Attendre que le fichier soit sélectionné
    await expect(page.getByText('test-upload-success.mp3')).toBeVisible()

    // Cliquer sur "Analyser"
    await page.getByRole('button', { name: /Analyser/i }).click()

    // Vérifier que le message de traitement s'affiche
    await expect(page.getByText(/Traitement.../i)).toBeVisible()

    // Attendre la redirection vers la page meeting
    await page.waitForURL(/\/meeting\/.+/, { timeout: 10000 })

    // Vérifier qu'on est sur la page meeting
    expect(page.url()).toMatch(/\/meeting\//)
  })

  test('affiche les informations sur le processus', async ({ page }) => {
    // Vérifier que la section informative est présente
    await expect(page.getByText(/Comment ça marche/i)).toBeVisible()

    // Vérifier les étapes
    await expect(page.getByText(/Uploadez votre fichier audio/i)).toBeVisible()
    await expect(page.getByText(/L'IA transcrit l'audio avec Whisper/i)).toBeVisible()
    await expect(page.getByText(/Claude analyse et extrait/i)).toBeVisible()
    await expect(page.getByText(/Consultez et modifiez le résumé généré/i)).toBeVisible()
  })

  test('affiche un message d\'erreur si l\'upload échoue', async ({ page }) => {
    // Mocker une erreur d'upload
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Erreur serveur',
        }),
      })
    })

    // Créer un fichier de test
    const testFilePath = createTestAudioFile('test-upload-error.mp3')

    // Sélectionner le fichier
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath)

    // Cliquer sur "Analyser"
    await page.getByRole('button', { name: /Analyser/i }).click()

    // Attendre que le message d'erreur apparaisse
    await expect(page.getByText(/Upload failed|Erreur serveur/i)).toBeVisible()
  })
})
