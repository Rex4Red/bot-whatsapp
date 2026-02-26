// ============================
// Socket.IO & State
// ============================
const API_BASE = '';
const socket = io();

let currentPage = 1;
let currentFilter = '';

// ============================
// Socket.IO Events
// ============================
socket.on('connect', () => {
    console.log('[Dashboard] Connected to server');
});

socket.on('status', (data) => {
    updateStatusBadge(data.status);
    updateQrSection(data.status);
});

socket.on('qr', (qrDataUrl) => {
    const container = document.getElementById('qrContainer');
    if (qrDataUrl) {
        container.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" />`;
    } else {
        // QR is null = already authenticated
    }
});

socket.on('message_sent', () => {
    loadStats();
    loadLogs();
});

socket.on('disconnect', () => {
    updateStatusBadge('disconnected');
    console.log('[Dashboard] Disconnected from server');
});

// ============================
// Status
// ============================
function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    const text = badge.querySelector('.status-text');

    // Remove all status classes
    badge.classList.remove('connected', 'disconnected', 'waiting_qr', 'authenticated', 'restarting', 'error');
    badge.classList.add(status);

    const labels = {
        connected: 'Terhubung',
        disconnected: 'Terputus',
        waiting_qr: 'Scan QR',
        authenticated: 'Authenticated',
        auth_failure: 'Auth Gagal',
        restarting: 'Restart...',
        error: 'Error',
    };

    text.textContent = labels[status] || status;
}

function updateQrSection(status) {
    const section = document.getElementById('qrSection');
    const container = document.getElementById('qrContainer');
    const message = document.getElementById('qrMessage');

    section.classList.remove('connected');

    if (status === 'connected') {
        section.classList.add('connected');
        container.innerHTML = `
      <div class="qr-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style="color: #22c55e;">WhatsApp Terhubung!</p>
      </div>`;
    } else if (status === 'waiting_qr') {
        // QR will be rendered by socket 'qr' event
        if (!container.querySelector('img')) {
            container.innerHTML = `
        <div class="qr-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
          </svg>
          <p>Scan QR code dengan WhatsApp</p>
        </div>`;
        }
    } else if (status === 'disconnected' || status === 'error') {
        container.innerHTML = `
      <div class="qr-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" opacity="0.5">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>${status === 'error' ? 'Terjadi error' : 'Tidak terhubung'}</p>
      </div>`;
    }
}

// ============================
// Tabs
// ============================
function switchTab(tab, btn) {
    // Update active tab
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide forms
    document.getElementById('singleForm').classList.toggle('hidden', tab !== 'single');
    document.getElementById('broadcastForm').classList.toggle('hidden', tab !== 'broadcast');
}

// ============================
// Send Message
// ============================
async function sendSingle(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSendSingle');
    const phone = document.getElementById('singlePhone').value.trim();
    const message = document.getElementById('singleMessage').value.trim();

    if (!phone || !message) return;

    btn.disabled = true;
    btn.innerHTML = '<span>Mengirim...</span>';

    try {
        const res = await fetch(`${API_BASE}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'dashboard' },
            body: JSON.stringify({ phone, message }),
        });
        const data = await res.json();

        if (data.success) {
            showToast('Pesan berhasil dikirim!', 'success');
            document.getElementById('singlePhone').value = '';
            document.getElementById('singleMessage').value = '';
        } else {
            showToast(data.error || 'Gagal mengirim pesan', 'error');
        }
    } catch (err) {
        showToast('Gagal mengirim: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Kirim Pesan`;
    }
}

async function sendBroadcast(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSendBroadcast');
    const phonesRaw = document.getElementById('broadcastPhones').value.trim();
    const message = document.getElementById('broadcastMessage').value.trim();

    const phones = phonesRaw
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    if (phones.length === 0 || !message) return;

    btn.disabled = true;
    btn.innerHTML = `<span>Mengirim ke ${phones.length} nomor...</span>`;

    try {
        const res = await fetch(`${API_BASE}/api/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'dashboard' },
            body: JSON.stringify({ phones, message }),
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Broadcast selesai: ${data.data.sent} terkirim, ${data.data.failed} gagal`, data.data.failed > 0 ? 'info' : 'success');
            document.getElementById('broadcastPhones').value = '';
            document.getElementById('broadcastMessage').value = '';
        } else {
            showToast(data.error || 'Broadcast gagal', 'error');
        }
    } catch (err) {
        showToast('Broadcast gagal: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Broadcast Pesan`;
    }
}

// ============================
// WhatsApp Client Actions
// ============================
async function restartClient() {
    const btn = document.getElementById('btnRestart');
    btn.disabled = true;
    showToast('Merestart WhatsApp client...', 'info');

    try {
        await fetch(`${API_BASE}/api/restart`, { method: 'POST' });
    } catch (err) {
        showToast('Gagal restart: ' + err.message, 'error');
    } finally {
        setTimeout(() => { btn.disabled = false; }, 5000);
    }
}

async function logoutClient() {
    if (!confirm('Logout akan menghapus session. Anda perlu scan QR lagi. Lanjutkan?')) return;

    const btn = document.getElementById('btnLogout');
    btn.disabled = true;
    showToast('Melakukan logout...', 'info');

    try {
        await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
    } catch (err) {
        showToast('Gagal logout: ' + err.message, 'error');
    } finally {
        setTimeout(() => { btn.disabled = false; }, 5000);
    }
}

// ============================
// Stats
// ============================
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/messages/stats`);
        const data = await res.json();

        if (data.success) {
            document.getElementById('statSent').textContent = data.data.sent || 0;
            document.getElementById('statFailed').textContent = data.data.failed || 0;
            document.getElementById('statToday').textContent = data.data.today || 0;
            document.getElementById('statTotal').textContent = data.data.total || 0;
        }
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

// ============================
// Message Logs
// ============================
async function loadLogs(page) {
    if (page) currentPage = page;
    currentFilter = document.getElementById('logFilter').value;

    try {
        let url = `${API_BASE}/api/messages?page=${currentPage}&limit=15`;
        if (currentFilter) url += `&status=${currentFilter}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            renderLogs(data.data.logs);
            renderPagination(data.data);
        }
    } catch (err) {
        console.error('Failed to load logs:', err);
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logsBody');

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada log pesan</td></tr>';
        return;
    }

    tbody.innerHTML = logs
        .map((log) => {
            const time = new Date(log.created_at + 'Z').toLocaleString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            });

            const statusHtml = `<span class="status-pill ${log.status}">${log.status}</span>`;
            const errorTitle = log.error ? ` title="${log.error}"` : '';

            return `<tr${errorTitle}>
        <td class="col-time">${time}</td>
        <td class="col-phone">${log.phone_number}</td>
        <td class="col-message">${escapeHtml(log.message)}</td>
        <td>${statusHtml}</td>
      </tr>`;
        })
        .join('');
}

function renderPagination(data) {
    const container = document.getElementById('pagination');
    const { page, totalPages } = data;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Prev button
    html += `<button ${page <= 1 ? 'disabled' : ''} onclick="loadLogs(${page - 1})">‹</button>`;

    // Page numbers
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
        html += `<button class="${i === page ? 'active' : ''}" onclick="loadLogs(${i})">${i}</button>`;
    }

    // Next button
    html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="loadLogs(${page + 1})">›</button>`;

    container.innerHTML = html;
}

// ============================
// Contacts
// ============================
function toggleAddContact() {
    const form = document.getElementById('addContactForm');
    form.classList.toggle('hidden');
}

async function addContact(e) {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const phone_number = document.getElementById('contactPhone').value.trim();
    const group_name = document.getElementById('contactGroup').value.trim() || 'default';

    if (!name || !phone_number) return;

    try {
        const res = await fetch(`${API_BASE}/api/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone_number, group_name }),
        });
        const data = await res.json();

        if (data.success) {
            showToast('Kontak berhasil ditambahkan', 'success');
            document.getElementById('contactName').value = '';
            document.getElementById('contactPhone').value = '';
            document.getElementById('contactGroup').value = '';
            document.getElementById('addContactForm').classList.add('hidden');
            loadContacts();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Gagal menambahkan kontak: ' + err.message, 'error');
    }
}

async function deleteContactById(id) {
    if (!confirm('Hapus kontak ini?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/contacts/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            showToast('Kontak dihapus', 'success');
            loadContacts();
        } else {
            showToast(data.error, 'error');
        }
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    }
}

async function loadContacts() {
    try {
        const res = await fetch(`${API_BASE}/api/contacts`);
        const data = await res.json();

        if (data.success) {
            renderContacts(data.data);
        }
    } catch (err) {
        console.error('Failed to load contacts:', err);
    }
}

function renderContacts(contacts) {
    const container = document.getElementById('contactList');

    if (!contacts || contacts.length === 0) {
        container.innerHTML = '<div class="empty-state small">Belum ada kontak</div>';
        return;
    }

    container.innerHTML = contacts
        .map(
            (c) => `
    <div class="contact-item">
      <div class="contact-info">
        <span class="contact-name">${escapeHtml(c.name)}</span>
        <span class="contact-phone">${c.phone_number}</span>
      </div>
      <div class="contact-actions">
        <span class="contact-group-tag">${escapeHtml(c.group_name)}</span>
        <button class="btn-icon" onclick="deleteContactById(${c.id})" title="Hapus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>`
        )
        .join('');
}

// ============================
// Toast Notifications
// ============================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================
// Helpers
// ============================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================
// Init
// ============================
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadLogs();
    loadContacts();

    // Auto-refresh stats every 30 seconds
    setInterval(loadStats, 30000);
});
