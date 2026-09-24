import { BasePage } from './base.page';

export class VehicleDetailsPage extends BasePage {
  async chooseSpecification(specification: string): Promise<void> {
    await this.expectStepText(/Choose your vehicle.s specification/i);
    await this.page.getByRole('button', { name: specification, exact: true }).click();
  }

  async chooseEmirate(emirate: string): Promise<void> {
    await this.expectStepText('In which emirate is your car registered?');
    await this.page.getByRole('button', { name: emirate, exact: true }).click();
  }
}
