import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class QuotesPage extends BasePage {
  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByText('Choose affordable quotes').first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(this.reviewButtons.first()).toBeVisible({ timeout: 45_000 });
    expect(await this.reviewButtons.count()).toBeGreaterThan(0);
  }

  async selectFirstQuote(): Promise<void> {
    await this.reviewButtons.first().click();
    await this.page.waitForURL(/quotes\/confirm/, { timeout: 45_000 });
  }
}
