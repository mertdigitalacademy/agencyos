import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppLanguage, Project } from '../types';
import { runCouncilPlayground } from '../services/api';
import { useI18n } from '../services/i18n';

type L10nText = { en: string; tr: string };

type CouncilPlaygroundResult = {
  id: string;
  prompt: string;
  stage1: Array<{ model: string; content: string }>;
  stage2: Array<{ model: string; content: string; parsedRanking: string[] }>;
  labelToModel: Record<string, string>;
  aggregateRankings: Array<{ model: string; averageRank: number; rankingsCount: number }>;
  chairmanModel: string;
  final: { model: string; content: string };
  createdAt: string;
};

type BoardChatTurn = {
  id: string;
  prompt: string;
  requestPrompt: string;
  status: 'loading' | 'done' | 'error';
  result?: CouncilPlaygroundResult;
  error?: string;
  createdAt: string;
};

type BoardMemberId = 'strategy' | 'risk' | 'ops' | 'growth' | 'chair';

type BoardMember = {
  id: BoardMemberId;
  title: string;
  name: string;
  avatar: string;
  focus: string;
  thinking: string;
};

function TypingDots({ active, className }: { active: boolean; className?: string }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!active) {
      setDots('');
      return;
    }

    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % 3;
      setDots('.'.repeat(i + 1));
    }, 320);

    return () => window.clearInterval(id);
  }, [active]);

  return <span className={className}>{dots}</span>;
}

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

const BOARD_TRAIT_OPTIONS: Record<BoardMemberId, L10nText[]> = {
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

function rollBoardTraits(): Record<BoardMemberId, L10nText[]> {
  return {
    strategy: pickN(BOARD_TRAIT_OPTIONS.strategy, 3),
    risk: pickN(BOARD_TRAIT_OPTIONS.risk, 3),
    ops: pickN(BOARD_TRAIT_OPTIONS.ops, 3),
    growth: pickN(BOARD_TRAIT_OPTIONS.growth, 3),
    chair: pickN(BOARD_TRAIT_OPTIONS.chair, 3),
  };
}

const BOARD_STUDIO_ANIMATIONS = `
@keyframes boardFadeUp {
  0% { opacity: 0; transform: translate3d(0, 14px, 0); }
  100% { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes boardFloat {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(0, -14px, 0) scale(1.02); }
}
`;

const BOARD_THEME_STYLE = {
  '--board-accent': '#0ea5e9',
  '--board-accent-strong': '#0369a1',
  '--board-accent-soft': 'rgba(14, 165, 233, 0.12)',
  '--board-accent-warm': '#f59e0b',
  '--board-ink': '#0f172a',
  '--board-muted': 'rgba(15, 23, 42, 0.6)',
  '--board-panel': 'rgba(255, 255, 255, 0.86)',
  '--board-panel-strong': 'rgba(255, 255, 255, 0.95)',
  '--board-border': 'rgba(15, 23, 42, 0.12)',
  '--board-shadow': '0 30px 70px rgba(15, 23, 42, 0.12)',
} as React.CSSProperties;

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--board-panel)',
  borderColor: 'var(--board-border)',
  boxShadow: 'var(--board-shadow)',
  backdropFilter: 'blur(14px)',
};

const PANEL_STRONG_STYLE: React.CSSProperties = {
  background: 'var(--board-panel-strong)',
  borderColor: 'var(--board-border)',
  boxShadow: 'var(--board-shadow)',
  backdropFilter: 'blur(18px)',
};

export default function BoardStudioPage(props: {
  projects: Project[];
  initialProjectId?: string | null;
  onClose: () => void;
  onOpenSessions?: () => void;
}) {
  const { language, tt } = useI18n();
  const [activeProjectId, setActiveProjectId] = useState(() => String(props.initialProjectId ?? '').trim());
  const [mode, setMode] = useState<'ceo' | 'quick'>('ceo');
  const [remember, setRemember] = useState(true);
  const [traitsAuto, setTraitsAuto] = useState(true);
  const [traits, setTraits] = useState<Record<BoardMemberId, L10nText[]>>(() => rollBoardTraits());
  const [turns, setTurns] = useState<BoardChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState('');
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [starterCity, setStarterCity] = useState('');
  const [starterNiche, setStarterNiche] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const project = useMemo(() => props.projects.find((p) => p.id === activeProjectId), [props.projects, activeProjectId]);

  useEffect(() => {
    if (activeProjectId) return;
    const first = props.projects[0]?.id;
    if (first) setActiveProjectId(first);
  }, [activeProjectId, props.projects]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns.length]);

  useEffect(() => {
    if (starterCity.trim()) return;
    setStarterCity(language === 'tr' ? 'İstanbul' : 'Istanbul');
  }, [starterCity, language]);

  useEffect(() => {
    if (starterNiche.trim()) return;
    const industry = String((project as any)?.brief?.industry ?? '').trim();
    if (industry) setStarterNiche(industry);
  }, [starterNiche, project?.id]);

  const boardMembers: BoardMember[] = useMemo(() => {
    const t = (en: string, tr: string) => (language === 'tr' ? tr : en);
    return [
      {
        id: 'strategy',
        title: t('Strategy', 'Strateji'),
        name: t('Strategy Director', 'Strateji Direktörü'),
        avatar: '📈',
        focus: t('Offer, positioning, pricing', 'Teklif, konumlandırma, fiyat'),
        thinking: t('Packaging the offer…', 'Teklifi paketliyor…'),
      },
      {
        id: 'risk',
        title: t('Risk', 'Risk'),
        name: t('Risk & Compliance', 'Risk & Uyum'),
        avatar: '⚖️',
        focus: t('Security, privacy, realism', 'Güvenlik, gizlilik, gerçekçilik'),
        thinking: t('Reality + risk check…', 'Gerçekçilik + risk kontrolü…'),
      },
      {
        id: 'ops',
        title: t('Ops', 'Operasyon'),
        name: t('Ops Lead', 'Operasyon Şefi'),
        avatar: '🛠️',
        focus: t('Delivery, checklist, monitoring', 'Teslimat, checklist, izleme'),
        thinking: t('Building the execution plan…', 'Uygulama planı çıkarıyor…'),
      },
      {
        id: 'growth',
        title: t('Growth', 'Büyüme'),
        name: t('Growth Director', 'Büyüme Direktörü'),
        avatar: '🎯',
        focus: t('Outbound, messaging, distribution', 'Outbound, mesajlar, dağıtım'),
        thinking: t('Writing outreach scripts…', 'Outreach mesajlarını yazıyor…'),
      },
      {
        id: 'chair',
        title: t('Chair', 'Başkan'),
        name: t('Board Chair', 'Yönetim Kurulu Başkanı'),
        avatar: '🏛️',
        focus: t('Synthesis + decision', 'Sentez + karar'),
        thinking: t('Synthesizing the final plan…', 'Final planı sentezliyor…'),
      },
    ];
  }, [language]);

  const reroll = () => setTraits(rollBoardTraits());

  useEffect(() => {
    if (!isSending) return;
    setSpeakerIndex(0);
    const id = window.setInterval(() => {
      setSpeakerIndex((prev) => (prev + 1) % Math.max(1, boardMembers.length));
    }, 520);
    return () => window.clearInterval(id);
  }, [isSending, boardMembers.length]);

  const buildPrompt = (userPrompt: string, nextTraits: Record<BoardMemberId, L10nText[]>) => {
    const parts: string[] = [];

    if (mode === 'ceo') {
      parts.push(
        language === 'tr'
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
            ].join('\n'),
      );
    } else {
      parts.push(
        language === 'tr'
          ? 'Sen AgencyOS Yönetim Kurulu’sun. Az teknik, net, uygulanabilir cevap ver. 6–10 madde yeter.'
          : 'You are the AgencyOS Management Board. Be direct and practical. 6–10 bullets is enough.',
      );
    }

    try {
      const lines = boardMembers
        .map((m) => {
          const selected = nextTraits?.[m.id] ?? [];
          const label = selected.map((t) => t[language]).filter(Boolean).join(' • ');
          return label ? `${m.name}: ${label}` : `${m.name}`;
        })
        .join('\n');
      parts.push(language === 'tr' ? `Kurul profili (bu tur):\n${lines}` : `Board profile (this turn):\n${lines}`);
    } catch {
      // ignore
    }

    if (project?.brief) {
      const brief: any = project.brief;
      const goals = Array.isArray(brief.goals) ? brief.goals.filter(Boolean).slice(0, 8) : [];
      const tools = Array.isArray(brief.tools) ? brief.tools.filter(Boolean).slice(0, 12) : [];
      const briefLine = [
        brief.clientName ? `client: ${brief.clientName}` : null,
        brief.industry ? `industry: ${brief.industry}` : null,
        goals.length ? `goals: ${goals.join(' | ')}` : null,
        tools.length ? `tools: ${tools.join(', ')}` : null,
        brief.description ? `description: ${brief.description}` : null,
      ]
        .filter(Boolean)
        .join(' • ');
      if (briefLine.trim()) {
        parts.push(language === 'tr' ? `Proje bağlamı: ${briefLine}` : `Project context: ${briefLine}`);
      }
    }

    if (remember) {
      const recent = turns.filter((t) => t.status === 'done' && t.result?.final?.content).slice(-2);
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

  const sendPrompt = async (promptText: string) => {
    const userPrompt = String(promptText || '').trim();
    if (!userPrompt) return;
    if (isSending) return;

    const nextTraits = traitsAuto ? rollBoardTraits() : traits;
    if (traitsAuto) setTraits(nextTraits);

    const requestPrompt = buildPrompt(userPrompt, nextTraits);
    const id = `boardturn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const createdAt = new Date().toISOString();

    setIsSending(true);
    setInput('');
    setTurns((prev) => [...prev, { id, prompt: userPrompt, requestPrompt, status: 'loading', createdAt }]);

    try {
      const result = await runCouncilPlayground({ prompt: requestPrompt, language: language as AppLanguage });
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'done', result } : t)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Board request failed', 'Kurul isteği başarısız');
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'error', error: msg } : t)));
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => {
        try {
          endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } catch {
          // ignore
        }
      });
    }
  };

  const buildStarterPrompt = () => {
    const city = starterCity.trim() || (language === 'tr' ? 'İstanbul' : 'Istanbul');
    const niche = starterNiche.trim() || (language === 'tr' ? 'diş klinikleri' : 'dental clinics');
    return language === 'tr'
      ? `${city} ${niche}: 7 günde ilk 3 müşteriyi nasıl bulurum? Ne satayım, fiyatlandırma (3 paket), outreach mesajları ve 7 günlük plan dahil.`
      : `${city} ${niche}: how do I get my first 3 clients in 7 days? Include offer, pricing (3 tiers), outreach messages, and a 7-day plan.`;
  };

  const startBoard = async () => {
    const candidate = String(input || '').trim() || buildStarterPrompt();
    await sendPrompt(candidate);
  };

  const send = async () => sendPrompt(input);

  const renderSessionSetup = () => (
    <div className="rounded-[28px] border p-6" style={PANEL_STYLE}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            {tt('Session setup', 'Oturum ayarları')}
          </p>
          <h3 className="text-xl font-black text-white tracking-tight mt-2">{tt('Configure the board', 'Kurulu ayarla')}</h3>
          <p className="text-slate-500 text-sm font-medium mt-2">
            {tt('Pick the project and answer depth.', 'Projeyi ve cevap derinliğini seç.')}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
          style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)', color: 'var(--board-muted)' }}
        >
          {mode === 'ceo' ? tt('Full plan', 'Tam plan') : tt('Quick', 'Hızlı')}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{tt('Project', 'Proje')}</p>
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-sky-200/60 transition-all"
            style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)', color: 'var(--board-ink)' }}
          >
            {props.projects.length === 0 ? (
              <option value="">{tt('No projects', 'Proje yok')}</option>
            ) : (
              props.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.brief.clientName || p.id)}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{tt('Mode', 'Mod')}</p>
          <div
            className="flex flex-wrap gap-2 rounded-full border p-1"
            style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)' }}
          >
            {([
              { id: 'ceo' as const, label: tt('CEO Mode', 'CEO Modu') },
              { id: 'quick' as const, label: tt('Quick', 'Hızlı') },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                style={{
                  background: mode === m.id ? 'var(--board-accent)' : 'transparent',
                  color: mode === m.id ? '#fff' : 'var(--board-muted)',
                  boxShadow: mode === m.id ? '0 10px 22px rgba(14, 165, 233, 0.25)' : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(Boolean(e.target.checked))} className="h-4 w-4 accent-sky-500" />
          {tt('Remember conversation', 'Konuşmayı hatırla')}
        </label>
        <button
          onClick={() => setTurns([])}
          className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all hover:-translate-y-0.5"
          style={{ borderColor: 'var(--board-border)', color: 'var(--board-accent-strong)', background: 'rgba(255, 255, 255, 0.9)' }}
        >
          {tt('Clear chat', 'Sohbeti temizle')}
        </button>
      </div>
    </div>
  );

  const renderQuickStart = () => (
    <div className="rounded-[28px] border p-6" style={PANEL_STYLE}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{tt('Quick start', 'Hızlı başlangıç')}</p>
          <h3 className="text-xl font-black text-white tracking-tight mt-2">{tt('Kick off with a niche', 'Bir nişle başla')}</h3>
          <p className="text-slate-500 text-sm font-medium mt-2">
            {tt('City + niche gives a full agency roadmap.', 'Şehir + niş tam ajans planını getirir.')}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
          style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)', color: 'var(--board-muted)' }}
        >
          {mode === 'ceo' ? tt('Full plan', 'Tam plan') : tt('Quick', 'Hızlı')}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{tt('City', 'Şehir')}</p>
          <input
            value={starterCity}
            onChange={(e) => setStarterCity(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-sky-200/60 transition-all"
            style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)', color: 'var(--board-ink)' }}
            placeholder={tt('e.g. Istanbul', 'örn. İstanbul')}
          />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{tt('Niche', 'Niş')}</p>
          <input
            value={starterNiche}
            onChange={(e) => setStarterNiche(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-sky-200/60 transition-all"
            style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)', color: 'var(--board-ink)' }}
            placeholder={tt('e.g. dental clinics', 'örn. diş klinikleri')}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          language === 'tr' ? 'Diş klinikleri' : 'Dental clinics',
          language === 'tr' ? 'Emlak ofisleri' : 'Real estate agencies',
          language === 'tr' ? 'E-ticaret markaları' : 'E-commerce brands',
          language === 'tr' ? 'Güzellik salonları' : 'Beauty salons',
        ].map((label) => (
          <button
            key={label}
            onClick={() => setStarterNiche(label)}
            className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all hover:-translate-y-0.5"
            style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
          {tt('Tip:', 'İpucu:')} {tt('start with "niche + city" then add constraints.', '"niş + şehir" ile başla, sonra kısıt ekle.')}
        </p>
        <button
          onClick={() => void startBoard()}
          disabled={isSending}
          className="px-6 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all border"
          style={{
            borderColor: 'transparent',
            background: 'var(--board-accent)',
            color: '#fff',
            boxShadow: '0 18px 40px rgba(14, 165, 233, 0.3)',
            opacity: isSending ? 0.7 : 1,
          }}
        >
          {isSending ? tt('Board is thinking...', 'Yönetim Kurulu düşünüyor...') : tt('Start', 'Başlat')}
        </button>
      </div>
    </div>
  );

  const renderMemberTable = () => (
    <div className="relative overflow-hidden rounded-[28px] border p-6" style={PANEL_STYLE}>
      <div
        className="absolute -top-16 -right-16 h-48 w-48 rounded-full blur-[90px] opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.25), transparent 70%)' }}
      />
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              {tt('Board roster', 'Kurul kadrosu')}
            </p>
            <h3 className="text-xl font-black text-white tracking-tight mt-2">{tt('Your AI Board', 'AI Kurulun')}</h3>
            <p className="text-slate-500 text-sm font-medium mt-2">
              {isSending
                ? tt('Deliberating now — watch the speaker light.', 'Tartışma başladı — konuşan ışık yanıyor.')
                : tt('Ready — trigger a full roadmap in one shot.', 'Hazır — tek seferde tam yol haritası al.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={reroll}
              className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)', color: 'var(--board-ink)' }}
            >
              {tt('Reroll traits', 'Kişiliği yenile')}
            </button>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              <input type="checkbox" checked={traitsAuto} onChange={(e) => setTraitsAuto(Boolean(e.target.checked))} className="h-4 w-4 accent-sky-500" />
              {tt('Auto traits', 'Otomatik kişilik')}
            </label>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
          {boardMembers.map((m, idx) => {
            const t = (traits[m.id] ?? []).slice(0, 2);
            const isChair = m.id === 'chair';
            const isActive = isSending && idx === speakerIndex;
            const cardStyle: React.CSSProperties = {
              borderColor: isChair ? 'var(--board-accent-strong)' : 'var(--board-border)',
              background: isActive ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.82)',
              boxShadow: isActive ? '0 16px 40px rgba(14, 165, 233, 0.18)' : 'none',
              animation: 'boardFadeUp 600ms ease-out both',
              animationDelay: `${idx * 70}ms`,
            };
            return (
              <div key={m.id} className="rounded-2xl border p-4 transition-all" style={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-2xl flex items-center justify-center text-xl border"
                      style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      <span className={isActive ? 'animate-pulse' : ''}>{m.avatar}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{m.title}</p>
                      <p className="text-[11px] font-semibold text-slate-600">{m.name}</p>
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                    style={{
                      borderColor: isActive ? 'var(--board-accent-strong)' : 'var(--board-border)',
                      background: isActive ? 'var(--board-accent-soft)' : 'rgba(255, 255, 255, 0.9)',
                      color: isActive ? 'var(--board-accent-strong)' : 'var(--board-muted)',
                    }}
                  >
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-sky-500 animate-pulse' : 'bg-emerald-400'}`} />
                    {isActive ? tt('Talking', 'Konuşuyor') : tt('Ready', 'Hazır')}
                    <TypingDots active={isActive} className="ml-1" />
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 font-medium leading-snug">{m.focus}</p>
                {t.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.map((x, traitIdx) => (
                      <span
                        key={`${m.id}-trait-${traitIdx}`}
                        className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                        style={{
                          borderColor: isChair ? 'rgba(14, 165, 233, 0.3)' : 'var(--board-border)',
                          color: isChair ? 'var(--board-accent-strong)' : 'var(--board-muted)',
                          background: isChair ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.9)',
                        }}
                      >
                        {x[language]}
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
  );

  const activeProjectLabel = project ? String(project.brief.clientName || project.id) : tt('No projects', 'Proje yok');
  const boardRootStyle = {
    ...BOARD_THEME_STYLE,
    fontFamily: '"Space Grotesk", "Inter", sans-serif',
  } as React.CSSProperties;

  return (
    <div className="relative min-h-full w-full overflow-hidden" style={boardRootStyle}>
      <style>{BOARD_STUDIO_ANIMATIONS}</style>

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-40 right-[-120px] h-[420px] w-[420px] rounded-full blur-[140px] opacity-80"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.28), transparent 70%)',
            animation: 'boardFloat 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-48 left-[-120px] h-[480px] w-[480px] rounded-full blur-[160px] opacity-70"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22), transparent 70%)',
            animation: 'boardFloat 16s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.12) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
      </div>

      <div className="relative min-h-full flex flex-col">
        <header className="border-b" style={PANEL_STRONG_STYLE}>
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div style={{ animation: 'boardFadeUp 650ms ease-out both' }}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border"
                    style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {tt('Board Studio', 'Yönetim Kurulu Stüdyosu')}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{ borderColor: 'var(--board-border)', color: 'var(--board-accent-strong)', background: 'var(--board-accent-soft)' }}
                  >
                    {tt('Live session', 'Canlı oturum')}
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mt-3">
                  {tt('Talk to your AI Board', 'AI Yönetim Kurulunla Konuş')}
                </h1>
                <p className="text-slate-500 text-sm md:text-base font-medium mt-3 max-w-2xl">
                  {tt(
                    'Ask a niche + city. Get a complete agency roadmap: offer, pricing, revenue math, outreach messages, and a 7-day plan.',
                    'Bir niş + şehir yaz. Kurul sana tam ajans planı çıkarsın: teklif, fiyat, kazanç hesabı, mesajlar ve 7 günlük plan.',
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {tt('Project:', 'Proje:')} {activeProjectLabel}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {tt('Mode:', 'Mod:')} {mode === 'ceo' ? tt('CEO Mode', 'CEO Modu') : tt('Quick', 'Hızlı')}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {remember ? tt('Memory on', 'Hafıza açık') : tt('Memory off', 'Hafıza kapalı')}
                  </span>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-3"
                style={{ animation: 'boardFadeUp 650ms ease-out both', animationDelay: '120ms' }}
              >
                {props.onOpenSessions ? (
                  <button
                    onClick={props.onOpenSessions}
                    className="px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all hover:-translate-y-0.5"
                    style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)', color: 'var(--board-ink)' }}
                  >
                    {tt('Board Sessions', 'Kurul Oturumları')}
                  </button>
                ) : null}
                <button
                  onClick={props.onClose}
                  className="px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: 'transparent',
                    background: 'var(--board-accent)',
                    color: '#fff',
                    boxShadow: '0 18px 40px rgba(14, 165, 233, 0.3)',
                  }}
                >
                  {tt('Close', 'Kapat')}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
          <div className="min-h-full xl:h-full max-w-7xl mx-auto px-6 lg:px-10 py-8 grid xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
            <aside className="flex flex-col gap-6 min-h-0" style={{ animation: 'boardFadeUp 700ms ease-out both', animationDelay: '180ms' }}>
              {renderSessionSetup()}
              {renderMemberTable()}
              {renderQuickStart()}
            </aside>

            <section className="flex flex-col gap-6 min-h-0" style={{ animation: 'boardFadeUp 700ms ease-out both', animationDelay: '240ms' }}>
              <div className="rounded-[28px] border p-6 flex flex-col min-h-0" style={PANEL_STYLE}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{tt('Board channel', 'Kurul kanalı')}</p>
                    <h3 className="text-xl font-black text-white tracking-tight mt-2">{tt('Conversation', 'Konuşma')}</h3>
                    <p className="text-slate-500 text-sm font-medium mt-2">
                      {turns.length === 0
                        ? tt('Waiting for your first prompt.', 'İlk mesajını bekliyor.')
                        : tt('Live board responses appear here.', 'Canlı kurul cevapları burada görünür.')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                      style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {tt('Turns', 'Tur')}: {turns.length}
                    </span>
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                      style={{ borderColor: 'var(--board-border)', color: 'var(--board-muted)', background: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {mode === 'ceo' ? tt('CEO', 'CEO') : tt('Quick', 'Hızlı')}
                    </span>
                  </div>
                </div>

                <div ref={scrollRef} className="mt-5 flex-1 min-h-0 overflow-y-auto pr-2 space-y-6">
                  {turns.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-16">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border"
                        style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.9)' }}
                      >
                        🎛️
                      </div>
                      <h4 className="mt-4 text-lg font-black text-white">{tt('Board is standing by', 'Kurul hazır')}</h4>
                      <p className="mt-2 text-sm text-slate-500 max-w-sm">
                        {tt('Use Quick Start on the left or drop a custom question below.', 'Soldaki hızlı başlangıcı kullan veya sorunu aşağıya yaz.')}
                      </p>
                    </div>
                  ) : (
                    turns.map((turn, turnIdx) => (
                      <div
                        key={turn.id}
                        className="space-y-4"
                        style={{ animation: 'boardFadeUp 500ms ease-out both', animationDelay: `${turnIdx * 60}ms` }}
                      >
                        <div className="flex justify-end">
                          <div
                            className="max-w-[92%] rounded-2xl border px-5 py-4"
                            style={{ borderColor: 'var(--board-border)', background: 'rgba(14, 165, 233, 0.08)' }}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--board-accent-strong)' }}>
                              {tt('You', 'Sen')}
                            </p>
                            <p className="mt-2 text-sm font-medium whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--board-ink)' }}>
                              {turn.prompt}
                            </p>
                          </div>
                        </div>

                        {turn.status === 'loading' ? (
                          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)' }}>
                            <div className="flex items-start gap-3">
                              <div
                                className="h-10 w-10 rounded-2xl flex items-center justify-center text-xl border"
                                style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)' }}
                              >
                                🧠
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Board is thinking', 'Kurul düşünüyor')}</p>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                  {tt('Members are drafting their angles.', 'Üyeler kendi açılarını yazıyor.')}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {boardMembers.map((m, idx) => {
                                const isActive = idx === speakerIndex;
                                return (
                                  <div
                                    key={m.id}
                                    className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                                    style={{
                                      borderColor: 'var(--board-border)',
                                      background: isActive ? 'var(--board-accent-soft)' : 'rgba(255, 255, 255, 0.95)',
                                    }}
                                  >
                                    <div
                                      className="h-9 w-9 rounded-2xl flex items-center justify-center text-lg border"
                                      style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)' }}
                                    >
                                      <span className={isActive ? 'animate-pulse' : ''}>{m.avatar}</span>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{m.title}</p>
                                      <p className="text-[11px] text-slate-500 font-medium">
                                        {m.thinking}
                                        <TypingDots active={isActive} className="ml-1" />
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : turn.status === 'error' ? (
                          <div
                            className="rounded-2xl border p-5 flex items-start gap-3"
                            style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}
                          >
                            <div className="h-10 w-10 rounded-2xl flex items-center justify-center text-xl border border-red-300/40">⚠️</div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">{tt('Board Error', 'Kurul Hatası')}</p>
                              <p className="mt-2 text-sm text-red-500 font-medium whitespace-pre-wrap">
                                {turn.error || tt('Unknown error', 'Bilinmeyen hata')}
                              </p>
                            </div>
                          </div>
                        ) : turn.result?.final?.content ? (
                          <div className="rounded-2xl border p-6 space-y-5" style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)' }}>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-10 w-10 rounded-2xl flex items-center justify-center text-xl border"
                                  style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)' }}
                                >
                                  🏛️
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Chairman synthesis', 'Başkan sentezi')}</p>
                                  <p className="text-[11px] font-semibold text-slate-500">{turn.result.final.model || turn.result.chairmanModel}</p>
                                </div>
                              </div>
                              <span
                                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                                style={{ borderColor: 'var(--board-border)', color: 'var(--board-accent-strong)', background: 'var(--board-accent-soft)' }}
                              >
                                {tt('Final', 'Final')}
                              </span>
                            </div>

                            <div className="text-sm font-medium whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--board-ink)' }}>
                              {turn.result.final.content}
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <details className="rounded-2xl border p-4" style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)' }}>
                                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                  {tt('Stage 1 memos', 'Aşama 1 notları')}
                                </summary>
                                <div className="mt-3 space-y-3">
                                  {Array.isArray(turn.result.stage1) && turn.result.stage1.length ? (
                                    turn.result.stage1.slice(0, 3).map((m, idx) => {
                                      const persona = boardMembers[idx] ?? boardMembers[0];
                                      return (
                                        <div key={`${m.model}-${idx}`} className="border-l-2 pl-3" style={{ borderColor: 'var(--board-accent-soft)' }}>
                                          <div className="flex items-center justify-between gap-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{persona.name}</p>
                                            <p className="text-[10px] font-mono text-slate-500 truncate">{m.model}</p>
                                          </div>
                                          <p className="mt-2 text-xs text-slate-500 font-medium whitespace-pre-wrap">
                                            {shortenText(m.content, 240)}
                                          </p>
                                          <details className="mt-2">
                                            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
                                              {tt('Full text', 'Tam metin')}
                                            </summary>
                                            <pre className="mt-2 text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed">{m.content}</pre>
                                          </details>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-sm text-slate-500 font-medium">{tt('Stage 1 snapshots unavailable.', 'Aşama 1 notları yok.')}</p>
                                  )}
                                </div>
                              </details>

                              <details className="rounded-2xl border p-4" style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.92)' }}>
                                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                  {tt('Peer ranking', 'Akran sıralaması')}
                                </summary>
                                {Array.isArray(turn.result.aggregateRankings) && turn.result.aggregateRankings.length ? (
                                  <div className="mt-3 space-y-2">
                                    {turn.result.aggregateRankings.slice(0, 6).map((r) => (
                                      <div
                                        key={r.model}
                                        className="flex items-center justify-between rounded-xl border px-3 py-2"
                                        style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)' }}
                                      >
                                        <p className="text-[11px] text-slate-500 font-medium truncate">{r.model}</p>
                                        <p className="text-[10px] font-black" style={{ color: 'var(--board-accent-strong)' }}>
                                          avg #{r.averageRank}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm text-slate-500 font-medium">
                                    {tt('Peer ranking may be disabled for speed.', 'Akran sıralaması hız için kapalı olabilir.')}
                                  </p>
                                )}
                              </details>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              <div className="rounded-[28px] border p-6" style={PANEL_STRONG_STYLE}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  className="w-full rounded-2xl border px-5 py-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-sky-200/60 transition-all min-h-[140px]"
                  style={{ borderColor: 'var(--board-border)', background: 'rgba(255, 255, 255, 0.95)', color: 'var(--board-ink)' }}
                  placeholder={tt('Ask anything... (Cmd/Ctrl+Enter)', 'Her şeyi sor... (Cmd/Ctrl+Enter)')}
                />
                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                    {tt('Tip:', 'İpucu:')} {tt('start with "niche + city" then add constraints.', '"niş + şehir" ile başla, sonra kısıt ekle.')}
                  </p>
                  <button
                    onClick={() => void (turns.length === 0 ? startBoard() : send())}
                    disabled={isSending || (turns.length > 0 && !String(input || '').trim())}
                    className="px-6 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all border"
                    style={{
                      borderColor: 'transparent',
                      background: 'var(--board-accent)',
                      color: '#fff',
                      boxShadow: '0 18px 40px rgba(14, 165, 233, 0.3)',
                      opacity: isSending || (turns.length > 0 && !String(input || '').trim()) ? 0.7 : 1,
                    }}
                  >
                    {isSending
                      ? tt('Board is thinking...', 'Yönetim Kurulu düşünüyor...')
                      : turns.length === 0
                        ? tt('Start Board', 'Kurulu Başlat')
                        : tt('Send to Board', 'Kurula Gönder')}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
