
import React from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <nav className="relative z-10 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-blue-600/20">A</div>
          <span className="text-2xl font-bold text-white tracking-tighter uppercase">AgencyOS</span>
        </div>
        <div className="flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Vision</a>
          <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Docs</a>
          <button 
            onClick={onEnter}
            className="bg-white text-slate-950 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-slate-200 transition-all shadow-xl"
          >
            Launch Platform
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom duration-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Next Gen Agency OS v1.0
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tight mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom duration-1000">
          Automate Your Agency.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Scale Without Headcount.</span>
        </h1>
        
        <p className="max-w-2xl text-xl text-slate-400 mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000 delay-200">
          The all-in-one platform for AI automation agencies. From intake to implementation, let Gemini and n8n run your core operations while you focus on high-level growth.
        </p>

        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom duration-1000 delay-300">
          <button 
            onClick={onEnter}
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-600/30 transition-all flex items-center gap-3 active:scale-95"
          >
            Enter Control Room 🚀
          </button>
          <button className="bg-slate-800 hover:bg-slate-700 text-white px-10 py-5 rounded-2xl font-bold text-lg border border-slate-700 transition-all">
            Watch Demo
          </button>
        </div>

        {/* Floating Mockup Preview */}
        <div className="mt-24 w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-2xl relative overflow-hidden animate-in zoom-in duration-1000 delay-500">
           <div className="bg-slate-950 rounded-2xl aspect-video overflow-hidden border border-slate-800 flex flex-col">
              <div className="h-10 border-b border-slate-800 bg-slate-900/80 flex items-center px-4 gap-2">
                 <div className="flex gap-1.5">
                    <div className="w-3 h-3 bg-red-500/50 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500/50 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500/50 rounded-full"></div>
                 </div>
                 <div className="flex-1 bg-slate-800 h-6 rounded-md mx-4"></div>
              </div>
              <div className="flex-1 grid grid-cols-12">
                 <div className="col-span-3 border-r border-slate-800 p-4 space-y-4">
                    <div className="h-4 w-20 bg-slate-800 rounded"></div>
                    <div className="h-8 w-full bg-blue-600/20 rounded-xl"></div>
                    <div className="h-8 w-full bg-slate-800 rounded-xl"></div>
                    <div className="h-8 w-full bg-slate-800 rounded-xl"></div>
                 </div>
                 <div className="col-span-9 p-8">
                    <div className="h-8 w-48 bg-slate-800 rounded mb-8"></div>
                    <div className="grid grid-cols-3 gap-4 mb-8">
                       <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl"></div>
                       <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl"></div>
                       <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl"></div>
                    </div>
                    <div className="h-64 bg-slate-900 border border-slate-800 rounded-3xl"></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
