
import React, { useState, useEffect } from 'react';
import { Project, CouncilSession, CouncilGate } from '../types';
import { runCouncilSession } from '../services/gemini';

interface CouncilRoomProps {
  selectedProjectId: string | null;
  projects: Project[];
  sessions: CouncilSession[];
  onNewSession: (session: CouncilSession) => void;
}

const GATES: { id: CouncilGate; label: string; desc: string }[] = [
  { id: 'Strategic', label: 'Strategic Gate', desc: 'Pricing, scope, and proposal review.' },
  { id: 'Risk', label: 'Risk & Test Gate', desc: 'Security audit and edge cases.' },
  { id: 'Launch', label: 'Go-Live Gate', desc: 'Final activation checklist.' },
  { id: 'Post-Mortem', label: 'Post-Mortem Gate', desc: 'Failure analysis and recovery.' },
];

const CouncilRoom: React.FC<CouncilRoomProps> = ({ selectedProjectId, projects, sessions, onNewSession }) => {
  const [loading, setLoading] = useState(false);
  const [activeGate, setActiveGate] = useState<CouncilGate>('Strategic');
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId || '');
  const [deliberationPhase, setDeliberationPhase] = useState<'convening' | 'deliberating' | 'synthesizing' | 'done'>('done');

  useEffect(() => {
    if (selectedProjectId) setActiveProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const filteredSessions = sessions.filter(s => s.projectId === activeProjectId);
  const currentProject = projects.find(p => p.id === activeProjectId);

  const startDeliberation = async () => {
    if (!activeProjectId || !activeGate) return;
    setLoading(true);
    setDeliberationPhase('convening');
    
    const gateInfo = GATES.find(g => g.id === activeGate);
    const topic = `${gateInfo?.label}: ${gateInfo?.desc}`;
    
    await new Promise(r => setTimeout(r, 1200));
    setDeliberationPhase('deliberating');
    
    try {
      const session = await runCouncilSession(activeProjectId, topic, currentProject);
      await new Promise(r => setTimeout(r, 2000));
      setDeliberationPhase('synthesizing');
      await new Promise(r => setTimeout(r, 1000));
      
      onNewSession({ ...session, gateType: activeGate });
      setLoading(false);
      setDeliberationPhase('done');
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700 pb-20">
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-[80px] -mr-24 -mt-24"></div>
          
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4 uppercase tracking-tighter">
               <span className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-indigo-400/20">🏛️</span> 
               Protocol Setup
            </h3>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">Active Node</label>
                <select
                  value={activeProjectId}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                >
                  <option value="">-- Choose Project Instance --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.brief.clientName.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">Selection Gate</label>
                <div className="grid grid-cols-1 gap-3">
                  {GATES.map(gate => (
                    <button
                      key={gate.id}
                      onClick={() => setActiveGate(gate.id)}
                      className={`text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${
                        activeGate === gate.id 
                          ? `bg-indigo-600/10 border-indigo-500 text-indigo-100 shadow-xl` 
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <p className="text-[11px] font-black uppercase tracking-widest mb-1 relative z-10">{gate.label}</p>
                      <p className="text-[10px] opacity-60 relative z-10 font-medium">{gate.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startDeliberation}
                disabled={loading || !activeProjectId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[24px] shadow-2xl shadow-indigo-600/30 mt-6 active:scale-[0.98] uppercase tracking-[0.2em] text-xs border border-indigo-400/20"
              >
                {loading ? 'Initializing Neural Link...' : 'Execute Deliberation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 bg-slate-800/10 border-2 border-dashed border-indigo-500/20 rounded-[60px] text-center shadow-inner animate-pulse">
             <div className="text-8xl mb-10">🏛️</div>
             <h3 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">
                {deliberationPhase === 'convening' ? 'Establishing Board Consensus...' : 
                 deliberationPhase === 'deliberating' ? 'Expert Persona Evaluation...' : 
                 'Synthesizing Operational Protocol...'}
             </h3>
             <p className="text-slate-500 max-w-sm leading-relaxed text-sm font-medium">The AgencyOS Board is analyzing project telemetry and architectural alignment.</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-48 text-center bg-slate-800/10 rounded-[60px] border-2 border-dashed border-slate-800/50 flex flex-col items-center group transition-all hover:bg-slate-800/20">
             <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-5xl mb-8 shadow-inner border border-slate-800 opacity-20 group-hover:opacity-100 transition-all">📜</div>
             <h3 className="text-xl font-black text-slate-500 uppercase tracking-[0.3em]">No Deliberations Found</h3>
             <p className="text-slate-600 text-sm mt-4 max-w-sm leading-relaxed">Choose a project and gate to initiate a Strategic AI Board Session.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredSessions.slice().reverse().map((session) => (
              <div key={session.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                <div className="p-10 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center relative">
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-lg">
                      {session.gateType} Protocol
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{session.topic.split(':')[0]}</h3>
                  </div>
                  <div className={`px-8 py-3 rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] border shadow-2xl ${
                    session.decision === 'Approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    session.decision === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {session.decision}
                  </div>
                </div>

                <div className="p-12 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {session.opinions.map((op, oIdx) => (
                      <div key={oIdx} className="bg-slate-900/40 p-8 rounded-[32px] border border-slate-800 shadow-inner flex flex-col justify-between hover:border-indigo-500/20 transition-all group/card">
                        <div>
                          <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl border border-slate-700 group-hover/card:scale-110 transition-transform">
                               {op.persona.includes('Risk') ? '⚖️' : op.persona.includes('Architect') ? '📐' : '📈'}
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-white tracking-tight">{op.persona}</p>
                               <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{op.role}</p>
                            </div>
                          </div>
                          <p className="text-[13px] text-slate-400 leading-relaxed italic mb-8 font-medium">"{op.opinion}"</p>
                        </div>
                        <div className="pt-6 border-t border-slate-800/50 flex justify-between items-center">
                          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Confidence</span>
                          <span className={`text-sm font-black ${op.score > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{op.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-indigo-600/5 border border-indigo-500/10 p-12 rounded-[48px] relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-8">
                       <span className="w-16 h-[1px] bg-indigo-500/40"></span>
                       <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Final Board Synthesis</h4>
                       <span className="w-full h-[1px] bg-indigo-500/10"></span>
                    </div>
                    <div className="text-slate-300 leading-[1.8] text-base whitespace-pre-wrap font-medium">
                       {session.synthesis}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouncilRoom;
