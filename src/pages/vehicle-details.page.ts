import { BasePage } from './base.page';
import { CAR_SPECIFICATIONS, EMIRATES } from '../config/test-options';

function uiLabel(map: Record<string, string>, value: string, context: string): string {
  const label = map[value];
  if (!label) {
    throw new Error(`Unsupported ${context} "${value}". Known: ${Object.keys(map).join(', ')}`);
  }
  return label;
}

export class VehicleDetailsPage extends BasePage {
  async chooseSpecification(specification: string): Promise<void> {
    await this.expectStepText(
      /Choose your vehicle.s specification/i,
      'Vehicle specification step did not load',
    );
    await this.page
      .getByRole('button', { name: uiLabel(CAR_SPECIFICATIONS, specification, 'specification'), exact: true })
      .click();
  }

  async chooseEmirate(emirate: string): Promise<void> {
    await this.expectStepText(
      'In which emirate is your car registered?',
      'Vehicle registration emirate step did not load',
    );
    await this.page
      .getByRole('button', { name: uiLabel(EMIRATES, emirate, 'emirate'), exact: true })
      .click();
  }
}
