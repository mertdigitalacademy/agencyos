
import { Workflow, View } from './types';

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Lead to CRM Sync',
    description: 'Automatically sync incoming leads from Typeform to SuiteCRM with email notifications.',
    tags: ['CRM', 'Leads', 'Typeform'],
    jsonUrl: 'https://raw.githubusercontent.com/Zie619/n8n-workflows/main/typeform-to-crm.json',
    complexity: 'Low',
    credentials: ['Typeform API', 'SuiteCRM Auth']
  },
  {
    id: 'wf-2',
    name: 'Invoice Automation',
    description: 'Generate and send invoices via InvoiceShelf when a deal is closed in the CRM.',
    tags: ['Finance', 'Invoicing', 'Automation'],
    jsonUrl: 'https://raw.githubusercontent.com/Zie619/n8n-workflows/main/invoice-automation.json',
    complexity: 'Medium',
    credentials: ['InvoiceShelf API', 'CRM Webhook']
  },
  {
    id: 'wf-3',
    name: 'AI Proposal Drafter',
    description: 'Draft custom proposals based on CRM project briefs using Gemini 1.5 Pro.',
    tags: ['AI', 'Sales', 'Documents'],
    jsonUrl: 'https://raw.githubusercontent.com/Zie619/n8n-workflows/main/ai-proposals.json',
    complexity: 'High',
    credentials: ['Gemini API', 'Documenso Auth']
  },
  {
    id: 'wf-4',
    name: 'Social Media Auto-Poster',
    description: 'Schedule and post content to Twitter, LinkedIn, and Instagram from a Google Sheet.',
    tags: ['Marketing', 'Social Media'],
    jsonUrl: 'https://raw.githubusercontent.com/Zie619/n8n-workflows/main/social-poster.json',
    complexity: 'Medium',
    credentials: ['Google Sheets API', 'Buffer/Social API']
  }
];

export const NAV_ITEMS = [
  { id: View.SETUP, label: { en: 'Setup Wizard', tr: 'Kurulum Sihirbazı' }, icon: '✨' },
  { id: View.GUIDED_JOURNEY, label: { en: 'Guided Journey', tr: 'Rehberli Yolculuk' }, icon: '🗺️' },
  { id: View.AGENCY_BUILDER, label: { en: 'AI Agency Builder', tr: 'AI Ajans Oluşturucu' }, icon: '🎯' },
  { id: View.JOURNEY, label: { en: 'Revenue Journey', tr: 'Gelir Yolculuğu' }, icon: '🧭' },
  { id: View.ASSISTANT, label: { en: 'Assistant', tr: 'Asistan' }, icon: '🤖' },
  { id: View.PASSIVE_HUB, label: { en: 'Passive Income Hub', tr: 'Pasif Gelir Hub' }, icon: '💤' },
  { id: View.DASHBOARD, label: { en: 'Dashboard', tr: 'Panel' }, icon: '📊' },
  { id: View.PROPOSALS, label: { en: 'Proposals', tr: 'Teklifler' }, icon: '📝' },
  { id: View.SALES_PIPELINE, label: { en: 'Sales Pipeline', tr: 'Satış Hunisi' }, icon: '📊' },
  { id: View.INTAKE, label: { en: 'New Project', tr: 'Yeni Proje' }, icon: '➕' },
  { id: View.CATALOG, label: { en: 'Workflow Catalog', tr: 'Workflow Kataloğu' }, icon: '📂' },
  { id: View.BOARD_STUDIO, label: { en: 'Management Board', tr: 'Yönetim Kurulu' }, icon: '🏛️' },
  { id: View.DOCUMENTS, label: { en: 'Documents', tr: 'Dokümanlar' }, icon: '📄' },
  { id: View.SETTINGS, label: { en: 'Agency Settings', tr: 'Ayarlar' }, icon: '⚙️' }
];

// Basit mod için sadeleştirilmiş navigasyon (6 öğe - Agency Builder eklendi)
export const NAV_ITEMS_SIMPLE = [
  { id: View.HOME, label: { en: 'Home', tr: 'Ana Sayfa' }, icon: '🏠' },
  { id: View.AGENCY_BUILDER, label: { en: 'Build Agency', tr: 'Ajans Kur' }, icon: '🎯' },
  { id: View.ASSISTANT, label: { en: 'AI Coach', tr: 'AI Koç' }, icon: '🤖' },
  { id: View.PROJECTS, label: { en: 'Projects', tr: 'Projeler' }, icon: '📁' },
  { id: View.MONEY, label: { en: 'Money', tr: 'Gelir' }, icon: '💰' },
  { id: View.SETUP, label: { en: 'Setup', tr: 'Kurulum' }, icon: '⚡' }
];
