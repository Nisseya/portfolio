# Building a Theme

Themes are JSON files in `themes/` that define the visual identity of the portfolio. This document explains the schema and how to create your own.

## Quick Start

1. Copy an existing theme as a starting point:
   ```
   cp themes/midnight.json themes/my-theme.json
   ```

2. Edit the colors, fonts, and effects in `themes/my-theme.json`.

3. Run the dev server with your theme:
   ```
   node scripts/dev.mjs --theme my-theme
   ```

4. Build a static bundle with your theme:
   ```
   node scripts/build.mjs --theme my-theme
   ```

## Schema

A theme file has four sections: **colors**, **fonts**, **particles**, and **glow**.

### Required fields

```json
{
  "name": "my-theme",          // kebab-case identifier
  "label": "My Theme",         // human-readable name
  "colors": { ... },           // all color values (see below)
  "fonts": { ... }             // font definitions
}
```

### `colors`

All color values are CSS strings (hex like `#6cb6ff` or rgba like `rgba(108,182,255,.12)`).

| Field         | Used for                                      |
|---------------|-----------------------------------------------|
| `bg`          | Page background                               |
| `window`      | Main panel background                         |
| `windowAlt`   | Sidebar / terminal / status bar background    |
| `text`        | Primary text                                  |
| `muted`       | Secondary text (descriptions, terminal output)|
| `mutedAlt`    | Tertiary text (labels, hints)                 |
| `border`      | Primary borders                               |
| `borderSoft`  | Subtle dividers (between entries)             |
| `accent`      | Primary accent — prompt, links, active states |
| `accentSoft`  | Accent background tint (use rgba)             |
| `hover`       | Hover background tint (use rgba)              |

### `fonts`

```json
"fonts": {
  "mono": {
    "family": "'JetBrains Mono', monospace",
    "url": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap"
  }
}
```

- `family` — any CSS `font-family` value
- `url` — Google Fonts URL or empty string for system fonts

### `particles` (optional)

Background network animation via [tsParticles](https://particles.js.org/). Omit or set `"enabled": false` to disable.

```json
"particles": {
  "enabled": true,
  "count": 70,              // number of nodes
  "colors": ["#6cb6ff", "#8b949e", "#ffffff"],
  "linkColor": "#6cb6ff",   // edge color
  "linkOpacity": 0.18,
  "linkDistance": 140,      // max distance for edges
  "speed": 0.6,             // node drift speed
  "size": 2                 // max node radius
}
```

### `glow` (optional)

Ambient radial gradient overlays for depth. Omit or set `"enabled": false` to disable.

```json
"glow": {
  "enabled": true,
  "layers": [
    {
      "position": "top left",        // CSS position keyword
      "color": "rgba(108,182,255,.12)",
      "size": "35%"                   // spread radius
    },
    {
      "position": "bottom right",
      "color": "rgba(255,255,255,.05)",
      "size": "45%"
    }
  ]
}
```

## Full Example

```json
{
  "name": "sunset",
  "label": "Sunset",
  "colors": {
    "bg": "#1a0f0a",
    "window": "#2a1a14",
    "windowAlt": "#1f120c",
    "text": "#fff5e6",
    "muted": "#c4a88a",
    "mutedAlt": "#8a7466",
    "border": "#3d2820",
    "borderSoft": "#2e1c14",
    "accent": "#ff8c42",
    "accentSoft": "rgba(255,140,66,.12)",
    "hover": "rgba(255,140,66,.10)"
  },
  "fonts": {
    "mono": {
      "family": "'JetBrains Mono', monospace",
      "url": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap"
    }
  },
  "particles": {
    "enabled": true,
    "count": 60,
    "colors": ["#ff8c42", "#c4a88a"],
    "linkColor": "#ff8c42",
    "linkOpacity": 0.15,
    "linkDistance": 130,
    "speed": 0.5,
    "size": 2
  },
  "glow": {
    "enabled": true,
    "layers": [
      { "position": "top right",   "color": "rgba(255,140,66,.15)", "size": "40%" },
      { "position": "bottom left", "color": "rgba(255,69,0,.08)",   "size": "35%" }
    ]
  }
}
```

## Tips

- **Contrast**: ensure `text` has at least 4.5:1 contrast against `bg` and `window`.
- `accentSoft` and `hover` should be low-opacity rgba versions of `accent`.
- The `border` color should be subtle — it separates panels, not draw attention.
- Test with `node scripts/dev.mjs --theme my-theme` and resize the window.
- The schema is defined in `theme.schema.json` — use it for validation in your editor.
