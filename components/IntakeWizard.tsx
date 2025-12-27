
import React, { useState, useEffect } from 'react';
import { ProjectBrief } from '../types';
import { analyzeIntake } from '../services/gemini';

interface IntakeWizardProps {
  onComplete: (brief: ProjectBrief) => void;
  initialValue?: string;
}

const IntakeWizard: React.FC<IntakeWizardProps> = ({ onComplete, initialValue }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState(initialValue || '');
  const [brief, setBrief] = useState<Partial<ProjectBrief>>({
    clientName: '',
    goals: [],
    tools: [],
    budget: '',
    riskLevel: 'Medium'
  });

  useEffect(() => {
    if (initialValue) setUserInput(initialValue);
  }, [initialValue]);

  const handleAIScan = async () => {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      const analysis = await analyzeIntake(userInput);
      setBrief(prev => ({ ...prev, ...analysis }));
      await new Promise(r => setTimeout(r, 1000)); // Cinematic pause
      setStep(2);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = () => {
    onComplete({
      id: `proj-${Date.now()}`,
      clientName: brief.clientName || 'Unnamed Entity',
      description: userInput,
      goals: brief.goals || [],
      tools: brief.tools || [],
      budget: brief.budget || 'To be calculated',
      riskLevel: brief.riskLevel || 'Medium'
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom duration-700 pb-20">
      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-6 mb-16">
        {[
          { step: 1, label: 'Intake Brief' },
          { step: 2, label: 'AI Synthesis' },
          { step: 3, label: 'Execution Plan' }
        ].map((item, idx) => (
          <React.Fragment key={item.step}>
            <div className="flex flex-col items-center gap-3 group">
              <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center font-black text-lg transition-all duration-500 border ${
                step >= item.step 
                  ? 'bg-indigo-600 text-white border-indigo-400/30 shadow-2xl shadow-indigo-600/40 scale-110' 
                  : 'bg-slate-900 text-slate-600 border-slate-800'
              }`}>
                {item.step}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${step >= item.step ? 'text-indigo-400' : 'text-slate-700'}`}>{item.label}</span>
            </div>
            {idx < 2 && (
              <div className={`h-[2px] w-16 rounded-full transition-all duration-1000 ${step > item.step ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : 'bg-slate-800'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === 1 && (
        <div className="bg-slate-800/40 border border-slate-700/50 p-12 rounded-[56px] space-y-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full"></div>
          
          <div className="text-center space-y-4 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Intake Vector</h3>
            <p className="text-slate-500 text-sm font-medium max-w-lg mx-auto leading-relaxed">Describe the operational bottleneck or automation goal. Our Board-AI will extract technical requirements and risk profiles automatically.</p>
          </div>

          <div className="relative z-10">
             <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-[36px] p-10 text-slate-100 text-lg focus:ring-4 focus:ring-indigo-500/20 outline-none resize-none transition-all placeholder:text-slate-700 shadow-inner font-medium leading-relaxed"
                placeholder="Describe your project, tools (n8n, CRM, etc.), and desired outcome..."
              />
              <div className="absolute bottom-6 right-8 text-slate-800 font-mono text-xs uppercase font-black select-none tracking-widest">AgencyOS_Engine_v1.0</div>
          </div>

          <button
            onClick={handleAIScan}
            disabled={loading || !userInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-7 rounded-[32px] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-indigo-600/40 active:scale-[0.98] border border-indigo-400/20 uppercase tracking-[0.3em] text-sm relative z-10 overflow-hidden group/btn"
          >
            {loading ? (
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span className="animate-pulse">Analyzing Briefing Documents...</span>
              </div>
            ) : (
              <>Scan & Synchronize Brief 🪄</>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      )}

      {/* Step 2: Parameters Validation */}
      {step === 2 && (
        <div className="bg-slate-800/40 border border-slate-700/50 p-12 rounded-[56px] space-y-12 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-8">
            <h3 className="text-3xl font-black text-white tracking-tighter uppercase">AI Technical Synthesis</h3>
            <span className="bg-green-500/10 text-green-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-green-500/20 tracking-widest uppercase">Validated Artifact</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Target Identity</label>
                <input
                  type="text"
                  value={brief.clientName}
                  onChange={(e) => setBrief({ ...brief, clientName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 font-black tracking-tight outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Strategic Goals</label>
                <div className="flex flex-wrap gap-3 mt-3">
                  {brief.goals?.map((goal, i) => (
                    <span key={i} className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg">
                      {goal}
                    </span>
                  ))}
                  <button className="px-4 py-2 rounded-xl border border-dashed border-slate-700 text-[10px] text-slate-600 hover:text-white transition-all">+</button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Infrastructure Stack</label>
                <div className="flex flex-wrap gap-3 mt-3">
                  {brief.tools?.map((tool, i) => (
                    <span key={i} className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-[11px] font-bold shadow-lg">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-950/60 p-8 rounded-[40px] border border-slate-800 shadow-inner">
                <div className="flex justify-between items-center mb-6">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Risk Profile</label>
                   <span className={`w-2 h-2 rounded-full animate-pulse ${brief.riskLevel === 'High' ? 'bg-red-500 shadow-[0_0_10px_red]' : brief.riskLevel === 'Medium' ? 'bg-orange-500 shadow-[0_0_10px_orange]' : 'bg-green-500 shadow-[0_0_10px_green]'}`}></span>
                </div>
                <select
                  value={brief.riskLevel}
                  onChange={(e) => setBrief({ ...brief, riskLevel: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-xs font-black text-slate-200 outline-none mb-6"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <p className="text-[10px] text-slate-600 leading-relaxed font-medium uppercase tracking-tighter">Gemini suggests a <span className="text-indigo-400 font-black">{brief.riskLevel} Risk Gate</span> due to tool integration complexity and data sensitivity.</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Strategic Value (Pricing)</label>
                <input
                  type="text"
                  value={brief.budget}
                  onChange={(e) => setBrief({ ...brief, budget: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 font-black outline-none shadow-inner tracking-tight"
                  placeholder="e.g. $1,200 / month"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-6 pt-10">
            <button onClick={() => setStep(1)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-500 font-black py-6 rounded-[28px] transition-all uppercase tracking-widest text-[10px] border border-slate-800">
              Recalibrate Intake
            </button>
            <button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-6 rounded-[28px] shadow-2xl shadow-indigo-600/30 transition-all uppercase tracking-widest text-[10px] border border-indigo-400/20 active:scale-95">
              Confirm Analysis
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Roadmap Preview */}
      {step === 3 && (
        <div className="bg-slate-800/40 border border-slate-700/50 p-12 rounded-[56px] space-y-12 shadow-2xl animate-in fade-in slide-in-from-right duration-700">
           <div className="text-center space-y-4">
              <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Execution Roadmap</h3>
              <p className="text-slate-500 text-sm font-medium">Initialization parameters locked. Project is ready for board assignment.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Intake Phase', status: 'Completed', icon: '📥', color: 'bg-green-500' },
                { label: 'Board Review', status: 'Pending', icon: '🏛️', color: 'bg-indigo-500' },
                { label: 'Infrastructure', status: 'Staged', icon: '⚡', color: 'bg-slate-800' },
                { label: 'Go-Live Sync', status: 'Scheduled', icon: '🚀', color: 'bg-slate-800' }
              ].map((m, i) => (
                <div key={i} className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 flex flex-col items-center text-center">
                   <div className="text-3xl mb-4">{m.icon}</div>
                   <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{m.label}</p>
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{m.status}</span>
                   <div className={`w-full h-1 mt-6 rounded-full ${m.color}`}></div>
                </div>
              ))}
           </div>

           <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[40px] flex items-center justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
              <div className="relative z-10">
                 <h4 className="text-lg font-black text-white tracking-tight">Handshake Initialization Ready</h4>
                 <p className="text-slate-500 text-xs font-medium mt-1">Ready to create cluster records for <span className="text-white font-bold">{brief.clientName}</span>.</p>
              </div>
              <button 
                onClick={handleFinalSubmit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-5 rounded-[24px] transition-all shadow-2xl shadow-indigo-600/30 uppercase tracking-[0.2em] text-[10px] active:scale-95 border border-indigo-400/20 relative z-10"
              >
                Launch Operation Hub
              </button>
           </div>
           
           <button onClick={() => setStep(2)} className="w-full text-[10px] font-black text-slate-700 hover:text-slate-500 uppercase tracking-[0.4em] transition-all mt-4">Back to Analysis</button>
        </div>
      )}
    </div>
  );
};

export default IntakeWizard;
