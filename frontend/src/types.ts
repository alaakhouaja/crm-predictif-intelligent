export type UserRole = 'ADMIN' | 'SALES' | 'MARKETING' | 'EXECUTIVE';

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export type InteractionType = 'EMAIL' | 'CALL' | 'MEETING' | 'NOTE';

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

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
};
