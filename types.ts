
export interface Workflow {
  id: string;
  name: string;
  description: string;
  tags: string[];
  jsonUrl: string;
  complexity: 'Low' | 'Medium' | 'High';
  credentials: string[];
}

export interface ProjectBrief {
  id: string;
  clientName: string;
  description: string;
  goals: string[];
  tools: string[];
  budget: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface CRMActivity {
  id: string;
  type: 'Call' | 'Meeting' | 'Email' | 'Note' | 'Status Change';
  subject: string;
  status: 'Completed' | 'Scheduled' | 'Pending' | 'Draft';
  timestamp: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: 'Proposal' | 'SOW' | 'Invoice' | 'Report';
  status: 'Draft' | 'Sent' | 'Signed' | 'Paid';
  content?: string;
  url: string;
  amount?: number;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  workflowName: string;
  status: 'Success' | 'Error';
  errorDetails?: string;
  timestamp: string;
  duration: string;
}

export interface ProjectIncident {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Investigating' | 'Resolved';
  rootCause?: string;
  resolutionPlan?: string;
  timestamp: string;
}

export interface OperatorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCall?: {
    name: string;
    status: 'pending' | 'success' | 'error';
    result?: string;
    executionProgress?: number;
  };
}

export interface ProjectFinancials {
  revenue: number;
  expenses: number;
  hoursSaved: number;
  costPerExecution: number;
}

export interface ProjectGovernance {
  certified: boolean;
  lastScore: number;
  verdict: 'Approved' | 'Risk' | 'None';
}

export interface Project {
  id: string;
  brief: ProjectBrief;
  status: 'Intake' | 'Proposal' | 'Developing' | 'Testing' | 'Live';
  activeWorkflows: Workflow[];
  documents: ProjectDocument[];
  executionLogs: ExecutionLog[];
  incidents: ProjectIncident[];
  operatorChat: OperatorMessage[];
  crmActivities: CRMActivity[];
  financials: ProjectFinancials;
  governance: ProjectGovernance;
  totalBilled: number;
  createdAt: string;
}

export interface Lead {
  id: string;
  source: string;
  clientName: string;
  brief: string;
  timestamp: string;
  aiScore: number;
  qualificationReason?: string;
}

export interface CouncilOpinion {
  persona: string;
  role: string;
  opinion: string;
  score: number;
}

export type CouncilGate = 'Strategic' | 'Risk' | 'Launch' | 'Post-Mortem';

export interface CouncilSession {
  id: string;
  projectId: string;
  gateType: CouncilGate;
  topic: string;
  opinions: CouncilOpinion[];
  synthesis: string;
  decision: 'Approved' | 'Rejected' | 'Needs Revision';
}

export interface AgencySecret {
  id: string;
  key: string;
  value: string;
  environment: 'Development' | 'Staging' | 'Production';
  lastUpdated: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  type: 'AI' | 'Human';
  avatar: string;
  specialization: string[];
  status: 'Online' | 'Busy' | 'Offline';
}

export interface SystemEvent {
  id: string;
  type: 'Info' | 'Warning' | 'Alert' | 'Success';
  message: string;
  timestamp: string;
  projectRef?: string;
}

export enum WorkspaceType {
  AGENCY = 'AGENCY',
  CLIENT = 'CLIENT'
}

export enum View {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  INTAKE = 'INTAKE',
  PROJECT_DETAIL = 'PROJECT_DETAIL',
  COUNCIL = 'COUNCIL',
  CATALOG = 'CATALOG',
  DOCUMENTS = 'DOCUMENTS',
  SETTINGS = 'SETTINGS'
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}
