# GEMINI.md - Server Manager Context & Architecture Guide

Welcome to **Server Manager**, an interactive visual server operations platform with a Draw.io canvas interface and an authentic Apple macOS Terminal aesthetic (inspired by the classic iTerm `oh-my-zsh` Apple theme with magenta ``, branch tag `[master+]`, neon green borders `#27c93f`, dark backgrounds, and monospace typography).

---

## 🏛️ 1. Project Architecture & Monorepo Structure

```
server-manager/
├── backend/                  # Node.js + Express + WebSocket + Native SQLite + SSH2
│   ├── src/
│   │   ├── index.ts          # Main HTTP & WebSocket server entrypoint
│   │   ├── db.ts             # SQLite initialization using Node.js native node:sqlite
│   │   ├── routes.ts         # REST API endpoints (servers, files, positions, backups, removal, ssh hosts)
│   │   ├── sshService.ts     # Native OpenSSH with ControlMaster & physical key (ECDSA-SK) support
│   │   ├── sshConfigService.ts # ~/.ssh/config & config.d host discovery and alias resolution
│   │   ├── pty_bridge.py     # Native Python PTY bridge for macOS OpenSSH interactive terminal
│   │   ├── securityGuardian.ts # Strict zero-delete, command whitelist & /home backup generator
│   │   ├── seed.ts           # Development seed data for immediate offline testing
│   │   └── __tests__/        # Automated security guardian & unit tests
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── App.tsx           # Main Draw.io canvas (@xyflow/react) with controls & top bar
│   │   ├── types.ts          # TypeScript interfaces (Server, FileNode, DockerContainer, etc.)
│   │   ├── index.css         # Tailwind v4 styles, custom terminal scrollbar, theme variables
│   │   └── components/
│   │       ├── ServerNode.tsx          # Custom React Flow node with macOS window chrome & removal trigger
│   │       ├── FileCanvasNode.tsx      # Step-by-step canvas /srv directory & file nodes
│   │       ├── GroupCanvasNode.tsx     # Canvas dashed bounding box frame for product groups
│   │       ├── ServerDetailsDrawer.tsx # /srv recursive tree & Docker containers view
│   │       ├── FileTreeItem.tsx        # Expandable tree item component for /srv explorer
│   │       ├── MonacoEditorModal.tsx   # Embedded VS Code web editor (@monaco-editor/react)
│   │       ├── TerminalDrawer.tsx      # Live interactive SSH terminal (@xterm/xterm)
│   │       ├── AddServerModal.tsx      # Modal to add new server nodes to canvas
│   │       └── NewItemModal.tsx        # Modal to create files/folders under /srv
│   ├── tailwind.config.js    # Custom terminal palette (term-green, term-apple, etc.)
│   ├── postcss.config.js     # @tailwindcss/postcss
│   └── vite.config.ts
│
├── package.json              # Monorepo runner (concurrent dev script)
├── .gitignore
├── GEMINI.md                 # Agent context & system manual (this file)
└── README.md                 # Project documentation
```

---

## 🎨 2. Visual & Design System Guidelines

- **macOS Window Frame**: All windows, drawers, and nodes feature macOS traffic light buttons (`#ff5f56`, `#ffbd2e`, `#27c93f`).
- **Apple Prompt Style**: Prompt header mirrors macOS terminal: ` ~/path/ [master+]`.
  - Apple symbol: Magenta `#ff3b94` (`text-term-apple`).
  - Active borders: Neon Green `#27c93f` with glowing drop shadow (`shadow-term-glow`).
  - Background: Deep matte terminal black `#121214` and `#18181c`.
- **Canvas**: Infinite zoom/pan draw.io style built with `@xyflow/react`, dotted matrix background, zoom/fit controls, and node-to-node connectors.
- **Product-Based Server Grouping (Hybrid Mode)**:
  - **Chrome-like Tabs Bar**: Header tabs for switching and isolating product suites (`All Servers`, `Frontend`, `Backend`, etc.). Supports creating new empty groups on demand.
  - **Canvas Dashed Bounding Boxes (`GroupCanvasNode`)**: Large neon dashed frames surrounding each product group on the canvas with macOS badges and server counts. Each group automatically receives a distinct, vibrant neon terminal color (Neon Green, Cyan, Purple, Amber, Rose, Blue, Orange, Pink) distinguishing boundaries, badges, and tabs across different products. Empty groups display an interactive placeholder card with `Add Server Here` and `Remove Group` buttons.
  - **Whole-Group Canvas Dragging**:
    - Users can grab and drag the header badge (`.group-drag-handle` with Move icon) of any product group frame.
    - All servers belonging to that group are smoothly translated together by `(dx, dy)`, and their new positions are automatically synchronized and persisted to SQLite (`PUT /api/servers/:id/position`).
  - **Empty Group Creation & Flexible Assignment**:
    - Clicking `New Group` creates a standalone empty product group stored in SQLite (`product_groups` table).
    - Servers can be assigned or moved to any group at any time via:
      1. Direct inline group selector badge on each `ServerNode` on the canvas.
      2. Group dropdown selector in `ServerDetailsDrawer`.
      3. `Add Server Here` button directly on an empty group's canvas bounding box.
      4. Product group selector in `AddServerModal`.
- **Dual `/srv` Exploration Modes**:
  - **Canvas Mode (`Canvas` button)**: Step-by-step visual node expansion to the right of the server with interactive color-coded connectors for direct architectural mapping.
  - **Drawer Mode (`Drawer` button & `/srv TREE` metric click)**: Side drawer explorer with full hierarchical tree list, Docker container management, and `/home` backup logs for rapid bulk folder navigation and file editing.
- **Typography**: Clean monospace fonts: `Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`.

---

## 🔑 3. SSH Architecture: Hardware Keys (ECDSA-SK / FIDO2) & ~/.ssh/config

- **~/.ssh/config Host Discovery**:
  - The application automatically scans `~/.ssh/config` and all included configs (e.g. `~/.ssh/config.d/*/*`).
  - Available host aliases are exposed via `/api/ssh/hosts` and resolved using native `ssh -G <alias>`.
  - In `AddServerModal`, users can instantly search and select from their configured aliases (e.g. `web-prod`, `db-staging`, `monitoring-01`).
- **Physical Hardware Keys (FIDO2 / ECDSA-SK / YubiKey)**:
  - Backed by native macOS OpenSSH (`/usr/bin/ssh`) via Python PTY bridge (`pty_bridge.py` executed with `python3 -u` and `PYTHONUNBUFFERED=1` for direct unbuffered raw pseudoterminal streaming compatible with macOS Apple Silicon).
  - In the interactive xterm.js terminal, users see and interact directly with native security prompts:
    - Passphrase prompt: `Enter passphrase for key '~/.ssh/id_ecdsa_sk': `
    - Physical touch confirmation: `Confirm user presence for key ECDSA-SK ... User presence confirmed`
- **Automatic Touch & Sync Onboarding & On-Demand Sync Flow**:
  - When a user adds a new server or clicks **Sync** on an existing server without an active session:
    1. If no active OpenSSH ControlMaster session is alive, the interactive terminal session (`TerminalDrawer`) opens automatically.
    2. The user enters their private key passphrase and taps their hardware key directly in the macOS terminal.
    3. Backend `SSHService.attachTerminal` monitors ControlMaster socket creation and broadcasts `master_ready` as soon as user presence is verified.
    4. The frontend catches `onMasterReady`, automatically executes `/srv` directory scanning and Docker container discovery (`handleSyncServer`), and updates the UI in real time.
    5. A clean banner appears at the top of the terminal: `SSH Sync Complete! Do you want to close this terminal session now?` with `Yes, Close Terminal` and `Keep Open` options.
- **OpenSSH ControlMaster Multiplexing**:
  - Socket path: `~/.ssh/sockets/%r@%h:%p` with `ControlPersist=10m`.
  - Once user presence is confirmed via terminal or sync, all subsequent `/srv` scans, Docker container listings, and Monaco editor reads/writes re-use the established socket without requiring repeated hardware touches.
- **Sudo Elevation for Docker (`docker.sock` Permission Fallback)**:
  - If a user/server (e.g. `deploy@app-server`) receives `permission denied while trying to connect to the docker API at unix:///var/run/docker.sock` when running non-root `docker ps`:
    1. Backend `SSHService.scanServer` catches the permission error and flags `dockerPermissionDenied: true`.
    2. If a sudo password is provided in the request, it executes `echo '<sudoPassword>' | sudo -S docker ps ...` to safely fetch the containers.
    3. If no sudo password is provided, the frontend detects `dockerPermissionDenied` and opens the terminal-styled `SudoPasswordModal` (or shows an elevation banner in the Docker drawer).
    4. **RAM-Only Policy**: Sudo passwords are NEVER written to disk, SQLite, or file cache. They are retained strictly in React in-memory state (`sessionPasswords`) for the active session.
- **Folder-Scoped Docker Compose & Container Logs Viewer**:
  - **Directory-Scoped Compose (`docker compose ps`)**:
    - In `ServerDetailsDrawer`, clicking on any directory in the `/srv` File Tree selects that folder as active.
    - Switching to (or viewing) the **Docker Services** tab immediately executes `GET /api/servers/:id/docker/compose?path=<dirPath>`.
    - It executes `docker compose ps -a` (or `docker-compose ps -a` with sudo fallback if needed) in that directory and displays only the containers belonging to that compose project.
    - Users can clear the filter anytime with "Show All Server Containers".
  - **Interactive Container Logs Modal (`DockerLogsModal.tsx`)**:
    - Clicking on any container card in the Docker drawer opens a full terminal-styled modal showing real-time container logs (`GET /api/servers/:id/docker/containers/:containerId/logs?tail=250`).
    - Supports tail selection (`100`, `250`, `500`, `1000`), copy all logs to clipboard, auto-scroll toggle, and manual refresh.

---

## 🛡️ 4. Critical Safety & Security Policies (MANDATORY)

These 3 core safety rules are absolute and must never be violated in any feature or modification:

1. **Zero-Delete Policy**:
   - The application **must never delete anything** from remote servers (`rm`, `rmdir`, `unlink`, `docker rm`, `truncate`, `shred`, `wipe`, etc.).
   - No deletion endpoints or UI buttons exist.
   - Any command or input containing deletion intent is immediately blocked by `SecurityGuardian.assertNoDelete()`.

2. **Strict Command Whitelist**:
   - Only safe, non-destructive discovery and inspection commands are permitted:
     - Inspection: `docker ps -a` (with `sudo -S` fallback when required), `find /srv -maxdepth 5`, python directory scanner.
     - Reading/Writing: SFTP streams.
     - Creation: `mkdir -p`, `touch` (with sudo fallback prompt when permissions require).

3. **Mandatory `/home` Backup Before Edit**:
   - Whenever any file in `/srv` is saved via `MonacoEditorModal`:
     1. The current file content is read.
     2. A timestamped copy is saved to `/home/<username>/srv_backups/<timestamp>_<filename>`.
     3. The backup action is logged in SQLite (`backup_logs` table).
     4. Only after backup confirmation is the new content written to `/srv`.

4. **Zero-Disk Sudo Password Storage**:
   - Sudo passwords are never saved to SQLite, local files, or permanent storage. They exist purely in memory during the browser session.

---

## 💾 5. Offline Persistence & Database Schema (SQLite)

Located at `backend/data/server_manager.db` (powered by Node.js native `node:sqlite`):

- `servers`: Server connection metadata, canvas `position_x`, `position_y`, status (`online`/`offline`/`cached`).
- `server_state`: Full JSON cache of `/srv` directory tree and Docker container statuses.
- `file_cache`: Cached file contents opened in Monaco editor, enabling full offline inspection.
- `backup_logs`: Historical audit log of every backup generated in `/home`.

---

## ⚡ 6. Common Commands & Workflows

### Run Development (Frontend + Backend concurrently):
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API & WebSocket: `http://localhost:3001`

### Run Backend Only:
```bash
npm --prefix backend run dev
```

### Run Frontend Only:
```bash
npm --prefix frontend run dev
```

### Run Security Guardian Test Suite:
```bash
npm --prefix backend run build
npx tsx backend/src/__tests__/securityGuardian.test.ts
```
