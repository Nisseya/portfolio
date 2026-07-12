/* =================================================
   main.js — app entry point
   Reads theme to determine: layout, features, render mode.
   Conditionally mounts components based on features.
================================================= */

import { loadMarkdownFile } from "./markdown.js";
import { Terminal } from "./terminal.js";
import { Navigation } from "./navigation.js";
import { applyTheme, getParticleConfig, hasFeature, getRenderMode } from "./theme.js";
import { initParticles } from "./particles.js";
import { Game } from "./game.js";

/* ---------- manifest loading ---------- */

async function loadManifest() {
    for (const path of ["dev.json", "manifest.json"]) {
        try {
            const res = await fetch(path);
            if (res.ok) return await res.json();
        } catch {}
    }
    throw new Error("Could not load manifest. Run via the dev server or build first.");
}

/* ---------- build sections from manifest ---------- */

async function buildSections(manifest, renderMode, nav) {
    const sections = {};
    const layoutMode = manifest.theme.layout?.mode || "terminal";

    for (const entry of manifest.sections) {
        sections[entry.id] = {
            id: entry.id,
            label: entry.label,
            order: entry.order,
            file: entry.file,
            loadHTML: async () => {
                // linktree sections render as markdown (not links mode)
                // — links mode is only for the home page buttons
                const mode = layoutMode === "linktree" ? "markdown" : renderMode;
                const { html } = await loadMarkdownFile(entry.file, mode);
                // linktree: add back button at the top of each section
                if (layoutMode === "linktree" && nav) {
                    const backBtn = `<button class="back-btn" data-action="back"><span class="arrow">←</span> back</button>`;
                    return `${backBtn}<div class="section-label">~/${entry.label}</div>${html}`;
                }
                return `<div class="section-label">~/${entry.label}</div>${html}`;
            }
        };
    }

    const owner = manifest.owner;

    // virtual home section
    sections.home = {
        id: "home",
        label: "~",
        order: 0,
        loadHTML: async () => {
            const homeEntry = manifest.sections.find(s => s.id === "home");
            const file = homeEntry?.file || "content/home.md";
            const { html } = await loadMarkdownFile(file, renderMode);
            const links = owner.links
                .map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`)
                .join("");
            return `<div class="home-hero">
                <div class="section-label">~/home</div>
                ${html}
                <div class="links">${links}</div>
            </div>`;
        }
    };

    // linktree: home page shows section buttons instead of markdown
    if (layoutMode === "linktree") {
        const originalHome = sections.home.loadHTML;
        sections.home.loadHTML = async () => {
            const homeHTML = await originalHome();
            // build section buttons
            const sectionIds = Object.keys(sections)
                .filter(id => id !== "home" && id !== "help")
                .sort((a, b) => sections[a].order - sections[b].order);
            const buttons = sectionIds.map(id => {
                const s = sections[id];
                const label = s.label.replace(/\/$/, "");
                return `<button class="section-btn" data-target="${id}">${label} <span class="arrow">→</span></button>`;
            }).join("");
            // extract the h1 + first paragraph from homeHTML for the header
            const nameMatch = homeHTML.match(/<h1>(.*?)<\/h1>/);
            const name = nameMatch ? nameMatch[1] : owner.name;
            return `<div class="home-hero">
                <div class="section-label">~/home</div>
                <h1>${name}</h1>
                <p>${owner.role}</p>
                ${buttons}
            </div>`;
        };
    }

    return sections;
}

/* ---------- fun commands ---------- */

function neofetch(owner) {
    return [
        `<span class="hi">${owner.name}</span>@<span class="hi">portfolio</span>`,
        "-----------------",
        `OS:      PortfolioOS 1.0`,
        `host:    yassine@portfolio`,
        `role:    ${owner.role}`,
        `shell:   portfolio-sh 1.0`,
        `uptime:  just now`,
        "",
        `links:   ${owner.links.map(l => l.label).join("  ")}`,
    ];
}

function cowsay(args) {
    const msg = args.join(" ") || "moo";
    const top = " " + "_".repeat(msg.length + 2);
    const bot = " " + "-".repeat(msg.length + 2);
    return [
        top, `< ${msg} >`, bot,
        "        \\   ^__^",
        "         \\  (oo)\\_______",
        "            (__)\\       )\\/\\",
        "                ||----w |",
        "                ||     ||",
    ];
}

/* ---------- main ---------- */

async function main() {
    const manifest = await loadManifest();
    const theme = manifest.theme;
    const renderMode = getRenderMode(theme);

    applyTheme(theme);

    // element refs
    const outputEl       = document.getElementById("terminal-output");
    const inputEl        = document.getElementById("cmd");
    const previewEl      = document.getElementById("preview");
    const breadcrumbEl   = document.getElementById("breadcrumb");
    const navStripEl     = document.getElementById("nav-strip");
    const ownerLinksEl   = document.getElementById("owner-links");
    const statusSectionEl = document.getElementById("status-section");
    const quickCmdsEl    = document.getElementById("quick-cmds");
    const sidebarEl      = document.querySelector(".sidebar");
    const terminalPanelEl = document.querySelector(".terminal-panel");
    const statusBarEl    = document.querySelector(".status-bar");
    const windowBarEl    = document.querySelector(".window-bar");

    // navigation (created early so buildSections can use it for linktree back buttons)
    const nav = new Navigation(previewEl, breadcrumbEl, {});
    const sections = await buildSections(manifest, renderMode, nav);
    nav.sections = sections;

    // owner links
    if (hasFeature(theme, "ownerLinks")) {
        ownerLinksEl.innerHTML = manifest.owner.links
            .map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
            .join("");
    } else {
        ownerLinksEl.remove();
    }

    // remove disabled components from DOM entirely
    if (!hasFeature(theme, "windowBar"))  windowBarEl?.remove();
    if (!hasFeature(theme, "sidebar"))     sidebarEl?.remove();
    if (!hasFeature(theme, "terminal"))     terminalPanelEl?.remove();
    if (!hasFeature(theme, "statusBar"))   statusBarEl?.remove();

    // game (lazy)
    let game = null;
    let gameCanvas = null;

    function ensureGame() {
        if (game) return game;
        gameCanvas = document.createElement("canvas");
        gameCanvas.width = 880;
        gameCanvas.height = 420;
        gameCanvas.className = "game-canvas";
        game = new Game(gameCanvas);
        return game;
    }

    function showGame() {
        ensureGame();
        previewEl.innerHTML = "";
        previewEl.appendChild(gameCanvas);
        previewEl.scrollTop = 0;
    }

    // navigation overrides
    const originalNavigate = nav.navigate.bind(nav);
    nav.navigate = async (id) => {
        if (id === "game") {
            if (!hasFeature(theme, "game")) {
                if (terminal) terminal.print("game is disabled in this theme", "line err");
                return false;
            }
            nav.current = id;
            breadcrumbEl.textContent = `yassine@portfolio:game/`;
            previewEl.classList.add("switching");
            await new Promise(r => setTimeout(r, 200));
            showGame();
            previewEl.classList.remove("switching");
            if (nav.onNavigate) nav.onNavigate(id);
            return true;
        }
        if (game && game.running && id !== "game") {
            game.stop();
            if (terminal) terminal.setGameActive(false);
        }
        return originalNavigate(id);
    };

    // commands
    const commands = {
        help: () => {
            const lines = [
                "available commands:",
                "  help          show this help",
                "  ls            list sections (clickable)",
                "  open <name>   open a section",
                "  cd <name>     alias of open",
                "  back          go home",
                "  whoami        short bio",
                "  neofetch      system info",
                "  cowsay <txt>  a cow says something",
                "  echo <txt>    print text",
                "  date          current date/time",
                "  sudo <cmd>    try it",
                "  history       command history",
                "  theme         show current theme",
                "  clear         clear terminal",
            ];
            if (hasFeature(theme, "game")) {
                lines.push("  play          start the game");
                lines.push("  left/right/jump/stop  game controls");
            }
            lines.push("", "Tab completes · ↑↓ history · Enter runs");
            return lines;
        },
        ls: () => { terminal?.renderMenu(); return null; },
        whoami: () => [manifest.owner.name, manifest.owner.role],
        back: () => { nav.navigate("home"); return null; },
        clear: () => { terminal?.clear(); return null; },
        neofetch: () => neofetch(manifest.owner),
        cowsay: (args) => cowsay(args),
        echo: (args) => [args.join(" ")],
        date: () => [new Date().toString()],
        sudo: (args) => [`Nice try — but you're not sudo 😏`, `(did you mean: ${args.join(" ") || "..."}?)`],
        history: () => terminal ? terminal.history.map((h, i) => `  ${i + 1}  ${h}`) : [],
        theme: () => [`current theme: ${theme.label} (${theme.name})`, `layout: ${theme.layout?.mode || "terminal"}`, `render: ${renderMode}`],
    };

    // game commands only if game is enabled
    if (hasFeature(theme, "game")) {
        commands.play = () => {
            nav.navigate("game");
            setTimeout(() => {
                const g = ensureGame();
                terminal.setGameActive(true);
                terminal.print(g.start(), "line ok");
            }, 350);
            return null;
        };
        commands.left  = () => { if (!game?.running) return ["game not running — type 'play' first"]; game.left();  return null; };
        commands.right = () => { if (!game?.running) return ["game not running — type 'play' first"]; game.right(); return null; };
        commands.jump  = () => { if (!game?.running) return ["game not running — type 'play' first"]; game.jump();  return null; };
        commands.stop  = () => { if (!game?.running) return ["game not running"]; terminal.setGameActive(false); return [game.stop()]; };
    }

    // terminal (only if feature enabled)
    let terminal = null;
    if (hasFeature(theme, "terminal")) {
        terminal = new Terminal({
            outputEl, inputEl, sections, commands,
            onNavigate: (id) => nav.navigate(id)
        });
    }

    // nav active state
    nav.onNavigate = (id) => {
        navStripEl?.querySelectorAll(".nav-item").forEach(el => {
            el.classList.toggle("active", el.dataset.target === id);
        });
        outputEl?.querySelectorAll(".menu-item").forEach(el => {
            el.classList.toggle("active", el.dataset.target === id);
        });
        if (statusSectionEl) statusSectionEl.textContent = id;

        // wire up section buttons + back buttons in the freshly rendered preview
        previewEl.querySelectorAll(".section-btn[data-target]").forEach(btn => {
            btn.addEventListener("click", () => nav.navigate(btn.dataset.target));
        });
        previewEl.querySelectorAll(".back-btn[data-action='back']").forEach(btn => {
            btn.addEventListener("click", () => nav.navigate("home"));
        });
    };

    // build nav strip (only if sidebar exists)
    if (navStripEl) {
        const navIds = Object.keys(sections)
            .filter(id => id !== "help")
            .sort((a, b) => sections[a].order - sections[b].order);
        navStripEl.innerHTML = navIds.map(id => {
            const s = sections[id];
            const label = id === "home" ? "home" : s.label.replace(/\/$/, "");
            return `<button class="nav-item" data-target="${id}">${label}</button>`;
        }).join("");

        navStripEl.querySelectorAll(".nav-item").forEach(btn => {
            btn.addEventListener("click", () => {
                if (terminal) terminal.print(`<span class="prompt">$</span> open ${btn.dataset.target}`, "line cmd");
                nav.navigate(btn.dataset.target);
            });
        });
    }

    // quick commands (only if sidebar + terminal enabled)
    if (quickCmdsEl && terminal) {
        const quickCmds = ["help", "ls", "neofetch", "cowsay hello", "theme"];
        if (hasFeature(theme, "game")) quickCmds.push("play");
        quickCmdsEl.innerHTML = quickCmds
            .map(c => `<button class="quick-cmd" data-cmd="${c}">${c}</button>`)
            .join("");
        quickCmdsEl.querySelectorAll(".quick-cmd").forEach(btn => {
            btn.addEventListener("click", () => {
                terminal.run(btn.dataset.cmd);
                terminal.focus();
            });
        });
    } else if (quickCmdsEl) {
        quickCmdsEl.remove();
    }

    // click focuses input
    if (terminalPanelEl && terminal) {
        terminalPanelEl.addEventListener("click", () => terminal.focus());
    }

    // boot sequence (only if terminal enabled)
    if (terminal) {
        terminal.print(`<span class="muted">${manifest.owner.name} — type 'help' to begin</span>`, "line");
        terminal.print("", "line");
        terminal.print("<span class='prompt'>$</span> whoami", "line cmd");
        terminal.print(manifest.owner.name, "line ok");
        terminal.print(manifest.owner.role, "line muted");
        terminal.print("", "line");
        terminal.print("<span class='prompt'>$</span> ls", "line cmd");
        terminal.renderMenu();
        terminal.print("", "line");
    }

    await nav.navigate("home");
    if (terminal) terminal.focus();

    // background
    if (hasFeature(theme, "particles")) {
        initParticles(getParticleConfig(theme));
    }
}

main().catch(err => {
    console.error(err);
    const out = document.getElementById("terminal-output");
    const preview = document.getElementById("preview");
    const hint = `
        <div class="line err">Failed to boot: ${err.message}</div>
        <div class="line muted">
            If you opened index.html directly (file://), ES modules and fetch
            are blocked by the browser. Run the dev server instead:
        </div>
        <div class="line ok">  node scripts/dev.mjs</div>
        <div class="line muted">then open http://localhost:3000</div>
    `;
    if (out) out.innerHTML = hint;
    if (preview) preview.innerHTML = `<p class="error">Boot failed — see terminal.</p>`;
});
