import { test } from '@/fixtures/ui';
import purchaseData from '../../test-data/e2e/health-purchase.json';

test.describe('Health insurance purchase', () => {
  test.setTimeout(300_000);

  test(
    'reaches the payment screen for a health insurance purchase',
    { tag: ['@health', '@smoke'] },
    async ({
      appAuth,
      healthInsurancePage,
      healthQuestionnairePage,
      healthQuotesPage,
      healthPaymentPage,
    }) => {
      await appAuth.login();

      await healthInsurancePage.startIndividualCoverage();

      await healthQuestionnairePage.answerGender(purchaseData.gender);
      await healthQuestionnairePage.answerEmirate(purchaseData.emirate);
      await healthQuestionnairePage.answerSalary(purchaseData.salary);
      await healthQuestionnairePage.selectMembers(purchaseData.members);
      await healthQuestionnairePage.enterDateOfBirth(purchaseData.dateOfBirth);
      await healthQuestionnairePage.answerMedicalCondition(purchaseData.medicalCondition);

      await healthQuotesPage.expectLoaded();
      await healthQuotesPage.selectFirstPlan();

      // Stop at the payment screen: no method selected, no "Pay Now" click.
      await healthPaymentPage.expectLoaded();
    },
  );
});
