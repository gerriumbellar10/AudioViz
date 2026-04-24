# Contributing to AudioViz

Thanks for considering contributing.

## Quick start

```bash
npm install
npm run tauri:dev
```

## Project structure
- **Frontend (React/TS)**: `src/`
- **Tauri backend (Rust)**: `src-tauri/`

## Development notes
- **Web mode** (`npm run dev`) is for UI iteration only; export is available in the desktop app.
- If you run into build issues, try a clean install:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Code style
- Keep UI changes minimal and consistent with existing layout.
- Prefer small, focused commits/PRs with clear descriptions.

## Reporting issues
When opening an issue, please include:
- macOS version + CPU (Apple Silicon / Intel)
- AudioViz version
- Steps to reproduce
- Console logs (if relevant)

