
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project, CouncilSession, CouncilGate } from '../types';
import { createInvoiceShelfInvoiceFromCouncil, runCouncilPlayground, runCouncilSession } from '../services/api';
import { useI18n } from '../services/i18n';

interface CouncilRoomProps {
  selectedProjectId: string | null;
  projects: Project[];
  sessions: CouncilSession[];
  onNewSession: (session: CouncilSession) => void;
  onProjectUpdate: (project: Project) => void;
  onOpenBoardStudio?: (projectId?: string) => void;
  onOpenCatalog?: (prefill?: { query: string; requiredTags?: string[] }) => void;
}

const GATES: Array<{ id: CouncilGate; label: { en: string; tr: string }; desc: { en: string; tr: string } }> = [
  { id: 'Strategic', label: { en: 'Strategic Gate', tr: 'Stratejik Gate' }, desc: { en: 'Pricing, scope, and proposal review.', tr: 'Fiyat, kapsam ve teklif incelemesi.' } },
  { id: 'Risk', label: { en: 'Risk & Test Gate', tr: 'Risk & Test Gate' }, desc: { en: 'Security audit and edge cases.', tr: 'Güvenlik kontrolü ve edge-case’ler.' } },
  { id: 'Launch', label: { en: 'Go-Live Gate', tr: 'Go-Live Gate' }, desc: { en: 'Final activation checklist.', tr: 'Final aktivasyon checklist’i.' } },
  { id: 'Post-Mortem', label: { en: 'Post-Mortem Gate', tr: 'Post-Mortem Gate' }, desc: { en: 'Failure analysis and recovery.', tr: 'Hata analizi ve toparlama.' } },
];

type CouncilPlaygroundResult = Awaited<ReturnType<typeof runCouncilPlayground>>;
type BoardChatTurn = {
  id: string;
  prompt: string;
  requestPrompt: string;
  status: 'loading' | 'done' | 'error';
  result?: CouncilPlaygroundResult;
  error?: string;
  createdAt: string;
};

type L10nText = { en: string; tr: string };

function shortenText(input: string, max: number): string {
  const s = String(input ?? '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}

function pickN<T>(items: T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length && out.length < n) {
    const idx = Math.floor(Math.random() * pool.length);
    const [picked] = pool.splice(idx, 1);
    out.push(picked);
  }
  return out;
}

const BOARD_TRAIT_OPTIONS: Record<string, L10nText[]> = {
  strategy: [
    { en: 'Positioning-first', tr: 'Konumlandırma odaklı' },
    { en: 'Aggressive growth', tr: 'Agresif büyüme' },
    { en: 'Offer packaging', tr: 'Teklif paketleme' },
    { en: 'Fast MVP', tr: 'Hızlı MVP' },
    { en: 'ROI messaging', tr: 'ROI odaklı mesaj' },
    { en: 'Premium pricing', tr: 'Premium fiyatlama' },
  ],
  risk: [
    { en: 'Conservative', tr: 'Muhafazakâr' },
    { en: 'Data privacy', tr: 'Veri gizliliği' },
    { en: 'SLA-minded', tr: 'SLA odaklı' },
    { en: 'Edge-case hunter', tr: 'Edge-case avcısı' },
    { en: 'Security first', tr: 'Önce güvenlik' },
    { en: 'Compliance', tr: 'Uyumluluk' },
  ],
  ops: [
    { en: 'Checklist-driven', tr: 'Checklist’çi' },
    { en: 'Automation pragmatist', tr: 'Pragmatik otomasyon' },
    { en: 'Delivery-focused', tr: 'Teslimat odaklı' },
    { en: 'Low-maintenance', tr: 'Düşük bakım' },
    { en: 'Debug mindset', tr: 'Debug zihniyeti' },
    { en: 'Monitoring', tr: 'İzleme' },
  ],
  growth: [
    { en: 'Outbound-heavy', tr: 'Outbound ağırlıklı' },
    { en: 'Niche-specific', tr: 'Niş odaklı' },
    { en: 'High-volume', tr: 'Yüksek hacim' },
    { en: 'Warm intros', tr: 'Sıcak referans' },
    { en: 'Content + DM', tr: 'İçerik + DM' },
    { en: 'Call scripts', tr: 'Arama script’i' },
  ],
  chair: [
    { en: 'Realism check', tr: 'Gerçekçilik kontrolü' },
    { en: 'Clear next steps', tr: 'Net sonraki adımlar' },
    { en: 'Numbers-first', tr: 'Sayı odaklı' },
    { en: 'Synthesis', tr: 'Sentez' },
    { en: 'No fluff', tr: 'Sade' },
    { en: 'Decision-ready', tr: 'Karar odaklı' },
  ],
};

function rollBoardTraits(): Record<string, L10nText[]> {
  return {
    strategy: pickN(BOARD_TRAIT_OPTIONS.strategy, 3),
    risk: pickN(BOARD_TRAIT_OPTIONS.risk, 3),
    ops: pickN(BOARD_TRAIT_OPTIONS.ops, 3),
    growth: pickN(BOARD_TRAIT_OPTIONS.growth, 3),
    chair: pickN(BOARD_TRAIT_OPTIONS.chair, 3),
  };
}

const CouncilRoom: React.FC<CouncilRoomProps> = ({
  selectedProjectId,
  projects,
  sessions,
  onNewSession,
  onProjectUpdate,
  onOpenBoardStudio,
  onOpenCatalog,
}) => {
  const { language, tt } = useI18n();
  const [loading, setLoading] = useState(false);
  const [activeGate, setActiveGate] = useState<CouncilGate>('Strategic');
  const [activeProjectId, setActiveProjectId] = useState(selectedProjectId || '');
  const [deliberationPhase, setDeliberationPhase] = useState<'convening' | 'deliberating' | 'synthesizing' | 'done'>('done');
  const [boardChatMode, setBoardChatMode] = useState<'ceo' | 'quick'>('ceo');
  const [boardChatInput, setBoardChatInput] = useState(() =>
    tt(
      'Explain how to automate lead → CRM → proposal → invoice with n8n, including risks.',
      'n8n ile lead → CRM → teklif → fatura otomasyonunu (riskleriyle birlikte) açıkla.',
    ),
  );
  const [boardChatTurns, setBoardChatTurns] = useState<BoardChatTurn[]>([]);
  const [boardChatUseContext, setBoardChatUseContext] = useState(true);
  const [boardTraitsAuto, setBoardTraitsAuto] = useState(true);
  const [boardTraits, setBoardTraits] = useState<Record<string, L10nText[]>>(() => rollBoardTraits());
  const [boardChatIsSending, setBoardChatIsSending] = useState(false);
  const boardChatScrollRef = useRef<HTMLDivElement | null>(null);
  const boardChatEndRef = useRef<HTMLDivElement | null>(null);
  const [pricingActionSessionId, setPricingActionSessionId] = useState<string | null>(null);
  const [pricingMessage, setPricingMessage] = useState<{ sessionId: string; text: string } | null>(null);
  const [pricingError, setPricingError] = useState<{ sessionId: string; text: string } | null>(null);

  useEffect(() => {
    if (selectedProjectId) setActiveProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const filteredSessions = sessions.filter(s => s.projectId === activeProjectId);
  const currentProject = projects.find(p => p.id === activeProjectId);
  const rerollTraits = () => setBoardTraits(rollBoardTraits());
  const canOpenBoardStudio = typeof onOpenBoardStudio === 'function';
  const openBoardStudio = () => onOpenBoardStudio?.(activeProjectId || undefined);

  const boardMembers = useMemo(
    () => [
      {
        id: 'strategy',
        title: tt('Strategy', 'Strateji'),
        name: tt('Strategy Member', 'Strateji Üyesi'),
        avatar: '📈',
        focus: tt('Offer, positioning, pricing', 'Teklif, konumlandırma, fiyat'),
        thinking: tt('Scanning offer + positioning…', 'Teklif + konumlandırmayı tarıyor…'),
      },
      {
        id: 'risk',
        title: tt('Risk', 'Risk'),
        name: tt('Risk Member', 'Risk Üyesi'),
        avatar: '⚖️',
        focus: tt('Security, privacy, realism', 'Güvenlik, gizlilik, gerçekçilik'),
        thinking: tt('Checking risks + edge cases…', 'Risk + edge-case kontrol ediyor…'),
      },
      {
        id: 'ops',
        title: tt('Ops', 'Operasyon'),
        name: tt('Ops Member', 'Operasyon Üyesi'),
        avatar: '🛠️',
        focus: tt('Delivery, checklist, monitoring', 'Teslimat, checklist, izleme'),
        thinking: tt('Building install checklist…', 'Kurulum checklist’i çıkarıyor…'),
      },
      {
        id: 'growth',
        title: tt('Growth', 'Büyüme'),
        name: tt('Growth Member', 'Büyüme Üyesi'),
        avatar: '🎯',
        focus: tt('Outbound, messaging, distribution', 'Outbound, mesajlar, dağıtım'),
        thinking: tt('Drafting sales angles + outreach…', 'Satış açıları + outreach yazıyor…'),
      },
      {
        id: 'chair',
        title: tt('Chair', 'Başkan'),
        name: tt('Chairman', 'Başkan'),
        avatar: '🏛️',
        focus: tt('Synthesis + decision', 'Sentez + karar'),
        thinking: tt('Synthesizing final answer…', 'Final sentezi yazıyor…'),
      },
    ],
    [tt],
  );

  const buildBoardChatPrompt = (userPrompt: string, traits: Record<string, L10nText[]>) => {
    const parts: string[] = [];
    parts.push(
      boardChatMode === 'ceo'
        ? language === 'tr'
          ? [
              'Sen AgencyOS Yönetim Kurulu’sun (ajans CEO asistanı). Az teknik, net, uygulanabilir yaz.',
              'İstediğim çıktı: Ajansın bu nişte nasıl para kazanacağını, gerçekçi olup olmadığını, kime nasıl ulaşacağını ve tam yol haritasını çıkar.',
              'Format (başlık + bölümler):',
              '1) Teklif / paket (ne satıyoruz?)',
              '2) Fiyatlandırma (3 paket + tek seferlik kurulum + aylık retainer)',
              '3) Kazanç hesabı (muhafazakâr / orta / agresif senaryo) + varsayımlar',
              '4) Kime ulaşacağız? (ICP) + hangi kanallardan?',
              '5) Ne yazacağız? (DM + e‑posta + telefon kısa script; örnek metinlerle)',
              '6) 10 dakikalık demo / pilot planı (1–2 hafta)',
              '7) İlk 7 gün yapılacaklar (gün gün)',
              '8) Riskler + yapılmaması gerekenler',
              'Kısa tut ama eksik bırakma (maks. ~900–1200 kelime).',
            ].join('\n')
          : [
              'You are the AgencyOS Management Board (agency CEO assistant). Be practical, low‑jargon, and direct.',
              'Output: a complete agency roadmap for this niche: how to make money, realism check, who to target, how to reach them, what to say.',
              'Format (title + sections):',
              '1) Offer / packages',
              '2) Pricing (3 tiers + one-time setup + monthly retainer)',
              '3) Revenue math (conservative / base / aggressive) + assumptions',
              '4) ICP + channels',
              '5) Outreach messages (DM + email + short call script)',
              '6) 10‑minute demo / pilot plan',
              '7) First 7 days plan (day by day)',
              '8) Risks + what NOT to do',
              'Keep it concise but complete (~900–1200 words).',
            ].join('\n')
        : language === 'tr'
          ? 'Sen AgencyOS Yönetim Kurulu’sun. Az teknik, net, uygulanabilir cevap ver. Gereksiz tekrar yapma; mümkünse 5–8 maddede ilerle.'
          : 'You are the AgencyOS Management Board. Be direct and practical. Avoid repetition; aim for 5–8 actionable bullets.',
    );

    try {
      const lines = boardMembers
        .map((m) => {
          const selected = traits?.[m.id] ?? [];
          const label = selected.map((t) => t[language]).filter(Boolean).join(' • ');
          return label ? `${m.name}: ${label}` : `${m.name}`;
        })
        .join('\n');
      parts.push(language === 'tr' ? `Kurul profili (bu tur):\n${lines}` : `Board profile (this turn):\n${lines}`);
    } catch {
      // ignore trait formatting errors
    }

    if (currentProject?.brief) {
      const brief: any = currentProject.brief;
      const goals = Array.isArray(brief.goals) ? brief.goals.filter(Boolean).slice(0, 6) : [];
      const tools = Array.isArray(brief.tools) ? brief.tools.filter(Boolean).slice(0, 10) : [];
      const briefLine = [
        brief.clientName ? `client: ${brief.clientName}` : null,
        brief.industry ? `industry: ${brief.industry}` : null,
        goals.length ? `goals: ${goals.join(' | ')}` : null,
        tools.length ? `tools: ${tools.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' • ');
      if (briefLine.trim()) {
        parts.push(language === 'tr' ? `Proje bağlamı: ${briefLine}` : `Project context: ${briefLine}`);
      }
    }

    if (boardChatUseContext) {
      const recent = boardChatTurns
        .filter((t) => t.status === 'done' && t.result?.final?.content)
        .slice(-2);
      if (recent.length) {
        const history = recent
          .map((t, idx) => {
            const q = shortenText(t.prompt, 220);
            const a = shortenText(String(t.result?.final?.content ?? ''), 820);
            return language === 'tr'
              ? `${idx + 1}) Soru: ${q}\nKurul cevabı: ${a}`
              : `${idx + 1}) Question: ${q}\nBoard answer: ${a}`;
          })
          .join('\n\n');
        parts.push(language === 'tr' ? `Önceki konuşma:\n${history}` : `Conversation so far:\n${history}`);
      }
    }

    parts.push(language === 'tr' ? `Yeni soru: ${userPrompt}` : `New question: ${userPrompt}`);
    return parts.join('\n\n');
  };

  const sendBoardChat = async () => {
    const userPrompt = String(boardChatInput || '').trim();
    if (!userPrompt) return;
    if (boardChatIsSending) return;

    const traits = boardTraitsAuto ? rollBoardTraits() : boardTraits;
    if (boardTraitsAuto) setBoardTraits(traits);
    const requestPrompt = buildBoardChatPrompt(userPrompt, traits);
    const id = `boardturn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const createdAt = new Date().toISOString();

    setBoardChatIsSending(true);
    setBoardChatTurns((prev) => [...prev, { id, prompt: userPrompt, requestPrompt, status: 'loading', createdAt }]);
    setBoardChatInput('');

    try {
      const result = await runCouncilPlayground({ prompt: requestPrompt, language });
      setBoardChatTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'done', result } : t)));
    } catch (e) {
      const message = e instanceof Error ? e.message : tt('Board request failed', 'Kurul isteği başarısız');
      setBoardChatTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'error', error: message } : t)));
    } finally {
      setBoardChatIsSending(false);
      requestAnimationFrame(() => {
        try {
          boardChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } catch {
          // ignore
        }
      });
    }
  };

  useEffect(() => {
    if (!boardChatTurns.length) return;
    const el = boardChatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [boardChatTurns.length]);

  const gateTypeLabel = (gate: CouncilGate) => {
    const map: Record<CouncilGate, { en: string; tr: string }> = {
      Strategic: { en: 'Strategic', tr: 'Stratejik' },
      Risk: { en: 'Risk', tr: 'Risk' },
      Launch: { en: 'Go-Live', tr: 'Go-Live' },
      'Post-Mortem': { en: 'Post-Mortem', tr: 'Post-Mortem' },
    };
    return map[gate][language];
  };

  const createInvoiceFromPricing = async (session: CouncilSession) => {
    if (pricingActionSessionId) return;
    setPricingMessage(null);
    setPricingError(null);
    setPricingActionSessionId(session.id);
    try {
      const out = await createInvoiceShelfInvoiceFromCouncil({
        projectId: session.projectId,
        sessionId: session.id,
        mode: 'first_month',
      });
      onProjectUpdate(out.project);
      setPricingMessage({
        sessionId: session.id,
        text: tt(
          `Invoice created in InvoiceShelf (#${out.invoice?.invoice_number ?? '—'}).`,
          `InvoiceShelf’te fatura oluşturuldu (#${out.invoice?.invoice_number ?? '—'}).`,
        ),
      });
    } catch (e) {
      setPricingError({ sessionId: session.id, text: e instanceof Error ? e.message : tt('Invoice creation failed', 'Fatura oluşturma başarısız') });
    } finally {
      setPricingActionSessionId(null);
    }
  };

  const startDeliberation = async () => {
    if (!activeProjectId || !activeGate) return;
    setLoading(true);
    setDeliberationPhase('convening');
    
    const gateInfo = GATES.find(g => g.id === activeGate);
    const topic = `${gateInfo?.label?.[language] ?? activeGate}: ${gateInfo?.desc?.[language] ?? ''}`;
    
    await new Promise(r => setTimeout(r, 1200));
    setDeliberationPhase('deliberating');
    
    try {
      const session = await runCouncilSession({
        projectId: activeProjectId,
        gateType: activeGate,
        topic,
        context: currentProject,
        language,
      });
      await new Promise(r => setTimeout(r, 2000));
      setDeliberationPhase('synthesizing');
      await new Promise(r => setTimeout(r, 1000));
      
      onNewSession(session);
      setLoading(false);
      setDeliberationPhase('done');
    } catch (e) {
      console.error(e);
      setLoading(false);
      setDeliberationPhase('done');
    }
  };

  const renderBoardChatPanel = (variant: 'compact' | 'studio') => {
    const isStudio = variant === 'studio';
    const scrollMaxH = isStudio ? 'max-h-[62vh]' : 'max-h-[480px]';
    const inputClass = isStudio ? 'min-h-[160px] text-sm' : 'min-h-[120px] text-xs';
    const sendClass = isStudio ? 'py-6 text-sm' : 'py-5 text-xs';
    const membersPadding = isStudio ? 'p-8' : 'p-6';
    const chipContainer = isStudio ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3' : 'flex gap-3 overflow-x-auto no-scrollbar pb-2';

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-inner">
            {([
              { id: 'ceo' as const, label: tt('CEO Mode', 'CEO Modu') },
              { id: 'quick' as const, label: tt('Quick', 'Hızlı') },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setBoardChatMode(m.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  boardChatMode === m.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/10' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <input
                type="checkbox"
                checked={boardChatUseContext}
                onChange={(e) => setBoardChatUseContext(Boolean(e.target.checked))}
              />
              {tt('Remember', 'Hatırla')}
            </label>

            <button
              onClick={() => setBoardChatTurns([])}
              className="text-[10px] font-black text-slate-500 hover:text-slate-200 uppercase tracking-widest"
            >
              {tt('Clear', 'Temizle')}
            </button>
          </div>
        </div>

        <details className="bg-slate-950/40 border border-slate-800 rounded-[24px] px-5 py-4">
          <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {tt('Board settings', 'Kurul ayarları')}
          </summary>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <input
                type="checkbox"
                checked={boardTraitsAuto}
                onChange={(e) => setBoardTraitsAuto(Boolean(e.target.checked))}
              />
              {tt('Traits change each message', 'Kişilik her mesajda değişsin')}
            </label>
            <button
              onClick={rerollTraits}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-2 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {tt('Reroll traits', 'Kişiliği yenile')}
            </button>
          </div>
        </details>

        <div className={`relative overflow-hidden bg-slate-950/40 border border-slate-800 rounded-[36px] ${membersPadding}`}>
          <div className="absolute -top-16 -right-20 w-64 h-64 bg-indigo-600/10 blur-[90px] rounded-full"></div>
          <div className="absolute -bottom-16 -left-20 w-64 h-64 bg-fuchsia-500/10 blur-[90px] rounded-full"></div>

          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {tt('Board table', 'Kurul masası')}
            </p>

            <div className={`mt-4 ${chipContainer}`}>
              {boardMembers.map((m) => {
                const traits = (boardTraits[m.id] ?? []).slice(0, 2);
                const isChair = m.id === 'chair';

                if (!isStudio) {
                  return (
                    <div
                      key={m.id}
                      className={`min-w-[200px] bg-slate-900/40 border rounded-[24px] p-4 shadow-inner ${
                        isChair ? 'border-indigo-500/30 bg-indigo-600/5' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${
                            isChair ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          {m.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{m.title}</p>
                          <p className="mt-1 text-[11px] text-slate-600 font-medium truncate">{m.name}</p>
                          {traits.length ? (
                            <p className="mt-2 text-[10px] text-slate-500 font-black uppercase tracking-widest truncate">
                              {traits.map((t) => t[language]).join(' • ')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`bg-slate-900/40 border rounded-[28px] p-4 shadow-inner transition-all ${
                      isChair ? 'border-indigo-500/30 bg-indigo-600/5' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${
                          isChair ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        {m.avatar}
                      </div>
                      <span className="px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-slate-800 text-slate-500 bg-slate-950/60">
                        {m.title}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">{m.name}</p>
                    <p className="mt-2 text-[11px] text-slate-600 font-medium leading-snug">{m.focus}</p>
                    {traits.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {traits.map((t, idx) => (
                          <span
                            key={`${m.id}-trait-${idx}`}
                            className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                              isChair ? 'border-indigo-500/20 text-indigo-500 bg-indigo-600/5' : 'border-slate-800 text-slate-500 bg-slate-950/60'
                            }`}
                          >
                            {t[language]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={boardChatScrollRef}
          className={`bg-slate-950/40 border border-slate-800 rounded-[32px] p-6 ${scrollMaxH} overflow-y-auto space-y-5`}
        >
          {boardChatTurns.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                {tt('Start a chat with the Board', 'Kurulla sohbet başlat')}
              </p>
              <p className="mt-3 text-slate-500 text-sm font-medium">
                {tt(
                  'Ask a niche + city. Then follow up with constraints (budget, hours/day, pricing).',
                  'Bir niş + şehir yaz. Sonra kısıtlarını ekle (bütçe, günde saat, fiyat).',
                )}
              </p>
            </div>
          ) : (
            boardChatTurns.map((turn) => (
              <div key={turn.id} className="space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[92%] bg-indigo-600/10 border border-indigo-500/20 rounded-[28px] px-6 py-5 shadow-inner">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{tt('You', 'Sen')}</p>
                    <p className="mt-2 text-sm text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">{turn.prompt}</p>
                  </div>
                </div>

                {turn.status === 'loading' ? (
                  <div className="space-y-3">
                    {boardMembers.map((m, idx) => (
                      <div key={m.id} className="flex gap-3 items-start">
                        <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-lg border border-slate-800 shadow-inner">
                          {m.avatar}
                        </div>
                        <div
                          className="flex-1 bg-slate-900/30 border border-slate-800 rounded-[28px] px-6 py-5 shadow-inner animate-pulse"
                          style={{ animationDelay: `${idx * 120}ms` } as React.CSSProperties}
                        >
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{m.name}</p>
                          <p className="mt-2 text-sm text-slate-500 font-medium">{m.thinking}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : turn.status === 'error' ? (
                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center text-lg border border-red-500/20 shadow-inner">
                      ⚠️
                    </div>
                    <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-[28px] px-6 py-5 shadow-inner">
                      <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{tt('Board Error', 'Kurul Hatası')}</p>
                      <p className="mt-2 text-sm text-red-300 font-medium whitespace-pre-wrap">{turn.error || tt('Unknown error', 'Bilinmeyen hata')}</p>
                    </div>
                  </div>
                ) : turn.result?.final?.content ? (
                  <div className="space-y-5">
                    {Array.isArray(turn.result.stage1) && turn.result.stage1.length ? (
                      <div className="space-y-3">
                        {turn.result.stage1.slice(0, 3).map((m, idx) => {
                          const persona = boardMembers[idx] ?? boardMembers[0];
                          const traits = (boardTraits[persona.id] ?? []).slice(0, 2);
                          return (
                            <div key={`${m.model}-${idx}`} className="flex gap-3 items-start">
                              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-lg border border-slate-800 shadow-inner">
                                {persona.avatar}
                              </div>
                              <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-[28px] px-6 py-5 shadow-inner">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{persona.name}</p>
                                    <p className="mt-1 text-[10px] text-slate-600 font-mono truncate">{m.model}</p>
                                  </div>
                                  {traits.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {traits.map((t, j) => (
                                        <span
                                          key={`${persona.id}-t-${j}`}
                                          className="px-3 py-1 rounded-xl bg-slate-950/60 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500"
                                        >
                                          {t[language]}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                <p className="mt-3 text-sm text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                  {shortenText(m.content, 680)}
                                </p>
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {tt('Full text', 'Tam metin')}
                                  </summary>
                                  <pre className="mt-3 text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                                    {m.content}
                                  </pre>
                                </details>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="flex gap-3 items-start">
                      <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-lg border border-slate-800 shadow-inner">
                        🗂️
                      </div>
                      <div className="flex-1 bg-slate-900/20 border border-slate-800 rounded-[28px] px-6 py-5 shadow-inner">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {tt('Board Secretary', 'Kurul Sekreteri')}
                        </p>
                        {Array.isArray(turn.result.aggregateRankings) && turn.result.aggregateRankings.length ? (
                          <div className="mt-4 space-y-2">
                            {turn.result.aggregateRankings.slice(0, 6).map((r) => (
                              <div key={r.model} className="flex justify-between items-center bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3">
                                <p className="text-[11px] text-slate-300 font-medium truncate">{r.model}</p>
                                <p className="text-[10px] font-black text-indigo-400">avg #{r.averageRank}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500 font-medium">
                            {tt(
                              'Peer ranking (Stage 2) is disabled for speed. You can enable it in Settings if needed.',
                              'Peer ranking (Aşama 2) hız için kapalı. İstersen Ayarlar’dan açabilirsin.',
                            )}
                          </p>
                        )}
                        {Array.isArray(turn.result.stage2) && turn.result.stage2.length ? (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {tt('Stage 2 outputs', 'Aşama 2 çıktıları')}
                            </summary>
                            <div className="mt-4 space-y-4">
                              {turn.result.stage2.slice(0, 6).map((m, idx) => (
                                <div key={`${m.model}-${idx}`} className="bg-slate-950/60 border border-slate-800 rounded-[24px] p-5 shadow-inner">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{m.model}</p>
                                  <pre className="mt-3 text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{m.content}</pre>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="w-10 h-10 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-lg border border-indigo-500/20 shadow-inner">
                        🏛️
                      </div>
                      <div className="flex-1 bg-indigo-600/5 border border-indigo-500/10 rounded-[28px] px-6 py-5 shadow-inner">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                          {tt('Chairman Synthesis (final)', 'Başkan Sentezi (final)')}
                        </p>
                        <div className="mt-3 text-slate-200 leading-relaxed whitespace-pre-wrap text-sm font-medium">
                          {turn.result.final.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
          <div ref={boardChatEndRef} />
        </div>

        <textarea
          value={boardChatInput}
          onChange={(e) => setBoardChatInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void sendBoardChat();
            }
          }}
          className={`w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner ${inputClass}`}
          placeholder={tt('Ask anything… (Cmd/Ctrl+Enter to send)', 'Her şeyi sor… (Cmd/Ctrl+Enter gönder)')}
        />

        <button
          onClick={() => void sendBoardChat()}
          disabled={boardChatIsSending || !String(boardChatInput || '').trim()}
          className={`w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900/40 text-white font-black rounded-[24px] transition-all uppercase tracking-[0.2em] border border-indigo-400/20 active:scale-[0.98] shadow-xl shadow-indigo-600/10 ${sendClass}`}
        >
          {boardChatIsSending ? tt('Board is thinking…', 'Yönetim Kurulu düşünüyor…') : tt('Send to Board', 'Kurula Gönder')}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700 pb-20">
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-[80px] -mr-24 -mt-24"></div>
          
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-white mb-3 flex items-center gap-4 uppercase tracking-tighter">
               <span className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-indigo-400/20">🏛️</span> 
               {tt('Management Board Brief', 'Yönetim Kurulu Brifingi')}
            </h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
              {tt(
                'Pick a project and get a clear, non-technical “what to do next” plan (next steps + money plan + workflow suggestions).',
                'Bir proje seç, Yönetim Kurulu sana net (az teknik) bir “şimdi ne yapalım?” planı versin (sıradaki adımlar + para planı + workflow önerileri).',
              )}
            </p>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">
                  {tt('Project', 'Proje')}
                </label>
                <select
                  value={activeProjectId}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                >
                  <option value="">{tt('-- Choose a project --', '-- Proje Seç --')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.brief.clientName.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block">
                  {tt('Decision Type', 'Karar Tipi')}
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {GATES.map(gate => (
                    <button
                      key={gate.id}
                      onClick={() => setActiveGate(gate.id)}
                      className={`text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${
                        activeGate === gate.id 
                          ? `bg-indigo-600/10 border-indigo-500 text-indigo-600 shadow-xl` 
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <p className="text-[11px] font-black uppercase tracking-widest mb-1 relative z-10">{gate.label[language]}</p>
                      <p className="text-[10px] opacity-60 relative z-10 font-medium">{gate.desc[language]}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startDeliberation}
                disabled={loading || !activeProjectId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[24px] shadow-2xl shadow-indigo-600/30 mt-6 active:scale-[0.98] uppercase tracking-[0.2em] text-xs border border-indigo-400/20"
              >
                {loading ? tt('Board is thinking…', 'Yönetim Kurulu düşünüyor…') : tt('Get Board Brief', 'Brifingi Al')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-600/5 rounded-full blur-[80px] -ml-24 -mt-24"></div>
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase">{tt('Board Studio', 'Yönetim Kurulu Stüdyosu')}</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
                    {tt(
                      'Roadmap + money math + outreach messages + realism check.',
                      'Yol haritası + kazanç hesabı + outreach mesajları + gerçekçilik kontrolü.',
                    )}
                  </p>
                </div>
                <button
                  onClick={openBoardStudio}
                  disabled={!canOpenBoardStudio}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95"
                >
                  {tt('Open studio', 'Stüdyoyu aç')}
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  {tt('Advanced info', 'Gelişmiş bilgi')}
                </summary>
                <p className="mt-3 text-[10px] text-slate-600 font-mono leading-relaxed">
                  {tt(
                    'Multi-model mode uses OpenRouter (`OPENROUTER_API_KEY`, `COUNCIL_MODELS`). Fallback uses Gemini (`GEMINI_API_KEY`).',
                    'Çoklu model modu OpenRouter kullanır (`OPENROUTER_API_KEY`, `COUNCIL_MODELS`). Fallback: Gemini (`GEMINI_API_KEY`).',
                  )}
                </p>
              </details>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-[28px] p-6 shadow-inner">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {tt('Tip', 'İpucu')}
              </p>
              <p className="mt-3 text-[12px] text-slate-600 font-medium leading-relaxed">
                {tt(
                  'Board Studio opens as a full-page view (no cramped panel). Use it for ongoing chat + roadmap.',
                  'Kurul Stüdyosu ayrı sayfada tam ekran açılır. Sürekli sohbet + yol haritası için orayı kullan.',
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 bg-slate-800/10 border-2 border-dashed border-indigo-500/20 rounded-[60px] text-center shadow-inner animate-pulse">
             <div className="text-8xl mb-10">🏛️</div>
             <h3 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">
                {deliberationPhase === 'convening'
                  ? tt('Establishing Board Consensus...', 'Yönetim Kurulu mutabakatı oluşturuluyor...')
                  : deliberationPhase === 'deliberating'
                    ? tt('Expert Persona Evaluation...', 'Uzman persona değerlendirmesi...')
                    : tt('Synthesizing Operational Protocol...', 'Operasyon protokolü sentezleniyor...')}
             </h3>
             <p className="text-slate-500 max-w-sm leading-relaxed text-sm font-medium">{tt('The AgencyOS Board is analyzing project telemetry and architectural alignment.', 'AgencyOS Yönetim Kurulu proje telemetrisini ve mimari uyumu analiz ediyor.')}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-48 text-center bg-slate-800/10 rounded-[60px] border-2 border-dashed border-slate-800/50 flex flex-col items-center group transition-all hover:bg-slate-800/20">
             <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-5xl mb-8 shadow-inner border border-slate-800 opacity-20 group-hover:opacity-100 transition-all">📜</div>
             <h3 className="text-xl font-black text-slate-500 uppercase tracking-[0.3em]">{tt('No Deliberations Found', 'Oturum Bulunamadı')}</h3>
             <p className="text-slate-600 text-sm mt-4 max-w-sm leading-relaxed">{tt('Choose a project and gate to initiate a Strategic AI Board Session.', 'Bir proje ve gate seçip kurul oturumunu başlat.')}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredSessions.slice().reverse().map((session) => (
              <div key={session.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                <div className="p-10 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center relative">
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-lg">
                      {gateTypeLabel(session.gateType)} {tt('Protocol', 'Protokol')}
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{session.topic.split(':')[0]}</h3>
                  </div>
                  <div className={`px-8 py-3 rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] border shadow-2xl ${
                    session.decision === 'Approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    session.decision === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {session.decision === 'Approved'
                      ? tt('Approved', 'Onaylandı')
                      : session.decision === 'Rejected'
                        ? tt('Rejected', 'Reddedildi')
                        : tt('Needs Revision', 'Revizyon Gerekli')}
                  </div>
                </div>

                <div className="p-12 space-y-12">
                  {(session.boardSummary || session.nextSteps?.length || session.moneySteps?.length || session.workflowSuggestions?.length) ? (
                    <div className="bg-slate-950/60 border border-slate-800 p-10 rounded-[48px] shadow-inner space-y-8">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            {tt('Board Brief', 'Yönetim Kurulu Brifingi')}
                          </p>

                          <div className="flex flex-wrap items-center gap-3">
                            {session.currentStage?.label ? (
                              <span className="px-4 py-2 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                {tt('Stage', 'Aşama')}: {session.currentStage.label}
                              </span>
                            ) : null}
                            {session.boardName ? (
                              <span className="px-4 py-2 rounded-2xl bg-slate-900/40 border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {session.boardName}
                              </span>
                            ) : null}
                          </div>

                          {session.boardSummary ? (
                            <p className="text-slate-300 text-sm leading-relaxed font-medium">{session.boardSummary}</p>
                          ) : null}
                        </div>

                        {onOpenCatalog && session.suggestedCatalogQuery?.query ? (
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => onOpenCatalog?.(session.suggestedCatalogQuery || undefined)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
                            >
                              {tt('Open Catalog', 'Kataloğu Aç')}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {session.nextSteps?.length ? (
                          <div className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                              {tt('Now: Do these next', 'Şimdi: Sıradaki adımlar')}
                            </p>
                            <ul className="space-y-2">
                              {session.nextSteps.slice(0, 8).map((s, idx) => (
                                <li key={idx} className="text-sm text-slate-300 font-medium leading-relaxed">
                                  • {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {session.moneySteps?.length ? (
                          <div className="bg-slate-900/30 border border-slate-800 rounded-[32px] p-8">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                              {tt('Money Plan', 'Para Kazanma Planı')}
                            </p>
                            <ul className="space-y-2">
                              {session.moneySteps.slice(0, 8).map((s, idx) => (
                                <li key={idx} className="text-sm text-slate-300 font-medium leading-relaxed">
                                  • {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      {session.workflowSuggestions?.length ? (
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              {tt('Workflow Suggestions', 'Workflow Önerileri')}
                            </p>
                            {session.suggestedCatalogQuery?.query ? (
                              <p className="text-[10px] text-slate-600 font-mono truncate">
                                query: {session.suggestedCatalogQuery.query}
                              </p>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {session.workflowSuggestions.slice(0, 6).map((c) => (
                              <div
                                key={c.workflow.id}
                                className="bg-slate-900/40 border border-slate-800 rounded-[28px] p-6 shadow-inner hover:border-indigo-500/20 transition-all"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-white leading-tight truncate">{c.workflow.name}</p>
                                    <p className="text-[10px] text-slate-600 mt-2 font-medium line-clamp-3">
                                      {c.reason || c.workflow.description}
                                    </p>
                                  </div>
                                  <a
                                    href={c.workflow.jsonUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                                  >
                                    JSON
                                  </a>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {c.workflow.tags.slice(0, 4).map((t) => (
                                    <span
                                      key={t}
                                      className="px-3 py-1 rounded-xl bg-slate-950/60 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>

                                <details className="mt-4">
                                  <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {tt('Setup (optional)', 'Kurulum (opsiyonel)')}
                                  </summary>
                                  <div className="mt-3 space-y-3">
                                    {c.installPlan?.credentialChecklist?.length ? (
                                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                          {tt('Needed connections', 'Gereken bağlantılar')}
                                        </p>
                                        <ul className="mt-2 space-y-1">
                                          {c.installPlan.credentialChecklist.slice(0, 6).map((x, idx) => (
                                            <li key={idx} className="text-[10px] text-slate-600 font-mono">
                                              • {x}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {session.opinions.map((op, oIdx) => (
                      <div key={oIdx} className="bg-slate-900/40 p-8 rounded-[32px] border border-slate-800 shadow-inner flex flex-col justify-between hover:border-indigo-500/20 transition-all group/card">
                        <div>
                          <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl border border-slate-700 group-hover/card:scale-110 transition-transform">
                               {op.persona.toLowerCase().includes('risk') ? '⚖️' : op.persona.toLowerCase().includes('arch') ? '📐' : '📈'}
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-black text-white tracking-tight">{op.persona}</p>
                               <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{op.role}</p>
                            </div>
                          </div>
                          <p className="text-[13px] text-slate-400 leading-relaxed italic mb-8 font-medium">"{op.opinion}"</p>
                        </div>
                        <div className="pt-6 border-t border-slate-800/50 flex justify-between items-center">
                          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{tt('Confidence', 'Güven')}</span>
                          <span className={`text-sm font-black ${op.score > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{op.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {session.pricing?.lineItems?.length ? (
                    <div className="bg-slate-900/30 border border-slate-800 p-12 rounded-[48px] space-y-8">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">{tt('Pricing Recommendation', 'Fiyat Önerisi')}</h4>
                          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                            {tt('Currency', 'Para Birimi')}: {session.pricing.currency || '—'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                          {tt('Strategic Gate Output', 'Stratejik Gate Çıktısı')}
                        </span>
                      </div>

                      <div className="bg-slate-950/60 rounded-[32px] border border-slate-800 overflow-hidden">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              <th className="px-8 py-5">{tt('Line Item', 'Kalem')}</th>
                              <th className="px-8 py-5">{tt('Cadence', 'Periyot')}</th>
                              <th className="px-8 py-5 text-right">{tt('Amount', 'Tutar')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {session.pricing.lineItems.map((li, idx) => (
                              <tr key={idx} className="hover:bg-indigo-600/5 transition-all">
                                <td className="px-8 py-5">
                                  <p className="text-sm text-slate-200 font-medium">{li.label}</p>
                                  {li.notes && (
                                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">
                                      {li.notes}
                                    </p>
                                  )}
                                </td>
                                <td className="px-8 py-5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                  {li.cadence}
                                </td>
                                <td className="px-8 py-5 text-right text-sm text-slate-200 font-black">
                                  {typeof li.amount === 'number' ? li.amount.toLocaleString() : li.amount}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: tt('One-Time Total', 'Tek Seferlik Toplam'), val: session.pricing.totalOneTime },
                          { label: tt('Monthly Total', 'Aylık Toplam'), val: session.pricing.totalMonthly },
                          { label: tt('First Month Total', 'İlk Ay Toplam'), val: session.pricing.totalFirstMonth },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8 shadow-inner">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">{stat.label}</p>
                            <p className="text-2xl font-black text-white">
                              {typeof stat.val === 'number' ? stat.val.toLocaleString() : '—'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {session.pricing.assumptions?.length ? (
                        <div className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8 shadow-inner">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{tt('Assumptions', 'Varsayımlar')}</p>
                          <ul className="space-y-2">
                            {session.pricing.assumptions.map((a, idx) => (
                              <li key={idx} className="text-sm text-slate-300 font-medium">
                                • {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8 shadow-inner">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">InvoiceShelf</p>
                            <p className="text-slate-400 text-sm font-medium mt-2">
                              {tt('Create a draft invoice from this pricing (setup + monthly).', 'Bu fiyatlamadan taslak fatura oluştur (setup + aylık).')}
                            </p>
                          </div>
                          <button
                            onClick={() => createInvoiceFromPricing(session)}
                            disabled={!!pricingActionSessionId}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black px-10 py-4 rounded-3xl text-[10px] uppercase tracking-widest shadow-xl border border-indigo-400/20 transition-all active:scale-95"
                          >
                            {pricingActionSessionId === session.id ? tt('Creating…', 'Oluşturuluyor…') : tt('Create Invoice Draft', 'Taslak Fatura Oluştur')}
                          </button>
                        </div>

                        {pricingMessage?.sessionId === session.id && (
                          <div className="mt-6 bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-green-300 text-xs font-black uppercase tracking-widest">
                            {pricingMessage.text}
                          </div>
                        )}

                        {pricingError?.sessionId === session.id && (
                          <div className="mt-6 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                            {pricingError.text}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="bg-indigo-600/5 border border-indigo-500/10 p-12 rounded-[48px] relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-8">
                       <span className="w-16 h-[1px] bg-indigo-500/40"></span>
                       <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">{tt('Final Board Synthesis', 'Final Yönetim Kurulu Sentezi')}</h4>
                       <span className="w-full h-[1px] bg-indigo-500/10"></span>
                    </div>
                    <div className="text-slate-300 leading-[1.8] text-base whitespace-pre-wrap font-medium">
                       {session.synthesis}
                    </div>
                  </div>

                  {(session.modelOutputs?.length || session.stage2Rankings?.length || session.aggregateRankings?.length) ? (
                    <div className="bg-slate-900/30 border border-slate-800 p-12 rounded-[48px] space-y-8">
                      <div className="flex items-center gap-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">{tt('Board Evidence', 'Yönetim Kurulu Kanıtları')}</h4>
                        {session.chairmanModel && (
                          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                            {tt('Chairman', 'Chairman')}: {session.chairmanModel}
                          </span>
                        )}
                      </div>

                      {session.aggregateRankings?.length ? (
                        <div className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{tt('Aggregate Ranking', 'Toplam Sıralama')}</p>
                          <div className="space-y-3">
                            {session.aggregateRankings.map((r) => (
                              <div key={r.model} className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800">
                                <div>
                                  <p className="text-[10px] font-black text-slate-100">{r.model}</p>
                                  <p className="text-[8px] text-slate-600 uppercase font-black mt-1">{tt('rankings', 'sıralama')}: {r.rankingsCount}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-indigo-400 font-black">avg #{r.averageRank}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {session.modelOutputs?.length ? (
                        <details className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8">
                          <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {tt('Stage 1 — Model Outputs', 'Aşama 1 — Model Çıktıları')}
                          </summary>
                          <div className="mt-6 space-y-6">
                            {session.modelOutputs.map((m, idx) => (
                              <div key={`${m.model}-${idx}`} className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                <p className="text-[10px] font-black text-white">{m.model}</p>
                                <pre className="mt-4 text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{m.content}</pre>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      {session.stage2Rankings?.length ? (
                        <details className="bg-slate-950/60 rounded-[32px] border border-slate-800 p-8">
                          <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {tt('Stage 2 — Peer Rankings', 'Aşama 2 — Karşılıklı Sıralama')}
                          </summary>
                          <div className="mt-6 space-y-6">
                            {session.stage2Rankings.map((m, idx) => (
                              <div key={`${m.model}-${idx}`} className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                <div className="flex justify-between items-center">
                                  <p className="text-[10px] font-black text-white">{m.model}</p>
                                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                    {m.parsedRanking?.length ? tt(`Parsed: ${m.parsedRanking.join(', ')}`, `Ayrıştırıldı: ${m.parsedRanking.join(', ')}`) : tt('Parsed: —', 'Ayrıştırıldı: —')}
                                  </p>
                                </div>
                                <pre className="mt-4 text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">{m.content}</pre>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CouncilRoom;
