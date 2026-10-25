export type Region =
  | 'Northern'
  | 'Southern'
  | 'Eastern'
  | 'Western'
  | 'Central'
  | 'South-Western'
  | 'North-Western';

export type Bureau =
  | 'RB'
  | 'PGRC'
  | 'AB'
  | 'Legal Cell'
  | 'Vigilance Cell'
  | 'Academic Bureau'
  | 'Northern RO'
  | 'Southern RO'
  | 'Eastern RO'
  | 'Western RO'
  | 'Central RO'
  | 'South-Western RO'
  | 'North-Western RO';

export type InstitutionType = 'University' | 'Autonomous' | 'Affiliated' | 'Standalone';

export type ApprovalStatus = 'Approved' | 'Under Review' | 'Withdrawn';

export interface Institution {
  aicteId: string; // e.g., "1-9876543210"
  name: string;
  aliases: string[];
  type: InstitutionType;
  programs: string[];
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  region: Region;
  contact: string;
  headOfInstitution: string;
  approvalStatus: ApprovalStatus;
  riskScore: number; // 0-100, computed
}

export type ComplaintSource =
  | 'Student'
  | 'Faculty'
  | 'Parent'
  | 'Public'
  | 'RTI'
  | 'CPGRAMS'
  | 'Email'
  | 'Letter'
  | 'Portal';

export type ComplaintCategory =
  | 'Fake approval/Affiliation issue'
  | 'Fee/Refund'
  | 'Faculty salary/qualification'
  | 'Infrastructure/Lab deficiency'
  | 'Admission irregularity'
  | 'Ragging/Harassment'
  | 'Mandatory disclosure violation'
  | 'Closure/Withdrawal'
  | 'Fake degree'
  | 'Other';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type CaseStatus =
  | 'Received'
  | 'Under Process'
  | 'Pending Information'
  | 'Transferred'
  | 'Escalated'
  | 'Disposed'
  | 'Reopened';

export interface Complaint {
  caseId: string; // "AICTE/{BUREAU}/{YYYY}/{00000}"
  institutionId: string; // matches Institution.aicteId
  submittedInstitutionName?: string; // May be an alias or old name as filed
  receivedDate: string; // ISO date string
  source: ComplaintSource;
  complainantName: string;
  complainantContact: string;
  category: ComplaintCategory;
  description: string;
  priority: Priority;
  status: CaseStatus;
  currentBureau: Bureau;
  originBureau: Bureau;
  assignedOfficer: string;
  lastAction: string;
  lastActionDate: string;
  nextActionRequired: string;
  expectedDisposalDate: string;
  slaDays: number;
  linkedCaseIds: string[];
  overlapGroupId?: string;
  attachments: { name: string; size: string; uploadedAt: string; type: string }[];
  disposedDate?: string;
}

export type ActionType =
  | 'Received'
  | 'Assigned'
  | 'Inspection ordered'
  | 'Show-cause notice'
  | 'Reply received'
  | 'Transferred'
  | 'Escalated'
  | 'Linked'
  | 'Remark'
  | 'Disposed'
  | 'Reopened';

export interface ActionHistory {
  id: string;
  caseId: string;
  timestamp: string;
  actionType: ActionType;
  fromBureau: Bureau;
  toBureau?: Bureau;
  officer: string;
  remarks: string;
  documents: string[];
}

export type OverlapStatus =
  | 'Open'
  | 'Coordination Initiated'
  | 'Resolved – Merged'
  | 'Resolved – Lead Bureau Assigned'
  | 'Dismissed as false positive';

export interface CoordinationNote {
  id: string;
  author: string;
  bureau: Bureau;
  timestamp: string;
  message: string;
}

export interface OverlapGroup {
  id: string;
  institutionId: string;
  caseIds: string[];
  bureausInvolved: Bureau[];
  overlapScore: number; // 0-100
  confidenceLevel: 'High (Auto-Resolved)' | 'Medium (Verify Match)' | 'Low';
  severity: 'Critical' | 'High' | 'Moderate';
  reasons: string[];
  status: OverlapStatus;
  leadBureau?: Bureau;
  coordinationNotes: CoordinationNote[];
  detectedAt: string;
  resolvedBy?: string;
  dismissReason?: string;
  lastActivityTimestamp: string;
  scenarioTag?: string;
}

export type AlertType =
  | 'Overlap'
  | 'Pending reminder'
  | 'SLA breach'
  | 'Escalation'
  | 'Approaching SLA';

export interface Alert {
  id: string;
  type: AlertType;
  caseId?: string;
  institutionId?: string;
  overlapGroupId?: string;
  targetBureau: Bureau | 'ALL';
  region?: Region;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  message: string;
  createdAt: string;
  read: boolean;
  snoozedUntil?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  bureau: Bureau | 'HQ';
  action: string;
  targetId: string;
  details: string;
}

export type RoleType =
  | 'SUPER_ADMIN'
  | 'SENIOR_MANAGEMENT'
  | 'BUREAU_OFFICER'
  | 'REGIONAL_OFFICER';

export interface UserProfile {
  id: string;
  name: string;
  designation: string;
  roleType: RoleType;
  bureau: Bureau | 'HQ';
  region?: Region;
  canEditAll: boolean;
  canEditOwnBureau: boolean;
  canResolveOverlaps: boolean;
  canViewUnmaskedPII: boolean;
  canAccessAdmin: boolean;
}

export type SLAConfig = Record<ComplaintCategory, number>;

export interface NotificationSettings {
  inApp: boolean;
  emailGateway: boolean;
  smsGateway: boolean;
  cpgramsWebhook: boolean;
  approachingSlaThresholds: number[]; // e.g., [7, 3, 1]
}

export interface GlobalFilters {
  region: Region | 'ALL';
  bureau: Bureau | 'ALL';
  dateRange: 'ALL' | '30D' | '90D' | '180D' | '365D';
}

export interface CaseFilters {
  search: string;
  region: Region | 'ALL';
  bureau: Bureau | 'ALL';
  category: ComplaintCategory | 'ALL';
  status: CaseStatus | 'ALL';
  priority: Priority | 'ALL';
  slaFilter: 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'WITHIN_SLA';
  overlapOnly: boolean;
  institutionId?: string;
  minAgeDays?: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: CaseFilters;
}
