import { BasePage } from './base.page';

export interface HealthDateOfBirth {
  year: string;
  month: string;
  day: string;
}

/** Business value -> visible UI label maps for the health questionnaire. */
const GENDERS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
};

const EMIRATES: Record<string, string> = {
  dubai: 'Dubai',
  abuDhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  ummAlQuwain: 'Umm Al Quwain',
  rasAlKhaimah: 'Ras Al Khaimah',
  fujairah: 'Al Fujairah',
};

const MEMBERS: Record<string, string> = {
  YOURSELF: 'Me',
  WIFE: 'Wife',
  FATHER: 'Father',
  MOTHER: 'Mother',
  DAUGHTER: 'Daughter',
  SON: 'Son',
};

const SALARY_RANGES: Record<string, string> = {
  MORE_THAN_4000: 'More than AED 4,000',
  LESS_THAN_4000: 'Below AED 4,000',
};

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class HealthQuestionnairePage extends BasePage {
  async answerGender(gender: string): Promise<void> {
    await this.expectStepText('Select your gender');
    await this.page.getByRole('button', { name: uiLabel(GENDERS, gender, 'gender'), exact: true }).click();
  }

  async answerEmirate(emirate: string): Promise<void> {
    await this.expectStepText('Which emirate is your visa from?');
    await this.page
      .getByRole('button', { name: uiLabel(EMIRATES, emirate, 'emirate'), exact: true })
      .click();
  }

  async answerSalary(salaryRange: string): Promise<void> {
    await this.expectStepText('What is your monthly salary?');
    await this.page
      .getByRole('button', { name: uiLabel(SALARY_RANGES, salaryRange, 'salaryRange'), exact: true })
      .click();
  }

  async selectMembers(members: string[]): Promise<void> {
    await this.expectStepText(/included in your coverage/i);
    for (const member of members) {
      await this.page
        .getByRole('button', { name: uiLabel(MEMBERS, member, 'member'), exact: true })
        .click();
    }
    await this.clickContinue();
  }

  async enterDateOfBirth(dateOfBirth: HealthDateOfBirth): Promise<void> {
    await this.expectStepText('Enter dates of birth');
    await this.pickDate(dateOfBirth);
    await this.clickContinue();
  }

  async answerMedicalCondition(hasMedicalCondition: boolean): Promise<void> {
    await this.expectStepText(/ever had a medical condition/i);
    await this.page
      .getByRole('button', { name: hasMedicalCondition ? 'Yes' : 'No', exact: true })
      .click();
    await this.page.getByRole('button', { name: 'Finish', exact: true }).click();
  }
}
