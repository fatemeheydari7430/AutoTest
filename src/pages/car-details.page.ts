import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export interface VehicleDetails {
  brand: string;
  model: string;
  year: string;
  trim: string;
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
    await this.selectOption('Trim', vehicle.trim);
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
