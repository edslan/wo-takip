
export interface WorkOrder {
  "Work order code": string;
  "Work order name": string;
  "Asset Name"?: string;
  "WO Activity type Activity type code"?: string;
  "Status code": string;
  "Work order start date/time"?: number; 
  "Work order end date/time"?: number; 
  "Comments: Name without formatting"?: string;
  "Priority"?: string;
  "Asset out of order?"?: string;
  closeReason?: string;
  // Cost Analysis Fields (Optional - calculated or from excel)
  "Total Cost"?: number;
  "Labor Cost"?: number;
  "Material Cost"?: number;
  [key: string]: any;
}

export interface KpiConfig {
  id: string;
  visible: boolean;
  order: number;
}

export interface FilterState {
  searchTerm: string;
  startDate: string;
  endDate: string;
  activityTypes: Set<string>;
  statuses: Set<string>;
  monthKey: string | null;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export type AlertType = WorkOrder;

export interface SmartAlertRule {
  id: string;
  name: string;
  targetStatus: string;
  daysThreshold: number;
}

export type ToDoStatus = 'Bekliyor' | 'Devam Ediyor' | 'Tamamlandı';

export interface ToDoNote {
  id: string;
  text: string;
  author: string;
  date: number;
}

export interface ToDoItem {
  id: string;
  title: string;
  priority: 'Yüksek' | 'Orta' | 'Düşük';
  comments: string;
  status: ToDoStatus;
  createdAt: number;
  dueDate?: string; // ISO Date String
  createdBy: string;
  assignedTo?: string;
  notes?: ToDoNote[];
  pinned?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: 'yellow' | 'blue' | 'green' | 'rose' | 'purple' | 'slate';
  date: number;
  createdBy?: string;
  pinned?: boolean;
}

export interface ShiftReport {
  id: string;
  rawText: string;
  dateStr: string; // YYYY-MM-DD
  shiftName: string;
  personnel: string[];
  completedJobs: string[];
  issues: string[];
  pending: string[];
  aiSummary: string;
  createdAt: number;
  createdBy: string;
}

export interface CrossCheckResult {
    score: number;
    summary: string;
    missingInReport: string[];
    missingInDb: string[];
    perfectMatches: string[];
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
}

export interface AssetStats {
  totalWOs: number;
  downtimeEvents: number;
  lastMaintenanceDate?: number;
}

export interface AssetItem {
  id: string;
  name: string;
  createdAt: number;
  description?: string;
  stats?: AssetStats; // Persistent historical stats
}

export interface PredictiveInsight {
  assetName: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  probability: number; // 0-100
  reason: string;
  suggestedAction: string;
  suggestedDate: string; // YYYY-MM-DD
  source: 'ShiftReport' | 'WorkOrderHistory' | 'Hybrid';
}

export interface PredictiveAnalysisSession {
    id: string;
    date: number;
    insights: PredictiveInsight[];
    createdBy: string;
}

export interface RootCauseMap {
    centralProblem: string;
    branches: {
        category: string; // e.g. Machine, Man, Method
        factors: string[];
    }[];
}

export interface AiAnalysisResult {
    problemSummary: string;
    rootCause: string;
    solutionSteps: string[];
    preventionTip: string;
    rootCauseMap?: RootCauseMap; // New Field
}

export interface SolutionEntry {
    id: string; // This will map to workOrderCode for 1:1 relationship
    workOrderCode: string;
    assetName: string;
    analysis: AiAnalysisResult;
    createdAt: number;
    createdBy: string;
    lastUpdatedAt?: number;
}

export interface SystemUsageStats {
  date: string;
  aiRequests: number;
  dbReads: number;
  dbWrites: number;
  estimatedCost: number;
}

export interface QuotaConfig {
  aiDailyLimit: number;
  dbReadLimit: number;
  dbWriteLimit: number;
}

export type ViewMode = 'dashboard' | 'charts' | 'calendar' | 'todo' | 'notes' | 'shifts' | 'assets' | 'predictive' | 'downtime' | 'solutions';
