import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type LeadPredictionFeatures = {
  source: string;
  has_company: number;           // 1 si l'entreprise est renseignée, 0 sinon
  owner_role: string;
  interaction_count: number;
  call_count: number;
  email_interaction_count: number;
  meeting_interaction_count: number;
  task_count: number;
  completed_task_count: number;
  open_task_count: number;
  overdue_task_count: number;
  call_task_count: number;
  email_task_count: number;
  meeting_task_count: number;
  todo_task_count: number;
  avg_task_progress: number;
  days_since_last_activity: number;
  days_since_creation: number;
};

export type LeadPredictionResponse = {
  probability: number;
  score: number;
  label: 'Élevée' | 'Moyenne' | 'Faible';
  threshold: number;
};

type CacheEntry = {
  data: LeadPredictionResponse;
  expiresAt: number;
};

const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

@Injectable()
export class IaService {
  private readonly baseUrl = process.env.IA_API_URL ?? 'http://localhost:8000';
  private readonly apiSecret = process.env.IA_API_SECRET ?? '';
  private readonly cache = new Map<string, CacheEntry>();

  /** Returns a cached prediction if still valid, otherwise undefined. */
  getCached(leadId: string): LeadPredictionResponse | undefined {
    const entry = this.cache.get(leadId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(leadId);
      return undefined;
    }
    return entry.data;
  }

  /** Invalidates the cached prediction for a lead (call when lead data changes). */
  invalidate(leadId: string): void {
    this.cache.delete(leadId);
  }

  async predictLead(
    features: LeadPredictionFeatures,
    leadId?: string,
  ): Promise<LeadPredictionResponse> {
    // Return cached result if available (Problem 11)
    if (leadId) {
      const cached = this.getCached(leadId);
      if (cached) return cached;
    }

    let response: Response;

    try {
      // Timeout on fetch (Problem 3)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiSecret ? { 'X-IA-API-Key': this.apiSecret } : {}),
        },
        body: JSON.stringify(features),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException('IA service timeout');
      }
      throw new ServiceUnavailableException('IA service unavailable');
    }

    const text = await response.text();

    if (!response.ok) {
      let detail = 'IA prediction failed';
      try {
        const payload = JSON.parse(text) as { detail?: string };
        if (payload?.detail) detail = payload.detail;
      } catch {
        if (text) detail = text;
      }
      throw new BadGatewayException(detail);
    }

    const payload = JSON.parse(text) as Partial<LeadPredictionResponse>;
    if (
      typeof payload.probability !== 'number' ||
      typeof payload.score !== 'number' ||
      typeof payload.label !== 'string' ||
      typeof payload.threshold !== 'number'
    ) {
      throw new BadGatewayException('Invalid IA prediction response');
    }

    const result: LeadPredictionResponse = {
      probability: payload.probability,
      score: payload.score,
      label: payload.label as LeadPredictionResponse['label'],
      threshold: payload.threshold,
    };

    // Store in cache (Problem 11)
    if (leadId) {
      this.cache.set(leadId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return result;
  }
}
