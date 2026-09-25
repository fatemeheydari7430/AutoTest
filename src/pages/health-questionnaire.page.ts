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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    for (const member of this.canonicalOrder(members)) {
      await this.selectMember(member);
    }
    await this.clickContinue();
  }

  async enterDateOfBirth(members: HealthMemberConfig[]): Promise<void> {
    await this.expectStepText('Enter dates of birth', 'Date of birth step did not load');

    // One DOB control per member instance. Verify the count before filling.
    const controls = this.page.getByLabel(/choose date/i);
    await expect(controls.first(), 'Date of birth control did not appear').toBeVisible();
    const expected = members.reduce((total, member) => total + member.count, 0);
    expect(
      await controls.count(),
      'Number of date-of-birth controls must match the total member count',
    ).toBe(expected);

    // The API returns member instances in canonical HEALTH_MEMBERS order,
    // repeating each type by its count (e.g. 1st son, 2nd son). Fill DOBs in
    // that same type/sequence order; the app maps each control to the real
    // member id when submitting.
    let index = 0;
    for (const member of this.canonicalOrder(members)) {
      for (const dateOfBirth of member.dateOfBirths) {
        await this.pickDate(dateOfBirth, index);
        index += 1;
      }
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

  /** Selects a member type and, for Son/Daughter, sets the requested count. */
  private async selectMember(member: HealthMemberConfig): Promise<void> {
    const label = uiLabel(HEALTH_MEMBERS, member.type, 'member');
    const escaped = escapeRegExp(label);
    await this.page.getByRole('button', { name: new RegExp(`^${escaped}$`) }).first().click();

    if (member.count <= 1) return;

    const row = this.page.getByRole('button', { name: new RegExp(`^${escaped}\\s+\\d+$`) }).first();
    const increment = row.getByRole('button').nth(1);
    for (let current = 1; current < member.count; current += 1) {
      await increment.click();
    }
    await expect(row, `Expected "${label}" count to be ${member.count}`).toHaveAccessibleName(
      new RegExp(`^${escaped}\\s+${member.count}$`),
    );
  }

  private canonicalOrder(members: HealthMemberConfig[]): HealthMemberConfig[] {
    const order = Object.keys(HEALTH_MEMBERS);
    return [...members].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }
}
