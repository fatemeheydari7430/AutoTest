const $ = (id) => document.getElementById(id);

let options = null;
let carPresets = {};
let healthPresets = {};

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

function fillDatalist(id, values) {
  const list = $(id);
  list.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    list.appendChild(option);
  }
}

const carLookup = {
  countriesLoaded: false,
};

function setLookupStatus(text) {
  $("car-lookup-status").textContent = text ?? "";
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error((data.errors && data.errors[0]) || `Request failed (${response.status})`);
  }
  return data;
}

async function loadCarCountries() {
  if (carLookup.countriesLoaded) return;
  setLookupStatus("Loading nationalities…");
  try {
    const data = await getJson("/api/lookups/car/countries");
    const values = data.items.map((item) => item.value);
    if (values.length === 0) {
      // Keep the preset-seeded values so the saved selection is never lost.
      setLookupStatus("Country lookup returned no names; keeping preset values.");
      carLookup.countriesLoaded = true;
      return;
    }
    fillDatalist("car-nationalities", values);
    carLookup.countriesLoaded = true;
    setLookupStatus("");
  } catch (error) {
    setLookupStatus(`Could not load nationalities from API: ${error.message}`);
  }
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
const DEFAULT_MEMBER_DOB = { day: "15", month: "June", year: "1995" };

function renderMembers(map, selected) {
  const container = $("health-members");
  container.innerHTML = "";
  for (const [key, label] of Object.entries(map)) {
    const wrapper = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = key;
    checkbox.checked = selected.includes(key);
    checkbox.addEventListener("change", () => {
      captureMemberDobs();
      renderMemberDobs();
    });
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(label));
    container.appendChild(wrapper);
  }
}

function getMembers() {
  return [...document.querySelectorAll("#health-members input:checked")].map((el) => el.value);
}

function memberDobId(type, part) {
  return `member-${type}-dob-${part}`;
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
    const day = $(memberDobId(type, "day"));
    const month = $(memberDobId(type, "month"));
    const year = $(memberDobId(type, "year"));
    if (day && month && year) {
      memberDobCache[type] = { day: day.value, month: month.value, year: year.value };
    }
  }
}

function renderMemberDobs() {
  const container = $("health-member-dobs");
  container.innerHTML = "";
  const months = options.health.months;
  for (const [type, label] of Object.entries(options.health.members)) {
    if (!getMembers().includes(type)) continue;
    const saved = memberDobCache[type] ?? DEFAULT_MEMBER_DOB;
    memberDobCache[type] = { ...saved };

    const field = document.createElement("div");
    field.className = "field dob";
    const title = document.createElement("label");
    title.textContent = `${label} Date of Birth`;
    field.appendChild(title);

    const row = document.createElement("div");
    row.className = "dob-row";
    row.appendChild(buildSelect(memberDobId(type, "day"), dayValues(), saved.day));
    row.appendChild(buildSelect(memberDobId(type, "month"), months, saved.month));
    row.appendChild(buildSelect(memberDobId(type, "year"), yearValues(), saved.year));
    field.appendChild(row);
    container.appendChild(field);
  }
}

function getMemberConfigs() {
  captureMemberDobs();
  return getMembers().map((type) => ({
    type,
    dateOfBirth: memberDobCache[type] ?? { ...DEFAULT_MEMBER_DOB },
  }));
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

  // Seed from presets so saved values render before the real API responds;
  // these lists are replaced by live lookups when the fields are used.
  fillDatalist("car-brands", gather(carPresets, (p) => p.vehicle.brand));
  fillDatalist("car-models", gather(carPresets, (p) => p.vehicle.model));
  fillDatalist("car-years", yearValues());
  fillDatalist("car-trims", gather(carPresets, (p) => p.vehicle.trim));
  fillDatalist("car-nationalities", gather(carPresets, (p) => p.driver.nationality));

  const carPresetSelect = $("car-preset");
  carPresetSelect.innerHTML = "";
  for (const name of Object.keys(carPresets)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    carPresetSelect.appendChild(option);
  }

  const healthPresetSelect = $("health-preset");
  healthPresetSelect.innerHTML = "";
  for (const name of Object.keys(healthPresets)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    healthPresetSelect.appendChild(option);
  }
}

function applyCarConfig(config) {
  $("car-lead-type").value = config.leadType;
  $("car-brand").value = config.vehicle.brand;
  $("car-model").value = config.vehicle.model;
  $("car-year").value = config.vehicle.year;
  $("car-trim").value = config.vehicle.trim;
  $("car-specification").value = config.specification;
  $("car-emirate").value = config.emirate;
  $("car-nationality").value = config.driver.nationality;
  setDob("car", config.driver.dateOfBirth);
  $("car-experience").value = config.history.drivingExperience;
  $("car-claims").value = config.history.claims;
  $("car-email").value = config.contact.email;
  updateCarSummary();
}

function collectCarConfig() {
  return {
    leadType: $("car-lead-type").value,
    vehicle: {
      brand: $("car-brand").value,
      model: $("car-model").value,
      year: $("car-year").value,
      trim: $("car-trim").value,
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
  for (const member of config.members) {
    memberDobCache[member.type] = { ...member.dateOfBirth };
  }
  renderMembers(options.health.members, config.members.map((member) => member.type));
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

async function saveCar() {
  const { ok, data } = await request("/api/config/car", "PUT", collectCarConfig());
  if (!ok) {
    showMessage("error", ["Car settings not saved", ...(data.errors ?? [])]);
    return;
  }
  applyCarConfig(data.config);
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showMessage("error", [
      "Car settings saved, but execution mode was not saved",
      ...(testOptions.data.errors ?? []),
    ]);
    return;
  }
  $("car-source").textContent = "Active source: runtime";
  showMessage("ok", ["Car settings saved to runtime config."]);
}

async function saveHealth() {
  const { ok, data } = await request("/api/config/health", "PUT", collectHealthConfig());
  if (!ok) {
    showMessage("error", ["Health settings not saved", ...(data.errors ?? [])]);
    return;
  }
  applyHealthConfig(data.config);
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showMessage("error", [
      "Health settings saved, but execution mode was not saved",
      ...(testOptions.data.errors ?? []),
    ]);
    return;
  }
  $("health-source").textContent = "Active source: runtime";
  showMessage("ok", ["Health settings saved to runtime config."]);
}

async function resetCar() {
  const { ok, data } = await request("/api/config/car/reset", "POST");
  if (!ok) {
    showMessage("error", ["Car reset failed", ...(data.errors ?? [])]);
    return;
  }
  applyCarConfig(data.config);
  $("car-preset").value = "default";
  $("car-source").textContent = "Active source: runtime";
  showMessage("ok", ["Car config reset to default preset."]);
}

async function resetHealth() {
  const { ok, data } = await request("/api/config/health/reset", "POST");
  if (!ok) {
    showMessage("error", ["Health reset failed", ...(data.errors ?? [])]);
    return;
  }
  applyHealthConfig(data.config);
  $("health-preset").value = "default";
  $("health-source").textContent = "Active source: runtime";
  showMessage("ok", ["Health config reset to default preset."]);
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

function renderConsole(state) {
  const section = $("console-section");
  const title = $("console-title");
  const pre = $("live-console");
  const lines = (state.console && state.console.lines) || [];
  const product = (state.console && state.console.product) || null;

  if (!state.running && lines.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const name = product === "car" ? "Car" : product === "health" ? "Health" : "";
  title.textContent =
    state.running && product ? `Running ${name} test...` : name ? `${name} test output` : "Live Console";

  const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
  pre.textContent = lines.join("\n");
  if (stick) pre.scrollTop = pre.scrollHeight;
}

let runPoll = null;

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

function renderResult(product, state) {
  const el = $(`${product}-last-result`);
  if (!el) return;
  el.innerHTML = "";
  el.className = "result";

  if (state.running && state.product === product) {
    el.classList.add("running");
    el.appendChild(resultRow("Status", "Running..."));
    el.appendChild(resultRow("Duration", formatDuration(Date.now() - state.startedAt)));
    return;
  }

  const last = state.last && state.last.product === product ? state.last : null;
  if (!last) {
    el.textContent = "No run yet.";
    return;
  }

  el.classList.add(last.status);
  el.appendChild(resultRow("Status", last.status === "passed" ? "Passed" : "Failed"));
  el.appendChild(resultRow("Duration", formatDuration(last.duration)));
  if (last.error) el.appendChild(resultRow("Error", last.error));
}

const RUN_CONTROL_IDS = [
  "run-car-top",
  "run-health-top",
  "car-run",
  "health-run",
  "car-save",
  "car-reset",
  "health-save",
  "health-reset",
];

function setRunButtonsDisabled(disabled) {
  for (const id of RUN_CONTROL_IDS) {
    const button = $(id);
    if (button) button.disabled = disabled;
  }
  for (const radio of document.querySelectorAll('input[name="execution-mode"]')) {
    radio.disabled = disabled;
  }
}

async function refreshRunStatus() {
  try {
    const data = await fetch("/api/run/status").then((response) => response.json());
    renderResult("car", data);
    renderResult("health", data);
    renderConsole(data);
    if (!data.running) {
      setRunButtonsDisabled(false);
      if (runPoll) {
        clearInterval(runPoll);
        runPoll = null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function startRun(product) {
  clearMessage();

  // Persist the currently selected execution mode first, so Run always honors
  // it even if the user did not press Save after toggling the radio.
  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showMessage("error", [
      "Could not save execution mode",
      ...(testOptions.data.errors ?? []),
    ]);
    return;
  }

  const { ok, data } = await request("/api/run", "POST", { product });
  if (!ok) {
    showMessage("error", [data.errors?.[0] ?? `Could not start ${product} test`]);
    return;
  }
  setRunButtonsDisabled(true);
  if (!runPoll) runPoll = setInterval(refreshRunStatus, 1000);
  await refreshRunStatus();
}

function wireEvents() {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      clearMessage();
      for (const other of document.querySelectorAll(".tab")) other.classList.remove("active");
      for (const panel of document.querySelectorAll(".panel")) panel.classList.remove("active");
      tab.classList.add("active");
      $(`panel-${tab.dataset.tab}`).classList.add("active");
    });
  }

  $("car-preset").addEventListener("change", (event) => {
    applyCarConfig(carPresets[event.target.value]);
  });
  $("health-preset").addEventListener("change", (event) => {
    applyHealthConfig(healthPresets[event.target.value]);
  });

  $("car-nationality").addEventListener("focus", loadCarCountries);
  $("car-nationality").addEventListener("input", loadCarCountries);

  $("panel-car").addEventListener("input", updateCarSummary);
  $("panel-car").addEventListener("change", updateCarSummary);
  $("panel-health").addEventListener("input", updateHealthSummary);
  $("panel-health").addEventListener("change", updateHealthSummary);

  $("car-save").addEventListener("click", saveCar);
  $("car-reset").addEventListener("click", resetCar);
  $("health-save").addEventListener("click", saveHealth);
  $("health-reset").addEventListener("click", resetHealth);
  $("open-ui").addEventListener("click", openUi);
  $("car-run").addEventListener("click", () => startRun("car"));
  $("health-run").addEventListener("click", () => startRun("health"));
  $("run-car-top").addEventListener("click", () => startRun("car"));
  $("run-health-top").addEventListener("click", () => startRun("health"));
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
    healthPresets = options.health.presets;

    populateOptions();
    applyExecutionMode(testOptionsData.options);
    applyCarConfig(carData.config);
    applyHealthConfig(healthData.config);
    $("car-source").textContent = `Active source: ${carData.source}`;
    $("health-source").textContent = `Active source: ${healthData.source}`;
    wireEvents();
    await refreshRunStatus();
  } catch (error) {
    showMessage("error", ["Failed to load Control Center data", String(error)]);
  }
}

init();
