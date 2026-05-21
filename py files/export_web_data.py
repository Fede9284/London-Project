import json
# Import the existing Python script just to run the data processing logic 
# and extract the pre-computed `elements` layout.
from interactive_oil_network import elements

# Write elements out to json format matching Cytoscape.js requirements
out_file = 'web_project/elements.json'

# Format Dash elements back into standard Cytoscape elements structure (which expects the data flat occasionally, but cytoscape handles data{} nested objects fine).
# We fix space formatting in multi-stop gradients from commas to spaces.
for el in elements:
    if 'background_color' in el['data']:
        el['data']['background_color'] = str(el['data']['background_color']).replace(',', ' ')
    if 'background_color_chosen' in el['data']:
        el['data']['background_color_chosen'] = str(el['data']['background_color_chosen']).replace(',', ' ')
    if 'colors' in el['data']:
        el['data']['colors'] = str(el['data']['colors']).replace(',', ' ')
    if 'colors_chosen' in el['data']:
        el['data']['colors_chosen'] = str(el['data']['colors_chosen']).replace(',', ' ')


with open(out_file, 'w') as f:
    json.dump(elements, f, indent=2)

print(f"Exported cytoscape graph elements to {out_file}")