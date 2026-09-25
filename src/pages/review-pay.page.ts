import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ReviewPayPage extends BasePage {
  get confirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Confirm and pay' });
  }

  async expectLoaded(): Promise<void> {
    await expect(
      this.page.getByText('Review and confirm policy').first(),
      'Car review page did not load',
    ).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      this.confirmButton,
      'Review page "Confirm and pay" button is not visible',
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      this.confirmButton,
      'Review page "Confirm and pay" button is not enabled',
    ).toBeEnabled();
  }

  async setEmailIfPresent(email: string): Promise<void> {
    const emailField = this.page.getByPlaceholder('Enter your Email');
    if ((await emailField.count()) > 0 && (await emailField.first().isVisible().catch(() => false))) {
      await emailField.first().fill(email);
    }
  }

  async confirmAndPay(): Promise<void> {
    await this.confirmButton.click();
    try {
      await this.page.waitForURL(/\/car-insurance\/payment\//, { timeout: 60_000 });
    } catch {
      throw new Error(
        `Did not reach the car payment page after "Confirm and pay". Current URL: ${this.page.url()}`,
      );
    }
  }
}
