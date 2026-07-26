import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  get logoutButton(): Locator {
    return this.byRole('button', /logout|sign out|خروج/i);
  }

  get userMenu(): Locator {
    return this.byRole('button', /profile|account|حساب|کاربر/i);
  }

  isLoggedIn(): Promise<boolean> {
    return this.logoutButton.isVisible().then(() => true).catch(() => false);
  }
}