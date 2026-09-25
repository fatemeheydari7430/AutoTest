import { expect, type Locator, type Page } from '@playwright/test';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
   *
   * Matching order: exact, then case-insensitive exact. If a case-insensitive
   * match is ambiguous (more than one), it fails instead of guessing. No fuzzy
   * / partial / "closest" matching.
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

    await this.pickOption(scope, value);

    if (dialogVisible) {
      await expect(dialog).toBeHidden();
    }
  }

  private async pickOption(scope: Page | Locator, value: string): Promise<void> {
    const exactButton = scope.getByRole('button', { name: value, exact: true }).filter({ visible: true });
    const exactText = scope.getByText(value, { exact: true }).filter({ visible: true });
    const ci = new RegExp(`^${escapeRegExp(value)}$`, 'i');
    const ciButtons = scope.getByRole('button', { name: ci }).filter({ visible: true });
    const ciText = scope.getByText(ci).filter({ visible: true });

    // Option lists load asynchronously after the search is typed, so poll
    // instead of a single non-waiting count. Exact is always preferred.
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if ((await exactButton.count()) > 0) {
        await exactButton.first().click();
        return;
      }
      if ((await exactText.count()) > 0) {
        await exactText.first().click();
        return;
      }
      const ciButtonCount = await ciButtons.count();
      if (ciButtonCount === 1) {
        await ciButtons.first().click();
        return;
      }
      if (ciButtonCount > 1) {
        throw new Error(`Ambiguous option "${value}": ${ciButtonCount} case-insensitive matches`);
      }
      const ciTextCount = await ciText.count();
      if (ciTextCount === 1) {
        await ciText.first().click();
        return;
      }
      if (ciTextCount > 1) {
        throw new Error(`Ambiguous option "${value}": ${ciTextCount} case-insensitive matches`);
      }
      await this.page.waitForTimeout(200);
    }

    throw new Error(`Option "${value}" not found`);
  }

  protected byRole(role: Parameters<Page['getByRole']>[0], name?: string | RegExp): Locator {
    return name === undefined ? this.page.getByRole(role) : this.page.getByRole(role, { name });
  }

  protected byText(text: string): Locator {
    return this.page.getByText(text);
  }
}
