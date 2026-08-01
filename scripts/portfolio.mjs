#!/usr/bin/env node
/* =================================================
   scripts/portfolio.mjs — Portfolio CLI

   Usage:
     portfolio dev                        start dev server
     portfolio build                      build static bundle
     portfolio deploy                     deploy to a provider
     portfolio config                     show / edit config
     portfolio favorite <name> <target>   save a favorite
     portfolio use <favorite>             deploy a favorite

   All subcommands forward extra flags:
     portfolio dev --theme matrix --port 8080
     portfolio build --theme linktree --out public
     portfolio deploy --provider surge

   Alias: npx portfolio <cmd>
================================================= */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRIPTS = join(__dirname);

const COMMANDS = {
    dev:    { script: "dev.mjs",    desc: "Start the development server" },
    build:  { script: "build.mjs",  desc: "Build the static bundle" },
    deploy: { script: "deploy.mjs", desc: "Deploy to a provider" },
    config: { script: "config.mjs", desc: "Show / edit credentials & defaults" },
};

function help() {
    console.log(`
  Usage: portfolio <command> [options]

  Commands:
${Object.entries(COMMANDS).map(([name, cmd]) =>
    `    ${name.padEnd(18)}${cmd.desc}`
).join("\n")}
    favorite <name> <target>  save a favorite (provider or theme)
    use <favorite>            deploy using a saved favorite

  Options:
    -h, --help              show this help

  Examples:
    portfolio dev
    portfolio dev --theme matrix --port 8080
    portfolio build --theme linktree
    portfolio deploy --provider cloudflare --setup
    portfolio config            # interactive menu (credentials, defaults, favorites)
    portfolio config list       # show current config
    portfolio favorite prod cloudflare
    portfolio use prod
`);
}

async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd || cmd === "--help" || cmd === "-h") {
        help();
        process.exit(cmd ? 0 : 1);
    }

    if (cmd === "help") {
        help();
        return;
    }

    // favorite / use are handled here (they touch config + deploy)
    if (cmd === "favorite") {
        const { runConfigCommand } = await import("./config.mjs");
        await runConfigCommand(["favorite", ...args.slice(1)]);
        return;
    }

    if (cmd === "use") {
        const { loadConfig, findProvider } = await import("./config.mjs");
        const name = args[1];
        if (!name) {
            console.error("  Usage: portfolio use <favorite>");
            process.exit(1);
        }
        const config = loadConfig();
        const target = config.favorites?.[name];
        if (!target) {
            console.error(`  ❌ Favorite "${name}" not found.`);
            console.error("     Save one with: portfolio favorite <name> <provider-or-theme>");
            process.exit(1);
        }
        // If target is a provider, deploy with it; else treat as theme
        const provider = findProvider(target) ? target : config.lastProvider;
        const theme = findProvider(target) ? config.lastTheme : target;
        execSync(`node "${join(SCRIPTS, "deploy.mjs")}" --provider "${provider}" --theme "${theme}"`, {
            cwd: ROOT,
            stdio: "inherit",
        });
        return;
    }

    const entry = COMMANDS[cmd];
    if (!entry) {
        console.error(`\n  ❌ Unknown command: "${cmd}"\n`);
        help();
        process.exit(1);
    }

    // Forward remaining args to the subcommand script
    const subArgs = args.slice(1).map(a => `"${a}"`).join(" ");
    execSync(`node "${join(SCRIPTS, entry.script)}" ${subArgs}`, {
        cwd: ROOT,
        stdio: "inherit",
    });
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});