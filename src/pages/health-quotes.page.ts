import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HealthQuotesPage extends BasePage {
  private isEmptyListUrl(): boolean {
    try {
      return new URL(this.page.url()).searchParams.get('reason') === 'EMPTY_LIST';
    } catch {
      return false;
    }
  }

  get reviewButtons(): Locator {
    return this.page.getByRole('button', { name: 'Review & Buy' });
  }

  async expectLoaded(): Promise<boolean> {
    const plansHeading = this.page.getByText('Your Available Plans').first();
    const emptyList = this.page.getByText(/empty list|no available plans|no plans found/i).first();
    const deadline = Date.now() + 45_000;
    let headingSeenAt: number | null = null;
    while (Date.now() < deadline) {
      if (this.isEmptyListUrl() || await emptyList.isVisible().catch(() => false)) return true;
      if (await this.reviewButtons.first().isVisible().catch(() => false)) return false;
      if (await plansHeading.isVisible().catch(() => false)) {
        headingSeenAt ??= Date.now();
        if (Date.now() - headingSeenAt >= 10_000) return (await this.reviewButtons.count()) === 0;
      }
      await this.page.waitForTimeout(250);
    }
    if (this.isEmptyListUrl() || await emptyList.isVisible().catch(() => false)) return true;
    if (!(await plansHeading.isVisible().catch(() => false))) {
      throw new Error('Health plans page did not load');
    }
    return (await this.reviewButtons.count()) === 0;
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
