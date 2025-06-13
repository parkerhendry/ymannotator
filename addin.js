/**
 * Geotab Ruckit Assets Add-in
 * @returns {{initialize: Function, focus: Function, blur: Function}}
 */
geotab.addin.ruckitAssets = function () {
    'use strict';

    let api;
    let state;
    let elAddin;
    let ruckitMappings = [];

    /**
     * Make a Geotab API call
     */
    async function makeGeotabCall(method, typeName, parameters = {}) {
        if (!api) {
            throw new Error('Geotab API not initialized');
        }
        
        return new Promise((resolve, reject) => {
            const callParams = {
                typeName: typeName,
                ...parameters
            };
            
            api.call(method, callParams, resolve, reject);
        });
    }

    /**
     * Get AddInData entries for Ruckit mappings
     */
    async function getRuckitMappings() {
        try {
            const searchParams = {
                whereClause: 'type = "ri-device"'
            };
            
            const data = await makeGeotabCall("Get", "AddInData", { search: searchParams });
            return data || [];
        } catch (error) {
            console.error('Error fetching Ruckit mappings:', error);
            showAlert('Error fetching Ruckit mappings: ' + error.message, 'error');
            return [];
        }
    }

    /**
     * Show alert messages
     */
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;
        
        const alertId = 'alert-' + Date.now();
        
        const alertClass = type === 'error' ? 'alert-error' : 
                          type === 'success' ? 'alert-success' : 'alert-info';
        
        const alertHtml = `
            <div class="alert ${alertClass}" id="${alertId}">
                <span class="alert-message">${message}</span>
                <button type="button" class="alert-close" onclick="document.getElementById('${alertId}').remove()">×</button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }

    /**
     * Load and display Ruckit mappings
     */
    async function loadRuckitMappings() {
        try {
            showAlert('Loading Ruckit assets...', 'info');
            
            ruckitMappings = await getRuckitMappings();
            renderMappingsTable();
            
            if (ruckitMappings.length > 0) {
                showAlert(`Successfully loaded ${ruckitMappings.length} Ruckit assets`, 'success');
            } else {
                showAlert('No Ruckit assets found', 'info');
            }
            
        } catch (error) {
            console.error('Error loading Ruckit mappings:', error);
            showAlert('Error loading Ruckit assets: ' + error.message, 'error');
        }
    }

    /**
     * Render the mappings table
     */
    function renderMappingsTable() {
        const tableContainer = document.getElementById('mappingsTable');
        if (!tableContainer) return;

        if (ruckitMappings.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state text-center p-5">
                    <div class="empty-icon mb-3" style="font-size: 4rem;">📊</div>
                    <h3 class="mb-3">No Ruckit Assets Found</h3>
                    <p class="text-muted">There are currently no Ruckit device mappings configured in this database.</p>
                </div>
            `;
            return;
        }

        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-dark">
                        <tr>
                            <th scope="col">Asset Name</th>
                            <th scope="col">Ruckit Device</th>
                            <th scope="col">Ruckit Driver</th>
                            <th scope="col">Ruckit Token</th>
                            <th scope="col" class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ruckitMappings.map(mapping => {
                            const details = mapping.details || {};
                            const name = details.name || 'N/A';
                            const riDevice = details['ri-device'] || 'N/A';
                            const riDriver = details['ri-driver'] || 'N/A';
                            const riToken = details['ri-token'] || 'N/A';
                            const gtDevice = details['gt-device'] || '';
                            
                            return `
                                <tr>
                                    <td class="fw-bold text-primary">${name}</td>
                                    <td>${riDevice}</td>
                                    <td>${riDriver}</td>
                                    <td><code class="text-muted">${riToken}</code></td>
                                    <td class="text-center">
                                        ${gtDevice ? 
                                            `<button class="btn btn-warning btn-sm" onclick="window.open('https://my.geotab.com/traxxisdemo/#device,id:${gtDevice}', '_blank')">
                                                <i class="fas fa-external-link-alt me-1"></i>View Asset
                                            </button>` :
                                            '<span class="text-muted fst-italic">No Device ID</span>'
                                        }
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="d-flex justify-content-between align-items-center p-3 bg-light border-top">
                <div class="text-muted">
                    Showing ${ruckitMappings.length} asset${ruckitMappings.length !== 1 ? 's' : ''}
                </div>
                <button class="btn btn-primary btn-sm" onclick="window.refreshRuckitData()">
                    <i class="fas fa-sync-alt me-1"></i>
                    Refresh
                </button>
            </div>
        `;

        tableContainer.innerHTML = tableHtml;
        
        // Update stats
        if (window.updateAssetCount) {
            window.updateAssetCount(ruckitMappings.length);
        }
        if (window.updateLastUpdated) {
            window.updateLastUpdated();
        }
    }

    /**
     * Refresh the Ruckit mappings data
     */
    window.refreshRuckitData = function() {
        loadRuckitMappings();
    };

    /**
     * Export mappings data as CSV
     */
    function exportToCSV() {
        if (ruckitMappings.length === 0) {
            showAlert('No data to export', 'info');
            return;
        }

        const headers = ['Asset Name', 'Ruckit Device', 'Ruckit Driver', 'Ruckit Token', 'GT Device ID'];
        const csvContent = [
            headers.join(','),
            ...ruckitMappings.map(mapping => {
                const details = mapping.details || {};
                return [
                    `"${details.name || 'N/A'}"`,
                    `"${details['ri-device'] || 'N/A'}"`,
                    `"${details['ri-driver'] || 'N/A'}"`,
                    `"${details['ri-token'] || 'N/A'}"`,
                    `"${details['gt-device'] || 'N/A'}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ruckit-assets-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showAlert('Data exported successfully', 'success');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToCSV);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + R to refresh
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                loadRuckitMappings();
            }
            
            // Ctrl/Cmd + E to export
            if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
                event.preventDefault();
                exportToCSV();
            }
        });
    }

    return {
        /**
         * initialize() is called only once when the Add-In is first loaded.
         */
        initialize: function (freshApi, freshState, initializeCallback) {
            api = freshApi;
            state = freshState;

            elAddin = document.getElementById('ruckitAssets');

            if (state.translate) {
                state.translate(elAddin || '');
            }
            
            initializeCallback();
        },

        /**
         * focus() is called whenever the Add-In receives focus.
         */
        focus: function (freshApi, freshState) {
            api = freshApi;
            state = freshState;

            // Setup event listeners
            setupEventListeners();
            
            // Load Ruckit mappings data
            loadRuckitMappings();
            
            // Show main content
            if (elAddin) {
                elAddin.style.display = 'block';
            }
        },

        /**
         * blur() is called whenever the user navigates away from the Add-In.
         */
        blur: function () {
            // Hide main content
            if (elAddin) {
                elAddin.style.display = 'none';
            }
        }
    };
};