import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class HealthInsurancePage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: /Buy health insurance in the UAE/i }),
    ).toBeVisible();
  }

  async startIndividualCoverage(): Promise<void> {
    await this.goto('/health-insurance/');
    await this.expectLoaded();

    await this.page.getByRole('button', { name: 'Me or my family' }).click();

    // The wizard must start from its first step (proves a fresh lead).
    await this.page.waitForURL(/\/health-insurance\/gender\//, { timeout: 30_000 });
    await expect(this.page.getByText('Select your gender')).toBeVisible();
  }
}
