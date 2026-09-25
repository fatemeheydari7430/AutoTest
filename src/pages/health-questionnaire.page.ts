import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import {
  EMIRATES,
  HEALTH_GENDERS,
  HEALTH_MEMBERS,
  SALARY_RANGES,
  type HealthMemberConfig,
} from '../config/test-options';

export interface HealthDateOfBirth {
  year: string;
  month: string;
  day: string;
}

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class HealthQuestionnairePage extends BasePage {
  async answerGender(gender: string): Promise<void> {
    await this.expectStepText('Select your gender', 'Gender step did not load');
    await this.page.getByRole('button', { name: uiLabel(HEALTH_GENDERS, gender, 'gender'), exact: true }).click();
  }

  async answerEmirate(emirate: string): Promise<void> {
    await this.expectStepText('Which emirate is your visa from?', 'Emirate step did not load');
    await this.page
      .getByRole('button', { name: uiLabel(EMIRATES, emirate, 'emirate'), exact: true })
      .click();
  }

  async answerSalary(salaryRange: string): Promise<void> {
    await this.expectStepText('What is your monthly salary?', 'Salary range step did not load');
    await this.page
      .getByRole('button', { name: uiLabel(SALARY_RANGES, salaryRange, 'salaryRange'), exact: true })
      .click();
  }

  async selectMembers(members: HealthMemberConfig[]): Promise<void> {
    await this.expectStepText(/included in your coverage/i, 'Members step did not load');
    for (const member of members) {
      await this.page
        .getByRole('button', { name: uiLabel(HEALTH_MEMBERS, member.type, 'member'), exact: true })
        .click();
    }
    await this.clickContinue();
  }

  async enterDateOfBirth(members: HealthMemberConfig[]): Promise<void> {
    await this.expectStepText('Enter dates of birth', 'Date of birth step did not load');

    // The backend returns one DOB control per member. Verify the UI matches the
    // configured member count before filling, so a mismatch fails loudly.
    const controls = this.page.getByLabel(/choose date/i);
    await expect(controls.first(), 'Date of birth control did not appear').toBeVisible();
    expect(
      await controls.count(),
      'Number of date-of-birth controls must match the configured members',
    ).toBe(members.length);

    // The API returns members in the canonical HEALTH_MEMBERS order, which is
    // also the order of the DOB controls. Align the config to that order by
    // member type (not a blind index) before filling.
    const ordered = this.canonicalOrder(members);
    for (let index = 0; index < ordered.length; index += 1) {
      await this.pickDate(ordered[index].dateOfBirth, index);
    }

    await this.clickContinue();
  }

  async answerMedicalCondition(
    hasMedicalCondition: boolean,
    isAnyMemberPregnant = false,
  ): Promise<void> {
    const yesNo = this.page.getByRole('button', {
      name: hasMedicalCondition ? 'Yes' : 'No',
      exact: true,
    });

    // Multi-member flow groups the questions ("Does anyone included..."),
    // single-member flow uses the personal wording with a single question.
    // Wait for whichever wording appears before branching (count() does not wait).
    const groupQuestion = this.page.getByText(/current or past medical conditions/i);
    const personalQuestion = this.page.getByText(/ever had a medical condition/i);
    await expect(
      groupQuestion.or(personalQuestion).first(),
      'Medical condition step did not load',
    ).toBeVisible();

    if ((await groupQuestion.count()) > 0) {
      await yesNo.nth(0).click();
      const pregnancyQuestion = this.page.getByText(/currently pregnant/i);
      if ((await pregnancyQuestion.count()) > 0) {
        const pregnancy = this.page.getByRole('button', {
          name: isAnyMemberPregnant ? 'Yes' : 'No',
          exact: true,
        });
        await pregnancy.nth(1).click();
      }
    } else {
      await yesNo.click();
    }

    const finish = this.page.getByRole('button', { name: 'Finish', exact: true });
    await expect(finish).toBeEnabled();
    await finish.click();
  }

  private canonicalOrder(members: HealthMemberConfig[]): HealthMemberConfig[] {
    const order = Object.keys(HEALTH_MEMBERS);
    return [...members].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }
}
