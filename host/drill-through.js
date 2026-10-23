// Drill-through from an embedded Muze Studio chart: the solution.
//
//   Step 0  embed the clickable chart
//   Step 1  the Muze chart posts the clicked bar (code in muze/chart.js)
//   Step 2  receive that message and check it came from our embed
//   Step 3  show our own menu over the chart
//   Step 4  embed the detail chart with the clicked value as a runtime filter
//
// how-it-works.js only visualises these steps for the demo; this file works without it.

import {
  init,
  AuthType,
  LiveboardEmbed,
  EmbedEvent,
  RuntimeFilterOp,
} from "https://cdn.jsdelivr.net/npm/@thoughtspot/visual-embed-sdk@1.52.1/dist/tsembed.es.js";

// =============================================================================
// CONFIG: fill these in, or pass them as query-string parameters
// (?tsHost=…&liveboardId=…&vizId=…&detailVizId=…&detailLiveboardId=…)
// =============================================================================
const params = new URLSearchParams(location.search);
const TS_HOST = params.get("tsHost") || "https://your-instance.thoughtspot.cloud";
const LIVEBOARD_ID = params.get("liveboardId") || "<liveboard-guid>";

const CHARTS = {
  // The clickable Muze chart (muze/chart.js).
  overview: {
    liveboardId: LIVEBOARD_ID,
    vizId: params.get("vizId") || "<chart-viz-guid>",
    label: "Total sales by region",
  },
  // The chart to drill into (muze/detail-chart.js, or any other chart).
  detail: {
    liveboardId: params.get("detailLiveboardId") || LIVEBOARD_ID,
    vizId: params.get("detailVizId") || "<detail-viz-guid>",
    label: "detail chart",
  },
};

// Answer column name → model column name, only where they differ.
const COLUMN_MAP = {};

// Tells the "How it works" panel what just happened. Not part of the solution:
// delete this function and its calls when you reuse the code.
function report(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(`drill:${name}`, { detail }));
}

// =============================================================================
// STEP 0: embed the clickable chart
// =============================================================================
init({
  thoughtSpotHost: TS_HOST,
  authType: AuthType.EmbeddedSSO, // reuse the browser's ThoughtSpot session
});

const stage = document.getElementById("stage");
const embeds = {}; // "overview" | "detail" → { el, embed }

function embedChart(key, runtimeFilters = []) {
  const el = document.createElement("div");
  el.className = "embed";
  stage.append(el);
  const embed = new LiveboardEmbed(el, {
    frameParams: { width: "100%", height: "100%" },
    liveboardId: CHARTS[key].liveboardId,
    vizId: CHARTS[key].vizId,
    runtimeFilters,
    // Required for Muze Studio charts: with the browser data cache on, they
    // render the previous load's data, so a new filter shows up one load late.
    enableLiveboardDataCache: false,
  });
  embed.on(EmbedEvent.Error, (e) => console.warn(`${key} embed error`, e));
  embed.render();
  embeds[key] = { el, embed };
}

function removeChart(key) {
  if (!embeds[key]) return;
  embeds[key].embed.destroy();
  embeds[key].el.remove();
  delete embeds[key];
}

// =============================================================================
// STEPS 1 + 2: receive the click from the Muze chart, and check the sender
// =============================================================================
// The embed whose iframe the message came from (the Muze chart runs in a frame
// nested inside ThoughtSpot's iframe), or null for anything else.
function embedThatSent(source) {
  for (const [key, { el }] of Object.entries(embeds)) {
    const iframe = el.querySelector("iframe");
    for (let win = source; iframe && win; win = win.parent) {
      if (win === iframe.contentWindow) return key;
      if (win === win.parent) break;
    }
  }
  return null;
}

function isClickMessage(msg) {
  return msg?.type === "muze-mark-click" && msg.version === 1 &&
    msg.row && typeof msg.row === "object" &&
    Array.isArray(msg.fields) &&
    Object.values(msg.row).every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    );
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "muze-mark-click") return;
  if (embedThatSent(event.source) !== "overview" || !isClickMessage(event.data)) return;

  const { row, fields } = event.data; // row = { region: "West", "Total sales": 335888644.006 }
  report("click", { row, origin: event.origin, chart: CHARTS.overview.label });
  openMenu(row, fields);
});

// =============================================================================
// STEP 3: show the actions menu over the chart
// =============================================================================
const menu = document.getElementById("action-menu");
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

// One "equals" runtime filter per attribute of the clicked bar (measures and dates skipped).
function filtersFor(row, fields) {
  return fields
    .filter((f) => f.type === "dimension" && f.subtype !== "temporal" && row[f.name] != null)
    .map((f) => ({
      columnName: COLUMN_MAP[f.name] || f.name,
      operator: RuntimeFilterOp.EQ,
      values: [row[f.name]],
    }));
}

function describe(filters) {
  return filters.map((f) => `${f.columnName} = ${f.values[0]}`).join(", ");
}

function openMenu(row, fields) {
  const filters = filtersFor(row, fields);

  // Header: the clicked values and a close button.
  const values = document.createElement("dl");
  for (const [field, value] of Object.entries(row)) {
    const dt = document.createElement("dt");
    dt.textContent = field;
    const dd = document.createElement("dd");
    dd.textContent = typeof value === "number" ? numberFormat.format(value) : String(value);
    values.append(dt, dd);
  }
  const close = document.createElement("button");
  close.className = "menu-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close menu");
  close.addEventListener("click", closeMenu);
  const head = document.createElement("div");
  head.className = "menu-head";
  head.append(values, close);

  // The one action: drill into the detail chart.
  const item = document.createElement("button");
  item.className = "menu-item";
  item.disabled = filters.length === 0;
  const label = document.createElement("span");
  label.textContent = `View ${CHARTS.detail.label} for ${describe(filters)}`;
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = "→";
  item.append(label, icon);
  item.addEventListener("click", () => drillInto(filters));

  menu.replaceChildren(head, item);
  menu.hidden = false;
  report("menu", { summary: describe(filters) });
}

function closeMenu() {
  menu.hidden = true;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// =============================================================================
// STEP 4: swap in the detail chart, filtered by the clicked bar
// =============================================================================
function drillInto(filters) {
  closeMenu();
  if (CHARTS.detail.vizId.startsWith("<")) {
    report("drill-blocked", { reason: "Set detailVizId to the detail chart's visualization ID." });
    return;
  }
  removeChart("detail");
  embeds.overview.el.hidden = true; // keep it loaded so "back" is instant
  embedChart("detail", filters);
  renderCrumbs(filters);
  report("drill", { filters });
}

function goBack() {
  removeChart("detail");
  embeds.overview.el.hidden = false;
  renderCrumbs();
  report("back");
}

// Breadcrumb above the chart: "Total sales by region" or "← Total sales by region › region = West".
function renderCrumbs(filters) {
  const nav = document.getElementById("crumbs");
  const current = document.createElement("span");
  current.className = "current";
  if (!filters) {
    current.textContent = CHARTS.overview.label;
    nav.replaceChildren(current);
    return;
  }
  const back = document.createElement("button");
  back.textContent = `← ${CHARTS.overview.label}`;
  back.addEventListener("click", goBack);
  const sep = document.createElement("span");
  sep.className = "sep";
  sep.textContent = "›";
  current.textContent = describe(filters);
  nav.replaceChildren(back, sep, current);
}

// =============================================================================
// START
// =============================================================================
renderCrumbs();
if (TS_HOST.includes("your-instance") || CHARTS.overview.vizId.startsWith("<")) {
  const note = document.createElement("p");
  note.className = "setup-note";
  note.textContent = "Set tsHost, liveboardId and vizId (and detailVizId to drill) in the " +
    "page URL or in the CONFIG block of host/drill-through.js. See the README.";
  stage.append(note);
} else {
  embedChart("overview");
}
