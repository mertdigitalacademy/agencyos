-- ============================================================================
-- AGENCYOS - SUPABASE POSTGRESQL SCHEMA
-- Version: 1.0.0
-- Description: Complete database schema for Netlify + Supabase migration
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- ============================================================================
-- 1. USERS TABLE (for Supabase Auth integration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. PROJECTS TABLE (replaces projects.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Intake' CHECK (status IN ('Intake', 'Proposal', 'Developing', 'Testing', 'Live')),
    total_billed NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- Project Brief (child table)
CREATE TABLE IF NOT EXISTS project_briefs (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    description TEXT,
    industry TEXT,
    goals TEXT[] DEFAULT '{}',
    tools TEXT[] DEFAULT '{}',
    budget TEXT,
    risk_level TEXT CHECK (risk_level IN ('Low', 'Medium', 'High'))
);

-- Project Workflows
CREATE TABLE IF NOT EXISTS project_workflows (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    json_url TEXT,
    complexity TEXT CHECK (complexity IN ('Low', 'Medium', 'High')),
    credentials TEXT[] DEFAULT '{}',
    install_plan JSONB,
    deployment JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_workflows_project ON project_workflows(project_id);

-- Project Documents
CREATE TABLE IF NOT EXISTS project_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Proposal', 'SOW', 'Invoice', 'Contract', 'Report')),
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Sent', 'Signed', 'Paid')),
    content TEXT,
    url TEXT,
    amount NUMERIC(12, 2),
    external_ref JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_documents_project ON project_documents(project_id);

-- Project Execution Logs
CREATE TABLE IF NOT EXISTS project_execution_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Success', 'Error')),
    error_details TEXT,
    duration TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_logs_project ON project_execution_logs(project_id);

-- Project Incidents
CREATE TABLE IF NOT EXISTS project_incidents (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    status TEXT NOT NULL CHECK (status IN ('Open', 'Investigating', 'Resolved')),
    root_cause TEXT,
    resolution_plan TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_incidents_project ON project_incidents(project_id);

-- Project Operator Chat
CREATE TABLE IF NOT EXISTS project_operator_chat (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_call JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_chat_project ON project_operator_chat(project_id);

-- Project CRM Activities
CREATE TABLE IF NOT EXISTS project_crm_activities (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Call', 'Meeting', 'Email', 'Note', 'Status Change')),
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Completed', 'Scheduled', 'Pending', 'Draft')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_crm_project ON project_crm_activities(project_id);

-- Project Financials
CREATE TABLE IF NOT EXISTS project_financials (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    revenue NUMERIC(12, 2) DEFAULT 0,
    expenses NUMERIC(12, 2) DEFAULT 0,
    hours_saved NUMERIC(10, 2) DEFAULT 0,
    cost_per_execution NUMERIC(12, 2) DEFAULT 0
);

-- Project Governance
CREATE TABLE IF NOT EXISTS project_governance (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    certified BOOLEAN DEFAULT FALSE,
    last_score INTEGER DEFAULT 0,
    verdict TEXT CHECK (verdict IN ('Approved', 'Risk', 'None'))
);

-- ============================================================================
-- 3. COUNCIL SESSIONS TABLE (replaces council-sessions.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS council_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    gate_type TEXT NOT NULL CHECK (gate_type IN ('Strategic', 'Risk', 'Launch', 'Post-Mortem')),
    topic TEXT NOT NULL,
    opinions JSONB NOT NULL DEFAULT '[]',
    synthesis TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('Approved', 'Rejected', 'Needs Revision')),
    pricing JSONB,
    language TEXT CHECK (language IN ('tr', 'en')),
    board_name TEXT,
    current_stage JSONB,
    board_summary TEXT,
    next_steps TEXT[] DEFAULT '{}',
    money_steps TEXT[] DEFAULT '{}',
    workflow_suggestions JSONB,
    suggested_catalog_query JSONB,
    model_outputs JSONB,
    chairman_model TEXT,
    stage2_rankings JSONB,
    label_to_model JSONB,
    aggregate_rankings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_council_user ON council_sessions(user_id);
CREATE INDEX idx_council_project ON council_sessions(project_id);
CREATE INDEX idx_council_gate ON council_sessions(gate_type);
CREATE INDEX idx_council_created ON council_sessions(created_at DESC);

-- ============================================================================
-- 4. COUNCIL JOBS TABLE (for background queue processing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS council_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('council_run', 'council_playground', 'doc_generate')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    input JSONB NOT NULL,
    result JSONB,
    error TEXT,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_council_jobs_user ON council_jobs(user_id);
CREATE INDEX idx_council_jobs_status ON council_jobs(status);
CREATE INDEX idx_council_jobs_created ON council_jobs(created_at DESC);

-- ============================================================================
-- 5. ASSISTANT STATE (replaces assistant.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    assistant_state_id TEXT NOT NULL REFERENCES assistant_state(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_call JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence INTEGER
);

CREATE INDEX idx_assistant_messages_state ON assistant_messages(assistant_state_id, sequence);

-- ============================================================================
-- 6. OUTBOUND LEADS (replaces outbound-leads.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS outbound_leads (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    address TEXT,
    website TEXT,
    phone TEXT,
    maps_url TEXT,
    country TEXT,
    city TEXT,
    stage TEXT NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Replied', 'Booked', 'Proposal', 'Won', 'Lost')),
    notes TEXT,
    last_action_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    source TEXT NOT NULL CHECK (source IN ('market_radar', 'manual')),
    source_ref TEXT,
    external_ref JSONB,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbound_leads_user ON outbound_leads(user_id);
CREATE INDEX idx_outbound_leads_stage ON outbound_leads(stage);
CREATE INDEX idx_outbound_leads_source ON outbound_leads(source);
CREATE INDEX idx_outbound_leads_project ON outbound_leads(project_id);

-- ============================================================================
-- 7. AGENCY STATE (replaces agency.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agency_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT NOT NULL DEFAULT 'ai_agency' CHECK (goal IN ('ai_agency', 'automation_agency', 'web_design_agency', 'ads_agency', 'youtube_systems')),
    completed_task_ids TEXT[] DEFAULT '{}',
    revenue_goal JSONB DEFAULT '{"currency": "USD", "targetMrr": 5000, "avgRetainer": 800, "closeRatePct": 25, "bookingRatePct": 15}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_documents (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    agency_state_id TEXT NOT NULL REFERENCES agency_state(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('RevenuePlan', 'Offer', 'SalesPath', 'OutboundPlaybook', 'YouTubeSystem', 'IncomeStack', 'PassiveIncome')),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agency_documents_state ON agency_documents(agency_state_id);

-- ============================================================================
-- 8. MARKET RADAR STATE (replaces market-radar.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_radar_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    country TEXT DEFAULT 'Turkey',
    city TEXT DEFAULT 'Istanbul',
    niche TEXT DEFAULT 'AI automation for local businesses',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_opportunities (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    market_radar_id TEXT NOT NULL REFERENCES market_radar_state(id) ON DELETE CASCADE,
    niche TEXT NOT NULL,
    ideal_customer TEXT,
    pain_points TEXT[] DEFAULT '{}',
    offer TEXT,
    suggested_catalog_query TEXT,
    suggested_tags TEXT[] DEFAULT '{}',
    pricing_hint TEXT,
    pricing JSONB,
    source TEXT CHECK (source IN ('mock', 'apify', 'ai', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_opportunities_radar ON market_opportunities(market_radar_id);

CREATE TABLE IF NOT EXISTS market_youtube_trends (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    market_radar_id TEXT NOT NULL REFERENCES market_radar_state(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    channel TEXT,
    published_at TEXT,
    views BIGINT,
    source TEXT CHECK (source IN ('mock', 'apify', 'ai', 'web')),
    raw JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_youtube_radar ON market_youtube_trends(market_radar_id);

CREATE TABLE IF NOT EXISTS market_youtube_ideas (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    market_radar_id TEXT NOT NULL REFERENCES market_radar_state(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    hook TEXT,
    angle TEXT,
    outline TEXT[] DEFAULT '{}',
    cta TEXT,
    keywords TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_ideas_radar ON market_youtube_ideas(market_radar_id);

CREATE TABLE IF NOT EXISTS market_internet_trends (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    market_radar_id TEXT NOT NULL REFERENCES market_radar_state(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('HackerNews', 'GitHubTrending')),
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    score INTEGER DEFAULT 0,
    source TEXT CHECK (source IN ('mock', 'apify', 'ai', 'web')),
    raw JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_internet_radar ON market_internet_trends(market_radar_id);

CREATE TABLE IF NOT EXISTS market_leads (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    market_radar_id TEXT NOT NULL REFERENCES market_radar_state(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    address TEXT,
    website TEXT,
    phone TEXT,
    rating NUMERIC(3, 1),
    reviews INTEGER,
    maps_url TEXT,
    source TEXT CHECK (source IN ('mock', 'apify', 'ai', 'web')),
    raw JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_leads_radar ON market_leads(market_radar_id);

-- ============================================================================
-- 9. RUNTIME SETTINGS (replaces settings.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS runtime_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    active_environment TEXT NOT NULL DEFAULT 'Production' CHECK (active_environment IN ('Development', 'Staging', 'Production')),
    n8n_base_url TEXT DEFAULT 'http://localhost:5678',
    suitecrm_base_url TEXT,
    invoiceshelf_base_url TEXT,
    documenso_base_url TEXT,
    infisical_base_url TEXT,
    infisical_workspace_id TEXT,
    infisical_secret_path TEXT DEFAULT '/',
    infisical_env_development_slug TEXT DEFAULT 'dev',
    infisical_env_staging_slug TEXT DEFAULT 'staging',
    infisical_env_production_slug TEXT DEFAULT 'prod',
    council_models TEXT,
    council_chairman_model TEXT,
    council_stage2_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. SECRETS (replaces secrets.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'Production' CHECK (environment IN ('Development', 'Staging', 'Production')),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, key, environment)
);

CREATE INDEX idx_secrets_user ON secrets(user_id);
CREATE INDEX idx_secrets_environment ON secrets(environment);

-- ============================================================================
-- 11. AGENCY BUILDER STATE (replaces agency-builder state in agencyBuilder.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agency_builder_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    current_step TEXT DEFAULT 'sector' CHECK (current_step IN ('sector', 'niche', 'solution', 'customize', 'deploy')),
    selected_sector_id TEXT,
    selected_niche_id TEXT,
    target_region TEXT,
    solution JSONB,
    customizations JSONB,
    deployment_status JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 12. PROPOSALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_company TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'TRY', 'EUR', 'GBP')),
    tiers JSONB DEFAULT '[]',
    selected_tier_id TEXT,
    scope JSONB,
    terms JSONB,
    valid_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired')),
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    external_ref JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposals_user ON proposals(user_id);
CREATE INDEX idx_proposals_status ON proposals(status);

-- ============================================================================
-- 13. FINANCIAL TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Invoice', 'Payment', 'Expense', 'Refund')),
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'TRY', 'EUR', 'GBP')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Cancelled')),
    description TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    client_name TEXT,
    invoice_ref TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON financial_transactions(user_id);
CREATE INDEX idx_transactions_type ON financial_transactions(type);
CREATE INDEX idx_transactions_project ON financial_transactions(project_id);

-- ============================================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER outbound_leads_updated_at BEFORE UPDATE ON outbound_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agency_state_updated_at BEFORE UPDATE ON agency_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER market_radar_state_updated_at BEFORE UPDATE ON market_radar_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER runtime_settings_updated_at BEFORE UPDATE ON runtime_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER assistant_state_updated_at BEFORE UPDATE ON assistant_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agency_builder_state_updated_at BEFORE UPDATE ON agency_builder_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_operator_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_radar_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_youtube_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_youtube_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_internet_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_builder_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Project briefs policies (cascade from projects)
CREATE POLICY "Users can view own project briefs" ON project_briefs
    FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_briefs.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can insert own project briefs" ON project_briefs
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_briefs.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update own project briefs" ON project_briefs
    FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_briefs.project_id AND projects.user_id = auth.uid()));

-- Project workflows policies
CREATE POLICY "Users can manage own project workflows" ON project_workflows
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_workflows.project_id AND projects.user_id = auth.uid()));

-- Project documents policies
CREATE POLICY "Users can manage own project documents" ON project_documents
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_documents.project_id AND projects.user_id = auth.uid()));

-- Project execution logs policies
CREATE POLICY "Users can manage own project logs" ON project_execution_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_execution_logs.project_id AND projects.user_id = auth.uid()));

-- Project incidents policies
CREATE POLICY "Users can manage own project incidents" ON project_incidents
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_incidents.project_id AND projects.user_id = auth.uid()));

-- Project chat policies
CREATE POLICY "Users can manage own project chat" ON project_operator_chat
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_operator_chat.project_id AND projects.user_id = auth.uid()));

-- Project CRM policies
CREATE POLICY "Users can manage own project CRM" ON project_crm_activities
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_crm_activities.project_id AND projects.user_id = auth.uid()));

-- Project financials policies
CREATE POLICY "Users can manage own project financials" ON project_financials
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_financials.project_id AND projects.user_id = auth.uid()));

-- Project governance policies
CREATE POLICY "Users can manage own project governance" ON project_governance
    FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_governance.project_id AND projects.user_id = auth.uid()));

-- Council sessions policies
CREATE POLICY "Users can manage own council sessions" ON council_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Council jobs policies
CREATE POLICY "Users can manage own council jobs" ON council_jobs
    FOR ALL USING (auth.uid() = user_id);

-- Assistant state policies
CREATE POLICY "Users can manage own assistant state" ON assistant_state
    FOR ALL USING (auth.uid() = user_id);

-- Assistant messages policies
CREATE POLICY "Users can manage own assistant messages" ON assistant_messages
    FOR ALL USING (EXISTS (SELECT 1 FROM assistant_state WHERE assistant_state.id = assistant_messages.assistant_state_id AND assistant_state.user_id = auth.uid()));

-- Outbound leads policies
CREATE POLICY "Users can manage own leads" ON outbound_leads
    FOR ALL USING (auth.uid() = user_id);

-- Agency state policies
CREATE POLICY "Users can manage own agency state" ON agency_state
    FOR ALL USING (auth.uid() = user_id);

-- Agency documents policies
CREATE POLICY "Users can manage own agency documents" ON agency_documents
    FOR ALL USING (EXISTS (SELECT 1 FROM agency_state WHERE agency_state.id = agency_documents.agency_state_id AND agency_state.user_id = auth.uid()));

-- Market radar state policies
CREATE POLICY "Users can manage own market radar" ON market_radar_state
    FOR ALL USING (auth.uid() = user_id);

-- Market opportunities policies
CREATE POLICY "Users can manage own market opportunities" ON market_opportunities
    FOR ALL USING (EXISTS (SELECT 1 FROM market_radar_state WHERE market_radar_state.id = market_opportunities.market_radar_id AND market_radar_state.user_id = auth.uid()));

-- Market YouTube trends policies
CREATE POLICY "Users can manage own YouTube trends" ON market_youtube_trends
    FOR ALL USING (EXISTS (SELECT 1 FROM market_radar_state WHERE market_radar_state.id = market_youtube_trends.market_radar_id AND market_radar_state.user_id = auth.uid()));

-- Market YouTube ideas policies
CREATE POLICY "Users can manage own YouTube ideas" ON market_youtube_ideas
    FOR ALL USING (EXISTS (SELECT 1 FROM market_radar_state WHERE market_radar_state.id = market_youtube_ideas.market_radar_id AND market_radar_state.user_id = auth.uid()));

-- Market internet trends policies
CREATE POLICY "Users can manage own internet trends" ON market_internet_trends
    FOR ALL USING (EXISTS (SELECT 1 FROM market_radar_state WHERE market_radar_state.id = market_internet_trends.market_radar_id AND market_radar_state.user_id = auth.uid()));

-- Market leads policies
CREATE POLICY "Users can manage own market leads" ON market_leads
    FOR ALL USING (EXISTS (SELECT 1 FROM market_radar_state WHERE market_radar_state.id = market_leads.market_radar_id AND market_radar_state.user_id = auth.uid()));

-- Runtime settings policies
CREATE POLICY "Users can manage own settings" ON runtime_settings
    FOR ALL USING (auth.uid() = user_id);

-- Secrets policies
CREATE POLICY "Users can manage own secrets" ON secrets
    FOR ALL USING (auth.uid() = user_id);

-- Agency builder state policies
CREATE POLICY "Users can manage own agency builder state" ON agency_builder_state
    FOR ALL USING (auth.uid() = user_id);

-- Proposals policies
CREATE POLICY "Users can manage own proposals" ON proposals
    FOR ALL USING (auth.uid() = user_id);

-- Financial transactions policies
CREATE POLICY "Users can manage own transactions" ON financial_transactions
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- ENABLE REALTIME FOR COUNCIL JOBS (for status polling)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE council_jobs;

-- ============================================================================
-- SEED: Create default states for new users (via trigger)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_user_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default assistant state
    INSERT INTO assistant_state (id, user_id, preferences)
    VALUES (NEW.id::TEXT, NEW.id, '{"language": "tr"}');

    -- Create default agency state
    INSERT INTO agency_state (id, user_id, goal)
    VALUES (NEW.id::TEXT, NEW.id, 'ai_agency');

    -- Create default market radar state
    INSERT INTO market_radar_state (id, user_id)
    VALUES (NEW.id::TEXT, NEW.id);

    -- Create default runtime settings
    INSERT INTO runtime_settings (id, user_id)
    VALUES (NEW.id::TEXT, NEW.id);

    -- Create default agency builder state
    INSERT INTO agency_builder_state (id, user_id)
    VALUES (NEW.id::TEXT, NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_defaults();

-- ============================================================================
-- HELPER FUNCTION: Create user on auth signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user record when auth.users is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Full text search on projects
CREATE INDEX idx_projects_fulltext ON projects USING gin(to_tsvector('english', id));

-- JSONB indexes
CREATE INDEX idx_council_sessions_opinions ON council_sessions USING gin(opinions);
CREATE INDEX idx_agency_state_revenue_goal ON agency_state USING gin(revenue_goal);

-- ============================================================================
-- COMPLETE!
-- Run this SQL in Supabase SQL Editor to create all tables
-- ============================================================================
