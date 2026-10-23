// Detail chart: a plain Muze Studio chart with nothing special in it.
// The host app filters it by passing runtime filters when it embeds it, so any
// chart works here, Muze Studio or native.
// Paste into the JS tab of Muze Studio, with chart.html / chart.css in the other tabs.

const { muze, getDataFromSearchQuery } = viz;
const data = getDataFromSearchQuery();

// Horizontal bars: first attribute on the y-axis, first measure on the x-axis.
const schema = data.getSchema();
const dimension = schema.find((f) => f.type === "dimension").name;
const measure = schema.find((f) => f.type === "measure").name;

muze
  .canvas()
  .data(data)
  .rows([dimension])
  .columns([measure])
  .title(`${measure} by ${dimension}`)
  .subtitle("Filtered by the bar clicked in the previous chart")
  .mount("#chart");
