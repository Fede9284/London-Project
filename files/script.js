/* ═══════════════════════════════════════════════════════════
   GLOBAL OIL TRADE NETWORK — Interactive visualization
   ═══════════════════════════════════════════════════════════ */

/* ── Region definitions ─────────────────────────────────── */
const REGIONS = {
    'Africa': {
        color: '#FBBF24',
        countries: new Set([
            'Algeria', 'Angola', 'Cameroon', 'Congo (Republic)', "Cote d'Ivoire",
            'Egypt', 'Equatorial Guinea', 'Gabon', 'Ghana', 'Libya', 'Morocco',
            'Nigeria', 'South Africa', 'Sudan'
        ])
    },
    'Middle East': {
        color: '#34D399',
        countries: new Set([
            'Bahrain', 'Iran', 'Iraq', 'Kuwait', 'Oman', 'Qatar',
            'Saudi Arabia', 'United Arab Emirates'
        ])
    },
    'Asia-Pacific': {
        color: '#F87171',
        countries: new Set([
            'Australia', 'China', 'Hong Kong', 'India', 'Indonesia', 'Japan',
            'Korea (South)', 'Malaysia', 'Pakistan', 'Papua New Guinea',
            'Singapore', 'Thailand', 'Philippines', 'Vietnam', 'Taiwan'
        ])
    },
    'Europe': {
        color: '#818CF8',
        countries: new Set([
            'Belgium', 'Bulgaria', 'Canary Islands', 'Denmark', 'Estonia',
            'Finland', 'France', 'Georgia', 'Germany', 'Gibraltar', 'Greece',
            'Italy', 'Lithuania', 'Malta', 'Netherlands', 'Norway', 'Poland',
            'Portugal', 'Romania', 'Russia', 'Spain', 'Sweden', 'United Kingdom',
            'Ireland', 'Ukraine', 'Croatia', 'Turkey', 'Latvia'
        ])
    },
    'North America': {
        color: '#FB923C',
        countries: new Set([
            'United States of America', 'Canada', 'Mexico'
        ])
    },
    'Latin America': {
        color: '#EC4899',
        countries: new Set([
            'Argentina', 'Aruba', 'Bahamas', 'Bonaire', 'Brazil', 'Chile',
            'Colombia', 'Curacao', 'Ecuador', 'Panama', 'Sint Eustatius',
            'Venezuela', 'Peru', 'Trinidad and Tobago', 'Dominican Republic'
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
        // Build node→region lookup pass 1
        const nodeRegion = {};
        rawElements.forEach(el => {
            if (!el.data.source) {
                nodeRegion[el.data.id] = getRegion(el.data.id);
            }
        });

        // Enrich nodes + edges
        const elements = rawElements.map(el => {
            const data = { ...el.data };

            if (!data.source) {
                // ── Node ──
                const region = nodeRegion[data.id];
                data.region = region;
                data.regionColor = getRegionColor(region);
            } else {
                // ── Edge ──
                const sReg = nodeRegion[data.source] || 'Other';
                const tReg = nodeRegion[data.target] || 'Other';
                const sCol = getRegionColor(sReg);
                const tCol = getRegionColor(tReg);
                data.sourceRegion = sReg;
                data.targetRegion = tReg;
                data.sourceColor  = sCol;
                data.targetColor  = tCol;
                // gradient string: source colour fades to target colour
                data.gradientColors = `${sCol} ${tCol}`;
                data.isCrossRegion = sReg !== tReg;
                data.isSelfLoop = data.source === data.target;
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
    const counts = { all: 0, Other: 0 };
    Object.keys(REGIONS).forEach(r => counts[r] = 0);

    elements.forEach(el => {
        if (!el.data.source) {
            counts.all++;
            counts[el.data.region] = (counts[el.data.region] || 0) + 1;
        }
    });

    const regions = [
        { key: 'all', label: 'All Regions', color: OTHER_COLOR },
        ...Object.entries(REGIONS).map(([k, v]) => ({ key: k, label: k, color: v.color }))
    ];
    if (counts.Other > 0) {
        regions.push({ key: 'Other', label: 'Other', color: OTHER_COLOR });
    }

    dom.regionFilters.innerHTML = regions.map(r => `
        <label class="region-chip ${r.key === 'all' ? 'active' : ''}" data-region="${r.key}">
            <span class="chip-dot" style="background:${r.color};box-shadow:0 0 6px ${r.color}"></span>
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
            <span class="legend-dot" style="background:${data.color};box-shadow:0 0 8px ${data.color}66"></span>
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
                    'background-opacity': 0.88,
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

            /* ── Base edges: gradient by region ── */
            {
                selector: 'edge',
                style: {
                    'width': 'data(width)',
                    'line-fill': 'linear-gradient',
                    'line-gradient-stop-colors': 'data(gradientColors)',
                    'line-gradient-stop-positions': '0 100',
                    'curve-style': 'bezier',
                    'opacity': 0.5,
                    'target-arrow-color': 'data(targetColor)',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 0.9,
                    'transition-property': 'opacity, width',
                    'transition-duration': '0.15s'
                }
            },

            /* ── Self-loops: single colour, slightly dimmer ── */
            {
                selector: 'edge[?isSelfLoop]',
                style: {
                    'opacity': 0.35,
                    'curve-style': 'bezier',
                    'control-point-step-size': 80
                }
            },

            /* ── Cross-region edges: a touch more visible ── */
            {
                selector: 'edge[?isCrossRegion]',
                style: {
                    'opacity': 0.6
                }
            },

            /* ── Hover ── */
            {
                selector: 'node.hovered',
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
                    'opacity': 0.06,
                    'text-opacity': 0.08
                }
            },

            /* ── Highlighted node (clicked) ── */
            {
                selector: 'node.highlighted',
                style: {
                    'background-opacity': 1,
                    'border-color': '#F0B429',
                    'border-width': 4,
                    'color': '#ffffff',
                    'z-index': 9999,
                    'text-outline-color': '#7a4a00',
                    'text-outline-width': 1.5
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

            /* ── Highlighted edges: gold gradient ── */
            {
                selector: 'edge.highlighted-edge',
                style: {
                    'line-gradient-stop-colors': '#F0B429 #FBBF24',
                    'target-arrow-color': '#F0B429',
                    'opacity': 1,
                    'width': 'mapData(weight, 0, 8000000000, 3, 10)',
                    'z-index': 500
                }
            },

            /* ── Search match ── */
            {
                selector: 'node.search-match',
                style: {
                    'border-color': '#F0B429',
                    'border-width': 5,
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

    state.cy.one('layoutstop', () => dom.loading.classList.add('hidden'));
    setTimeout(() => dom.loading.classList.add('hidden'), 4500);

    setupInteractions();
    setupFilterListeners();
}

/* ═══════════════════════════════════════════════════════════
   INTERACTIONS
   ═══════════════════════════════════════════════════════════ */
function setupInteractions() {
    const cy = state.cy;

    cy.on('mouseover', 'node', evt => {
        const node = evt.target;
        node.addClass('hovered');
        dom.hoverLabel.textContent = node.data('label');

        const renderedPos = node.renderedPosition();
        const cyBox = $('cy').getBoundingClientRect();
        dom.ttName.textContent   = node.data('label');
        dom.ttRegion.textContent = node.data('region');
        dom.ttDegree.textContent = node.connectedEdges(':visible').length;
        dom.tooltip.style.left = (cyBox.left + renderedPos.x + 20) + 'px';
        dom.tooltip.style.top  = (cyBox.top  + renderedPos.y - 10) + 'px';
        dom.tooltip.classList.add('visible');
    });

    cy.on('mouseout', 'node', evt => {
        evt.target.removeClass('hovered');
        dom.hoverLabel.textContent = 'None';
        dom.tooltip.classList.remove('visible');
    });

    cy.on('pan zoom', () => dom.tooltip.classList.remove('visible'));

    cy.on('tap', evt => {
        if (evt.target === cy) clearSelection();
    });

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

    dom.infoClose.addEventListener('click', clearSelection);
}

function clearSelection() {
    state.cy.elements().removeClass('faded highlighted connected highlighted-edge search-match');
    state.selectedNode = null;
    dom.infoBar.classList.remove('visible');
    if (state.searchTerm) applySearch();
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
    let searchTimer;
    dom.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.searchTerm = e.target.value.trim().toLowerCase();
            applySearch();
        }, 120);
    });

    dom.sizeFilter.addEventListener('input', e => {
        state.minSize = parseFloat(e.target.value);
        dom.sizeValue.textContent = state.minSize;
        dom.sizeHint.textContent  = state.minSize;
        applyFilters();
    });

    dom.crossEdges.addEventListener('change', e => {
        state.showCrossEdges = e.target.checked;
        applyFilters();
    });

    dom.hideLoops.addEventListener('change', e => {
        state.hideLoops = e.target.checked;
        applyFilters();
    });

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
        cy.elements().removeClass('hidden');

        // Nodes
        cy.nodes().forEach(node => {
            const region = node.data('region');
            const size   = node.data('size');
            let hide = false;
            if (state.activeRegion !== 'all' && region !== state.activeRegion) hide = true;
            if (size < state.minSize) hide = true;
            if (hide) node.addClass('hidden');
        });

        // Edges
        cy.edges().forEach(edge => {
            const src = cy.getElementById(edge.data('source'));
            const tgt = cy.getElementById(edge.data('target'));
            let hide = false;

            if (src.hasClass('hidden') || tgt.hasClass('hidden')) hide = true;
            if (state.hideLoops && edge.data('isSelfLoop')) hide = true;

            if (!state.showCrossEdges && state.activeRegion !== 'all') {
                if (edge.data('sourceRegion') !== state.activeRegion ||
                    edge.data('targetRegion') !== state.activeRegion) hide = true;
            }

            if (hide) edge.addClass('hidden');
        });

        // Update stats with visible counts
        dom.statNodes.textContent = cy.nodes(':visible').length;
        dom.statEdges.textContent = cy.edges(':visible').length;
    });

    if (state.searchTerm) applySearch();

    // Restore selection highlight if still visible
    if (state.selectedNode && !state.selectedNode.hasClass('hidden')) {
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
