import { test, expect } from '@playwright/test';
import { HomePage } from '@/pages/home.page';

test('home loads without redirect to login', { tag: ['@e2e', '@smoke'] }, async ({ page }) => {
  const home = new HomePage(page);
  await home.goto('/');

  await expect(page).not.toHaveURL(/\/login/i);
  const pageTitle = await home.title();
  expect(pageTitle.length).toBeGreaterThan(0);
});