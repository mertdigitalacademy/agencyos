
import React, { useState, useMemo, useEffect } from 'react';
import { Workflow, Project } from '../types';
import { MOCK_WORKFLOWS } from '../constants';
import { recommendWorkflows } from '../services/gemini';

interface WorkflowCatalogProps {
  projects: Project[];
  onProjectUpdate: (updated: Project) => void;
  selectedProjectId: string | null;
}

const CATEGORIES = ['All', 'CRM', 'Marketing', 'Finance', 'AI', 'Sales'];

const WorkflowCatalog: React.FC<WorkflowCatalogProps> = ({ projects, onProjectUpdate, selectedProjectId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeProject, setActiveProject] = useState<string>(selectedProjectId || '');
  const [isMatching, setIsMatching] = useState(false);
  const [aiRecs, setAiRecs] = useState<{ id: string, score: number, reason: string }[]>([]);

  const project = useMemo(() => projects.find(p => p.id === activeProject), [projects, activeProject]);

  const filteredWorkflows = useMemo(() => {
    return MOCK_WORKFLOWS.filter(wf => {
      const matchesSearch = wf.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            wf.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || wf.tags.some(t => t.toUpperCase() === activeCategory.toUpperCase());
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  const runAiMatching = async () => {
    if (!project) return;
    setIsMatching(true);
    try {
      const recs = await recommendWorkflows(project.brief, MOCK_WORKFLOWS);
      setAiRecs(recs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMatching(false);
    }
  };

  useEffect(() => {
    if (activeProject) {
      setAiRecs([]); // Reset recs when switching project
    }
  }, [activeProject]);

  const handleInstall = (workflow: Workflow) => {
    if (!activeProject) {
      alert("Please select a project first!");
      return;
    }
    const proj = projects.find(p => p.id === activeProject);
    if (proj) {
      const isAlreadyInstalled = proj.activeWorkflows.some(w => w.id === workflow.id);
      if (isAlreadyInstalled) return;

      const updatedProject: Project = {
        ...proj,
        activeWorkflows: [...proj.activeWorkflows, workflow],
        status: 'Developing'
      };
      onProjectUpdate(updatedProject);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-700/50 shadow-2xl relative overflow-hidden flex flex-col gap-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">n8n Automation Catalog</h2>
            <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Production-Ready System Modules</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Deploy To Cluster</span>
              <select 
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-3.5 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-xl transition-all"
              >
                <option value="">-- Choose Target Project --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.brief.clientName.toUpperCase()}</option>
                ))}
              </select>
            </div>
            {project && (
              <button 
                onClick={runAiMatching}
                disabled={isMatching}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-8 py-5 rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3 uppercase tracking-widest mt-4 md:mt-0 active:scale-95 border border-indigo-400/20"
              >
                {isMatching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : '🪄 Run AI Alignment'}
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row gap-6">
          <div className="flex-1 relative group">
            <input
              type="text"
              placeholder="Query workflow parameters or stack tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-14 py-4 text-sm text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 font-medium"
            />
            <span className="absolute left-6 top-5 text-xl opacity-30 group-focus-within:opacity-100 transition-opacity">🔍</span>
          </div>
          
          <div className="flex bg-slate-900 rounded-[28px] p-2 border border-slate-800 shadow-inner overflow-x-auto no-scrollbar gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {project && aiRecs.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-600/10 to-blue-600/5 border border-indigo-500/20 p-10 rounded-[40px] flex items-center gap-10 animate-in slide-in-from-top-6 fade-in duration-700 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
          <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-600/40 group-hover:rotate-12 transition-transform duration-500 border border-indigo-400/20">✨</div>
          <div className="flex-1 relative z-10">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
               <span className="w-12 h-[1px] bg-indigo-500/30"></span>
               Strategic Board Alignment Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {aiRecs.map(rec => (
                <div key={rec.id} className="bg-slate-950/60 p-6 rounded-3xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-black text-white tracking-tight">{MOCK_WORKFLOWS.find(w => w.id === rec.id)?.name}</span>
                    <span className="text-indigo-400 font-black text-xs">{rec.score}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">"{rec.reason}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredWorkflows.map(wf => {
          const rec = aiRecs.find(r => r.id === wf.id);
          const isStaged = project?.activeWorkflows.some(w => w.id === wf.id);

          return (
            <div 
              key={wf.id} 
              className={`bg-slate-800/40 border p-10 rounded-[48px] transition-all duration-500 flex flex-col h-full relative group shadow-xl ${
                rec ? 'border-indigo-500/40 ring-4 ring-indigo-500/5 bg-indigo-600/5' : 'border-slate-700/50'
              } hover:border-indigo-500/50 hover:bg-slate-800/60 hover:-translate-y-1`}
            >
              {rec && (
                <div className="absolute -top-3 -right-3 bg-indigo-600 text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl shadow-indigo-600/40 border border-indigo-400/30 animate-pulse tracking-widest">
                  AI STRATEGIC MATCH
                </div>
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tighter leading-none mb-2 group-hover:text-indigo-400 transition-colors">{wf.name}</h3>
                   <div className="flex flex-wrap gap-2">
                     {wf.tags.map(tag => (
                       <span key={tag} className="text-[9px] font-black text-slate-600 border border-slate-800/80 px-2.5 py-0.5 rounded-lg uppercase tracking-widest group-hover:border-indigo-500/20 transition-all">
                         {tag}
                       </span>
                     ))}
                   </div>
                </div>
                <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${
                  wf.complexity === 'Low' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  wf.complexity === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {wf.complexity} Complexity
                </span>
              </div>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10 flex-1">{wf.description}</p>
              
              <div className="space-y-6">
                <div className="bg-slate-950/60 p-7 rounded-[32px] border border-slate-800 group-hover:border-indigo-500/20 transition-all shadow-inner">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Cluster Handshake Logic</p>
                  <div className="grid grid-cols-2 gap-4">
                    {wf.credentials.map(cred => (
                      <div key={cred} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full shadow-[0_0_8px_#6366f1]"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{cred}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => handleInstall(wf)}
                  disabled={isStaged || !activeProject}
                  className={`w-full font-black py-6 rounded-[30px] transition-all duration-300 uppercase tracking-[0.2em] text-[10px] shadow-2xl relative overflow-hidden group/btn ${
                    isStaged 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                      : !activeProject
                      ? 'bg-slate-800/50 text-slate-700 cursor-not-allowed border border-slate-800'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/40 active:scale-[0.97] border border-indigo-400/20'
                  }`}
                >
                  <span className="relative z-10">{isStaged ? 'Deployed to Node ✅' : 'Deploy to n8n Instance 🚀'}</span>
                  {!isStaged && activeProject && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowCatalog;
