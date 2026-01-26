/**
 * AgencyOS - JSON to Supabase Migration Script
 *
 * This script migrates all data from local JSON files to Supabase PostgreSQL.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 *
 * Environment variables required:
 *   AGENCYOS_DATABASE_URL=postgresql://...
 *
 * Options:
 *   --dry-run   Preview changes without committing
 *   --verbose   Show detailed progress
 */

import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const { Pool } = pg;

// Configuration
const DATA_DIR = path.resolve(process.cwd(), "data");
const BACKUP_DIR = path.resolve(DATA_DIR, "backups", `pre-supabase-${new Date().toISOString().replace(/[:.]/g, "-")}`);

const isDryRun = process.argv.includes("--dry-run");
const isVerbose = process.argv.includes("--verbose");

interface MigrationStats {
  table: string;
  inserted: number;
  skipped: number;
  errors: string[];
}

interface MigrationResult {
  success: boolean;
  stats: MigrationStats[];
  totalInserted: number;
  totalErrors: number;
  duration: number;
}

// Initialize database connection
function getPool(): pg.Pool {
  const connectionString = process.env.AGENCYOS_DATABASE_URL;
  if (!connectionString) {
    throw new Error("AGENCYOS_DATABASE_URL environment variable is required");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

// Helper to read JSON file safely
async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  const fullPath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Log helper
function log(message: string, level: "info" | "success" | "error" | "warn" = "info") {
  const prefix = {
    info: "\x1b[36m[INFO]\x1b[0m",
    success: "\x1b[32m[OK]\x1b[0m",
    error: "\x1b[31m[ERROR]\x1b[0m",
    warn: "\x1b[33m[WARN]\x1b[0m",
  };
  console.log(`${prefix[level]} ${message}`);
}

function verbose(message: string) {
  if (isVerbose) {
    console.log(`  \x1b[90m${message}\x1b[0m`);
  }
}

// Backup existing data
async function backupData(): Promise<void> {
  log("Creating backup of existing data...");

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const files = await fs.readdir(DATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith(".json"));

  for (const file of jsonFiles) {
    const src = path.join(DATA_DIR, file);
    const dest = path.join(BACKUP_DIR, file);
    await fs.copyFile(src, dest);
    verbose(`Backed up: ${file}`);
  }

  log(`Backup created at: ${BACKUP_DIR}`, "success");
}

// Migration functions for each data type
async function migrateProjects(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "projects", inserted: 0, skipped: 0, errors: [] };

  try {
    const projects = await readJsonFile<any[]>("projects.json", []);
    log(`Found ${projects.length} projects to migrate`);

    for (const project of projects) {
      const client = await pool.connect();
      try {
        if (!isDryRun) await client.query("BEGIN");

        // Insert project
        await client.query(
          `INSERT INTO projects (id, status, total_billed, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [project.id, project.status || "Intake", project.totalBilled || 0, project.createdAt || new Date().toISOString()]
        );

        // Insert brief
        if (project.brief) {
          await client.query(
            `INSERT INTO project_briefs (project_id, client_name, description, industry, goals, tools, budget, risk_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (project_id) DO UPDATE SET
               client_name = EXCLUDED.client_name,
               description = EXCLUDED.description,
               industry = EXCLUDED.industry,
               goals = EXCLUDED.goals,
               tools = EXCLUDED.tools,
               budget = EXCLUDED.budget,
               risk_level = EXCLUDED.risk_level`,
            [
              project.id,
              project.brief.clientName || "Unknown",
              project.brief.description,
              project.brief.industry,
              project.brief.goals || [],
              project.brief.tools || [],
              project.brief.budget,
              project.brief.riskLevel
            ]
          );
        }

        // Insert workflows
        if (Array.isArray(project.activeWorkflows)) {
          for (const workflow of project.activeWorkflows) {
            await client.query(
              `INSERT INTO project_workflows (id, project_id, name, description, tags, json_url, complexity, credentials, install_plan, deployment)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO NOTHING`,
              [
                workflow.id,
                project.id,
                workflow.name,
                workflow.description,
                workflow.tags || [],
                workflow.jsonUrl,
                workflow.complexity,
                workflow.credentials || [],
                workflow.installPlan || null,
                workflow.deployment || null
              ]
            );
          }
        }

        // Insert documents
        if (Array.isArray(project.documents)) {
          for (const doc of project.documents) {
            await client.query(
              `INSERT INTO project_documents (id, project_id, name, type, status, content, url, amount, external_ref, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO NOTHING`,
              [doc.id, project.id, doc.name, doc.type, doc.status, doc.content, doc.url, doc.amount, doc.externalRef, doc.createdAt]
            );
          }
        }

        // Insert execution logs
        if (Array.isArray(project.executionLogs)) {
          for (const log of project.executionLogs) {
            await client.query(
              `INSERT INTO project_execution_logs (id, project_id, workflow_name, status, error_details, duration, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [log.id, project.id, log.workflowName, log.status, log.errorDetails, log.duration, log.timestamp]
            );
          }
        }

        // Insert incidents
        if (Array.isArray(project.incidents)) {
          for (const incident of project.incidents) {
            await client.query(
              `INSERT INTO project_incidents (id, project_id, title, severity, status, root_cause, resolution_plan, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [incident.id, project.id, incident.title, incident.severity, incident.status, incident.rootCause, incident.resolutionPlan, incident.timestamp]
            );
          }
        }

        // Insert operator chat
        if (Array.isArray(project.operatorChat)) {
          for (const msg of project.operatorChat) {
            await client.query(
              `INSERT INTO project_operator_chat (id, project_id, role, content, tool_call)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING`,
              [msg.id, project.id, msg.role, msg.content, msg.toolCall || null]
            );
          }
        }

        // Insert CRM activities
        if (Array.isArray(project.crmActivities)) {
          for (const activity of project.crmActivities) {
            await client.query(
              `INSERT INTO project_crm_activities (id, project_id, type, subject, status, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO NOTHING`,
              [activity.id, project.id, activity.type, activity.subject, activity.status, activity.timestamp]
            );
          }
        }

        // Insert financials
        if (project.financials) {
          await client.query(
            `INSERT INTO project_financials (project_id, revenue, expenses, hours_saved, cost_per_execution)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (project_id) DO UPDATE SET
               revenue = EXCLUDED.revenue,
               expenses = EXCLUDED.expenses,
               hours_saved = EXCLUDED.hours_saved,
               cost_per_execution = EXCLUDED.cost_per_execution`,
            [project.id, project.financials.revenue || 0, project.financials.expenses || 0,
             project.financials.hoursSaved || 0, project.financials.costPerExecution || 0]
          );
        }

        // Insert governance
        if (project.governance) {
          await client.query(
            `INSERT INTO project_governance (project_id, certified, last_score, verdict)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (project_id) DO UPDATE SET
               certified = EXCLUDED.certified,
               last_score = EXCLUDED.last_score,
               verdict = EXCLUDED.verdict`,
            [project.id, project.governance.certified || false, project.governance.lastScore || 0, project.governance.verdict]
          );
        }

        if (!isDryRun) await client.query("COMMIT");
        stats.inserted++;
        verbose(`Migrated project: ${project.id}`);
      } catch (error: any) {
        if (!isDryRun) await client.query("ROLLBACK");
        stats.errors.push(`Project ${project.id}: ${error.message}`);
        log(`Failed to migrate project ${project.id}: ${error.message}`, "error");
      } finally {
        client.release();
      }
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateCouncilSessions(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "council_sessions", inserted: 0, skipped: 0, errors: [] };

  try {
    const sessions = await readJsonFile<any[]>("council-sessions.json", []);
    log(`Found ${sessions.length} council sessions to migrate`);

    for (const session of sessions) {
      try {
        if (!isDryRun) {
          await pool.query(
            `INSERT INTO council_sessions (
              id, project_id, gate_type, topic, opinions, synthesis, decision, pricing,
              language, board_name, current_stage, board_summary, next_steps, money_steps,
              workflow_suggestions, suggested_catalog_query, model_outputs, chairman_model,
              stage2_rankings, label_to_model, aggregate_rankings, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            ON CONFLICT (id) DO NOTHING`,
            [
              session.id,
              session.projectId,
              session.gateType,
              session.topic,
              JSON.stringify(session.opinions || []),
              session.synthesis,
              session.decision,
              session.pricing ? JSON.stringify(session.pricing) : null,
              session.language,
              session.boardName,
              session.currentStage ? JSON.stringify(session.currentStage) : null,
              session.boardSummary,
              session.nextSteps || [],
              session.moneySteps || [],
              session.workflowSuggestions ? JSON.stringify(session.workflowSuggestions) : null,
              session.suggestedCatalogQuery ? JSON.stringify(session.suggestedCatalogQuery) : null,
              session.modelOutputs ? JSON.stringify(session.modelOutputs) : null,
              session.chairmanModel,
              session.stage2Rankings ? JSON.stringify(session.stage2Rankings) : null,
              session.labelToModel ? JSON.stringify(session.labelToModel) : null,
              session.aggregateRankings ? JSON.stringify(session.aggregateRankings) : null,
              session.createdAt || new Date().toISOString()
            ]
          );
        }
        stats.inserted++;
        verbose(`Migrated council session: ${session.id}`);
      } catch (error: any) {
        stats.errors.push(`Session ${session.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateAssistant(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "assistant_state", inserted: 0, skipped: 0, errors: [] };

  try {
    const assistant = await readJsonFile<any>("assistant.json", {});

    if (assistant.id) {
      log(`Migrating assistant state...`);

      if (!isDryRun) {
        // Insert state
        await pool.query(
          `INSERT INTO assistant_state (id, preferences, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET preferences = $2, updated_at = $3`,
          [assistant.id, JSON.stringify(assistant.preferences || {}), assistant.updatedAt || new Date().toISOString()]
        );

        // Insert messages
        if (Array.isArray(assistant.messages)) {
          for (let i = 0; i < assistant.messages.length; i++) {
            const msg = assistant.messages[i];
            await pool.query(
              `INSERT INTO assistant_messages (id, assistant_state_id, role, content, tool_call, created_at, sequence)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [msg.id, assistant.id, msg.role, msg.content, msg.toolCall ? JSON.stringify(msg.toolCall) : null, msg.createdAt, i]
            );
          }
          log(`Migrated ${assistant.messages.length} assistant messages`, "success");
        }
      }

      stats.inserted = 1;
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateOutboundLeads(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "outbound_leads", inserted: 0, skipped: 0, errors: [] };

  try {
    const leads = await readJsonFile<any[]>("outbound-leads.json", []);
    log(`Found ${leads.length} outbound leads to migrate`);

    for (const lead of leads) {
      try {
        if (!isDryRun) {
          await pool.query(
            `INSERT INTO outbound_leads (
              id, name, category, address, website, phone, maps_url, country, city,
              stage, notes, last_action_at, next_follow_up_at, source, source_ref,
              external_ref, project_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (id) DO NOTHING`,
            [
              lead.id, lead.name, lead.category, lead.address, lead.website, lead.phone,
              lead.mapsUrl, lead.country, lead.city, lead.stage || "New", lead.notes,
              lead.lastActionAt, lead.nextFollowUpAt, lead.source || "manual", lead.sourceRef,
              lead.externalRef ? JSON.stringify(lead.externalRef) : null, lead.projectId,
              lead.createdAt || new Date().toISOString(), lead.updatedAt || new Date().toISOString()
            ]
          );
        }
        stats.inserted++;
        verbose(`Migrated lead: ${lead.id}`);
      } catch (error: any) {
        stats.errors.push(`Lead ${lead.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateAgency(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "agency_state", inserted: 0, skipped: 0, errors: [] };

  try {
    const agency = await readJsonFile<any>("agency.json", {});

    if (agency.goal) {
      log(`Migrating agency state...`);

      if (!isDryRun) {
        // Insert state
        await pool.query(
          `INSERT INTO agency_state (id, goal, completed_task_ids, revenue_goal, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             goal = EXCLUDED.goal,
             completed_task_ids = EXCLUDED.completed_task_ids,
             revenue_goal = EXCLUDED.revenue_goal,
             updated_at = EXCLUDED.updated_at`,
          [
            "default",
            agency.goal,
            agency.completedTaskIds || [],
            JSON.stringify(agency.revenueGoal || {}),
            agency.updatedAt || new Date().toISOString()
          ]
        );

        // Insert documents
        if (Array.isArray(agency.documents)) {
          for (const doc of agency.documents) {
            await pool.query(
              `INSERT INTO agency_documents (id, agency_state_id, type, name, status, content, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [doc.id, "default", doc.type, doc.name, doc.status, doc.content, doc.createdAt]
            );
          }
          log(`Migrated ${agency.documents.length} agency documents`, "success");
        }
      }

      stats.inserted = 1;
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateMarketRadar(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "market_radar_state", inserted: 0, skipped: 0, errors: [] };

  try {
    const radar = await readJsonFile<any>("market-radar.json", {});

    log(`Migrating market radar state...`);

    if (!isDryRun) {
      // Insert state
      await pool.query(
        `INSERT INTO market_radar_state (id, country, city, niche, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           country = EXCLUDED.country,
           city = EXCLUDED.city,
           niche = EXCLUDED.niche,
           updated_at = EXCLUDED.updated_at`,
        ["default", radar.country, radar.city, radar.niche, radar.updatedAt || new Date().toISOString()]
      );

      // Insert opportunities
      if (Array.isArray(radar.opportunities)) {
        for (const opp of radar.opportunities) {
          await pool.query(
            `INSERT INTO market_opportunities (id, market_radar_id, niche, ideal_customer, pain_points, offer, suggested_catalog_query, suggested_tags, pricing_hint, pricing, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [opp.id, "default", opp.niche, opp.idealCustomer, opp.painPoints || [], opp.offer,
             opp.suggestedCatalogQuery, opp.suggestedTags || [], opp.pricingHint,
             opp.pricing ? JSON.stringify(opp.pricing) : null, opp.source]
          );
        }
      }

      // Insert YouTube trends
      if (Array.isArray(radar.youtubeTrends)) {
        for (const trend of radar.youtubeTrends) {
          await pool.query(
            `INSERT INTO market_youtube_trends (id, market_radar_id, title, url, channel, published_at, views, source, raw)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`,
            [trend.id, "default", trend.title, trend.url, trend.channel, trend.publishedAt, trend.views, trend.source, trend.raw ? JSON.stringify(trend.raw) : null]
          );
        }
      }

      // Insert YouTube ideas
      if (Array.isArray(radar.youtubeIdeas)) {
        for (const idea of radar.youtubeIdeas) {
          await pool.query(
            `INSERT INTO market_youtube_ideas (id, market_radar_id, title, hook, angle, outline, cta, keywords)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [idea.id, "default", idea.title, idea.hook, idea.angle, idea.outline || [], idea.cta, idea.keywords || []]
          );
        }
      }

      // Insert internet trends
      if (Array.isArray(radar.internetTrends)) {
        for (const trend of radar.internetTrends) {
          await pool.query(
            `INSERT INTO market_internet_trends (id, market_radar_id, provider, title, url, description, score, source, raw)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`,
            [trend.id, "default", trend.provider, trend.title, trend.url, trend.description, trend.score || 0, trend.source, trend.raw ? JSON.stringify(trend.raw) : null]
          );
        }
      }

      // Insert leads
      if (Array.isArray(radar.leads)) {
        for (const lead of radar.leads) {
          await pool.query(
            `INSERT INTO market_leads (id, market_radar_id, name, category, address, website, phone, rating, reviews, maps_url, source, raw)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING`,
            [lead.id, "default", lead.name, lead.category, lead.address, lead.website, lead.phone, lead.rating, lead.reviews, lead.mapsUrl, lead.source, lead.raw ? JSON.stringify(lead.raw) : null]
          );
        }
      }
    }

    stats.inserted = 1;
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateSettings(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "runtime_settings", inserted: 0, skipped: 0, errors: [] };

  try {
    const settings = await readJsonFile<any>("settings.json", {});

    log(`Migrating runtime settings...`);

    if (!isDryRun && settings.activeEnvironment) {
      await pool.query(
        `INSERT INTO runtime_settings (
          id, active_environment, n8n_base_url, suitecrm_base_url, invoiceshelf_base_url,
          documenso_base_url, infisical_base_url, infisical_workspace_id, infisical_secret_path,
          infisical_env_development_slug, infisical_env_staging_slug, infisical_env_production_slug,
          council_models, council_chairman_model, council_stage2_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          active_environment = EXCLUDED.active_environment,
          n8n_base_url = EXCLUDED.n8n_base_url,
          suitecrm_base_url = EXCLUDED.suitecrm_base_url,
          invoiceshelf_base_url = EXCLUDED.invoiceshelf_base_url,
          documenso_base_url = EXCLUDED.documenso_base_url,
          infisical_base_url = EXCLUDED.infisical_base_url,
          infisical_workspace_id = EXCLUDED.infisical_workspace_id,
          infisical_secret_path = EXCLUDED.infisical_secret_path,
          infisical_env_development_slug = EXCLUDED.infisical_env_development_slug,
          infisical_env_staging_slug = EXCLUDED.infisical_env_staging_slug,
          infisical_env_production_slug = EXCLUDED.infisical_env_production_slug,
          council_models = EXCLUDED.council_models,
          council_chairman_model = EXCLUDED.council_chairman_model,
          council_stage2_enabled = EXCLUDED.council_stage2_enabled`,
        [
          "default",
          settings.activeEnvironment,
          settings.n8nBaseUrl,
          settings.suitecrmBaseUrl,
          settings.invoiceshelfBaseUrl,
          settings.documensoBaseUrl,
          settings.infisicalBaseUrl,
          settings.infisicalWorkspaceId,
          settings.infisicalSecretPath,
          settings.infisicalEnvDevelopmentSlug,
          settings.infisicalEnvStagingSlug,
          settings.infisicalEnvProductionSlug,
          settings.councilModels,
          settings.councilChairmanModel,
          settings.councilStage2Enabled || false
        ]
      );
      stats.inserted = 1;
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

async function migrateSecrets(pool: pg.Pool): Promise<MigrationStats> {
  const stats: MigrationStats = { table: "secrets", inserted: 0, skipped: 0, errors: [] };

  try {
    const secrets = await readJsonFile<any[]>("secrets.json", []);
    log(`Found ${secrets.length} secrets to migrate`);

    for (const secret of secrets) {
      try {
        if (!isDryRun) {
          await pool.query(
            `INSERT INTO secrets (id, key, value, environment, last_updated)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               key = EXCLUDED.key,
               value = EXCLUDED.value,
               environment = EXCLUDED.environment,
               last_updated = EXCLUDED.last_updated`,
            [secret.id, secret.key, secret.value, secret.environment || "Production", secret.lastUpdated || new Date().toISOString()]
          );
        }
        stats.inserted++;
        verbose(`Migrated secret: ${secret.key}`);
      } catch (error: any) {
        stats.errors.push(`Secret ${secret.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    stats.errors.push(`Migration error: ${error.message}`);
  }

  return stats;
}

// Main migration function
async function runMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const results: MigrationStats[] = [];

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       AgencyOS - JSON to Supabase Migration Script           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  if (isDryRun) {
    log("DRY RUN MODE - No changes will be committed", "warn");
    console.log("");
  }

  let pool: pg.Pool;
  try {
    pool = getPool();
    // Test connection
    await pool.query("SELECT 1");
    log("Connected to Supabase PostgreSQL", "success");
  } catch (error: any) {
    log(`Failed to connect to database: ${error.message}`, "error");
    return {
      success: false,
      stats: [],
      totalInserted: 0,
      totalErrors: 1,
      duration: Date.now() - startTime
    };
  }

  try {
    // Backup first
    await backupData();
    console.log("");

    // Run migrations
    log("Starting migration...");
    console.log("");

    results.push(await migrateProjects(pool));
    results.push(await migrateCouncilSessions(pool));
    results.push(await migrateAssistant(pool));
    results.push(await migrateOutboundLeads(pool));
    results.push(await migrateAgency(pool));
    results.push(await migrateMarketRadar(pool));
    results.push(await migrateSettings(pool));
    results.push(await migrateSecrets(pool));

    // Print summary
    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════");
    console.log("                     MIGRATION SUMMARY                          ");
    console.log("════════════════════════════════════════════════════════════════");

    let totalInserted = 0;
    let totalErrors = 0;

    for (const stat of results) {
      const status = stat.errors.length === 0 ? "\x1b[32m✓\x1b[0m" : "\x1b[33m⚠\x1b[0m";
      console.log(`${status} ${stat.table.padEnd(25)} Inserted: ${stat.inserted.toString().padStart(5)}  Errors: ${stat.errors.length}`);
      totalInserted += stat.inserted;
      totalErrors += stat.errors.length;
    }

    console.log("────────────────────────────────────────────────────────────────");
    console.log(`   TOTAL                      Inserted: ${totalInserted.toString().padStart(5)}  Errors: ${totalErrors}`);
    console.log("════════════════════════════════════════════════════════════════");

    const duration = Date.now() - startTime;

    if (totalErrors === 0) {
      console.log("");
      log(`Migration completed successfully in ${(duration / 1000).toFixed(2)}s`, "success");
      if (!isDryRun) {
        log("All data has been migrated to Supabase!", "success");
      }
    } else {
      console.log("");
      log(`Migration completed with ${totalErrors} errors in ${(duration / 1000).toFixed(2)}s`, "warn");
      console.log("");
      console.log("Errors:");
      for (const stat of results) {
        for (const err of stat.errors) {
          console.log(`  - ${err}`);
        }
      }
    }

    return {
      success: totalErrors === 0,
      stats: results,
      totalInserted,
      totalErrors,
      duration
    };

  } finally {
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    log(`Fatal error: ${error.message}`, "error");
    process.exit(1);
  });
