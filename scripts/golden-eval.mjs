#!/usr/bin/env node
/**
 * Phase 6 — golden set (manual / CI hook):
 * Add `evaluation/golden.json` with entries like:
 * { "label": "question_hook", "transcript": "Why do most startups fail?", "durationSec": 28, "minScore": 50, "maxScore": 95 }
 * After changing `explainScore` in apps/worker/src/segments.ts, re-run clips in dev and
 * compare scores, or add a Vitest/Jest test that imports explainScore from source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenPath = path.join(__dirname, "..", "evaluation", "golden.json");
if (fs.existsSync(goldenPath)) {
  const raw = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  console.log(`Loaded ${Array.isArray(raw) ? raw.length : 0} golden entries.`);
} else {
  console.log(
    "Create evaluation/golden.json to track scoring expectations (see comment in this script).",
  );
}
