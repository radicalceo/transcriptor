import { defineConfig, devices } from '@playwright/test'

/**
 * Configuration Playwright pour les tests e2e
 * Voir https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // Timeout pour chaque test
  timeout: 60 * 1000,

  // Nombre de tentatives en cas d'échec
  retries: process.env.CI ? 2 : 0,

  // Nombre de workers (parallélisation)
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html'],
    ['list']
  ],

  use: {
    // URL de base de l'application
    baseURL: 'http://localhost:3000',

    // Capture screenshot en cas d'échec
    screenshot: 'only-on-failure',

    // Capture vidéo en cas d'échec
    video: 'retain-on-failure',

    // Trace en cas d'échec
    trace: 'on-first-retry',
  },

  // Configuration des projets (navigateurs)
  projects: [
    // Setup project - s'exécute avant tous les tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Tests avec authentification
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Utiliser l'état d'authentification sauvegardé
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Optionnel : tests sur d'autres navigateurs
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     storageState: 'playwright/.auth/user.json',
    //   },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: 'playwright/.auth/user.json',
    //   },
    //   dependencies: ['setup'],
    // },
  ],

  // Démarrer le serveur de développement avant les tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
