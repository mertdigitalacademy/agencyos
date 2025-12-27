
import React, { useState } from 'react';
import { AgencySecret, TeamMember } from '../types';

interface AgencySettingsProps {
  secrets: AgencySecret[];
  onUpdateSecrets: (secrets: AgencySecret[]) => void;
  teamMembers: TeamMember[];
}

const AgencySettings: React.FC<AgencySettingsProps> = ({ secrets, onUpdateSecrets, teamMembers }) => {
  const [activeTab, setActiveTab] = useState<'Infrastructure' | 'Vault' | 'Team'>('Infrastructure');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [activeEnv, setActiveEnv] = useState<'Development' | 'Staging' | 'Production'>('Production');
  const [testingInteg, setTestingInteg] = useState<string | null>(null);

  const handleAddSecret = () => {
    if (!newKey || !newValue) return;
    onUpdateSecrets([...secrets, { id: `sec-${Date.now()}`, key: newKey.toUpperCase(), value: newValue, environment: activeEnv, lastUpdated: new Date().toISOString() }]);
    setNewKey(''); setNewValue('');
  };

  const removeSecret = (id: string) => onUpdateSecrets(secrets.filter(s => s.id !== id));

  const integrations = [
    { id: 'n8n', name: 'n8n Logic Cluster', status: 'Connected', uptime: '100%', version: 'v1.42', icon: '⚡' },
    { id: 'suitecrm', name: 'SuiteCRM Nexus', status: 'Connected', uptime: '99.9%', version: 'v8.5', icon: '👥' },
    { id: 'invoiceshelf', name: 'InvoiceShelf API', status: 'Connected', uptime: '100%', version: 'v2.1', icon: '💰' },
    { id: 'documenso', name: 'Documenso E-Sign', status: 'Standby', uptime: '100%', version: 'v0.9', icon: '🖋️' },
    { id: 'infisical', name: 'Infisical Vault', status: 'Secure', uptime: '100%', version: 'v3.0', icon: '🔒' },
  ];

  const testConnection = (id: string) => {
    setTestingInteg(id);
    setTimeout(() => setTestingInteg(null), 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="bg-slate-800/30 p-12 rounded-[40px] border border-slate-700/50 flex flex-wrap justify-between items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 blur-[120px] rounded-full"></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Agency Infrastructure</h2>
          <p className="text-slate-500 mt-2 font-black uppercase tracking-[0.3em] text-xs">Distributed Resource Protocol • v1.0.4-LTS</p>
        </div>
        <div className="flex gap-4 relative z-10">
           <div className="bg-slate-900/80 px-8 py-5 rounded-3xl border border-slate-700/50 flex flex-col items-center min-w-[140px] shadow-xl">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Vault Secrets</span>
              <span className="text-2xl font-black text-white">{secrets.length}</span>
           </div>
           <div className="bg-slate-900/80 px-8 py-5 rounded-3xl border border-slate-700/50 flex flex-col items-center min-w-[140px] shadow-xl">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Cluster Pulse</span>
              <span className="text-2xl font-black text-green-400">99.9%</span>
           </div>
        </div>
      </div>

      <div className="flex gap-10 border-b border-slate-800/50 px-4">
        {(['Infrastructure', 'Vault', 'Team'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-5 font-black text-xs uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab}
            {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>}
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'Infrastructure' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-8 space-y-8">
               <div className="bg-slate-800/40 border border-slate-700 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 blur-[80px] rounded-full transition-transform duration-1000 group-hover:scale-150"></div>
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-10 flex items-center gap-4 relative z-10">
                    <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></span>
                    Cluster Integration Connectivity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                     {integrations.map(integ => (
                       <div key={integ.id} className="p-8 bg-slate-950/60 rounded-[32px] border border-slate-800 flex justify-between items-center group/card hover:border-indigo-500/40 transition-all shadow-lg hover:-translate-y-1">
                          <div className="flex items-center gap-6">
                             <div className="w-14 h-14 bg-slate-900 rounded-[22px] flex items-center justify-center text-2xl shadow-inner border border-slate-800 group-hover/card:rotate-6 transition-transform">{integ.icon}</div>
                             <div>
                                <p className="text-lg font-black text-white tracking-tight uppercase">{integ.name}</p>
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1.5">{integ.version} • {integ.uptime} Uptime</p>
                             </div>
                          </div>
                          <button onClick={() => testConnection(integ.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${testingInteg === integ.id ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-900 text-slate-500 hover:text-white border-slate-800 hover:border-slate-700'}`}>
                             {testingInteg === integ.id ? 'Testing...' : 'Ping'}
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
            <div className="lg:col-span-4 space-y-8">
               <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[48px] shadow-2xl shadow-indigo-600/30 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                  <div className="relative z-10">
                     <div className="flex justify-between items-start mb-10">
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Billing Tier</h3>
                        <span className="text-[10px] bg-white/20 text-white font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-white/20 shadow-lg">Enterprise Core</span>
                     </div>
                     <p className="text-sm text-indigo-100/90 leading-relaxed mb-10 font-medium italic">"AgencyOS is currently managing 12 global node workers with automated load-balancing active across 4 regions."</p>
                     <button className="w-full bg-white text-indigo-700 font-black py-5 rounded-[24px] text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-white/20">Manage Subscriptions</button>
                  </div>
               </div>
            </div>
          </div>
        )}
        
        {activeTab === 'Vault' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-[48px] p-10 shadow-2xl animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-12">
               <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Infisical Secure Vault</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">E2E Encrypted Secret Management</p>
               </div>
               <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
                  {(['Development', 'Staging', 'Production'] as const).map(env => (
                    <button key={env} onClick={() => setActiveEnv(env)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeEnv === env ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-white'}`}>{env}</button>
                  ))}
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <div className="space-y-4">
                  <input type="text" placeholder="SECRET_KEY" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <input type="password" placeholder="••••••••••••" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <button onClick={handleAddSecret} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95">Provision Secret</button>
                </div>
                <div className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800 shadow-inner">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6">Active Secrets Cluster: {activeEnv}</p>
                   <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
                      {secrets.filter(s => s.environment === activeEnv).map(sec => (
                        <div key={sec.id} className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                           <div>
                              <p className="text-[10px] font-black text-slate-100">{sec.key}</p>
                              <p className="text-[8px] text-slate-600 uppercase font-black mt-1">Updated {new Date(sec.lastUpdated).toLocaleDateString()}</p>
                           </div>
                           <button onClick={() => removeSecret(sec.id)} className="text-[10px] text-red-500/40 hover:text-red-500 transition-all uppercase font-black">Revoke</button>
                        </div>
                      ))}
                      {secrets.filter(s => s.environment === activeEnv).length === 0 && <p className="text-center py-10 text-slate-700 uppercase font-black text-[10px]">Vault empty for this environment.</p>}
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'Team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
             {teamMembers.map(member => (
               <div key={member.id} className="bg-slate-800/40 border border-slate-700 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full"></div>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-slate-800 group-hover:scale-110 transition-transform">{member.avatar}</div>
                     <div>
                        <h4 className="text-xl font-black text-white tracking-tight">{member.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-orange-500'} animate-pulse`}></span>
                           <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{member.role}</span>
                        </div>
                     </div>
                  </div>
                  <div className="space-y-2 mb-8">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Specialization Cluster</p>
                     <div className="flex flex-wrap gap-2">
                        {member.specialization.map(spec => (
                          <span key={spec} className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/10">{spec}</span>
                        ))}
                     </div>
                  </div>
                  <button className="w-full bg-slate-900 border border-slate-800 text-slate-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">Node Configuration</button>
               </div>
             ))}
             <button className="bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-[40px] flex flex-col items-center justify-center py-20 hover:bg-slate-800/40 hover:border-indigo-500/30 transition-all group">
                <span className="text-4xl mb-4 opacity-20 group-hover:opacity-100 group-hover:rotate-12 transition-all">➕</span>
                <span className="text-[10px] font-black text-slate-700 group-hover:text-slate-500 uppercase tracking-[0.4em]">Provision AI Agent</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencySettings;
