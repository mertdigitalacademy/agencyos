import { useState } from 'react';
import { useI18n } from '../services/i18n';

interface MoneyProps {
  onNavigate: (view: string) => void;
}

export default function Money({ onNavigate }: MoneyProps) {
  const { t, lang } = useI18n();

  // Gelir hesaplayıcı state
  const [calculator, setCalculator] = useState({
    targetMrr: 5000,
    avgRetainer: 1000,
    closeRate: 30,
    bookingRate: 50
  });

  // Hesaplamalar
  const clientsNeeded = Math.ceil(calculator.targetMrr / calculator.avgRetainer);
  const proposalsNeeded = Math.ceil(clientsNeeded / (calculator.closeRate / 100));
  const leadsNeeded = Math.ceil(proposalsNeeded / (calculator.bookingRate / 100));

  const scenarios = [
    { target: 5000, label: lang === 'tr' ? '5.000₺/ay' : '$5k/month' },
    { target: 10000, label: lang === 'tr' ? '10.000₺/ay' : '$10k/month' },
    { target: 20000, label: lang === 'tr' ? '20.000₺/ay' : '$20k/month' }
  ];

  function applyScenario(target: number) {
    setCalculator({ ...calculator, targetMrr: target });
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Başlık */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <span>💰</span>
          <span>{lang === 'tr' ? 'Gelir Planlama' : 'Revenue Planning'}</span>
        </h1>
        <p className="text-gray-400">
          {lang === 'tr'
            ? 'Hedef gelirinize nasıl ulaşacağınızı planlayın'
            : 'Plan how to reach your revenue goals'}
        </p>
      </div>

      {/* Hızlı Senaryolar */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          {lang === 'tr' ? '"Ya..." Senaryoları' : '"What if..." Scenarios'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((scenario) => {
            const clients = Math.ceil(scenario.target / calculator.avgRetainer);
            return (
              <button
                key={scenario.target}
                onClick={() => applyScenario(scenario.target)}
                className="bg-gray-900/50 hover:bg-gray-700/50 border border-gray-600 rounded-lg p-4 transition text-left space-y-2"
              >
                <div className="text-xl font-bold text-blue-400">{scenario.label}</div>
                <div className="text-sm text-gray-400">
                  ≈ {clients} {lang === 'tr' ? 'müşteri' : 'clients'} × ${calculator.avgRetainer}
                </div>
                <div className="text-xs text-gray-500">
                  {lang === 'tr' ? 'Hesapla için tıkla' : 'Click to calculate'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gelir Hesaplayıcı */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">
          {lang === 'tr' ? 'Gelir Hesaplayıcı' : 'Revenue Calculator'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hedef MRR */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {lang === 'tr' ? 'Hedef Aylık Gelir (MRR)' : 'Target Monthly Revenue (MRR)'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                value={calculator.targetMrr}
                onChange={(e) => setCalculator({ ...calculator, targetMrr: Number(e.target.value) })}
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Ortalama Retainer */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {lang === 'tr' ? 'Müşteri Başına Ortalama Gelir' : 'Average Revenue per Client'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                value={calculator.avgRetainer}
                onChange={(e) => setCalculator({ ...calculator, avgRetainer: Number(e.target.value) })}
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Kapanma Oranı */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {lang === 'tr' ? 'Kapanma Oranı (%)' : 'Close Rate (%)'}
            </label>
            <input
              type="number"
              value={calculator.closeRate}
              onChange={(e) => setCalculator({ ...calculator, closeRate: Number(e.target.value) })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>

          {/* Rezervasyon Oranı */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {lang === 'tr' ? 'Rezervasyon Oranı (%)' : 'Booking Rate (%)'}
            </label>
            <input
              type="number"
              value={calculator.bookingRate}
              onChange={(e) => setCalculator({ ...calculator, bookingRate: Number(e.target.value) })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Sonuçlar */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-700/50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {lang === 'tr' ? '📊 Sonuçlar' : '📊 Results'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-400">
                {lang === 'tr' ? 'Gerekli Müşteri' : 'Clients Needed'}
              </div>
              <div className="text-2xl font-bold text-green-400">{clientsNeeded}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-gray-400">
                {lang === 'tr' ? 'Gerekli Teklif' : 'Proposals Needed'}
              </div>
              <div className="text-2xl font-bold text-blue-400">{proposalsNeeded}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-gray-400">
                {lang === 'tr' ? 'Gerekli Lead' : 'Leads Needed'}
              </div>
              <div className="text-2xl font-bold text-yellow-400">{leadsNeeded}</div>
            </div>
          </div>

          <div className="text-sm text-gray-400 pt-4 border-t border-gray-700">
            {lang === 'tr' ? (
              <>
                <strong className="text-white">Plan:</strong> Ayda {leadsNeeded} lead bulun → {proposalsNeeded} teklif gönderin → {clientsNeeded} müşteri kazanın → <strong className="text-green-400">${calculator.targetMrr.toLocaleString()}/ay</strong> gelir elde edin
              </>
            ) : (
              <>
                <strong className="text-white">Plan:</strong> Find {leadsNeeded} leads/month → Send {proposalsNeeded} proposals → Win {clientsNeeded} clients → Earn <strong className="text-green-400">${calculator.targetMrr.toLocaleString()}/month</strong>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pasif Gelir Fikirleri */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {lang === 'tr' ? '💤 Pasif Gelir Fikirleri' : '💤 Passive Income Ideas'}
          </h2>
          <button
            onClick={() => onNavigate('PASSIVE_HUB')}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {lang === 'tr' ? 'Tümünü Gör →' : 'View All →'}
          </button>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="font-medium text-white mb-1">
              {lang === 'tr' ? 'Workflow Şablonları Sat' : 'Sell Workflow Templates'}
            </div>
            <div className="text-sm text-gray-400">
              {lang === 'tr'
                ? 'En çok kullandığınız workflow\'ları paketleyip satın'
                : 'Package and sell your most-used workflows'}
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="font-medium text-white mb-1">
              {lang === 'tr' ? 'AI Ajans Kurulum Kursu' : 'AI Agency Setup Course'}
            </div>
            <div className="text-sm text-gray-400">
              {lang === 'tr'
                ? 'Bilginizi bir kursa dönüştürün'
                : 'Turn your knowledge into a course'}
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="font-medium text-white mb-1">
              {lang === 'tr' ? 'Otomasyon Audit Servisi' : 'Automation Audit Service'}
            </div>
            <div className="text-sm text-gray-400">
              {lang === 'tr'
                ? 'Şirketlerin otomasyon potansiyelini analiz edin'
                : 'Analyze companies\' automation potential'}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={() => onNavigate('JOURNEY')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition"
        >
          <span>🧭</span>
          <span>{lang === 'tr' ? 'Gelir Yolculuğuna Git' : 'Go to Revenue Journey'}</span>
        </button>
      </div>
    </div>
  );
}
