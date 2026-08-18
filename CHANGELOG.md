# Changelog

All notable changes to the **Indian Rummy Multiplayer Game** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-08-19

### 🚀 Added
- **React.js 18 UI Shell**: Replaced monolithic Vanilla DOM manipulations with modular React components (`<AuthScreen />`, `<LobbyScreen />`, `<GameHeader />`, `<OpponentsSidebar />`, `<DeclarationModal />`).
- **PixiJS 2D WebGL Engine**: Hardware-accelerated 60 FPS 2D canvas rendering card sprites, 13-card hand layouts, magnetic slot snapping, and 3D card flips.
- **TextureLoader**: Dynamic vector SVG playing card texture caching for single-draw-call WebGL performance.
- **Zustand Global State Stores**: Lightweight state management for user authentication, coins, room states, and active modals.
- **Vite Bundler Integration**: Fast development HMR and production build output targeting `./www` for seamless Capacitor integration.
- **GitHub Documentation & CI/CD**: Standard repository configuration with `README.md`, `CHANGELOG.md`, `LICENSE`, `CONTRIBUTING.md`, and GitHub Actions workflows.

### ⚡ Changed
- Refactored `rules.js`, `auth-service.js`, and `multiplayer-service.js` into ES module format.
- Optimized static file serving in `server.js` to serve Vite builds from `./www` first.

---

## [1.0.0] - 2026-08-10

### 🚀 Added
- Initial release of 13-Card Indian Rummy Multiplayer Game.
- Node.js & Socket.IO real-time WebSocket backend with custom room creation (4-digit codes) and public tournament rooms.
- Client-side Indian Rummy validation engine (Pure Sequence, Impure Sequence, Sets, All Triplets, Penalty score cap 80 pts).
- Capacitor Android wrapper setup with dynamic LAN IP detection and APK download endpoints.
