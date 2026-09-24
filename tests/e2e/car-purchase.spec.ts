import { test } from '@/fixtures/ui';
import scenarios from '../../test-data/e2e/car-scenarios.json';

interface CarScenario {
  vehicle: { brand: string; model: string; year: string; trim: string };
  specification: string;
  emirate: string;
  driver: {
    nationality: string;
    dateOfBirth: { year: string; month: string; day: string };
  };
  history: { drivingExperience: string; claims: string };
  contact: { email: string };
}

const scenarioName = process.env.CAR_SCENARIO ?? 'default';
const scenario = (scenarios as Record<string, CarScenario>)[scenarioName];

if (!scenario) {
  throw new Error(
    `Unknown CAR_SCENARIO "${scenarioName}". Available: ${Object.keys(scenarios).join(', ')}`,
  );
}

test.describe('Car insurance purchase', () => {
  test.setTimeout(300_000);

  test(`places a car insurance order up to the payment screen [${scenarioName}]`, async ({
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
    await appAuth.login();

    await carInsurancePage.startRenewal();
    await carInsurancePage.chooseManualEntry();

    await carDetailsPage.expectLoaded();
    await carDetailsPage.enterVehicleDetails(scenario.vehicle);
    await carDetailsPage.continue();

    await vehicleDetailsPage.chooseSpecification(scenario.specification);
    await vehicleDetailsPage.chooseEmirate(scenario.emirate);

    await driverDetailsPage.expectLoaded();
    await driverDetailsPage.enterDriverDetails(scenario.driver);

    await drivingHistoryPage.answerLicenseDuration(scenario.history.drivingExperience);
    await drivingHistoryPage.answerClaims(scenario.history.claims);

    await quotesPage.expectLoaded();
    await quotesPage.selectFirstQuote();

    await reviewPayPage.expectLoaded();
    await reviewPayPage.setEmailIfPresent(scenario.contact.email);
    await reviewPayPage.confirmAndPay();

    // Stop at the payment screen: no method selected, no "Pay now" click.
    await paymentPage.expectLoaded();
  });
});
