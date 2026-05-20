import pandas as pd
import numpy as np
import dash_cytoscape as cyto
from dash import Dash, html, Input, Output
import dash_bootstrap_components as dbc
from plotly.colors import hex_to_rgb
import math
import networkx as nx

cyto.load_extra_layouts()

# --- DATA PROCESSING ---
filename = 'DataOli.xlsx'
try:
    data = pd.read_excel(filename)
except FileNotFoundError:
    print(f"File {filename} not found.")
    raise

# Extract relevant columns and clean missing values
data = data.dropna(subset=['destination_countryname', 'origin_countryname', 'loadedbarrels'])
data = data[data['destination_countryname'] != '']
data = data[data['origin_countryname'] != '']

# Group by destination and origin, sum the barrels
grouped_data = data.groupby(['origin_countryname', 'destination_countryname'])['loadedbarrels'].sum().reset_index()
grouped_data.columns = ['source', 'target', 'weight']

# Filter data: keep only top 90th percentile of trade routes to avoid a hairball
threshold = grouped_data['weight'].quantile(0.90)
filtered_edge_data = grouped_data[grouped_data['weight'] >= threshold].copy()

# Node data calculation (sum of imports and exports)
exports = filtered_edge_data.groupby('source')['weight'].sum().reset_index().rename(columns={'source': 'country', 'weight': 'export'})
imports = filtered_edge_data.groupby('target')['weight'].sum().reset_index().rename(columns={'target': 'country', 'weight': 'import'})

nodes_df = pd.merge(exports, imports, on='country', how='outer').fillna(0)
nodes_df['total_trade'] = nodes_df['export'] + nodes_df['import']

# Scale node sizes based on total trade
max_trade = nodes_df['total_trade'].max()
nodes_df['diameter'] = nodes_df['total_trade'].apply(lambda x: max(10, (math.sqrt(x / np.pi) / math.sqrt(max_trade / np.pi)) * 60))

# --- COLORING AND STYLING (Based on global_trade_network.py) ---
region_color_dict = {
    'Antarctica': '#7E6EBD',
    'Africa': '#FB9038',
    'Asia': '#D1085C',
    'Europe': '#08B0D1',
    'Americas': '#d4e2e8',
    'Oceania': '#134DD1',
    'Special categories and unspecified areas': '#F9F871'
}

ccode_to_region_dict = dict()

regions = [
    'Africa', 'Oceania', 'Antarctica', 'Americas', 'Asia', 'Europe',
    'Special categories and unspecified areas'
]

ccode_lists = [
    [
        '012', '024', '072', '086', '108', '120', '132', '140', '148', '174',
        '175', '178', '180', '204', '226', '231', '232', '260', '262', '266',
        '270', '288', '324', '384', '404', '426', '430', '434', '450', '454',
        '466', '478', '480', '504', '508', '516', '562', '566', '577', '624',
        '638', '646', '654', '678', '686', '690', '694', '706', '710', '716',
        '728', '729', '732', '736', '748', '768', '788', '800', '818', '834',
        '854', '894'
    ],
    [
        '016', '036', '090', '162', '166', '184', '242', '258', '296', '316',
        '334', '520', '527', '540', '548', '554', '570', '574', '580', '581',
        '583', '584', '585', '598', '612', '772', '776', '798', '876', '882'
    ], ['010'],
    [
        '028', '032', '044', '052', '060', '068', '074', '076', '084', '092',
        '124', '136', '152', '170', '188', '192', '212', '214', '218', '222',
        '238', '239', '254', '304', '308', '312', '320', '328', '332', '340',
        '388', '473', '474', '484', '500', '531', '533', '534', '535', '558',
        '591', '600', '604', '630', '636', '637', '652', '659', '660', '662',
        '663', '666', '670', '740', '780', '796', '840', '842', '850', '858',
        '862'
    ],
    [
        '004', '031', '048', '050', '051', '064', '096', '104', '116', '144',
        '156', '196', '268', '275', '344', '356', '360', '364', '368', '376',
        '392', '398', '400', '408', '410', '414', '417', '418', '422', '446',
        '458', '462', '490', '496', '512', '524', '586', '608', '626', '634',
        '682', '699', '702', '704', '760', '762', '764', '784', '792', '795',
        '860', '887'
    ],
    [
        '008', '020', '040', '056', '070', '100', '112', '191', '203', '208',
        '233', '234', '246', '248', '250', '251', '276', '292', '300', '336',
        '348', '352', '372', '380', '428', '438', '440', '442', '470', '492',
        '498', '499', '528', '568', '578', '579', '616', '620', '642', '643',
        '674', '680', '688', '703', '705', '724', '744', '752', '756', '757',
        '804', '807', '826', '831', '832', '833'
    ], ['837', '838', '839', '899']
]
for r, c in zip(regions, ccode_lists):
    ccode_to_region_dict.update(dict.fromkeys(c, r))

# Load reporters code to map country string to ccode
try:
    reporters = pd.read_csv('comtrade_codes/reporterAreas.csv')
    partners = pd.read_csv('comtrade_codes/partnerAreas.csv')
    
    # format ccodes
    for dataset in [reporters, partners]:
        dataset['id'] = [
            '00' + str(x) if len(str(x)) == 1 else '0' + str(x) if len(str(x)) == 2 else str(x)
            for x in dataset['id'].tolist()
        ]
        
    country_to_ccode = {row['text']: row['id'] for _, row in reporters.iterrows()}
    country_to_ccode.update({row['text']: row['id'] for _, row in partners.iterrows()})
    
except FileNotFoundError:
    country_to_ccode = {}

def get_region_color(country_name):
    base_default = '#08B0D1'
    ccode = country_to_ccode.get(country_name)
    if not ccode:
        # Fallbacks for some countries that might be slightly misnamed in the Excel vs CSV
        if 'United States' in country_name: ccode = '840' 
        elif 'Russia' in country_name: ccode = '643'
        elif 'China' in country_name: ccode = '156'
        elif 'United Kingdom' in country_name: ccode = '826'
        
    if ccode:
        region = ccode_to_region_dict.get(ccode)
        if region:
            return region_color_dict.get(region, base_default)
    return base_default

background_color = '#0f172a' # Tailwind Slate 900
highlight_color = '#f8fafc' # Tailwind Slate 50

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def hex_gradient_list(hex_color1, hex_color2, n_colors):
    if n_colors <= 1:
        return [hex_color1]
    color1_rgb = np.array(hex_to_rgb(hex_color1)) / 255
    color2_rgb = np.array(hex_to_rgb(hex_color2)) / 255
    ordered = np.linspace(0, 1, n_colors)
    gradient = [((1 - order) * color1_rgb + (order * color2_rgb)) for order in ordered]
    gradient_transformed = [[int(round(val * 255)) for val in color] for color in gradient]
    return [rgb_to_hex(color) for color in gradient_transformed]

def hex_gradient_str(hex_color1, hex_color2, n_colors):
    return " ".join(hex_gradient_list(hex_color1, hex_color2, n_colors))

# Pre-compute elements for Cytoscape
elements = []
for _, row in nodes_df.iterrows():
    country = row['country']
    size = row['diameter']
    
    node_color = get_region_color(country)
    
    # We create gradients for node styling
    bg_gradient_list = hex_gradient_list(node_color, background_color, 4)
    bg_color_str = f"{bg_gradient_list[2]} {node_color} {node_color}"
    
    highlight_color_str = hex_gradient_list(node_color, '#ffffff', 7)[3]
    bg_highlight_gradient_list = hex_gradient_list(highlight_color_str, background_color, 4)
    bg_highlight_color_str = f"{bg_highlight_gradient_list[2]} {node_color} {node_color}"

    elements.append({
        'data': {
            'id': country,
            'label': country,
            'size': size,
            'color': hex_gradient_list(node_color, '#ffffff', 5)[3],
            'color_chosen': hex_gradient_list(node_color, '#ffffff', 6)[5],
            'background_color': bg_color_str,
            'background_color_chosen': bg_highlight_color_str,
            'border_color': node_color,
            'border_color_chosen': node_color,
            'font_size': min(25, max(8, size / 2)),
            'region_color': node_color
        }
    })

# Pre-compute edges
max_weight = filtered_edge_data['weight'].max()
for _, row in filtered_edge_data.iterrows():
    width = max(1, (row['weight'] / max_weight) * 10)
    
    source_color = get_region_color(row['source'])
    target_color = get_region_color(row['target'])
    
    source_gradient = hex_gradient_list(background_color, source_color, 11)[2]
    target_gradient = hex_gradient_list(background_color, target_color, 11)[7]
    
    colors_str = hex_gradient_str(source_gradient, target_gradient, 10)
    
    elements.append({
        'data': {
            'id': f"{row['source']}_{row['target']}",
            'source': row['source'],
            'target': row['target'],
            'weight': row['weight'],
            'width': width,
            'colors': colors_str,
            'colors_chosen': colors_str
        }
    })

# --- CYTOSCAPE APP ---
app = Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
#server = app.server

default_stylesheet = [
    {
        'selector': 'node',
        'style': {
            'label': 'data(label)',
            'background-fill': 'radial-gradient',
            'background-gradient-stop-colors': 'data(background_color)',
            'background-gradient-stop-positions': '0, 80, 90, 100',
            'color': 'data(color)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 'data(font_size)',
            'border-color': 'data(border_color)',
            'border-width': 1.5,
            'width': 'data(size)',
            'height': 'data(size)',
            'opacity': 0.95
        }
    },
    {
        'selector': 'edge',
        'style': {
            'line-fill': 'linear-gradient',
            'line-gradient-stop-colors': 'data(colors)',
            'line-gradient-stop-positions': '10, 20, 30, 40, 50, 60, 70, 80, 90',
            'width': 'data(width)',
            'curve-style': 'bezier',
            'opacity': 0.6
        }
    }
]

app.layout = dbc.Container([
    html.H2(
        "Global Oil Trade Network", 
        style={
            'color': highlight_color, 
            'font-family': "'Inter', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif", 
            'font-weight': '600',
            'padding-top': '24px', 
            'padding-bottom': '8px', 
            'text-align': 'center'
        }
    ),
    html.Div([
        html.Div([
            html.Span('Hovered Country:  ', 
                      style={
                          'color': '#94a3b8', # Slate 400
                          'font-family': "'Inter', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif", 
                          'font-size': '16px',
                          'display': 'inline-block', 
                          'margin-right': '12px'
                      }),
            html.Span(id='mouseoverNodeData', 
                      style={
                          'color': '#38bdf8', # Slate 400 highlight matching edges
                          'font-family': "'Inter', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif", 
                          'font-size': '18px',
                          'font-weight': '700'
                      })
        ], style={'padding': '16px 24px', 'border-bottom': '1px solid #1e293b'}),
        cyto.Cytoscape(
            id='cytoscape',
            layout={'name': 'cola'}, # cola layout is good for force-directed clustering
            style={
                'width': '100%',
                'height': '800px',
                'background-color': background_color
            },
            elements=elements,
            stylesheet=default_stylesheet
        )
    ], style={
        'width': '100%', 
        'background-color': background_color, 
        'border': '1px solid #334155', # Slate 700
        'border-radius': '12px',
        'box-shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
        'overflow': 'hidden',
        'margin-bottom': '30px'
    })
], fluid=True, style={'background-color': '#020617', 'min-height': '100vh', 'padding': '20px'})

@app.callback(
    Output('mouseoverNodeData', 'children'),
    Input('cytoscape', 'mouseoverNodeData')
)
def display_hover_data(data):
    if data:
        return data.get('label', 'Unknown')
    return 'None'

@app.callback(
    Output('cytoscape', 'stylesheet'),
    [Input('cytoscape', 'tapNode')]
)
def generate_stylesheet(node):
    if not node:
        return default_stylesheet
    
    node_id = node['data']['id']
    
    # Faded background style for non-selected elements
    stylesheet = [
        {
            'selector': 'node',
            'style': {
                'label': 'data(label)',
                'background-fill': 'radial-gradient',
                'background-gradient-stop-colors': 'data(background_color)',
                'background-gradient-stop-positions': '0, 80, 90, 100',
                'color': 'data(color)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': 'data(font_size)',
                'border-color': 'data(border_color)',
                'border-width': 1.5,
                'width': 'data(size)',
                'height': 'data(size)',
                'opacity': 0.2
            }
        },
        {
            'selector': 'edge',
            'style': {
                'line-fill': 'linear-gradient',
                'line-gradient-stop-colors': 'data(colors)',
                'line-gradient-stop-positions': '10, 20, 30, 40, 50, 60, 70, 80, 90',
                'width': 'data(width)',
                'curve-style': 'bezier',
                'opacity': 0.1
            }
        },
        {
            'selector': f'node[id = "{node_id}"]',
            'style': {
                'label': 'data(label)',
                'background-fill': 'radial-gradient',
                'background-gradient-stop-colors': 'data(background_color_chosen)',
                'background-gradient-stop-positions': '0, 98, 99, 100',
                'color': 'data(color_chosen)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': 'data(font_size)',
                'border-color': 'data(border_color)',
                'border-width': 1.5,
                'width': 'data(size)',
                'height': 'data(size)',
                'opacity': 0.98,
                'z-index': 9999
            }
        }
    ]
    
    # Highlight connected edges and target nodes
    for edge in node.get("edgesData", []):
        if edge['source'] == node_id or edge['target'] == node_id:
            target_node = edge['target'] if edge['source'] == node_id else edge['source']
            stylesheet.append({
                'selector': f'node[id = "{target_node}"]',
                'style': {
                    'opacity': 0.98,
                    'border-color': 'data(border_color)'
                }
            })
            stylesheet.append({
                'selector': f'edge[id = "{edge["id"]}"]',
                'style': {
                    'line-gradient-stop-colors': 'data(colors_chosen)',
                    'opacity': 0.8,
                    'width': 7
                }
            })
            
    return stylesheet

if __name__ == '__main__':
    app.run(debug=True)
