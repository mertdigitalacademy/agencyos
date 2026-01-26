#!/usr/bin/env npx tsx
/**
 * Test Supabase Database Connection
 */

import pg from "pg";
import "dotenv/config";

async function main() {
  const databaseUrl = process.env.AGENCYOS_DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ AGENCYOS_DATABASE_URL not set in .env");
    process.exit(1);
  }

  console.log("🔌 Connecting to Supabase...");
  console.log("   URL:", databaseUrl.replace(/:[^:@]+@/, ":***@"));

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const result = await pool.query("SELECT NOW() as time, version() as version");
    console.log("\n✅ Bağlantı başarılı!");
    console.log("   Zaman:", result.rows[0].time);
    console.log("   PostgreSQL:", result.rows[0].version.split(" ")[1]);

    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("\n📋 Mevcut tablolar:");
    if (tables.rows.length === 0) {
      console.log("   (Henüz tablo yok - schema.sql çalıştırılmalı)");
    } else {
      tables.rows.forEach((row) => {
        console.log(`   - ${row.table_name}`);
      });
    }

    await pool.end();
    console.log("\n✅ Test tamamlandı!");
  } catch (e) {
    console.error("\n❌ Bağlantı hatası:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
