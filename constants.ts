
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
  { id: View.DASHBOARD, label: 'Dashboard', icon: '📊' },
  { id: View.INTAKE, label: 'New Project', icon: '➕' },
  { id: View.CATALOG, label: 'Workflow Catalog', icon: '📂' },
  { id: View.COUNCIL, label: 'Council Room', icon: '🏛️' },
  { id: View.DOCUMENTS, label: 'Documents', icon: '📄' },
  { id: View.SETTINGS, label: 'Agency Settings', icon: '⚙️' }
];
