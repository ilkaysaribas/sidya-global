#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

const suspiciousPattern = /[ÃÄÅÂâ�]/;
const brokenPattern = /Ã|Ä|Å|Â|â|�/g;

const targets = [
  { table: "products", id: "id", columns: ["name", "brand", "category", "grammage", "unit", "sku", "barcode", "description"] },
  { table: "customers", id: "id", columns: ["code", "company", "contact_name", "country", "email", "tax_number", "role", "customer_type", "type", "notes"] },
  { table: "site_orders", id: "id", columns: ["order_no", "customer_name", "company", "email", "phone", "status"] },
  { table: "invoices", id: "id", columns: ["invoice_no", "notes", "status", "scenario"] },
  { table: "invoice_items", id: "id", columns: ["description", "product_code", "barcode"] },
];

function loadEnvFile(fileName) {
  const file = path.join(process.cwd(), fileName);
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^[`'\"]|[`'\"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function countBrokenCharacters(value) {
  return (String(value || "").match(brokenPattern) || []).length;
}

function decodeLatin1AsUtf8(value) {
  return Buffer.from(String(value), "latin1").toString("utf8");
}

function repairMojibake(input) {
  let value = String(input ?? "");
  if (!value) return "";

  for (let i = 0; i < 4; i += 1) {
    if (!suspiciousPattern.test(value)) break;

    const oldScore = countBrokenCharacters(value);
    let repaired = value;
    try {
      repaired = decodeLatin1AsUtf8(value);
    } catch {
      break;
    }

    const newScore = countBrokenCharacters(repaired);
    if (!repaired || repaired === value || newScore >= oldScore) break;
    value = repaired;
  }

  return value;
}

function usage() {
  console.log(`Usage:\n  node scripts/repair-mojibake.js\n  node scripts/repair-mojibake.js --apply --backup-confirmed\n\nDefault mode is dry-run. It prints table, id, column, old value and repaired value.\nIt only updates values when --apply and --backup-confirmed are both provided.`);
}

async function main() {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const apply = process.argv.includes("--apply");
  const backupConfirmed = process.argv.includes("--backup-confirmed");
  if (apply && !backupConfirmed) {
    throw new Error("Refusing to write. Take a backup first, then rerun with --apply --backup-confirmed.");
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SIDYA_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SIDYA_SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let previewCount = 0;
  let updatedCount = 0;
  const skippedTables = [];

  for (const target of targets) {
    const selectColumns = [target.id, ...target.columns].join(",");
    const { data, error } = await supabase.from(target.table).select(selectColumns).limit(10000);

    if (error) {
      skippedTables.push(`${target.table}: ${error.message}`);
      continue;
    }

    for (const row of data || []) {
      const updates = {};
      for (const column of target.columns) {
        const current = row[column];
        if (current === null || current === undefined || !suspiciousPattern.test(String(current))) continue;

        const repaired = repairMojibake(current);
        if (!repaired || repaired === current) continue;
        if (countBrokenCharacters(repaired) >= countBrokenCharacters(current)) continue;

        previewCount += 1;
        updates[column] = repaired;
        console.log(`${target.table} | ${row[target.id]} | ${column}`);
        console.log(`  Eski: ${String(current).slice(0, 220)}`);
        console.log(`  Yeni: ${String(repaired).slice(0, 220)}`);
      }

      if (apply && Object.keys(updates).length) {
        const { error: updateError } = await supabase.from(target.table).update(updates).eq(target.id, row[target.id]);
        if (updateError) {
          console.error(`${target.table} | ${row[target.id]} update failed: ${updateError.message}`);
        } else {
          updatedCount += 1;
        }
      }
    }
  }

  console.log("");
  console.log(`Dry-run candidate count: ${previewCount}`);
  console.log(`Updated row count: ${updatedCount}`);
  if (skippedTables.length) {
    console.log("Skipped tables/columns:");
    skippedTables.forEach((item) => console.log(`- ${item}`));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});