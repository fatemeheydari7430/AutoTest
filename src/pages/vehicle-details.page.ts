import { BasePage } from './base.page';

/** Business value -> visible UI label maps for the vehicle steps. */
const SPECIFICATIONS: Record<string, string> = {
  GCC: 'GCC Spec',
  NON_GCC: 'Non-GCC Spec',
};

const EMIRATES: Record<string, string> = {
  dubai: 'Dubai',
  abuDhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  ummAlQuwain: 'Umm Al Quwain',
  rasAlKhaimah: 'Ras Al Khaimah',
  fujairah: 'Al Fujairah',
};

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class VehicleDetailsPage extends BasePage {
  async chooseSpecification(specification: string): Promise<void> {
    await this.expectStepText(/Choose your vehicle.s specification/i);
    await this.page
      .getByRole('button', { name: uiLabel(SPECIFICATIONS, specification, 'specification'), exact: true })
      .click();
  }

  async chooseEmirate(emirate: string): Promise<void> {
    await this.expectStepText('In which emirate is your car registered?');
    await this.page
      .getByRole('button', { name: uiLabel(EMIRATES, emirate, 'emirate'), exact: true })
      .click();
  }
}
