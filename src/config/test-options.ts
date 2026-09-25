import fs from 'node:fs';
import path from 'node:path';

export const CAR_LEAD_TYPES: Record<string, string> = {
  RENEW: 'Renewal',
  TRANSFER_OF_OWNER_SHIP: 'Transfer of Ownership',
};

export const CAR_SPECIFICATIONS: Record<string, string> = {
  GCC: 'GCC Spec',
  NON_GCC: 'Non-GCC Spec',
};

export const EMIRATES: Record<string, string> = {
  dubai: 'Dubai',
  abuDhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  ummAlQuwain: 'Umm Al Quwain',
  rasAlKhaimah: 'Ras Al Khaimah',
  fujairah: 'Al Fujairah',
};

export const DRIVING_EXPERIENCES: Record<string, string> = {
  MORE_THAN_FIVE_YEAR: 'More than 5 years',
  MORE_THAN_FOUR_YEAR: '4-5 years',
  MORE_THAN_THREE_YEAR: '3-4 years',
  MORE_THAN_TWO_YEAR: '2-3 years',
  MORE_THAN_ONE_YEAR: '1-2 year',
  LESS_THAN_ONE_YEAR: 'Less than 1 year',
};

export const CLAIMS: Record<string, string> = {
  CLAIM_0: 'Had a claim in the past 12 months',
  CLAIM_1: 'One (1) year without claims',
  CLAIM_2: 'Two (2) years without claims',
  CLAIM_3: 'Three (3) years without claims',
  CLAIM_4: 'Four (4) years without any claims',
  CLAIM_FREE_OVER_4: 'Claim-free for over 4 years',
};

export const HEALTH_GENDERS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
};

export const HEALTH_MEMBERS: Record<string, string> = {
  YOURSELF: 'Me',
  WIFE: 'Wife',
  FATHER: 'Father',
  MOTHER: 'Mother',
  DAUGHTER: 'Daughter',
  SON: 'Son',
};

export const SALARY_RANGES: Record<string, string> = {
  MORE_THAN_4000: 'More than AED 4,000',
  LESS_THAN_4000: 'Below AED 4,000',
};

export const COVERAGE_TYPES: Record<string, string> = {
  INDIVIDUAL: 'Me or my family',
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export interface CarConfig {
  leadType: string;
  vehicle: { brand: string; model: string; year: string; trim: string };
  specification: string;
  emirate: string;
  driver: { nationality: string; dateOfBirth: DateParts };
  history: { drivingExperience: string; claims: string };
  contact: { email: string };
}

export interface HealthMemberConfig {
  type: string;
  dateOfBirth: DateParts;
}

export interface HealthConfig {
  insureFor: string;
  gender: string;
  emirate: string;
  salaryRange: string;
  members: HealthMemberConfig[];
  isAnyMemberPregnant: boolean;
  medicalCondition: boolean;
}

const E2E_DIR = path.resolve(process.cwd(), 'test-data', 'e2e');

export const E2E_PATHS = {
  carPresets: path.join(E2E_DIR, 'presets', 'car-presets.json'),
  healthPresets: path.join(E2E_DIR, 'presets', 'health-presets.json'),
  carRuntime: path.join(E2E_DIR, 'runtime', 'car-config.json'),
  healthRuntime: path.join(E2E_DIR, 'runtime', 'health-config.json'),
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonIfExists(file: string): unknown | undefined {
  if (!fs.existsSync(file)) return undefined;
  return readJson(file);
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function loadCarPresets(): Record<string, CarConfig> {
  return readJson(E2E_PATHS.carPresets) as Record<string, CarConfig>;
}

export function loadHealthPresets(): Record<string, HealthConfig> {
  return readJson(E2E_PATHS.healthPresets) as Record<string, HealthConfig>;
}

export function loadCarConfig(): CarConfig {
  const runtime = readJsonIfExists(E2E_PATHS.carRuntime) as CarConfig | undefined;
  if (runtime) return runtime;
  const preset = loadCarPresets().default;
  if (!preset) throw new Error('car-presets.json has no "default" preset');
  return preset;
}

export function loadHealthConfig(): HealthConfig {
  const runtime = readJsonIfExists(E2E_PATHS.healthRuntime) as HealthConfig | undefined;
  if (runtime) return runtime;
  const preset = loadHealthPresets().default;
  if (!preset) throw new Error('health-presets.json has no "default" preset');
  return preset;
}

function collectSensitiveKeys(value: unknown, prefix = ''): string[] {
  const errors: string[] = [];
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/token|password|secret|cookie|otp|authorization/i.test(key)) {
        errors.push(`Sensitive key is not allowed in config: ${prefix}${key}`);
      }
      errors.push(...collectSensitiveKeys(child, `${prefix}${key}.`));
    }
  }
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateDateParts(value: unknown, prefix: string): string[] {
  if (!isRecord(value)) return [`${prefix} must be an object`];
  const errors: string[] = [];
  const { year, month, day } = value;
  if (typeof year !== 'string' || !/^\d{4}$/.test(year)) {
    errors.push(`${prefix}.year must be a 4 digit year string`);
  }
  if (typeof month !== 'string' || !(MONTH_NAMES as readonly string[]).includes(month)) {
    errors.push(`${prefix}.month must be one of: ${MONTH_NAMES.join(', ')}`);
  }
  if (typeof day !== 'string' || !/^(0?[1-9]|[12]\d|3[01])$/.test(day)) {
    errors.push(`${prefix}.day must be a day of month string`);
  }
  return errors;
}

function validateEnum(
  value: unknown,
  allowed: Record<string, string>,
  prefix: string,
): string[] {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(allowed, value)) {
    return [`${prefix} must be one of: ${Object.keys(allowed).join(', ')}`];
  }
  return [];
}

function validateHealthMember(value: unknown, prefix: string): string[] {
  if (!isRecord(value)) return [`${prefix} must be an object`];
  const errors = validateEnum(value.type, HEALTH_MEMBERS, `${prefix}.type`);
  errors.push(...validateDateParts(value.dateOfBirth, `${prefix}.dateOfBirth`));
  return errors;
}

function validateText(value: unknown, prefix: string): string[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [`${prefix} is required`];
  }
  return [];
}

export function validateCarConfig(input: unknown): string[] {
  const errors = collectSensitiveKeys(input);
  if (!isRecord(input)) return [...errors, 'Car config must be an object'];

  errors.push(...validateEnum(input.leadType, CAR_LEAD_TYPES, 'leadType'));

  const vehicle = input.vehicle;
  if (!isRecord(vehicle)) {
    errors.push('vehicle must be an object');
  } else {
    errors.push(...validateText(vehicle.brand, 'vehicle.brand'));
    errors.push(...validateText(vehicle.model, 'vehicle.model'));
    errors.push(...validateText(vehicle.year, 'vehicle.year'));
    errors.push(...validateText(vehicle.trim, 'vehicle.trim'));
  }

  errors.push(...validateEnum(input.specification, CAR_SPECIFICATIONS, 'specification'));
  errors.push(...validateEnum(input.emirate, EMIRATES, 'emirate'));

  const driver = input.driver;
  if (!isRecord(driver)) {
    errors.push('driver must be an object');
  } else {
    errors.push(...validateText(driver.nationality, 'driver.nationality'));
    errors.push(...validateDateParts(driver.dateOfBirth, 'driver.dateOfBirth'));
  }

  const history = input.history;
  if (!isRecord(history)) {
    errors.push('history must be an object');
  } else {
    errors.push(...validateEnum(history.drivingExperience, DRIVING_EXPERIENCES, 'history.drivingExperience'));
    errors.push(...validateEnum(history.claims, CLAIMS, 'history.claims'));
  }

  const contact = input.contact;
  if (!isRecord(contact)) {
    errors.push('contact must be an object');
  } else if (typeof contact.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
    errors.push('contact.email must be a valid email');
  }

  return errors;
}

export function validateHealthConfig(input: unknown): string[] {
  const errors = collectSensitiveKeys(input);
  if (!isRecord(input)) return [...errors, 'Health config must be an object'];

  errors.push(...validateEnum(input.insureFor, COVERAGE_TYPES, 'insureFor'));
  errors.push(...validateEnum(input.gender, HEALTH_GENDERS, 'gender'));
  errors.push(...validateEnum(input.emirate, EMIRATES, 'emirate'));
  errors.push(...validateEnum(input.salaryRange, SALARY_RANGES, 'salaryRange'));

  if (!Array.isArray(input.members) || input.members.length === 0) {
    errors.push('members must be a non-empty array');
  } else {
    input.members.forEach((member, index) => {
      errors.push(...validateHealthMember(member, `members[${index}]`));
    });
  }

  if (typeof input.isAnyMemberPregnant !== 'boolean') {
    errors.push('isAnyMemberPregnant must be a boolean');
  }

  if (typeof input.medicalCondition !== 'boolean') {
    errors.push('medicalCondition must be a boolean');
  }

  return errors;
}

export function saveCarConfig(config: CarConfig): void {
  const errors = validateCarConfig(config);
  if (errors.length > 0) throw new Error(`Invalid car config:\n${errors.join('\n')}`);
  writeJsonAtomic(E2E_PATHS.carRuntime, config);
}

export function saveHealthConfig(config: HealthConfig): void {
  const errors = validateHealthConfig(config);
  if (errors.length > 0) throw new Error(`Invalid health config:\n${errors.join('\n')}`);
  writeJsonAtomic(E2E_PATHS.healthRuntime, config);
}

export function resetCarConfig(): CarConfig {
  const preset = loadCarPresets().default;
  if (!preset) throw new Error('car-presets.json has no "default" preset');
  saveCarConfig(preset);
  return preset;
}

export function resetHealthConfig(): HealthConfig {
  const preset = loadHealthPresets().default;
  if (!preset) throw new Error('health-presets.json has no "default" preset');
  saveHealthConfig(preset);
  return preset;
}
