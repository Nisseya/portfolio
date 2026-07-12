/* =================================================
   theme.js — apply a theme object to the document
   Sets CSS custom properties from the theme JSON.
================================================= */

export function applyTheme(theme) {
    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty("--bg",         c.bg);
    root.style.setProperty("--window",     c.window);
    root.style.setProperty("--window-alt", c.windowAlt);
    root.style.setProperty("--text",       c.text);
    root.style.setProperty("--muted",      c.muted);
    root.style.setProperty("--muted-alt", c.mutedAlt);
    root.style.setProperty("--border",     c.border);
    root.style.setProperty("--border-soft",c.borderSoft);
    root.style.setProperty("--accent",     c.accent);
    root.style.setProperty("--accent-soft",c.accentSoft);
    root.style.setProperty("--hover",      c.hover);

    root.style.setProperty("--font-mono",  theme.fonts.mono.family);

    // glow layers → CSS background string
    if (theme.glow?.enabled && theme.glow.layers?.length) {
        const layers = theme.glow.layers.map(l =>
            `radial-gradient(circle at ${l.position}, ${l.color}, transparent ${l.size})`
        ).join(", ");
        root.style.setProperty("--glow-layers", layers);
    } else {
        root.style.setProperty("--glow-layers", "none");
    }

    // inject font link if needed
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
