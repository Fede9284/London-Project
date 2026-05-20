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
background_color = '#010103'
base_node_color = '#08B0D1'
base_edge_color = '#39c3da'
highlight_color = '#ff9936'

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
    
    # We create gradients for node styling
    bg_gradient_list = hex_gradient_list(base_node_color, background_color, 4)
    bg_color_str = f"{bg_gradient_list[2]} {base_node_color} {base_node_color}"
    
    highlight_gradient_list = hex_gradient_list(highlight_color, background_color, 4)
    highlight_color_str = f"{highlight_gradient_list[2]} {highlight_color} {highlight_color}"

    elements.append({
        'data': {
            'id': country,
            'label': country,
            'size': size,
            'color': '#ffffff',
            'color_chosen': '#ffffff',
            'background_color': bg_color_str,
            'background_color_chosen': highlight_color_str,
            'border_color': base_node_color,
            'border_color_chosen': highlight_color,
            'font_size': min(25, max(8, size / 2))
        }
    })

# Pre-compute edges
max_weight = filtered_edge_data['weight'].max()
for _, row in filtered_edge_data.iterrows():
    width = max(1, (row['weight'] / max_weight) * 10)
    colors_str = hex_gradient_str(background_color, base_edge_color, 10)
    
    elements.append({
        'data': {
            'id': f"{row['source']}_{row['target']}",
            'source': row['source'],
            'target': row['target'],
            'weight': row['weight'],
            'width': width,
            'colors': colors_str,
            'colors_chosen': hex_gradient_str(background_color, highlight_color, 10)
        }
    })

# --- CYTOSCAPE APP ---
app = Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])

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
    html.H2("Global Oil Trade Network", style={'color': '#ffffff', 'font-family': 'Courier New', 'padding-top': '20px', 'text-align': 'center'}),
    html.Div([
        html.Div([
            html.P('Hovered:', style={'color': '#ffffff', 'font-family': 'Courier New', 'display': 'inline-block', 'margin-right': '10px'}),
            html.Span(id='mouseoverNodeData', style={'color': '#08B0D1', 'font-family': 'Courier New', 'font-weight': 'bold'})
        ], style={'padding': '10px'}),
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
    ], style={'width': '100%', 'background-color': background_color, 'border': '1px solid #333'})
], fluid=True, style={'background-color': '#000000', 'min-height': '100vh'})

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
                'background-gradient-stop-positions': '0, 80, 90, 100',
                'color': 'data(color)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': 'data(font_size)',
                'border-color': 'data(border_color_chosen)',
                'border-width': 2.5,
                'width': 'data(size)',
                'height': 'data(size)',
                'opacity': 1.0,
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
                    'opacity': 1.0
                }
            })
            stylesheet.append({
                'selector': f'edge[id = "{edge["id"]}"]',
                'style': {
                    'line-gradient-stop-colors': 'data(colors_chosen)',
                    'opacity': 0.8,
                    'width': max(2, edge.get('width', 2) * 1.5)
                }
            })
            
    return stylesheet

if __name__ == '__main__':
    app.run(debug=True)
