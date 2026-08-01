/* =================================================
   theme.js — theme resolution + application
   A theme = layout + palette + overrides.
   - layout:  themes/layouts/<name>.json  (structure, features, content mode, css)
   - palette: themes/palettes/<name>.json (colors, fonts, particles, glow)
   - theme:   themes/<name>.json          (references layout + palette by name)
================================================= */

/* ---------- theme resolution ---------- */

/**
 * Resolve a theme reference into a full theme object.
 * Fetches layout + palette files and merges them.
 */
export async function resolveTheme(theme, fetchJSON) {
    const layout  = theme.layout  ? await fetchJSON("layouts",  theme.layout)  : {};
    const palette = theme.palette ? await fetchJSON("palettes", theme.palette) : {};

    return {
        name:  theme.name,
        label: theme.label,
        // palette provides: colors, fonts, particles, glow
        colors:    palette.colors    || {},
        fonts:     palette.fonts     || { mono: { family: "monospace" } },
        particles: palette.particles || { enabled: false },
        glow:      palette.glow      || { enabled: false },
        // layout provides: layout, features, content, typography, css
        layout:     layout.layout     || { mode: "terminal" },
        features:   layout.features   || {},
        content:    layout.content    || { render: "markdown" },
        typography: layout.typography || {},
        css:        layout.css        || "",
        // theme-level overrides (deep merged on top)
        ...theme.overrides || {},
    };
}

/* ---------- defaults ---------- */

const DEFAULT_FEATURES = {
    terminal: true,
    sidebar: true,
    game: true,
    particles: true,
    statusBar: true,
    quickCommands: true,
    ownerLinks: true,
    windowBar: true,
};

const DEFAULT_LAYOUT = {
    mode: "terminal",
    sidebarWidth: "220px",
    terminalHeight: "200px",
    borderRadius: "18px",
    maxWidth: "1600px",
    maxHeight: "900px",
    density: "normal",
};

const DEFAULT_TYPOGRAPHY = {
    baseSize: "15px",
    headingScale: "1.0",
    lineHeight: "1.7",
    letterSpacing: "0",
};

const DEFAULT_CONTENT = {
    render: "markdown",
    showLabels: true,
    showOrder: true,
};

/* ---------- apply theme to DOM ---------- */

export function applyTheme(theme) {
    const root = document.documentElement;
    const c = theme.colors;

    // colors
    root.style.setProperty("--bg",          c.bg);
    root.style.setProperty("--window",      c.window);
    root.style.setProperty("--window-alt",  c.windowAlt);
    root.style.setProperty("--text",        c.text);
    root.style.setProperty("--muted",       c.muted);
    root.style.setProperty("--muted-alt",   c.mutedAlt);
    root.style.setProperty("--border",      c.border);
    root.style.setProperty("--border-soft", c.borderSoft);
    root.style.setProperty("--accent",      c.accent);
    root.style.setProperty("--accent-soft", c.accentSoft);
    root.style.setProperty("--hover",       c.hover);

    // fonts
    root.style.setProperty("--font-mono", theme.fonts.mono.family);

    // glow layers
    if (theme.glow?.enabled && theme.glow.layers?.length) {
        const layers = theme.glow.layers.map(l =>
            `radial-gradient(circle at ${l.position}, ${l.color}, transparent ${l.size})`
        ).join(", ");
        root.style.setProperty("--glow-layers", layers);
    } else {
        root.style.setProperty("--glow-layers", "none");
    }

    // typography
    const t = { ...DEFAULT_TYPOGRAPHY, ...theme.typography };
    root.style.setProperty("--font-size",       t.baseSize);
    root.style.setProperty("--heading-scale",   t.headingScale);
    root.style.setProperty("--line-height",     t.lineHeight);
    root.style.setProperty("--letter-spacing",  t.letterSpacing);

    // layout
    const l = { ...DEFAULT_LAYOUT, ...theme.layout };
    root.style.setProperty("--sidebar-width",    l.sidebarWidth);
    root.style.setProperty("--terminal-height", l.terminalHeight);
    root.style.setProperty("--radius",          l.borderRadius);
    root.style.setProperty("--max-width",       l.maxWidth);
    root.style.setProperty("--max-height",      l.maxHeight);
    root.style.setProperty("--density-pad",     l.density === "compact" ? "0.6" : "1");

    // data attributes
    root.setAttribute("data-layout", l.mode);
    root.setAttribute("data-density", l.density);

    const features = { ...DEFAULT_FEATURES, ...theme.features };
    for (const [key, val] of Object.entries(features)) {
        root.setAttribute(`data-feature-${key}`, val ? "on" : "off");
    }

    // font link
    if (theme.fonts.mono.url) {
        const id = "theme-font";
        let link = document.getElementById(id);
        if (!link) {
            link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            document.head.appendChild(link);
        }
        link.href = theme.fonts.mono.url;
    }

    // theme CSS (escape hatch from layout)
    if (theme.css) {
        const id = "theme-css";
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = theme.css;
    } else {
        document.getElementById("theme-css")?.remove();
    }
}

/* ---------- helpers ---------- */

export function hasFeature(theme, name) {
    const features = { ...DEFAULT_FEATURES, ...theme.features };
    return features[name] !== false;
}

export function getRenderMode(theme) {
    const content = { ...DEFAULT_CONTENT, ...theme.content };
    return content.render;
}

export function getParticleConfig(theme) {
    if (!theme.particles?.enabled) return null;
    return {
        fpsLimit: 60,
        background: { color: "transparent" },
        particles: {
            number: { value: theme.particles.count, density: { enable: true, area: 900 } },
            color: { value: theme.particles.colors },
            opacity: { value: { min: 0.1, max: 0.5 } },
            size: { value: { min: 1, max: theme.particles.size } },
            links: {
                enable: true,
                distance: theme.particles.linkDistance,
                color: theme.particles.linkColor,
                opacity: theme.particles.linkOpacity,
                width: 1
            },
            move: {
                enable: true,
                speed: theme.particles.speed,
                direction: "none",
                random: true,
                straight: false,
                outModes: { default: "out" }
            }
        },
        interactivity: {
            events: { onHover: { enable: true, mode: "grab" }, resize: true },
            modes: { grab: { distance: 160, links: { opacity: 0.35 } } }
        },
        detectRetina: true
    };
}
