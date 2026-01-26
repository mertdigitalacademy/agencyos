import { useState } from 'react';
import type { Project } from '../types';
import { seedDemoProjects, getRuntimeSettings, updateRuntimeSettings } from '../services/api';
import { writeOnboardingState, type UIMode } from '../services/onboarding';
import { useI18n } from '../services/i18n';

interface SetupWizardSimpleProps {
  onFinish: () => void;
  onProjectsUpdated: (projects: Project[]) => void;
  onOpenProject: (projectId: string, tab?: string) => void;
  onUIModeChange: (mode: UIMode) => void;
}

export default function SetupWizardSimple({
  onFinish,
  onProjectsUpdated,
  onOpenProject,
  onUIModeChange
}: SetupWizardSimpleProps) {
  const { lang, setLanguage } = useI18n();
  const [step, setStep] = useState(1);
  const [geminiKey, setGeminiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [uiMode, setUiMode] = useState<UIMode>('simple');

  async function handleFinish() {
    setLoading(true);

    try {
      // Gemini key varsa kaydet
      if (geminiKey.trim()) {
        const settings = await getRuntimeSettings();
        await updateRuntimeSettings({
          ...settings,
          secrets: {
            ...settings.secrets,
            GEMINI_API_KEY: geminiKey
          }
        });
      }

      // UI mode kaydet
      writeOnboardingState({ uiMode, language: lang });
      onUIModeChange(uiMode);

      // Demo projeler yükle
      const projects = await seedDemoProjects();
      onProjectsUpdated(projects);

      // Bitir
      onFinish();
    } catch (error) {
      console.error('Setup failed:', error);
    } finally {
      setLoading(false);
    }
  }

  function skipSetup() {
    writeOnboardingState({ uiMode: 'simple', language: lang });
    onUIModeChange('simple');
    onFinish();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo & Başlık */}
        <div className="text-center space-y-4">
          <div className="text-6xl">🏛️</div>
          <h1 className="text-4xl font-bold text-white">
            {lang === 'tr' ? 'AgencyOS Kurulum' : 'AgencyOS Setup'}
          </h1>
          <p className="text-gray-400 text-lg">
            {lang === 'tr'
              ? 'AI destekli ajansınızı 2 adımda kurun'
              : 'Set up your AI-powered agency in 2 steps'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s <= step ? 'w-16 bg-blue-500' : 'w-8 bg-gray-700'
              }`}
            />
          ))}
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 space-y-6">
          {/* Step 1: Dil & Mod */}
          {step === 1 && (
            <>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">
                  {lang === 'tr' ? 'Tercihleriniz' : 'Your Preferences'}
                </h2>
                <p className="text-gray-400">
                  {lang === 'tr'
                    ? 'Dil ve kullanıcı arayüzü modunu seçin'
                    : 'Choose language and interface mode'}
                </p>
              </div>

              {/* Dil Seçimi */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {lang === 'tr' ? 'Dil / Language' : 'Language / Dil'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`p-4 rounded-lg border-2 transition ${
                      lang === 'en'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-2">🇺🇸</div>
                    <div className="font-medium text-white">English</div>
                  </button>

                  <button
                    onClick={() => setLanguage('tr')}
                    className={`p-4 rounded-lg border-2 transition ${
                      lang === 'tr'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-2">🇹🇷</div>
                    <div className="font-medium text-white">Türkçe</div>
                  </button>
                </div>
              </div>

              {/* UI Modu */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {lang === 'tr' ? 'Arayüz Modu' : 'Interface Mode'}
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setUiMode('simple')}
                    className={`w-full p-4 rounded-lg border-2 transition text-left ${
                      uiMode === 'simple'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-white mb-1">
                      ✨ {lang === 'tr' ? 'Basit Mod (Önerilen)' : 'Simple Mode (Recommended)'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {lang === 'tr'
                        ? '5 menü, sadece temel özellikler, teknik detay yok'
                        : '5 menu items, core features only, no technical details'}
                    </div>
                  </button>

                  <button
                    onClick={() => setUiMode('advanced')}
                    className={`w-full p-4 rounded-lg border-2 transition text-left ${
                      uiMode === 'advanced'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-white mb-1">
                      🚀 {lang === 'tr' ? 'Gelişmiş Mod' : 'Advanced Mode'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {lang === 'tr'
                        ? 'Tüm menü, gelişmiş özellikler, teknik kontrol'
                        : 'All menus, advanced features, technical control'}
                    </div>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-lg transition"
              >
                {lang === 'tr' ? 'Devam Et →' : 'Continue →'}
              </button>
            </>
          )}

          {/* Step 2: AI Key (Opsiyonel) */}
          {step === 2 && (
            <>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">
                  {lang === 'tr' ? 'AI Anahtarı (Opsiyonel)' : 'AI Key (Optional)'}
                </h2>
                <p className="text-gray-400">
                  {lang === 'tr'
                    ? 'Gemini API anahtarınızı ekleyin veya demo ile devam edin'
                    : 'Add your Gemini API key or continue with demo'}
                </p>
              </div>

              {/* Gemini Key */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  🤖 Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={
                    lang === 'tr'
                      ? 'Opsiyonel - AI özellikleri için gerekli'
                      : 'Optional - needed for AI features'
                  }
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500">
                  {lang === 'tr' ? (
                    <>
                      Anahtarınız yok mu?{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Buradan ücretsiz alın
                      </a>
                    </>
                  ) : (
                    <>
                      Don't have a key?{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Get it free here
                      </a>
                    </>
                  )}
                </p>
              </div>

              {/* Demo Seçeneği */}
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-yellow-300 mb-1">
                      {lang === 'tr' ? 'Demo Modu' : 'Demo Mode'}
                    </div>
                    <div className="text-yellow-700">
                      {lang === 'tr'
                        ? 'Anahtar eklemeden demo projelerle sistemi keşfedebilirsiniz. İstediğiniz zaman ayarlardan ekleyebilirsiniz.'
                        : 'You can explore with demo projects without adding a key. Add it anytime from settings.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition"
                >
                  ← {lang === 'tr' ? 'Geri' : 'Back'}
                </button>

                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>{lang === 'tr' ? 'Kuruluyor...' : 'Setting up...'}</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>
                        {lang === 'tr' ? 'Kurulumu Tamamla' : 'Complete Setup'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={skipSetup}
                className="w-full text-sm text-gray-500 hover:text-gray-400 py-2"
              >
                {lang === 'tr'
                  ? 'Şimdi atla, demo ile devam et →'
                  : 'Skip for now, continue with demo →'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          {lang === 'tr'
            ? 'Tüm verileriniz cihazınızda güvende'
            : 'All your data stays secure on your device'}
        </div>
      </div>
    </div>
  );
}
