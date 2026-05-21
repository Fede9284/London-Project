close all
clear

% Read the Excel file
filename = 'DataOli.xlsx';
data = readtable(filename);

% Extract relevant columns
destination = data.destination_countryname;
origin = data.origin_countryname;
barrels = data.loadedbarrels;

% Remove entries with missing values
valid_rows = ~isnan(barrels) & ~strcmp(destination, '') & ~strcmp(origin, '');
destination = destination(valid_rows);
origin = origin(valid_rows);
barrels = barrels(valid_rows);

% Get unique country names
all_countries = unique([destination; origin]);
n = length(all_countries);

% Create a mapping for country indices
country_map = containers.Map(all_countries, 1:n);

% Initialize matrix
oil_matrix = zeros(n, n);

% Aggregate barrel totals
for i = 1:length(barrels)
    dest_idx = country_map(destination{i});
    orig_idx = country_map(origin{i});
    oil_matrix(dest_idx, orig_idx) = oil_matrix(dest_idx, orig_idx) + barrels(i);
end

% Convert matrix to table
oil_matrix_table = array2table(oil_matrix, 'RowNames', all_countries, 'VariableNames', all_countries);

% Save output
writetable(oil_matrix_table, 'oil_trade_matrix.xlsx', 'WriteRowNames', true);

disp('Oil trade matrix saved as oil_trade_matrix.xlsx');

%% Extract relevant columns
% Create a table of unique pairs and sum the barrels
temp_table = table(destination, origin, barrels);
grouped_data = groupsummary(temp_table, {'destination', 'origin'}, 'sum', 'barrels');

% Extract aggregated values
destination = grouped_data.destination;
origin = grouped_data.origin;
total_barrels = grouped_data.sum_barrels;

% Create directed graph
G = digraph(origin, destination, total_barrels);

% Plot graph
figure;
h = plot(G, 'Layout', 'force'); %, 'EdgeLabel', G.Edges.Weight);
labelnode(h, 1:numnodes(G), G.Nodes.Name); % Label nodes with country names
set(h, 'LineWidth', G.Edges.Weight / max(G.Edges.Weight) * 5); % Scale edge thickness

% Customize appearance
title('Oil Trade Network');
set(gca, 'XTick', [], 'YTick', []);
axis off;

disp('Oil trade network graph generated.');

%% Symmetrize the graph to make it undirected
UG = graph(G.Edges.EndNodes(:,1), G.Edges.EndNodes(:,2), 1./G.Edges.Weight);

% Compute Minimum Spanning Tree (MST)
MST = minspantree(UG);

% Plot MST
figure;
h_mst = plot(MST, 'Layout', 'force');
labelnode(h_mst, 1:numnodes(MST), MST.Nodes.Name); % Label nodes with country names

% Customize appearance
title('Minimum Spanning Tree of Oil Trade Network');
set(gca, 'XTick', [], 'YTick', []);
axis off;

disp('Minimum Spanning Tree computed and plotted with country names.');

%% Compute correlation matrix
% Create a mapping for country indices
country_map = containers.Map(all_countries, 1:n);

% Initialize traffic matrix
oil_traffic_matrix = zeros(n, n);

% Populate traffic matrix
for i = 1:length(total_barrels)
    row_idx = country_map(destination{i});
    col_idx = country_map(origin{i});
    oil_traffic_matrix(row_idx, col_idx) = total_barrels(i);
    oil_traffic_matrix(col_idx, row_idx) = total_barrels(i); % Symmetric matrix
end

correlation_matrix = corrcoef(oil_traffic_matrix);


%% Compute hierarchical clustering order (single linkage)
distance_matrix = pdist(oil_traffic_matrix, 'euclidean');
linkage_tree = linkage(distance_matrix, 'single');
ordered_indices = optimalleaforder(linkage_tree, distance_matrix);

% Reorder correlation matrix
ordered_correlation_matrix = correlation_matrix(ordered_indices, ordered_indices);
ordered_countries = all_countries(ordered_indices);

% Plot heatmap
figure;
imagesc(ordered_correlation_matrix.^2);
colormap(jet);
colorbar;
caxis([-1, 1]); % Ensure color scale is from -1 to 1

% Set axis labels
xticks(1:length(ordered_countries));
yticks(1:length(ordered_countries));
xticklabels(ordered_countries);
yticklabels(ordered_countries);
xlabel('Country');
ylabel('Country');
title('Correlation Squared for Oil Traffic (Ordered by Single Linkage)');

% Rotate x-axis labels for readability
xtickangle(90);

disp('Correlation sauared heatmap generated.');

%% MST from correlations
MSTcorr = minspantree(graph(1-correlation_matrix.^2));
figure;
h_mst = plot(MSTcorr, 'Layout', 'force');
labelnode(h_mst, 1:numnodes(MST), MST.Nodes.Name); % Label nodes with country names

% Estimate multivariate normal distribution parameters
mu = mean(oil_traffic_matrix, 1); % Mean vector
sigma = cov(oil_traffic_matrix);   % Covariance matrix

