# Global Oil Trade Network - Graph Explanation

This document explains the visual elements of the Interactive Global Oil Trade Network graph and how to interpret the data it represents.

## 1. Core Elements

### **Nodes (Circles)**
Each circle (node) on the graph represents a **country** that participates in the global oil trade network—either as an importer, an exporter, or both.

### **Edges (Lines / Arrows)**
The lines connecting the circles represent **trade routes** between two countries. 
- The **thickness** of the line represents the volume of oil traded on that route. Thicker lines mean millions of barrels are transferred, whereas thinner lines indicate a smaller trading relationship.
- The **color gradient** of the line shows the direction of the trade, flowing from the exporter's color to the importer's color.

### **Colors**
The colors of the circles and the edges are based on the **geographical region** of the country (e.g., Africa, Asia, Europe, Americas). The gradients make it easy to spot inter-regional trades (e.g., a line starting blue for Europe and turning orange for Africa).

---

## 2. Why are some circles bigger than others?

The size (diameter) of each circle is directly proportional to the **Total Trade Volume** of that country. 

Total Trade Volume is calculated by adding the country's total imported barrels and total exported barrels together.
- **Large Circles:** Represent major hubs in the global oil network (e.g., top producers like Saudi Arabia or the USA, and top consumers like China).
- **Small Circles:** Represent countries with comparatively minor roles in the global oil trade, handling much smaller volumes.

---

## 3. Why do some circles point to themselves?

You might notice arrows that loop back and point to the same circle they started from. These are known as **self-loops**. 

In the context of the dataset (`DataOli.xlsx`), a self-loop occurs when the **origin country and the destination country are identical**. This usually represents:
1. **Domestic Trade:** Oil being loaded at one domestic port and discharged at another port within the identical country.
2. **Internal Transfers:** Offshore transfers, floating storage processing, or internal refining transport that gets logged continuously within the nation's borders.
3. **Data Anomalies/Refinement:** Sometimes maritime data trackers classify shipments that leave a port and return to a nearby port without crossing international waters as an origin-destination pair of the same country.

---

## 4. Interactive Features

- **Hovering:** Hovering over a node displays the name of the country.
- **Clicking (Selecting):** Clicking on a country's circle isolates its specific ecosystem. It dims all unrelated trade routes and highlights only the chosen country and the direct trade partners it exports to or imports from. Clicking the background resets the view.