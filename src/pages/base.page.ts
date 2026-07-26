import type { Locator, Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path);
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  waitForReady(): Promise<void> {
    return this.page.waitForLoadState('domcontentloaded');
  }

  protected byRole(role: Parameters<Page['getByRole']>[0], name?: string | RegExp): Locator {
    return name === undefined ? this.page.getByRole(role) : this.page.getByRole(role, { name });
  }

  protected byText(text: string): Locator {
    return this.page.getByText(text);
  }
}