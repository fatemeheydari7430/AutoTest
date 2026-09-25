import { expect } from '@playwright/test';
import { BasePage } from './base.page';

/** Online car flows only. New registration and commercial are separate offline branches. */
const CAR_FLOW_PATHS: Record<string, string> = {
  RENEW: '/car-insurance/flow/renew/',
  TRANSFER_OF_OWNER_SHIP: '/car-insurance/flow/transfer/',
};

export class CarInsurancePage extends BasePage {
  async startFlow(leadType: string): Promise<void> {
    const path = CAR_FLOW_PATHS[leadType];
    if (!path) {
      throw new Error(
        `Unsupported car lead type "${leadType}". Known online flows: ${Object.keys(CAR_FLOW_PATHS).join(', ')}`,
      );
    }
    await this.goto(path);
    await expect(
      this.page.getByRole('heading', { name: /details about your car/i }),
      'Car flow entry page did not load',
    ).toBeVisible();
  }

  async chooseManualEntry(): Promise<void> {
    await this.page.getByText('Manual entry', { exact: true }).click();
    try {
      await this.page.waitForURL(/manual\/car-details/, { timeout: 30_000 });
    } catch {
      throw new Error(
        `Manual entry did not open the car details step. Current URL: ${this.page.url()}`,
      );
    }
  }
}
