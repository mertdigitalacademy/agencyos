
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Project, Workflow, ProjectDocument, ExecutionLog, OperatorMessage, CRMActivity, ProjectIncident } from '../types';
import { getOperatorResponse, generateStrategicAdvice, generateProposal, generateSOW, analyzeStrategicPivot } from '../services/gemini';

interface ProjectDetailProps {
  project: Project;
  onUpdate: (project: Project) => void;
  onOpenCouncil: (id: string, gate?: string) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onUpdate, onOpenCouncil }) => {
  const [activeTab, setActiveTab] = useState<'Workflows' | 'Operator' | 'CRM' | 'Documents' | 'Financials' | 'Monitoring' | 'Settings'>('Workflows');
  const [deployedWfs, setDeployedWfs] = useState<Set<string>>(new Set(project.activeWorkflows.filter(w => project.status === 'Live').map(w => w.id)));
  const [viewingDoc, setViewingDoc] = useState<ProjectDocument | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [operatorInput, setOperatorInput] = useState('');
  const [isOperatorThinking, setIsOperatorThinking] = useState(false);
  const [strategicAdvice, setStrategicAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState<'Proposal' | 'SOW' | null>(null);
  const [pivotAnalysis, setPivotAnalysis] = useState<{ assessment: string, recommendation: string, urgency: number } | null>(null);
  const [isPivoting, setIsPivoting] = useState(false);
  
  // Voice/Live API Refs
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [liveLog]);

  useEffect(() => {
    const fetchAdvice = async () => {
      setIsLoadingAdvice(true);
      const advice = await generateStrategicAdvice(project);
      setStrategicAdvice(advice);
      setIsLoadingAdvice(false);
    };
    if (activeTab === 'Workflows' || activeTab === 'Financials') fetchAdvice();
  }, [project.id, project.status, activeTab]);

  // Telemetry Matrix Animation Logic
  const [matrixData, setMatrixData] = useState<number[]>(Array.from({ length: 48 }, () => Math.random()));
  useEffect(() => {
    if (activeTab === 'Monitoring') {
      const interval = setInterval(() => {
        setMatrixData(prev => prev.map(v => Math.random() > 0.9 ? Math.random() : v));
        if (Math.random() > 0.7) {
          addLiveLog(`Telemetry sync: Node cluster ${Math.floor(Math.random() * 5)} heart-beat nominal.`);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Audio Encoding/Decoding Helpers
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const createBlob = (data: Float32Array): Blob => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      setIsVoiceActive(false);
      sessionRef.current?.close();
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      sourcesRef.current.forEach(s => s.stop());
      sourcesRef.current.clear();
      addLiveLog("Voice Link Closed.");
      return;
    }

    try {
      setIsVoiceActive(true);
      addLiveLog("Initiating Secure Voice Link to Cluster-Gemini...");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
            addLiveLog("Voice Handshake Stable. Operator Listening.");
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            addLiveLog("Error: Voice protocol collision detected.");
          },
          onclose: () => setIsVoiceActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are the AgencyOS Voice Operator. You help manage project: ${project.brief.clientName}. Command keywords: 'deploy', 'status', 'invoice'. Be technical, concise, and professional.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error(e);
      setIsVoiceActive(false);
      addLiveLog("Voice Link Failed: Permission denied or API unreachable.");
    }
  };

  const addLiveLog = (msg: string) => {
    setLiveLog(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSynthesize = async (type: 'Proposal' | 'SOW') => {
    setIsSynthesizing(type);
    addLiveLog(`Synthesizing strategic ${type} via Board-AI...`);
    try {
      const content = type === 'Proposal' ? await generateProposal(project.brief) : await generateSOW(project);
      const newDoc: ProjectDocument = {
        id: `doc-${Date.now()}`,
        name: `${type}: ${project.brief.clientName}`,
        type,
        status: 'Draft',
        content,
        url: '#',
        createdAt: new Date().toISOString()
      };
      onUpdate({ ...project, documents: [newDoc, ...project.documents] });
      addLiveLog(`${type} generated and archived in Cluster Repository.`);
    } catch (e) {
      addLiveLog(`Synthesis failed: Logic mismatch.`);
    } finally {
      setIsSynthesizing(null);
    }
  };

  const handleStrategicPivot = async () => {
    setIsPivoting(true);
    addLiveLog("Running Strategic Pivot Analysis for project node...");
    try {
      const analysis = await analyzeStrategicPivot(project);
      setPivotAnalysis(analysis);
    } catch (e) {
      addLiveLog("Pivot analysis failed.");
    } finally {
      setIsPivoting(false);
    }
  };

  const handleOperatorSend = async () => {
    if (!operatorInput.trim() || isOperatorThinking) return;
    setIsOperatorThinking(true);
    const userMsg: OperatorMessage = { id: `msg-${Date.now()}`, role: 'user', content: operatorInput };
    onUpdate({ ...project, operatorChat: [...project.operatorChat, userMsg] });
    setOperatorInput('');
    try {
      const res = await getOperatorResponse(operatorInput, project);
      const aiMsg: OperatorMessage = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: res.content };
      onUpdate({ ...project, operatorChat: [...project.operatorChat, userMsg, aiMsg] });
    } catch (e) {
      addLiveLog("Operator node sync failed: Cluster timed out.");
    } finally {
      setIsOperatorThinking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      {/* High-Fi Project Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-[40px] p-10 flex flex-wrap gap-12 items-center relative overflow-hidden shadow-2xl group">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
        <div className="flex-1 min-w-[300px] relative z-10">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
             <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Instance: {project.id.slice(0, 8)}</h2>
          </div>
          <h2 className="text-white text-5xl font-black leading-tight tracking-tighter uppercase mb-6 group-hover:text-indigo-400 transition-colors">{project.brief.clientName}</h2>
          <p className="text-slate-400 text-lg max-w-xl leading-relaxed font-medium">{project.brief.description}</p>
        </div>
        <div className="flex flex-col gap-4 relative z-10">
          <button onClick={() => onOpenCouncil(project.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[24px] font-black transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3 border border-indigo-400/20 active:scale-95 group/btn">
            <span className="text-2xl group-hover:rotate-12 transition-transform">🏛️</span> Council Gate
          </button>
          <button onClick={toggleVoiceMode} className={`px-10 py-5 rounded-[24px] font-black transition-all shadow-xl flex items-center gap-3 border active:scale-95 ${isVoiceActive ? 'bg-red-600/20 border-red-500/30 text-red-400 animate-pulse' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}>
             <span className="text-2xl">{isVoiceActive ? '🛑' : '🎙️'}</span> {isVoiceActive ? 'Voice Active' : 'Voice Operator'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <div className="flex gap-12 border-b border-slate-800/50 px-4 overflow-x-auto no-scrollbar">
            {(['Workflows', 'Operator', 'CRM', 'Documents', 'Financials', 'Monitoring', 'Settings'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-5 font-black text-xs uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
                {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-500 rounded-full shadow-[0_0_15px_#6366f1]"></div>}
              </button>
            ))}
          </div>

          <div className="min-h-[600px] pt-4">
            {activeTab === 'Workflows' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                {project.activeWorkflows.map(wf => (
                  <div key={wf.id} className="bg-slate-800/40 border border-slate-700 p-10 rounded-[48px] flex flex-col justify-between transition-all group shadow-xl hover:border-indigo-500/30">
                    <div>
                      <h4 className="font-black text-white text-3xl tracking-tighter uppercase mb-4">{wf.name}</h4>
                      <p className="text-slate-400 text-base leading-relaxed mb-8">{wf.description}</p>
                      <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
                         <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Credentials Staged</h5>
                         <div className="flex flex-wrap gap-3">
                           {wf.credentials.map(c => <span key={c} className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/10 uppercase tracking-widest">{c}</span>)}
                         </div>
                      </div>
                    </div>
                    <button className="w-full bg-slate-900 border border-slate-800 text-slate-400 py-6 rounded-3xl mt-8 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all shadow-lg active:scale-95">Health Status: Nominal 100%</button>
                  </div>
                ))}
                {project.activeWorkflows.length === 0 && (
                  <div className="col-span-2 py-40 text-center bg-slate-800/20 rounded-[60px] border-2 border-dashed border-slate-800">
                     <p className="text-slate-600 font-black uppercase tracking-widest">No workflows deployed to cluster node.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Operator' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden flex flex-col h-[750px] shadow-2xl relative">
                  <div className="p-8 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-3xl border border-indigo-400/20 shadow-2xl">🤖</div>
                        <div>
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">n8n MCP Cluster Operator</h3>
                          <div className="flex items-center gap-3"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Node: W-A1-04</span></div>
                        </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-slate-950/40 custom-scrollbar relative z-10 no-scrollbar">
                    {project.operatorChat.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-[32px] p-8 shadow-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-indigo-600/20' : msg.role === 'system' ? 'bg-slate-800/30 text-slate-500 text-center w-full text-[10px] font-mono tracking-widest uppercase border border-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'}`}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-10 bg-slate-900/95 border-t border-slate-800 flex gap-6 relative z-10">
                    <input type="text" value={operatorInput} onChange={(e) => setOperatorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOperatorSend()} placeholder="Command node cluster..." className="flex-1 bg-slate-950 border border-slate-800 rounded-[24px] px-8 py-6 text-sm text-white outline-none focus:ring-4 focus:ring-indigo-500/10 font-medium tracking-tight shadow-inner" />
                    <button onClick={handleOperatorSend} className="bg-indigo-600 hover:bg-indigo-500 text-white px-14 rounded-[24px] font-black uppercase tracking-widest text-xs border border-indigo-400/20 shadow-xl shadow-indigo-600/20 transition-all active:scale-95">Execute</button>
                  </div>
              </div>
            )}

            {activeTab === 'Monitoring' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-slate-900 border border-slate-800 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                      <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
                      Operational Telemetry Hub
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                      {[
                        { label: 'Latency', val: '42ms', color: 'green' },
                        { label: 'Throughput', val: '1.2k/m', color: 'blue' },
                        { label: 'Worker Load', val: '14%', color: 'indigo' },
                        { label: 'Memory', val: '0.8gb', color: 'green' }
                      ].map((stat) => (
                        <div key={stat.label} className="bg-slate-950/60 p-6 rounded-3xl border border-slate-800 shadow-inner group hover:border-indigo-500/30 transition-all">
                           <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{stat.label}</p>
                           <p className={`text-2xl font-black text-${stat.color}-400`}>{stat.val}</p>
                        </div>
                      ))}
                   </div>
                   
                   <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-10 mb-10 shadow-inner">
                        <div className="flex justify-between items-center mb-8">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Node Propagation Matrix</h4>
                            <div className="flex gap-2">
                                {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-500/50 rounded-full animate-ping" style={{ animationDelay: `${i*200}ms` }}></div>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-12 gap-3">
                            {matrixData.map((val, i) => (
                                <div key={i} className={`h-10 rounded-lg transition-all duration-700 shadow-xl ${val > 0.9 ? 'bg-red-500/40 animate-pulse' : val > 0.4 ? 'bg-indigo-500/30' : 'bg-slate-900 border border-slate-800'}`}></div>
                            ))}
                        </div>
                   </div>

                   <div className="h-48 bg-slate-950 rounded-3xl border border-slate-800 p-8 font-mono text-[10px] text-slate-600 overflow-y-auto no-scrollbar shadow-inner relative custom-scrollbar">
                      {liveLog.length === 0 ? "Establishing telemetry link to operational cluster..." : liveLog.map((log, i) => <p key={i} className="mb-2 hover:text-green-400 transition-colors cursor-default animate-in slide-in-from-left-2 duration-300">❯ {log}</p>)}
                      <div ref={logEndRef} />
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'Documents' && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-[48px] overflow-hidden animate-in fade-in duration-500 h-[750px] flex flex-col shadow-2xl">
                <div className="p-10 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Strategic Artifact Archives</h3>
                    <div className="flex gap-4">
                        <button onClick={() => handleSynthesize('Proposal')} disabled={!!isSynthesizing} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-indigo-400/20 hover:bg-indigo-500 transition-all disabled:opacity-50 active:scale-95">
                            {isSynthesizing === 'Proposal' ? 'Synthesizing...' : 'Draft Proposal'}
                        </button>
                        <button onClick={() => handleSynthesize('SOW')} disabled={!!isSynthesizing} className="bg-slate-800 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50 active:scale-95">
                            {isSynthesizing === 'SOW' ? 'Synthesizing...' : 'Draft SOW'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-10 py-6">Artifact</th>
                                <th className="px-10 py-6">Status</th>
                                <th className="px-10 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                            {project.documents.map((doc) => (
                                <tr key={doc.id} className="group hover:bg-indigo-600/5 transition-all cursor-pointer" onClick={() => setViewingDoc(doc)}>
                                    <td className="px-10 py-7">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{doc.type === 'Invoice' ? '💰' : doc.type === 'Proposal' ? '📜' : '🖋️'}</span>
                                            <div>
                                                <p className="text-sm font-black text-slate-200 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{doc.name}</p>
                                                <p className="text-[9px] text-slate-600 font-bold uppercase mt-1 tracking-widest">{doc.type}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7">
                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${doc.status === 'Sent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-700/50 text-slate-500 border-slate-700'}`}>{doc.status}</span>
                                    </td>
                                    <td className="px-10 py-7 text-right">
                                        <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-all">Open Artifact</button>
                                    </td>
                                </tr>
                            ))}
                            {project.documents.length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs">No strategic artifacts found in cluster archives.</td>
                              </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'Financials' && (
              <div className="space-y-12 animate-in fade-in duration-700">
                 <div className="bg-slate-800/30 p-12 rounded-[40px] border border-slate-700/50 flex justify-between items-center shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 blur-[100px] rounded-full"></div>
                    <div className="relative z-10">
                       <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Resource ROI Matrix</h3>
                       <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Project-Level Performance Multiplier</p>
                    </div>
                    <button className="bg-green-600 hover:bg-green-500 text-white text-[11px] font-black px-10 py-5 rounded-3xl shadow-xl transition-all active:scale-95 uppercase tracking-widest border border-green-400/20">Sync Stripe Revenue</button>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-green-500/30 transition-all">
                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">Projected Value</p>
                       <p className="text-5xl font-black text-white tracking-tighter">${project.financials.revenue.toLocaleString()}</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-indigo-500/30 transition-all">
                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">Labor Efficiency</p>
                       <p className="text-5xl font-black text-indigo-400 tracking-tighter">{project.financials.hoursSaved}h <span className="text-xs uppercase font-black text-slate-500">Saved</span></p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-orange-500/30 transition-all">
                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">Execution Yield</p>
                       <p className="text-5xl font-black text-white tracking-tighter">{(project.financials.revenue / (project.totalBilled || 1)).toFixed(2)}x</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="xl:col-span-4 space-y-8">
           <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[80px] rounded-full"></div>
              <div className="flex items-center gap-6 mb-10">
                 <div className="w-16 h-16 bg-indigo-600 rounded-[28px] flex items-center justify-center text-3xl shadow-2xl border border-indigo-400/20 group-hover:rotate-6 transition-transform">🧠</div>
                 <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Strategic Advisor</h3>
                    <p className="text-white font-black text-sm tracking-tight mt-1 uppercase">Node Intelligence Feed</p>
                 </div>
              </div>
              <p className="text-indigo-100/80 leading-[1.8] text-sm font-medium italic">
                "{isLoadingAdvice ? "Recalibrating throughput data..." : strategicAdvice || "Analyzing operational cluster data..."}"
              </p>
              <button onClick={() => setIsLoadingAdvice(true)} className="mt-10 w-full text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest border border-indigo-500/20 py-4 rounded-2xl transition-all">Re-Sync Strategic Engine</button>
           </div>

           <div className="bg-slate-800/40 border border-slate-700 rounded-[40px] p-10 shadow-2xl space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 text-center uppercase tracking-widest">Strategic Controls</h3>
              <button onClick={handleStrategicPivot} disabled={isPivoting} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-indigo-500 transition-all shadow-xl active:scale-95">
                 <span className="text-2xl group-hover:scale-110 transition-transform">📉</span>
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white">{isPivoting ? 'Analyzing Pivot...' : 'Strategic Pivot Analysis'}</span>
                 <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">❯</span>
              </button>
              
              {pivotAnalysis && (
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-[32px] animate-in slide-in-from-top-4 duration-500 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Pivot Urgency</p>
                    <p className="text-xl font-black text-white">{pivotAnalysis.urgency}%</p>
                  </div>
                  <p className="text-[11px] text-indigo-200/70 font-medium leading-relaxed italic">"{pivotAnalysis.recommendation}"</p>
                  <button onClick={() => setPivotAnalysis(null)} className="w-full text-[9px] font-black text-indigo-500/50 uppercase tracking-widest hover:text-white pt-4">Dismiss Analysis</button>
                </div>
              )}

              <button onClick={() => handleSynthesize('SOW')} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-indigo-500 transition-all shadow-xl active:scale-95">
                 <span className="text-2xl group-hover:scale-110 transition-transform">🖋️</span>
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white">Synthesize Technical SOW</span>
                 <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">❯</span>
              </button>
           </div>
        </div>
      </div>

      {/* Artifact Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-[#0f172a] border border-slate-800 rounded-[60px] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500">
             <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/95">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-2xl border border-slate-700">
                       {viewingDoc.type === 'Invoice' ? '💰' : '📄'}
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{viewingDoc.name}</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">Classified Strategic Artifact • Archive Node {project.id.slice(0,6)}</p>
                   </div>
                </div>
                <button onClick={() => setViewingDoc(null)} className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center text-3xl font-light shadow-xl">&times;</button>
             </div>
             <div className="flex-1 overflow-y-auto p-20 text-slate-300 leading-relaxed font-serif text-xl bg-[#020617]/40 custom-scrollbar">
                <div className="max-w-3xl mx-auto whitespace-pre-wrap leading-[1.8] prose prose-invert">
                   {viewingDoc.content || "Artifact synchronization failed. Re-generation required."}
                </div>
             </div>
             <div className="p-10 border-t border-slate-800 bg-[#0f172a]/95 flex justify-end gap-6">
                <button onClick={() => setViewingDoc(null)} className="px-10 py-4 rounded-2xl text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Close Archive</button>
                <button className="px-12 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all">Secure Download</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
