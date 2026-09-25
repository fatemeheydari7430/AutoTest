import { test } from '@/fixtures/ui';
import { loadCarConfig, loadCarPresets, type CarConfig } from '../../src/config/test-options';

function resolveCarScenario(): CarConfig {
  const requested = process.env.CAR_SCENARIO;
  if (!requested) return loadCarConfig();

  const presets = loadCarPresets();
  const preset = presets[requested];
  if (!preset) {
    throw new Error(
      `Unknown CAR_SCENARIO "${requested}". Available: ${Object.keys(presets).join(', ')}`,
    );
  }
  return preset;
}

const scenario = resolveCarScenario();

test.describe(
  'Car insurance purchase [configured]',
  { tag: ['@car', '@e2e', '@smoke', '@happy'] },
  () => {
    test.setTimeout(300_000);

    test('reaches the payment screen for a car insurance purchase', async ({
      appAuth,
      carInsurancePage,
      carDetailsPage,
      vehicleDetailsPage,
      driverDetailsPage,
      drivingHistoryPage,
      quotesPage,
      reviewPayPage,
      paymentPage,
    }) => {
      await test.step('Login to application', async () => {
        await appAuth.login();
      });

      await test.step('Start car insurance flow', async () => {
        await carInsurancePage.startFlow(scenario.leadType);
        await carInsurancePage.chooseManualEntry();
      });

      await test.step('Enter vehicle details', async () => {
        await carDetailsPage.expectLoaded();
        await carDetailsPage.enterVehicleDetails(scenario.vehicle);
        await carDetailsPage.continue();
      });

      await test.step('Select vehicle specification', async () => {
        await vehicleDetailsPage.chooseSpecification(scenario.specification);
        await vehicleDetailsPage.chooseEmirate(scenario.emirate);
      });

      await test.step('Enter driver information', async () => {
        await driverDetailsPage.expectLoaded();
        await driverDetailsPage.enterDriverDetails(scenario.driver);
      });

      await test.step('Enter driving history', async () => {
        await drivingHistoryPage.answerLicenseDuration(scenario.history.drivingExperience);
        await drivingHistoryPage.answerClaims(scenario.history.claims);
      });

      await test.step('Load available quotes', async () => {
        await quotesPage.expectLoaded();
      });

      await test.step('Select insurance quote', async () => {
        await quotesPage.selectFirstQuote();
      });

      await test.step('Review policy', async () => {
        await reviewPayPage.expectLoaded();
        await reviewPayPage.setEmailIfPresent(scenario.contact.email);
      });

      await test.step('Continue to payment', async () => {
        await reviewPayPage.confirmAndPay();
      });

      await test.step('Verify payment page', async () => {
        // Stop at the payment screen: no method selected, no "Pay now" click.
        await paymentPage.expectLoaded();
      });
    });
  },
);
