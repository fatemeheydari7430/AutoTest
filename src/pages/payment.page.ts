import { expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * The payment "Ways to Pay" screen. The test intentionally stops here: no card,
 * no Tabby/Tamara selection and no "Pay now" click.
 */
export class PaymentPage extends BasePage {
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/car-insurance\/payment\//);
    await expect(this.page.getByText('Billing & Payment Options').first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(this.page.getByRole('button', { name: 'Pay now' })).toBeVisible();
  }
}
