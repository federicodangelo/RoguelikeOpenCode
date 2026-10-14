# Contributing

This project is a small browser roguelike built with Bun and TypeScript. Keep changes small, testable, and aligned with the module boundaries below.

## Module boundaries

### `src/core`

Pure game rules and data.

- No DOM, canvas, Web Audio, localStorage, or browser globals.
- Owns map generation, RNG, entities, items, status effects, FOV, tile constants, save schema, and game state transitions.
- Core code should be deterministic when given a seed or saved state.

### `src/platform`

Browser and platform adapters.

- Owns the main loop, keyboard input, canvas rendering, Web Audio, settings persistence, save storage, and menu action wiring.
- Platform code may call core APIs, but core code should not call platform APIs.
- Side effects such as `localStorage`, `performance.now()`, `AudioContext`, and DOM events belong here.

### `src/ui`

Canvas drawing helpers.

- Owns HUD, menus, minimap, pixel font, scaling calculations, effects, and icon drawing.
- UI code should take data as input and draw to a canvas context.
- Avoid putting game rules in UI modules.

### `tools`

Build-time and development utilities.

- Owns tile generation, icon generation, font atlas generation, screenshot generation, bundling, dist verification, dev server, and static serving.
- Tool output that is committed, such as `public/screenshots`, should be deterministic.

### `tests`

Tests mirror the source boundaries.

- `tests/core` tests pure game logic.
- `tests/platform` tests browser adapters with fake storage, fake canvas, or safe fallbacks.
- `tests/ui` tests drawing helpers and pure UI calculations.
- `tests/tools` tests generated assets and screenshot smoke checks.

## Development workflow

Install dependencies:

```bash
bun install
```

Run the game:

```bash
bun run dev
```

Before committing, run:

```bash
bun run typecheck
bun run lint
bun test
bun run font
bun run screenshots
bun run build
bun run verify
```

If rendering, menu text, HUD layout, tile art, icon art, or screenshot generation changes, regenerate screenshots and commit the updated PNG files:

```bash
bun run screenshots
```

## Asset regeneration workflow

Generated assets are committed so the browser build and screenshot tests are reproducible.

Regenerate the tileset:

```bash
bun run tiles
```

This writes `public/assets/tiles.png` from `tools/make-tiles.ts`. If tile art is added, removed, or reordered, update `src/core/tiles.ts` and the tile count/index tests in `tests/core/tiles.test.ts`.

Regenerate the icon sheet:

```bash
bun run icons
```

This writes `public/assets/icons.png` from `tools/make-icons.ts`. The sheet order follows `ICON_NAMES` in `src/ui/icons.ts`; keep that list and `tests/ui/icons.test.ts` in sync.

Regenerate the pixel font atlas:

```bash
bun run font
```

This writes `public/assets/font.png` from `tools/make-font.ts`. If glyphs are added, removed, or reordered, update the atlas order tests in `tests/ui/pixel-font.test.ts`.

After changing any generated asset, regenerate screenshots and run the asset checks:

```bash
bun run screenshots
bun test
bun run build
bun run verify
```

Commit the regenerated files under `public/assets` and `public/screenshots`.

If formatting or lint issues appear, run:

```bash
bun run lint:fix
```

## Publishing

The site can be published automatically with GitHub Pages.

1. Push the repository to GitHub.
2. In GitHub, open **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `master`, or run the **GitHub Pages** workflow manually from the Actions tab.

The `.github/workflows/pages.yml` workflow runs typecheck, lint, tests, build, and dist verification, then uploads `dist/` to GitHub Pages.

## Contribution rules

- Keep one logical change per commit.
- Update `plan.txt` when completing a planned task.
- Add or update tests near the module being changed.
- Do not move game rules into `src/platform` or `src/ui`.
- Do not introduce browser side effects into `src/core`.
- Keep generated assets deterministic so screenshot smoke tests remain reliable.
