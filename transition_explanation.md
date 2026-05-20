# From Raw Data to Interactive Web Dashboard: The Pipeline

This document explains the technical pipeline describing how raw data from an Excel spreadsheet was processed into an identical, fully static, user-friendly interactive web page.

## The Pipeline Overview
1. **Raw Data Ingestion** (`DataOli.xlsx`)
2. **Data Processing & Analytics** (`process_dataset.py`)
3. **Interactive Graph Generation** (`interactive_oil_network.py`)
4. **Data Extraction for Web** (`export_web_data.py`)
5. **Static Web Frontend** (`web_project/index.html & script.js`)

---

## 1. Raw Data Logging
The project begins with raw maritime tracking data in `DataOli.xlsx`. This dataset contains log entries mapping the origin country, the destination country, and the loaded volume of oil in barrels.

---

## 2. Data Processing (`process_dataset.py`)
Initially converted from a MATLAB script, this Python file uses `pandas` and `numpy` to serve as the analytical engine.
- **Cleaning:** Drops empty rows and missing fields.
- **Aggregation:** Groups thousands of individual ship movements into unified, total sums spanning country A to country B.
- **Mathematical Modeling:** Calculates Minimum Spanning Trees (MST) and correlation matrices to cluster data mathematically.
- *Limitations:* Outputs entirely static `matplotlib` images that are difficult to explore intuitively.

---

## 3. Interactive Visualization Engine (`interactive_oil_network.py`)
To make the data interactive and visually appealing, the logic was ported into `interactive_oil_network.py`, driven by **Dash** and **Cytoscape**.
- **Filtering the Hairball:** It filters out the "noise" (bottom 90% of minuscule trade routes) to keep the graph readable, retaining only top-tier trade connections.
- **Sizing Algorithms:** Employs a mathematical formula scaling the volume of trade logarithmically (`math.sqrt(x / np.pi)`) so massive countries don't visually consume tiny countries entirely.
- **Color Grading:** Uses dictionaries mapping standard UN Country Codes (`ccodes`) to geographical regions, generating smooth hex-color gradients (`#FB9038` for Africa passing through into Blue for Europe).
- *Limitations:* Relies on a live Python backend server (`Flask/Gunicorn`). It cannot be hosted for free on simple static sites like GitHub Pages.

---

## 4. Web Extraction (`export_web_data.py`)
To bypass the limitation of requiring a live Python server, we decoupled the **computed graph output** from the **logic**.
- This script imports the pre-computed arrays of nodes, edges, sizes, and hex colors calculated dynamically in `interactive_oil_network.py`.
- It formats these Python dictionaries securely into standard JSON and exports them into a static file: `elements.json`.
- By doing this, the heavy lifting (filtering, scaling, gradient parsing) is done once structurally instead of on every page load.

---

## 5. The Static Web Frontend (`web_project/`)
The final piece of the transition is the `web_project` folder, which consumes the exported static JSON.
- **`index.html` & `style.css`**: Provides a modern, Tailwind-inspired Dark Mode UI card holding the canvas.
- **`script.js`**: Uses `fetch()` to grab the `elements.json` created in step 4. It leverages `cytoscape.js` and `webcola` layout algorithms directly in the browser.
- **Interactivity via JS**: Instead of calling a Python backend to highlight routes when clicked, `script.js` applies CSS classes (`.highlighted`, `.faded`) to DOM elements in real time.

**Conclusion:** Through this pipeline, a heavy backend python data process was successfully captured as a snapshot, allowing a rich, interactive Dashboard to exist purely as a fast, free, static HTML website deployable anywhere.