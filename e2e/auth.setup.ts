import { test as setup, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const authFile = 'playwright/.auth/user.json'

const prisma = new PrismaClient()

setup('authenticate', async ({ page }) => {
  // Configuration de l'utilisateur de test
  const testUser = {
    email: 'test@e2e.local',
    password: 'TestPassword123!',
    name: 'E2E Test User',
  }

  // Créer ou mettre à jour l'utilisateur de test dans la base de données
  const hashedPassword = await bcrypt.hash(testUser.password, 10)

  await prisma.user.upsert({
    where: { email: testUser.email },
    update: {
      password: hashedPassword,
      name: testUser.name,
    },
    create: {
      email: testUser.email,
      password: hashedPassword,
      name: testUser.name,
    },
  })

  console.log('✓ Utilisateur de test créé/mis à jour')

  // Aller sur la page de connexion
  await page.goto('/auth/signin')

  // Remplir le formulaire de connexion
  await page.fill('input[name="email"]', testUser.email)
  await page.fill('input[name="password"]', testUser.password)

  // Cliquer sur le bouton de connexion
  await page.click('button[type="submit"]')

  // Attendre la redirection après connexion
  await page.waitForURL('/', { timeout: 10000 })

  console.log('✓ Connexion réussie')

  // Vérifier que nous sommes bien connectés en vérifiant la présence d'un élément de la page d'accueil
  await expect(page.getByRole('heading', { name: 'Meeting Copilot' })).toBeVisible({
    timeout: 10000,
  })

  console.log('✓ Vérification de l\'authentification réussie')

  // Sauvegarder l'état d'authentification
  await page.context().storageState({ path: authFile })

  console.log('✓ État d\'authentification sauvegardé')

  await prisma.$disconnect()
})
