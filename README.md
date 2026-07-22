# OpenSlides

OpenSlides is a free, offline-first desktop app for creating and presenting code-focused slide decks. It helps developers, teachers, and technical speakers turn source code into clear presentations without uploading their work or relying on an internet connection.

## What it helps you do

- Create slide decks built around source code.
- Explain code step by step with highlights and transitions.
- Keep projects on your own computer for private, reliable offline work.
- Search, organize, duplicate, import, and export slides quickly.
- Present with keyboard controls, full-screen mode, and optional autoplay.

## How it works

OpenSlides keeps each project locally on your device. Write or paste code into slides, select the parts you want to explain, and create highlight steps that guide an audience through the important lines. During presentation, you can move through slides and highlight steps with the keyboard, use fullscreen mode, or let slides advance automatically.

Your work remains local, so you can prepare and present in places with unreliable or no internet access.

## Highlights

- Syntax highlighting for code slides.
- Step-by-step code highlights with Magic Move transitions.
- Slide names, code alignment options, and per-slide timing.
- Slide stacks and drag-and-drop organization.
- Full-text search, cached thumbnails, and hover previews.
- Per-slide undo and redo.
- Import and export for sharing and backup.
- Light and dark themes.
- Keyboard navigation and presentation controls.

## Tech stack

- **Desktop:** Tauri 2 and Rust
- **Interface:** React 19, TypeScript, Vite, and Tailwind CSS
- **Local data:** SQLite and sqlx
- **Code rendering:** Shiki and shiki-magic-move
- **Interaction:** Zustand, TanStack Query, dnd-kit, and Framer Motion

## Run from source

### Requirements

- Node.js 20 or newer
- Rust stable toolchain and Cargo
- Platform requirements for Tauri 2

### Development

```bash
npm install
npm run tauri dev
```

To run the web interface only:

```bash
npm run dev
```

### Quality checks

```bash
npm run build
npm run test:highlight
npm run test:save-race
```

## Releases

Download available installers from the [OpenSlides Releases](https://github.com/codewiththiha/OpenSlides/releases) page.

## License

MIT
