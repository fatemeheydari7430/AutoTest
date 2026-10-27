import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * The payment "Ways to Pay" screen and handoff to the payment gateway.
 */
export class PaymentPage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(this.page, 'Not on the car payment page').toHaveURL(/\/car-insurance\/payment\//);
    await expect(
      this.page.getByText('Billing & Payment Options').first(),
      'Car payment page did not load ("Billing & Payment Options" not visible)',
    ).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      this.page.getByRole('button', { name: /^Pay now$/i }),
      'Car payment page "Pay now" button is not visible',
    ).toBeVisible();
  }

  async payNow(): Promise<Page> {
    const button = this.page.getByRole('button', { name: /^Pay now$/i });
    await expect(button, 'Car payment page "Pay now" button is disabled').toBeEnabled();

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
      throw new Error('Clicking "Pay now" did not open or navigate to the payment gateway');
    }

    return destination;
  }
}
