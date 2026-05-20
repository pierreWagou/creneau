import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : 4,
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'setup',
			testMatch: /setup\.test\.ts|activation\.test\.ts/,
			fullyParallel: false,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'main',
			testMatch: /booking|calendar|drag|auth/,
			dependencies: ['setup'],
			fullyParallel: true,
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'DATABASE_URL=file:data/test.db npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	}
});
