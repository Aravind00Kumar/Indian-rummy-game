# Contributing to Indian Rummy Multiplayer Game

Thank you for your interest in contributing to the **Indian Rummy Multiplayer Game**!

---

## 🛠️ How to Contribute

1. **Fork the Repository**: Click the `Fork` button on top right of the GitHub page.
2. **Clone your Fork**:
   ```bash
   git clone https://github.com/<YOUR_USERNAME>/Indian-rummy-game.git
   cd Indian-rummy-game
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```
4. **Install Dependencies & Test**:
   ```bash
   npm install
   npm run dev
   npm run build
   ```
5. **Commit your Changes**:
   ```bash
   git commit -m "feat: add my awesome feature"
   ```
6. **Push to your Fork & Open a Pull Request**:
   ```bash
   git push origin feature/my-awesome-feature
   ```

---

## 📜 Code Style Guidelines

- **React Components**: Use functional components with hooks and export named components.
- **PixiJS Canvas**: Encapsulate WebGL logic in `src/engine/` classes.
- **Formatting**: Keep line lengths reasonable and write clear comments for complex game rules.
- **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, `refactor:`).
