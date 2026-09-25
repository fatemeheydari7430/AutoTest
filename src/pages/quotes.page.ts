import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class QuotesPage extends BasePage {
  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByText('Choose affordable quotes').first(),
      'Car quotes page did not load',
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      this.reviewButtons.first(),
      'Expected at least one insurance quote to be available',
    ).toBeVisible({ timeout: 45_000 });
    expect(
      await this.reviewButtons.count(),
      'Expected at least one insurance quote to be available',
    ).toBeGreaterThan(0);
  }

  async selectFirstQuote(): Promise<void> {
    await this.reviewButtons.first().click();
    try {
      await this.page.waitForURL(/quotes\/confirm/, { timeout: 45_000 });
    } catch {
      throw new Error(
        `Selecting a quote did not open the review step. Current URL: ${this.page.url()}`,
      );
    }
  }
}
