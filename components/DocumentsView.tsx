
import React, { useState } from 'react';
import { Project, ProjectDocument } from '../types';

interface DocumentsViewProps {
  projects: Project[];
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ projects }) => {
  const [filterType, setFilterType] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const allDocs = projects.flatMap(p => p.documents.map(d => ({ ...d, clientName: p.brief.clientName, projectId: p.id })));
  const filteredDocs = allDocs.filter(d => {
    const matchesType = filterType === 'All' || d.type === filterType;
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
      <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-700/50 flex flex-wrap items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -ml-32 -mt-32"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white tracking-tight">Agency Archives</h2>
          <p className="text-slate-400 mt-2 font-medium">Strategic proposals, SOWs, and fiscal artifacts managed by AgencyOS.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 relative z-10">
           <div className="relative min-w-[300px]">
              <input 
                type="text" 
                placeholder="Search archives..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-12 py-3.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              />
              <span className="absolute left-4 top-4 opacity-30">🔍</span>
           </div>
           <div className="flex bg-slate-900 rounded-2xl p-1.5 border border-slate-800">
            {['All', 'Proposal', 'Invoice', 'Report'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === type 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-[40px] border border-slate-700/50 overflow-hidden shadow-2xl">
        {filteredDocs.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-5xl mb-6 shadow-inner border border-slate-800 opacity-20">📂</div>
            <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">No matching records</h3>
            <p className="text-slate-600 text-sm mt-3">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Strategic Artifact</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Client</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Workflow Status</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sync Date</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredDocs.map((doc, i) => (
                  <tr key={i} className="hover:bg-slate-800/60 transition-all group cursor-default">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-slate-900 rounded-[18px] flex items-center justify-center text-xl shadow-inner border border-slate-800 group-hover:bg-slate-800 transition-all">
                           {doc.type === 'Invoice' ? '💰' : doc.type === 'Proposal' ? '📜' : '📊'}
                        </div>
                        <div>
                          <p className="font-black text-white text-base tracking-tight group-hover:text-blue-400 transition-colors">{doc.name}</p>
                          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{doc.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-xs text-slate-400 font-black uppercase tracking-tight">{doc.clientName}</span>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`text-[9px] font-black px-3.5 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${
                        doc.status === 'Signed' || doc.status === 'Paid'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                          : 'bg-slate-700/50 text-slate-500 border-slate-700'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-xs text-slate-500 font-mono uppercase font-black">{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-10 py-6 text-right space-x-4">
                      <button className="text-[10px] font-black text-slate-600 hover:text-white transition-all uppercase tracking-widest">Preview</button>
                      <button className="text-[10px] font-black text-blue-500 hover:text-blue-400 transition-all uppercase tracking-widest bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10 active:scale-95">Dispatch</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsView;
