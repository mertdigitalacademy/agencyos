import React, { useState, useEffect } from 'react';
import { ProjectBrief } from '../types';
import { analyzeIntake } from '../services/api';
import { INDUSTRY_PRESETS } from '../services/industry';
import { useI18n } from '../services/i18n';
import { CouncilBadge } from './CouncilBadge';
import {
  quickCouncilReview,
  extractRiskLevel,
  buildProjectContext,
  type CouncilReviewResult,
} from '../services/councilHelpers';

interface IntakeWizardProps {
  onComplete: (brief: ProjectBrief) => void;
  initialValue?: string;
}

const IntakeWizard: React.FC<IntakeWizardProps> = ({ onComplete, initialValue }) => {
  const { language, tt } = useI18n();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState(initialValue || '');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: string; data: string; analyzed?: boolean }>>([]);
  const [brief, setBrief] = useState<Partial<ProjectBrief>>({
    clientName: '',
    industry: '',
    goals: [],
    tools: [],
    budget: '',
    riskLevel: 'Medium'
  });

  // Council risk assessment state
  const [councilRiskReview, setCouncilRiskReview] = useState<CouncilReviewResult | null>(null);
  const [isAssessingRisk, setIsAssessingRisk] = useState(false);

  // Request council risk assessment
  const requestCouncilRiskAssessment = async () => {
    setIsAssessingRisk(true);
    try {
      const context = buildProjectContext({
        clientName: brief.clientName || 'Unknown',
        industry: String(brief.industry || ''),
        goals: brief.goals || [],
        budget: brief.budget || 'TBD',
        riskLevel: brief.riskLevel,
      });

      const result = await quickCouncilReview({
        context,
        gateType: 'Risk',
        topic: `Risk Assessment: ${brief.clientName || 'New Project'}`,
        language,
      });

      setCouncilRiskReview(result);

      // Extract and apply risk level from council synthesis
      const suggestedRisk = extractRiskLevel(result.summary);
      setBrief(prev => ({ ...prev, riskLevel: suggestedRisk }));
    } catch (e) {
      console.error('Council risk assessment failed:', e);
    } finally {
      setIsAssessingRisk(false);
    }
  };

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
      clientName: brief.clientName || tt('Unnamed Entity', 'İsimsiz Müşteri'),
      industry: String(brief.industry || '').trim() || undefined,
      description: userInput,
      goals: brief.goals || [],
      tools: brief.tools || [],
      budget: brief.budget || tt('To be calculated', 'Hesaplanacak'),
      riskLevel: brief.riskLevel || 'Medium'
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom duration-700 pb-20">
      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-6 mb-16">
        {[
          { step: 1, label: tt('Intake Brief', 'İntake Özeti') },
          { step: 2, label: tt('AI Synthesis', 'AI Sentez') },
          { step: 3, label: tt('Execution Plan', 'Uygulama Planı') }
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
            <h3 className="text-4xl font-black text-white tracking-tighter uppercase">{tt('Intake Vector', 'İntake Akışı')}</h3>
            <p className="text-slate-500 text-sm font-medium max-w-lg mx-auto leading-relaxed">
              {tt(
                'Describe the operational bottleneck or automation goal. Our Board-AI will extract requirements and risk profiles automatically.',
                'Operasyonel darboğazı veya otomasyon hedefini yaz. Yönetim Kurulu-AI gereksinimleri ve risk profilini otomatik çıkarır.',
              )}
            </p>
          </div>

          <div className="relative z-10 space-y-6">
             <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-[36px] p-10 text-slate-100 text-lg focus:ring-4 focus:ring-indigo-500/20 outline-none resize-none transition-all placeholder:text-slate-700 shadow-inner font-medium leading-relaxed"
                placeholder={tt('Describe your project, tools (n8n, CRM, etc.), and desired outcome...', 'Projeni, kullandığın araçları (n8n, CRM, vb.) ve hedef çıktıyı yaz…')}
              />
              <div className="absolute bottom-6 right-8 text-slate-800 font-mono text-xs uppercase font-black select-none tracking-widest">AgencyOS_Engine_v1.0</div>

              {/* 🎨 Multimodal File Upload */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-[24px] p-6">
                <label className="block text-sm font-semibold text-slate-400 mb-3">
                  {tt('📸 Upload Visuals (Optional)', '📸 Görsel Yükle (Opsiyonel)')}
                </label>
                <p className="text-xs text-slate-600 mb-4">
                  {tt('Upload logo, screenshots, or video brief. AI will extract colors, style, and requirements.', 'Logo, ekran görüntüsü veya video brief yükleyin. AI renkleri, stili ve gereksinimleri çıkaracak.')}
                </p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    for (const file of files) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const base64 = event.target?.result as string;
                        setUploadedFiles(prev => [...prev, {
                          name: file.name,
                          type: file.type,
                          data: base64,
                          analyzed: false
                        }]);

                        // Auto-analyze visual
                        try {
                          const response = await fetch('/api/intake/analyze-visual', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              file: base64.split(',')[1], // Remove data:image/...;base64, prefix
                              mimeType: file.type
                            })
                          });
                          if (response.ok) {
                            const analysis = await response.json();
                            // Auto-fill brief with analysis
                            setBrief(prev => ({
                              ...prev,
                              industry: analysis.industry || prev.industry,
                              goals: analysis.requirements ? [...(prev.goals || []), ...analysis.requirements] : prev.goals
                            }));
                            // Auto-fill input with transcript if video
                            if (analysis.transcript) {
                              setUserInput(prev => prev + '\n\n' + analysis.transcript);
                            }
                            setUploadedFiles(prev => prev.map(f =>
                              f.name === file.name ? { ...f, analyzed: true } : f
                            ));
                          }
                        } catch (err) {
                          console.error('Visual analysis failed:', err);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{file.type.startsWith('video') ? '🎥' : '🖼️'}</span>
                          <div>
                            <div className="text-sm font-medium text-slate-300">{file.name}</div>
                            <div className="text-xs text-slate-600">{file.type}</div>
                          </div>
                        </div>
                        {file.analyzed && (
                          <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                            ✓ {tt('Analyzed', 'Analiz Edildi')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          <button
            onClick={handleAIScan}
            disabled={loading || !userInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-7 rounded-[32px] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-indigo-600/40 active:scale-[0.98] border border-indigo-400/20 uppercase tracking-[0.3em] text-sm relative z-10 overflow-hidden group/btn"
          >
            {loading ? (
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span className="animate-pulse">{tt('Analyzing briefing...', 'Brief analiz ediliyor...')}</span>
                </div>
              ) : (
              <>{tt('Scan & Synchronize Brief 🪄', 'Brief’i Tara ve Senkronla 🪄')}</>
              )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      )}

      {/* Step 2: Parameters Validation */}
      {step === 2 && (
        <div className="bg-slate-800/40 border border-slate-700/50 p-12 rounded-[56px] space-y-12 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="flex justify-between items-center border-b border-slate-700/50 pb-8">
            <h3 className="text-3xl font-black text-white tracking-tighter uppercase">{tt('AI Technical Synthesis', 'AI Teknik Sentez')}</h3>
            <span className="bg-green-500/10 text-green-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-green-500/20 tracking-widest uppercase">{tt('Validated Artifact', 'Doğrulanmış Çıktı')}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
	            <div className="space-y-8">
	              <div>
	                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{tt('Target Identity', 'Müşteri Adı')}</label>
	                <input
	                  type="text"
	                  value={brief.clientName}
	                  onChange={(e) => setBrief({ ...brief, clientName: e.target.value })}
	                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 font-black tracking-tight outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
	                />
	              </div>

	              <div>
	                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{tt('Industry / Sector', 'Sektör')}</label>
	                <input
	                  type="text"
	                  value={String(brief.industry || '')}
	                  onChange={(e) => setBrief({ ...brief, industry: e.target.value })}
	                  list="agencyos-industry-presets"
	                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 font-black tracking-tight outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
	                  placeholder={tt('e.g. e-commerce, marketing ops, automation agency', 'ör. e-ticaret, marketing ops, otomasyon ajansı')}
		                />
		                <datalist id="agencyos-industry-presets">
		                  {INDUSTRY_PRESETS.map((p) => (
		                    <option key={p.id} value={p.label[language]} />
		                  ))}
		                </datalist>
		              </div>

	              <div>
		                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{tt('Strategic Goals', 'Hedefler')}</label>
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{tt('Infrastructure Stack', 'Araç/Stack')}</label>
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
	                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{tt('Operational Risk Profile', 'Operasyon Risk Profili')}</label>
                   <span className={`w-2 h-2 rounded-full animate-pulse ${brief.riskLevel === 'High' ? 'bg-red-500 shadow-[0_0_10px_red]' : brief.riskLevel === 'Medium' ? 'bg-orange-500 shadow-[0_0_10px_orange]' : 'bg-green-500 shadow-[0_0_10px_green]'}`}></span>
                </div>
                <select
                  value={brief.riskLevel}
                  onChange={(e) => setBrief({ ...brief, riskLevel: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-xs font-black text-slate-200 outline-none mb-4"
                >
	                  <option value="Low">{tt('Low', 'Düşük')}</option>
	                  <option value="Medium">{tt('Medium', 'Orta')}</option>
	                  <option value="High">{tt('High', 'Yüksek')}</option>
	                </select>

                {/* Council Risk Assessment Button */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={requestCouncilRiskAssessment}
                    disabled={isAssessingRisk}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-400 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {isAssessingRisk ? (
                      <>
                        <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                        {tt('Assessing...', 'Değerlendiriliyor...')}
                      </>
                    ) : (
                      <>
                        🏛️ {tt('Get Council Risk Assessment', 'Kurul Risk Değerlendirmesi Al')}
                      </>
                    )}
                  </button>
                  {councilRiskReview && (
                    <CouncilBadge
                      decision={councilRiskReview.decision}
                      confidence={councilRiskReview.confidence}
                      compact
                      language={language}
                    />
                  )}
                </div>

                {/* Council Risk Assessment Result */}
                {councilRiskReview && (
                  <div className="bg-slate-900/50 rounded-2xl p-4 mb-4 border border-slate-800">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {councilRiskReview.summary}
                    </p>
                  </div>
                )}

	                <p className="text-[10px] text-slate-600 leading-relaxed font-medium uppercase tracking-tighter">
                    {councilRiskReview ? tt('Council recommends', 'Kurul öneriyor:') : tt('Gemini suggests a', 'Gemini şu gate öneriyor:')}{' '}
                    <span className="text-indigo-400 font-black">
                      {brief.riskLevel === 'High' ? tt('High', 'Yüksek') : brief.riskLevel === 'Medium' ? tt('Medium', 'Orta') : tt('Low', 'Düşük')}{' '}
                      {tt('Risk Gate', 'Risk Gate')}
                    </span>{' '}
                    {tt('due to tool integration complexity and data sensitivity.', 'çünkü entegrasyon karmaşıklığı ve veri hassasiyeti yüksek.')}
                  </p>
	              </div>

	              <div>
	                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">{tt('Strategic Value (Pricing)', 'Bütçe / Fiyat')}</label>
	                <input
                  type="text"
                  value={brief.budget}
                  onChange={(e) => setBrief({ ...brief, budget: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 font-black outline-none shadow-inner tracking-tight"
	                  placeholder={tt('e.g. $1,200 / month', 'ör. $1,200 / ay')}
	                />
	              </div>
            </div>
          </div>

	        <div className="flex gap-6 pt-10">
	            <button onClick={() => setStep(1)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-500 font-black py-6 rounded-[28px] transition-all uppercase tracking-widest text-[10px] border border-slate-800">
	              {tt('Recalibrate Intake', 'İntake’i Düzelt')}
	            </button>
	            <button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-6 rounded-[28px] shadow-2xl shadow-indigo-600/30 transition-all uppercase tracking-widest text-[10px] border border-indigo-400/20 active:scale-95">
	              {tt('Confirm Analysis', 'Analizi Onayla')}
	            </button>
	          </div>
        </div>
      )}

      {/* Step 3: Roadmap Preview */}
      {step === 3 && (
        <div className="bg-slate-800/40 border border-slate-700/50 p-12 rounded-[56px] space-y-12 shadow-2xl animate-in fade-in slide-in-from-right duration-700">
	           <div className="text-center space-y-4">
	              <h3 className="text-4xl font-black text-white tracking-tighter uppercase">{tt('Execution Roadmap', 'Uygulama Yol Haritası')}</h3>
	              <p className="text-slate-500 text-sm font-medium">{tt('Initialization parameters locked. Project is ready for board assignment.', 'Parametreler kilitlendi. Proje kurul atamasına hazır.')}</p>
	           </div>

	           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
	              {[
	                { label: tt('Intake Phase', 'İntake'), status: tt('Completed', 'Tamamlandı'), icon: '📥', color: 'bg-green-500' },
	                { label: tt('Board Review', 'Yönetim Kurulu İncelemesi'), status: tt('Pending', 'Bekliyor'), icon: '🏛️', color: 'bg-indigo-500' },
	                { label: tt('Infrastructure', 'Altyapı'), status: tt('Staged', 'Hazır'), icon: '⚡', color: 'bg-slate-800' },
	                { label: tt('Go-Live Sync', 'Canlıya Alma'), status: tt('Scheduled', 'Planlandı'), icon: '🚀', color: 'bg-slate-800' }
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
	                 <h4 className="text-lg font-black text-white tracking-tight">{tt('Handshake Initialization Ready', 'Handshake Başlatmaya Hazır')}</h4>
	                 <p className="text-slate-500 text-xs font-medium mt-1">
                     {tt('Ready to create cluster records for', 'Şu müşteri için cluster kaydı oluşturmaya hazır:')}{' '}
                     <span className="text-white font-bold">{brief.clientName}</span>.
                   </p>
	              </div>
              <button 
                onClick={handleFinalSubmit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-5 rounded-[24px] transition-all shadow-2xl shadow-indigo-600/30 uppercase tracking-[0.2em] text-[10px] active:scale-95 border border-indigo-400/20 relative z-10"
	              >
	                {tt('Launch Operation Hub', 'Operasyon Panelini Aç')}
	              </button>
	           </div>
	           
	           <button onClick={() => setStep(2)} className="w-full text-[10px] font-black text-slate-700 hover:text-slate-500 uppercase tracking-[0.4em] transition-all mt-4">{tt('Back to Analysis', 'Analize Geri Dön')}</button>
	        </div>
	      )}
    </div>
  );
};

export default IntakeWizard;
