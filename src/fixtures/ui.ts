import { test as base, expect } from '@playwright/test';
import { AppAuth } from '../auth/app-auth';
import { CarInsurancePage } from '../pages/car-insurance.page';
import { CarDetailsPage } from '../pages/car-details.page';
import { VehicleDetailsPage } from '../pages/vehicle-details.page';
import { DriverDetailsPage } from '../pages/driver-details.page';
import { DrivingHistoryPage } from '../pages/driving-history.page';
import { QuotesPage } from '../pages/quotes.page';
import { ReviewPayPage } from '../pages/review-pay.page';
import { PaymentPage } from '../pages/payment.page';
import { HealthInsurancePage } from '../pages/health-insurance.page';
import { HealthQuestionnairePage } from '../pages/health-questionnaire.page';
import { HealthQuotesPage } from '../pages/health-quotes.page';
import { HealthPaymentPage } from '../pages/health-payment.page';

export interface UiFixtures {
  appAuth: AppAuth;
  carInsurancePage: CarInsurancePage;
  carDetailsPage: CarDetailsPage;
  vehicleDetailsPage: VehicleDetailsPage;
  driverDetailsPage: DriverDetailsPage;
  drivingHistoryPage: DrivingHistoryPage;
  quotesPage: QuotesPage;
  reviewPayPage: ReviewPayPage;
  paymentPage: PaymentPage;
  healthInsurancePage: HealthInsurancePage;
  healthQuestionnairePage: HealthQuestionnairePage;
  healthQuotesPage: HealthQuotesPage;
  healthPaymentPage: HealthPaymentPage;
}

export const test = base.extend<UiFixtures>({
  appAuth: async ({ page }, use) => {
    await use(new AppAuth(page));
  },
  carInsurancePage: async ({ page }, use) => {
    await use(new CarInsurancePage(page));
  },
  carDetailsPage: async ({ page }, use) => {
    await use(new CarDetailsPage(page));
  },
  vehicleDetailsPage: async ({ page }, use) => {
    await use(new VehicleDetailsPage(page));
  },
  driverDetailsPage: async ({ page }, use) => {
    await use(new DriverDetailsPage(page));
  },
  drivingHistoryPage: async ({ page }, use) => {
    await use(new DrivingHistoryPage(page));
  },
  quotesPage: async ({ page }, use) => {
    await use(new QuotesPage(page));
  },
  reviewPayPage: async ({ page }, use) => {
    await use(new ReviewPayPage(page));
  },
  paymentPage: async ({ page }, use) => {
    await use(new PaymentPage(page));
  },
  healthInsurancePage: async ({ page }, use) => {
    await use(new HealthInsurancePage(page));
  },
  healthQuestionnairePage: async ({ page }, use) => {
    await use(new HealthQuestionnairePage(page));
  },
  healthQuotesPage: async ({ page }, use) => {
    await use(new HealthQuotesPage(page));
  },
  healthPaymentPage: async ({ page }, use) => {
    await use(new HealthPaymentPage(page));
  },
});

export { expect };
