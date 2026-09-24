import { expect, type Page } from '@playwright/test';
import { config } from '../config';

export interface AppUser {
  mobile?: string;
  otp?: string;
}

/**
 * Performs the app's own mobile + OTP login inside the given (fresh) page
 * context. Any previously stored app session is irrelevant: the caller always
 * starts from the login screen.
 */
export class AppAuth {
  constructor(private readonly page: Page) {}

  private get loginUrl(): string {
    return `${config.web.baseURL}/auth/?space=vault&callback=%2F&origin=${encodeURIComponent(
      config.web.baseURL,
    )}`;
  }

  async login(user: AppUser = {}): Promise<void> {
    const mobile = user.mobile ?? config.auth.mobile;
    const otp = user.otp ?? config.auth.otp;

    await this.page.goto(config.web.baseURL, { waitUntil: 'domcontentloaded' });
    await this.page.goto(this.loginUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const phone = this.page.getByRole('textbox', { name: /phone number/i });
    await phone.waitFor({ state: 'visible', timeout: 30_000 });
    await phone.click();
    await phone.fill(mobile);

    const continueButton = this.page.getByRole('button', { name: /^continue$/i });
    try {
      await expect(continueButton).toBeEnabled({ timeout: 5_000 });
    } catch {
      // React may not have attached its handler yet; retype char by char.
      await phone.fill('');
      await phone.pressSequentially(mobile, { delay: 30 });
      await expect(continueButton).toBeEnabled({ timeout: 5_000 });
    }
    await continueButton.click();

    // Four single-digit inputs; the form auto-submits on the last digit.
    const otpInputs = this.page.locator('input[inputmode="numeric"], input[maxlength="1"]');
    await otpInputs.first().waitFor({ state: 'visible', timeout: 30_000 });

    const digits = otp.split('');
    const count = Math.min((await otpInputs.count()) || digits.length, digits.length);
    for (let i = 0; i < count; i++) {
      await otpInputs.nth(i).fill(digits[i]);
    }

    await this.page.waitForURL((url) => !url.toString().includes('/auth'), {
      timeout: 45_000,
    });
    await expect(this.page.getByRole('link', { name: /my account/i })).toBeVisible({
      timeout: 30_000,
    });
  }
}
