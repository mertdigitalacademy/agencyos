
import React, { useState, useEffect } from 'react';
import { View, Project, ProjectBrief, CouncilSession, AgencySecret, Lead, WorkspaceType, AppNotification, TeamMember, SystemEvent, ProjectTab, OutboundLead, Proposal } from './types';
import { NAV_ITEMS } from './constants';
import Dashboard from './components/Dashboard';
import DashboardSimple from './components/DashboardSimple';
import Home from './components/Home';
import Money from './components/Money';
import IntakeWizard from './components/IntakeWizard';
import WorkflowCatalog from './components/WorkflowCatalog';
import CouncilRoom from './components/CouncilRoom';
import CouncilRoomSimple from './components/CouncilRoomSimple';
import Sidebar from './components/Sidebar';
import ProjectDetail from './components/ProjectDetail';
import DocumentsView from './components/DocumentsView';
import SetupWizard from './components/SetupWizard';
import SetupWizardSimple from './components/SetupWizardSimple';
import RevenueJourney from './components/RevenueJourney';
import AgencySettings from './components/AgencySettings';
import ClientDashboard from './components/ClientDashboard';
import LandingPage from './components/LandingPage';
import AgencyAssistant from './components/AgencyAssistant';
import PassiveIncomeHub from './components/PassiveIncomeHub';
import BoardStudioPage from './components/BoardStudioPage';
import AgencyBuilder from './components/AgencyBuilder';
import ProposalBuilder from './components/ProposalBuilder';
import SalesPipeline from './components/SalesPipeline';
import GuidedJourney from './components/GuidedJourney';
import { createProject as apiCreateProject, getN8nIntegrationStatus, getProjects as apiGetProjects, listCouncilSessions, saveProject as apiSaveProject, seedDemoProjects as apiSeedDemoProjects } from './services/api';
import { readOnboardingState, type UIMode } from './services/onboarding';
import { useI18n } from './services/i18n';
import { useAuth } from './src/components/Auth/AuthContext';
import { Login } from './src/components/Auth/Login';

const App: React.FC = () => {
  const { language, tt } = useI18n();
  const { isAuthenticated, isLoading, isSupabaseEnabled, user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>(View.LANDING);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>(WorkspaceType.AGENCY);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>(() => [
    {
      id: 'ev-1',
      type: 'Success',
      message: tt('Agency Cluster Node-01 Handshake Stable', 'Ajans Cluster Node-01 bağlantısı stabil'),
      timestamp: new Date().toISOString(),
    },
    {
      id: 'ev-2',
      type: 'Info',
      message: tt('Infisical Secrets Rotation Scheduled for T-24h', 'Infisical secret rotation T-24h planlandı'),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: 'tm-1', name: 'Board AI', role: 'Chairman', type: 'AI', avatar: '🏛️', specialization: ['Governance', 'Risk'], status: 'Online' },
    { id: 'tm-2', name: 'Dev-Bot', role: 'Architect', type: 'AI', avatar: '🤖', specialization: ['n8n', 'NodeJS', 'Python'], status: 'Online' },
    { id: 'tm-3', name: 'Ece Demir', role: 'Solutions Expert', type: 'Human', avatar: '👩‍💻', specialization: ['CRM', 'Client Success'], status: 'Busy' }
  ]);
  const [leads, setLeads] = useState<Lead[]>(() => [
    {
      id: 'l1',
      source: 'Typeform',
      clientName: 'Globex Corp',
      brief: tt('Wants to automate customer support with AI ticketing.', 'AI destekli ticketing ile müşteri desteğini otomatikleştirmek istiyor.'),
      timestamp: new Date().toISOString(),
      aiScore: 88,
    },
    {
      id: 'l2',
      source: 'LinkedIn',
      clientName: 'Stark Ind.',
      brief: tt('Need supply chain monitoring workflow via n8n.', 'n8n ile tedarik zinciri izleme workflow’u istiyor.'),
      timestamp: new Date().toISOString(),
      aiScore: 94,
    },
  ]);

  // Outbound leads for sales pipeline
  const [outboundLeads, setOutboundLeads] = useState<OutboundLead[]>(() => {
    const saved = localStorage.getItem('agencyos_outbound_leads');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'ol-1', name: 'TechStart Inc', category: 'SaaS', city: 'San Francisco', country: 'USA', stage: 'New', source: 'market_radar', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ol-2', name: 'HealthPro Clinic', category: 'Healthcare', city: 'Austin', country: 'USA', stage: 'Contacted', source: 'market_radar', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ol-3', name: 'RetailMax', category: 'E-commerce', city: 'New York', country: 'USA', stage: 'Replied', source: 'market_radar', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ol-4', name: 'AutoMotive Pro', category: 'Automotive', city: 'Detroit', country: 'USA', stage: 'Booked', source: 'market_radar', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ol-5', name: 'FinServe Bank', category: 'Finance', city: 'Chicago', country: 'USA', stage: 'Proposal', source: 'market_radar', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'ol-6', name: 'CloudSoft Solutions', category: 'Technology', city: 'Seattle', country: 'USA', stage: 'Won', source: 'market_radar', createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
    ];
  });

  // Proposals state
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    const saved = localStorage.getItem('agencyos_proposals');
    if (saved) return JSON.parse(saved);
    return [];
  });

  // Persist outbound leads
  useEffect(() => {
    localStorage.setItem('agencyos_outbound_leads', JSON.stringify(outboundLeads));
  }, [outboundLeads]);

  // Persist proposals
  useEffect(() => {
    localStorage.setItem('agencyos_proposals', JSON.stringify(proposals));
  }, [proposals]);

  const handleLeadStageChange = (leadId: string, newStage: OutboundLead['stage']) => {
    setOutboundLeads(prev => prev.map(lead =>
      lead.id === leadId ? { ...lead, stage: newStage, updatedAt: new Date().toISOString() } : lead
    ));
  };

  const [councilSessions, setCouncilSessions] = useState<CouncilSession[]>([]);
  const [secrets, setSecrets] = useState<AgencySecret[]>([
    { id: '1', key: 'N8N_API_KEY', value: '••••••••••••••••', environment: 'Production', lastUpdated: new Date().toISOString() },
    { id: '2', key: 'GEMINI_API_KEY', value: '••••••••••••••••', environment: 'Production', lastUpdated: new Date().toISOString() }
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectTab, setSelectedProjectTab] = useState<ProjectTab | null>(null);
  const [catalogPrefill, setCatalogPrefill] = useState<{ query: string; requiredTags?: string[] } | null>(null);
  const [initialIntakeValue, setInitialIntakeValue] = useState('');
  const [n8nHeader, setN8nHeader] = useState<{ connected: boolean; baseUrl: string; reason?: string } | null>(null);
  const [uiMode, setUiMode] = useState<UIMode>('simple');
  const [assistantPrefill, setAssistantPrefill] = useState<{ text: string; autoSend: boolean } | null>(null);
  const [boardStudioReturnView, setBoardStudioReturnView] = useState<View>(View.DASHBOARD);

  const openAssistant = (prompt?: string, autoSend = true) => {
    const text = String(prompt ?? '').trim();
    setAssistantPrefill(text ? { text, autoSend } : null);
    setCurrentView(View.ASSISTANT);
  };

  useEffect(() => {
    if (uiMode !== 'advanced') {
      setN8nHeader(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getN8nIntegrationStatus();
        if (!cancelled) setN8nHeader(res);
      } catch {
        if (!cancelled) setN8nHeader({ connected: false, baseUrl: 'http://localhost:5678', reason: 'API offline' });
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [uiMode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const sessions = await listCouncilSessions();
        if (!cancelled) setCouncilSessions(sessions);
      } catch {
        // API not running; keep local state only
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const remote = await apiGetProjects();
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length === 0) {
          const seeded = await apiSeedDemoProjects().catch(() => null);
          if (!cancelled && seeded?.projects) setProjects(seeded.projects);
          else setProjects(remote);
          return;
        }
        setProjects(remote);
      } catch {
        // API not running; keep local state only
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const s = readOnboardingState();
      setUiMode(s.uiMode);
    } catch {
      // ignore
    }
  }, []);

  const addNotification = (type: AppNotification['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, type, message, timestamp: new Date().toISOString() }, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const addSystemEvent = (type: SystemEvent['type'], message: string, projectRef?: string) => {
    const id = `ev-${Date.now()}`;
    setSystemEvents(prev => [{ id, type, message, timestamp: new Date().toISOString(), projectRef }, ...prev].slice(0, 50));
  };

  const handleSeedDemo = async (): Promise<boolean> => {
    try {
      const out = await apiSeedDemoProjects();
      setProjects(out.projects);
      if (out.createdIds.length > 0) {
        addNotification('success', tt(`Loaded ${out.createdIds.length} demo client(s).`, `${out.createdIds.length} demo müşteri yüklendi.`));
      } else {
        addNotification('info', tt('Demo clients already loaded.', 'Demo müşteriler zaten yüklü.'));
      }
      return true;
    } catch (e) {
      addNotification('error', e instanceof Error ? e.message : tt('Failed to load demo clients', 'Demo müşteriler yüklenemedi'));
      return false;
    }
  };

  const addProject = (brief: ProjectBrief) => {
    const fallbackCreate = () => {
      const newProject: Project = {
        id: brief.id,
        brief,
        status: 'Intake',
        activeWorkflows: [],
        documents: [],
        executionLogs: [],
        incidents: [],
        crmActivities: [
          { id: 'crm-1', type: 'Note', subject: tt('Project initialized from Intake Wizard', 'Intake Wizard ile proje başlatıldı'), status: 'Completed', timestamp: new Date().toISOString() }
        ],
        operatorChat: [{
          id: 'sys-1',
          role: 'system',
          content: tt(
            `Operator initialized for ${brief.clientName}. I am connected to your n8n MCP server cluster.`,
            `Operatör ${brief.clientName} için hazır. n8n MCP server cluster’ına bağlıyım.`,
          )
        }],
        financials: {
          revenue: 0,
          expenses: 0,
          hoursSaved: 0,
          costPerExecution: 0
        },
        governance: {
          certified: false,
          lastScore: 0,
          verdict: 'None'
        },
        totalBilled: 0,
        createdAt: new Date().toISOString()
      };
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    };

    (async () => {
      let project: Project;
      try {
        project = await apiCreateProject(brief);
        setProjects(prev => [project, ...prev.filter(p => p.id !== project.id)]);
      } catch {
        project = fallbackCreate();
      }

      setInitialIntakeValue('');
      setSelectedProjectId(project.id);
      setSelectedProjectTab('Workflows');
      setCurrentView(View.PROJECT_DETAIL);
      addNotification('success', tt(`New project initialized for ${brief.clientName}`, `${brief.clientName} için yeni proje oluşturuldu`));
      addSystemEvent('Success', tt(`Project ${brief.clientName} synced to operational pipeline.`, `${brief.clientName} projesi operasyon pipeline’a eklendi.`));
    })();
  };

  const handleLeadIntake = (lead: Lead) => {
    setInitialIntakeValue(lead.brief);
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    setCurrentView(View.INTAKE);
  };

  const updateProject = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    (async () => {
      try {
        const saved = await apiSaveProject(updated);
        setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
      } catch {
        // API not running; keep local state only
      }
    })();
  };

  const upsertProjectFromServer = (updated: Project) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((p) => (p.id === updated.id ? updated : p));
    });
  };

  const handleStartCouncil = (projectId: string, gate?: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectTab(null);
    setCatalogPrefill(null);
    setCurrentView(View.COUNCIL);
  };

  const handleOpenBoardStudio = (projectId?: string) => {
    setBoardStudioReturnView(currentView);
    if (projectId) setSelectedProjectId(projectId);
    setSelectedProjectTab(null);
    setCatalogPrefill(null);
    setCurrentView(View.BOARD_STUDIO);
  };

  const handleOpenProject = (projectId: string, tab?: ProjectTab) => {
    setSelectedProjectId(projectId);
    setSelectedProjectTab(tab ?? null);
    setCatalogPrefill(null);
    setCurrentView(View.PROJECT_DETAIL);
  };

  const activeProject = projects.find(p => p.id === selectedProjectId);

  const boardAlerts = projects.flatMap(p => 
    p.executionLogs.filter(log => log.status === 'Error').map(log => ({
      projectId: p.id,
      clientName: p.brief.clientName,
      error: log.errorDetails || tt('Workflow Failure', 'Workflow Hatası'),
      workflow: log.workflowName,
      timestamp: log.timestamp
    }))
  ).slice(0, 5);

  // Show loading while checking auth
  if (isSupabaseEnabled && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if Supabase is enabled but user is not authenticated
  if (isSupabaseEnabled && !isAuthenticated) {
    return <Login />;
  }

  if (currentView === View.LANDING) {
    return (
      <LandingPage
        onEnter={() => {
          const onboarding = readOnboardingState();
          setUiMode(onboarding.uiMode);
          if (!onboarding.setupCompleted) {
            setCurrentView(View.SETUP);
          } else {
            setCurrentView(onboarding.uiMode === 'simple' ? View.HOME : View.JOURNEY);
          }
        }}
      />
    );
  }

  const isBoardStudio = currentView === View.BOARD_STUDIO;

  return (
    <div className="flex min-h-screen bg-slate-950 overflow-x-hidden text-slate-200 font-sans">
      {!isBoardStudio && (
        <Sidebar
          currentView={currentView}
          workspaceType={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
          onNavigate={(view) => {
            if (view === View.BOARD_STUDIO) {
              setBoardStudioReturnView(currentView);
              setCurrentView(View.BOARD_STUDIO);
              return;
            }
            if (view !== View.PROJECT_DETAIL) {
              setSelectedProjectId(null);
              setSelectedProjectTab(null);
            }
            if (view !== View.CATALOG) setCatalogPrefill(null);
            setCurrentView(view);
          }}
          uiMode={uiMode}
          onUIModeChange={setUiMode}
        />
      )}

      <main
        className={
          isBoardStudio
            ? "flex-1 min-h-0 overflow-hidden p-0 relative"
            : "flex-1 min-h-0 overflow-y-auto p-12 relative scroll-smooth no-scrollbar"
        }
      >
        {!isBoardStudio && (
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none"></div>
        )}

        {!isBoardStudio && (
          <div className="fixed top-8 right-8 z-[200] space-y-4 w-80">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${
                n.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
                <div className="w-2 h-2 rounded-full bg-current"></div>
                <p className="text-xs font-bold leading-tight">{n.message}</p>
              </div>
            ))}
          </div>
        )}

        {!isBoardStudio && (
        <header className="mb-12 flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {(selectedProjectId || (uiMode === 'simple' ? currentView !== View.HOME : currentView !== View.JOURNEY)) && (
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setSelectedProjectTab(null);
                    setCurrentView(uiMode === 'simple' ? View.HOME : View.JOURNEY);
                  }}
                  className="text-slate-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                >
                  {activeWorkspace === WorkspaceType.AGENCY ? tt(uiMode === 'simple' ? 'Home' : 'Revenue Journey', uiMode === 'simple' ? 'Ana Sayfa' : 'Gelir Yolculuğu') : tt('Client Success', 'Müşteri Merkezi')} /
                </button>
              )}
               <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                {currentView === View.PROJECT_DETAIL && activeProject 
                  ? activeProject.brief.clientName 
                  : activeWorkspace === WorkspaceType.CLIENT 
                    ? tt('Growth Hub', 'Büyüme Merkezi')
                    : NAV_ITEMS.find(item => item.id === currentView)?.label?.[language] || 'AgencyOS'}
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm uppercase tracking-tighter opacity-80">
              {currentView === View.PROJECT_DETAIL && activeProject 
                ? tt(`Operational control for ${activeProject.brief.clientName}`, `${activeProject.brief.clientName} için operasyon kontrolü`)
                : activeWorkspace === WorkspaceType.CLIENT
                  ? tt('Real-time efficiency metrics and automated reporting.', 'Gerçek zamanlı verimlilik metrikleri ve otomatik raporlama.')
                  : tt('Automating the future of agency operations.', 'Ajans operasyonlarını yapay zekâ ile otomatikleştir.' )}
            </p>
          </div>
          <div className="flex items-center gap-6">
             {uiMode === 'advanced' ? (
               <div className="bg-slate-900 px-5 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-xl">
                  <span className={`w-2 h-2 rounded-full ${n8nHeader?.connected ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]'}`}></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    n8n: {n8nHeader?.connected ? tt('Connected', 'Bağlı') : (n8nHeader?.reason?.startsWith('Missing') ? tt('Needs Key', 'Key Gerekli') : tt('Offline', 'Kapalı'))}
                  </span>
               </div>
             ) : (
               <div className="bg-slate-900 px-5 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {tt('AI CEO: Ready', 'AI CEO: Hazır')}
                  </span>
               </div>
             )}
             <div onClick={() => handleOpenBoardStudio()} className="bg-indigo-600/10 px-5 py-2.5 rounded-2xl border border-indigo-500/20 flex items-center gap-3 cursor-pointer hover:bg-indigo-600/20 transition-all group shadow-xl">
                <span className="text-lg group-hover:rotate-12 transition-transform">🏛️</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{tt('Management Board', 'Yönetim Kurulu')}</span>
             </div>
             {isSupabaseEnabled && user && (
               <div className="flex items-center gap-3">
                 <span className="text-[10px] font-medium text-slate-400">{user.email}</span>
                 <button
                   onClick={() => signOut()}
                   className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-all uppercase tracking-widest"
                 >
                   {tt('Sign Out', 'Çıkış')}
                 </button>
               </div>
             )}
          </div>
        </header>
        )}

        <div className={isBoardStudio ? "h-full w-full" : "max-w-7xl mx-auto"}>
          {activeWorkspace === WorkspaceType.AGENCY ? (
            <>
              {currentView === View.BOARD_STUDIO && (
                <BoardStudioPage
                  projects={projects}
                  initialProjectId={selectedProjectId}
                  onClose={() => setCurrentView(boardStudioReturnView)}
                  onOpenSessions={() => setCurrentView(View.COUNCIL)}
                />
              )}
              {currentView === View.HOME && (
                <Home
                  onNavigate={(view, projectId) => {
                    if (projectId) setSelectedProjectId(projectId);
                    setCurrentView(view as View);
                  }}
                />
              )}
              {currentView === View.MONEY && (
                <Money
                  onNavigate={(view) => setCurrentView(view as View)}
                />
              )}
              {currentView === View.PROJECTS && (
                <DashboardSimple
                  projects={projects}
                  leads={leads}
                  onNewProject={() => setCurrentView(View.INTAKE)}
                  onOpenProject={handleOpenProject}
                  onLeadIntake={handleLeadIntake}
                  onOpenSettings={() => setCurrentView(View.SETTINGS)}
                />
              )}
              {currentView === View.DASHBOARD && (
                <Dashboard
                  projects={projects}
                  leads={leads}
                  councilSessions={councilSessions}
                  alerts={boardAlerts}
                  systemEvents={systemEvents}
                  onNewProject={() => setCurrentView(View.INTAKE)}
                  onSeedDemo={handleSeedDemo}
                  onOpenCatalog={(projectId) => {
                    setSelectedProjectId(projectId);
                    setSelectedProjectTab(null);
                    setCatalogPrefill(null);
                    setCurrentView(View.CATALOG);
                  }}
                  onOpenSettings={() => setCurrentView(View.SETTINGS)}
                  onOpenCouncil={handleStartCouncil}
                  onOpenProject={handleOpenProject}
                  onLeadIntake={handleLeadIntake}
                />
              )}
              {currentView === View.JOURNEY && (
                <RevenueJourney
                  projects={projects}
                  onOpenSetup={() => setCurrentView(View.SETUP)}
                  onOpenIntake={() => setCurrentView(View.INTAKE)}
                  onCreateProject={addProject}
                  onProjectUpdate={upsertProjectFromServer}
                  onOpenProject={handleOpenProject}
                  onOpenCouncil={() => handleOpenBoardStudio()}
                  onOpenSettings={() => setCurrentView(View.SETTINGS)}
                  onOpenAssistant={(prompt) => openAssistant(prompt)}
                  onOpenPassiveHub={() => setCurrentView(View.PASSIVE_HUB)}
                  onSeedDemo={handleSeedDemo}
                  onOpenCatalog={(prefill) => {
                    setCatalogPrefill(prefill ?? null);
                    setCurrentView(View.CATALOG);
                  }}
                />
              )}
              {currentView === View.ASSISTANT && (
                <AgencyAssistant
                  onOpenCatalog={(prefill) => {
                    setCatalogPrefill(prefill ?? null);
                    setCurrentView(View.CATALOG);
                  }}
                  onOpenSettings={() => setCurrentView(View.SETTINGS)}
                  onOpenJourney={() => setCurrentView(View.JOURNEY)}
                  onOpenPassiveHub={() => setCurrentView(View.PASSIVE_HUB)}
                  initialPrompt={assistantPrefill?.text || undefined}
                  autoSend={assistantPrefill?.autoSend ?? false}
                  onConsumedInitialPrompt={() => setAssistantPrefill(null)}
                />
              )}
              {currentView === View.PASSIVE_HUB && (
                <PassiveIncomeHub
                  onOpenCatalog={(prefill) => {
                    setCatalogPrefill(prefill ?? null);
                    setCurrentView(View.CATALOG);
                  }}
                  onOpenAssistant={(prompt) => openAssistant(prompt)}
                />
              )}
              {currentView === View.AGENCY_BUILDER && (
                <AgencyBuilder
                  onClose={() => setCurrentView(uiMode === 'simple' ? View.HOME : View.JOURNEY)}
                  onNavigate={setCurrentView}
                  onSolutionDeployed={(solution) => {
                    addNotification('success', tt(`Agency solution "${solution.name.en}" deployed successfully!`, `"${solution.name.tr || solution.name.en}" ajans çözümü başarıyla dağıtıldı!`));
                  }}
                />
              )}
              {currentView === View.PROPOSALS && (
                <ProposalBuilder
                  projectId={selectedProjectId || undefined}
                  project={selectedProjectId ? projects.find(p => p.id === selectedProjectId) : undefined}
                  onClose={() => setCurrentView(View.DASHBOARD)}
                  onSave={(proposal) => {
                    setProposals(prev => {
                      const existing = prev.findIndex(p => p.id === proposal.id);
                      if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = proposal;
                        return updated;
                      }
                      return [...prev, proposal];
                    });
                    addNotification('success', tt('Proposal saved as draft', 'Teklif taslak olarak kaydedildi'));
                  }}
                  onSend={(proposal) => {
                    setProposals(prev => {
                      const existing = prev.findIndex(p => p.id === proposal.id);
                      if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = { ...proposal, status: 'Sent' };
                        return updated;
                      }
                      return [...prev, { ...proposal, status: 'Sent' }];
                    });
                    addNotification('success', tt(`Proposal sent to ${proposal.clientEmail}`, `Teklif ${proposal.clientEmail} adresine gönderildi`));
                    setCurrentView(View.DASHBOARD);
                  }}
                />
              )}
              {currentView === View.SALES_PIPELINE && (
                <SalesPipeline
                  leads={outboundLeads}
                  proposals={proposals}
                  language={language}
                  onLeadClick={(lead) => {
                    addNotification('info', tt(`Viewing lead: ${lead.name}`, `Lead görüntüleniyor: ${lead.name}`));
                  }}
                  onLeadStageChange={handleLeadStageChange}
                  onCreateProposal={(lead) => {
                    // Create a project from lead and navigate to proposals
                    const newProject: Project = {
                      id: `proj-${Date.now()}`,
                      brief: {
                        id: `brief-${Date.now()}`,
                        clientName: lead.name,
                        description: `Project for ${lead.name}`,
                        industry: lead.category || 'Technology',
                        goals: ['AI Automation'],
                        tools: [],
                        budget: '$2,000 - $5,000',
                        riskLevel: 'Medium',
                      },
                      status: 'Proposal',
                      activeWorkflows: [],
                      documents: [],
                      executionLogs: [],
                      incidents: [],
                      operatorChat: [],
                      crmActivities: [],
                      financials: { revenue: 0, expenses: 0, hoursSaved: 0, costPerExecution: 0 },
                      governance: { certified: false, lastScore: 0, verdict: 'None' },
                      totalBilled: 0,
                      createdAt: new Date().toISOString(),
                    };
                    setProjects(prev => [...prev, newProject]);
                    setSelectedProjectId(newProject.id);
                    // Update lead to Proposal stage
                    handleLeadStageChange(lead.id, 'Proposal');
                    setCurrentView(View.PROPOSALS);
                  }}
                  onNavigate={setCurrentView}
                />
              )}
              {currentView === View.GUIDED_JOURNEY && (
                <GuidedJourney
                  language={language}
                  onNavigate={setCurrentView}
                />
              )}
              {currentView === View.SETUP && (
                uiMode === 'simple' ? (
                  <SetupWizardSimple
                    onFinish={() => setCurrentView(View.HOME)}
                    onProjectsUpdated={(p) => setProjects(p)}
                    onOpenProject={handleOpenProject}
                    onUIModeChange={setUiMode}
                  />
                ) : (
                  <SetupWizard
                    onFinish={() => setCurrentView(View.JOURNEY)}
                    onProjectsUpdated={(p) => setProjects(p)}
                    onOpenProject={handleOpenProject}
                    onUIModeChange={setUiMode}
                  />
                )
              )}
              {currentView === View.INTAKE && (
                <IntakeWizard onComplete={addProject} initialValue={initialIntakeValue} />
              )}
              {currentView === View.CATALOG && (
                <WorkflowCatalog
                  onProjectUpdate={updateProject}
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  initialQuery={catalogPrefill?.query}
                  initialRequiredTags={catalogPrefill?.requiredTags}
                />
              )}
              {currentView === View.COUNCIL && (
                <CouncilRoomSimple
                  selectedProjectId={selectedProjectId}
                  projects={projects}
                  sessions={councilSessions}
                  onProjectUpdate={updateProject}
                  onNewSession={(session) => {
                    setCouncilSessions(prev => [session, ...prev]);
                    const proj = projects.find(p => p.id === session.projectId);
                    if (session.decision === 'Approved' && proj) {
                       const scores = session.opinions?.map(o => o.score) || [];
                       const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                       const updatedProj: Project = { ...proj, governance: { certified: true, lastScore: avgScore, verdict: 'Approved' } };
                       if (session.gateType === 'Strategic') updatedProj.status = 'Proposal';
                       if (session.gateType === 'Risk') updatedProj.status = 'Developing';
                       if (session.gateType === 'Launch') updatedProj.status = 'Testing';
                       updateProject(updatedProj);
                    }
                  }}
                />
              )}
              {currentView === View.PROJECT_DETAIL && activeProject && (
                <ProjectDetail project={activeProject} initialTab={selectedProjectTab ?? undefined} onUpdate={updateProject} onOpenCouncil={handleStartCouncil} />
              )}
              {currentView === View.DOCUMENTS && <DocumentsView projects={projects} />}
              {currentView === View.SETTINGS && <AgencySettings secrets={secrets} onUpdateSecrets={setSecrets} teamMembers={teamMembers} />}
            </>
          ) : (
            <ClientDashboard projects={projects} />
          )}
        </div>

        {!isBoardStudio && (
          <button
            onClick={() => {
              openAssistant();
            }}
            className="fixed bottom-8 right-8 z-[250] bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-4 rounded-[28px] shadow-2xl shadow-indigo-600/20 border border-indigo-400/20 uppercase tracking-widest text-[10px] active:scale-95 transition-all"
            title={tt('Ask AI anything (Global Assistant)', 'AI’ye sor (Global Asistan)')}
          >
            {tt('Ask AI', 'AI’ye Sor')}
          </button>
        )}
      </main>
    </div>
  );
};

export default App;
