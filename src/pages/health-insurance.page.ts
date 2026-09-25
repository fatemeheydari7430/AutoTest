import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import { COVERAGE_TYPES } from '../config/test-options';

export class HealthInsurancePage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: /Buy health insurance in the UAE/i }),
      'Health insurance landing page did not load',
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
    try {
      await this.page.waitForURL(/\/health-insurance\/gender\//, { timeout: 30_000 });
    } catch {
      throw new Error(
        `Health flow did not start at the gender step. Current URL: ${this.page.url()}`,
      );
    }
    await expect(
      this.page.getByText('Select your gender'),
      'Expected a fresh health lead: the gender step should be the first step',
    ).toBeVisible();
  }
}
