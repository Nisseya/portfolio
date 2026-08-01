#!/usr/bin/env node
/* =================================================
   scripts/config.mjs — shared config management
   Reads/writes deploy.config.json (gitignored)

   `portfolio config` opens an interactive menu.
   Low-level helpers are exported for reuse & tests.
================================================= */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");
// Allow overriding the config path (used by tests to isolate state)
export const CONFIG_PATH = process.env.PORTFOLIO_CONFIG || join(ROOT, "deploy.config.json");

export const PROVIDERS = [
    {
        id: "cloudflare",
        label: "Cloudflare Pages",
        desc: "Deploy to Cloudflare Pages via API",
        fields: [
            { key: "apiToken", label: "API token", flag: "api-token", secret: true, required: true },
            { key: "accountId", label: "Account ID", flag: "account", required: true },
            { key: "projectName", label: "Project name", flag: "project", required: true },
            { key: "domain", label: "Custom domain (e.g. mondomaine.com)", flag: "domain" },
            { key: "subpath", label: "Subpath (e.g. /portfolio/)", flag: "subpath" },
        ],
    },
    {
        id: "surge",
        label: "Surge.sh",
        desc: "Deploy to Surge.sh (npx surge required)",
        fields: [
            { key: "domain", label: "Domain", flag: "domain", required: true },
            { key: "token", label: "Token", flag: "token", secret: true, required: true },
        ],
    },
    {
        id: "copy",
        label: "Copy locally",
        desc: "Copy built files to a local directory",
        fields: [
            { key: "out", label: "Output directory", flag: "out", required: true },
        ],
    },
];

export function defaultConfig() {
    return { providers: {}, lastProvider: null, lastTheme: "midnight", favorites: {}, lastDeploy: null };
}

export function loadConfig() {
    if (!existsSync(CONFIG_PATH)) return defaultConfig();
    try {
        return { ...defaultConfig(), ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
    } catch {
        return defaultConfig();
    }
}

export function saveConfig(config) {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function findProvider(id) {
    return PROVIDERS.find(p => p.id === id);
}

/**
 * Validate that a provider's config has all required fields.
 * @returns {string[]} list of missing field labels (empty if valid)
 */
export function validateProviderConfig(providerId, cfg) {
    const p = findProvider(providerId);
    if (!p) return [`unknown provider "${providerId}"`];
    const missing = [];
    for (const field of p.fields) {
        if (field.required && !cfg?.[field.key]) {
            missing.push(field.label);
        }
    }
    return missing;
}

export function normalizeSubpath(subpath) {
    if (!subpath) return "";
    let s = subpath.trim();
    if (!s.startsWith("/")) s = "/" + s;
    if (!s.endsWith("/")) s += "/";
    return s;
}

/* ---------- readline helpers ---------- */

function question(prompt) {
    return new Promise(resolve => {
        const rl = createInterface({ input: stdin, output: stdout });
        rl.question(prompt, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function confirm(prompt, fallback = false) {
    const hint = fallback ? "[Y/n]" : "[y/N]";
    const answer = await question(`  ${prompt} ${hint} `);
    if (!answer) return fallback;
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/* ---------- display ---------- */

export function printConfig(config) {
    console.log("\n  ── Portfolio config ──\n");

    console.log(`  Default provider : ${config.lastProvider || "(none)"}`);
    console.log(`  Default theme    : ${config.lastTheme || "midnight"}`);

    const favs = Object.entries(config.favorites || {});
    if (favs.length) {
        console.log("\n  Favorites:");
        for (const [name, target] of favs) {
            console.log(`    ${name} → ${target}`);
        }
    }

    const providers = Object.entries(config.providers || {});
    if (!providers.length) {
        console.log("\n  No providers configured yet.");
        console.log("  → Run `portfolio config` to set one up interactively.\n");
        return;
    }

    console.log("\n  Providers:");
    for (const [id, cfg] of providers) {
        const p = findProvider(id);
        const label = p ? p.label : id;
        console.log(`  • ${label} (${id})`);
        for (const [k, v] of Object.entries(cfg)) {
            const masked = /token|secret|key|password/i.test(k) && v ? "••••••" : v;
            console.log(`      ${k}: ${masked}`);
        }
    }

    if (config.lastDeploy) {
        console.log(`\n  Last deploy: ${config.lastDeploy.url} (${config.lastDeploy.date})`);
    }
    console.log("");
}

/* ---------- interactive flows ---------- */

async function pickProvider() {
    console.log("\n  Choose a provider:\n");
    for (let i = 0; i < PROVIDERS.length; i++) {
        console.log(`  ${i + 1}) ${PROVIDERS[i].label}`);
        console.log(`     ${PROVIDERS[i].desc}\n`);
    }
    const choice = await question("  Provider number [1]: ");
    const idx = parseInt(choice || "1", 10) - 1;
    return PROVIDERS[idx] || PROVIDERS[0];
}

async function configureProvider(config) {
    const p = await pickProvider();
    const cfg = config.providers[p.id] || {};

    console.log(`\n  ── Configure ${p.label} ──\n`);
    console.log("  (leave empty to keep the current value, type 'x' to clear)\n");

    for (const field of p.fields) {
        const current = cfg[field.key];
        const shown = field.secret && current ? "••••••" : (current || "");
        const hint = current ? ` [${shown}]` : "";
        const answer = await question(`  ${field.label}${hint}:\n  > `);

        if (answer === "" ) {
            // keep current
        } else if (answer.toLowerCase() === "x") {
            delete cfg[field.key];
        } else {
            cfg[field.key] = field.key === "subpath" ? normalizeSubpath(answer) : answer;
        }
    }

    config.providers[p.id] = cfg;
    saveConfig(config);
    console.log(`\n  ✅ ${p.label} configured\n`);
    return p.id;
}

async function setDefaultProvider(config) {
    const configured = Object.keys(config.providers || {});
    if (!configured.length) {
        console.log("\n  ℹ  No providers configured yet. Configure one first.\n");
        return;
    }
    console.log("\n  Choose default provider:\n");
    configured.forEach((id, i) => {
        const p = findProvider(id);
        console.log(`  ${i + 1}) ${p ? p.label : id}`);
    });
    const choice = await question(`  Provider number [1]: `);
    const idx = parseInt(choice || "1", 10) - 1;
    const id = configured[idx] || configured[0];
    config.lastProvider = id;
    saveConfig(config);
    console.log(`\n  ✅ Default provider set to ${id}\n`);
}

async function setDefaultTheme(config) {
    const theme = await question("  Default theme (e.g. midnight, matrix, linktree): ");
    if (!theme) return;
    config.lastTheme = theme;
    saveConfig(config);
    console.log(`\n  ✅ Default theme set to ${theme}\n`);
}

async function manageFavorites(config) {
    while (true) {
        const favs = Object.entries(config.favorites || {});
        console.log("\n  ── Favorites ──\n");
        if (favs.length) {
            for (const [name, target] of favs) {
                console.log(`  • ${name} → ${target}`);
            }
        } else {
            console.log("  (none)\n");
        }
        console.log("  1) Add a favorite");
        console.log("  2) Remove a favorite");
        console.log("  0) Back");
        const choice = await question("\n  Choice: ");

        if (choice === "1") {
            const name = await question("  Favorite name (e.g. prod): ");
            if (!name) continue;
            const target = await question("  Target (provider id or theme, e.g. cloudflare / matrix): ");
            if (!target) continue;
            config.favorites = config.favorites || {};
            config.favorites[name] = target;
            saveConfig(config);
            console.log(`  ✅ Favorite "${name}" → ${target}\n`);
        } else if (choice === "2") {
            if (!favs.length) { console.log("  ℹ  No favorites to remove.\n"); continue; }
            const name = await question("  Favorite name to remove: ");
            if (config.favorites?.[name]) {
                delete config.favorites[name];
                saveConfig(config);
                console.log(`  ✅ Favorite "${name}" removed\n`);
            } else {
                console.log(`  ℹ  Favorite "${name}" not found\n`);
            }
        } else {
            return;
        }
    }
}

async function removeProvider(config) {
    const configured = Object.keys(config.providers || {});
    if (!configured.length) {
        console.log("\n  ℹ  No providers configured.\n");
        return;
    }
    console.log("\n  Choose provider to remove:\n");
    configured.forEach((id, i) => {
        const p = findProvider(id);
        console.log(`  ${i + 1}) ${p ? p.label : id}`);
    });
    console.log(`  ${configured.length + 1}) Cancel`);
    const choice = await question(`  Choice: `);
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < configured.length) {
        const id = configured[idx];
        delete config.providers[id];
        if (config.lastProvider === id) config.lastProvider = null;
        saveConfig(config);
        console.log(`\n  ✅ Provider "${id}" removed\n`);
    }
}

/* ---------- interactive menu ---------- */

async function interactiveMenu() {
    const config = loadConfig();

    while (true) {
        console.log("\n  ╔══════════════════════════════════════════╗");
        console.log("  ║           Portfolio Configuration         ║");
        console.log("  ╚══════════════════════════════════════════╝\n");
        console.log(`  Default provider : ${config.lastProvider || "(none)"}`);
        console.log(`  Default theme    : ${config.lastTheme || "midnight"}\n`);
        console.log("  1) Configure a provider");
        console.log("  2) Set default provider");
        console.log("  3) Set default theme");
        console.log("  4) Manage favorites");
        console.log("  5) Remove a provider");
        console.log("  6) Show current config");
        console.log("  0) Exit");

        const choice = await question("\n  Choice: ");

        if (choice === "1") {
            await configureProvider(config);
        } else if (choice === "2") {
            await setDefaultProvider(config);
        } else if (choice === "3") {
            await setDefaultTheme(config);
        } else if (choice === "4") {
            await manageFavorites(config);
        } else if (choice === "5") {
            await removeProvider(config);
        } else if (choice === "6") {
            printConfig(config);
        } else {
            console.log("\n  👋 Bye!\n");
            return;
        }
    }
}

/* ---------- entry ---------- */

export async function runConfigCommand(args) {
    const [sub] = args;

    // No args → interactive menu
    if (!sub) {
        await interactiveMenu();
        return;
    }

    // Non-interactive subcommands (kept for scripting/tests)
    const config = loadConfig();

    switch (sub) {
        case "list":
        case "show":
            printConfig(config);
            return;

        case "set": {
            const [providerId, key, ...valParts] = args.slice(1);
            const value = valParts.join(" ");
            if (!providerId || !key || value === "") {
                console.error("  Usage: portfolio config set <provider> <key> <value>");
                process.exit(1);
            }
            const p = findProvider(providerId);
            if (!p) {
                console.error(`  ❌ Unknown provider "${providerId}".`);
                process.exit(1);
            }
            config.providers[providerId] = config.providers[providerId] || {};
            config.providers[providerId][key] = key === "subpath" ? normalizeSubpath(value) : value;
            saveConfig(config);
            console.log(`  ✅ ${providerId}.${key} saved\n`);
            return;
        }

        case "unset": {
            const [providerId, key] = args.slice(1);
            if (!providerId || !key) {
                console.error("  Usage: portfolio config unset <provider> <key>");
                process.exit(1);
            }
            if (config.providers[providerId] && key in config.providers[providerId]) {
                delete config.providers[providerId][key];
                saveConfig(config);
                console.log(`  ✅ ${providerId}.${key} removed\n`);
            } else {
                console.log(`  ℹ  ${providerId}.${key} not set\n`);
            }
            return;
        }

        case "remove": {
            const [providerId] = args.slice(1);
            if (!providerId) {
                console.error("  Usage: portfolio config remove <provider>");
                process.exit(1);
            }
            if (config.providers[providerId]) {
                delete config.providers[providerId];
                if (config.lastProvider === providerId) config.lastProvider = null;
                saveConfig(config);
                console.log(`  ✅ Provider "${providerId}" removed\n`);
            } else {
                console.log(`  ℹ  Provider "${providerId}" not configured\n`);
            }
            return;
        }

        case "default": {
            const [providerId] = args.slice(1);
            if (!providerId) {
                console.error("  Usage: portfolio config default <provider>");
                process.exit(1);
            }
            const p = findProvider(providerId);
            if (!p) {
                console.error(`  ❌ Unknown provider "${providerId}".`);
                process.exit(1);
            }
            config.lastProvider = providerId;
            saveConfig(config);
            console.log(`  ✅ Default provider set to ${p.label}\n`);
            return;
        }

        case "theme": {
            const [theme] = args.slice(1);
            if (!theme) {
                console.error("  Usage: portfolio config theme <theme>");
                process.exit(1);
            }
            config.lastTheme = theme;
            saveConfig(config);
            console.log(`  ✅ Default theme set to ${theme}\n`);
            return;
        }

        case "favorite": {
            const [name, ...targetParts] = args.slice(1);
            const target = targetParts.join(" ");
            if (!name || !target) {
                console.error("  Usage: portfolio config favorite <name> <provider-or-theme>");
                process.exit(1);
            }
            config.favorites = config.favorites || {};
            config.favorites[name] = target;
            saveConfig(config);
            console.log(`  ✅ Favorite "${name}" → ${target}\n`);
            return;
        }

        case "unfavorite": {
            const [name] = args.slice(1);
            if (!name) {
                console.error("  Usage: portfolio config unfavorite <name>");
                process.exit(1);
            }
            if (config.favorites?.[name]) {
                delete config.favorites[name];
                saveConfig(config);
                console.log(`  ✅ Favorite "${name}" removed\n`);
            } else {
                console.log(`  ℹ  Favorite "${name}" not found\n`);
            }
            return;
        }

        default:
            console.error(`  ❌ Unknown config subcommand "${sub}"\n`);
            console.error("  Run `portfolio config` (no args) for the interactive menu.\n");
            process.exit(1);
    }
}