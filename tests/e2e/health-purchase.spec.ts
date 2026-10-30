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
      page,
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

      let emptyPlanList = false;
      await test.step('Load available plans', async () => {
        emptyPlanList = await healthQuotesPage.expectLoaded();
      });

      if (emptyPlanList) {
        await test.step('Report empty plan list and close browser', async () => {
          await page.waitForTimeout(2_000);
          console.log('CONTROL_CENTER_EVENT {"type":"result-warning","warning":"Empty list"}');
          await page.context().close();
        });
        return;
      }

      await test.step('Select plan', async () => {
        await healthQuotesPage.selectFirstPlan();
      });

      await test.step('Verify payment page', async () => {
        await healthPaymentPage.expectLoaded();
      });

      await test.step('Open payment gateway', async () => {
        await healthPaymentPage.payNow();
      });

      await test.step('Close browser on payment gateway', async () => {
        await page.context().close();
      });
    });
  },
);
