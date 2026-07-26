import { test, expect } from '@playwright/test';
import { HomePage } from '@/pages/home.page';

test('authenticated user lands on home without redirect to login', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto('/');

  await expect(page).not.toHaveURL(/\/login/i);
  const pageTitle = await home.title();
  expect(pageTitle.length).toBeGreaterThan(0);
});