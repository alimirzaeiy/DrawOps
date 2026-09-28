# 🎨 DrawOps

> **Interactive infinite canvas for SSH server management, /srv directory exploration, Docker inspection, and web terminal.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<p align="center">
  <em>Visual server operations on an infinite canvas with Apple Terminal aesthetics, live SSH & zero-delete safety.</em>
</p>

---

## ✨ Features

### 🎨 Draw.io Canvas Interface
- **Drag & drop** server nodes on an infinite zoom/pan canvas powered by [React Flow](https://reactflow.dev/)
- **Product group bounding boxes** — organize servers into named groups with neon-colored dashed frames
- **Chrome-like tabs** — switch between product groups instantly
- **Auto-layout** — neatly arrange all servers with one click
- **Canvas `/srv` exploration** — expand directory trees visually as connected nodes

### 🔐 SSH Architecture (Hardware Key Support)
- **FIDO2 / ECDSA-SK / YubiKey** — native macOS OpenSSH via Python PTY bridge
- **`~/.ssh/config` host discovery** — auto-detect all configured SSH aliases
- **ControlMaster multiplexing** — one hardware key touch, then reuse the session
- **Interactive terminal** — full xterm.js terminal for passphrase entry and key confirmation

### 📂 `/srv` Directory Explorer
- **Recursive tree scanning** via SSH with Python scanner or `find` fallback
- **Dual exploration modes:**
  - **Canvas Mode** — step-by-step visual node expansion with color-coded connectors
  - **Drawer Mode** — full hierarchical tree list with Docker management
- **Monaco editor** — embedded VS Code web editor for viewing and editing files
- **Create files & folders** — with sudo elevation support when needed

### 🐳 Docker Container Management
- View all containers with status, ports, and images
- **Folder-scoped Docker Compose** — filter containers by compose project directory
- **Interactive container logs** — real-time log viewer with tail selection
- **Sudo password elevation** — in-memory only, never written to disk

### 🛡️ Safety-First Design (Zero-Delete Policy)
- **Rule 1: Zero Delete** — `rm`, `rmdir`, `docker rm`, etc. are **always blocked** by SecurityGuardian
- **Rule 2: Command Whitelist** — only safe, read-only inspection and creation commands allowed
- **Rule 3: Mandatory Backup** — every file edit creates a timestamped backup in `/home/<user>/srv_backups/`
- **Rule 4: RAM-Only Passwords** — sudo passwords exist only in browser memory, never persisted

### 💾 Offline-First with SQLite
- Server metadata, `/srv` trees, Docker states, and file contents cached locally
- Browse and inspect servers without an active SSH connection
- Automatic state sync when reconnecting

---

## 🏛️ Architecture

```
server-manager/
├── backend/                  # Node.js + Express + WebSocket + SQLite
│   └── src/
│       ├── index.ts          # HTTP & WebSocket server
│       ├── db.ts             # SQLite (Node.js native node:sqlite)
│       ├── routes.ts         # REST API endpoints
│       ├── sshService.ts     # OpenSSH ControlMaster + ECDSA-SK
│       ├── sshConfigService.ts # ~/.ssh/config host discovery
│       ├── pty_bridge.py     # Python PTY bridge for macOS
│       ├── securityGuardian.ts # Zero-delete enforcement
│       └── seed.ts           # Demo seed data
│
├── frontend/                 # React 19 + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.tsx           # Main canvas with React Flow
│       ├── types.ts          # TypeScript interfaces
│       └── components/       # UI components (11 files)
│
└── package.json              # Monorepo runner
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v22+ (for native `node:sqlite` support)
- **Python 3** (for the PTY bridge)
- **macOS** with native OpenSSH (required for ControlMaster and ECDSA-SK)
- SSH keys configured in `~/.ssh/config` (optional but recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/server-manager.git
cd server-manager

# Install all dependencies (root, backend, frontend)
npm install
npm --prefix backend install
npm --prefix frontend install
```

### Running

```bash
# Start both frontend and backend concurrently
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **WebSocket Terminal:** ws://localhost:3001/ws/terminal

### Running Security Tests

```bash
cd backend
npx tsx src/__tests__/securityGuardian.test.ts
```

---

## 🎨 Design System

The UI is inspired by the classic macOS iTerm / oh-my-zsh Apple theme:

| Element | Color | Usage |
|---------|-------|-------|
| Neon Green | `#27c93f` | Active borders, highlights, primary actions |
| Apple Magenta | `#ff3b94` | Apple symbol `` in headers |
| Terminal Black | `#121214` | Backgrounds |
| Traffic Lights | 🔴🟡🟢 | macOS window chrome on all panels |

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Flow, Monaco Editor, xterm.js |
| Backend | Node.js, Express, WebSocket (ws), Native SQLite (node:sqlite) |
| SSH | Native macOS OpenSSH, Python PTY bridge, ControlMaster multiplexing |
| Security | SecurityGuardian (zero-delete enforcement, command whitelist) |

---

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
