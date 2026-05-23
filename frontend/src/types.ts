export type UserRole = 'ADMIN' | 'SALES' | 'MARKETING' | 'EXECUTIVE';

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export type InteractionType = 'EMAIL' | 'CALL' | 'MEETING' | 'NOTE';

export type TaskType =
  | 'SALES'
  | 'MARKETING'
  | 'SUPPORT'
  | 'CALL'
  | 'MEETING'
  | 'EMAIL_FOLLOW_UP';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  createdAt?: string;
};

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage: LeadStage;
  score: number | null;
  conversionProbability: number | null;
  notes: string | null;
  ownerId: string;
  isAnonymized?: boolean;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type Interaction = {
  id: string;
  type: InteractionType;
  content: string;
  leadId: string;
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  lead?: Lead;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  leadId: string | null;
  assignedToId: string | null;
  createdById: string;
  overdueNotifiedAt: string | null;
  reminderNotifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    ownerId: string;
  } | null;
  assignedTo?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
  } | null;
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
  } | null;
  attachments?: TaskAttachment[];
};

export type TaskAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
  };
};

export type AuditLogEntry = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
  createdAt: string;
  user?: AuthUser;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
};
