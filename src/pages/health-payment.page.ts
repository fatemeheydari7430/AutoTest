import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * The health "Make Payment" screen and handoff to the payment gateway.
 */
export class HealthPaymentPage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(this.page, 'Not on the health payment page').toHaveURL(
      /\/health-insurance\/payment\//,
    );
    await expect(
      this.page.getByText('Billing & Payment Options').first(),
      'Health payment page did not load ("Billing & Payment Options" not visible)',
    ).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      this.page.getByRole('button', { name: /^Pay Now$/i }),
      'Health payment page "Pay Now" button is not visible',
    ).toBeVisible();
  }

  async payNow(): Promise<Page> {
    const button = this.page.getByRole('button', { name: /^Pay Now$/i });
    await expect(button, 'Health payment page "Pay Now" button is disabled').toBeEnabled();

    const paymentUrl = this.page.url();
    const popup = this.page
      .waitForEvent('popup', { timeout: 60_000 })
      .catch(() => null);
    const navigation = this.page
      .waitForURL((url) => url.href !== paymentUrl, { timeout: 60_000 })
      .then(() => this.page)
      .catch(() => null);

    await button.click();
    const destination = await Promise.race([popup, navigation]);
    if (!destination) {
      throw new Error('Clicking "Pay Now" did not open or navigate to the payment gateway');
    }

    return destination;
  }
}
