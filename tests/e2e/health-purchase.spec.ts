import { test } from '@/fixtures/ui';
import { loadHealthConfig, loadHealthPresets, type HealthConfig } from '../../src/config/test-options';

function resolveHealthScenario(): HealthConfig {
  const requested = process.env.HEALTH_SCENARIO;
  if (!requested) return loadHealthConfig();

  const presets = loadHealthPresets();
  const preset = presets[requested];
  if (!preset) {
    throw new Error(
      `Unknown HEALTH_SCENARIO "${requested}". Available: ${Object.keys(presets).join(', ')}`,
    );
  }
  return preset;
}

const scenario = resolveHealthScenario();

test.describe(
  'Health insurance purchase [configured]',
  { tag: ['@health', '@e2e', '@smoke', '@happy'] },
  () => {
    test.setTimeout(300_000);

    test('reaches the payment screen for a health insurance purchase', async ({
      appAuth,
      healthInsurancePage,
      healthQuestionnairePage,
      healthQuotesPage,
      healthPaymentPage,
    }) => {
      await test.step('Login to application', async () => {
        await appAuth.login();
      });

      await test.step('Start health insurance', async () => {
        await healthInsurancePage.startCoverage(scenario.insureFor);
      });

      await test.step('Select gender', async () => {
        await healthQuestionnairePage.answerGender(scenario.gender);
      });

      await test.step('Select emirate', async () => {
        await healthQuestionnairePage.answerEmirate(scenario.emirate);
      });

      await test.step('Select salary range', async () => {
        await healthQuestionnairePage.answerSalary(scenario.salaryRange);
      });

      await test.step('Select members', async () => {
        await healthQuestionnairePage.selectMembers(scenario.members);
      });

      await test.step('Enter date of birth', async () => {
        await healthQuestionnairePage.enterDateOfBirth(scenario.members);
      });

      await test.step('Answer medical condition', async () => {
        await healthQuestionnairePage.answerMedicalCondition(
          scenario.medicalCondition,
          scenario.isAnyMemberPregnant,
        );
      });

      await test.step('Load available plans', async () => {
        await healthQuotesPage.expectLoaded();
      });

      await test.step('Select plan', async () => {
        await healthQuotesPage.selectFirstPlan();
      });

      await test.step('Verify payment page', async () => {
        // Stop at the payment screen: no method selected, no "Pay Now" click.
        await healthPaymentPage.expectLoaded();
      });
    });
  },
);
