import { test } from '@/fixtures/ui';
import scenarios from '../../test-data/e2e/health-scenarios.json';

interface HealthScenario {
  insureFor: string;
  gender: string;
  emirate: string;
  salaryRange: string;
  members: string[];
  dateOfBirth: { year: string; month: string; day: string };
  medicalCondition: boolean;
}

const scenarioName = process.env.HEALTH_SCENARIO ?? 'default';
const scenario = (scenarios as Record<string, HealthScenario>)[scenarioName];

if (!scenario) {
  throw new Error(
    `Unknown HEALTH_SCENARIO "${scenarioName}". Available: ${Object.keys(scenarios).join(', ')}`,
  );
}

test.describe('Health insurance purchase', () => {
  test.setTimeout(300_000);

  test(
    `reaches the payment screen for a health insurance purchase [${scenarioName}]`,
    { tag: ['@health', '@smoke'] },
    async ({
      appAuth,
      healthInsurancePage,
      healthQuestionnairePage,
      healthQuotesPage,
      healthPaymentPage,
    }) => {
      await appAuth.login();

      await healthInsurancePage.startCoverage(scenario.insureFor);

      await healthQuestionnairePage.answerGender(scenario.gender);
      await healthQuestionnairePage.answerEmirate(scenario.emirate);
      await healthQuestionnairePage.answerSalary(scenario.salaryRange);
      await healthQuestionnairePage.selectMembers(scenario.members);
      await healthQuestionnairePage.enterDateOfBirth(scenario.dateOfBirth);
      await healthQuestionnairePage.answerMedicalCondition(scenario.medicalCondition);

      await healthQuotesPage.expectLoaded();
      await healthQuotesPage.selectFirstPlan();

      // Stop at the payment screen: no method selected, no "Pay Now" click.
      await healthPaymentPage.expectLoaded();
    },
  );
});
