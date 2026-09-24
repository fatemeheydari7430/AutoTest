import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HealthQuotesPage extends BasePage {
  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByText('Your Available Plans').first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(this.reviewButtons.first()).toBeVisible({ timeout: 45_000 });
    expect(await this.reviewButtons.count()).toBeGreaterThan(0);
  }

  async selectFirstPlan(): Promise<void> {
    await this.reviewButtons.first().click();
    await this.page.waitForURL(/\/health-insurance\/payment\//, { timeout: 45_000 });
  }
}
