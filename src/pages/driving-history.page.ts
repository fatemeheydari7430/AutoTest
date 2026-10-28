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
  private isEmptyListUrl(): boolean {
    try {
      return new URL(this.page.url()).searchParams.get('reason') === 'EMPTY_LIST';
    } catch {
      return false;
    }
  }

  async answerLicenseDuration(drivingExperience: string): Promise<void> {
    await this.expectStepText(
      'How long have you held the UAE driving license?',
      'Driving experience step did not load',
    );
    await this.page
      .getByRole('button', { name: uiLabel(DRIVING_EXPERIENCES, drivingExperience, 'drivingExperience'), exact: true })
      .click();
  }

  async answerClaims(claims: string): Promise<boolean> {
    const claimsPrompt = this.page.getByText('How long without any claims?').first();
    const quotesHeading = this.page.getByText('Choose affordable quotes').first();
    const emptyList = this.page.getByText(/empty list|no available quotes|no quotes found/i).first();
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      if (this.isEmptyListUrl()) return false;
      if (await claimsPrompt.isVisible().catch(() => false)) {
        await this.page
          .getByRole('button', { name: uiLabel(CLAIMS, claims, 'claims'), exact: true })
          .click();
        return true;
      }
      // Some driving-experience choices skip claims and go straight to quotes.
      if (await quotesHeading.isVisible().catch(() => false)) return false;
      if (await emptyList.isVisible().catch(() => false)) return false;
      await this.page.waitForTimeout(200);
    }

    throw new Error('Neither the claims step nor the car quotes page appeared after selecting driving experience');
  }
}
