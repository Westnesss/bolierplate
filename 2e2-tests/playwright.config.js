const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20_000,
  expect: { timeout: 5_000 },

  // Todas las pruebas comparten la misma base de datos,
  // por eso se ejecutan una detrás de otra (no en paralelo).
  workers: 1,
  fullyParallel: false,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // El backend de Spring Boot debe estar corriendo antes de ejecutar las pruebas.
    // Si usas otro puerto: BASE_URL=http://localhost:9090 npm test
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
