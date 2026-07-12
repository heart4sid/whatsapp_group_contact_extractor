/**
 * WA Group Contact Scraper — Frontend Application
 * =================================================
 * Socket.IO client, UI state machine, group rendering,
 * search/filter, progress tracking, and download management.
 */

// ══════════════════════════════════════════════════════════════════════
//  GLOBALS
// ══════════════════════════════════════════════════════════════════════

const urlParams = new URLSearchParams(window.location.search);
const isMock = urlParams.get('mock') === 'true';
const socket = io({
    query: {
        mock: isMock
    }
});

let allGroups = [];
let selectedGroup = null;
let currentPanel = 'auth';

// DOM References
const panels = {
    auth:     document.getElementById('panel-auth'),
    groups:   document.getElementById('panel-groups'),
    progress: document.getElementById('panel-progress'),
    download: document.getElementById('panel-download'),
    error:    document.getElementById('panel-error')
};

const statusBadge = document.getElementById('status-badge');
const statusDot   = document.getElementById('status-dot');
const statusText  = document.getElementById('status-text');
const btnLogout   = document.getElementById('btn-logout');
const btnExtract  = document.getElementById('btn-extract');

// ══════════════════════════════════════════════════════════════════════
//  PANEL STATE MACHINE
// ══════════════════════════════════════════════════════════════════════

/**
 * Switch to a specific panel with smooth transitions.
 */
function showPanel(panelName) {
    // Fade out current panel
    const currentEl = panels[currentPanel];
    if (currentEl && !currentEl.classList.contains('hidden')) {
        currentEl.classList.add('panel-exit');
        setTimeout(() => {
            currentEl.classList.add('hidden');
            currentEl.classList.remove('panel-exit');

            // Show new panel
            const newEl = panels[panelName];
            if (newEl) {
                newEl.classList.remove('hidden');
                // Re-trigger fade-in animation
                newEl.style.animation = 'none';
                newEl.offsetHeight; // Force reflow
                newEl.style.animation = '';
            }
            currentPanel = panelName;
        }, 280);
    } else {
        // Direct show (no current panel visible)
        Object.values(panels).forEach(p => p.classList.add('hidden'));
        const newEl = panels[panelName];
        if (newEl) {
            newEl.classList.remove('hidden');
            newEl.style.animation = 'none';
            newEl.offsetHeight;
            newEl.style.animation = '';
        }
        currentPanel = panelName;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  SOCKET.IO EVENT HANDLERS
// ══════════════════════════════════════════════════════════════════════

/**
 * QR Code received — display it in the auth panel.
 */
socket.on('qr', (dataUrl) => {
    const qrImage   = document.getElementById('qr-image');
    const qrLoading = document.getElementById('qr-loading');

    qrImage.src = dataUrl;
    qrImage.classList.remove('hidden');
    qrLoading.classList.add('hidden');

    document.getElementById('auth-status-text').textContent =
        'Scan this QR code with WhatsApp on your phone';
    document.getElementById('auth-status-text').classList.remove('animate-pulse');

    if (currentPanel !== 'auth') {
        showPanel('auth');
    }
});

/**
 * Status updates from the server.
 */
socket.on('status', (data) => {
    const { status, message } = data;

    // Update header status badge
    updateStatusBadge(status, message);

    switch (status) {
        case 'initializing':
        case 'loading':
            document.getElementById('auth-status-text').textContent = message;
            break;

        case 'qr_received':
            document.getElementById('auth-status-text').textContent = message;
            break;

        case 'authenticated':
            document.getElementById('auth-status-text').textContent = message;
            document.getElementById('auth-status-text').classList.add('text-wa-green');
            showToast(message, 'success');
            break;

        case 'ready':
            btnLogout.classList.remove('hidden');
            if (currentPanel === 'auth') {
                // Auto-fetch groups when ready
                showPanel('groups');
                socket.emit('get-groups');
            }
            break;

        case 'fetching_groups':
            // Show loading in group list
            document.getElementById('group-list').innerHTML = `
                <div class="flex items-center justify-center py-12">
                    <div class="spinner mr-3"></div>
                    <span class="text-wa-muted text-sm">Loading groups...</span>
                </div>
            `;
            break;

        case 'extracting':
        case 'generating':
            // Handled by progress panel
            document.getElementById('progress-subtitle').textContent = message;
            break;

        case 'disconnected':
            btnLogout.classList.add('hidden');
            showPanel('auth');
            showToast('Disconnected from WhatsApp', 'error');
            // Reset QR display
            document.getElementById('qr-image').classList.add('hidden');
            document.getElementById('qr-loading').classList.remove('hidden');
            document.getElementById('auth-status-text').textContent = 'Reconnecting...';
            break;

        case 'error':
            showToast(message, 'error');
            break;
    }
});

/**
 * Groups list received from server.
 */
socket.on('groups-list', (data) => {
    if (!data.success) {
        showToast('Failed to load groups', 'error');
        return;
    }

    allGroups = data.groups;
    renderGroups(allGroups);
    document.getElementById('group-count').textContent = `${data.count} groups found`;

    if (currentPanel !== 'groups') {
        showPanel('groups');
    }
});

/**
 * Extraction progress updates.
 */
socket.on('extraction-progress', (data) => {
    const { current, total, percent, latestContact } = data;

    document.getElementById('progress-bar').style.width = `${percent}%`;
    document.getElementById('progress-count').textContent = `${current} / ${total} contacts`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-latest').textContent = `Latest: ${latestContact}`;
});

/**
 * Download ready — Excel file has been generated.
 */
socket.on('download-ready', (data) => {
    const { fileName, downloadUrl, groupName, contactCount, totalParticipants } = data;

    // Update download panel
    document.getElementById('download-summary').textContent =
        `Extracted ${contactCount} contacts from "${groupName}"`;
    document.getElementById('stat-contacts').textContent = contactCount;
    document.getElementById('stat-total').textContent = totalParticipants;
    document.getElementById('btn-download').href = downloadUrl;
    document.getElementById('btn-download').setAttribute('download', fileName);

    showPanel('download');
    showToast(`${contactCount} contacts ready for download!`, 'success');
});

/**
 * Error message from server.
 */
socket.on('error-msg', (data) => {
    showToast(data.message, 'error');

    // If we're on the progress panel, show error panel
    if (currentPanel === 'progress') {
        document.getElementById('error-message').textContent = data.message;
        showPanel('error');
    }
});

/**
 * Socket connection events.
 */
socket.on('connect', () => {
    console.log('[Socket] Connected to server');
});

socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
    updateStatusBadge('disconnected', 'Disconnected');
});

socket.on('connect_error', () => {
    updateStatusBadge('error', 'Connection failed');
});

// ══════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════════════

/**
 * Update the header status badge.
 */
function updateStatusBadge(status, message) {
    statusBadge.setAttribute('data-status', status);

    // Friendly short labels
    const labels = {
        'idle':            'Idle',
        'initializing':    'Starting...',
        'loading':         'Loading...',
        'qr_received':     'Scan QR',
        'authenticated':   'Authenticated',
        'ready':           'Connected',
        'fetching_groups': 'Loading...',
        'extracting':      'Extracting...',
        'generating':      'Generating...',
        'disconnected':    'Disconnected',
        'error':           'Error'
    };

    statusText.textContent = labels[status] || status;
}

/**
 * Render the group list.
 */
function renderGroups(groups) {
    const container = document.getElementById('group-list');

    if (groups.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-12 h-12 text-wa-muted/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p class="text-wa-muted text-sm">No groups found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = groups.map(group => {
        const initials = getInitials(group.name);
        const isSelected = selectedGroup && selectedGroup.id === group.id;

        return `
            <div class="group-item ${isSelected ? 'selected' : ''}"
                 data-group-id="${group.id}"
                 data-group-name="${escapeHtml(group.name)}"
                 onclick="selectGroup('${group.id}', '${escapeHtml(group.name)}')">
                <div class="group-radio"></div>
                <div class="group-avatar">${initials}</div>
                <div class="flex-1 min-w-0">
                    <p class="group-name truncate">${escapeHtml(group.name)}</p>
                    <p class="group-count-text">${group.participantCount} participants</p>
                </div>
                <svg class="w-4 h-4 text-wa-muted/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>
        `;
    }).join('');
}

/**
 * Filter groups by search term.
 */
function filterGroups(query) {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
        renderGroups(allGroups);
        return;
    }

    const filtered = allGroups.filter(g =>
        g.name.toLowerCase().includes(lowerQuery)
    );

    renderGroups(filtered);
    document.getElementById('group-count').textContent =
        `${filtered.length} of ${allGroups.length} groups`;
}

/**
 * Select a group from the list.
 */
function selectGroup(groupId, groupName) {
    selectedGroup = { id: groupId, name: groupName };

    // Update visual selection
    document.querySelectorAll('.group-item').forEach(item => {
        if (item.dataset.groupId === groupId) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Enable extract button
    btnExtract.disabled = false;
}

/**
 * Handle the "Extract Contacts" button click.
 */
function handleExtract() {
    if (!selectedGroup) {
        showToast('Please select a group first', 'error');
        return;
    }

    // Switch to progress panel
    showPanel('progress');

    // Reset progress UI
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-count').textContent = '0 / 0 contacts';
    document.getElementById('progress-percent').textContent = '0%';
    document.getElementById('progress-latest').textContent = 'Waiting for first contact...';
    document.getElementById('progress-title').textContent = `Extracting from "${selectedGroup.name}"`;

    // Emit extraction request
    socket.emit('extract-contacts', {
        groupId: selectedGroup.id,
        groupName: selectedGroup.name
    });
}

/**
 * Navigate back to group selection panel.
 */
function goToGroups() {
    selectedGroup = null;
    btnExtract.disabled = true;

    showPanel('groups');

    // Re-fetch groups to ensure fresh data
    socket.emit('get-groups');
}

/**
 * Handle logout button click.
 */
function handleLogout() {
    if (confirm('Are you sure you want to disconnect from WhatsApp?')) {
        socket.emit('logout');
        btnLogout.classList.add('hidden');
        showPanel('auth');

        // Reset QR display
        document.getElementById('qr-image').classList.add('hidden');
        document.getElementById('qr-loading').classList.remove('hidden');
        document.getElementById('auth-status-text').textContent = 'Reconnecting...';
        document.getElementById('auth-status-text').classList.remove('text-wa-green');
    }
}

// ══════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Get initials from a group name (max 2 chars).
 */
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2);
    return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

/**
 * Show a toast notification.
 */
function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-dismiss after 4s
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ══════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════════════════

console.log('[App] WA Group Contact Scraper initialized');
console.log('[App] Connecting to server via Socket.IO...');
