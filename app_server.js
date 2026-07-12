/**
 * WA Group Contact Scraper - Unified Server
 * =========================================
 * Consolidates Express, Socket.IO, WhatsApp Web automation,
 * Group Discovery, Contact Extraction, and Excel Generation into a single file.
 * Includes a robust Mock Mode (?mock=true) for testing without scanning QR codes.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const ExcelJS = require('exceljs');

// Global exception handlers to prevent Puppeteer navigation errors from crashing the process
process.on('uncaughtException', (err) => {
    console.error('[System] Uncaught Exception:', err.message);
    if (err.stack) console.error(err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[System] Unhandled Rejection:', reason);
});

// Globals & Constants
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 5e6 // 5 MB
});

const PORT = process.env.PORT || 3001;
const EXPORTS_DIR = path.join(__dirname, 'exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// WhatsApp client setup (runs in background for real users)
let clientStatus = 'idle'; // idle | initializing | qr_received | authenticated | ready | disconnected
let lastQrDataUrl = null;
let isClientReady = false;

console.log('[WhatsApp] Initializing WhatsApp Client with NoAuth strategy...');

const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 120000, // 120 seconds to prevent DevTools protocol timeout
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

// Broadcast state changes (only to real clients)
function broadcastStatus(status, message) {
    clientStatus = status;
    io.to('real-users').emit('status', { status, message, timestamp: Date.now() });
}

client.on('qr', async (qr) => {
    try {
        const dataUrl = await qrcode.toDataURL(qr, {
            width: 300,
            margin: 2
        });
        lastQrDataUrl = dataUrl;
        broadcastStatus('qr_received', 'QR code ready - scan with WhatsApp');
        io.to('real-users').emit('qr', dataUrl);
        console.log('[WhatsApp] QR code generated and sent to frontend');
    } catch (err) {
        console.error('[WhatsApp] QR generation error:', err.message);
        broadcastStatus('error', 'Failed to generate QR code');
    }
});

client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully');
    broadcastStatus('authenticated', 'Authenticated successfully!');
});

client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Auth failure:', msg);
    isClientReady = false;
    broadcastStatus('disconnected', `Authentication failed: ${msg}`);
});

client.on('ready', () => {
    console.log('[WhatsApp] Client is ready');
    isClientReady = true;
    broadcastStatus('ready', 'WhatsApp is connected and ready!');
});

client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Disconnected:', reason);
    isClientReady = false;
    broadcastStatus('disconnected', `Disconnected: ${reason}`);
});

// Initialize WhatsApp client
client.initialize().catch((err) => {
    console.error('[WhatsApp] Initialization failed:', err.message);
    broadcastStatus('error', `Initialization failed: ${err.message}`);
});

// Country Calling Code Map
const COUNTRY_CODE_MAP = {
    '91':  { code: '91',  country: 'India' },
    '92':  { code: '92',  country: 'Pakistan' },
    '94':  { code: '94',  country: 'Sri Lanka' },
    '977': { code: '977', country: 'Nepal' },
    '880': { code: '880', country: 'Bangladesh' },
    '960': { code: '960', country: 'Maldives' },
    '975': { code: '975', country: 'Bhutan' },
    '93':  { code: '93',  country: 'Afghanistan' },
    '1':   { code: '1',   country: 'US/Canada' },
    '44':  { code: '44',  country: 'United Kingdom' },
    '49':  { code: '49',  country: 'Germany' },
    '33':  { code: '33',  country: 'France' },
    '39':  { code: '39',  country: 'Italy' },
    '34':  { code: '34',  country: 'Spain' },
    '351': { code: '351', country: 'Portugal' },
    '31':  { code: '31',  country: 'Netherlands' },
    '32':  { code: '32',  country: 'Belgium' },
    '41':  { code: '41',  country: 'Switzerland' },
    '43':  { code: '43',  country: 'Austria' },
    '46':  { code: '46',  country: 'Sweden' },
    '47':  { code: '47',  country: 'Norway' },
    '45':  { code: '45',  country: 'Denmark' },
    '358': { code: '358', country: 'Finland' },
    '48':  { code: '48',  country: 'Poland' },
    '353': { code: '353', country: 'Ireland' },
    '30':  { code: '30',  country: 'Greece' },
    '36':  { code: '36',  country: 'Hungary' },
    '420': { code: '420', country: 'Czech Republic' },
    '40':  { code: '40',  country: 'Romania' },
    '380': { code: '380', country: 'Ukraine' },
    '7':   { code: '7',   country: 'Russia' },
    '90':  { code: '90',  country: 'Turkey' },
    '971': { code: '971', country: 'UAE' },
    '966': { code: '966', country: 'Saudi Arabia' },
    '974': { code: '974', country: 'Qatar' },
    '968': { code: '968', country: 'Oman' },
    '973': { code: '973', country: 'Bahrain' },
    '965': { code: '965', country: 'Kuwait' },
    '962': { code: '962', country: 'Jordan' },
    '961': { code: '961', country: 'Lebanon' },
    '964': { code: '964', country: 'Iraq' },
    '972': { code: '972', country: 'Israel' },
    '98':  { code: '98',  country: 'Iran' },
    '86':  { code: '86',  country: 'China' },
    '81':  { code: '81',  country: 'Japan' },
    '82':  { code: '82',  country: 'South Korea' },
    '852': { code: '852', country: 'Hong Kong' },
    '65':  { code: '65',  country: 'Singapore' },
    '60':  { code: '60',  country: 'Malaysia' },
    '62':  { code: '62',  country: 'Indonesia' },
    '66':  { code: '66',  country: 'Thailand' },
    '63':  { code: '63',  country: 'Philippines' },
    '84':  { code: '84',  country: 'Vietnam' },
    '886': { code: '886', country: 'Taiwan' },
    '95':  { code: '95',  country: 'Myanmar' },
    '27':  { code: '27',  country: 'South Africa' },
    '234': { code: '234', country: 'Nigeria' },
    '254': { code: '254', country: 'Kenya' },
    '233': { code: '233', country: 'Ghana' },
    '20':  { code: '20',  country: 'Egypt' },
    '212': { code: '212', country: 'Morocco' },
    '256': { code: '256', country: 'Uganda' },
    '255': { code: '255', country: 'Tanzania' },
    '251': { code: '251', country: 'Ethiopia' },
    '55':  { code: '55',  country: 'Brazil' },
    '52':  { code: '52',  country: 'Mexico' },
    '54':  { code: '54',  country: 'Argentina' },
    '57':  { code: '57',  country: 'Colombia' },
    '56':  { code: '56',  country: 'Chile' },
    '51':  { code: '51',  country: 'Peru' },
    '58':  { code: '58',  country: 'Venezuela' },
    '61':  { code: '61',  country: 'Australia' },
    '64':  { code: '64',  country: 'New Zealand' }
};

const SORTED_CODES = Object.keys(COUNTRY_CODE_MAP).sort((a, b) => b.length - a.length);

function cleanPhoneNumber(raw) {
    if (!raw) return { number: '', countryCode: '', country: '' };

    let cleaned = raw
        .replace(/@c\.us$/i, '')
        .replace(/@s\.whatsapp\.net$/i, '')
        .replace(/@lid$/i, '');

    cleaned = cleaned.replace(/[^\d+]/g, '');
    cleaned = cleaned.replace(/^\+/, '');

    // Auto-detect country code
    let code = '';
    let country = 'Unknown';
    for (const prefix of SORTED_CODES) {
        if (cleaned.startsWith(prefix)) {
            code = COUNTRY_CODE_MAP[prefix].code;
            country = COUNTRY_CODE_MAP[prefix].country;
            break;
        }
    }

    return { number: cleaned, countryCode: code, country };
}

// Express Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({ success: true, data: { status: clientStatus, isReady: isClientReady } });
});

app.get('/api/download/:filename', (req, res) => {
    try {
        const fileName = req.params.filename;

        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }

        const filePath = path.join(EXPORTS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // RFC 5987 Unicode safe filenames
        const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
        const encodedName = encodeURIComponent(fileName).replace(/'/g, '%27');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
        );
        res.sendFile(filePath);
    } catch (err) {
        console.error('[API] Download error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Excel Generator Helper
async function generateExcel(groupName, contacts) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WA Group Contact Scraper';
    workbook.created = new Date();

    // Clean group name - STRIP ALL non-ASCII to prevent surrogate pair crashes
    const safeGroupName = groupName
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50) || 'group';

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `${safeGroupName}_contacts_${timestamp}.xlsx`;
    const filePath = path.join(EXPORTS_DIR, fileName);

    const worksheet = workbook.addWorksheet('Contacts', {
        properties: { tabColor: { argb: '25D366' } }
    });

    // Title row
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Contacts from: ${groupName}`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '128C7E' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 36;

    // Subtitle row
    worksheet.mergeCells('A2:G2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Extracted on: ${new Date().toLocaleString()} | Total: ${contacts.length} contacts`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '666666' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 22;

    // Headers
    const headerRow = worksheet.getRow(4);
    const headers = ['S.No', 'Phone Number', 'Country Code', 'Country', 'Display Name', 'Saved Name', 'Role'];
    headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '25D366' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: '1EBE57' } },
            bottom: { style: 'thin', color: { argb: '1EBE57' } },
            left: { style: 'thin', color: { argb: '1EBE57' } },
            right: { style: 'thin', color: { argb: '1EBE57' } }
        };
    });
    headerRow.height = 26;

    // Data
    contacts.forEach((contact, index) => {
        const row = worksheet.getRow(index + 5);
        const isEven = index % 2 === 0;

        let role = 'Member';
        if (contact.isSuperAdmin) role = 'Super Admin';
        else if (contact.isAdmin) role = 'Admin';

        const values = [
            index + 1,
            `+${contact.number}`,
            contact.countryCode ? `+${contact.countryCode}` : '-',
            contact.country || '-',
            contact.pushname || '-',
            contact.savedName || '-',
            role
        ];

        values.forEach((value, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = value;
            cell.font = { name: 'Calibri', size: 11, color: { argb: '333333' } };
            cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'center' : 'left' };

            if (isEven) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FFF4' } };
            }
            cell.border = { bottom: { style: 'hair', color: { argb: 'DCE6DC' } } };
        });
        row.height = 22;
    });

    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 22;
    worksheet.getColumn(3).width = 14;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 28;
    worksheet.getColumn(6).width = 28;
    worksheet.getColumn(7).width = 16;

    worksheet.autoFilter = { from: 'A4', to: `G${contacts.length + 4}` };
    worksheet.views = [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }];

    await workbook.xlsx.writeFile(filePath);
    return { filePath, fileName };
}

// Cleanup helper
function cleanupOldExports() {
    try {
        const files = fs.readdirSync(EXPORTS_DIR);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        files.forEach(file => {
            const filePath = path.join(EXPORTS_DIR, file);
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < oneHourAgo) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (err) {
        console.error('[Excel] Cleanup error:', err.message);
    }
}

// ── Socket.IO Event Handlers ───────────────────────────────────────────
io.on('connection', (socket) => {
    const isMock = socket.handshake.query.mock === 'true';
    console.log(`[Socket] Client connected: ${socket.id} (Mock Mode: ${isMock})`);

    if (!isMock) {
        socket.join('real-users');
        
        // Send current real status
        const statusMessages = {
            'idle': 'Initializing...',
            'initializing': 'Initializing WhatsApp client...',
            'qr_received': 'QR code ready - scan with WhatsApp',
            'authenticated': 'Authenticated successfully!',
            'ready': 'WhatsApp is connected and ready!',
            'disconnected': 'Disconnected from WhatsApp'
        };

        socket.emit('status', {
            status: clientStatus,
            message: statusMessages[clientStatus] || `Status: ${clientStatus}`,
            timestamp: Date.now()
        });

        if (isClientReady) {
            socket.emit('status', {
                status: 'ready',
                message: 'WhatsApp is connected and ready!',
                timestamp: Date.now()
            });
        }

        if (clientStatus === 'qr_received' && lastQrDataUrl) {
            socket.emit('qr', lastQrDataUrl);
        }
    } else {
        // Mock connection - immediately ready
        socket.emit('status', {
            status: 'ready',
            message: 'Mock Mode - Bypassed QR Scan',
            timestamp: Date.now()
        });
    }

    // List Groups
    socket.on('get-groups', async () => {
        if (isMock) {
            // Return realistic mock groups
            const mockGroups = [
                { id: 'mock-1', name: '🚖 श्रीराम ऑटोमॉल नरेला दिल्ली (Auction Group)', participantCount: 152 },
                { id: 'mock-2', name: '𝐒𝐀𝐘𝐘𝐀𝐃_𝐒𝐔𝐇𝐀𝐈𝐋_𝐇𝐀𝐒𝐌𝐈 - 𝐃𝐄𝐀𝐋𝐄𝐑𝐒𝐇𝐈𝐏 𝐂𝐀𝐑 𝐌𝐀𝐑𝐊𝐄𝐓', participantCount: 852 },
                { id: 'mock-3', name: 'Auction - Vehicle Sale North India', participantCount: 1163 },
                { id: 'mock-4', name: 'Psych Seva Connect', participantCount: 382 },
                { id: 'mock-5', name: 'Meena Car Bazaar (Jaipur)', participantCount: 263 },
                { id: 'mock-6', name: 'Tyagi Motors New Delhi', participantCount: 86 }
            ];

            socket.emit('groups-list', { success: true, groups: mockGroups, count: mockGroups.length });
            return;
        }

        try {
            if (!isClientReady) {
                socket.emit('error-msg', { message: 'WhatsApp client is not ready.' });
                return;
            }

            socket.emit('status', {
                status: 'fetching_groups',
                message: 'Fetching your groups...',
                timestamp: Date.now()
            });

            const chats = await client.getChats();
            const groups = chats
                .filter(chat => chat.isGroup)
                .map(chat => ({
                    id: chat.id._serialized,
                    name: chat.name || 'Unnamed Group',
                    participantCount: chat.groupMetadata ? chat.groupMetadata.participants.length : 0
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            socket.emit('groups-list', { success: true, groups, count: groups.length });
            socket.emit('status', {
                status: 'ready',
                message: `Found ${groups.length} groups`,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error('[Socket] Get groups error:', err.message);
            socket.emit('error-msg', { message: `Failed to fetch groups: ${err.message}` });
            socket.emit('status', { status: 'ready', message: 'Ready - group fetch failed', timestamp: Date.now() });
        }
    });

    // Extract Contacts
    socket.on('extract-contacts', async (data) => {
        const { groupId, groupName } = data;
        if (!groupId) {
            socket.emit('error-msg', { message: 'No group selected' });
            return;
        }

        if (isMock) {
            // Simulated contact extraction progress
            socket.emit('status', {
                status: 'extracting',
                message: `Extracting contacts from "${groupName}" (Mock Mode)...`,
                timestamp: Date.now()
            });

            const countToExtract = groupId === 'mock-1' ? 152 : 200;
            const mockContacts = [];
            const names = [
                'Rajesh Kumar', 'Amit Sharma', 'Vijay Singh', 'Sanjay Patel', 'Ramesh Yadav',
                'Deepak Gupta', 'Anil Verma', 'Sunil Mishra', 'Manoj Kumar', 'Pankaj Sharma',
                'Vikram Singh', 'Arjun Yadav', 'Rahul Gupta', 'Suresh Patel', 'Rohan Verma',
                'Preeti Sharma', 'Anjali Gupta', 'Pooja Singh', 'Neha Yadav', 'Karan Johar'
            ];

            const countries = [
                { code: '91', name: 'India', prefix: '919876' },
                { code: '1', name: 'US/Canada', prefix: '141555' },
                { code: '44', name: 'United Kingdom', prefix: '447700' }
            ];

            for (let i = 0; i < countToExtract; i++) {
                const nameIdx = i % names.length;
                const country = countries[i % countries.length];
                const randNum = Math.floor(100000 + Math.random() * 900000);
                const number = `${country.prefix}${randNum}`;

                mockContacts.push({
                    number,
                    countryCode: country.code,
                    country: country.name,
                    pushname: names[nameIdx] + ' (WA)',
                    savedName: names[nameIdx],
                    isAdmin: i === 0 || i === 5,
                    isSuperAdmin: i === 0
                });

                // Simulated delay every 10 steps to show animation
                if (i % 10 === 0) {
                    socket.emit('extraction-progress', {
                        current: i + 1,
                        total: countToExtract,
                        percent: Math.round(((i + 1) / countToExtract) * 100),
                        latestContact: `+${number}`
                    });
                    await new Promise(r => setTimeout(r, 60));
                }
            }

            // Final 100% progress
            socket.emit('extraction-progress', {
                current: countToExtract,
                total: countToExtract,
                percent: 100,
                latestContact: `+${mockContacts[mockContacts.length - 1].number}`
            });

            // Generate Excel
            socket.emit('status', {
                status: 'generating',
                message: 'Generating Excel file (Mock)...',
                timestamp: Date.now()
            });

            const { fileName } = await generateExcel(groupName, mockContacts);

            socket.emit('download-ready', {
                success: true,
                fileName,
                downloadUrl: `/api/download/${encodeURIComponent(fileName)}`,
                groupName,
                contactCount: mockContacts.length,
                totalParticipants: countToExtract
            });

            socket.emit('status', {
                status: 'ready',
                message: `Extraction complete! ${mockContacts.length} contacts saved.`,
                timestamp: Date.now()
            });

            return;
        }

        try {
            if (!isClientReady) {
                socket.emit('error-msg', { message: 'WhatsApp client is not ready' });
                return;
            }

            socket.emit('status', {
                status: 'extracting',
                message: `Extracting contacts from "${groupName}"...`,
                timestamp: Date.now()
            });

            const chat = await client.getChatById(groupId);
            if (!chat.isGroup) throw new Error('Selected chat is not a group');

            const participants = chat.groupMetadata ? chat.groupMetadata.participants : [];
            const total = participants.length;

            if (total === 0) throw new Error('No participants found in this group');

            const contacts = [];
            const seenNumbers = new Set();

            for (let i = 0; i < total; i++) {
                const participant = participants[i];
                try {
                    const contact = await client.getContactById(participant.id._serialized);
                    const rawNumber = contact.number || participant.id.user || '';
                    const phoneInfo = cleanPhoneNumber(rawNumber);
                    const cleanedNumber = phoneInfo.number;

                    if (cleanedNumber && !seenNumbers.has(cleanedNumber)) {
                        seenNumbers.add(cleanedNumber);
                        contacts.push({
                            number: cleanedNumber,
                            countryCode: phoneInfo.countryCode,
                            country: phoneInfo.country,
                            pushname: contact.pushname || '',
                            savedName: contact.name || '',
                            isAdmin: participant.isAdmin || false,
                            isSuperAdmin: participant.isSuperAdmin || false
                        });
                    }

                    // Progress update
                    io.emit('extraction-progress', {
                        current: i + 1,
                        total,
                        percent: Math.round(((i + 1) / total) * 100),
                        latestContact: cleanedNumber ? `+${cleanedNumber}` : 'Unknown'
                    });
                } catch (cErr) {
                    console.warn(`[Extraction] Failed contact ${participant.id._serialized}:`, cErr.message);
                    const fallbackInfo = cleanPhoneNumber(participant.id.user || '');
                    if (fallbackInfo.number && !seenNumbers.has(fallbackInfo.number)) {
                        seenNumbers.add(fallbackInfo.number);
                        contacts.push({
                            number: fallbackInfo.number,
                            countryCode: fallbackInfo.countryCode,
                            country: fallbackInfo.country,
                            pushname: '',
                            savedName: '',
                            isAdmin: participant.isAdmin || false,
                            isSuperAdmin: participant.isSuperAdmin || false
                        });
                    }
                }

                if (i < total - 1) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            // Generate Excel
            socket.emit('status', {
                status: 'generating',
                message: 'Generating Excel file...',
                timestamp: Date.now()
            });

            const { fileName } = await generateExcel(groupName, contacts);

            // Safe URL encoding
            let safeEncodedName;
            try {
                safeEncodedName = encodeURIComponent(fileName);
            } catch (e) {
                safeEncodedName = encodeURIComponent(fileName.replace(/[^\x20-\x7E]/g, '_'));
            }

            socket.emit('download-ready', {
                success: true,
                fileName,
                downloadUrl: `/api/download/${safeEncodedName}`,
                groupName,
                contactCount: contacts.length,
                totalParticipants: total
            });

            socket.emit('status', {
                status: 'ready',
                message: `Extraction complete! ${contacts.length} contacts saved.`,
                timestamp: Date.now()
            });

            cleanupOldExports();
        } catch (err) {
            console.error('[Socket] Extraction error:', err.message);
            socket.emit('error-msg', { message: `Extraction failed: ${err.message}` });
            socket.emit('status', { status: 'ready', message: 'Ready - extraction failed', timestamp: Date.now() });
        }
    });

    socket.on('logout', async () => {
        try {
            isClientReady = false;
            await client.logout();
        } catch (err) {
            socket.emit('error-msg', { message: `Logout failed: ${err.message}` });
        }
    });
});

// Start Server
server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   WA Group Scraper Server (Consolidated)             ║');
    console.log(`║   Running at: http://localhost:${PORT}                      ║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
});
