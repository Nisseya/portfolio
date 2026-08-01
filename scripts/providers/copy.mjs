#!/usr/bin/env node
/* =================================================
   scripts/providers/copy.mjs
   Copy built files to a local directory
================================================= */

import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";

/**
 * @param {object} opts
 * @param {string} opts.out       - output directory (absolute or relative)
 * @param {string} opts.buildDir  - path to dist/
 * @returns {Promise<{url: string}>}
 */
export async function deploy(opts) {
    const { out, buildDir } = opts;

    if (!out) throw new Error("Output path is required for copy provider");

    const dest = resolve(cwd(), out);
    const src = join(buildDir, "index.html");

    if (!existsSync(src)) {
        throw new Error(`Build not found at ${buildDir}/ — run 'npm run build' first`);
    }

    process.stdout.write(`  → copying to ${dest}/...\n`);

    // ensure destination directory exists
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dest, { recursive: true });

    cpSync(src, join(dest, "index.html"), { force: true });

    return { url: `file://${join(dest, "index.html")}` };
}