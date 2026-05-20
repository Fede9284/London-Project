fetch('elements.json')
    .then(res => res.json())
    .then(elements => {
        
        // Re-map elements array so it strictly matches Cytoscape.js format.
        // Dash generates a format with nested data: {} properties, which Cytoscape.js likes.
        
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            layout: {
                name: 'cola',
                animate: true,
                maxSimulationTime: 3000 // Give it a short time to organize attractively
            },
            style: [
                // Base Node Styles
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'background-fill': 'radial-gradient',
                        'background-gradient-stop-colors': 'data(background_color)',
                        'background-gradient-stop-positions': '0 80 90 100',
                        'color': 'data(color)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': 'data(font_size)',
                        'border-color': 'data(border_color)',
                        'border-width': 1.5,
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'opacity': 0.95,
                        'text-outline-color': '#0f172a',
                        'text-outline-width': 1,
                        'text-outline-opacity': 0.5
                    }
                },
                // Base Edge Styles
                {
                    selector: 'edge',
                    style: {
                        'line-fill': 'linear-gradient',
                        'line-gradient-stop-colors': 'data(colors)',
                        'line-gradient-stop-positions': '10 20 30 40 50 60 70 80 90',
                        'width': 'data(width)',
                        'curve-style': 'bezier',
                        'opacity': 0.6
                    }
                },
                // Faded out elements (not highlighted)
                {
                    selector: 'node.faded',
                    style: {
                        'opacity': 0.2
                    }
                },
                {
                    selector: 'edge.faded',
                    style: {
                        'opacity': 0.1
                    }
                },
                // Highlighted Nodes (Target)
                {
                    selector: 'node.highlighted',
                    style: {
                        'background-gradient-stop-colors': 'data(background_color_chosen)',
                        'background-gradient-stop-positions': '0 98 99 100',
                        'color': 'data(color_chosen)',
                        'border-width': 1.5,
                        'opacity': 0.98,
                        'z-index': 9999
                    }
                },
                // Keep connected nodes fully visible
                {
                    selector: 'node.connected',
                    style: {
                        'opacity': 0.98,
                        'border-color': 'data(border_color)'
                    }
                },
                // Highlighted Edges
                {
                    selector: 'edge.highlighted-edge',
                    style: {
                        'line-gradient-stop-colors': 'data(colors_chosen)',
                        'opacity': 0.8,
                        'width': 7
                    }
                }
            ]
        });

        // Hover Effect
        cy.on('mouseover', 'node', function(evt){
            let node = evt.target;
            document.getElementById('hovered-country').innerText = node.data('label');
        });

        cy.on('mouseout', 'node', function(evt){
            document.getElementById('hovered-country').innerText = 'None';
        });

        // Tap/Click Effect
        cy.on('tap', function(evt){
            // If background is clicked, reset
            if( evt.target === cy ){
                cy.elements().removeClass('faded highlighted connected highlighted-edge');
            }
        });

        cy.on('tap', 'node', function(evt){
            let node = evt.target;
            let connectedEdges = node.connectedEdges();
            let connectedNodes = connectedEdges.connectedNodes();
            
            // Fade out everything
            cy.elements().addClass('faded').removeClass('highlighted connected highlighted-edge');
            
            // Bring target back
            node.removeClass('faded').addClass('highlighted');
            
            // Bring dependencies back
            connectedNodes.removeClass('faded').addClass('connected');
            connectedEdges.removeClass('faded').addClass('highlighted-edge');
        });

    })
    .catch(error => {
        console.error("Error loading elements.json: ", error);
        document.getElementById('hovered-country').innerText = 'Error loading data.';
    });