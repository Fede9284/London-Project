import pandas as pd
import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
from scipy.spatial.distance import pdist
from scipy.cluster.hierarchy import linkage, optimal_leaf_ordering, leaves_list

# Read the Excel file
filename = 'DataOli.xlsx'
try:
    data = pd.read_excel(filename)
except FileNotFoundError:
    print(f"File {filename} not found. Please ensure it's in the same directory.")
    # Exit or handle gracefully if file is not found. Continuing with dummy data is possible but we just print and raise.
    raise

# Extract relevant columns and clean missing values
data = data.dropna(subset=['destination_countryname', 'origin_countryname', 'loadedbarrels'])
data = data[data['destination_countryname'] != '']
data = data[data['origin_countryname'] != '']

# Group by destination and origin, sum the barrels
grouped_data = data.groupby(['destination_countryname', 'origin_countryname'])['loadedbarrels'].sum().reset_index()

# Get unique country names
all_countries = pd.unique(data[['destination_countryname', 'origin_countryname']].values.ravel('K'))
n = len(all_countries)

# Initialize matrix and create mapping
oil_matrix = np.zeros((n, n))
country_map = {country: i for i, country in enumerate(all_countries)}

# Populate oil matrix
for _, row in grouped_data.iterrows():
    dest_idx = country_map[row['destination_countryname']]
    orig_idx = country_map[row['origin_countryname']]
    oil_matrix[dest_idx, orig_idx] += row['loadedbarrels']

# Convert matrix to DataFrame and save output
oil_matrix_df = pd.DataFrame(oil_matrix, index=all_countries, columns=all_countries)
oil_matrix_df.to_excel('oil_trade_matrix.xlsx')
print('Oil trade matrix saved as oil_trade_matrix.xlsx')

# --- Directed Graph ---
G = nx.DiGraph()
for _, row in grouped_data.iterrows():
    G.add_edge(row['origin_countryname'], row['destination_countryname'], weight=row['loadedbarrels'])

plt.figure(figsize=(10, 8))
# using spring layout as an alternative to force layout
pos = nx.spring_layout(G, k=0.5, iterations=50) 
edges = G.edges()
weights = [G[u][v]['weight'] for u, v in edges]
max_weight = max(weights) if weights else 1
normalized_weights = [(w / max_weight) * 5 for w in weights]

nx.draw_networkx_nodes(G, pos, node_size=100, node_color='lightblue')
nx.draw_networkx_edges(G, pos, width=normalized_weights, alpha=0.5, arrows=True)
nx.draw_networkx_labels(G, pos, font_size=8)
plt.title('Oil Trade Network')
plt.axis('off')
plt.show()
print('Oil trade network graph generated.')

# --- Minimum Spanning Tree (MST) ---
UG = nx.Graph()
for _, row in grouped_data.iterrows():
    u = row['origin_countryname']
    v = row['destination_countryname']
    w = row['loadedbarrels']
    if w > 0:
        inv_w = 1.0 / w
        if UG.has_edge(u, v):
            # Keep the minimum inverse weight if multiple directed edges exist between same pairs undirected
            UG[u][v]['weight'] = min(UG[u][v]['weight'], inv_w)
        else:
            UG.add_edge(u, v, weight=inv_w)

# Calculate MST
MST = nx.minimum_spanning_tree(UG, weight='weight')

plt.figure(figsize=(10, 8))
pos_mst = nx.spring_layout(MST)
nx.draw_networkx(MST, pos_mst, with_labels=True, node_size=100, font_size=8, node_color='lightgreen', edge_color='gray')
plt.title('Minimum Spanning Tree of Oil Trade Network')
plt.axis('off')
plt.show()
print('Minimum Spanning Tree computed and plotted with country names.')

# --- Correlation Matrix & Traffic Matrix ---
oil_traffic_matrix = np.zeros((n, n))
for _, row in grouped_data.iterrows():
    row_idx = country_map[row['destination_countryname']]
    col_idx = country_map[row['origin_countryname']]
    oil_traffic_matrix[row_idx, col_idx] += row['loadedbarrels']
    oil_traffic_matrix[col_idx, row_idx] += row['loadedbarrels']  # Symmetric matrix

# Handle zero variance columns for correlation via numpy or pandas
traffic_df = pd.DataFrame(oil_traffic_matrix, index=all_countries, columns=all_countries)
correlation_matrix = traffic_df.corr().fillna(0).values # using pandas corr to handle NaNs safely and replace with 0

# --- Hierarchical Clustering (Single Linkage) ---
distance_matrix = pdist(oil_traffic_matrix, 'euclidean')
linkage_tree = linkage(distance_matrix, 'single')

# Optimal leaf ordering
Z = optimal_leaf_ordering(linkage_tree, distance_matrix)
ordered_indices = leaves_list(Z)

ordered_correlation_matrix = correlation_matrix[np.ix_(ordered_indices, ordered_indices)]
ordered_countries = all_countries[ordered_indices]

plt.figure(figsize=(10, 8))
corr_sq = ordered_correlation_matrix ** 2
plt.imshow(corr_sq, cmap='jet', vmin=0, vmax=1)
plt.colorbar()

plt.xticks(range(len(ordered_countries)), ordered_countries, rotation=90, fontdict={'fontsize': 8})
plt.yticks(range(len(ordered_countries)), ordered_countries, fontdict={'fontsize': 8})
plt.xlabel('Country')
plt.ylabel('Country')
plt.title('Correlation Squared for Oil Traffic (Ordered by Single Linkage)')
plt.tight_layout()
plt.show()
print('Correlation squared heatmap generated.')

# --- MST from correlations ---
# distance is 1 - corr^2
corr_dist_matrix = 1 - (correlation_matrix ** 2)
MSTcorr_graph = nx.Graph()
for i in range(n):
    for j in range(i + 1, n):
        MSTcorr_graph.add_edge(all_countries[i], all_countries[j], weight=corr_dist_matrix[i, j])

MSTcorr = nx.minimum_spanning_tree(MSTcorr_graph, weight='weight')

plt.figure(figsize=(10, 8))
pos_mst_corr = nx.spring_layout(MSTcorr)
nx.draw_networkx(MSTcorr, pos_mst_corr, with_labels=True, node_size=100, font_size=8, node_color='salmon', edge_color='gray')
plt.title('MST from Correlation Distances')
plt.axis('off')
plt.show()
print('MST from correlations computed and plotted.')

# --- Multivariate normal distribution parameters ---
mu = np.mean(oil_traffic_matrix, axis=0) # Mean vector
sigma = np.cov(oil_traffic_matrix, rowvar=False)  # Covariance matrix

print('Estimation of multivariate normal parameters completed.')
