import { test } from '@/fixtures/ui';
import purchaseData from '../../test-data/e2e/car-purchase.json';

test.describe('Car insurance purchase', () => {
  test.setTimeout(300_000);

  test('places a car insurance order up to the payment screen', async ({
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
    await carDetailsPage.enterVehicleDetails(purchaseData.vehicle);
    await carDetailsPage.continue();

    await vehicleDetailsPage.chooseSpecification(purchaseData.specification);
    await vehicleDetailsPage.chooseEmirate(purchaseData.registrationEmirate);

    await driverDetailsPage.expectLoaded();
    await driverDetailsPage.enterDriverDetails(purchaseData.driver);

    await drivingHistoryPage.answerLicenseDuration(purchaseData.drivingLicenseYears);
    await drivingHistoryPage.answerClaims(purchaseData.claimsHistory);

    await quotesPage.expectLoaded();
    await quotesPage.selectFirstQuote();

    await reviewPayPage.expectLoaded();
    await reviewPayPage.setEmailIfPresent(purchaseData.contact.email);
    await reviewPayPage.confirmAndPay();

    // Stop at the payment screen: no method selected, no "Pay now" click.
    await paymentPage.expectLoaded();
  });
});
