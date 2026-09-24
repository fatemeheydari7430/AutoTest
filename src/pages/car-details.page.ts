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
    await this.expectStepText('Enter your car details');
    await expect(this.continueButton).toBeVisible();
    // A fresh lead always starts with an empty brand selector.
    await expect(this.page.getByText('Select car brand', { exact: true })).toBeVisible();
  }

  async enterVehicleDetails(vehicle: VehicleDetails): Promise<void> {
    await this.selectOption('Brand', vehicle.brand);
    await this.selectOption('Model', vehicle.model);
    await this.selectOption('Model year', vehicle.year);
    await this.selectOption('Trim', vehicle.trim);
  }

  async continue(): Promise<void> {
    await this.clickContinue();
    await this.page.waitForURL(/manual\/car-information/, { timeout: 30_000 });
  }
}
