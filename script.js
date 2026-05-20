/* ═══════════════════════════════════════════════════════════
   GLOBAL OIL TRADE NETWORK — Interactive visualization
   ═══════════════════════════════════════════════════════════ */

/* ── Region definitions ─────────────────────────────────── */
const REGIONS = {
    'Africa': {
        color: '#FBBF24',
        glow:  '#78350f',
        countries: new Set([
            'Algeria', 'Angola', 'Cameroon', 'Congo (Republic)', "Cote d'Ivoire",
            'Egypt', 'Equatorial Guinea', 'Gabon', 'Ghana', 'Libya', 'Morocco',
            'Nigeria', 'South Africa', 'Sudan'
        ])
    },
    'Middle East': {
        color: '#34D399',
        glow:  '#064e3b',
        countries: new Set([
            'Bahrain', 'Iran', 'Iraq', 'Kuwait', 'Oman', 'Qatar',
            'Saudi Arabia', 'United Arab Emirates'
        ])
    },
    'Asia-Pacific': {
        color: '#F87171',
        glow:  '#7f1d1d',
        countries: new Set([
            'Australia', 'China', 'Hong Kong', 'India', 'Indonesia', 'Japan',
            'Korea (South)', 'Malaysia', 'Pakistan', 'Papua New Guinea',
            'Singapore', 'Thailand', 'Philippines', 'Vietnam', 'Taiwan'
        ])
    },
    'Europe': {
        color: '#818CF8',
        glow:  '#312e81',
        countries: new Set([
            'Belgium', 'Bulgaria', 'Canary Islands', 'Denmark', 'Estonia',
            'Finland', 'France', 'Georgia', 'Germany', 'Gibraltar', 'Greece',
            'Italy', 'Lithuania', 'Malta', 'Netherlands', 'Norway', 'Poland',
            'Portugal', 'Romania', 'Russia', 'Spain', 'Sweden', 'United Kingdom',
            'Ireland', 'Ukraine', 'Croatia', 'Turkey', 'Latvia'
        ])
    },
    'Americas': {
        color: '#FB923C',
        glow:  '#7c2d12',
        countries: new Set([
            'Argentina', 'Aruba', 'Bahamas', 'Bonaire', 'Brazil', 'Canada',
            'Chile', 'Colombia', 'Curacao', 'Ecuador', 'Mexico', 'Panama',
            'Sint Eustatius', 'United States of America', 'Venezuela',
            'Peru', 'Trinidad and Tobago', 'Dominican Republic'
        ])
    }
};

const OTHER_COLOR = '#94A3B8';

function getRegion(countryName) {
    for (const [name, data] of Object.entries(REGIONS)) {
        if (data.countries.has(countryName)) return name;
    }
    return 'Other';
}

function getRegionColor(regionName) {
    return REGIONS[regionName]?.color || OTHER_COLOR;
}

/* ── State ──────────────────────────────────────────────── */
const state = {
    cy: null,
    activeRegion: 'all',
    minSize: 10,
    searchTerm: '',
    showCrossEdges: true,
    hideLoops: false,
    selectedNode: null
};

/* ── DOM Refs ───────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const dom = {
    statNodes:     $('stat-nodes'),
    statEdges:     $('stat-edges'),
    hoverLabel:    $('hover-label'),
    regionFilters: $('region-filters'),
    legend:        $('legend-list'),
    searchInput:   $('search-input'),
    sizeFilter:    $('size-filter'),
    sizeValue:     $('size-value'),
    sizeHint:      $('size-hint'),
    crossEdges:    $('cross-edges'),
    hideLoops:     $('hide-loops'),
    resetBtn:      $('reset-btn'),
    loading:       $('loading-overlay'),
    tooltip:       $('node-tooltip'),
    ttName:        $('tt-name'),
    ttRegion:      $('tt-region'),
    ttDegree:      $('tt-degree'),
    infoBar:       $('info-bar'),
    infoName:      $('info-name'),
    infoRegion:    $('info-region'),
    infoDegree:    $('info-degree'),
    infoClose:     $('info-close')
};

/* ═══════════════════════════════════════════════════════════
   LOAD & INITIALISE
   ═══════════════════════════════════════════════════════════ */
fetch('elements.json')
    .then(res => res.json())
    .then(rawElements => {
        // Enrich nodes with region info
        const elements = rawElements.map(el => {
            const data = { ...el.data };
            if (!data.source) { // node
                const region = getRegion(data.id);
                data.region = region;
                data.regionColor = getRegionColor(region);
            }
            return { data };
        });

        // Stats
        const nodeCount = elements.filter(e => !e.data.source).length;
        const edgeCount = elements.filter(e =>  e.data.source).length;
        dom.statNodes.textContent = nodeCount;
        dom.statEdges.textContent = edgeCount;

        // Build sidebar
        buildRegionFilters(elements);
        buildLegend();

        // Initialise cytoscape
        initCytoscape(elements);
    })
    .catch(err => {
        console.error('Failed to load elements.json:', err);
        dom.hoverLabel.textContent = 'Load error';
        dom.loading.innerHTML = '<div style="color:#F87171">⚠ Error loading data</div>';
    });

/* ═══════════════════════════════════════════════════════════
   BUILD SIDEBAR UI
   ═══════════════════════════════════════════════════════════ */
function buildRegionFilters(elements) {
    // Count nodes per region
    const counts = { all: 0 };
    Object.keys(REGIONS).forEach(r => counts[r] = 0);
    counts['Other'] = 0;

    elements.forEach(el => {
        if (!el.data.source) {
            counts.all++;
            counts[el.data.region]++;
        }
    });

    const regions = [
        { key: 'all',   label: 'All Regions', color: OTHER_COLOR },
        ...Object.entries(REGIONS).map(([k, v]) => ({ key: k, label: k, color: v.color })),
    ];
    if (counts['Other'] > 0) {
        regions.push({ key: 'Other', label: 'Other', color: OTHER_COLOR });
    }

    dom.regionFilters.innerHTML = regions.map(r => `
        <label class="region-chip ${r.key === 'all' ? 'active' : ''}" data-region="${r.key}">
            <span class="chip-dot" style="background:${r.color};color:${r.color}"></span>
            <span>${r.label}</span>
            <span class="chip-count">${counts[r.key] ?? 0}</span>
        </label>
    `).join('');

    dom.regionFilters.querySelectorAll('.region-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.regionFilters.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeRegion = chip.dataset.region;
            applyFilters();
        });
    });
}

function buildLegend() {
    dom.legend.innerHTML = Object.entries(REGIONS).map(([name, data]) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${data.color};box-shadow:0 0 8px ${data.color}55"></span>
            <span>${name}</span>
        </div>
    `).join('');
}

/* ═══════════════════════════════════════════════════════════
   CYTOSCAPE INITIALISATION
   ═══════════════════════════════════════════════════════════ */
function initCytoscape(elements) {
    state.cy = cytoscape({
        container: $('cy'),
        elements: elements,
        wheelSensitivity: 0.2,
        minZoom: 0.15,
        maxZoom: 4,
        layout: {
            name: 'cola',
            animate: true,
            refresh: 1,
            maxSimulationTime: 3500,
            nodeSpacing: 14,
            edgeLength: 110,
            randomize: false,
            avoidOverlap: true,
            handleDisconnected: true,
            convergenceThreshold: 0.01,
            fit: true,
            padding: 40
        },
        style: [
            /* ── Base nodes ── */
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'background-color': 'data(regionColor)',
                    'background-opacity': 0.85,
                    'border-color': 'data(regionColor)',
                    'border-width': 2,
                    'border-opacity': 1,
                    'color': '#ffffff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': 'data(font_size)',
                    'font-family': 'Barlow Condensed, sans-serif',
                    'font-weight': 700,
                    'width': 'data(size)',
                    'height': 'data(size)',
                    'text-outline-color': '#050b14',
                    'text-outline-width': 2,
                    'text-outline-opacity': 0.95,
                    'overlay-opacity': 0,
                    'transition-property': 'background-opacity, border-width, opacity',
                    'transition-duration': '0.15s'
                }
            },

            /* ── Base edges ── */
            {
                selector: 'edge',
                style: {
                    'width': 'data(width)',
                    'line-color': '#3d5578',
                    'curve-style': 'bezier',
                    'opacity': 0.35,
                    'target-arrow-color': '#3d5578',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 0.8,
                    'transition-property': 'opacity, line-color, width',
                    'transition-duration': '0.15s'
                }
            },

            /* ── Self-loops ── */
            {
                selector: 'edge[source = "target"]',
                style: { 'curve-style': 'bezier' }
            },

            /* ── Hover ── */
            {
                selector: 'node:active, node.hovered',
                style: {
                    'border-width': 4,
                    'background-opacity': 1,
                    'z-index': 9999
                }
            },

            /* ── Faded ── */
            {
                selector: '.faded',
                style: {
                    'opacity': 0.08,
                    'text-opacity': 0.1
                }
            },

            /* ── Highlighted node ── */
            {
                selector: 'node.highlighted',
                style: {
                    'background-opacity': 1,
                    'border-color': '#F0B429',
                    'border-width': 4,
                    'color': '#ffffff',
                    'z-index': 9999,
                    'text-outline-color': '#F0B429',
                    'text-outline-width': 1
                }
            },

            /* ── Connected nodes ── */
            {
                selector: 'node.connected',
                style: {
                    'opacity': 1,
                    'background-opacity': 1,
                    'border-width': 3,
                    'z-index': 100
                }
            },

            /* ── Highlighted edges ── */
            {
                selector: 'edge.highlighted-edge',
                style: {
                    'line-color': '#F0B429',
                    'target-arrow-color': '#F0B429',
                    'opacity': 0.9,
                    'width': 'mapData(weight, 0, 8000000000, 2, 8)',
                    'z-index': 500
                }
            },

            /* ── Search match ── */
            {
                selector: 'node.search-match',
                style: {
                    'border-color': '#F0B429',
                    'border-width': 4,
                    'background-opacity': 1,
                    'opacity': 1,
                    'z-index': 9999
                }
            },

            /* ── Filter-hidden ── */
            {
                selector: '.hidden',
                style: {
                    'display': 'none'
                }
            }
        ]
    });

    // Hide loading overlay when layout settles
    state.cy.one('layoutstop', () => {
        dom.loading.classList.add('hidden');
    });
    // Fallback in case layoutstop doesn't fire
    setTimeout(() => dom.loading.classList.add('hidden'), 4500);

    setupInteractions();
    setupFilterListeners();
}

/* ═══════════════════════════════════════════════════════════
   INTERACTIONS
   ═══════════════════════════════════════════════════════════ */
function setupInteractions() {
    const cy = state.cy;

    /* ── Hover ── */
    cy.on('mouseover', 'node', evt => {
        const node = evt.target;
        node.addClass('hovered');
        dom.hoverLabel.textContent = node.data('label');

        // Position tooltip
        const renderedPos = node.renderedPosition();
        const cyBox = $('cy').getBoundingClientRect();
        dom.ttName.textContent   = node.data('label');
        dom.ttRegion.textContent = node.data('region');
        dom.ttDegree.textContent = node.connectedEdges().length;
        dom.tooltip.style.left = (cyBox.left + renderedPos.x + 20) + 'px';
        dom.tooltip.style.top  = (cyBox.top  + renderedPos.y - 10) + 'px';
        dom.tooltip.classList.add('visible');
    });

    cy.on('mouseout', 'node', evt => {
        evt.target.removeClass('hovered');
        dom.hoverLabel.textContent = 'None';
        dom.tooltip.classList.remove('visible');
    });

    cy.on('pan zoom', () => {
        dom.tooltip.classList.remove('visible');
    });

    /* ── Click background → reset ── */
    cy.on('tap', evt => {
        if (evt.target === cy) clearSelection();
    });

    /* ── Click node → highlight neighbourhood ── */
    cy.on('tap', 'node', evt => {
        const node = evt.target;
        const connectedEdges = node.connectedEdges(':visible');
        const connectedNodes = connectedEdges.connectedNodes(':visible');

        cy.elements(':visible').addClass('faded')
                               .removeClass('highlighted connected highlighted-edge');

        node.removeClass('faded').addClass('highlighted');
        connectedNodes.removeClass('faded').addClass('connected');
        connectedEdges.removeClass('faded').addClass('highlighted-edge');

        state.selectedNode = node;
        showInfoBar(node);
    });

    /* ── Info bar close ── */
    dom.infoClose.addEventListener('click', clearSelection);
}

function clearSelection() {
    state.cy.elements().removeClass('faded highlighted connected highlighted-edge search-match');
    state.selectedNode = null;
    dom.infoBar.classList.remove('visible');
    if (state.searchTerm) {
        applySearch(); // re-apply search highlights
    }
}

function showInfoBar(node) {
    const region = node.data('region');
    const color  = node.data('regionColor');
    dom.infoName.textContent   = node.data('label');
    dom.infoRegion.textContent = region;
    dom.infoRegion.style.background = color + '22';
    dom.infoRegion.style.color = color;
    dom.infoRegion.style.border = `1px solid ${color}`;
    dom.infoDegree.textContent = `${node.connectedEdges(':visible').length} active links`;
    dom.infoBar.classList.add('visible');
}

/* ═══════════════════════════════════════════════════════════
   FILTERS
   ═══════════════════════════════════════════════════════════ */
function setupFilterListeners() {
    // Search (debounced)
    let searchTimer;
    dom.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.searchTerm = e.target.value.trim().toLowerCase();
            applySearch();
        }, 120);
    });

    // Size slider
    dom.sizeFilter.addEventListener('input', e => {
        state.minSize = parseFloat(e.target.value);
        dom.sizeValue.textContent = state.minSize;
        dom.sizeHint.textContent  = state.minSize;
        applyFilters();
    });

    // Toggles
    dom.crossEdges.addEventListener('change', e => {
        state.showCrossEdges = e.target.checked;
        applyFilters();
    });

    dom.hideLoops.addEventListener('change', e => {
        state.hideLoops = e.target.checked;
        applyFilters();
    });

    // Reset
    dom.resetBtn.addEventListener('click', () => {
        state.activeRegion = 'all';
        state.minSize = 10;
        state.searchTerm = '';
        state.showCrossEdges = true;
        state.hideLoops = false;

        dom.searchInput.value = '';
        dom.sizeFilter.value = 10;
        dom.sizeValue.textContent = 10;
        dom.sizeHint.textContent  = 10;
        dom.crossEdges.checked = true;
        dom.hideLoops.checked = false;

        dom.regionFilters.querySelectorAll('.region-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.region === 'all');
        });

        clearSelection();
        applyFilters();
        state.cy.fit(null, 40);
    });
}

function applyFilters() {
    const cy = state.cy;
    if (!cy) return;

    cy.batch(() => {
        // Reset hidden state
        cy.elements().removeClass('hidden');

        // Filter nodes by region + size
        cy.nodes().forEach(node => {
            const region = node.data('region');
            const size   = node.data('size');
            let hide = false;

            if (state.activeRegion !== 'all' && region !== state.activeRegion) hide = true;
            if (size < state.minSize) hide = true;

            if (hide) node.addClass('hidden');
        });

        // Filter edges
        cy.edges().forEach(edge => {
            const src = cy.getElementById(edge.data('source'));
            const tgt = cy.getElementById(edge.data('target'));

            let hide = false;
            if (src.hasClass('hidden') || tgt.hasClass('hidden')) hide = true;
            if (state.hideLoops && edge.data('source') === edge.data('target')) hide = true;

            // Cross-region filter (only matters when a specific region is selected)
            if (!state.showCrossEdges && state.activeRegion !== 'all') {
                const sReg = src.data('region');
                const tReg = tgt.data('region');
                if (sReg !== state.activeRegion || tReg !== state.activeRegion) hide = true;
            }

            if (hide) edge.addClass('hidden');
        });

        // Update stats with visible counts
        const visNodes = cy.nodes(':visible').length;
        const visEdges = cy.edges(':visible').length;
        dom.statNodes.textContent = visNodes;
        dom.statEdges.textContent = visEdges;
    });

    // Re-apply search if active
    if (state.searchTerm) applySearch();
    // Keep selection styling if a node is selected
    if (state.selectedNode && !state.selectedNode.hasClass('hidden')) {
        // re-highlight
        const node = state.selectedNode;
        const connectedEdges = node.connectedEdges(':visible');
        const connectedNodes = connectedEdges.connectedNodes(':visible');
        cy.elements(':visible').addClass('faded')
                               .removeClass('highlighted connected highlighted-edge');
        node.removeClass('faded').addClass('highlighted');
        connectedNodes.removeClass('faded').addClass('connected');
        connectedEdges.removeClass('faded').addClass('highlighted-edge');
    }
}

function applySearch() {
    const cy = state.cy;
    cy.nodes().removeClass('search-match');

    if (!state.searchTerm) return;

    const matches = cy.nodes(':visible').filter(n =>
        n.data('label').toLowerCase().includes(state.searchTerm)
    );
    matches.addClass('search-match');

    if (matches.length > 0 && matches.length <= 5) {
        cy.animate({ fit: { eles: matches, padding: 80 } }, { duration: 600 });
    }
}
