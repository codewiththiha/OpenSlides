# OpenSlides

**Beautiful code presentations for content creators, educators, and developers.**

OpenSlides is a free, open-source, offline desktop app for turning code into polished slides with smooth, step-by-step transitions. It is a direct alternative to [codeslides.app](https://codeslides.app): create expressive code decks, keep your work on your own machine, and present without a subscription or internet connection.

---

### Slides

![slides demo](https://www.image2url.com/r2/default/gifs/1784959147106-cee92309-e79d-42f0-8dc0-1edf29556368.gif)

Turn source code into presentation-ready slides. Move between code states with smooth Magic Move transitions, and build a visual story around your code instead of showing a static editor.

### Highlights

![highlight demo](https://www.image2url.com/r2/default/gifs/1784959026570-b96f1a88-2500-464b-b34c-b551d382aab6.gif)

Reveal an idea line by line with stepped highlights. Control emphasis per step: dim amount, size-up scale, and custom transition timings — so you can guide viewers through a function, refactor, algorithm, or feature at a natural pace.

### Themes

![themes demo](https://www.image2url.com/r2/default/gifs/1784959215303-431de853-3e09-4b5f-8ebd-af19973168b4.gif)

Choose light or dark presentation themes to match your style and recording setup.

---

## Made for explaining code beautifully

Whether you are recording a tutorial, teaching a class, streaming a live build, giving a conference talk, or sharing a technical demo, OpenSlides helps you focus attention on the exact part of the code that matters.

- Keep projects private, local, and ready to present anywhere.
- Search across slides, use thumbnails and hover previews, and navigate by keyboard.
- Present in full screen with optional autoplay and per-slide timing.
- Create, organize, rename, duplicate, import, and export slide projects.
- Arrange slides in stacks and reorder them with drag and drop.

## How it works

Create a project, add your code to slides, then select the lines you want to explain. OpenSlides turns those selections into presentation steps, so you can guide viewers through a function, refactor, algorithm, or feature at a natural pace. When it is time to present, move through slides and highlight steps with the keyboard, use full-screen mode, or let the deck advance automatically.

Everything stays on your computer. That makes OpenSlides useful for private client work, offline classrooms, live events, and any workflow where you want your code and slides under your control.

## Download

Prebuilt installers for macOS, Windows, and Linux are available from the [OpenSlides Releases](https://github.com/codewiththiha/OpenSlides/releases) page.

### Platform packages

- **macOS:** separate Apple Silicon (`aarch64`) and Intel (`x64`) builds
- **Windows:** x64 and ARM64 builds
- **Linux:** `.deb`, `.rpm`, and AppImage
- **Nix:** flake package for `x86_64-linux`, `x86_64-darwin`, and `aarch64-darwin`

### macOS installation

OpenSlides macOS builds are ad-hoc signed. That is enough for Apple Silicon packages to launch after download; a paid Apple Developer certificate is still required for full notarization later.

1. Open the `.dmg` and drag **OpenSlides** into **Applications**.
2. First launch: right-click the app → **Open**, then confirm.
3. If macOS still says the app is damaged, clear the download quarantine flag:

```bash
xattr -dr com.apple.quarantine /Applications/OpenSlides.app
```

Then open the app again from Applications.

### Linux installation

OpenSlides release builds include Linux packages in `.deb`, `.rpm`, and AppImage formats.

- **Debian / Ubuntu / Linux Mint / Pop!\_OS**

Install the required runtime libraries first, then install the package:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-0 libgtk-3-0 libscrypt0 libayatana-appindicator3-1 librsvg2-common
sudo apt install ./OpenSlides_<version>_amd64.deb
```

- **Fedora / RHEL / Rocky / AlmaLinux / other DNF-based distributions**

Install the required runtime libraries first, then install the package:

```bash
sudo dnf check-update
sudo dnf install -y webkit2gtk4.1 gtk3 libappindicator-gtk3 librsvg2
sudo dnf install -y ./OpenSlides-<version>-1.x86_64.rpm
```

- **AppImage**

Needs FUSE. Without it: `./OpenSlides_*.AppImage --appimage-extract-and-run`. On Wayland with rendering glitches, try `WEBKIT_DISABLE_DMABUF_RENDERER=1`. Otherwise the `.deb` / `.rpm` packages link against the system GTK stack and tend to be smoother.

- **NixOS / Nix**

```bash
nix profile install github:codewiththiha/OpenSlides
```

On NixOS you can also import the flake and add `inputs.openslides.packages.${pkgs.system}.openslides` to `environment.systemPackages`, or use the `nixosModules.openslides` output. After each published release, `nix/sources.json` is refreshed automatically so the flake points at the matching installer hashes.

If your distribution prefers a different workflow, read the package manager guidance in your distro docs first.

## Tech stack

- **Desktop app:** Tauri 2 and Rust
- **Interface:** Svelte 5 (runes), TypeScript, Vite 7, and Tailwind CSS 4
- **Component toolkit:** bits-ui, paneforge, and @lucide/svelte
- **Data and flow:** @tanstack/svelte-query, svelte-spa-router, and persistent rune stores
- **Motion and DnD:** Svelte transitions/springs, svelte-dnd-action, and custom pointer drag-and-drop
- **Code rendering:** Shiki and shiki-magic-move
- **Local storage:** SQLite (via sqlx, Rust side)

## Run from source

### Requirements

- Bun or newer
- Rust stable toolchain and Cargo
- Platform requirements for Tauri 2

```bash
bun install
bun run tauri dev
```

To run the interface in a browser:

```bash
bun run dev
```

### Development checks

The same gates CI enforces on every push and pull request:

```bash
bun run check              # svelte-check: 0 errors, 0 warnings
bun run lint               # eslint
bun run format:check       # prettier (svelte + tailwind plugins)
bun run test:highlight     # highlight token pipeline (11 tests)
bun run test:save-race     # editor save/debounce races (14 tests)
bun run test:app-flow      # real app flows in jsdom: dashboard -> editor -> present (9 tests)
bun run test:stack-targeting  # slide stack drop-zone geometry (4 tests)
bun run build              # production bundle
```

## License

MIT — see [LICENSE](LICENSE).
