#!/usr/bin/env node

// Backfill `locked: true` onto any Pokémon palette variant whose
// `highlights` array has reached the admin/extractor max size of 6.
//
// Context: when the game resolves the target Pokémon's palette in
// `loadTargetColors` (src/app/game/page.tsx) it short-circuits to
// `palette.highlights` only when `palette.locked === true`. Otherwise
// it re-extracts colors from the sprite at runtime every time. The
// admin Color Management PUT (src/app/api/admin/pokemon-colors/route.ts)
// pads every save to MAX_PALETTE_SIZE = 6 slots — so any palette with
// 6 highlights on disk was either explicitly admin-curated or produced
// by the same extraction pipeline an admin would have used, and the
// game is safe to treat it as authoritative.
//
// Variants are locked independently: a 6-slot normal palette gets
// `colorPalette.locked = true`; a 6-slot shiny palette gets
// `shinyColorPalette.locked = true`; one doesn't imply the other.
//
// Usage:
//   node scripts/lock-extracted-palettes.js           # apply changes
//   node scripts/lock-extracted-palettes.js --dry-run # preview only

const fs = require("fs/promises");
const path = require("path");

const POKEMON_DIR = path.join(process.cwd(), "public", "data", "pokemon");
// Must stay in sync with MAX_PALETTE_SIZE in
// src/app/api/admin/pokemon-colors/route.ts. Anything below this
// length is either the legacy 3-slot default or a partial extraction
// and shouldn't be treated as authoritative.
const LOCK_THRESHOLD = 6;

const VARIANTS = /** @type {const} */ (["colorPalette", "shinyColorPalette"]);

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const entries = await fs.readdir(POKEMON_DIR);
  const jsonFiles = entries.filter((f) => f.endsWith(".json"));

  const stats = {
    scanned: 0,
    filesTouched: 0,
    locksAdded: { colorPalette: 0, shinyColorPalette: 0 },
    alreadyLocked: { colorPalette: 0, shinyColorPalette: 0 },
    notEligible: { colorPalette: 0, shinyColorPalette: 0 },
    missingVariant: { colorPalette: 0, shinyColorPalette: 0 },
  };
  const touched = [];

  for (const filename of jsonFiles) {
    stats.scanned++;
    const filePath = path.join(POKEMON_DIR, filename);
    const raw = await fs.readFile(filePath, "utf-8");
    // Some files end with a trailing newline (editor convention),
    // some don't (the admin route's writeFile does not append one).
    // Preserve whatever was there so we don't produce noisy whole-file
    // diffs in the next commit.
    const trailingNewline = raw.endsWith("\n");

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn(`! ${filename}: failed to parse JSON, skipping (${err.message})`);
      continue;
    }

    let changed = false;
    const lockedHere = [];

    for (const variant of VARIANTS) {
      const palette = data[variant];
      if (!palette || typeof palette !== "object") {
        stats.missingVariant[variant]++;
        continue;
      }
      const highlights = Array.isArray(palette.highlights)
        ? palette.highlights
        : null;
      const eligible =
        highlights !== null && highlights.length >= LOCK_THRESHOLD;

      if (palette.locked === true) {
        stats.alreadyLocked[variant]++;
        continue;
      }
      if (!eligible) {
        stats.notEligible[variant]++;
        continue;
      }

      palette.locked = true;
      changed = true;
      stats.locksAdded[variant]++;
      lockedHere.push(variant === "shinyColorPalette" ? "shiny" : "normal");
    }

    if (changed) {
      stats.filesTouched++;
      touched.push({
        id: data.id ?? filename.replace(".json", ""),
        name: data.name ?? "?",
        variants: lockedHere,
      });
      if (!dryRun) {
        const out =
          JSON.stringify(data, null, 2) + (trailingNewline ? "\n" : "");
        await fs.writeFile(filePath, out, "utf-8");
      }
    }
  }

  const prefix = dryRun ? "[dry-run] " : "";
  const fmt = (n) => String(n).padStart(5);
  console.log("");
  console.log(`${prefix}Scanned files:              ${fmt(stats.scanned)}`);
  console.log(`${prefix}Files touched:              ${fmt(stats.filesTouched)}`);
  console.log(
    `${prefix}Normal locks added:         ${fmt(stats.locksAdded.colorPalette)}`,
  );
  console.log(
    `${prefix}Shiny  locks added:         ${fmt(stats.locksAdded.shinyColorPalette)}`,
  );
  console.log(
    `${prefix}Already locked (normal):    ${fmt(stats.alreadyLocked.colorPalette)}`,
  );
  console.log(
    `${prefix}Already locked (shiny):     ${fmt(stats.alreadyLocked.shinyColorPalette)}`,
  );
  console.log(
    `${prefix}Below threshold (normal):   ${fmt(stats.notEligible.colorPalette)}`,
  );
  console.log(
    `${prefix}Below threshold (shiny):    ${fmt(stats.notEligible.shinyColorPalette)}`,
  );
  console.log(
    `${prefix}Variant absent (normal):    ${fmt(stats.missingVariant.colorPalette)}`,
  );
  console.log(
    `${prefix}Variant absent (shiny):     ${fmt(stats.missingVariant.shinyColorPalette)}`,
  );

  if (touched.length > 0) {
    const sampleCount = Math.min(touched.length, 20);
    console.log("");
    console.log(`${prefix}Sample of touched entries (first ${sampleCount}):`);
    for (const t of touched.slice(0, sampleCount)) {
      console.log(
        `  ${String(t.id).padStart(5)}  ${t.name.padEnd(22)}  [${t.variants.join(", ")}]`,
      );
    }
    if (touched.length > sampleCount) {
      console.log(`  …and ${touched.length - sampleCount} more`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
