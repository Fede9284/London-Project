# From Python Script to Web App — Plain Version

This is the short, plain-language version of how the original Python script (`process_dataset.py`, plus its MATLAB twin `ProcessDataset.m`) connects to the web visualization we built.

## What the Python script does

The script reads `DataOli.xlsx`, which contains raw oil shipment records. Each row is one shipment: where it came from, where it went, and how many barrels were on board.

It then does five things, one after the other.

First, it cleans the data. Rows with missing origin, destination, or barrel count are dropped. The clean rows are then grouped by `(origin, destination)` pairs, and the barrels are summed. This gives one number per country pair: the total amount of oil that moved between them.

Second, it puts those numbers into a big country-by-country table and saves it as `oil_trade_matrix.xlsx`.

Third, it draws the network as a picture. Countries become dots, trade flows become arrows, and thicker arrows mean more oil. The layout is force-directed: countries that trade a lot end up close together.

Fourth, it computes a Minimum Spanning Tree (MST). Think of this as the "skeleton" of the network — the few most important trade relationships that connect everyone. It does this twice: once based on trade volume, once based on how similarly two countries' trade patterns move (correlation).

Fifth, it builds a correlation heatmap. Countries are reordered using hierarchical clustering so that similar ones sit next to each other, then a colored grid shows which countries have correlated trade activity. The script also estimates the mean and covariance of the traffic matrix in case anyone wants to do simulations later.

All of this produces static pictures. You run the script, you get figures, you save them, you're done. The MATLAB file does exactly the same thing in MATLAB — they're parallel versions of the same pipeline.

## What the web app does

The web app answers a different question. The Python script asks "what does this network look like, and what are its statistical properties?" The web app asks "let me poke around inside this network."

It loads `elements.json` (which contains the same network the Python script computes — same countries, same arrows, same weights) and renders it in the browser using Cytoscape.js. From there, you can pan, zoom, hover for details, click a country to see its connections light up, filter by region, search for a specific country, hide small trade flows with a slider, hide self-loops, and toggle whether you want to see cross-region links or only flows inside one region.

So the data is the same. What changes is that you can now interact with it instead of staring at a fixed image.

## What was added in the web version

Three things in the web app have no Python counterpart.

**Region classification.** The Python script treats every country as just a labeled dot. The web app groups them into six regions (Africa, Middle East, Asia-Pacific, Europe, North America, Latin America) and uses that grouping for colors and filters. Without this, the whole map would be one color and you couldn't tell the story at a glance.

**Colored arrows.** In the Python figure, every arrow is the same color. In the web app, each arrow fades from the exporter's regional color at one end to the importer's color at the other end. So a Saudi Arabia → China arrow starts emerald (Middle East) and ends red (Asia-Pacific). You can see direction and regional flow without reading any labels.

**Filters.** A sidebar lets you isolate regions, search countries, raise the minimum trade volume, and toggle different categories of edges. None of this exists in matplotlib — to "filter" a matplotlib chart, you re-run the script.

## What the two layers share

| Python / MATLAB                          | Web app                                                |
| ---------------------------------------- | ------------------------------------------------------ |
| `DataOli.xlsx` raw shipments             | (upstream — not used directly by the browser)          |
| `grouped_data` summed by country pair    | `elements.json` edge list                              |
| `oil_matrix` N×N table                   | implicit in the graph                                  |
| `nx.spring_layout` (static)              | `cytoscape-cola` (live, animated)                      |
| Same color for all edges                 | Gradient: exporter color → importer color              |
| Fixed node size                          | Node size scales with total trade                      |
| No regions                               | 6 regions defined in `script.js`                       |
| No filtering                             | Region chips, size slider, search, toggles             |

## What stayed only in Python

Four parts of the Python script were not moved over, on purpose.

The MST plots, the correlation heatmap with clustering, and the multivariate normal estimation (mean μ and covariance Σ) are all analytical results, not exploratory views. They give you one specific answer per run. There's nothing useful to click on them. So they stay where they belong: in a script that produces a figure and writes a result.

The correlation heatmap is the one that could reasonably be ported if you wanted a richer dashboard — it would work as a second tab next to the network. The covariance matrix should stay in Python because it feeds simulation code, not human eyes.

## The one gap in the current setup

There's a small disconnect in the pipeline as it stands today. `process_dataset.py` produces `oil_trade_matrix.xlsx`, and the web app loads `elements.json`. But nothing in the repository turns one into the other. `elements.json` exists, and was clearly generated by something (probably a Dash-based exporter), but that script isn't included alongside the rest.

The clean fix is to add one more function to `process_dataset.py`. After the `grouped_data` step is built, write a small block that loops over countries to produce nodes, loops over `grouped_data` to produce edges, attaches the region from a Python dictionary that mirrors the JavaScript one, and writes everything out as `elements.json`. That collapses the two-tool flow into a single command and removes the only place where Python and JavaScript currently hold the same domain knowledge in two places.

## Short version

The Python script does math and produces pictures. The web app loads the same network and lets you explore it interactively. The transition added regions, colored edges, and filters. The analytical parts of the Python script (MSTs, heatmap, covariance) stayed in Python because they don't benefit from being interactive. The pipeline could be tightened by having Python write `elements.json` directly.
