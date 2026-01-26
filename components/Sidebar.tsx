
import React, { useState, useEffect, useMemo } from 'react';
import { View, WorkspaceType } from '../types';
import { NAV_ITEMS, NAV_ITEMS_SIMPLE } from '../constants';
import { writeOnboardingState, type UIMode } from '../services/onboarding';
import { useI18n } from '../services/i18n';

interface SidebarProps {
  currentView: View;
  workspaceType: WorkspaceType;
  onWorkspaceChange: (type: WorkspaceType) => void;
  onNavigate: (view: View) => void;
  uiMode: UIMode;
  onUIModeChange: (mode: UIMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, workspaceType, onWorkspaceChange, onNavigate, uiMode, onUIModeChange }) => {
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const { language, setLanguage, tt } = useI18n();

  useEffect(() => {
    const logs = [
      tt('AI CEO: Outreach plan updated', 'AI CEO: Outreach planı güncellendi'),
      tt('Lead Hub: Imported new leads', 'Lead Merkezi: Yeni lead’ler aktarıldı'),
      tt('Pitch engine: Draft ready', 'Pitch motoru: Taslak hazır'),
      tt('Revenue Journey: Task completed', 'Gelir Yolculuğu: Görev tamamlandı'),
      tt('Market Radar: New opportunities scanned', 'Market Radar: Yeni fırsatlar tarandı'),
      tt('YouTube: Ideas generated', 'YouTube: Fikirler üretildi'),
      tt('Assistant memory: Preferences saved', 'Asistan hafıza: Tercihler kaydedildi'),
      tt('System: Local mode stable', 'Sistem: Local mod stabil'),
    ];

    const interval = setInterval(() => {
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setTelemetry(prev => [randomLog, ...prev].slice(0, 3));
    }, 4000);

    return () => clearInterval(interval);
  }, [tt]);

  const items = useMemo(() => {
    // Simple mode uses simplified navigation
    if (uiMode === 'simple') {
      return NAV_ITEMS_SIMPLE;
    }

    // Advanced mode shows all items
    if (uiMode === 'advanced') return NAV_ITEMS;

    // Default mode (moderate)
    const allowed = new Set<View>([
      View.HOME,
      View.SETUP,
      View.GUIDED_JOURNEY,
      View.AGENCY_BUILDER,
      View.JOURNEY,
      View.ASSISTANT,
      View.PASSIVE_HUB,
      View.DASHBOARD,
      View.PROPOSALS,
      View.SALES_PIPELINE,
      View.PROJECTS,
      View.MONEY,
      View.BOARD_STUDIO,
      View.INTAKE,
    ]);
    return NAV_ITEMS.filter((i) => allowed.has(i.id as View));
  }, [uiMode]);

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col min-h-0">
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
            {tt('AGENCY', 'AJANS')}
           </button>
           <button 
            onClick={() => onWorkspaceChange(WorkspaceType.CLIENT)}
            className={`flex-1 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest ${workspaceType === WorkspaceType.CLIENT ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
            {tt('CLIENT', 'MÜŞTERİ')}
           </button>
        </div>
      </div>
      
      <nav className="flex-1 min-h-0 overflow-y-auto p-6 space-y-3 mt-4">
        {workspaceType === WorkspaceType.AGENCY ? (
          items.map((item) => (
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
              <span className="font-bold text-sm tracking-tight">{item.label[language]}</span>
            </button>
          ))
        ) : (
          /* Simplified Client Nav */
          <>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-xl">
              <span className="text-2xl">📊</span>
              <span className="font-bold text-sm tracking-tight">{tt('Overview', 'Özet')}</span>
            </button>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left text-slate-500 hover:bg-slate-900">
              <span className="text-2xl">📄</span>
              <span className="font-bold text-sm tracking-tight">{tt('My Reports', 'Raporlarım')}</span>
            </button>
            <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left text-slate-500 hover:bg-slate-900">
              <span className="text-2xl">💰</span>
              <span className="font-bold text-sm tracking-tight">{tt('Billing', 'Faturalama')}</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-6 border-t border-slate-800 space-y-6">
        {/* UI Mode Toggle */}
        {workspaceType === WorkspaceType.AGENCY && (
          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800 shadow-inner">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{tt('UI Mode', 'Arayüz Modu')}</p>
            <div className="mt-4 flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
              {(['simple', 'advanced'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onUIModeChange(mode);
                    writeOnboardingState({ uiMode: mode });
                  }}
                  className={`flex-1 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest ${
                    uiMode === mode ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {mode === 'simple' ? tt('SIMPLE', 'BASİT') : tt('ADVANCED', 'GELİŞMİŞ')}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-600 font-bold">
              {uiMode === 'simple'
                ? tt('Hides advanced panels (Workflows/Settings).', 'Gelişmiş panelleri gizler (Workflow/Ayarlar).')
                : tt('Shows all panels.', 'Tüm panelleri gösterir.')}
            </p>
          </div>
        )}

        {/* Language Toggle */}
        <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800 shadow-inner">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{tt('Language', 'Dil')}</p>
          <div className="mt-4 flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`flex-1 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest ${
                  language === l ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {l === 'tr' ? 'TR' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        {/* Live Telemetry Ticker */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{tt('Global Telemetry', 'Global Telemetri')}</p>
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
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Cluster Node-A1', 'Cluster Düğümü-A1')}</p>
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 w-[65%] shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
          </div>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">{tt('65% Sales Engine Load', '%65 Satış Motoru Yükü')}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
