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
  $("car-trim").value = config.vehicle.trim ?? "";
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
  configBuffers.car = null;
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
  configBuffers.health = null;
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

function batchStatusLabel(status) {
  const labels = { running: "Running", completed: "Completed", stopped: "Stopped", failed: "Failed" };
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
}

function renderBatch(state) {
  const progress = $("batch-progress");
  const table = $("batch-table");
  const body = $("batch-table-body");
  if (!progress || !table || !body) return;

  const batch = state.batch;
  if (!batch) {
    progress.textContent = "No batch has been run.";
    table.hidden = true;
    body.innerHTML = "";
    return;
  }

  progress.textContent =
    batch.status === "running" && state.currentScenario
      ? `Running scenario ${state.currentScenario.index} of ${state.currentScenario.total}: ${state.currentScenario.name}`
      : `Batch ${batchStatusLabel(batch.status)} — ${batch.results.length} scenario(s)`;

  table.hidden = false;
  body.innerHTML = "";
  for (const result of batch.results) {
    const tr = document.createElement("tr");
    tr.className = result.status;
    const cells = [
      result.name,
      statusLabel(result.status),
      result.duration != null ? formatDuration(result.duration) : "—",
      result.trackingCode || "—",
    ];
    for (const cell of cells) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
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
  "api-car-happy",
  "api-car-negative",
  "api-health-happy",
  "api-health-negative",
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
    renderApiResult(data);
    renderConsole(data);
    renderBatch(data);
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

// ---- JSON editor + batch scenarios ----

let jsonModalProduct = null;
let activeEditorProduct = null;
const configBuffers = { car: null, health: null };
const batchBuffers = { car: null, health: null };
const editors = { config: null, batch: null };

function initEditors() {
  if (editors.config || typeof CodeMirror === "undefined") return;
  const common = {
    mode: { name: "javascript", json: true },
    lineNumbers: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
  };
  editors.config = CodeMirror.fromTextArea($("config-json"), common);
  editors.batch = CodeMirror.fromTextArea($("batch-json"), common);
}

function editorValue(which) {
  if (editors[which]) return editors[which].getValue();
  return $(which === "config" ? "config-json" : "batch-json").value;
}

function setEditorValue(which, value) {
  if (editors[which]) editors[which].setValue(value);
  else $(which === "config" ? "config-json" : "batch-json").value = value;
}

function refreshEditors() {
  if (editors.config) editors.config.refresh();
  if (editors.batch) editors.batch.refresh();
}

function configBufferText(product) {
  return configBuffers[product] != null ? configBuffers[product] : pretty(currentConfig(product));
}

function batchBufferText(product) {
  return batchBuffers[product] != null ? batchBuffers[product] : pretty({ product, scenarios: [] });
}

function readBatchBuffer(product) {
  try {
    return JSON.parse(batchBufferText(product));
  } catch {
    return { product, scenarios: [] };
  }
}

function writeBatchBuffer(product, batch) {
  batchBuffers[product] = pretty(batch);
  if (activeEditorProduct === product && editors.batch) {
    editors.batch.setValue(batchBuffers[product]);
  }
}

function currentConfig(product) {
  return product === "car" ? collectCarConfig() : collectHealthConfig();
}

function applyConfigToForm(product, config) {
  if (product === "car") applyCarConfig(config);
  else applyHealthConfig(config);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function showJsonErrors(containerId, lines) {
  const box = $(containerId);
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

function openJsonModal(product) {
  // Preserve unsaved buffers when switching between products.
  if (activeEditorProduct && activeEditorProduct !== product) {
    configBuffers[activeEditorProduct] = editorValue("config");
    batchBuffers[activeEditorProduct] = editorValue("batch");
  }
  activeEditorProduct = product;
  jsonModalProduct = product;
  $("json-modal-title").textContent = `${product === "car" ? "Car" : "Health"} Configuration JSON`;
  setEditorValue("config", configBufferText(product));
  setEditorValue("batch", batchBufferText(product));
  showJsonErrors("json-errors", []);
  showJsonErrors("batch-errors", []);
  $("json-modal").hidden = false;
  refreshEditors();
  refreshRunStatus();
}

function closeJsonModal() {
  if (activeEditorProduct) {
    configBuffers[activeEditorProduct] = editorValue("config");
    batchBuffers[activeEditorProduct] = editorValue("batch");
  }
  $("json-modal").hidden = true;
  jsonModalProduct = null;
}

function reloadConfigFromForm() {
  if (!jsonModalProduct) return;
  configBuffers[jsonModalProduct] = null;
  setEditorValue("config", pretty(currentConfig(jsonModalProduct)));
  showJsonErrors("json-errors", []);
}

function formatEditor(which, errorsId) {
  try {
    setEditorValue(which, pretty(JSON.parse(editorValue(which))));
    showJsonErrors(errorsId, []);
  } catch (error) {
    showJsonErrors(errorsId, [`Invalid JSON: ${error.message}`]);
  }
}

async function validateConfigJson() {
  if (!jsonModalProduct) return null;
  let parsed;
  try {
    parsed = JSON.parse(editorValue("config"));
  } catch (error) {
    showJsonErrors("json-errors", [`Invalid JSON: ${error.message}`]);
    return null;
  }
  const { ok, data } = await request(`/api/config/${jsonModalProduct}/validate`, "POST", parsed);
  if (!ok) {
    showJsonErrors("json-errors", ["Validation failed", ...(data.errors ?? [])]);
    return null;
  }
  showJsonErrors("json-errors", []);
  return parsed;
}

async function applyConfigJson() {
  const parsed = await validateConfigJson();
  if (!parsed) return;
  applyConfigToForm(jsonModalProduct, parsed);
  closeJsonModal();
  showMessage("ok", ["JSON applied to the form. Click Save Configuration to persist."]);
}

/** JSON View source: builds a scenario from the editor buffer (with validation). */
async function addJsonAsScenario() {
  if (!jsonModalProduct) return;
  const parsed = await validateConfigJson();
  if (!parsed) return;
  pushScenario(jsonModalProduct, parsed);
  showJsonErrors("batch-errors", []);
}

/** Form View source: builds a scenario from the live form (validated). */
async function addFormAsScenario(product) {
  const { ok, data } = await request(`/api/config/${product}/validate`, "POST", currentConfig(product));
  if (!ok) {
    showMessage("error", ["Current configuration is invalid", ...(data.errors ?? [])]);
    return;
  }
  pushScenario(product, currentConfig(product));
  showMessage("ok", ["Current form configuration added as a scenario."]);
}

function pushScenario(product, config) {
  const batch = readBatchBuffer(product);
  if (batch.product && batch.product !== product) {
    showJsonErrors("batch-errors", [`Batch product must be "${product}"`]);
    return;
  }
  batch.product = product;
  if (!Array.isArray(batch.scenarios)) batch.scenarios = [];
  // Deep clone so scenario edits and the source (form or editor) never share refs.
  batch.scenarios.push({
    name: `Scenario ${batch.scenarios.length + 1}`,
    config: deepClone(config),
  });
  writeBatchBuffer(product, batch);
}

async function validateBatchJson() {
  if (!jsonModalProduct) return null;
  let parsed;
  try {
    parsed = JSON.parse(editorValue("batch"));
  } catch (error) {
    showJsonErrors("batch-errors", [`Invalid JSON: ${error.message}`]);
    return null;
  }
  if (parsed.product && parsed.product !== jsonModalProduct) {
    showJsonErrors("batch-errors", [`Batch product must be "${jsonModalProduct}"`]);
    return null;
  }
  const { ok, data } = await request("/api/batch/validate", "POST", {
    product: jsonModalProduct,
    scenarios: parsed.scenarios,
  });
  if (!ok) {
    showJsonErrors("batch-errors", ["Batch validation failed", ...(data.errors ?? [])]);
    return null;
  }
  showJsonErrors("batch-errors", []);
  return parsed;
}

async function runBatchJson() {
  const parsed = await validateBatchJson();
  if (!parsed) return;

  const testOptions = await saveTestOptions();
  if (!testOptions.ok) {
    showJsonErrors("batch-errors", ["Could not save execution mode", ...(testOptions.data.errors ?? [])]);
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

  const { ok, data } = await request("/api/run", "POST", { target });
  if (!ok) {
    showMessage("error", [data.errors?.[0] ?? `Could not start ${target}`]);
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
    configBuffers.car = null;
  });
  $("health-preset").addEventListener("change", (event) => {
    applyHealthConfig(healthPresets[event.target.value]);
    configBuffers.health = null;
  });

  $("panel-car").addEventListener("input", updateCarSummary);
  $("panel-car").addEventListener("change", updateCarSummary);
  $("panel-health").addEventListener("input", updateHealthSummary);
  $("panel-health").addEventListener("change", updateHealthSummary);

  $("car-save").addEventListener("click", saveCar);
  $("car-reset").addEventListener("click", resetCar);
  $("health-save").addEventListener("click", saveHealth);
  $("health-reset").addEventListener("click", resetHealth);
  $("open-ui").addEventListener("click", openUi);
  $("car-run").addEventListener("click", () => startRun("car-e2e"));
  $("health-run").addEventListener("click", () => startRun("health-e2e"));
  $("run-car-top").addEventListener("click", () => startRun("car-e2e"));
  $("run-health-top").addEventListener("click", () => startRun("health-e2e"));
  $("api-car-happy").addEventListener("click", () => startRun("car-api-happy"));
  $("api-car-negative").addEventListener("click", () => startRun("car-api-negative"));
  $("api-health-happy").addEventListener("click", () => startRun("health-api-happy"));
  $("api-health-negative").addEventListener("click", () => startRun("health-api-negative"));
  $("stop-test").addEventListener("click", stopCurrentRun);

  $("car-add-form-scenario").addEventListener("click", () => addFormAsScenario("car"));
  $("health-add-form-scenario").addEventListener("click", () => addFormAsScenario("health"));

  $("car-json").addEventListener("click", () => openJsonModal("car"));
  $("health-json").addEventListener("click", () => openJsonModal("health"));
  $("json-close").addEventListener("click", closeJsonModal);
  $("json-reload").addEventListener("click", reloadConfigFromForm);
  $("json-format").addEventListener("click", () => formatEditor("config", "json-errors"));
  $("json-validate").addEventListener("click", validateConfigJson);
  $("json-apply").addEventListener("click", applyConfigJson);
  $("batch-format").addEventListener("click", () => formatEditor("batch", "batch-errors"));
  $("batch-add-json").addEventListener("click", addJsonAsScenario);
  $("batch-validate").addEventListener("click", validateBatchJson);
  $("batch-run").addEventListener("click", runBatchJson);
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
    initEditors();
    wireEvents();
    await refreshRunStatus();
  } catch (error) {
    showMessage("error", ["Failed to load Control Center data", String(error)]);
  }
}

init();
