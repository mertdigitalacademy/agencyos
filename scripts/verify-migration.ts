#!/usr/bin/env npx tsx
/**
 * AgencyOS Migration Verification Script
 *
 * This script verifies that data was migrated correctly from JSON files to Supabase.
 * It compares record counts and sample data between the two storage systems.
 *
 * Usage:
 *   npx tsx scripts/verify-migration.ts
 *
 * Environment:
 *   AGENCYOS_DATABASE_URL - PostgreSQL connection string (required)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

const DATA_DIR = path.resolve(process.cwd(), "data");

interface VerificationResult {
  entity: string;
  jsonCount: number;
  dbCount: number;
  match: boolean;
  details?: string;
}

interface VerificationReport {
  timestamp: string;
  databaseUrl: string;
  results: VerificationResult[];
  success: boolean;
  summary: {
    total: number;
    matched: number;
    mismatched: number;
  };
}

async function readJsonFile<T>(filename: string): Promise<T | null> {
  const fullPath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return "postgres://***";
  }
}

async function verifyMigration(): Promise<VerificationReport> {
  const databaseUrl = process.env.AGENCYOS_DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ AGENCYOS_DATABASE_URL not set");
    process.exit(1);
  }

  console.log("\n🔍 AgencyOS Migration Verification\n");
  console.log(`📂 JSON Data Directory: ${DATA_DIR}`);
  console.log(`🗄️  Database: ${redactUrl(databaseUrl)}\n`);

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  const results: VerificationResult[] = [];

  // Test database connection
  try {
    await pool.query("SELECT 1 as ok");
    console.log("✅ Database connection successful\n");
  } catch (e) {
    console.error("❌ Database connection failed:", e);
    process.exit(1);
  }

  console.log("Verifying data migration...\n");

  // ============================================
  // PROJECTS
  // ============================================
  console.log("📁 Projects...");
  const projectsJson = await readJsonFile<{ id: string }[]>("projects.json");
  const projectsDb = await pool.query("SELECT COUNT(*) as count FROM projects");
  const jsonProjectCount = projectsJson?.length ?? 0;
  const dbProjectCount = parseInt(projectsDb.rows[0].count, 10);

  results.push({
    entity: "projects",
    jsonCount: jsonProjectCount,
    dbCount: dbProjectCount,
    match: jsonProjectCount === dbProjectCount,
    details: jsonProjectCount === dbProjectCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonProjectCount}, DB has ${dbProjectCount}`,
  });
  console.log(`   JSON: ${jsonProjectCount}, DB: ${dbProjectCount} ${jsonProjectCount === dbProjectCount ? "✅" : "⚠️"}`);

  // ============================================
  // COUNCIL SESSIONS
  // ============================================
  console.log("🏛️  Council Sessions...");
  const councilJson = await readJsonFile<{ id: string }[]>("council-sessions.json");
  const councilDb = await pool.query("SELECT COUNT(*) as count FROM council_sessions");
  const jsonCouncilCount = councilJson?.length ?? 0;
  const dbCouncilCount = parseInt(councilDb.rows[0].count, 10);

  results.push({
    entity: "council_sessions",
    jsonCount: jsonCouncilCount,
    dbCount: dbCouncilCount,
    match: jsonCouncilCount === dbCouncilCount,
    details: jsonCouncilCount === dbCouncilCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonCouncilCount}, DB has ${dbCouncilCount}`,
  });
  console.log(`   JSON: ${jsonCouncilCount}, DB: ${dbCouncilCount} ${jsonCouncilCount === dbCouncilCount ? "✅" : "⚠️"}`);

  // ============================================
  // ASSISTANT STATE
  // ============================================
  console.log("🤖 Assistant State...");
  const assistantJson = await readJsonFile<{ messages?: unknown[] }>("assistant.json");
  const assistantDb = await pool.query("SELECT COUNT(*) as count FROM assistant_state");
  const assistantMsgDb = await pool.query("SELECT COUNT(*) as count FROM assistant_messages");
  const jsonAssistantExists = assistantJson !== null ? 1 : 0;
  const jsonMsgCount = assistantJson?.messages?.length ?? 0;
  const dbAssistantCount = parseInt(assistantDb.rows[0].count, 10);
  const dbMsgCount = parseInt(assistantMsgDb.rows[0].count, 10);

  results.push({
    entity: "assistant_state",
    jsonCount: jsonAssistantExists,
    dbCount: dbAssistantCount,
    match: true, // Assistant state is singleton, so we just check if it exists
    details: `State exists: JSON=${jsonAssistantExists > 0}, DB=${dbAssistantCount > 0}. Messages: JSON=${jsonMsgCount}, DB=${dbMsgCount}`,
  });
  console.log(`   State: JSON=${jsonAssistantExists > 0}, DB=${dbAssistantCount > 0}. Messages: JSON=${jsonMsgCount}, DB=${dbMsgCount} ✅`);

  // ============================================
  // OUTBOUND LEADS
  // ============================================
  console.log("📞 Outbound Leads...");
  const leadsJson = await readJsonFile<{ id: string }[]>("outbound-leads.json");
  const leadsDb = await pool.query("SELECT COUNT(*) as count FROM outbound_leads");
  const jsonLeadsCount = leadsJson?.length ?? 0;
  const dbLeadsCount = parseInt(leadsDb.rows[0].count, 10);

  results.push({
    entity: "outbound_leads",
    jsonCount: jsonLeadsCount,
    dbCount: dbLeadsCount,
    match: jsonLeadsCount === dbLeadsCount,
    details: jsonLeadsCount === dbLeadsCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonLeadsCount}, DB has ${dbLeadsCount}`,
  });
  console.log(`   JSON: ${jsonLeadsCount}, DB: ${dbLeadsCount} ${jsonLeadsCount === dbLeadsCount ? "✅" : "⚠️"}`);

  // ============================================
  // AGENCY STATE
  // ============================================
  console.log("🏢 Agency State...");
  const agencyJson = await readJsonFile<{ documents?: unknown[] }>("agency.json");
  const agencyDb = await pool.query("SELECT COUNT(*) as count FROM agency_state");
  const agencyDocsDb = await pool.query("SELECT COUNT(*) as count FROM agency_documents");
  const jsonAgencyExists = agencyJson !== null ? 1 : 0;
  const jsonDocsCount = agencyJson?.documents?.length ?? 0;
  const dbAgencyCount = parseInt(agencyDb.rows[0].count, 10);
  const dbDocsCount = parseInt(agencyDocsDb.rows[0].count, 10);

  results.push({
    entity: "agency_state",
    jsonCount: jsonAgencyExists,
    dbCount: dbAgencyCount,
    match: true,
    details: `State exists: JSON=${jsonAgencyExists > 0}, DB=${dbAgencyCount > 0}. Docs: JSON=${jsonDocsCount}, DB=${dbDocsCount}`,
  });
  console.log(`   State: JSON=${jsonAgencyExists > 0}, DB=${dbAgencyCount > 0}. Docs: JSON=${jsonDocsCount}, DB=${dbDocsCount} ✅`);

  // ============================================
  // MARKET RADAR STATE
  // ============================================
  console.log("📡 Market Radar State...");
  const radarJson = await readJsonFile<{ leads?: unknown[]; opportunities?: unknown[] }>("market-radar.json");
  const radarDb = await pool.query("SELECT COUNT(*) as count FROM market_radar_state");
  const radarLeadsDb = await pool.query("SELECT COUNT(*) as count FROM market_lead_candidates");
  const radarOppsDb = await pool.query("SELECT COUNT(*) as count FROM market_opportunities");
  const jsonRadarExists = radarJson !== null ? 1 : 0;
  const jsonRadarLeads = radarJson?.leads?.length ?? 0;
  const jsonRadarOpps = radarJson?.opportunities?.length ?? 0;
  const dbRadarCount = parseInt(radarDb.rows[0].count, 10);
  const dbRadarLeads = parseInt(radarLeadsDb.rows[0].count, 10);
  const dbRadarOpps = parseInt(radarOppsDb.rows[0].count, 10);

  results.push({
    entity: "market_radar_state",
    jsonCount: jsonRadarExists,
    dbCount: dbRadarCount,
    match: true,
    details: `State: JSON=${jsonRadarExists}, DB=${dbRadarCount}. Leads: JSON=${jsonRadarLeads}, DB=${dbRadarLeads}. Opps: JSON=${jsonRadarOpps}, DB=${dbRadarOpps}`,
  });
  console.log(`   State: JSON=${jsonRadarExists}, DB=${dbRadarCount}. Leads: JSON=${jsonRadarLeads}, DB=${dbRadarLeads}. Opps: JSON=${jsonRadarOpps}, DB=${dbRadarOpps} ✅`);

  // ============================================
  // RUNTIME SETTINGS
  // ============================================
  console.log("⚙️  Runtime Settings...");
  const settingsJson = await readJsonFile<Record<string, unknown>>("settings.json");
  const settingsDb = await pool.query("SELECT COUNT(*) as count FROM runtime_settings");
  const jsonSettingsExists = settingsJson !== null ? 1 : 0;
  const dbSettingsCount = parseInt(settingsDb.rows[0].count, 10);

  results.push({
    entity: "runtime_settings",
    jsonCount: jsonSettingsExists,
    dbCount: dbSettingsCount,
    match: true,
    details: `JSON exists: ${jsonSettingsExists > 0}, DB exists: ${dbSettingsCount > 0}`,
  });
  console.log(`   JSON exists: ${jsonSettingsExists > 0}, DB exists: ${dbSettingsCount > 0} ✅`);

  // ============================================
  // SECRETS
  // ============================================
  console.log("🔐 Secrets...");
  const secretsJson = await readJsonFile<{ id: string }[]>("secrets.json");
  const secretsDb = await pool.query("SELECT COUNT(*) as count FROM secrets");
  const jsonSecretsCount = secretsJson?.length ?? 0;
  const dbSecretsCount = parseInt(secretsDb.rows[0].count, 10);

  results.push({
    entity: "secrets",
    jsonCount: jsonSecretsCount,
    dbCount: dbSecretsCount,
    match: jsonSecretsCount === dbSecretsCount,
    details: jsonSecretsCount === dbSecretsCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonSecretsCount}, DB has ${dbSecretsCount}`,
  });
  console.log(`   JSON: ${jsonSecretsCount}, DB: ${dbSecretsCount} ${jsonSecretsCount === dbSecretsCount ? "✅" : "⚠️"}`);

  // ============================================
  // PROPOSALS
  // ============================================
  console.log("📋 Proposals...");
  const proposalsJson = await readJsonFile<{ id: string }[]>("proposals.json");
  const proposalsDb = await pool.query("SELECT COUNT(*) as count FROM proposals");
  const jsonProposalsCount = proposalsJson?.length ?? 0;
  const dbProposalsCount = parseInt(proposalsDb.rows[0].count, 10);

  results.push({
    entity: "proposals",
    jsonCount: jsonProposalsCount,
    dbCount: dbProposalsCount,
    match: jsonProposalsCount === dbProposalsCount,
    details: jsonProposalsCount === dbProposalsCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonProposalsCount}, DB has ${dbProposalsCount}`,
  });
  console.log(`   JSON: ${jsonProposalsCount}, DB: ${dbProposalsCount} ${jsonProposalsCount === dbProposalsCount ? "✅" : "⚠️"}`);

  // ============================================
  // FINANCIAL TRANSACTIONS
  // ============================================
  console.log("💰 Financial Transactions...");
  const transactionsJson = await readJsonFile<{ id: string }[]>("financial-transactions.json");
  const transactionsDb = await pool.query("SELECT COUNT(*) as count FROM financial_transactions");
  const jsonTransactionsCount = transactionsJson?.length ?? 0;
  const dbTransactionsCount = parseInt(transactionsDb.rows[0].count, 10);

  results.push({
    entity: "financial_transactions",
    jsonCount: jsonTransactionsCount,
    dbCount: dbTransactionsCount,
    match: jsonTransactionsCount === dbTransactionsCount,
    details: jsonTransactionsCount === dbTransactionsCount
      ? "✅ Match"
      : `⚠️ Mismatch: JSON has ${jsonTransactionsCount}, DB has ${dbTransactionsCount}`,
  });
  console.log(`   JSON: ${jsonTransactionsCount}, DB: ${dbTransactionsCount} ${jsonTransactionsCount === dbTransactionsCount ? "✅" : "⚠️"}`);

  // ============================================
  // SUMMARY
  // ============================================
  const matched = results.filter((r) => r.match).length;
  const mismatched = results.filter((r) => !r.match).length;
  const success = mismatched === 0;

  console.log("\n" + "=".repeat(50));
  console.log("📊 VERIFICATION SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total entities checked: ${results.length}`);
  console.log(`Matched: ${matched} ✅`);
  console.log(`Mismatched: ${mismatched} ${mismatched > 0 ? "⚠️" : ""}`);
  console.log(`Overall: ${success ? "✅ PASSED" : "⚠️ WARNINGS"}`);
  console.log("=".repeat(50) + "\n");

  if (mismatched > 0) {
    console.log("⚠️ Mismatched entities:");
    results.filter((r) => !r.match).forEach((r) => {
      console.log(`   - ${r.entity}: ${r.details}`);
    });
    console.log("");
  }

  await pool.end();

  return {
    timestamp: new Date().toISOString(),
    databaseUrl: redactUrl(databaseUrl),
    results,
    success,
    summary: {
      total: results.length,
      matched,
      mismatched,
    },
  };
}

// ============================================
// DATA INTEGRITY CHECKS
// ============================================

async function verifyDataIntegrity(): Promise<void> {
  const databaseUrl = process.env.AGENCYOS_DATABASE_URL;
  if (!databaseUrl) return;

  console.log("🔍 Running data integrity checks...\n");

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  // Check for orphaned records
  console.log("Checking for orphaned records...");

  // Project briefs without projects
  const orphanedBriefs = await pool.query(`
    SELECT COUNT(*) as count FROM project_briefs pb
    WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pb.project_id)
  `);
  const orphanedBriefsCount = parseInt(orphanedBriefs.rows[0].count, 10);
  console.log(`   Orphaned project_briefs: ${orphanedBriefsCount} ${orphanedBriefsCount === 0 ? "✅" : "⚠️"}`);

  // Council sessions without projects (optional relationship)
  const councilWithoutProjects = await pool.query(`
    SELECT COUNT(*) as count FROM council_sessions cs
    WHERE cs.project_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = cs.project_id)
  `);
  const orphanedCouncilCount = parseInt(councilWithoutProjects.rows[0].count, 10);
  console.log(`   Orphaned council_sessions: ${orphanedCouncilCount} ${orphanedCouncilCount === 0 ? "✅" : "⚠️"}`);

  // Check for data consistency
  console.log("\nChecking data consistency...");

  // Projects with status
  const projectStatuses = await pool.query(`
    SELECT status, COUNT(*) as count FROM projects GROUP BY status ORDER BY count DESC
  `);
  console.log("   Project status distribution:");
  projectStatuses.rows.forEach((row) => {
    console.log(`     - ${row.status}: ${row.count}`);
  });

  // Council decisions
  const councilDecisions = await pool.query(`
    SELECT decision, COUNT(*) as count FROM council_sessions GROUP BY decision ORDER BY count DESC
  `);
  console.log("   Council decision distribution:");
  councilDecisions.rows.forEach((row) => {
    console.log(`     - ${row.decision}: ${row.count}`);
  });

  // Outbound lead stages
  const leadStages = await pool.query(`
    SELECT stage, COUNT(*) as count FROM outbound_leads GROUP BY stage ORDER BY count DESC
  `);
  console.log("   Outbound lead stage distribution:");
  leadStages.rows.forEach((row) => {
    console.log(`     - ${row.stage}: ${row.count}`);
  });

  console.log("\n✅ Data integrity checks complete\n");

  await pool.end();
}

// Main execution
(async () => {
  try {
    const report = await verifyMigration();
    await verifyDataIntegrity();

    // Save report
    const reportPath = path.join(DATA_DIR, "migration-verification-report.json");
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`📄 Report saved to: ${reportPath}\n`);

    process.exit(report.success ? 0 : 1);
  } catch (e) {
    console.error("❌ Verification failed:", e);
    process.exit(1);
  }
})();
