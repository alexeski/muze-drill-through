// Clickable Muze Studio chart: a bar chart that tells the host app which bar was clicked.
// Paste into the JS tab of Muze Studio (chart.html -> HTML tab, chart.css -> CSS tab).

// =============================================================================
// PART 1: draw the chart (ordinary Muze Studio code)
// =============================================================================
const { muze, getDataFromSearchQuery } = viz;
const data = getDataFromSearchQuery();

// First attribute on the x-axis, first measure on the y-axis.
const schema = data.getSchema();
const dimension = schema.find((f) => f.type === "dimension").name;
const measure = schema.find((f) => f.type === "measure").name;

const canvas = muze
  .canvas()
  .data(data)
  .columns([dimension])
  .rows([measure])
  // Turns on the click handler defined in part 2.
  .config({
    interaction: {
      singleSelect: {
        sideEffects: { "send-click-to-host": { enabled: true } },
      },
    },
  })
  .title(`${measure} by ${dimension}`)
  .subtitle("Click a bar to see what you can do with it")
  .mount("#chart");

// =============================================================================
// PART 2: send clicks to the host app (copy this part into any Muze chart)
// =============================================================================
// Origins of the web apps that embed this chart (here: local dev and the GitHub
// Pages demo). The browser delivers the message only to a top-level page whose
// origin is in this list, and silently drops the rest.
const HOST_ORIGINS = ["http://localhost:8080", "https://alexeski.github.io"];

const { SurrogateSideEffect } = muze.SideEffects.standards;
const { VolatileBehaviour } = muze.Behaviours.standards;

// Muze calls apply() on every click, with the data behind the clicked bar.
class SendClickToHost extends SurrogateSideEffect {
  static formalName() {
    return "send-click-to-host";
  }

  constructor(...params) {
    super(...params);
    // Muze creates this once for the chart and once per plot unit; keep only the
    // chart-level one so each click is sent once.
    if (this.firebolt.target() === "visual-unit") {
      this.disable();
    }
  }

  apply(selectionSet) {
    const clicked = selectionSet.entrySet.model;
    if (!clicked) {
      return this; // click on empty space
    }
    // { region: "West", "Total sales": 335888644.006 }
    const { data: rows, schema: fields } = clicked.getData({
      excludeFields: ["__id__"],
    });
    const row = Object.fromEntries(fields.map((f, i) => [f.name, rows[0][i]]));

    const message = {
      type: "muze-mark-click",
      version: 1,
      row,
      fields: fields.map(({ name, type, subtype }) => ({ name, type, subtype })),
    };
    for (const origin of HOST_ORIGINS) {
      window.top.postMessage(message, origin);
    }
    return this;
  }
}

// Treat a click as "select one bar", and run SendClickToHost (plus the
// built-in highlighter) whenever that happens.
muze.ActionModel.for(canvas)
  .registerBehaviouralActions(
    class SingleSelectBehaviour extends VolatileBehaviour {
      static formalName() {
        return "singleSelect";
      }
    },
  )
  .registerPhysicalBehaviouralMap({
    click: { behaviours: ["singleSelect"] },
  })
  .dissociateBehaviour(["select", "click"])
  .registerSideEffects(SendClickToHost)
  .mapSideEffects({
    singleSelect: [
      "send-click-to-host",
      { name: "highlighter", options: { strategy: "focus" } },
    ],
  });
