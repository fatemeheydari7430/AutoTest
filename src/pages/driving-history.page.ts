import { BasePage } from './base.page';

/** Business value -> visible UI label maps for driving history. */
const DRIVING_EXPERIENCE: Record<string, string> = {
  MORE_THAN_FIVE_YEAR: 'More than 5 years',
  MORE_THAN_FOUR_YEAR: '4-5 years',
  MORE_THAN_THREE_YEAR: '3-4 years',
  MORE_THAN_TWO_YEAR: '2-3 years',
  MORE_THAN_ONE_YEAR: '1-2 year',
  LESS_THAN_ONE_YEAR: 'Less than 1 year',
};

const CLAIMS: Record<string, string> = {
  CLAIM_0: 'Had a claim in the past 12 months',
  CLAIM_1: 'One (1) year without claims',
  CLAIM_2: 'Two (2) years without claims',
  CLAIM_3: 'Three (3) years without claims',
  CLAIM_4: 'Four (4) years without any claims',
  CLAIM_FREE_OVER_4: 'Claim-free for over 4 years',
};

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class DrivingHistoryPage extends BasePage {
  async answerLicenseDuration(drivingExperience: string): Promise<void> {
    await this.expectStepText('How long have you held the UAE driving license?');
    await this.page
      .getByRole('button', { name: uiLabel(DRIVING_EXPERIENCE, drivingExperience, 'drivingExperience'), exact: true })
      .click();
  }

  async answerClaims(claims: string): Promise<void> {
    await this.expectStepText('How long without any claims?');
    await this.page
      .getByRole('button', { name: uiLabel(CLAIMS, claims, 'claims'), exact: true })
      .click();
  }
}
