# From Offline Analysis to Interactive Exploration

This document explains how the original Python script (`process_dataset.py`, with its MATLAB equivalent `ProcessDataset.m`) relates to the interactive web visualization built on top of `elements.json`. The two layers were not designed as alternatives to each other — they sit at different points of the same workflow, and understanding which questions each one is meant to answer clarifies why some pieces moved across and others stayed behind.

## Original pipeline

The Python and MATLAB scripts are functionally identical: parallel implementations of the same eight-stage offline analysis. They read raw maritime shipment records from `DataOli.xlsx`, drop rows missing an origin, a destination or a barrel count, and then aggregate the surviving transactions into a country-by-country trade matrix by summing `loadedbarrels` for every `(origin, destination)` pair. The aggregated matrix is written out as `oil_trade_matrix.xlsx` so the rest of the analysis (and any downstream notebook) can work from a clean N×N tabular object rather than the original transaction log.

From that matrix the script then produces four analytical artifacts. First, a directed graph drawn with a force-directed (spring) layout, edge widths scaled to the share of total volume. Second, a minimum spanning tree of the network using inverse trade volume as edge distance, so that heavily-traded relationships collapse into short distances and the MST surfaces the "skeleton" of dominant trade routes. Third, a symmetric traffic matrix is constructed by adding `(i,j)` and `(j,i)` flows together, its Pearson correlation matrix is taken, and the rows and columns are reordered through single-linkage hierarchical clustering with optimal leaf ordering — the resulting correlation² heatmap (jet colormap, range [0,1]) reveals groups of countries whose total trade activity moves together. Fourth, a second MST is built on the distance `1 - corr²`, which clusters countries by behavioral similarity rather than by direct trade. The pipeline closes by estimating the mean vector μ and covariance matrix Σ of the traffic matrix under a multivariate normal assumption, which sets up any downstream stress-testing or simulation work.

The whole script is offline and non-interactive. Every output is a static PNG-style matplotlib figure or a written Excel file. This is the right tool for the analytical questions it is built to answer — "are there latent clusters of countries that co-move?", "what is the topological backbone of the trade network?", "what is the data-generating process?" — but it is the wrong tool for the question the web app exists to answer.

## What the web app is for

The browser visualization is built around a different verb. The Python script computes; the web app lets you look. Once the analyst already trusts the aggregated network, they typically want to navigate it: isolate a region, find a specific country, follow a particular flow, see who Saudi Arabia ships to versus who China imports from. That kind of exploration is awkward inside matplotlib and was the motivation for promoting the same network data into a Cytoscape.js front end.

The handoff between the two layers is the file `elements.json`, which encodes the same directed graph as the Python `DiGraph` but in the nested format Cytoscape consumes (one entry per node, one per edge, each with a `data` block). Two things to note about this file. It is produced by a separate Python step that wraps the aggregation logic of `process_dataset.py` together with styling decisions (precomputed node sizes proportional to total trade, font sizes, baseline colours). That intermediate script is not included in the current repository — it is the one missing link in the documented pipeline, and a clean way to close the loop would be to extend `process_dataset.py` with an `export_to_cytoscape()` function that writes `elements.json` directly from the same `grouped_data` DataFrame the rest of the script already builds.

## What carried over and what was added

The directed graph itself transferred over unchanged. Nodes are countries, edges run from exporter to importer, edge weights are summed loaded barrels, and node "importance" is encoded as size proportional to total trade volume — all of which mirrors what the matplotlib `nx.draw_networkx_*` calls produce. What replaces the static spring layout is the WebCola `cola` layout, which is also force-directed but runs in the browser, animates the simulation, and lets the user pan and zoom.

Three things were added in the web layer that have no counterpart in the Python script. The first is a geographic region classification: the Python pipeline treats every country as a structurally equivalent node, but the web app maps each country to one of six regions (Africa, Middle East, Asia-Pacific, Europe, North America, Latin America) and uses that classification to drive node colour, edge colour, and the filter chips in the sidebar. This is the most important interpretive layer the visualization adds — without it, the network is a homogeneous blue blob.

The second addition is the edge encoding. The Python figure draws all edges in a single colour with transparency scaled by weight; the web edges fade from the exporter's regional colour at the source end to the importer's regional colour at the target end, with the arrow head taking the importer's colour. Cross-region edges are rendered slightly more opaque than intra-region ones because they carry most of the analytical interest. Self-loops (domestic trade) are dimmed for the same reason.

The third addition is the filter system: region isolation, a minimum-trade-volume slider, a search box that highlights and zooms to matches, a toggle that hides cross-region flows when a region is selected, and a toggle that hides self-loops entirely. None of these have an analogue in the static script — matplotlib outputs cannot be filtered after the fact without re-running the whole pipeline.

## Mapping between layers

| Python / MATLAB concept                              | Web-app counterpart                                |
| ---------------------------------------------------- | -------------------------------------------------- |
| `DataOli.xlsx` raw transactions                      | (upstream, not loaded by browser)                  |
| `grouped_data` aggregated `(origin, destination, sum_barrels)` | `elements.json` edge list with `weight` and `width` |
| `oil_matrix` N×N origin/destination table            | implicit in the Cytoscape graph topology           |
| `nx.spring_layout` static positions                  | `cytoscape-cola` interactive layout                |
| `nx.draw_networkx_edges` uniform colour              | Per-edge linear gradient by source/target region   |
| `node_size=100`                                      | `data(size)` proportional to total trade           |
| no region concept                                    | `REGIONS` map applied at load time in `script.js`  |
| no filtering                                         | Sidebar: region chips, size slider, search, toggles |

## What stayed in Python (and probably should)

Four pieces of the original pipeline were not ported, deliberately. The minimum spanning tree of the network, the correlation² heatmap, the MST of the correlation distances, and the multivariate normal parameter estimation are all analytical outputs rather than exploratory views. The MST in particular is a single static structure — there is nothing meaningful to filter or hover on it — so rendering it interactively would add interaction cost without analytical payoff. The correlation heatmap could in principle be ported (it would render well as a second-tab Cytoscape view or as a D3 heatmap), and that is a reasonable extension if the same workspace is meant to support both topological and statistical inspection of the network. The covariance matrix estimation belongs in a notebook because its output feeds simulation code, not human eyes.

## Suggested next step

The cleanest way to formalize the pipeline is to add one more output stage to `process_dataset.py`. After the aggregation step that produces `grouped_data`, write a function that emits `elements.json` directly — looping over the unique countries to produce node entries (with size = log-scaled total trade, region tag derived from a Python-side region dictionary that mirrors the JavaScript one), and over the rows of `grouped_data` to produce edge entries (with `width` = a normalized log of barrels). This collapses the current two-tool flow (Python for analysis, separate undocumented exporter for the web data) into a single command and removes the one place in the workflow where Python and JavaScript currently hold redundant copies of the same domain knowledge.
