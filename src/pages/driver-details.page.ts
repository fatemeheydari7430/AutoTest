import { BasePage } from './base.page';

export interface DriverDetails {
  nationality: string;
  dateOfBirth: {
    year: string;
    month: string;
    day: string;
  };
}

export class DriverDetailsPage extends BasePage {
  async expectLoaded(): Promise<void> {
    await this.expectStepText(/Let us know about the car.s driver/i, 'Driver information step did not load');
  }

  async enterDriverDetails(details: DriverDetails): Promise<void> {
    await this.selectOption('Nationality', details.nationality);
    await this.pickDate(details.dateOfBirth);

    await this.clickContinue();
    await this.expectStepText(
      'How long have you held the UAE driving license?',
      'Driving experience step did not load after saving driver information',
    );
  }
}
