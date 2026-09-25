import { test as base, expect, type Response } from '@playwright/test';
import { writeFileSync } from 'node:fs';
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
  /** Auto fixture: on failure, attaches the last alpha-api calls (method/path/status only). */
  _apiCallContext: void;
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
  _apiCallContext: [
    async ({ page }, use, testInfo) => {
      const calls: { method: string; path: string; status: number }[] = [];

      const onResponse = (res: Response): void => {
        const url = res.url();
        if (!/alpha-api\.lookinsure\.com/i.test(url)) return;
        let path = url;
        try {
          path = new URL(url).pathname;
        } catch {
          // keep raw url if parsing fails
        }
        // Only method + path + status are captured: no headers, cookies, tokens or bodies.
        calls.push({ method: res.request().method(), path, status: res.status() });
        if (calls.length > 20) calls.shift();
      };

      page.on('response', onResponse);
      await use();
      page.off('response', onResponse);

      const failed = testInfo.status !== testInfo.expectedStatus;
      if (failed && calls.length > 0) {
        // Only method + path + status are captured: no headers, cookies, tokens or bodies.
        const file = testInfo.outputPath('last-api-calls.json');
        writeFileSync(file, JSON.stringify(calls.slice(-8), null, 2));
        await testInfo.attach('last-api-calls.json', {
          path: file,
          contentType: 'application/json',
        });
      }
    },
    { auto: true },
  ],

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
