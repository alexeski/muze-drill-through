// The "How it works" panel: lights up each step of drill-through.js as it
// happens, with the data that was exchanged. Demo-only: it just listens to the
// drill:* events that drill-through.js reports, and the solution runs without it.

const STEPS = [
  {
    title: "The Muze chart sends the click",
    text: "Code inside the chart sends the clicked bar's data up to this page.",
    code: 'window.top.postMessage({ type: "muze-mark-click", row }, origin)',
    file: "muze/chart.js, part 2",
  },
  {
    title: "This page checks who sent it",
    text: "It only accepts the message if it came from inside its own ThoughtSpot embed.",
    code: 'window.addEventListener("message", …)',
    file: "host/drill-through.js, steps 1 + 2",
  },
  {
    title: "This page shows its own menu",
    text: "The menu is ordinary HTML on this page, laid over the chart's top-right corner.",
    code: "openMenu(row, fields)",
    file: "host/drill-through.js, step 3",
  },
  {
    title: "The detail chart opens, filtered",
    text: "The page embeds the second chart and passes the clicked value as a runtime filter.",
    code: "new LiveboardEmbed(el, { vizId, runtimeFilters })",
    file: "host/drill-through.js, step 4",
  },
];

const list = document.getElementById("steps");

function reset() {
  list.replaceChildren(...STEPS.map((step, i) => {
    const li = document.createElement("li");
    li.className = "step";
    li.innerHTML = '<span class="num"></span><h3></h3><p></p><div><code></code>' +
      '<div class="file"></div><pre></pre></div>';
    li.querySelector(".num").textContent = i + 1;
    li.querySelector("h3").textContent = step.title;
    li.querySelector("p").textContent = step.text;
    li.querySelector("code").textContent = step.code;
    li.querySelector(".file").textContent = step.file;
    return li;
  }));
}

function show(n, output, isWarning = false) {
  const li = list.children[n - 1];
  li.classList.add("done");
  const pre = li.querySelector("pre");
  pre.textContent = output;
  pre.classList.toggle("warn", isWarning);
}

document.addEventListener("drill:click", ({ detail }) => {
  reset(); // a new click starts a new run
  show(1, JSON.stringify(detail.row, null, 2));
  show(2, `Sent from inside the "${detail.chart}" embed\nOrigin: ${detail.origin}`);
});
document.addEventListener("drill:menu", ({ detail }) => {
  show(3, `Menu opened for ${detail.summary}`);
});
document.addEventListener("drill:drill", ({ detail }) => {
  show(4, `runtimeFilters: ${JSON.stringify(detail.filters, null, 2)}`);
});
document.addEventListener("drill:drill-blocked", ({ detail }) => {
  show(4, detail.reason, true);
});
document.addEventListener("drill:back", reset);

reset();
