import { BasePage } from './base.page';

export class DrivingHistoryPage extends BasePage {
  async answerLicenseDuration(value: string): Promise<void> {
    await this.expectStepText('How long have you held the UAE driving license?');
    await this.page.getByRole('button', { name: value, exact: true }).click();
  }

  async answerClaims(value: string): Promise<void> {
    await this.expectStepText('How long without any claims?');
    await this.page.getByRole('button', { name: value, exact: true }).click();
  }
}
