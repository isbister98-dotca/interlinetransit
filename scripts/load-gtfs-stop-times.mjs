/**
 * TTC GTFS Stop Times Loader
 * --------------------------
 * This script is run automatically every night by GitHub Actions.
 * It downloads the TTC GTFS zip, extracts stop_times.txt, and upserts
 * the data into Supabase in safe batches of 5,000 rows.
 *
 * Uses the anon key instead of the service role key — this works because
 * RLS (Row Level Security) has been disabled on the gtfs_stop_times table.
 * GTFS schedule data is fully public so this is safe to do.
 *
 * GitHub Secrets needed (Settings → Secrets and variables → Actions):
 *   - SUPABASE_URL       → your VITE_SUPABASE_URL value
 *   - SUPABASE_ANON_KEY  → your VITE_SUPABASE_PUBLISHABLE_KEY value
 */

import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// These come from GitHub Secrets — no need to change anything here
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Must match the agency_id value for TTC in your gtfs_agency table
const AGENCY_ID = "TTC";

const GTFS_ZIP_URL =
  "http://opendata.toronto.ca/toronto.transit.commission/ttc-routes-and-schedules/OpenData_TTC_Schedules.zip";

const BATCH_SIZE = 5000;
// ─────────────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌  Missing environment variables.");
  console.error("    Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set as GitHub Secrets.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STEP 1: Download zip and pull out stop_times.txt ────────────────────────
async function downloadAndExtract() {
  console.log("⬇️  Downloading TTC GTFS zip...");
  const response = await fetch(GTFS_ZIP_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

  const buffer = await response.buffer();
  console.log(`✅  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("stop_times.txt");
  if (!entry) throw new Error("stop_times.txt not found inside the zip!");

  const csvText = entry.getData().toString("utf8");
  console.log(`📄  stop_times.txt extracted (${(csvText.length / 1024 / 1024).toFixed(1)} MB)`);
  return csvText;
}

// ─── STEP 2: Parse CSV into objects matching your Supabase schema ─────────────
function parseCsv(csvText) {
  return new Promise((resolve, reject) => {
    const records = [];
    Readable.from([csvText])
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row) => {
        records.push({
          agency_id:           AGENCY_ID,
          trip_id:             row.trip_id,
          stop_id:             row.stop_id,
          stop_sequence:       parseInt(row.stop_sequence, 10),
          arrival_time:        row.arrival_time        || null,
          departure_time:      row.departure_time      || null,
          stop_headsign:       row.stop_headsign       || null,
          pickup_type:         row.pickup_type         ? parseInt(row.pickup_type, 10)        : null,
          drop_off_type:       row.drop_off_type       ? parseInt(row.drop_off_type, 10)      : null,
          shape_dist_traveled: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : null,
          timepoint:           row.timepoint           ? parseInt(row.timepoint, 10)          : null,
        });
      })
      .on("end", () => resolve(records))
      .on("error", reject);
  });
}

// ─── STEP 3: Insert into Supabase in batches ─────────────────────────────────
async function insertInBatches(rows) {
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  console.log(`\n🚀  Inserting ${rows.length.toLocaleString()} rows in ${totalBatches} batches...`);

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase
      .from("gtfs_stop_times")
      .upsert(batch, { onConflict: "agency_id,trip_id,stop_sequence" });

    if (error) {
      console.error(`\n❌  Batch ${batchNum} failed: ${error.message}`);
      // If we get a permissions error, RLS is probably still enabled
      if (error.message.includes("permission") || error.message.includes("policy")) {
        console.error("    This looks like an RLS error. Make sure you ran:");
        console.error("    ALTER TABLE gtfs_stop_times DISABLE ROW LEVEL SECURITY;");
        console.error("    in the Loveable Cloud SQL editor.");
      }
      failed += batch.length;
      continue;
    }

    inserted += batch.length;
    const pct = ((batchNum / totalBatches) * 100).toFixed(0);
    process.stdout.write(
      `\r   ✓ Batch ${batchNum}/${totalBatches} (${pct}%) — ${inserted.toLocaleString()} rows inserted`
    );
  }

  console.log("\n");
  if (failed > 0) {
    console.warn(`⚠️  ${failed.toLocaleString()} rows failed. Check errors above.`);
    process.exit(1);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== TTC GTFS Nightly Stop Times Update ===");
  console.log(`Time:      ${new Date().toISOString()}`);
  console.log(`Agency ID: ${AGENCY_ID}`);
  console.log(`Supabase:  ${SUPABASE_URL}\n`);

  const { error: pingError } = await supabase
    .from("gtfs_stop_times")
    .select("trip_id")
    .limit(1);

  if (pingError) {
    console.error("❌  Could not connect to Supabase:", pingError.message);
    process.exit(1);
  }
  console.log("✅  Connected to Supabase\n");

  try {
    const csvText = await downloadAndExtract();

    console.log("🔍  Parsing CSV...");
    const rows = await parseCsv(csvText);
    console.log(`✅  Parsed ${rows.length.toLocaleString()} rows\n`);

    await insertInBatches(rows);

    console.log("🎉  Done! gtfs_stop_times is up to date.");
  } catch (err) {
    console.error("\n❌  Fatal error:", err.message);
    process.exit(1);
  }
}

main();
