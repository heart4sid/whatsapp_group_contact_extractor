# WhatsApp Group Contact Extraper

A production-ready, beautiful, and secure web application that allows you to connect to WhatsApp Web via QR code, discover all your groups, extract participant contact details (including display names, saved names, and roles), and export them into a professionally styled Excel (`.xlsx`) spreadsheet.

Featuring a robust **Mock Mode** for demonstration and testing without requiring a live WhatsApp scan.

---

## 🌟 Key Features

*   **Secure QR Authentication**: Dynamic QR code loading in-browser with real-time status updates (Initializing, Scan QR, Connected).
*   **Zero-Session-Locks Architecture**: Uses a consolidated, single-file server structure with process safety guards to prevent Puppeteer crashed frame crashes from interrupting your server.
*   **Group Discovery & Search**: Lists all available groups with participant counts, searchable in real-time.
*   **Country Code Auto-Detection**: Auto-detects and formats country codes for **75+ countries** (e.g. India, US/Canada, UK, UAE, etc.) using longest-prefix matching.
*   **Anti-Detection & Safe Extraction**: Employs a 200ms delay between participant contact lookups to mitigate rate-limiting risk.
*   **Styled Excel Generation**: Exports contacts with headers, frozen rows, auto-filters, alternating row colors, and custom column widths.
*   **Unicode/Emoji File Safety**: Employs RFC 5987 Unicode-safe content-disposition header encoding to handle emojis and special characters in group names without crashing the downloads.
*   **Mock / Simulation Mode**: Passing `?mock=true` allows full inspection of all pages and downloading simulated contact spreadsheets instantly without scanning a QR code.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5, Vanilla CSS3 (custom animations & glassmorphism card layouts), Tailwind CSS v3 (via CDN), Google Fonts (Inter).
*   **Backend**: Node.js + Express.js.
*   **Real-time Communication**: Socket.IO for status synchronization and progress tracking.
*   **WhatsApp Automation**: Puppeteer + `whatsapp-web.js` (NoAuth strategy for clean launches).
*   **Excel Generation**: `exceljs`.

---

## 📂 Project Structure

```
whatsapp_group_contact_extractor/
├── app_server.js       # Express + Socket.IO + WhatsApp client consolidated server
├── package.json        # Node.js dependencies & scripts
├── .gitignore          # Git ignores (node_modules, exports, session cache)
├── README.md           # Documentation
└── public/
    ├── index.html      # Main SPA dashboard
    └── css/
        └── styles.css  # Glassmorphism cards, custom transitions & animations
    └── js/
        └── app.js      # Frontend controller (Socket.IO client & state machine)
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Clone the repository
```bash
git clone https://github.com/heart4sid/whatsapp_group_contact_extractor.git
cd whatsapp_group_contact_extractor
```

### 2. Install dependencies
This will install all required Node packages, including Puppeteer and its Chromium browser dependencies.
```bash
npm install
```

### 3. Run the application
```bash
npm start
```
The server will start on port **3001**:
`Server running at: http://localhost:3001`

---

## 🎮 How to Use

### A. Mock Mode (Instant Testing - No Scanning Required)
1. Open [http://localhost:3001/?mock=true](http://localhost:3001/?mock=true) in your browser.
2. The authentication panel will instantly bypass and load the mock group list.
3. Select a group and click **Extract Contacts**.
4. Once progress completes, click **Download Excel (.xlsx)**.

### B. Live Mode (Real WhatsApp Extraction)
1. Open [http://localhost:3001/](http://localhost:3001/) in your browser.
2. Open WhatsApp on your phone -> Settings -> Linked Devices -> Link a Device.
3. Scan the QR code displayed on the web interface.
4. Select a group, click **Extract Contacts**, and download the generated spreadsheet.

---

## 🛡️ Disclaimer
This tool is intended for educational and personal data archiving purposes only. Using unofficial WhatsApp APIs carries a risk of account suspension by Meta. Do not use this tool for spamming or harvesting data without consent.
