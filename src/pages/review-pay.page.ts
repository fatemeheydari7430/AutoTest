import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ReviewPayPage extends BasePage {
  get confirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Confirm and pay' });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByText('Review and confirm policy').first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(this.confirmButton).toBeVisible({ timeout: 45_000 });
    await expect(this.confirmButton).toBeEnabled();
  }

  async setEmailIfPresent(email: string): Promise<void> {
    const emailField = this.page.getByPlaceholder('Enter your Email');
    if ((await emailField.count()) > 0 && (await emailField.first().isVisible().catch(() => false))) {
      await emailField.first().fill(email);
    }
  }

  async confirmAndPay(): Promise<void> {
    await this.confirmButton.click();
    await this.page.waitForURL(/\/car-insurance\/payment\//, { timeout: 60_000 });
  }
}
