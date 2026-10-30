const $ = (id) => document.getElementById(id);

let options = null;
let carPresets = {};
let liveCarMakes = null;
let liveCarCountries = null;
const liveCarModels = new Map();
let carCatalogLoading = null;
let carTrimRequestId = 0;
let carCountrySearchTimer = null;
let carClaimsRequestId = 0;
let carClaimsLoading = null;

function showMessage(kind, lines) {
  const box = $("message");
  box.className = `message ${kind}`;
  box.hidden = false;
  box.innerHTML = "";
  if (lines.length === 1) {
    box.textContent = lines[0];
    return;
  }
  box.textContent = lines[0];
  const list = document.createElement("ul");
  for (const line of lines.slice(1)) {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  }
  box.appendChild(list);
}

function clearMessage() {
  const box = $("message");
  box.hidden = true;
  box.textContent = "";
}

function setSelect(el, map, value) {
  el.innerHTML = "";
  for (const [key, label] of Object.entries(map)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    el.appendChild(option);
  }
  if (value !== undefined) el.value = value;
}

function setDropdown(select, values, selected, { allowBlank = false, preserveSelection = false } = {}) {
  const choices = [...new Set(values.filter((value) => value != null && String(value) !== "").map(String))];
  if (preserveSelection && selected && !choices.includes(String(selected))) {
    choices.unshift(String(selected));
  }

  select.innerHTML = "";
  if (allowBlank) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— No trim —";
    select.appendChild(blank);
  }
  for (const value of choices) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (selected !== undefined && selected !== null && [...select.options].some((option) => option.value === String(selected))) {
    select.value = String(selected);
  }
}

function setDatalist(input, values, selected, { preserveSelection = false } = {}) {
  const list = $(input.getAttribute("list"));
  const choices = unique(values);
  if (preserveSelection && selected && !choices.includes(String(selected))) {
    choices.unshift(String(selected));
  }
  list.innerHTML = "";
  for (const value of choices) {
    const option = document.createElement("option");
    option.value = value;
    list.appendChild(option);
  }
  if (selected !== undefined && selected !== null) input.value = String(selected);
}

function carVehicles() {
  return Object.values(carPresets).map((preset) => preset.vehicle);
}

function carMakeOptions() {
  return liveCarMakes?.map((make) => make.make)
    ?? gather(carPresets, (preset) => preset.vehicle.brand);
}

function carMakeId(makeName) {
  return liveCarMakes?.find((make) => make.make === makeName)?.id;
}

function carCountryOptions() {
  return liveCarCountries?.length
    ? liveCarCountries.map((country) => country.name)
    : gather(carPresets, (preset) => preset.driver.nationality);
}

function presetModels(makeName) {
  return unique(carVehicles().filter((vehicle) => vehicle.brand === makeName).map((vehicle) => vehicle.model));
}

function carModelOptions(makeName) {
  return liveCarModels.get(makeName) ?? presetModels(makeName);
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && String(value) !== "").map(String))];
}

function updateCarVehicleDropdowns({ preserveModel = false, preserveYear = false, preserveTrim = false } = {}) {
  const vehicles = carVehicles();
  const brand = $("car-brand").value;
  const modelInput = $("car-model");
  const previousModel = modelInput.value;
  const models = carModelOptions(brand);
  const model = preserveModel && models.includes(previousModel) ? previousModel : (models.includes(previousModel) ? previousModel : "");
  setDatalist(modelInput, models, model, { preserveSelection: true });

  const yearInput = $("car-year");
  const previousYear = yearInput.value;
  const years = yearValues();
  const year = preserveYear || years.includes(previousYear) ? previousYear : years[0];
  setDatalist(yearInput, years, year, { preserveSelection: true });

  const trimInput = $("car-trim");
  const previousTrim = trimInput.value;
  const presetTrims = unique(vehicles
    .filter((vehicle) => vehicle.brand === brand && vehicle.model === model && String(vehicle.year) === year)
    .map((vehicle) => vehicle.trim));
  const trim = preserveTrim && presetTrims.includes(previousTrim)
    ? previousTrim
    : (presetTrims.includes(previousTrim) ? previousTrim : "");
  if (liveCarMakes !== null) {
    setDatalist(trimInput, [], "");
    trimInput.disabled = true;
    trimInput.placeholder = "Select make, model and year first";
  } else {
    setDatalist(trimInput, presetTrims, trim, { preserveSelection: preserveTrim });
    trimInput.disabled = presetTrims.length === 0;
    trimInput.placeholder = presetTrims.length ? "" : "No trim available";
  }
}

async function loadLiveCarModels(makeName, preferredModel = "") {
  const makeId = carMakeId(makeName);
  if (makeId == null) return;
  const { ok, data } = await request(`/api/car-catalog/models?make=${encodeURIComponent(makeId)}`, "GET");
  if (!ok || !Array.isArray(data.options)) {
    throw new Error(data.errors?.[0] ?? `Could not load models for ${makeName}`);
  }
  const models = unique(data.options);
  liveCarModels.set(makeName, models);
  const modelInput = $("car-model");
  const selected = models.includes(preferredModel) ? preferredModel : "";
  setDatalist(modelInput, models, selected, { preserveSelection: true });
  await loadLiveCarTrims();
}

async function loadLiveCarTrims() {
  const requestId = ++carTrimRequestId;
  const trimInput = $("car-trim");
  const makeName = $("car-brand").value;
  const makeId = carMakeId(makeName);
  const model = $("car-model").value;
  const year = $("car-year").value;
  if (makeId == null || !model || !year) {
    setDatalist(trimInput, [], "");
    trimInput.disabled = true;
    trimInput.placeholder = "Select make, model and year first";
    return;
  }

  const previousTrim = trimInput.value;
  trimInput.disabled = true;
  trimInput.placeholder = "Loading trims…";

  const query = new URLSearchParams({ make: String(makeId), model, year });
  let response;
  try {
    response = await request(`/api/car-catalog/trims?${query}`, "GET");
  } catch {
    response = { ok: false, data: { options: [] } };
  }
  if (requestId !== carTrimRequestId) return;
  const trims = response.ok && Array.isArray(response.data.options)
    ? unique(response.data.options)
    : [];
  if (trims.length === 0) {
    setDatalist(trimInput, [], "");
    trimInput.disabled = true;
    trimInput.placeholder = "No trim available for this vehicle";
    return;
  }
  const selected = trims.includes(previousTrim) ? previousTrim : "";
  setDatalist(trimInput, trims, selected, { preserveSelection: true });
  trimInput.disabled = false;
  trimInput.placeholder = "";
}

async function loadLiveCarCatalog() {
  if (carCatalogLoading) return carCatalogLoading;
  if (liveCarMakes !== null) return;

  carCatalogLoading = (async () => {
    const status = $("car-catalog-status");
    status.textContent = "Loading vehicle options from the catalog…";
    try {
      const { ok, data } = await request("/api/car-catalog/makes?searchTerm=", "GET");
      if (!ok || !Array.isArray(data.options)) {
        throw new Error(data.errors?.[0] ?? "Could not load vehicle makes");
      }
      liveCarMakes = data.options
        .filter((make) => make && typeof make.make === "string" && make.id != null)
        .map((make) => ({ id: make.id, make: make.make }));
      if (liveCarMakes.length === 0) {
        liveCarMakes = null;
        throw new Error("The live catalog returned no makes");
      }
      const currentMake = $("car-brand").value;
      setDatalist($("car-brand"), carMakeOptions(), currentMake, { preserveSelection: true });
      try {
        const countriesResponse = await request("/api/car-catalog/countries", "GET");
        if (!countriesResponse.ok || !Array.isArray(countriesResponse.data.options)) {
          throw new Error(countriesResponse.data.errors?.[0] ?? "Could not load countries");
        }
        liveCarCountries = countriesResponse.data.options
          .filter((country) => country && typeof country.name === "string")
          .map((country) => ({ id: country.id, name: country.name }));
        setDatalist($("car-nationality"), carCountryOptions(), $("car-nationality").value, { preserveSelection: true });
      } catch (error) {
        status.textContent = `Live vehicle catalog loaded, but countries could not be loaded: ${String(error)}`;
      }
      if (!status.textContent.includes("could not be loaded")) {
        status.textContent = `Loaded ${liveCarMakes.length} makes and ${liveCarCountries?.length ?? 0} countries from the live site APIs. Some other choices are fixed by the site flow.`;
      }
      if (carMakeId(currentMake)) await loadLiveCarModels(currentMake, $("car-model").value);
    } catch (error) {
      status.textContent = `Live vehicle options unavailable; showing saved scenario options. ${String(error)}`;
    } finally {
      carCatalogLoading = null;
    }
  })();
  return carCatalogLoading;
}

function gather(presets, pick) {
  const values = new Set();
  for (const preset of Object.values(presets)) {
    const value = pick(preset);
    if (value) values.add(value);
  }
  return [...values];
}

function fillDob(prefix, months) {
  const day = $(`${prefix}-dob-day`);
  const month = $(`${prefix}-dob-month`);
  const year = $(`${prefix}-dob-year`);

  day.innerHTML = "";
  for (let d = 1; d <= 31; d += 1) {
    const option = document.createElement("option");
    option.value = String(d);
    option.textContent = String(d);
    day.appendChild(option);
  }

  month.innerHTML = "";
  for (const name of months) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    month.appendChild(option);
  }

  year.innerHTML = "";
  for (let y = 2010; y >= 1930; y -= 1) {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = String(y);
    year.appendChild(option);
  }
}

function setDob(prefix, dob) {
  $(`${prefix}-dob-day`).value = dob.day;
  $(`${prefix}-dob-month`).value = dob.month;
  $(`${prefix}-dob-year`).value = dob.year;
}

function getDob(prefix) {
  return {
    year: $(`${prefix}-dob-year`).value,
    month: $(`${prefix}-dob-month`).value,
    day: $(`${prefix}-dob-day`).value,
  };
}

const memberDobCache = {};
const memberCounts = {};
const DEFAULT_MEMBER_DOB = { day: "15", month: "June", year: "1995" };
// Must match COUNTABLE_HEALTH_MEMBERS / MAX_HEALTH_MEMBER_COUNT on the server.
const COUNTABLE_MEMBERS = ["SON", "DAUGHTER"];
const MAX_MEMBER_COUNT = 10;

function isCountable(type) {
  return COUNTABLE_MEMBERS.includes(type);
}

function memberCountId(type) {
  return `member-${type}-count`;
}

function renderMembers(map, selected, counts = {}) {
  const container = $("health-members");
  container.innerHTML = "";
  for (const [key, label] of Object.entries(map)) {
    const wrapper = document.createElement("label");
    wrapper.className = "member-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = key;
    checkbox.checked = selected.includes(key);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(label));

    if (isCountable(key)) {
      const countInput = document.createElement("input");
      countInput.type = "number";
      countInput.min = "1";
      countInput.max = String(MAX_MEMBER_COUNT);
      countInput.className = "member-count";
      countInput.id = memberCountId(key);
      countInput.value = String(counts[key] ?? memberCounts[key] ?? 1);
      countInput.disabled = !checkbox.checked;
      countInput.addEventListener("input", () => {
        captureMemberDobs();
        renderMemberDobs();
      });
      wrapper.appendChild(countInput);
      memberCounts[key] = Number(counts[key] ?? 1);
    }

    checkbox.addEventListener("change", () => {
      const countInput = $(memberCountId(key));
      if (countInput) countInput.disabled = !checkbox.checked;
      captureMemberDobs();
      renderMemberDobs();
    });

    container.appendChild(wrapper);
  }
}

function getMembers() {
  return [...document.querySelectorAll("#health-members input:checked")].map((el) => el.value);
}

function getMemberCount(type) {
  if (!isCountable(type)) return 1;
  const input = $(memberCountId(type));
  if (!input) return 1;
  const value = Number.parseInt(input.value, 10);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, MAX_MEMBER_COUNT);
}

function memberDobId(type, index, part) {
  return `member-${type}-${index}-dob-${part}`;
}

function buildSelect(id, values, selected) {
  const select = document.createElement("select");
  select.id = id;
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (selected !== undefined) select.value = selected;
  return select;
}

function dayValues() {
  const days = [];
  for (let d = 1; d <= 31; d += 1) days.push(String(d));
  return days;
}

function yearValues() {
  const years = [];
  for (let y = new Date().getFullYear(); y >= 1930; y -= 1) years.push(String(y));
  return years;
}

function captureMemberDobs() {
  for (const type of Object.keys(options.health.members)) {
    const count = getMemberCount(type);
    const list = [];
    for (let index = 0; index < count; index += 1) {
      const day = $(memberDobId(type, index, "day"));
      const month = $(memberDobId(type, index, "month"));
      const year = $(memberDobId(type, index, "year"));
      if (day && month && year) {
        list.push({ year: year.value, month: month.value, day: day.value });
      }
    }
    if (list.length > 0) memberDobCache[type] = list;
  }
}

function renderMemberDobs() {
  const container = $("health-member-dobs");
  container.innerHTML = "";
  const months = options.health.months;
  for (const [type, label] of Object.entries(options.health.members)) {
    if (!getMembers().includes(type)) continue;
    const count = getMemberCount(type);
    const savedList = memberDobCache[type] ?? [];
    const list = [];
    for (let index = 0; index < count; index += 1) {
      const saved = savedList[index] ?? DEFAULT_MEMBER_DOB;
      list.push({ ...saved });

      const field = document.createElement("div");
      field.className = "field dob";
      const title = document.createElement("label");
      title.textContent =
        count > 1 ? `${label} ${index + 1} Date of Birth` : `${label} Date of Birth`;
      field.appendChild(title);

      const row = document.createElement("div");
      row.className = "dob-row";
      row.appendChild(buildSelect(memberDobId(type, index, "day"), dayValues(), saved.day));
      row.appendChild(buildSelect(memberDobId(type, index, "month"), months, saved.month));
      row.appendChild(buildSelect(memberDobId(type, index, "year"), yearValues(), saved.year));
      field.appendChild(row);
      container.appendChild(field);
    }
    memberDobCache[type] = list;
  }
}

function getMemberConfigs() {
  captureMemberDobs();
  return getMembers().map((type) => {
    const count = getMemberCount(type);
    const dates = (memberDobCache[type] ?? []).slice(0, count).map((dob) => ({ ...dob }));
    while (dates.length < count) dates.push({ ...DEFAULT_MEMBER_DOB });
    return { type, count, dateOfBirths: dates };
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function populateOptions() {
  const car = options.car;
  const health = options.health;

  setSelect($("car-lead-type"), car.leadTypes);
  setSelect($("car-specification"), car.specifications);
  setSelect($("car-emirate"), car.emirates);
  setSelect($("car-experience"), car.drivingExperiences);
  setSelect($("car-claims"), car.claims);

  setSelect($("health-coverage"), health.coverageTypes);
  setSelect($("health-gender"), health.genders);
  setSelect($("health-emirate"), health.emirates);
  setSelect($("health-salary"), health.salaryRanges);

  fillDob("car", car.months);

  setDatalist($("car-brand"), carMakeOptions());
  setDatalist($("car-nationality"), carCountryOptions());

  // const carPresetSelect = $("car-preset");
  // carPresetSelect.innerHTML = "";
  // for (const name of Object.keys(carPresets)) {
  //   const option = document.createElement("option");
  //   option.value = name;
  //   option.textContent = name;
  //   carPresetSelect.appendChild(option);
  // }

}

function applyCarConfig(config) {
  const canonicalTransfer = "TRANSFER_OF_OWNERSHIP";
  const leadType = config.leadType === "TRANSFER_OF_OWNER_SHIP"
      && options?.car?.leadTypes?.[canonicalTransfer]
    ? canonicalTransfer
    : config.leadType;
  const nationalityValue = config.driver?.nationality ?? config.driver?.country ?? "";
  const nationality = typeof nationalityValue === "string" ? nationalityValue.trim() : "";
  $("car-lead-type").value = leadType;
  setDatalist(
    $("car-brand"),
    carMakeOptions(),
    config.vehicle.brand,
    { preserveSelection: true },
  );
  updateCarVehicleDropdowns({ preserveModel: true, preserveYear: true, preserveTrim: true });
  setDatalist(
    $("car-model"),
    carModelOptions(config.vehicle.brand),
    config.vehicle.model,
    { preserveSelection: true },
  );
  setDatalist($("car-year"), yearValues(), config.vehicle.year, { preserveSelection: true });
  const trims = unique(carVehicles()
    .filter((vehicle) => vehicle.brand === config.vehicle.brand
      && vehicle.model === config.vehicle.model
      && String(vehicle.year) === String(config.vehicle.year))
    .map((vehicle) => vehicle.trim));
  setDatalist($("car-trim"), trims, config.vehicle.trim ?? "", {
    preserveSelection: true,
  });
  $("car-specification").value = config.specification;
  $("car-emirate").value = config.emirate;
  setDatalist(
    $("car-nationality"),
    carCountryOptions(),
    nationality,
    { preserveSelection: true },
  );
  // Keep the scenario's selected country even when it is temporarily absent
  // from the asynchronously loaded country datalist.
  $("car-nationality").value = nationality;
  setDob("car", config.driver.dateOfBirth);
  $("car-experience").value = config.history.drivingExperience;
  $("car-claims").value = config.history.claims;
  $("car-email").value = config.contact.email;
  updateCarSummary();
  void loadLiveCarClaims(config.history.drivingExperience, config.history.claims);
}

function collectCarConfig() {
  return {
    leadType: $("car-lead-type").value,
    vehicle: {
      brand: $("car-brand").value,
      model: $("car-model").value,
      year: $("car-year").value,
      // Trim is optional (some vehicles have no trim step).
      trim: $("car-trim").value.trim() || null,
    },
    specification: $("car-specification").value,
    emirate: $("car-emirate").value,
    driver: {
      nationality: $("car-nationality").value,
      dateOfBirth: getDob("car"),
    },
    history: {
      drivingExperience: $("car-experience").value,
      claims: $("car-claims").value,
    },
    contact: {
      email: $("car-email").value,
    },
  };
}

function applyHealthConfig(config) {
  $("health-coverage").value = config.insureFor;
  $("health-gender").value = config.gender;
  $("health-emirate").value = config.emirate;
  $("health-salary").value = config.salaryRange;
  $("health-pregnant").value = String(config.isAnyMemberPregnant);
  $("health-medical").value = String(config.medicalCondition);

  for (const key of Object.keys(memberDobCache)) delete memberDobCache[key];
  for (const key of Object.keys(memberCounts)) delete memberCounts[key];
  for (const member of config.members) {
    memberCounts[member.type] = member.count ?? 1;
    memberDobCache[member.type] = (member.dateOfBirths ?? []).map((dob) => ({ ...dob }));
  }
  renderMembers(
    options.health.members,
    config.members.map((member) => member.type),
    memberCounts,
  );
  renderMemberDobs();
  updateHealthSummary();
}

function collectHealthConfig() {
  return {
    insureFor: $("health-coverage").value,
    gender: $("health-gender").value,
    emirate: $("health-emirate").value,
    salaryRange: $("health-salary").value,
    members: getMemberConfigs(),
    isAnyMemberPregnant: $("health-pregnant").value === "true",
    medicalCondition: $("health-medical").value === "true",
  };
}

async function request(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { ok: response.ok && data.ok !== false, data };
}

async function loadLiveCarClaims(drivingExperience, preferredClaim = "") {
  const requestId = ++carClaimsRequestId;
  const claims = $("car-claims");
  const status = $("car-claims-status");
  claims.disabled = true;
  status.textContent = "Loading claim options…";
  carClaimsLoading = (async () => {
    try {
      const query = new URLSearchParams({ drivingExperience });
      const { ok, data } = await request(`/api/car-catalog/claims?${query}`, "GET");
      if (!ok || !data.options || typeof data.options !== "object") {
        throw new Error(data.errors?.[0] ?? "Could not load claim options");
      }
      if (requestId !== carClaimsRequestId) return false;
      const selected = Object.hasOwn(data.options, preferredClaim)
        ? preferredClaim
        : Object.keys(data.options)[0];
      setSelect(claims, data.options, selected);
      claims.disabled = Object.keys(data.options).length === 0;
      status.textContent = `Options based on driving experience (up to ${data.maxNoClaimDiscountYears} claim-free years).`;
      return !claims.disabled;
    } catch (error) {
      if (requestId !== carClaimsRequestId) return false;
      claims.disabled = true;
      status.textContent = `Could not load claim options: ${String(error)}`;
      return false;
    }
  })();
  return carClaimsLoading;
}

async function openUi() {
  const button = $("open-ui");
  button.disabled = true;
  try {
    const { ok, data } = await request("/api/playwright/open", "POST");
    if (!ok) {
      showMessage("error", ["Could not open Playwright UI", ...(data.errors ?? [])]);
      return;
    }
    showMessage("ok", [
      data.started ? "Playwright UI started." : "Playwright UI was already running.",
      data.url,
    ]);
  } finally {
    button.disabled = false;
  }
}

function labelOf(map, key) {
  return map && map[key] !== undefined ? map[key] : key;
}

function updateCarSummary() {
  const el = $("car-current-config");
  if (!el || !options) return;
  const brand = $("car-brand").value || "-";
  const model = $("car-model").value || "-";
  const spec = labelOf(options.car.specifications, $("car-specification").value);
  const emirate = labelOf(options.car.emirates, $("car-emirate").value);
  el.textContent = `${brand} ${model} · ${spec} · ${emirate}`;
}

function updateHealthSummary() {
  const el = $("health-current-config");
  if (!el || !options) return;
  const gender = labelOf(options.health.genders, $("health-gender").value);
  const emirate = labelOf(options.health.emirates, $("health-emirate").value);
  const salary = labelOf(options.health.salaryRanges, $("health-salary").value);
  const members = getMembers()
    .map((type) => labelOf(options.health.members, type))
    .join(", ");
  el.textContent = `${gender} · ${emirate} · ${salary} · ${members || "no members"}`;
}

function getExecutionHeaded() {
  const checked = document.querySelector('input[name="execution-mode"]:checked');
  return checked ? checked.value === "headed" : false;
}

function applyExecutionMode(testOptions) {
  const headed = testOptions && testOptions.execution && testOptions.execution.headed === true;
  for (const radio of document.querySelectorAll('input[name="execution-mode"]')) {
    radio.checked = radio.value === (headed ? "headed" : "headless");
  }
}

async function saveTestOptions() {
  return request("/api/test-options", "PUT", { execution: { headed: getExecutionHeaded() } });
}

function mountRunbarForTab(tabName) {
  const runbar = $("runbar");
  if (tabName !== "car" && tabName !== "health") {
    runbar.hidden = true;
    return;
  }
  runbar.hidden = false;
  const actions = $(`panel-${tabName}`).querySelector(".actions");
  const runButton = $(`${tabName}-run`);
  if (actions && runButton) actions.insertBefore(runbar, runButton);
}

function renderConsole(state) {
  const section = $("console-section");
  const title = $("console-title");
  const pre = $("live-console");
  const stopButton = $("stop-test");
  const lines = (state.console && state.console.lines) || [];
  const product = (state.console && state.console.product) || null;
  stopButton.hidden = !state.running;
  stopButton.disabled = !state.running;

  if (!state.running && lines.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const name = product === "car" ? "Car" : product === "health" ? "Health" : "";
  if (state.running && state.currentScenario) {
    title.textContent = `Running scenario ${state.currentScenario.index} of ${state.currentScenario.total}: ${state.currentScenario.name}`;
  } else if (state.running && product) {
    title.textContent = `Running ${name} test...`;
  } else {
    title.textContent = name ? `${name} test output` : "Live Console";
  }

  const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
  pre.textContent = lines.join("\n");
  if (stick) pre.scrollTop = pre.scrollHeight;
}

let runPoll = null;
let latestBatchState = null;
let latestCurrentScenario = null;
const SCENARIO_RESULTS_STORAGE_KEY = "lookinsure-control-center-scenario-results";

function scenarioResultKey(product, scenario) {
  return `${product}:${JSON.stringify(scenario.config)}`;
}

function readScenarioResults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCENARIO_RESULTS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rememberBatchScenarioResults(batch) {
  if (!batch?.product || !Array.isArray(batch.results)) return;
  const results = readScenarioResults();
  let changed = false;
  for (const result of batch.results) {
    if (!result?.config || !["passed", "failed", "stopped"].includes(result.status)) continue;
    const key = scenarioResultKey(batch.product, { config: result.config });
    const previous = results[key];
    results[key] = {
      status: result.status,
      duration: result.duration,
      trackingCode: result.trackingCode,
      error: result.error,
      warning: result.warning,
      updatedAt: batch.finishedAt || previous?.updatedAt || new Date().toISOString(),
    };
    changed = true;
  }
  if (changed) {
    try {
      localStorage.setItem(SCENARIO_RESULTS_STORAGE_KEY, JSON.stringify(results));
    } catch {
      // Keep the current page usable when browser storage is unavailable.
    }
  }
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function resultRow(label, value) {
  const row = document.createElement("div");
  row.className = "result-row";
  const labelEl = document.createElement("span");
  labelEl.className = "result-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "result-value";
  valueEl.textContent = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function statusLabel(status) {
  const labels = { passed: "Passed", failed: "Failed", stopped: "Stopped", "not-run": "Not Run" };
  return labels[status] ?? status;
}

function trackingRow(value) {
  const row = document.createElement("div");
  row.className = "result-row";
  const labelEl = document.createElement("span");
  labelEl.className = "result-label";
  labelEl.textContent = "Tracking Code";
  const valueEl = document.createElement("span");
  valueEl.className = "result-value";
  valueEl.textContent = value || "—";
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  if (value) {
    const copy = document.createElement("button");
    copy.className = "copy";
    copy.textContent = "Copy";
    copy.addEventListener("click", () => {
      navigator.clipboard?.writeText(value);
      copy.textContent = "Copied";
      setTimeout(() => {
        copy.textContent = "Copy";
      }, 1200);
    });
    row.appendChild(copy);
  }
  return row;
}

function renderResult(product, state) {
  const el = $(`${product}-last-result`);
  if (!el) return;
  el.innerHTML = "";
  el.className = "result";

  if (state.running && state.target === `${product}-e2e`) {
    el.classList.add("running");
    el.appendChild(resultRow("Status", "Running..."));
    el.appendChild(resultRow("Duration", formatDuration(Date.now() - state.startedAt)));
    return;
  }

  const last = state.last && state.last.target === `${product}-e2e` ? state.last : null;
  if (!last) {
    el.textContent = "No run yet.";
    return;
  }

  el.classList.add(last.status);
  el.appendChild(resultRow("Status", statusLabel(last.status)));
  el.appendChild(resultRow("Duration", formatDuration(last.duration)));
  el.appendChild(trackingRow(last.trackingCode));
  if (last.error) el.appendChild(resultRow("Error", last.error));
  if (last.warning) el.appendChild(resultRow("Warning", last.warning));
}

function renderBatch(state) {
  latestBatchState = state.batch;
  rememberBatchScenarioResults(state.batch);
}

const RUN_CONTROL_IDS = [
  "car-run",
  "health-run",
  "api-car-happy",
  "api-car-negative",
  "api-health-happy",
  "api-health-negative",
  "car-run-all-scenarios",
  "health-run-all-scenarios",
];

function setRunButtonsDisabled(disabled) {
  for (const id of RUN_CONTROL_IDS) {
    const button = $(id);
    if (button) button.disabled = disabled;
  }
  for (const radio of document.querySelectorAll('input[name="execution-mode"]')) {
    radio.disabled = disabled;
  }
  for (const button of document.querySelectorAll(".scenario-run")) {
    button.disabled = disabled;
  }
}

async function refreshRunStatus() {
  try {
    const data = await fetch("/api/run/status").then((response) => response.json());
    renderResult("car", data);
    renderResult("health", data);
    renderApiResult(data);
    renderConsole(data);
    latestCurrentScenario = data.currentScenario;
    renderBatch(data);
    renderMainScenarios("car");
    renderMainScenarios("health");
    setRunButtonsDisabled(data.running);
    $("stop-test").disabled = !data.running;
    if (!data.running && runPoll) {
      clearInterval(runPoll);
      runPoll = null;
    }
    return data;
  } catch {
    return null;
  }
}

async function stopCurrentRun() {
  const { ok, data } = await request("/api/run/stop", "POST");
  if (!ok) {
    showMessage("error", [data.errors?.[0] ?? "Could not stop test"]);
    return;
  }
  showMessage("ok", ["Stop requested."]);
  await refreshRunStatus();
}

async function removePreviousBatchResult(index) {
  const { ok, data } = await request("/api/batch/results/remove", "POST", { index });
  if (!ok) {
    showMessage("error", [data.errors?.[0] ?? "Could not remove previous scenario"]);
    return;
  }
  showMessage("ok", ["Previous scenario result removed."]);
  await refreshRunStatus();
}

// ---- JSON editor + batch scenarios ----

let jsonModalProduct = null;
let activeEditorProduct = null;
const batchBuffers = { car: null, health: null };
const configDrafts = { car: null, health: null };
const savedScenarios = { car: [], health: [] };
const editors = { batch: null };

function initEditors() {
  if (editors.batch || typeof CodeMirror === "undefined") return;
  const common = {
    mode: { name: "javascript", json: true },
    lineNumbers: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
  };
  editors.batch = CodeMirror.fromTextArea($("batch-json"), common);
  editors.batch.on("change", () => {
    if (activeEditorProduct) renderScenarioList(activeEditorProduct);
  });
}

function editorValue() {
  if (editors.batch) return editors.batch.getValue();
  return $("batch-json").value;
}

function setEditorValue(value) {
  if (editors.batch) editors.batch.setValue(value);
  else $("batch-json").value = value;
}

function refreshEditors() {
  if (editors.batch) editors.batch.refresh();
}

function batchBufferText(product) {
  if (batchBuffers[product] == null) {
    try {
      batchBuffers[product] = localStorage.getItem(`control-center-batch-${product}`);
    } catch {
      // Continue with an empty scenario list when browser storage is unavailable.
    }
  }
  return batchBuffers[product] != null ? batchBuffers[product] : pretty({ product, scenarios: [] });
}

function readBatchBuffer(product) {
  try {
    const batch = JSON.parse(batchBufferText(product));
    return batch && typeof batch === "object" && !Array.isArray(batch) ? batch : null;
  } catch {
    return null;
  }
}

function writeBatchBuffer(product, batch) {
  batchBuffers[product] = pretty(batch);
  try {
    localStorage.setItem(`control-center-batch-${product}`, batchBuffers[product]);
  } catch {
    // The current session still works even when browser storage is unavailable.
  }
  renderScenarioList(product);
}

function renderScenarioList(product) {
  const list = $("batch-scenario-list");
  const count = $("batch-scenario-count");
  if (!list || !count || activeEditorProduct !== product) return;

  list.innerHTML = "";
  const batch = readBatchBuffer(product);
  if (!batch || !Array.isArray(batch.scenarios)) {
    count.textContent = "Fix the Batch Scenarios JSON to view its scenarios.";
    return;
  }

  count.textContent = batch.scenarios.length === 1
    ? "1 scenario"
    : `${batch.scenarios.length} scenarios`;
  if (batch.scenarios.length === 0) {
    const empty = document.createElement("span");
    empty.className = "source";
    empty.textContent = "No scenarios added.";
    list.appendChild(empty);
    return;
  }

  batch.scenarios.forEach((scenario, index) => {
    const row = document.createElement("div");
    row.className = "scenario-row";
    const name = document.createElement("span");
    name.className = "scenario-name";
    name.textContent = typeof scenario?.name === "string" && scenario.name.trim()
      ? scenario.name
      : `Scenario ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "scenario-remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${name.textContent}`);
    remove.dataset.scenarioIndex = String(index);
    const view = document.createElement("button");
    view.type = "button";
    view.className = "scenario-view";
    view.textContent = name.textContent;
    view.dataset.viewScenarioIndex = String(index);
    const run = document.createElement("button");
    run.type = "button";
    run.className = "scenario-run primary";
    run.textContent = "Run";
    run.dataset.runScenarioIndex = String(index);
    row.append(view, run, remove);
    list.appendChild(row);
  });
}

function renderMainScenarios(product) {
  const list = $(`${product}-scenario-list`);
  const count = $(`${product}-scenario-count`);
  if (!list || !count) return;
  const scenarios = savedScenarios[product];
  count.textContent = `${scenarios.length} scenario(s) saved in tools/control-center/scenarios.json`;
  list.innerHTML = "";
  scenarios.forEach((scenario, index) => {
    const row = document.createElement("div");
    row.className = "scenario-row";
    const controls = document.createElement("div");
    controls.className = "scenario-row-main";
    const view = document.createElement("button");
    view.type = "button";
    view.className = "scenario-view";
    view.textContent = scenario.name || `Scenario ${index + 1}`;
    view.dataset.mainScenarioView = String(index);
    const run = document.createElement("button");
    run.type = "button";
    run.className = "scenario-run primary";
    run.textContent = "Run";
    run.dataset.mainScenarioRun = String(index);
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "Rename";
    rename.dataset.mainScenarioRename = String(index);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "scenario-remove";
    remove.textContent = "Delete";
    remove.dataset.mainScenarioDelete = String(index);
    controls.append(view, run, rename, remove);
    row.appendChild(controls);

    const key = scenarioResultKey(product, scenario);
    const storedResult = readScenarioResults()[key];
    const currentResult = latestBatchState?.product === product
      ? latestBatchState.results?.find((result) => result.name === scenario.name
          && JSON.stringify(result.config) === JSON.stringify(scenario.config)
          && ["passed", "failed", "stopped"].includes(result.status))
      : null;
    const isRunning = latestBatchState?.status === "running"
      && latestCurrentScenario?.name === scenario.name
      && latestBatchState.product === product;
    const result = currentResult ?? storedResult;
    const details = document.createElement("div");
    details.className = `scenario-result${result ? ` ${result.status}` : isRunning ? " running" : " empty"}`;
    if (isRunning) {
      const badge = document.createElement("span");
      badge.className = "scenario-result-status";
      badge.textContent = "Running";
      details.appendChild(badge);
    } else if (result) {
      const badge = document.createElement("span");
      badge.className = "scenario-result-status";
      badge.textContent = statusLabel(result.status);
      details.appendChild(badge);

      const duration = document.createElement("span");
      duration.className = "scenario-result-meta";
      duration.textContent = `Duration: ${result.duration != null ? formatDuration(result.duration) : "—"}`;
      details.appendChild(duration);

      if (result.trackingCode) {
        const tracking = document.createElement("span");
        tracking.className = "scenario-tracking-code";
        tracking.textContent = `Tracking Code: ${result.trackingCode}`;
        details.appendChild(tracking);
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "scenario-result-copy";
        copy.textContent = "Copy";
        copy.dataset.copyTrackingCode = result.trackingCode;
        copy.setAttribute("aria-label", `Copy tracking code for ${scenario.name}`);
        details.appendChild(copy);
      }
      if (result.error) {
        const error = document.createElement("span");
        error.className = "scenario-result-error";
        error.textContent = result.error;
        details.appendChild(error);
      }
      if (result.warning) {
        const warning = document.createElement("span");
        warning.className = "scenario-result-warning";
        warning.textContent = `Warning: ${result.warning}`;
        details.appendChild(warning);
      }
      if (result.updatedAt) {
        const updated = document.createElement("span");
        updated.className = "scenario-result-time";
        updated.textContent = `Last run: ${new Date(result.updatedAt).toLocaleString()}`;
        details.appendChild(updated);
      }
    } else {
      details.textContent = "No run result yet";
    }
    row.appendChild(details);
    list.appendChild(row);
  });
}

async function loadSavedScenarios() {
  const { ok, data } = await request("/api/scenarios", "GET");
  if (!ok) throw new Error(data.errors?.[0] ?? "Could not load saved scenarios");
  savedScenarios.car = Array.isArray(data.scenarios?.car) ? data.scenarios.car : [];
  savedScenarios.health = Array.isArray(data.scenarios?.health) ? data.scenarios.health : [];
  renderMainScenarios("car");
  renderMainScenarios("health");
}

function currentConfig(product) {
  return product === "car" ? collectCarConfig() : collectHealthConfig();
}

function configForJsonDraft(product) {
  const config = deepClone(currentConfig(product));
  if (product === "car") {
    config.history.claims = options.car.claims[config.history.claims] ?? config.history.claims;
  }
  return config;
}

function normalizeScenarioConfig(product, config) {
  const normalized = deepClone(config);
  if (product === "car" && normalized.leadType === "TRANSFER_OF_OWNER_SHIP"
      && options?.car?.leadTypes?.TRANSFER_OF_OWNERSHIP) {
    normalized.leadType = "TRANSFER_OF_OWNERSHIP";
  }
  if (product === "car" && typeof normalized.history?.claims === "string") {
    const claimEntry = Object.entries(options.car.claims).find(([key, label]) =>
      key === normalized.history.claims || label.toLowerCase() === normalized.history.claims.trim().toLowerCase());
    if (claimEntry) normalized.history.claims = claimEntry[0];
  }
  return normalized;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function showJsonErrors(containerId, lines) {
  const box = $(containerId);
  if (containerId === "batch-errors" && lines && lines.length > 0) showBatchSuccess();
  if (!lines || lines.length === 0) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = "";
  box.textContent = lines[0];
  if (lines.length > 1) {
    const ul = document.createElement("ul");
    for (const line of lines.slice(1)) {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }
}

function showBatchSuccess(message = "") {
  const box = $("batch-success");
  box.textContent = message;
  box.hidden = !message;
}

function openJsonModal(product) {
  if (activeEditorProduct && activeEditorProduct !== product && editors.batch) {
    configDrafts[activeEditorProduct] = editorValue();
  }
  activeEditorProduct = product;
  jsonModalProduct = product;
  $("json-modal-title").textContent = `${product === "car" ? "Car" : "Health"} Batch Scenarios`;
  batchBufferText(product);
  setEditorValue(configDrafts[product] ?? pretty([configForJsonDraft(product)]));
  showJsonErrors("batch-errors", []);
  showBatchSuccess();
  $("json-modal").hidden = false;
  refreshEditors();
  renderScenarioList(product);
  refreshRunStatus();
}

function closeJsonModal() {
  if (activeEditorProduct) {
    configDrafts[activeEditorProduct] = editorValue();
  }
  $("json-modal").hidden = true;
  jsonModalProduct = null;
}

function formatBatchJson() {
  try {
    setEditorValue(pretty(JSON.parse(editorValue())));
    showJsonErrors("batch-errors", []);
  } catch (error) {
    showJsonErrors("batch-errors", [`Invalid JSON: ${error.message}`]);
  }
}

/** Add the editable JSON configuration to the batch scenario array. */
async function addCurrentConfigAsScenario() {
  if (!jsonModalProduct) return;
  let parsed;
  try {
    parsed = JSON.parse(editorValue());
  } catch (error) {
    showJsonErrors("batch-errors", [`Invalid JSON: ${error.message}`]);
    return;
  }

  if (parsed?.product && parsed.product !== jsonModalProduct) {
    showJsonErrors("batch-errors", [`This editor is for ${jsonModalProduct} scenarios, but the JSON product is ${parsed.product}.`]);
    return;
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.scenarios)
      ? parsed.scenarios
      : [parsed];
  if (entries.length === 0) {
    showJsonErrors("batch-errors", ["Add at least one scenario configuration."]);
    return;
  }

  const scenarios = [];
  for (const [index, entry] of entries.entries()) {
    const hasWrappedConfig = entry && typeof entry === "object" && !Array.isArray(entry) && "config" in entry;
    const rawConfig = hasWrappedConfig ? entry.config : entry;
    if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
      showJsonErrors("batch-errors", [`Scenario ${index + 1} must contain a configuration object.`]);
      return;
    }
    const config = deepClone(rawConfig);
    const name = hasWrappedConfig && typeof entry.name === "string" ? entry.name : undefined;
    scenarios.push({ name, config: normalizeScenarioConfig(jsonModalProduct, config) });
  }

  const { ok, data } = await request("/api/scenarios", "POST", {
    product: jsonModalProduct,
    scenarios,
  });
  if (!ok) {
    showJsonErrors("batch-errors", ["Could not add JSON scenarios", ...(data.errors ?? [])]);
    return;
  }
  savedScenarios.car = data.scenarios.car;
  savedScenarios.health = data.scenarios.health;
  renderMainScenarios("car");
  renderMainScenarios("health");
  showJsonErrors("batch-errors", []);
  const count = data.added?.length ?? scenarios.length;
  showBatchSuccess(`${count} JSON scenario${count === 1 ? "" : "s"} added to the scenario list.`);
}

async function pushScenario(product, config) {
  const { ok, data } = await request("/api/scenarios", "POST", { product, config: deepClone(config) });
  if (!ok) {
    const errors = data.errors ?? ["Could not save scenario"];
    if (jsonModalProduct) showJsonErrors("batch-errors", errors);
    else showMessage("error", errors);
    return null;
  }
  savedScenarios.car = data.scenarios.car;
  savedScenarios.health = data.scenarios.health;
  renderMainScenarios("car");
  renderMainScenarios("health");
  return data.scenario.name;
}

async function addFormAsScenario(product) {
  if (product === "car" && carClaimsLoading && !(await carClaimsLoading)) {
    showMessage("error", ["Wait for claim options to load before adding this scenario."]);
    return;
  }
  const config = currentConfig(product);
  const { ok, data } = await request(`/api/config/${product}/validate`, "POST", config);
  if (!ok) {
    showMessage("error", ["Current configuration is invalid", ...(data.errors ?? [])]);
    return;
  }
  const scenarioName = await pushScenario(product, config);
  if (scenarioName) showMessage("ok", [`${scenarioName} saved in the ${product} scenario list below.`]);
}

async function deleteSavedScenario(product, index) {
  const { ok, data } = await request("/api/scenarios", "DELETE", { product, index });
  if (!ok) {
    showMessage("error", data.errors ?? ["Could not delete scenario"]);
    return;
  }
  savedScenarios.car = data.scenarios.car;
  savedScenarios.health = data.scenarios.health;
  renderMainScenarios("car");
  renderMainScenarios("health");
}

function beginInlineScenarioRename(product, index, row) {
  const current = savedScenarios[product][index];
  if (!current) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "scenario-name-input";
  input.value = current.name;
  input.setAttribute("aria-label", "Scenario name");
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";
  save.className = "primary";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const saveName = async () => {
    const name = input.value.trim();
    if (!name || name === current.name) {
      renderMainScenarios(product);
      return;
    }
    save.disabled = true;
    const { ok, data } = await request("/api/scenarios", "PUT", { product, index, name });
    if (!ok) {
      save.disabled = false;
      showMessage("error", data.errors ?? ["Could not rename scenario"]);
      input.focus();
      return;
    }
    savedScenarios.car = data.scenarios.car;
    savedScenarios.health = data.scenarios.health;
    renderMainScenarios("car");
    renderMainScenarios("health");
    showMessage("ok", [`Scenario renamed to "${name}".`]);
  };
  save.addEventListener("click", saveName);
  cancel.addEventListener("click", () => renderMainScenarios(product));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void saveName();
    if (event.key === "Escape") renderMainScenarios(product);
  });
  row.querySelector("button[data-main-scenario-view]")?.replaceWith(input);
  row.querySelector("button[data-main-scenario-rename]")?.replaceWith(save);
  row.querySelector("button[data-main-scenario-delete]")?.replaceWith(cancel);
  input.focus();
  input.select();
}

async function renameSavedScenario(product, index, row) {
  if (!row) return;
  beginInlineScenarioRename(product, index, row);
}

function showSavedScenario(product, index) {
  const scenario = savedScenarios[product][index];
  if (!scenario) return;
  if (product === "car") applyCarConfig(scenario.config);
  else applyHealthConfig(scenario.config);
  updateCarSummary();
  updateHealthSummary();
  clearMessage();
}

async function runAllSavedScenarios(product) {
  const scenarios = savedScenarios[product];
  if (!scenarios.length) {
    showMessage("error", [`No ${product} scenarios have been saved.`]);
    return;
  }
  const validation = await request("/api/batch/validate", "POST", { product, scenarios });
  if (!validation.ok) {
    showMessage("error", validation.data.errors ?? ["Scenario validation failed"]);
    return;
  }
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showMessage("error", testOptions.data.errors ?? ["Could not save execution mode"]);
    return;
  }
  const result = await request("/api/batch/run", "POST", { product, scenarios });
  if (!result.ok) {
    showMessage("error", result.data.errors ?? ["Could not start scenarios"]);
    return;
  }
  setRunButtonsDisabled(true);
  if (!runPoll) runPoll = setInterval(refreshRunStatus, 1000);
  await refreshRunStatus();
}

function removeBatchScenario(index) {
  if (!activeEditorProduct) return;
  const batch = readBatchBuffer(activeEditorProduct);
  if (!batch || !Array.isArray(batch.scenarios) || index < 0 || index >= batch.scenarios.length) return;
  const [removed] = batch.scenarios.splice(index, 1);
  writeBatchBuffer(activeEditorProduct, batch);
  showJsonErrors("batch-errors", []);
  showBatchSuccess(`${removed?.name ?? `Scenario ${index + 1}`} removed.`);
}

function showScenarioConfig(index) {
  if (!activeEditorProduct) return;
  const batch = readBatchBuffer(activeEditorProduct);
  const scenario = batch?.scenarios?.[index];
  if (!scenario?.config) return;
  setEditorValue(pretty(scenario.config));
  configDrafts[activeEditorProduct] = editorValue();
  showJsonErrors("batch-errors", []);
  showBatchSuccess(`${scenario.name ?? `Scenario ${index + 1}`} configuration loaded for viewing.`);
}

function showBatchResultConfig(index) {
  const scenario = latestBatchState?.results?.[index];
  if (!scenario?.config || !latestBatchState?.product) return;
  const product = latestBatchState.product;
  const config = deepClone(scenario.config);
  if (product === "car" && typeof config.history?.claims === "string") {
    config.history.claims = options.car.claims[config.history.claims] ?? config.history.claims;
  }
  activeEditorProduct = product;
  jsonModalProduct = product;
  $("json-modal-title").textContent = `${product === "car" ? "Car" : "Health"} Batch Scenarios`;
  setEditorValue(pretty(config));
  configDrafts[product] = editorValue();
  $("json-modal").hidden = false;
  refreshEditors();
  showJsonErrors("batch-errors", []);
  showBatchSuccess(`${scenario.name} configuration loaded for viewing.`);
  renderScenarioList(product);
}

async function validateBatchJson() {
  if (!jsonModalProduct) return null;
  const batch = readBatchBuffer(jsonModalProduct);
  if (!batch || !Array.isArray(batch.scenarios)) {
    showJsonErrors("batch-errors", ["Scenario list is invalid. Add at least one valid JSON configuration first."]);
    return null;
  }
  const scenarios = batch.scenarios;
  const { ok, data } = await request("/api/batch/validate", "POST", {
    product: jsonModalProduct,
    scenarios,
  });
  if (!ok) {
    showJsonErrors("batch-errors", ["Batch validation failed", ...(data.errors ?? [])]);
    return null;
  }
  showJsonErrors("batch-errors", []);
  return { ...batch, scenarios };
}

async function runBatchJson() {
  const parsed = await validateBatchJson();
  if (!parsed) return;

  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    if (jsonModalProduct) showJsonErrors("batch-errors", ["Could not save execution mode", ...(testOptions.data.errors ?? [])]);
    else showMessage("error", ["Could not save execution mode", ...(testOptions.data.errors ?? [])]);
    return;
  }

  const { ok, data } = await request("/api/batch/run", "POST", {
    product: jsonModalProduct,
    scenarios: parsed.scenarios,
  });
  if (!ok) {
    showJsonErrors("batch-errors", ["Could not start batch", ...(data.errors ?? [])]);
    return;
  }
  setRunButtonsDisabled(true);
  if (!runPoll) runPoll = setInterval(refreshRunStatus, 1000);
  await refreshRunStatus();
}

async function runOneScenario(product, index) {
  const scenario = savedScenarios[product]?.[index];
  if (!scenario) return;
  await runScenarioDefinition(product, scenario);
}

async function runScenarioDefinition(product, scenario) {
  const { ok, data } = await request("/api/batch/validate", "POST", {
    product,
    scenarios: [scenario],
  });
  if (!ok) {
    if (jsonModalProduct) showJsonErrors("batch-errors", ["Scenario validation failed", ...(data.errors ?? [])]);
    else showMessage("error", ["Scenario validation failed", ...(data.errors ?? [])]);
    return;
  }
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showJsonErrors("batch-errors", ["Could not save execution mode", ...(testOptions.data.errors ?? [])]);
    return;
  }
  const result = await request("/api/batch/run", "POST", {
    product,
    scenarios: [scenario],
  });
  if (!result.ok) {
    if (jsonModalProduct) showJsonErrors("batch-errors", ["Could not start scenario", ...(result.data.errors ?? [])]);
    else showMessage("error", ["Could not start scenario", ...(result.data.errors ?? [])]);
    return;
  }
  if (jsonModalProduct) {
    showJsonErrors("batch-errors", []);
    showBatchSuccess(`${scenario.name ?? "Scenario"} started.`);
  } else {
    showMessage("ok", [`${scenario.name ?? "Scenario"} started.`]);
  }
  setRunButtonsDisabled(true);
  if (!runPoll) runPoll = setInterval(refreshRunStatus, 1000);
  await refreshRunStatus();
}

const API_TARGETS = {
  "car-api-happy": "Car API Happy Path",
  "car-api-negative": "Car API Negative",
  "health-api-happy": "Health API Happy Path",
  "health-api-negative": "Health API Negative",
};

function renderApiResult(state) {
  const el = $("api-last-result");
  if (!el) return;
  el.innerHTML = "";
  el.className = "result";

  if (state.running && state.mode === "api") {
    el.classList.add("running");
    el.appendChild(resultRow("Status", "Running..."));
    el.appendChild(resultRow("Duration", formatDuration(Date.now() - state.startedAt)));
    el.appendChild(resultRow("Target", API_TARGETS[state.target] ?? state.target ?? ""));
    return;
  }

  const last = state.last && state.last.mode === "api" ? state.last : null;
  if (!last) {
    el.textContent = "No API run yet.";
    return;
  }

  el.classList.add(last.status);
  el.appendChild(resultRow("Target", API_TARGETS[last.target] ?? last.target));
  el.appendChild(resultRow("Status", statusLabel(last.status)));
  el.appendChild(resultRow("Duration", formatDuration(last.duration)));
  if (last.summary) {
    el.appendChild(resultRow("Passed", String(last.summary.passed)));
    el.appendChild(resultRow("Failed", String(last.summary.failed)));
    el.appendChild(resultRow("Skipped", String(last.summary.skipped)));
  }
  if (last.trackingCode) el.appendChild(trackingRow(last.trackingCode));
  if (last.error) el.appendChild(resultRow("Error", last.error));
}

async function startRun(target) {
  clearMessage();

  if (target.startsWith("car-")) {
    if (carClaimsLoading && !(await carClaimsLoading)) {
      showMessage("error", ["Could not start the test because claim options are unavailable."]);
      return;
    }
    if ($("car-claims").disabled) {
      showMessage("error", ["Wait for claim options to load before starting the test."]);
      return;
    }
  }

  // Persist the currently selected execution mode first, so E2E Run always
  // honors it even without Save. API runs ignore it (no browser).
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showMessage("error", [
      "Could not save execution mode",
      ...(testOptions.data.errors ?? []),
    ]);
    return;
  }

  const body = { target };
  if (target.startsWith("car-")) body.config = collectCarConfig();
  if (target.startsWith("health-")) body.config = collectHealthConfig();
  const { ok, data } = await request("/api/run", "POST", body);
  if (!ok) {
    showMessage("error", [data.errors?.[0] ?? `Could not start ${target}`]);
    return;
  }
  setRunButtonsDisabled(true);
  if (!runPoll) runPoll = setInterval(refreshRunStatus, 1000);
  await refreshRunStatus();
}

function wireEvents() {
  mountRunbarForTab(document.querySelector(".tab.active")?.dataset.tab ?? "car");

  for (const id of ["car-brand", "car-model", "car-year", "car-trim", "car-nationality"]) {
    $(id).addEventListener("click", (event) => {
      try {
        event.currentTarget.showPicker();
      } catch {
        // Typing still filters the native datalist on browsers without showPicker support.
      }
    });
  }

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      clearMessage();
      for (const other of document.querySelectorAll(".tab")) other.classList.remove("active");
      for (const panel of document.querySelectorAll(".panel")) panel.classList.remove("active");
      tab.classList.add("active");
      $(`panel-${tab.dataset.tab}`).classList.add("active");
      mountRunbarForTab(tab.dataset.tab);
    });
  }

  // $("car-preset").addEventListener("change", (event) => {
  //   applyCarConfig(carPresets[event.target.value]);
  // });

  $("panel-car").addEventListener("input", updateCarSummary);
  $("car-brand").addEventListener("change", () => {
    updateCarVehicleDropdowns();
    updateCarSummary();
    if (liveCarMakes !== null) {
      void loadLiveCarModels($("car-brand").value).catch((error) => {
        $("car-catalog-status").textContent = String(error);
      });
    }
  });
  $("car-nationality").addEventListener("input", () => {
    clearTimeout(carCountrySearchTimer);
    const term = $("car-nationality").value.trim();
    if (term.length < 2) {
      setDatalist($("car-nationality"), carCountryOptions(), term, { preserveSelection: true });
      return;
    }
    carCountrySearchTimer = setTimeout(async () => {
      const { ok, data } = await request(`/api/car-catalog/countries?searchTerm=${encodeURIComponent(term)}`, "GET");
      if (!ok || !Array.isArray(data.options)) return;
      const countries = data.options
        .filter((country) => country && typeof country.name === "string")
        .map((country) => country.name);
      if (countries.length) setDatalist($("car-nationality"), countries, term);
    }, 250);
  });
  $("car-model").addEventListener("change", () => {
    updateCarVehicleDropdowns({ preserveModel: true });
    updateCarSummary();
    if (liveCarMakes !== null) {
      void loadLiveCarTrims().catch((error) => {
        $("car-catalog-status").textContent = String(error);
      });
    }
  });
  $("car-year").addEventListener("change", () => {
    updateCarVehicleDropdowns({ preserveModel: true, preserveYear: true });
    if (liveCarMakes !== null) {
      void loadLiveCarTrims().catch((error) => {
        $("car-catalog-status").textContent = String(error);
      });
    }
  });
  $("panel-car").addEventListener("change", updateCarSummary);
  $("car-experience").addEventListener("change", () => {
    void loadLiveCarClaims($("car-experience").value, $("car-claims").value);
  });
  $("panel-health").addEventListener("input", updateHealthSummary);
  $("panel-health").addEventListener("change", updateHealthSummary);

  $("car-add-form-scenario").addEventListener("click", () => addFormAsScenario("car"));
  $("health-add-form-scenario").addEventListener("click", () => addFormAsScenario("health"));
  $("open-ui").addEventListener("click", openUi);
  $("car-run").addEventListener("click", () => startRun("car-e2e"));
  $("health-run").addEventListener("click", () => startRun("health-e2e"));
  $("api-car-happy").addEventListener("click", () => startRun("car-api-happy"));
  $("api-car-negative").addEventListener("click", () => startRun("car-api-negative"));
  $("api-health-happy").addEventListener("click", () => startRun("health-api-happy"));
  $("api-health-negative").addEventListener("click", () => startRun("health-api-negative"));
  $("stop-test").addEventListener("click", stopCurrentRun);
  $("car-run-all-scenarios").addEventListener("click", () => runAllSavedScenarios("car"));
  $("health-run-all-scenarios").addEventListener("click", () => runAllSavedScenarios("health"));

  for (const product of ["car", "health"]) {
    $(`${product}-scenario-list`).addEventListener("click", (event) => {
      const copyCode = event.target.closest("button[data-copy-tracking-code]");
      if (copyCode) {
        navigator.clipboard?.writeText(copyCode.dataset.copyTrackingCode);
        copyCode.textContent = "Copied";
        setTimeout(() => { copyCode.textContent = "Copy"; }, 1200);
        return;
      }
      const view = event.target.closest("button[data-main-scenario-view]");
      if (view) return showSavedScenario(product, Number(view.dataset.mainScenarioView));
      const run = event.target.closest("button[data-main-scenario-run]");
      if (run) return void runOneScenario(product, Number(run.dataset.mainScenarioRun));
      const rename = event.target.closest("button[data-main-scenario-rename]");
      if (rename) return void renameSavedScenario(product, Number(rename.dataset.mainScenarioRename), rename.closest(".scenario-row"));
      const remove = event.target.closest("button[data-main-scenario-delete]");
      if (remove) return void deleteSavedScenario(product, Number(remove.dataset.mainScenarioDelete));
    });
  }


  $("car-json").addEventListener("click", () => openJsonModal("car"));
  $("health-json").addEventListener("click", () => openJsonModal("health"));
  $("json-close").addEventListener("click", closeJsonModal);
  $("batch-format").addEventListener("click", formatBatchJson);
  $("batch-add-current").addEventListener("click", addCurrentConfigAsScenario);
}

async function init() {
  try {
    const [optionsData, carData, healthData, testOptionsData] = await Promise.all([
      fetch("/api/options").then((r) => r.json()),
      fetch("/api/config/car").then((r) => r.json()),
      fetch("/api/config/health").then((r) => r.json()),
      fetch("/api/test-options").then((r) => r.json()),
    ]);
    options = optionsData;
    carPresets = options.car.presets;

    populateOptions();
    applyExecutionMode(testOptionsData.options);
    applyCarConfig(carData.config);
    applyHealthConfig(healthData.config);
    initEditors();
    wireEvents();
    await loadSavedScenarios();
    void loadLiveCarCatalog();
    await refreshRunStatus();
  } catch (error) {
    showMessage("error", ["Failed to load Control Center data", String(error)]);
  }
}

init();
