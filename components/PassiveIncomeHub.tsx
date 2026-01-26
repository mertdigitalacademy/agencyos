import React, { useEffect, useMemo, useState } from 'react';
import type { AgencyDocument, AppLanguage, PassiveIdea } from '../types';
import { generatePassiveIncomeAsset, generatePassiveIncomePlan, listPassiveIdeas } from '../services/api';
import { useI18n } from '../services/i18n';

type CatalogPrefill = { query: string; requiredTags?: string[] };

type PassiveIncomeHubProps = {
  onOpenCatalog: (prefill?: CatalogPrefill) => void;
  onOpenAssistant: (prompt?: string) => void;
};

function toAppLanguage(language: string): AppLanguage {
  return language === 'en' ? 'en' : 'tr';
}

function formatMoney(currency: string, amount: number, language: AppLanguage): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${Math.round(value).toLocaleString()}`;
  }
}

function estimatePassiveRevenue(ideaId: string): { currency: string; price: number; salesPerMonth: number; monthly: number; note: { en: string; tr: string } } | null {
  const id = String(ideaId || '').trim();
  if (!id) return null;

  const currency = 'USD';
  const presets: Record<string, { price: number; salesPerMonth: number; note: { en: string; tr: string } }> = {
    'workflow-starter-pack': { price: 149, salesPerMonth: 10, note: { en: 'Template pack + checklist.', tr: 'Template paketi + checklist.' } },
    'audit-product': { price: 499, salesPerMonth: 4, note: { en: 'Fixed-scope audit (7 days).', tr: 'Sabit kapsam audit (7 gün).' } },
    'newsletter-funnel': { price: 19, salesPerMonth: 50, note: { en: 'Paid newsletter / community.', tr: 'Ücretli bülten / topluluk.' } },
    'affiliate-toolstack': { price: 99, salesPerMonth: 15, note: { en: 'Tutorial + template upsell.', tr: 'Eğitim + template upsell.' } },
    'youtube-lead-machine': { price: 249, salesPerMonth: 6, note: { en: 'YouTube → pack → clients.', tr: 'YouTube → paket → müşteri.' } },
  };

  const preset = presets[id];
  if (!preset) return null;
  return {
    currency,
    price: preset.price,
    salesPerMonth: preset.salesPerMonth,
    monthly: preset.price * preset.salesPerMonth,
    note: preset.note,
  };
}

const PassiveIncomeHub: React.FC<PassiveIncomeHubProps> = ({ onOpenCatalog, onOpenAssistant }) => {
  const { language, tt } = useI18n();
  const appLang = toAppLanguage(language);

  const [ideas, setIdeas] = useState<PassiveIdea[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<AgencyDocument | null>(null);
  const [assetDocs, setAssetDocs] = useState<Record<number, AgencyDocument>>({});
  const [activeAssetIndex, setActiveAssetIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(() => ideas.find((i) => i.id === selectedId) ?? ideas[0] ?? null, [ideas, selectedId]);
  const estimate = useMemo(() => (selected?.id ? estimatePassiveRevenue(selected.id) : null), [selected?.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(null);
      try {
        const list = await listPassiveIdeas();
        if (cancelled) return;
        setIdeas(list);
        setSelectedId((prev) => prev ?? list?.[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : tt('Failed to load ideas', 'Fikirler yüklenemedi'));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tt]);

  useEffect(() => {
    setGeneratedDoc(null);
    setAssetDocs({});
    setActiveAssetIndex(null);
  }, [selectedId]);

  const generatePlan = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const out = await generatePassiveIncomePlan({ ideaId: selected.id, language: appLang });
      setGeneratedDoc(out.document);
      setAssetDocs({});
      setActiveAssetIndex(null);
      setMessage(tt('Plan generated and saved to Archive (Agency docs).', 'Plan üretildi ve Arşiv’e kaydedildi (Ajans dokümanları).'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Plan generation failed', 'Plan üretimi başarısız'));
    } finally {
      setBusy(false);
    }
  };

  const generateAsset = async (assetIndex: number) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const out = await generatePassiveIncomeAsset({ ideaId: selected.id, assetIndex, language: appLang });
      setAssetDocs((prev) => ({ ...prev, [out.assetIndex]: out.document }));
      setActiveAssetIndex(out.assetIndex);
      setMessage(tt('Asset generated and saved to Archive.', 'Asset üretildi ve Arşiv’e kaydedildi.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Asset generation failed', 'Asset üretimi başarısız'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(tt('Copied.', 'Kopyalandı.'));
    } catch {
      setError(tt('Copy failed.', 'Kopyalama başarısız.'));
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{tt('Passive Income Hub', 'Pasif Gelir Hub')}</h2>
            <p className="text-slate-400 mt-3 text-sm font-medium leading-relaxed">
              {tt(
                'Pick a passive income model, generate a launch plan, then automate delivery using the workflow catalog.',
                'Bir pasif gelir modelini seç, launch planını üret, sonra workflow kataloğu ile teslimatı otomatikleştir.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  onOpenAssistant(
                    selected
                      ? tt(
                          `I want to launch a passive income offer: "${selected.title.en}". Give me the simplest next 3 actions inside AgencyOS (catalog keywords, docs to generate, and a first sales plan).`,
                          `Şu pasif gelir fikrini launch etmek istiyorum: "${selected.title.tr}". AgencyOS içinde en basit sıradaki 3 aksiyonu ver (katalog keyword’leri, üretilecek dokümanlar ve ilk satış planı).`,
                        )
                      : tt(
                          'I want to build passive income. Ask me 3 questions and recommend the best model to start with.',
                          'Pasif gelir kurmak istiyorum. Bana 3 soru sor ve en iyi başlangıç modelini öner.',
                        ),
                  )
                }
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
              >
                {tt('Ask Global Assistant', 'Global Asistan’a Sor')}
              </button>
              {selected?.defaultCatalogQuery && (
                <button
                  onClick={() => onOpenCatalog({ query: selected.defaultCatalogQuery, requiredTags: selected.requiredTags })}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
                >
                  {tt('Open workflow catalog', 'Workflow kataloğunu aç')}
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              onClick={generatePlan}
              disabled={busy || !selected}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black px-8 py-5 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
            >
              {busy ? tt('Generating…', 'Üretiliyor…') : tt('Generate launch plan', 'Launch planı üret')}
            </button>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`p-6 rounded-[36px] border shadow-2xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{error ?? message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Idea Library', 'Fikir Kütüphanesi')}</p>
            <div className="mt-6 space-y-4">
              {ideas.map((idea) => {
                const active = selected?.id === idea.id;
                return (
                  <button
                    key={idea.id}
                    onClick={() => setSelectedId(idea.id)}
                    className={`w-full text-left p-6 rounded-[32px] border transition-all ${active ? 'bg-indigo-600/10 border-indigo-500/20 text-white shadow-xl' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                  >
                    <p className="text-sm font-black uppercase tracking-tight">{idea.title[language]}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">{idea.description[language]}</p>
                  </button>
                );
              })}
              {ideas.length === 0 && (
                <div className="text-slate-600 text-xs font-black uppercase tracking-widest py-10">
                  {tt('No ideas loaded.', 'Fikirler yüklenmedi.')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl">
            {selected ? (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{selected.title[language]}</h3>
                  <p className="text-slate-400 mt-3 text-sm font-medium leading-relaxed">{selected.description[language]}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Example offer', 'Örnek teklif')}</p>
                    <p className="mt-3 text-sm text-slate-200 font-medium leading-relaxed">{selected.exampleOffer[language]}</p>
                    {estimate ? (
                      <div className="mt-5 bg-green-500/10 border border-green-500/20 rounded-3xl p-5">
                        <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">{tt('Potential revenue', 'Potansiyel gelir')}</p>
                        <p className="mt-2 text-xl font-black text-slate-200 tracking-tight">
                          {formatMoney(estimate.currency, estimate.monthly, appLang)} / {tt('month', 'ay')}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500 font-bold">
                          {formatMoney(estimate.currency, estimate.price, appLang)} × {estimate.salesPerMonth} {tt('sales/mo', 'satış/ay')} • {estimate.note[language]}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Assets', 'Asset’ler')}</p>
                    <div className="mt-4 space-y-3">
                      {selected.assets.map((a, idx) => {
                        const doc = assetDocs[idx];
                        return (
                          <div key={idx} className="flex items-start justify-between gap-3 bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-200 font-bold leading-snug">{a[language]}</p>
                              {doc && <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1">{tt('Generated', 'Üretildi')}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              {doc && (
                                <button
                                  onClick={() => copy(doc.content)}
                                  className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-3 py-2 rounded-xl text-[9px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                                >
                                  {tt('Copy', 'Kopyala')}
                                </button>
                              )}
                              <button
                                onClick={() => generateAsset(idx)}
                                disabled={busy}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black px-3 py-2 rounded-xl text-[9px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
                              >
                                {busy ? tt('…', '…') : tt('Generate', 'Üret')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Automation keywords (workflow catalog)', 'Otomasyon keyword’leri (workflow kataloğu)')}</p>
                  <p className="mt-3 text-sm text-slate-200 font-mono">{selected.defaultCatalogQuery}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => onOpenCatalog({ query: selected.defaultCatalogQuery, requiredTags: selected.requiredTags })}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
                    >
                      {tt('Search workflows', 'Workflow ara')}
                    </button>
                    <button
                      onClick={() => copy(selected.defaultCatalogQuery)}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all shadow-xl active:scale-95"
                    >
                      {tt('Copy keywords', 'Keyword kopyala')}
                    </button>
                  </div>
                </div>

                {generatedDoc && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Latest plan (saved to Archive)', 'Son plan (Arşiv’e kaydedildi)')}</p>
                        <p className="text-white font-black mt-2 uppercase tracking-tight">{generatedDoc.name}</p>
                      </div>
                      <button
                        onClick={() => copy(generatedDoc.content)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all shadow-xl active:scale-95"
                      >
                        {tt('Copy', 'Kopyala')}
                      </button>
                    </div>
                    <div className="mt-6 text-[12px] text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto no-scrollbar">
                      {generatedDoc.content}
                    </div>
                  </div>
                )}

                {activeAssetIndex !== null && assetDocs[activeAssetIndex] && (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Latest asset (saved to Archive)', 'Son asset (Arşiv’e kaydedildi)')}</p>
                        <p className="text-white font-black mt-2 uppercase tracking-tight">{assetDocs[activeAssetIndex].name}</p>
                      </div>
                      <button
                        onClick={() => copy(assetDocs[activeAssetIndex].content)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all shadow-xl active:scale-95"
                      >
                        {tt('Copy', 'Kopyala')}
                      </button>
                    </div>
                    <div className="mt-6 text-[12px] text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto no-scrollbar">
                      {assetDocs[activeAssetIndex].content}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm">{tt('Select an idea to start.', 'Başlamak için bir fikir seç.')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassiveIncomeHub;
