
import React, { useState, useEffect } from 'react';
import { Project, Lead, SystemEvent } from '../types';
import { generateExecutiveSummary } from '../services/gemini';

interface DashboardProps {
  projects: Project[];
  leads: Lead[];
  alerts: { projectId: string; clientName: string; error: string; workflow: string; timestamp: string }[];
  systemEvents: SystemEvent[];
  onNewProject: () => void;
  onOpenCouncil: (id: string) => void;
  onOpenProject: (id: string) => void;
  onLeadIntake: (lead: Lead) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, leads, alerts, systemEvents, onNewProject, onOpenCouncil, onOpenProject, onLeadIntake }) => {
  const [executiveBrief, setExecutiveBrief] = useState<string>('');
  const [loadingBrief, setLoadingBrief] = useState(false);

  useEffect(() => {
    const fetchBrief = async () => {
      if (projects.length === 0) return;
      setLoadingBrief(true);
      const brief = await generateExecutiveSummary(projects);
      setExecutiveBrief(brief);
      setLoadingBrief(false);
    };
    fetchBrief();
  }, [projects.length]);

  const stats = [
    { label: 'Pipeline Value', value: projects.length, icon: '🚀', trend: '+12%' },
    { label: 'Agency Yield', value: `$${projects.reduce((acc, p) => acc + (p.totalBilled || 0), 0).toLocaleString()}`, icon: '💰', trend: '+8%' },
    { label: 'Cluster Health', value: '99.9%', icon: '🛡️', trend: 'STABLE' },
    { label: 'Avg MTTR', value: '4.2m', icon: '⏱️', trend: '-18%' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-800/40 p-6 rounded-[32px] border border-slate-700/50 hover:border-indigo-500/50 transition-all group relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full -mr-8 -mt-8"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-800">{stat.icon}</div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter ${stat.trend.startsWith('+') ? 'text-green-400 bg-green-400/10' : stat.trend.startsWith('-') ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 bg-slate-400/10'}`}>{stat.trend}</span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest relative z-10">{stat.label}</h3>
            <p className="text-3xl font-black text-white mt-1 relative z-10 tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Executive Intelligence Feed */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[48px] shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
         <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl border border-indigo-400/20 group-hover:rotate-6 transition-transform">🧠</div>
            <div className="flex-1">
               <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Cross-Project Intelligence</span>
                  <div className="h-[1px] flex-1 bg-indigo-500/20"></div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">v1.0.4 OPS_SUMMARY</span>
               </div>
               {loadingBrief ? (
                 <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-indigo-500/20 rounded w-[90%]"></div>
                    <div className="h-4 bg-indigo-500/20 rounded w-[60%]"></div>
                 </div>
               ) : (
                 <p className="text-white text-lg font-medium leading-relaxed italic">"{executiveBrief || "Ready for pipeline synchronization..."}"</p>
               )}
            </div>
            <div className="hidden lg:flex flex-col items-center gap-4">
               <div className="flex gap-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-8 bg-indigo-500/30 rounded-full animate-pulse" style={{ animationDelay: `${i*150}ms` }}></div>)}
               </div>
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Neural Feed Active</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-8">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[40px] p-8 shadow-2xl relative overflow-hidden flex flex-col h-[400px]">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[80px] rounded-full"></div>
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 flex justify-between items-center relative z-10">
                <span>System Event Stream</span>
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></span>
             </h3>
             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar relative z-10 no-scrollbar">
                {systemEvents.map((ev) => (
                  <div key={ev.id} className="flex gap-4 group cursor-default">
                     <div className={`w-1 h-full min-h-[40px] rounded-full transition-all group-hover:scale-y-110 ${ev.type === 'Success' ? 'bg-green-500' : ev.type === 'Alert' ? 'bg-red-500' : ev.type === 'Warning' ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
                     <div className="flex-1">
                        <p className="text-[11px] text-slate-200 font-bold leading-tight">{ev.message}</p>
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{new Date(ev.timestamp).toLocaleTimeString()}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-slate-800/40 rounded-[32px] border border-slate-700/50 overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
               <div>
                  <h2 className="text-lg font-black text-white tracking-tight uppercase">Intake Vector</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Automated Lead Qualified</p>
               </div>
               <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-indigo-600/30">{leads.length} Pending</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[450px] divide-y divide-slate-700/30 custom-scrollbar no-scrollbar">
              {leads.map(lead => (
                <div key={lead.id} className="p-6 hover:bg-indigo-600/5 transition-all group cursor-pointer relative" onClick={() => onLeadIntake(lead)}>
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-all"></div>
                  <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">{lead.source}</span>
                      <span className="text-[10px] font-black text-green-400 uppercase">{lead.aiScore}% Match</span>
                  </div>
                  <h4 className="font-black text-white text-lg mb-2 group-hover:text-indigo-400 transition-colors tracking-tight uppercase">{lead.clientName}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium mb-4">{lead.brief}</p>
                  <button className="text-[10px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest flex items-center gap-2 transition-all">
                    Convert to Node <span className="text-indigo-500">→</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Registry */}
        <div className="xl:col-span-8 space-y-8">
          <div className="bg-slate-800/40 rounded-[40px] border border-slate-700/50 overflow-hidden flex flex-col shadow-2xl h-full">
            <div className="p-8 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Operational Registry</h2>
              <button onClick={onNewProject} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/30 uppercase tracking-widest border border-indigo-400/20">
                + Provision Node
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[850px] custom-scrollbar divide-y divide-slate-700/50 no-scrollbar">
              {projects.map(project => (
                <div key={project.id} className="p-10 hover:bg-slate-800/60 transition-all flex items-center justify-between group cursor-pointer border-l-4 border-transparent hover:border-indigo-500" onClick={() => onOpenProject(project.id)}>
                  <div className="flex gap-8 items-center">
                    <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl border transition-all duration-500 relative ${project.status === 'Live' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                      {project.status === 'Live' ? '⚡' : '📦'}
                      {project.governance.certified && <div className="absolute -top-3 -right-3 bg-indigo-600 text-[10px] w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xl">🏛️</div>}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-2xl group-hover:text-indigo-400 transition-colors tracking-tight mb-2 uppercase">{project.brief.clientName}</h4>
                      <div className="flex flex-wrap items-center gap-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${project.status === 'Live' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{project.status}</span>
                        <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{project.activeWorkflows.length} Operational Units</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase bg-slate-900 px-4 py-1 rounded-lg border border-slate-800">Billed: ${project.totalBilled.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onOpenCouncil(project.id); }} className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-[20px] flex items-center justify-center text-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl group-hover:border-indigo-500/30 active:scale-95 group/btn">
                    <span className="group-hover/btn:scale-110 transition-transform">🏛️</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
