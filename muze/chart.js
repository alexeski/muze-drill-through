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
// Origin of the web app that embeds ThoughtSpot. The browser drops the message
// if the top-level page has any other origin.
const HOST_ORIGIN = "http://localhost:8080";

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

    window.top.postMessage(
      {
        type: "muze-mark-click",
        version: 1,
        row,
        fields: fields.map(({ name, type, subtype }) => ({ name, type, subtype })),
      },
      HOST_ORIGIN,
    );
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
