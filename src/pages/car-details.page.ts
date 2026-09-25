import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export interface VehicleDetails {
  brand: string;
  model: string;
  year: string;
  /** Optional: some model/year combinations have no trim step. */
  trim?: string | null;
}

export class CarDetailsPage extends BasePage {
  async expectLoaded(): Promise<void> {
    await this.expectStepText('Enter your car details', 'Car details step did not load');
    await expect(this.continueButton, 'Car details "Continue" button is not visible').toBeVisible();
    // A fresh lead always starts with an empty brand selector.
    await expect(
      this.page.getByText('Select car brand', { exact: true }),
      'Expected a fresh car lead: the brand selector should be empty',
    ).toBeVisible();
  }

  async enterVehicleDetails(vehicle: VehicleDetails): Promise<void> {
    await this.selectOption('Brand', vehicle.brand);
    await this.selectOption('Model', vehicle.model);
    await this.selectOption('Model year', vehicle.year);

    // Trim is an optional step: some model/year combinations have no trim. Wait
    // for the step to settle (trim appears, or Continue becomes enabled when no
    // trim is needed). Never skip a required step.
    const trimField = this.page.getByText('Trim', { exact: true });
    const deadline = Date.now() + 15_000;
    let trimRequired = false;
    while (Date.now() < deadline) {
      if ((await trimField.count()) > 0) {
        trimRequired = true;
        break;
      }
      if (await this.continueButton.isEnabled().catch(() => false)) break;
      await this.page.waitForTimeout(200);
    }

    if (trimRequired) {
      if (!vehicle.trim) {
        throw new Error('The Trim step is shown but no vehicle.trim is configured');
      }
      await this.selectOption('Trim', vehicle.trim);
    }
  }

  async continue(): Promise<void> {
    await this.clickContinue();
    try {
      await this.page.waitForURL(/manual\/car-information/, { timeout: 30_000 });
    } catch {
      throw new Error(
        `Car details were not accepted; the vehicle specification step did not load. Current URL: ${this.page.url()}`,
      );
    }
  }
}
