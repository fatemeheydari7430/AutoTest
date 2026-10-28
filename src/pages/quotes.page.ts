import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class QuotesPage extends BasePage {
  private isEmptyListUrl(): boolean {
    try {
      const url = new URL(this.page.url());
      return url.searchParams.get('reason') === 'EMPTY_LIST';
    } catch {
      return false;
    }
  }

  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<boolean> {
    const quotesHeading = this.page.getByText('Choose affordable quotes').first();
    const emptyList = this.page.getByText(/empty list|no available quotes|no quotes found/i).first();
    const deadline = Date.now() + 45_000;
    let headingSeenAt: number | null = null;
    while (Date.now() < deadline) {
      if (this.isEmptyListUrl()) return true;
      if (await emptyList.isVisible().catch(() => false)) return true;
      if (await this.reviewButtons.first().isVisible().catch(() => false)) return false;
      if (await quotesHeading.isVisible().catch(() => false)) {
        headingSeenAt ??= Date.now();
        if (Date.now() - headingSeenAt >= 10_000) return (await this.reviewButtons.count()) === 0;
      }
      await this.page.waitForTimeout(250);
    }

    if (!(await quotesHeading.isVisible().catch(() => false))) {
      if (this.isEmptyListUrl()) return true;
      if (await emptyList.isVisible().catch(() => false)) return true;
      throw new Error('Car quotes page did not load');
    }

    // A loaded quote page with no purchasable quote is an expected empty-list outcome.
    return (await this.reviewButtons.count()) === 0;
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
