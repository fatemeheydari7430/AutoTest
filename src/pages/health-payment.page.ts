import { expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * The health "Make Payment" screen. The test intentionally stops here: no card,
 * no Tabby/Tamara selection and no "Pay Now" click.
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
      this.page.getByRole('button', { name: 'Pay Now' }),
      'Health payment page "Pay Now" button is not visible',
    ).toBeVisible();
  }
}
