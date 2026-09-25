import { BasePage } from './base.page';
import { CLAIMS, DRIVING_EXPERIENCES } from '../config/test-options';

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class DrivingHistoryPage extends BasePage {
  async answerLicenseDuration(drivingExperience: string): Promise<void> {
    await this.expectStepText(
      'How long have you held the UAE driving license?',
      'Driving experience step did not load',
    );
    await this.page
      .getByRole('button', { name: uiLabel(DRIVING_EXPERIENCES, drivingExperience, 'drivingExperience'), exact: true })
      .click();
  }

  async answerClaims(claims: string): Promise<void> {
    await this.expectStepText(
      'How long without any claims?',
      'Claims history step did not load',
    );
    await this.page
      .getByRole('button', { name: uiLabel(CLAIMS, claims, 'claims'), exact: true })
      .click();
  }
}
