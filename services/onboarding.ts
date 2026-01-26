export type UIMode = 'simple' | 'advanced';

export type Language = 'tr' | 'en';

export type AgencyType = 'automation' | 'marketing_ops' | 'ecom_ops';
export type DemoScenario = 'lead_crm_proposal_invoice_report' | 'marketing_lead_crm' | 'accounting_invoice_report';

export type OnboardingState = {
  setupCompleted: boolean;
  uiMode: UIMode;
  language: Language;
  agencyType: AgencyType;
  demoScenario: DemoScenario;
};

const STORAGE_KEY = 'agencyos:onboarding';

function inferDefaultLanguage(): Language {
  if (typeof navigator === 'undefined') return 'tr';
  const raw = String(navigator.language || '').toLowerCase();
  return raw.startsWith('tr') ? 'tr' : 'en';
}

const DEFAULT_STATE: OnboardingState = {
  setupCompleted: false,
  uiMode: 'simple',
  language: inferDefaultLanguage(),
  agencyType: 'automation',
  demoScenario: 'lead_crm_proposal_invoice_report',
};

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function readOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  const parsed = safeParse(raw) ?? {};
  const uiMode = parsed.uiMode === 'advanced' ? 'advanced' : 'simple';
  const setupCompleted = Boolean(parsed.setupCompleted);
  const language: Language = parsed.language === 'en' ? 'en' : 'tr';
  const agencyType: AgencyType =
    parsed.agencyType === 'marketing_ops' ? 'marketing_ops' : parsed.agencyType === 'ecom_ops' ? 'ecom_ops' : 'automation';
  const demoScenario: DemoScenario =
    parsed.demoScenario === 'marketing_lead_crm'
      ? 'marketing_lead_crm'
      : parsed.demoScenario === 'accounting_invoice_report'
        ? 'accounting_invoice_report'
        : 'lead_crm_proposal_invoice_report';

  return { setupCompleted, uiMode, language, agencyType, demoScenario };
}

export function writeOnboardingState(patch: Partial<OnboardingState>): OnboardingState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE, ...patch } as OnboardingState;
  const current = readOnboardingState();
  const next: OnboardingState = {
    ...current,
    ...patch,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function markSetupCompleted(): OnboardingState {
  return writeOnboardingState({ setupCompleted: true });
}

export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
