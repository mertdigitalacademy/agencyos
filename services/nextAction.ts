import type { Project, ProjectTab } from '../types';

export type IntegrationStatus = { connected: boolean; baseUrl: string; reason?: string };

export type IntegrationStatuses = Partial<{
  n8n: IntegrationStatus;
  suitecrm: IntegrationStatus;
  invoiceshelf: IntegrationStatus;
  documenso: IntegrationStatus;
  infisical: IntegrationStatus;
}>;

export type NextActionTarget = 'settings' | 'catalog' | 'project' | 'council';

export type NextAction = {
  title: { en: string; tr: string };
  description: { en: string; tr: string };
  cta: { en: string; tr: string };
  target: NextActionTarget;
  projectTab?: ProjectTab;
};

function hasDoc(project: Project, type: Project['documents'][number]['type'], status?: Project['documents'][number]['status']): boolean {
  return project.documents.some((d) => d.type === type && (!status || d.status === status));
}

function anyWorkflow(project: Project, status: string): boolean {
  return project.activeWorkflows.some((w) => w.deployment?.status === status);
}

export function getNextAction(params: { project: Project; integrations?: IntegrationStatuses }): NextAction {
  const { project, integrations } = params;

  const n8nConnected = Boolean(integrations?.n8n?.connected);
  const documensoConnected = Boolean(integrations?.documenso?.connected);
  const invoiceshelfConnected = Boolean(integrations?.invoiceshelf?.connected);

  if (project.activeWorkflows.length === 0) {
    return {
      title: { en: 'Find workflows', tr: 'Workflow bul' },
      description: { en: 'Search the workflow library and install a starter pack.', tr: 'Workflow kütüphanesinde ara ve bir başlangıç paketi kur.' },
      cta: { en: 'Open Catalog', tr: 'Kataloğu Aç' },
      target: 'catalog',
    };
  }

  if (!n8nConnected && anyWorkflow(project, 'Staged')) {
    return {
      title: { en: 'Connect n8n', tr: 'n8n bağla' },
      description: { en: 'Add `N8N_API_KEY` to enable one-click import/activate + monitoring.', tr: '`N8N_API_KEY` ekleyerek tek tık import/activate + izlemeyi aç.' },
      cta: { en: 'Open Settings', tr: 'Ayarları Aç' },
      target: 'settings',
    };
  }

  if (anyWorkflow(project, 'Imported') && !anyWorkflow(project, 'Activated')) {
    return {
      title: { en: 'Activate workflows', tr: 'Workflow’ları aktifleştir' },
      description: { en: 'Workflows are imported; activate them to go live.', tr: 'Workflow’lar import edildi; canlıya almak için aktifleştir.' },
      cta: { en: 'Open Project', tr: 'Projeyi Aç' },
      target: 'project',
      projectTab: 'Workflows',
    };
  }

  if (!hasDoc(project, 'Contract')) {
    if (!documensoConnected) {
      return {
        title: { en: 'Connect Documenso', tr: 'Documenso bağla' },
        description: { en: 'Add `DOCUMENSO_API_TOKEN` to send contracts for e-signature.', tr: 'E-imza için sözleşme göndermek üzere `DOCUMENSO_API_TOKEN` ekle.' },
        cta: { en: 'Open Settings', tr: 'Ayarları Aç' },
        target: 'settings',
      };
    }
    return {
      title: { en: 'Send contract', tr: 'Sözleşme gönder' },
      description: { en: 'Generate + send a contract to the client (Documenso).', tr: 'Sözleşme oluştur + müşteriye gönder (Documenso).' },
      cta: { en: 'Open Project', tr: 'Projeyi Aç' },
      target: 'project',
      projectTab: 'Documents',
    };
  }

  if (hasDoc(project, 'Contract', 'Sent') && !hasDoc(project, 'Contract', 'Signed')) {
    return {
      title: { en: 'Sync contract status', tr: 'Sözleşme durumunu senkronla' },
      description: { en: 'Check if the contract is signed and update status.', tr: 'Sözleşme imzalandı mı kontrol et ve durumu güncelle.' },
      cta: { en: 'Open Project', tr: 'Projeyi Aç' },
      target: 'project',
      projectTab: 'Documents',
    };
  }

  if (!hasDoc(project, 'Invoice')) {
    if (!invoiceshelfConnected) {
      return {
        title: { en: 'Connect InvoiceShelf', tr: 'InvoiceShelf bağla' },
        description: { en: 'Login to InvoiceShelf to create invoices from pricing.', tr: 'Fiyatlamadan fatura oluşturmak için InvoiceShelf’e giriş yap.' },
        cta: { en: 'Open Settings', tr: 'Ayarları Aç' },
        target: 'settings',
      };
    }
    return {
      title: { en: 'Create invoice', tr: 'Fatura oluştur' },
      description: { en: 'Create an invoice (manual amount or Board pricing).', tr: 'Fatura oluştur (manuel tutar veya Yönetim Kurulu fiyatlaması).' },
      cta: { en: 'Open Project', tr: 'Projeyi Aç' },
      target: 'project',
      projectTab: 'Financials',
    };
  }

  if (hasDoc(project, 'Invoice', 'Draft') || hasDoc(project, 'Invoice', 'Sent')) {
    return {
      title: { en: 'Sync invoice status', tr: 'Fatura durumunu senkronla' },
      description: { en: 'Update invoice status (sent/paid).', tr: 'Fatura durumunu güncelle (gönderildi/ödendi).' },
      cta: { en: 'Open Project', tr: 'Projeyi Aç' },
      target: 'project',
      projectTab: 'Financials',
    };
  }

  return {
    title: { en: 'Run governance', tr: 'Governance çalıştır' },
    description: { en: 'Use the Board to validate scope, risks, and pricing.', tr: 'Kapsam, risk ve fiyatı doğrulamak için Yönetim Kurulu’nu kullan.' },
    cta: { en: 'Open Board', tr: 'Yönetim Kurulu Aç' },
    target: 'council',
  };
}
