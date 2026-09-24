import { expect } from '@playwright/test';
import { BasePage } from './base.page';

/** UI label for each coverage type (business value -> visible button). */
const COVERAGE_TYPES: Record<string, string> = {
  INDIVIDUAL: 'Me or my family',
};

export class HealthInsurancePage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: /Buy health insurance in the UAE/i }),
    ).toBeVisible();
  }

  async startCoverage(insureFor: string): Promise<void> {
    const buttonName = COVERAGE_TYPES[insureFor];
    if (!buttonName) {
      throw new Error(`Unsupported insureFor "${insureFor}". Known: ${Object.keys(COVERAGE_TYPES).join(', ')}`);
    }

    await this.goto('/health-insurance/');
    await this.expectLoaded();

    await this.page.getByRole('button', { name: buttonName }).click();

    // The wizard must start from its first step (proves a fresh lead).
    await this.page.waitForURL(/\/health-insurance\/gender\//, { timeout: 30_000 });
    await expect(this.page.getByText('Select your gender')).toBeVisible();
  }
}
