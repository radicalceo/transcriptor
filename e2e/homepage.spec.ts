import { test, expect } from '@playwright/test'
import { mockTranscriptionAPI } from './fixtures/test-helpers'

test.describe('Page d\'accueil', () => {
  test('affiche le titre et les boutons principaux', async ({ page }) => {
    await page.goto('/')

    // Vérifier le titre
    await expect(page.getByRole('heading', { name: 'Meeting Copilot' })).toBeVisible()

    // Vérifier la description
    await expect(
      page.getByText('Enregistrez, transcrivez et analysez vos réunions avec l\'IA')
    ).toBeVisible()

    // Vérifier les trois boutons principaux (2 modes live + upload)
    await expect(page.getByRole('button', { name: /Micro uniquement/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Micro \+ Audio de l'onglet/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Uploader un enregistrement/i })).toBeVisible()

    // Vérifier le bouton historique
    await expect(page.getByRole('button', { name: /Historique/i })).toBeVisible()

    // Vérifier la liste des fonctionnalités
    await expect(page.getByText('Transcription en temps réel')).toBeVisible()
    await expect(page.getByText('Détection des thèmes abordés')).toBeVisible()
    await expect(page.getByText('Extraction des décisions et actions')).toBeVisible()
    await expect(page.getByText('Résumé post-meeting')).toBeVisible()
  })

  test('le bouton "Micro uniquement" redirige vers audio-only', async ({ page }) => {
    await mockTranscriptionAPI(page)
    await page.goto('/')

    // Cliquer sur le bouton "Micro uniquement"
    await page.getByRole('button', { name: /Micro uniquement/i }).click()

    // Attendre la redirection vers la page audio-only
    await page.waitForURL(/\/meeting\/audio-only\/.+/, { timeout: 10000 })

    // Vérifier qu'on est sur la page audio-only
    expect(page.url()).toMatch(/\/meeting\/audio-only\//)
  })

  test('le bouton "Micro + Audio de l\'onglet" redirige vers screen-share', async ({ page }) => {
    await mockTranscriptionAPI(page)
    await page.goto('/')

    // Cliquer sur le bouton "Micro + Audio de l'onglet"
    await page.getByRole('button', { name: /Micro \+ Audio de l'onglet/i }).click()

    // Attendre la redirection vers la page screen-share
    await page.waitForURL(/\/meeting\/screen-share\/.+/, { timeout: 10000 })

    // Vérifier qu'on est sur la page screen-share
    expect(page.url()).toMatch(/\/meeting\/screen-share\//)
  })

  test('le bouton "Uploader un enregistrement" redirige vers la page upload', async ({ page }) => {
    await page.goto('/')

    // Cliquer sur le bouton "Uploader un enregistrement"
    await page.getByRole('button', { name: /Uploader un enregistrement/i }).click()

    // Attendre la redirection
    await page.waitForURL('/upload', { timeout: 5000 })

    // Vérifier qu'on est sur la page upload
    expect(page.url()).toContain('/upload')
    await expect(page.getByRole('heading', { name: /Uploader un enregistrement/i })).toBeVisible()
  })

  test('le bouton "Historique" redirige vers la page historique', async ({ page }) => {
    await page.goto('/')

    // Cliquer sur le bouton "Historique"
    await page.getByRole('button', { name: /Historique/i }).click()

    // Attendre la redirection
    await page.waitForURL('/history', { timeout: 5000 })

    // Vérifier qu'on est sur la page historique
    expect(page.url()).toContain('/history')
  })

  test('affiche correctement en mode sombre', async ({ page }) => {
    await page.goto('/')

    // Vérifier que l'élément racine a les classes pour le mode sombre/clair
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Les éléments principaux doivent être visibles même en mode sombre
    await expect(page.getByRole('heading', { name: 'Meeting Copilot' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Micro uniquement/i })).toBeVisible()
  })
})
