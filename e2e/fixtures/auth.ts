import { Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Informations de l'utilisateur de test
 */
export const TEST_USER = {
  email: 'test@e2e.local',
  password: 'TestPassword123!',
  name: 'E2E Test User',
}

/**
 * Créer un utilisateur de test dans la base de données
 */
export async function createTestUser() {
  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10)

  const user = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: {
      password: hashedPassword,
      name: TEST_USER.name,
    },
    create: {
      email: TEST_USER.email,
      password: hashedPassword,
      name: TEST_USER.name,
    },
  })

  return user
}

/**
 * Se connecter via l'interface utilisateur
 */
export async function login(page: Page, email: string = TEST_USER.email, password: string = TEST_USER.password) {
  await page.goto('/auth/signin')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 10000 })
}

/**
 * Nettoyer l'utilisateur de test
 */
export async function cleanupTestUser() {
  await prisma.user.deleteMany({
    where: { email: TEST_USER.email },
  })
  await prisma.$disconnect()
}

/**
 * Vérifier que l'utilisateur est authentifié
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Essayer d'aller sur la page d'accueil
    await page.goto('/')
    // Si on est redirigé vers /auth/signin, on n'est pas authentifié
    await page.waitForTimeout(1000)
    const url = page.url()
    return !url.includes('/auth/signin')
  } catch {
    return false
  }
}
