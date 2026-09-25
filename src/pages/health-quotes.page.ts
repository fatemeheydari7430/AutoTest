import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HealthQuotesPage extends BasePage {
  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByText('Your Available Plans').first(),
      'Health plans page did not load',
    ).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      this.reviewButtons.first(),
      'Expected Health quotes page to show at least one purchasable plan',
    ).toBeVisible({ timeout: 45_000 });
    expect(
      await this.reviewButtons.count(),
      'Expected Health quotes page to show at least one purchasable plan',
    ).toBeGreaterThan(0);
  }

  async selectFirstPlan(): Promise<void> {
    await this.reviewButtons.first().click();
    try {
      await this.page.waitForURL(/\/health-insurance\/payment\//, { timeout: 45_000 });
    } catch {
      throw new Error(
        `Selecting a health plan did not open the payment page. Current URL: ${this.page.url()}`,
      );
    }
  }
}
