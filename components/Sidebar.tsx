
import React, { useState, useEffect } from 'react';
import { View, WorkspaceType } from '../types';
import { NAV_ITEMS } from '../constants';

interface SidebarProps {
  currentView: View;
  workspaceType: WorkspaceType;
  onWorkspaceChange: (type: WorkspaceType) => void;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, workspaceType, onWorkspaceChange, onNavigate }) => {
  const [telemetry, setTelemetry] = useState<string[]>([]);

  useEffect(() => {
    const logs = [
      "n8n node heartbeat: active",
      "Syncing SuiteCRM deal status...",
      "Documenso: Signature received",
      "Infisical: Secrets rotation sync",
      "Gemini: Model temperature 0.7",
      "Webhook incoming: Typeform lead",
      "Memory cluster utilization 42%",
      "CPU node-A1 stable 1.2ghz"
    ];

    const interval = setInterval(() => {
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setTelemetry(prev => [randomLog, ...prev].slice(0, 3));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col">
      <div className="p-8 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-600/20 border border-indigo-400/20">A</div>
          <span className="text-2xl font-black text-white tracking-tighter uppercase leading-none">AgencyOS</span>
        </div>

        <div className="bg-slate-900 rounded-[20px] p-1.5 flex border border-slate-800 shadow-inner">
           <button 
            onClick={() => onWorkspaceChange(WorkspaceType.AGENCY)}
            className={`flex-1 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest ${workspaceType === WorkspaceType.AGENCY ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
            AGENCY
           </button>
           <button 
            onClick={() => onWorkspaceChange(WorkspaceType.CLIENT)}
            className={`flex-1 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest ${workspaceType === WorkspaceType.CLIENT ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
            CLIENT
           </button>
        </div>
      </div>
      
      <nav className="flex-1 p-6 space-y-3 mt-4">
        {workspaceType === WorkspaceType.AGENCY ? (
          NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all group ${
                currentView === item.id
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-xl'
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span className={`text-2xl transition-transform duration-300 ${currentView === item.id ? 'scale-110 rotate-3' : 'group-hover:scale-110'}`}>{item.icon}</span>
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
            </button>
          ))
        ) : (
          /* Simplified Client Nav */
          <>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-xl">
              <span className="text-2xl">📊</span>
              <span className="font-bold text-sm tracking-tight">Overview</span>
            </button>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left text-slate-500 hover:bg-slate-900">
              <span className="text-2xl">📄</span>
              <span className="font-bold text-sm tracking-tight">My Reports</span>
            </button>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left text-slate-500 hover:bg-slate-900">
              <span className="text-2xl">💰</span>
              <span className="font-bold text-sm tracking-tight">Billing</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-6 border-t border-slate-800 space-y-6">
        {/* Live Telemetry Ticker */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Global Telemetry</p>
          <div className="space-y-2">
            {telemetry.map((log, i) => (
              <div key={i} className="flex items-start gap-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
                <span className="text-indigo-600 text-[10px] mt-0.5">❯</span>
                <p className="text-[10px] text-slate-500 font-mono leading-tight">{log}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800 shadow-inner">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cluster Node-A1</p>
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 w-[65%] shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
          </div>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">65% n8n Load Factor</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
