# 🎴 Indian Rummy Multiplayer Game

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://react.dev/)
[![PixiJS](https://img.shields.io/badge/PixiJS-7.4-red.svg)](https://pixijs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-black.svg)](https://socket.io/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.0-blueviolet.svg)](https://capacitorjs.com/)

A real-time, cross-platform multiplayer 13-Card Indian Rummy game built with **React.js**, **PixiJS 2D WebGL Engine**, **Node.js**, **Socket.IO**, and **Capacitor Android**.

---

## 🌟 Key Highlights

- **⚡ Hardware-Accelerated 60 FPS WebGL Engine**: Powered by PixiJS for smooth 13-card dealing, bezier curve animations, 3D card flips, and magnetic slot snapping.
- **🧩 Component-Based UI**: Built with React.js 18 and Tailwind CSS for responsive lobbies, player avatars, turn timer rings, room configuration dialogs, and coin scoreboards.
- **🌐 Real-Time Multiplayer Sync**: Low-latency WebSocket state synchronization powered by Node.js & Socket.IO.
- **📱 Dual Platform Deployment**: Single codebase serving Web Browsers (Desktop/Mobile) and compiled native Android APKs via Capacitor.
- **📜 Official Indian Rummy Rules Engine**:
  - Pure Sequence validation (consecutive suit cards, no jokers).
  - Impure Sequence validation (with Wild Jokers & Printed Jokers).
  - Sets / Triplets check.
  - Special Hand: **All Triplets** (13-card natural triplet hand with double-win bonuses).
  - Penalty score computation (capped at 80 points).
- **💰 User Economy & Session Persistence**: Coin balance tracking, free refill rewards, profile avatars, and server URL customization for local LAN networks.

---

## 🏗️ Architecture

```
                                  +-----------------------+
                                  |   Node.js + Socket.IO  |
                                  |    Multiplayer Server  |
                                  +-----------+-----------+
                                              |
                                   (WebSocket State Sync)
                                              |
        +-------------------------------------+-------------------------------------+
        |                                                                           |
        v                                                                           v
+-----------------------------------+                       +-----------------------------------+
|      React.js UI Shell Overlay    |                       |      PixiJS 2D WebGL Engine       |
|  - Auth / Login / Settings Modals | <--- Zustand Store --->|  - Green Felt Card Table Viewport  |
|  - Room Creation & Join Modals    |       Event Bus       |  - Interactive 13-Card Hand Sprites|
|  - Pot Badge & Turn Timer Ring    |                       |  - Closed Deck, Wild Joker, Discard|
|  - Settlement Scoreboard Modal    |                       |  - Card Flip & Confetti Particle FX|
+-----------------------------------+                       +-----------------------------------+
```

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend UI** | React.js 18, Tailwind CSS, Lucide Icons | Responsive UI shell, modals, forms, and overlays |
| **Game Engine** | PixiJS v7, WebGL, Canvas Confetti | 60 FPS 2D WebGL sprite rendering & card animations |
| **State Management**| Zustand v4 | Lightweight state store for game & user sessions |
| **Real-time Server**| Node.js, Socket.IO v4, Express/HTTP | WebSocket multiplayer rooms & REST API endpoints |
| **Mobile Runtime** | Capacitor v6 Android | Packages Web bundle into native Android APKs |
| **Build Tooling** | Vite v5 | Fast ES module bundler outputting to `./www` |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (v9 or higher)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Aravind00Kumar/Indian-rummy-game.git
cd Indian-rummy-game
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser to view the app with Hot Module Replacement (HMR).

### 3. Start Multiplayer Backend Server
```bash
npm run start
```
Runs the Node.js HTTP & Socket.IO server on port `3000`.

### 4. Production Build
```bash
npm run build
```
Compiles production bundles directly to `./www` directory for server static distribution and Capacitor mobile builds.

---

## 📱 Android APK Build & Packaging

Build native Android APKs locally using Capacitor:

```bash
# 1. Compile Vite frontend build to ./www
npm run build

# 2. Sync web assets with Capacitor Android wrapper
npm run cap:sync

# 3. Open Android Studio project or build APK script
npm run cap:android
# OR
npm run build:apk
```

---

## 🃏 Game Rules & Scoring

1. **Card Deal**: Each player is dealt 13 cards. A Wild Joker rank is randomly selected for the round.
2. **Turn Lifecycle**: On your turn, draw a card from either the **Closed Draw Deck** or **Open Discard Pile**, then discard 1 card.
3. **Valid Declaration Criteria**:
   - Must have at least **1 Pure Sequence** (3+ consecutive cards of same suit, no jokers).
   - Must have at least **2 Sequences in total** (1 Pure + 1 Impure/Pure).
   - Remaining cards must form valid **Sequences** or **Sets** (3 or 4 cards of same rank across different suits).
4. **Special Hand (All Triplets)**: If all 13 cards form natural sets/triplets without jokers, the player receives a double win payout!
5. **Score Penalties**: Unarranged cards are scored based on face value ($A, K, Q, J = 10 \text{ pts}$, numbers = face value). Maximum penalty is capped at **80 points**.

---

## 📁 Repository Structure

```
indian-rummy-game/
├── android/                   # Capacitor Android native wrapper project
├── src/
│   ├── components/            # React UI components (Auth, Lobby, Game, Modals)
│   ├── engine/                # PixiJS WebGL engine (TextureLoader, CardSprite, HandManager)
│   ├── services/              # Game rules, authentication, and Socket.IO client
│   ├── store/                 # Zustand global state stores (useAuthStore, useGameStore)
│   ├── App.jsx                # React top-level router/switcher
│   └── main.jsx               # React entry point
├── scripts/
│   └── build-apk.js           # Dynamic LAN IP detector & APK build runner
├── server.js                  # Core Node.js & Socket.IO game server
├── vite.config.js             # Vite configuration targeting ./www output
├── capacitor.config.json      # Capacitor Android runtime configuration
├── CHANGELOG.md               # Version history and release notes
├── CONTRIBUTING.md            # Community contribution guidelines
├── LICENSE                    # MIT License
└── package.json               # Dependencies and scripts
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👨‍💻 Author

**Aravind Kumar**  
GitHub: [@Aravind00Kumar](https://github.com/Aravind00Kumar)
