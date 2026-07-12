# Themes, Layouts & Palettes

A **theme** is a combination of a **layout** (structure) and a **palette** (colors/fonts/effects). This separation lets you mix and match — e.g. a linktree layout with a matrix palette.

## Structure

```
themes/
├── layouts/              # structural definitions
│   ├── terminal.json    # sidebar + preview + bottom terminal
│   ├── linktree.json    # centered card, section buttons, no terminal
│   └── minimal.json     # just preview, top tab nav
├── palettes/            # visual identity
│   ├── midnight.json    # dark blue
│   ├── matrix.json      # green-on-black
│   ├── paper.json       # light
│   └── sunset.json      # warm orange
├── midnight.json        # theme = layout + palette
├── matrix.json
├── linktree.json        # linktree layout + midnight palette
├── linktree-matrix.json # linktree layout + matrix palette
├── minimal.json
├── paper.json
└── sunset.json
```

## Creating a Theme

A theme file just references a layout and a palette:

```json
{
  "name": "my-theme",
  "label": "My Theme",
  "layout": "terminal",
  "palette": "midnight"
}
```

That's it. The layout provides structure, the palette provides colors.

### With overrides

You can override specific fields from the layout or palette:

```json
{
  "name": "compact-matrix",
  "label": "Compact Matrix",
  "layout": "terminal",
  "palette": "matrix",
  "overrides": {
    "layout": { "density": "compact" },
    "features": { "game": false }
  }
}
```

## Creating a Layout

Layouts live in `themes/layouts/`. They define:

| Field | What it controls |
|-------|-----------------|
| `features` | Toggle UI components on/off |
| `layout` | Mode, dimensions, density |
| `content` | How markdown is rendered |
| `typography` | Font size, line height, letter spacing |
| `css` | Arbitrary CSS (escape hatch) |

```json
{
  "name": "linktree",
  "label": "Linktree",
  "features": {
    "terminal": false, "sidebar": false, "game": false,
    "statusBar": false, "quickCommands": false, "ownerLinks": false, "windowBar": false
  },
  "layout": {
    "mode": "linktree",
    "maxWidth": "480px",
    "borderRadius": "0px"
  },
  "content": { "render": "links" },
  "css": "..."
}
```

### Layout modes

| Mode | Description |
|------|-------------|
| `terminal` | Full layout: sidebar + preview + bottom terminal |
| `linktree` | Centered card, section buttons on home, back button on sections |
| `minimal` | Just the preview panel with top tab nav |

### Feature toggles

Disabled components are never mounted in the DOM:

```json
"features": {
  "terminal": false,      // hide the bottom terminal
  "sidebar": false,        // hide the left nav
  "game": false,           // disable the game entirely
  "particles": true,       // keep background animation
  "statusBar": false,      // hide keyboard hints
  "quickCommands": false,  // hide sidebar quick cmds
  "ownerLinks": true,      // show github/linkedin/email
  "windowBar": true         // show the window title bar
}
```

### Content render modes

| Mode | What it does |
|------|-------------|
| `markdown` | Full rendered markdown (headings, paragraphs, lists) |
| `links` | Extracts headings + links into button stack (linktree style) |
| `raw` | Plain text, no styling |

### The `css` escape hatch

Any string in `css` is injected as a `<style>` tag after base CSS. Use this for anything the schema doesn't cover:

```json
"css": "[data-layout=\"linktree\"] .link-btn { border-radius: 16px; }"
```

## Creating a Palette

Palettes live in `themes/palettes/`. They define:

| Field | What it controls |
|-------|-----------------|
| `colors` | All color values (bg, window, text, accent, etc.) |
| `fonts` | Font family + Google Fonts URL |
| `particles` | tsParticles background config |
| `glow` | Ambient radial gradient overlays |

```json
{
  "name": "sunset",
  "label": "Sunset",
  "colors": {
    "bg": "#1a0f0a",
    "window": "#2a1a14",
    "accent": "#ff8c42",
    ...
  },
  "fonts": {
    "mono": { "family": "'JetBrains Mono', monospace", "url": "..." }
  },
  "particles": { "enabled": true, "count": 60, ... },
  "glow": { "enabled": true, "layers": [...] }
}
```

### Color fields

| Field | Used for |
|-------|----------|
| `bg` | Page background |
| `window` | Main panel background |
| `windowAlt` | Sidebar / terminal background |
| `text` | Primary text |
| `muted` | Secondary text |
| `mutedAlt` | Tertiary text / labels |
| `border` | Primary borders |
| `borderSoft` | Subtle dividers |
| `accent` | Prompt, links, active states |
| `accentSoft` | Accent background tint (rgba) |
| `hover` | Hover background tint (rgba) |

## Linktree Navigation

The linktree layout works as a proper navigable page:

1. **Home** shows your name + section buttons (one per `.md` file)
2. **Click a section** → opens that section's content (rendered as link buttons via `content.render: "links"`)
3. **Back button** → returns to home

No terminal needed — pure click navigation. Same content files as the terminal layout.

## Schemas

- [`theme.schema.json`](../theme.schema.json) — theme files
- [`layout.schema.json`](../layout.schema.json) — layout files
- [`palette.schema.json`](../palette.schema.json) — palette files

Use these for editor validation.
