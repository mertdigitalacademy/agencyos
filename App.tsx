
import React, { useState, useEffect } from 'react';
import { View, Project, ProjectBrief, CouncilSession, AgencySecret, Lead, WorkspaceType, AppNotification, TeamMember, SystemEvent } from './types';
import { NAV_ITEMS } from './constants';
import Dashboard from './components/Dashboard';
import IntakeWizard from './components/IntakeWizard';
import WorkflowCatalog from './components/WorkflowCatalog';
import CouncilRoom from './components/CouncilRoom';
import Sidebar from './components/Sidebar';
import ProjectDetail from './components/ProjectDetail';
import DocumentsView from './components/DocumentsView';
import AgencySettings from './components/AgencySettings';
import ClientDashboard from './components/ClientDashboard';
import LandingPage from './components/LandingPage';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.LANDING);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceType>(WorkspaceType.AGENCY);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([
    { id: 'ev-1', type: 'Success', message: 'Agency Cluster Node-01 Handshake Stable', timestamp: new Date().toISOString() },
    { id: 'ev-2', type: 'Info', message: 'Infisical Secrets Rotation Scheduled for T-24h', timestamp: new Date().toISOString() }
  ]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: 'tm-1', name: 'Board AI', role: 'Chairman', type: 'AI', avatar: '🏛️', specialization: ['Governance', 'Risk'], status: 'Online' },
    { id: 'tm-2', name: 'Dev-Bot', role: 'Architect', type: 'AI', avatar: '🤖', specialization: ['n8n', 'NodeJS', 'Python'], status: 'Online' },
    { id: 'tm-3', name: 'Ece Demir', role: 'Solutions Expert', type: 'Human', avatar: '👩‍💻', specialization: ['CRM', 'Client Success'], status: 'Busy' }
  ]);
  const [leads, setLeads] = useState<Lead[]>([
    { id: 'l1', source: 'Typeform', clientName: 'Globex Corp', brief: 'Wants to automate customer support with AI ticketing.', timestamp: new Date().toISOString(), aiScore: 88 },
    { id: 'l2', source: 'LinkedIn', clientName: 'Stark Ind.', brief: 'Need supply chain monitoring workflow via n8n.', timestamp: new Date().toISOString(), aiScore: 94 }
  ]);
  const [councilSessions, setCouncilSessions] = useState<CouncilSession[]>([]);
  const [secrets, setSecrets] = useState<AgencySecret[]>([
    { id: '1', key: 'N8N_API_KEY', value: '••••••••••••••••', environment: 'Production', lastUpdated: new Date().toISOString() },
    { id: '2', key: 'GEMINI_API_KEY', value: '••••••••••••••••', environment: 'Production', lastUpdated: new Date().toISOString() }
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [initialIntakeValue, setInitialIntakeValue] = useState('');

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

  const addProject = (brief: ProjectBrief) => {
    const newProject: Project = {
      id: brief.id,
      brief,
      status: 'Intake',
      activeWorkflows: [],
      documents: [],
      executionLogs: [],
      incidents: [],
      crmActivities: [
        { id: 'crm-1', type: 'Note', subject: 'Project Initialized from Intake Wizard', status: 'Completed', timestamp: new Date().toISOString() }
      ],
      operatorChat: [{
        id: 'sys-1',
        role: 'system',
        content: `Operator initialized for ${brief.clientName}. I am connected to your n8n MCP server cluster.`
      }],
      financials: {
        revenue: 0,
        expenses: 0,
        hoursSaved: 0,
        // Fixed: Missing costPerExecution property
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
    setInitialIntakeValue('');
    setCurrentView(View.DASHBOARD);
    addNotification('success', `New project initialized for ${brief.clientName}`);
    addSystemEvent('Success', `Project ${brief.clientName} synced to operational pipeline.`);
  };

  const handleLeadIntake = (lead: Lead) => {
    setInitialIntakeValue(lead.brief);
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    setCurrentView(View.INTAKE);
  };

  const updateProject = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleStartCouncil = (projectId: string, gate?: string) => {
    setSelectedProjectId(projectId);
    setCurrentView(View.COUNCIL);
  };

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentView(View.PROJECT_DETAIL);
  };

  const activeProject = projects.find(p => p.id === selectedProjectId);

  const boardAlerts = projects.flatMap(p => 
    p.executionLogs.filter(log => log.status === 'Error').map(log => ({
      projectId: p.id,
      clientName: p.brief.clientName,
      error: log.errorDetails || 'Workflow Failure',
      workflow: log.workflowName,
      timestamp: log.timestamp
    }))
  ).slice(0, 5);

  if (currentView === View.LANDING) {
    return <LandingPage onEnter={() => setCurrentView(View.DASHBOARD)} />;
  }

  return (
    <div className="flex h-screen bg-[#020617] overflow-hidden text-slate-200 font-sans">
      <Sidebar 
        currentView={currentView} 
        workspaceType={activeWorkspace}
        onWorkspaceChange={setActiveWorkspace}
        onNavigate={(view) => {
          if (view !== View.PROJECT_DETAIL) setSelectedProjectId(null);
          setCurrentView(view);
        }} 
      />

      <main className="flex-1 overflow-y-auto p-12 relative scroll-smooth no-scrollbar">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none"></div>

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

        <header className="mb-12 flex justify-between items-center relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
               {(selectedProjectId || currentView !== View.DASHBOARD) && (
                 <button onClick={() => { setSelectedProjectId(null); setCurrentView(View.DASHBOARD); }} className="text-slate-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                   {activeWorkspace === WorkspaceType.AGENCY ? 'Agency Command' : 'Client Success'} /
                 </button>
               )}
               <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                {currentView === View.PROJECT_DETAIL && activeProject 
                  ? activeProject.brief.clientName 
                  : activeWorkspace === WorkspaceType.CLIENT 
                    ? 'Growth Hub'
                    : NAV_ITEMS.find(item => item.id === currentView)?.label || 'AgencyOS'}
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm uppercase tracking-tighter opacity-80">
              {currentView === View.PROJECT_DETAIL && activeProject 
                ? `Operational control for ${activeProject.brief.clientName}`
                : activeWorkspace === WorkspaceType.CLIENT
                  ? 'Real-time efficiency metrics and automated reporting.'
                  : 'Automating the future of agency operations.'}
            </p>
          </div>
          <div className="flex items-center gap-6">
             <div className="bg-slate-900 px-5 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-3 shadow-xl">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">n8n: Cluster_Active</span>
             </div>
             <div onClick={() => setCurrentView(View.COUNCIL)} className="bg-indigo-600/10 px-5 py-2.5 rounded-2xl border border-indigo-500/20 flex items-center gap-3 cursor-pointer hover:bg-indigo-600/20 transition-all group shadow-xl">
                <span className="text-lg group-hover:rotate-12 transition-transform">🏛️</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Council Room</span>
             </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {activeWorkspace === WorkspaceType.AGENCY ? (
            <>
              {currentView === View.DASHBOARD && (
                <Dashboard 
                  projects={projects} 
                  leads={leads}
                  alerts={boardAlerts}
                  systemEvents={systemEvents}
                  onNewProject={() => setCurrentView(View.INTAKE)}
                  onOpenCouncil={handleStartCouncil}
                  onOpenProject={handleOpenProject}
                  onLeadIntake={handleLeadIntake}
                />
              )}
              {currentView === View.INTAKE && (
                <IntakeWizard onComplete={addProject} initialValue={initialIntakeValue} />
              )}
              {currentView === View.CATALOG && (
                <WorkflowCatalog onProjectUpdate={updateProject} projects={projects} selectedProjectId={selectedProjectId} />
              )}
              {currentView === View.COUNCIL && (
                <CouncilRoom 
                  selectedProjectId={selectedProjectId}
                  projects={projects}
                  sessions={councilSessions}
                  onNewSession={(session) => {
                    setCouncilSessions(prev => [session, ...prev]);
                    const proj = projects.find(p => p.id === session.projectId);
                    if (session.decision === 'Approved' && proj) {
                       const scores = session.opinions.map(o => o.score);
                       const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
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
                <ProjectDetail project={activeProject} onUpdate={updateProject} onOpenCouncil={handleStartCouncil} />
              )}
              {currentView === View.DOCUMENTS && <DocumentsView projects={projects} />}
              {currentView === View.SETTINGS && <AgencySettings secrets={secrets} onUpdateSecrets={setSecrets} teamMembers={teamMembers} />}
            </>
          ) : (
            <ClientDashboard projects={projects} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
