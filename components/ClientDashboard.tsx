
import React from 'react';
import { Project, ProjectDocument, Workflow } from '../types';
import { useI18n } from '../services/i18n';

interface ClientDashboardProps {
  projects: Project[];
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ projects }) => {
  const { language, tt } = useI18n();
  const activeWorkflows = projects.flatMap(p => p.activeWorkflows);
  const totalBilled = projects.reduce((acc, p) => acc + p.totalBilled, 0);
  const totalHoursSaved = projects.reduce((acc, p) => acc + (p.financials?.hoursSaved || 0), 0);
  const estimatedSavings = totalHoursSaved * 50;

  const docTypeLabel = (type: ProjectDocument['type']) => {
    const map: Record<ProjectDocument['type'], { en: string; tr: string }> = {
      Proposal: { en: 'Proposal', tr: 'Teklif' },
      SOW: { en: 'SOW', tr: 'SOW' },
      Invoice: { en: 'Invoice', tr: 'Fatura' },
      Contract: { en: 'Contract', tr: 'Sözleşme' },
      Report: { en: 'Report', tr: 'Rapor' },
    };
    return map[type][language];
  };

  const complexityLabel = (c: Workflow['complexity']) => {
    const map: Record<Workflow['complexity'], { en: string; tr: string }> = {
      Low: { en: 'Low', tr: 'Düşük' },
      Medium: { en: 'Medium', tr: 'Orta' },
      High: { en: 'High', tr: 'Yüksek' },
    };
    return map[c][language];
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      {/* Executive Welcome */}
      <div className="flex justify-between items-end bg-slate-800/20 p-10 rounded-[48px] border border-slate-700/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
           <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0,50 Q25,45 50,30 T100,10 L100,100 L0,100 Z" fill="#3b82f6" />
           </svg>
        </div>
        <div className="relative z-10">
           <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{tt('Growth Hub', 'Büyüme Merkezi')}</h2>
           <p className="text-slate-500 font-medium text-lg">{tt('Performance summary and automation ROI for your business units.', 'İş birimlerin için performans özeti ve otomasyon ROI.')}</p>
        </div>
        <div className="flex gap-4 relative z-10">
           <div className="bg-slate-900/80 px-8 py-4 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col items-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{tt('Active Units', 'Aktif Birimler')}</p>
              <p className="text-2xl font-black text-white">{activeWorkflows.length}</p>
           </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-slate-800/40 p-8 rounded-[40px] border border-slate-700/50 group hover:border-blue-500/50 transition-all relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-600/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex justify-between items-center mb-8">
             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-800">⚡</div>
             <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-4 py-1.5 rounded-full uppercase tracking-tighter border border-green-500/20 shadow-sm">{tt('Operational', 'Operasyonel')}</span>
          </div>
          <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{tt('System Health Index', 'Sistem Sağlığı')}</h3>
          <p className="text-5xl font-black text-white tracking-tighter">99.98%</p>
          <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest flex items-center gap-2">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
             {tt('Real-time Node Status', 'Gerçek zamanlı node durumu')}
          </p>
        </div>
        
        <div className="bg-slate-800/40 p-8 rounded-[40px] border border-slate-700/50 group hover:border-blue-500/50 transition-all relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex justify-between items-center mb-8">
             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-800">📊</div>
             <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-full uppercase tracking-tighter border border-blue-500/20 shadow-sm">{tt('Syncing', 'Senkron')}</span>
          </div>
          <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{tt('Efficiency Savings', 'Verim Tasarrufu')}</h3>
          <p className="text-5xl font-black text-white tracking-tighter">${estimatedSavings.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">
            ~{totalHoursSaved} {tt('Manual Hours Displaced', 'manuel saat otomatikleştirildi')}
          </p>
        </div>

        <div className="bg-slate-800/40 p-8 rounded-[40px] border border-slate-700/50 group hover:border-blue-500/50 transition-all relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex justify-between items-center mb-8">
             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-800">💎</div>
             <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full uppercase tracking-tighter border border-indigo-500/20 shadow-sm">{tt('ROI Target', 'ROI Hedefi')}</span>
          </div>
          <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{tt('Automation Yield', 'Otomasyon Getirisi')}</h3>
          <p className="text-5xl font-black text-white tracking-tighter">4.2x</p>
          <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">{tt('Return on Infrastructure Spend', 'Altyapı harcamasına göre geri dönüş')}</p>
        </div>
      </div>

      {/* Main Grid: Units & Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] overflow-hidden flex flex-col shadow-2xl min-h-[600px]">
           <div className="p-10 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Operational Units', 'Operasyon Birimleri')}</h2>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mt-1">{tt('Live Automated Logic Cores', 'Canlı otomasyon modülleri')}</p>
              </div>
              <div className="flex gap-2">
                 <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></div>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
              {activeWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 py-20">
                  <div className="text-7xl mb-6">🧩</div>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">{tt('No active units discovered', 'Aktif birim bulunamadı')}</p>
                </div>
              ) : (
                activeWorkflows.map(wf => (
                  <div key={wf.id} className="bg-slate-950/60 border border-slate-800 p-8 rounded-[32px] flex justify-between items-center group hover:border-blue-500/30 transition-all shadow-lg hover:-translate-y-1">
                    <div>
                      <p className="text-xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">{wf.name}</p>
                      <div className="flex items-center gap-3 mt-2">
                         <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{tt('Status: Nominal', 'Durum: Normal')}</span>
                         <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                         <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{complexityLabel(wf.complexity)} {tt('Logic', 'Mantık')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="w-1.5 h-8 bg-blue-500/20 rounded-full animate-pulse" style={{ animationDelay: `${i * 150}ms` }}></div>
                      ))}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] overflow-hidden flex flex-col shadow-2xl min-h-[600px]">
           <div className="p-10 border-b border-slate-700/50 bg-slate-800/80">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Strategic Artifacts', 'Dokümanlar')}</h2>
              <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mt-1">{tt('Intelligence Reports & Financials', 'Raporlar ve finansal çıktılar')}</p>
           </div>
           <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
              {projects.flatMap(p => p.documents).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 py-20">
                  <div className="text-7xl mb-6">📂</div>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">{tt('Awaiting reporting cycle', 'Raporlama döngüsü bekleniyor')}</p>
                </div>
              ) : (
                projects.flatMap(p => p.documents).map(doc => (
                  <div key={doc.id} className="bg-slate-950/60 border border-slate-800 p-8 rounded-[32px] flex justify-between items-center group cursor-pointer hover:border-indigo-500/30 transition-all shadow-lg hover:-translate-y-1">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-slate-900 rounded-[22px] flex items-center justify-center text-2xl shadow-inner border border-slate-800 group-hover:bg-slate-800 transition-all">
                        {doc.type === 'Report' ? '📊' : doc.type === 'Invoice' ? '💰' : '📜'}
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-200 group-hover:text-indigo-400 transition-colors tracking-tight">{doc.name}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                          {docTypeLabel(doc.type as ProjectDocument['type'])} • {tt('Released', 'Tarih')}{' '}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="text-[10px] font-black text-slate-500 group-hover:text-white transition-all uppercase tracking-[0.2em] border border-slate-800 px-5 py-2.5 rounded-xl hover:bg-slate-800">
                      {tt('ACCESS', 'AÇ')}
                    </button>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {/* ROI Deep Dive (Visual Decoration) */}
      <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-[60px] p-12 shadow-inner relative overflow-hidden">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full -mr-32 -mt-32"></div>
         <div className="flex flex-col md:flex-row justify-between items-center gap-12 relative z-10">
            <div className="max-w-xl">
               <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-6">{tt('Automation ROI Multiplier', 'Otomasyon ROI Çarpanı')}</h3>
               <p className="text-slate-400 leading-relaxed text-lg font-medium">
                 {tt(
                   'Your current automation suite is displacing manual labor equivalent to',
                   'Mevcut otomasyon paketiniz aylık olarak',
                 )}{' '}
                 <span className="text-white font-bold">{totalHoursSaved} {tt('hours', 'saat')}</span>{' '}
                 {tt(
                   'per month, representing a monthly operational dividend of',
                   'manuel işi ortadan kaldırıyor; aylık operasyonel kazanç yaklaşık',
                 )}{' '}
                 <span className="text-green-400 font-bold">${estimatedSavings.toLocaleString()}</span>.
               </p>
            </div>
            <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-6">
               {[
                 { label: tt('Time Saved', 'Zaman Tasarrufu'), val: `${totalHoursSaved}h` },
                 { label: tt('Task Yield', 'Görev Verimi'), val: '12.4k' },
                 { label: tt('Error Rate', 'Hata Oranı'), val: '<0.1%' },
                 { label: tt('Net Profit', 'Net Kâr'), val: '+$4.8k' }
               ].map((m, i) => (
                 <div key={i} className="bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{m.label}</p>
                    <p className="text-2xl font-black text-white">{m.val}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
