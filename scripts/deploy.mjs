#!/usr/bin/env node
/* =================================================
   scripts/deploy.mjs — deploy portfolio to a provider

   First run is interactive: it asks which provider and
   saves the config to deploy.config.json.

   Subsequent runs reuse the saved config (override with CLI flags).

   Usage:
     npm run deploy
     npm run deploy -- --theme matrix
     npm run deploy -- --provider surge
     npm run deploy -- --provider cloudflare --subpath /portfolio/
================================================= */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { loadConfig, saveConfig, PROVIDERS, findProvider, validateProviderConfig } from "./config.mjs";
import { normalizeSubpath, injectBaseHref } from "./inject.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUILD_DIR = join(ROOT, "dist");

/* ---------- CLI args ---------- */

const args = process.argv.slice(2);
function getFlag(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
function hasFlag(name) {
    return args.includes(`--${name}`);
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

/* ---------- config management (shared with config.mjs) ---------- */

// loadConfig / saveConfig / PROVIDERS / findProvider / normalizeSubpath
// are imported from ./config.mjs

/* ---------- interactive setup ---------- */

async function setupCloudflare() {
    console.log("\n  ── Cloudflare Pages setup ──\n");

    const apiToken = await question("  Cloudflare API token (create at dash.cloudflare.com → API Tokens):\n  > ");
    const accountId = await question("  Cloudflare Account ID (from dashboard URL):\n  > ");
    const projectName = await question("  Project name (create in Cloudflare Pages dashboard first):\n  > ");
    const domain = await question("  Custom domain (optional, e.g. mondomaine.com):\n  > ");
    const useSubpath = await confirm("  Deploy to a subpath (e.g. /portfolio/) ?", false);

    let subpath = "";
    if (useSubpath) {
        subpath = await question("  Subpath (e.g. /portfolio/):\n  > ");
        subpath = normalizeSubpath(subpath);
    }

    return { apiToken, accountId, projectName, domain, subpath };
}

async function setupSurge() {
    console.log("\n  ── Surge.sh setup ──\n");

    const domain = await question("  Domain (e.g. mon-portfolio.surge.sh):\n  > ");
    const hasToken = await confirm("  Do you have a Surge token? Run 'npx surge token' if not.", false);

    let token = "";
    if (hasToken) {
        token = await question("  Surge token:\n  > ");
    } else {
        console.log("\n  ℹ  Run `npx surge token` in another terminal, then re-run `npm run deploy`.\n");
        process.exit(1);
    }

    return { domain, token };
}

async function setupCopy() {
    console.log("\n  ── Local copy setup ──\n");

    const out = await question("  Output directory (e.g. ../site or /var/www/portfolio):\n  > ");
    return { out };
}

async function runInteractiveSetup() {
    console.log("\n  ╔══════════════════════════════════════════╗");
    console.log("  ║       Portfolio Deploy — First Setup      ║");
    console.log("  ╚══════════════════════════════════════════╝\n");

    console.log("  Choose a provider:\n");
    for (let i = 0; i < PROVIDERS.length; i++) {
        console.log(`  ${i + 1}) ${PROVIDERS[i].label}`);
        console.log(`     ${PROVIDERS[i].desc}\n`);
    }

    const choice = await question("  Provider number [1]: ");
    const idx = parseInt(choice || "1", 10) - 1;
    const provider = PROVIDERS[idx] || PROVIDERS[0];

    console.log(`\n  Selected: ${provider.label}\n`);

    let providerConfig;
    switch (provider.id) {
        case "cloudflare":
            providerConfig = await setupCloudflare();
            break;
        case "surge":
            providerConfig = await setupSurge();
            break;
        case "copy":
            providerConfig = await setupCopy();
            break;
    }

    const theme = await question(`\n  Theme to use [midnight]: `);
    const finalTheme = theme || "midnight";

    const config = {
        lastProvider: provider.id,
        providers: {
            [provider.id]: providerConfig,
        },
        lastTheme: finalTheme,
        favorites: {},
        lastDeploy: null,
    };

    saveConfig(config);

    console.log(`\n  ✅ Configuration saved to deploy.config.json\n`);

    return { provider: provider.id, config, providerConfig, theme: finalTheme };
}

/* ---------- main deploy ---------- */

async function main() {
    console.log(`\n  🚀 Portfolio Deploy\n`);

    // ── 1. Load or setup config ──
    const config = loadConfig();
    const hasConfig = config.lastProvider && config.providers[config.lastProvider];

    if (!hasConfig || hasFlag("setup")) {
        const setup = await runInteractiveSetup();
        config.lastProvider = setup.provider;
        config.providers[setup.provider] = setup.providerConfig;
        config.lastTheme = setup.theme;
        saveConfig(config);

        // Re-load to use the saved config for the deploy itself
        return await deployWithConfig(config, setup.provider, setup.providerConfig);
    }

    // ── 2. Use existing config (CLI overrides) ──
    // Default to the saved default provider if none specified
    let provider = config.lastProvider;
    let providerConfig = provider ? config.providers[provider] : null;

    // Allow changing provider on the fly
    if (hasFlag("provider")) {
        const newProvider = getFlag("provider");
        if (config.providers[newProvider]) {
            provider = newProvider;
            providerConfig = config.providers[newProvider];
        } else {
            console.error(`  ❌ No saved config for provider "${newProvider}".`);
            console.error(`     Run 'npm run deploy -- --setup' to add it.\n`);
            process.exit(1);
        }
    }

    if (!provider || !providerConfig) {
        console.error(`  ❌ No provider configured.`);
        console.error(`     Run 'portfolio config' to set one up, or 'npm run deploy -- --setup'.\n`);
        process.exit(1);
    }

    // Allow overriding any provider option via CLI
    if (hasFlag("token")) providerConfig.token = getFlag("token");
    if (hasFlag("domain")) providerConfig.domain = getFlag("domain");
    if (hasFlag("project")) providerConfig.projectName = getFlag("project");
    if (hasFlag("account")) providerConfig.accountId = getFlag("account");
    if (hasFlag("api-token")) providerConfig.apiToken = getFlag("api-token");
    if (hasFlag("subpath")) providerConfig.subpath = getFlag("subpath");
    if (hasFlag("out")) providerConfig.out = getFlag("out");

    // ── 2b. Validate config before deploying ──
    const missing = validateProviderConfig(provider, providerConfig);
    if (missing.length) {
        console.error(`  ❌ ${findProvider(provider).label} config is incomplete.`);
        console.error(`     Missing: ${missing.join(", ")}`);
        console.error(`     Run 'portfolio config' to fix it.\n`);
        process.exit(1);
    }

    return await deployWithConfig(config, provider, providerConfig);
}

async function deployWithConfig(config, provider, providerConfig) {
    const theme = getFlag("theme") || config.lastTheme || "midnight";

    // ── 3. Build ──
    if (!hasFlag("no-build")) {
        console.log(`  → building with theme: ${theme}...\n`);

        const { execSync } = await import("node:child_process");
        try {
            execSync(`node scripts/build.mjs --theme "${theme}"`, {
                cwd: ROOT,
                stdio: "inherit",
                timeout: 30_000,
            });
        } catch {
            process.exit(1);
        }
        console.log("");
    }

    // ── 3b. Inject subpath into built HTML if needed ──
    const subpath = providerConfig.subpath;
    const cleanSub = subpath ? subpath.replace(/^\/|\/$/g, "") : "";
    if (cleanSub) {
        const base = `/${cleanSub}/`;
        process.stdout.write(`  → injecting <base href="${base}"> for subpath support...\n`);
        let html = readFileSync(join(BUILD_DIR, "index.html"), "utf-8");
        const injected = injectBaseHref(html, base);
        if (injected !== html) {
            writeFileSync(join(BUILD_DIR, "index.html"), injected);
        }
    }

    // ── 4. Deploy ──
    process.stdout.write(`  → deploying via ${provider}...\n`);

    const mod = await import(`./providers/${provider}.mjs`);
    const result = await mod.deploy({
        ...providerConfig,
        buildDir: BUILD_DIR,
    });

    // ── 5. Save deploy info ──
    config.lastDeploy = {
        url: result.url,
        date: new Date().toISOString(),
        provider,
        theme,
    };
    saveConfig(config);

    // ── 6. Done ──
    console.log(`\n  ✅ Deployed successfully!`);
    console.log(`  → ${result.url}`);
    console.log(`  → provider: ${provider}`);
    console.log(`  → theme: ${theme}`);
    console.log(`  → saved to deploy.config.json\n`);

    return result;
}

/* ---------- entry ---------- */

main().catch(err => {
    console.error(`\n  ❌ ${err.message}\n`);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
});