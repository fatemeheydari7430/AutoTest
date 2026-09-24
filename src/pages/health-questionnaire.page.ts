import { BasePage } from './base.page';

export interface HealthDateOfBirth {
  year: string;
  month: string;
  day: string;
}

export class HealthQuestionnairePage extends BasePage {
  async answerGender(gender: string): Promise<void> {
    await this.expectStepText('Select your gender');
    await this.page.getByRole('button', { name: gender, exact: true }).click();
  }

  async answerEmirate(emirate: string): Promise<void> {
    await this.expectStepText('Which emirate is your visa from?');
    await this.page.getByRole('button', { name: emirate, exact: true }).click();
  }

  async answerSalary(salary: string): Promise<void> {
    await this.expectStepText('What is your monthly salary?');
    await this.page.getByRole('button', { name: salary, exact: true }).click();
  }

  async selectMembers(members: string[]): Promise<void> {
    await this.expectStepText(/included in your coverage/i);
    for (const member of members) {
      await this.page.getByRole('button', { name: member, exact: true }).click();
    }
    await this.clickContinue();
  }

  async enterDateOfBirth(dateOfBirth: HealthDateOfBirth): Promise<void> {
    await this.expectStepText('Enter dates of birth');
    await this.pickDate(dateOfBirth);
    await this.clickContinue();
  }

  async answerMedicalCondition(condition: string): Promise<void> {
    await this.expectStepText(/ever had a medical condition/i);
    await this.page.getByRole('button', { name: condition, exact: true }).click();
    await this.page.getByRole('button', { name: 'Finish', exact: true }).click();
  }
}
