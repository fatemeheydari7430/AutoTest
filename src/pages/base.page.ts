import { expect, type Locator, type Page } from '@playwright/test';

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

  get continueButton(): Locator {
    return this.page.getByRole('button', { name: 'Continue', exact: true });
  }

  protected async clickContinue(): Promise<void> {
    await expect(this.continueButton).toBeEnabled();
    await this.continueButton.click();
  }

  protected async expectStepText(text: string | RegExp, message?: string): Promise<void> {
    await expect(
      this.page.getByText(text).first(),
      message ?? `Expected step to be visible: ${String(text)}`,
    ).toBeVisible();
  }

  /** Opens a calendar picker and selects a year/month/day via the dialog. */
  protected async pickDate(
    date: { year: string; month: string; day: string },
    index = 0,
  ): Promise<void> {
    await this.page.getByLabel(/choose date/i).nth(index).click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: date.year, exact: true }).click();
    await dialog.getByRole('radio', { name: date.month, exact: true }).click();
    await dialog.getByRole('gridcell', { name: date.day, exact: true }).click();
    await dialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  /** The selectable field is the first div sibling of its label paragraph. */
  protected field(label: string): Locator {
    return this.page.getByText(label, { exact: true }).locator('..').locator('div').first();
  }

  /**
   * Opens a labelled select field, optionally searches, then picks an option.
   * Handles both dialog-based modals and inline searchable lists.
   */
  protected async selectOption(label: string, value: string): Promise<void> {
    await this.field(label).click();

    const dialog = this.page.getByRole('dialog');
    const dialogVisible =
      (await dialog.count()) > 0 && (await dialog.first().isVisible().catch(() => false));
    const scope = dialogVisible ? dialog : this.page;

    const search = scope.getByPlaceholder('Search').filter({ visible: true }).first();
    if (await search.count()) {
      await search.fill(value);
      await this.page.waitForTimeout(600);
    }

    const option = scope
      .getByRole('button', { name: value, exact: true })
      .filter({ visible: true })
      .first();
    if (await option.count()) {
      await option.click();
    } else {
      await scope.getByText(value, { exact: true }).filter({ visible: true }).first().click();
    }

    if (dialogVisible) {
      await expect(dialog).toBeHidden();
    }
  }

  protected byRole(role: Parameters<Page['getByRole']>[0], name?: string | RegExp): Locator {
    return name === undefined ? this.page.getByRole(role) : this.page.getByRole(role, { name });
  }

  protected byText(text: string): Locator {
    return this.page.getByText(text);
  }
}
