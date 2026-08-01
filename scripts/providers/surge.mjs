#!/usr/bin/env node
/* =================================================
   scripts/providers/surge.mjs
   Deploy to Surge.sh via npx surge
================================================= */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {object} opts
 * @param {string} opts.domain   - e.g. "mon-portfolio.surge.sh"
 * @param {string} opts.token    - Surge auth token
 * @param {string} opts.buildDir - path to dist/
 * @returns {Promise<{url: string}>}
 */
export async function deploy(opts) {
    const { domain, token, buildDir } = opts;

    if (!domain) throw new Error("Surge domain is required");
    if (!token) throw new Error("Surge token is required (run `npx surge token` to get one)");

    const indexHtml = join(buildDir, "index.html");
    if (!existsSync(indexHtml)) {
        throw new Error(`Build not found at ${buildDir}/ — run 'npm run build' first`);
    }

    process.stdout.write("  → deploying to Surge.sh...\n");

    try {
        const cmd = [
            `npx surge`,
            `"${buildDir}"`,
            `"${domain}"`,
            `--token "${token}"`,
        ].join(" ");

        const output = execSync(cmd, { encoding: "utf-8", timeout: 60_000 });

        // Surge outputs something like:
        //   success: Published — https://mon-portfolio.surge.sh
        const url = domain.startsWith("http") ? domain : `https://${domain}`;
        return { url };
    } catch (err) {
        throw new Error(`Surge deploy failed:\n  ${err.stderr?.trim() || err.message}`);
    }
}

/**
 * Prompt user to visit Surge and get a token
 */
export function getTokenInstructions() {
    return (
        "  To get a Surge token, run:\n" +
        "    npx surge token\n\n" +
        "  It will ask you to login/register first,\n" +
        "  then print a token you can paste here."
    );
}