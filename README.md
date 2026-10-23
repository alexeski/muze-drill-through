# Muze Studio drill-through demo

A user clicks a bar in an embedded Muze Studio chart. An actions menu opens over the chart, and
picking **View detail for region = West** replaces the chart with a second embedded chart filtered
to `region = West`.

**Live page:** https://alexeski.github.io/muze-drill-through/ (add your IDs as query parameters,
see [Use the GitHub Pages demo](#use-the-github-pages-demo)).

## How it works

```
 Your web app (host page)                ThoughtSpot (iframe)
┌───────────────────────────────┐      ┌───────────────────────────────┐
│ 2. "message" listener checks  │◄─────│ Muze Studio chart             │
│    it came from our embed     │ post │ 1. user clicks a bar →        │
│                               │ Msg  │    window.top.postMessage(    │
│ 3. shows its own HTML menu    │      │      { row: { region: West }})│
│    over the chart's corner    │      └───────────────────────────────┘
│                               │
│ 4. new LiveboardEmbed(…, {    │      ┌───────────────────────────────┐
│      runtimeFilters:          │─────►│ Detail chart                  │
│        [region = West] })     │      │ filtered to region = West     │
└───────────────────────────────┘      └───────────────────────────────┘
```

1. **The chart sends the click.** Code in the Muze chart (`chart.js`, part 2) runs on every click
   and posts the clicked bar's data to the top-level page.
2. **The page checks the sender.** It accepts the message only if it came from inside its own
   ThoughtSpot embed.
3. **The page shows a menu.** The menu is ordinary HTML on the host page, positioned over the
   chart's top-right corner, so the host app controls the actions.
4. **The page embeds the detail chart with a runtime filter.** `runtimeFilters` is the standard
   Visual Embed SDK option. The first chart stays loaded in the background, so going back is
   instant.

The demo page shows these four steps live, in a "How it works" panel, with the data that was
actually exchanged.

## Files

| File | What it is |
|---|---|
| `muze/chart.js` | The clickable chart. Part 1 draws it; part 2 sends clicks to the host and can be copied into any Muze chart. |
| `muze/detail-chart.js` | The drill target. A plain Muze chart with nothing special; any chart works. |
| `muze/chart.html`, `muze/chart.css` | HTML and CSS tabs for both charts. |
| `host/index.html` | The host page. Its code is split into steps 0–4 that match the list above. |

## Set it up

1. **Clickable chart.** Create an Answer, e.g. `Total sales region`. Switch it to a Muze Studio
   chart and paste `chart.js`, `chart.html` and `chart.css` into the JS, HTML and CSS tabs. Set
   `HOST_ORIGINS` in `chart.js` to your web app's origin(s). Save, then pin it to a Liveboard.
2. **Detail chart.** Create a second Answer on the same model, e.g. `Total sales state`. It doesn't
   need the `region` column. Paste `detail-chart.js` and the same HTML/CSS, then pin it.
3. **ThoughtSpot security settings** (Develop → Security settings). Add your web app's origin
   (here `localhost:8080`) to the CSP visual-embed hosts and to the CORS allowlist.
4. **Run the host page** and sign in to ThoughtSpot in the same browser:

   ```bash
   python3 -m http.server 8080 --directory host
   ```

   Open `http://localhost:8080/?tsHost=https://<you>.thoughtspot.cloud&liveboardId=<lb-guid>&vizId=<chart-viz-guid>&detailVizId=<detail-viz-guid>`.
   Add `&detailLiveboardId=…` if the detail chart is on another Liveboard.

To get the IDs, open a pinned chart's **⋯** menu in the Liveboard and choose **Copy link**. The
link ends with `/pinboard/<liveboard-guid>/<viz-guid>`.

## Use the GitHub Pages demo

The same page is published at https://alexeski.github.io/muze-drill-through/. To point it at your
ThoughtSpot instance:

1. In ThoughtSpot, Develop → Security settings, add `https://alexeski.github.io` to the CSP
   visual-embed hosts and to the CORS allowlist.
2. Make sure `https://alexeski.github.io` is in `HOST_ORIGINS` in the chart's Muze Studio code (it
   is in `muze/chart.js`), and save the Answer.
3. Sign in to ThoughtSpot in the same browser, then open
   `https://alexeski.github.io/muze-drill-through/?tsHost=https://<you>.thoughtspot.cloud&liveboardId=<lb-guid>&vizId=<chart-viz-guid>&detailVizId=<detail-viz-guid>`.

The IDs travel only in the link you open; nothing about your instance is stored in the repo.

## Gotchas

- **`enableLiveboardDataCache: false` is required.** With the browser data cache on, Muze Studio
  charts render the previous load's data, so a new runtime filter appears one load late.
- **`EmbedEvent.VizPointClick` doesn't fire for Muze Studio marks.** That's why the chart sends
  its own message.
- Runtime filters use the model's column name. If the Answer renames a column, map it in
  `COLUMN_MAP`.
- Date attributes aren't turned into filters. Measures are never filters.
- If the embed shows a login screen even though you're signed in, the browser is blocking
  third-party cookies; use trusted authentication (`AuthType.TrustedAuthTokenCookieless`).
- The click hand-off (`postMessage` from the Muze frame) isn't a documented ThoughtSpot
  integration, so re-test it after ThoughtSpot upgrades.
