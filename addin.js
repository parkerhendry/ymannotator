// Global variables
let geotabApi = null;
let yardMoveTypeId = null;
let regularZones = [];
let yardMoveZones = [];
let filteredRegularZones = [];
let filteredYardMoveZones = [];

// Initialize the add-in when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeGeotabApi();
});

/**
 * Initialize the Geotab API connection
 */
function initializeGeotabApi() {
    let userSessionData = null;
    
    // Try to get session data from the Geotab environment
    if (typeof api !== 'undefined' && typeof api.getSession === 'function') {
        api.getSession(function(session) {
            userSessionData = session;
            console.log("Obtained session data from MyGeotab environment:", userSessionData);
            setupGeotabApi(userSessionData);
        });
    } else {
        // Fallback for testing outside Geotab environment
        console.warn("Global 'api' object or getSession method not available. Cannot automatically retrieve session.");
        showAlert('Unable to connect to Geotab API. Please ensure this add-in is running within MyGeotab.', 'danger');
        return;
    }
}

/**
 * Setup the Geotab API client
 */
function setupGeotabApi(sessionData) {
    if (!sessionData || !sessionData.userName || !sessionData.database || !sessionData.sessionId || !sessionData.path) {
        console.error("Missing session data for API client. Cannot proceed.");
        showAlert('Invalid session data. Please refresh the page and try again.', 'danger');
        return;
    }
    
    try {
        const authentication = {
            credentials: {
                database: sessionData.database,
                userName: sessionData.userName,
                password: null,
                sessionId: sessionData.sessionId
            },
            path: sessionData.path
        };
        
        geotabApi = new GeotabApi(authentication);
        console.log("Geotab API initialized successfully");
        
        // Load zones after API is ready
        loadZones();
        
    } catch (error) {
        console.error("Error initializing GeotabApi:", error);
        showAlert('Failed to initialize Geotab API connection.', 'danger');
    }
}

/**
 * Make a Geotab API call
 */
async function makeGeotabCall(method, typeName, parameters = {}) {
    if (!geotabApi) {
        throw new Error('Geotab API not initialized');
    }
    
    const callParams = {
        typeName: typeName,
        ...parameters
    };
    
    try {
        const result = await geotabApi.call(method, callParams);
        return result;
    } catch (error) {
        console.error(`Error making ${method} call for ${typeName}:`, error);
        throw error;
    }
}

/**
 * Load zones from Geotab API
 */
async function loadZones() {
    if (!geotabApi) {
        showAlert('Geotab API not initialized. Please refresh the page.', 'danger');
        return;
    }
    
    try {
        showAlert('Loading zones...', 'info');
        
        // Get all zones and zone types in parallel
        const [zones, zoneTypes] = await Promise.all([
            makeGeotabCall("Get", "Zone"),
            makeGeotabCall("Get", "ZoneType")
        ]);
        
        // Find the "Yard Move Zones" type ID
        yardMoveTypeId = null;
        for (const zoneType of zoneTypes) {
            if (zoneType.name === "Yard Move Zones") {
                yardMoveTypeId = zoneType.id;
                break;
            }
        }
        
        if (!yardMoveTypeId) {
            showAlert('Warning: "Yard Move Zones" zone type not found. Please create this zone type first.', 'warning');
        }
        
        // Categorize zones
        regularZones = [];
        yardMoveZones = [];
        
        for (const zone of zones) {
            const zoneHasYardMoveType = zone.zoneTypes && zone.zoneTypes.some(zt => zt.id === yardMoveTypeId);
            
            const zoneData = {
                id: zone.id,
                name: zone.name || 'Unnamed Zone',
                zoneTypes: zone.zoneTypes || [],
                points: zone.points || [],
                version: zone.version
            };
            
            if (zoneHasYardMoveType) {
                yardMoveZones.push(zoneData);
            } else {
                regularZones.push(zoneData);
            }
        }
        
        // Initialize filtered arrays
        filteredRegularZones = [...regularZones];
        filteredYardMoveZones = [...yardMoveZones];
        
        renderZones();
        showAlert(`Loaded ${regularZones.length + yardMoveZones.length} zones successfully`, 'success');
        
    } catch (error) {
        console.error('Error loading zones:', error);
        showAlert('Error loading zones: ' + error.message, 'danger');
        showEmptyState('regularZonesList');
        showEmptyState('yardMoveZonesList');
    }
}

/**
 * Add Yard Move Zones type to a zone
 */
async function addYardMoveType(zoneId) {
    if (!geotabApi || !yardMoveTypeId) {
        throw new Error('API not initialized or Yard Move type not found');
    }
    
    // Get the current zone data
    const zones = await makeGeotabCall("Get", "Zone", { search: { id: zoneId } });
    if (!zones || zones.length === 0) {
        throw new Error('Zone not found');
    }
    
    const zone = zones[0];
    
    // Check if the zone already has the yard move type
    const existingZoneTypes = zone.zoneTypes || [];
    const hasYardMoveType = existingZoneTypes.some(zt => zt.id === yardMoveTypeId);
    
    if (hasYardMoveType) {
        throw new Error('Zone already has Yard Move Zones type');
    }
    
    // Add the yard move type to the zone
    const updatedZoneTypes = [...existingZoneTypes, { id: yardMoveTypeId }];
    
    // Prepare the updated zone entity
    const updatedZone = {
        id: zone.id,
        name: zone.name,
        zoneTypes: updatedZoneTypes,
        points: zone.points || [],
        version: zone.version
    };
    
    // Update the zone using Set method
    const result = await makeGeotabCall("Set", "Zone", { entity: updatedZone });
    return result;
}

/**
 * Remove Yard Move Zones type from a zone
 */
async function removeYardMoveType(zoneId) {
    if (!geotabApi || !yardMoveTypeId) {
        throw new Error('API not initialized or Yard Move type not found');
    }
    
    // Get the current zone data
    const zones = await makeGeotabCall("Get", "Zone", { search: { id: zoneId } });
    if (!zones || zones.length === 0) {
        throw new Error('Zone not found');
    }
    
    const zone = zones[0];
    
    // Remove the yard move type from the zone
    const existingZoneTypes = zone.zoneTypes || [];
    const updatedZoneTypes = existingZoneTypes.filter(zt => zt.id !== yardMoveTypeId);
    
    // Prepare the updated zone entity
    const updatedZone = {
        id: zone.id,
        name: zone.name,
        zoneTypes: updatedZoneTypes,
        points: zone.points || [],
        version: zone.version
    };
    
    // Update the zone using Set method
    const result = await makeGeotabCall("Set", "Zone", { entity: updatedZone });
    return result;
}

/**
 * Open the create zone page in Geotab
 */
function openCreateZone() {
    if (!geotabApi) {
        showAlert('Geotab API not initialized', 'danger');
        return;
    }
    
    // Get database name from the API session
    let database = 'demo'; // fallback
    if (geotabApi.credentials && geotabApi.credentials.database) {
        database = geotabApi.credentials.database;
    }
    
    const createZoneUrl = `https://my.geotab.com/${database}/#map,createNewZone:!t,drivers:all`;
    window.open(createZoneUrl, '_blank');
}

/**
 * Show alert messages
 */
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const iconMap = {
        'success': 'check-circle',
        'danger': 'exclamation-triangle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}" role="alert">
            <i class="fas fa-${iconMap[type]} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

/**
 * Render zones in the UI
 */
function renderZones() {
    renderZoneList('regularZonesList', filteredRegularZones, 'regular');
    renderZoneList('yardMoveZonesList', filteredYardMoveZones, 'yardmove');
    updateCounts();
}

/**
 * Filter zones based on search input
 */
function filterZones(type) {
    const searchTerm = document.getElementById(type === 'regular' ? 'regularSearch' : 'yardMoveSearch').value.toLowerCase();
    
    if (type === 'regular') {
        filteredRegularZones = regularZones.filter(zone => 
            zone.name.toLowerCase().includes(searchTerm) || 
            zone.id.toLowerCase().includes(searchTerm)
        );
        renderZoneList('regularZonesList', filteredRegularZones, 'regular');
    } else {
        filteredYardMoveZones = yardMoveZones.filter(zone => 
            zone.name.toLowerCase().includes(searchTerm) || 
            zone.id.toLowerCase().includes(searchTerm)
        );
        renderZoneList('yardMoveZonesList', filteredYardMoveZones, 'yardmove');
    }
    
    updateCounts();
}

/**
 * Render a list of zones
 */
function renderZoneList(containerId, zones, type) {
    const container = document.getElementById(containerId);
    
    if (zones.length === 0) {
        showEmptyState(containerId);
        return;
    }
    
    const zonesHtml = zones.map(zone => `
        <div class="zone-item ${type === 'yardmove' ? 'yard-move-zone' : ''}" 
             draggable="true" 
             ondragstart="drag(event)" 
             data-zone-id="${zone.id}"
             data-zone-name="${zone.name}"
             data-current-type="${type}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${zone.name}</strong>
                    <small class="d-block opacity-75">ID: ${zone.id}</small>
                </div>
                <i class="fas fa-grip-vertical"></i>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = zonesHtml;
}

/**
 * Show empty state message
 */
function showEmptyState(containerId) {
    const container = document.getElementById(containerId);
    const type = containerId.includes('regular') ? 'regular' : 'yard move';
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No ${type} zones available</p>
            <small>Drag zones here to ${type === 'regular' ? 'remove from' : 'add to'} Yard Move Zones</small>
        </div>
    `;
}

/**
 * Update zone counts
 */
function updateCounts() {
    document.getElementById('regularCount').textContent = `${filteredRegularZones.length} of ${regularZones.length} zones`;
    document.getElementById('yardMoveCount').textContent = `${filteredYardMoveZones.length} of ${yardMoveZones.length} zones`;
}

/**
 * Handle drag start
 */
function drag(event) {
    const zoneId = event.target.dataset.zoneId;
    const zoneName = event.target.dataset.zoneName;
    const currentType = event.target.dataset.currentType;
    
    event.dataTransfer.setData('text/plain', JSON.stringify({
        zoneId: zoneId,
        zoneName: zoneName,
        currentType: currentType
    }));
}

/**
 * Allow drop
 */
function allowDrop(event) {
    event.preventDefault();
}

/**
 * Handle drag enter
 */
function dragEnter(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

/**
 * Handle drag leave
 */
function dragLeave(event) {
    // Only remove the class if we're leaving the container itself, not a child
    if (!event.currentTarget.contains(event.relatedTarget)) {
        event.currentTarget.classList.remove('drag-over');
    }
}

/**
 * Handle drop
 */
// Complete the drop function (picking up where it was cut off)
async function drop(event, targetType) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const { zoneId, zoneName, currentType } = data;
    
    // Don't do anything if dropping in the same container
    if (currentType === targetType) {
        return;
    }
    
    try {
        let action, actionText;
        
        if (targetType === 'yardmove') {
            action = 'add';
            actionText = 'Adding';
        } else {
            action = 'remove';
            actionText = 'Removing';
        }
        
        showAlert(`${actionText} "${zoneName}" ${action === 'add' ? 'to' : 'from'} Yard Move Zones...`, 'info');
        
        if (action === 'add') {
            await addYardMoveType(zoneId);
        } else {
            await removeYardMoveType(zoneId);
        }
        
        // Move zone between arrays
        if (targetType === 'yardmove') {
            const zoneIndex = regularZones.findIndex(z => z.id === zoneId);
            if (zoneIndex !== -1) {
                const zone = regularZones.splice(zoneIndex, 1)[0];
                // Update the zone's zoneTypes to include the yard move type
                zone.zoneTypes = [...(zone.zoneTypes || []), { id: yardMoveTypeId }];
                yardMoveZones.push(zone);
            }
        } else {
            const zoneIndex = yardMoveZones.findIndex(z => z.id === zoneId);
            if (zoneIndex !== -1) {
                const zone = yardMoveZones.splice(zoneIndex, 1)[0];
                // Remove yard move type from zone's zoneTypes
                zone.zoneTypes = (zone.zoneTypes || []).filter(zt => zt.id !== yardMoveTypeId);
                regularZones.push(zone);
            }
        }
        
        // Update filtered arrays and re-render
        filteredRegularZones = [...regularZones];
        filteredYardMoveZones = [...yardMoveZones];
        
        // Clear search boxes to show all zones
        document.getElementById('regularSearch').value = '';
        document.getElementById('yardMoveSearch').value = '';
        
        renderZones();
        showAlert(`Successfully ${action === 'add' ? 'added' : 'removed'} "${zoneName}" ${action === 'add' ? 'to' : 'from'} Yard Move Zones`, 'success');
        
    } catch (error) {
        console.error('Error updating zone:', error);
        showAlert('Error updating zone: ' + error.message, 'danger');
    }
}

// Add missing functions that were in the Flask version but not in the static version

/**
 * Clear search input and reset filtered zones
 */
function clearSearch(type) {
    const searchInput = document.getElementById(type === 'regular' ? 'regularSearch' : 'yardMoveSearch');
    searchInput.value = '';
    filterZones(type);
}

/**
 * Refresh zones data
 */
async function refreshZones() {
    await loadZones();
}

/**
 * Get zone statistics
 */
function getZoneStats() {
    return {
        totalZones: regularZones.length + yardMoveZones.length,
        regularZones: regularZones.length,
        yardMoveZones: yardMoveZones.length,
        filteredRegular: filteredRegularZones.length,
        filteredYardMove: filteredYardMoveZones.length
    };
}

/**
 * Export zones data as JSON
 */
function exportZones() {
    const data = {
        timestamp: new Date().toISOString(),
        yardMoveTypeId: yardMoveTypeId,
        regularZones: regularZones,
        yardMoveZones: yardMoveZones,
        stats: getZoneStats()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zones-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('Zones data exported successfully', 'success');
}

/**
 * Handle keyboard shortcuts
 */
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + R to refresh zones
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshZones();
    }
    
    // Escape to clear search boxes
    if (event.key === 'Escape') {
        const regularSearch = document.getElementById('regularSearch');
        const yardMoveSearch = document.getElementById('yardMoveSearch');
        
        if (regularSearch.value) {
            clearSearch('regular');
        }
        if (yardMoveSearch.value) {
            clearSearch('yardmove');
        }
    }
});

/**
 * Add event listeners for search inputs
 */
document.addEventListener('DOMContentLoaded', function() {
    // Add debounced search functionality
    let searchTimeout;
    
    function debounceSearch(type) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterZones(type);
        }, 300);
    }
    
    // Add event listeners when DOM is ready
    const regularSearch = document.getElementById('regularSearch');
    const yardMoveSearch = document.getElementById('yardMoveSearch');
    
    if (regularSearch) {
        regularSearch.addEventListener('input', () => debounceSearch('regular'));
    }
    
    if (yardMoveSearch) {
        yardMoveSearch.addEventListener('input', () => debounceSearch('yardmove'));
    }
});