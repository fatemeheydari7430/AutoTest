import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CarInsurancePage extends BasePage {
  async startRenewal(): Promise<void> {
    await this.goto('/car-insurance/flow/renew/');
    await expect(
      this.page.getByRole('heading', { name: /details about your car/i }),
    ).toBeVisible();
  }

  async chooseManualEntry(): Promise<void> {
    await this.page.getByText('Manual entry', { exact: true }).click();
    await this.page.waitForURL(/renew\/manual\/car-details/, { timeout: 30_000 });
  }
}
