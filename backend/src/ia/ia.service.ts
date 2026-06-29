import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export type LeadPredictionFeatures = {
  // Identité du lead
  firstName: string;
  lastName: string;
  company: string | null;
  source: string | null;
  stage: string;
  notes: string | null;
  // Interactions
  interactionCount: number;
  callCount: number;
  emailCount: number;
  meetingCount: number;
  // Tâches
  taskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  // Temporel
  daysSinceCreation: number;
  daysSinceLastActivity: number;
};

export type SuggestedTask = {
  title: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'TODO';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueInDays: number;
  description: string;
};

export type LeadPredictionResponse = {
  score: number;
  probability: number;
  label: 'Élevée' | 'Moyenne' | 'Faible';
  justification: string;
  nextAction: string;
  suggestedTasks: SuggestedTask[];
};

// ─── Cache entry ───────────────────────────────────────────────────────────────

interface CacheEntry {
  result: LeadPredictionResponse;
  expiresAt: number;
}

const TIMEOUT_MS = 45_000;
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';

  /** In-memory cache: key = leadId:dataVersion (changes when lead data changes) */
  private readonly cache = new Map<string, CacheEntry>();

  // ─── Public API ─────────────────────────────────────────────────────────────

  async predictLead(
    features: LeadPredictionFeatures,
    cacheKey?: string,
  ): Promise<LeadPredictionResponse> {
    // Return cached result if data hasn't changed
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() < hit.expiresAt) {
        this.logger.debug(`[IA] Cache hit for key ${cacheKey}`);
        return hit.result;
      }
    }

    const result = await this.callOllama(features);

    if (cacheKey) {
      this.cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      // Prevent unbounded growth — keep at most 500 entries
      if (this.cache.size > 500) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
    }

    return result;
  }

  /** Invalidate cache for a specific lead (call when lead is updated) */
  invalidateCache(leadId: string) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${leadId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  // ─── Ollama call ────────────────────────────────────────────────────────────

  private async callOllama(features: LeadPredictionFeatures): Promise<LeadPredictionResponse> {
    const prompt = this.buildPrompt(features);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? 'llama3.1',
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1,   // lower = faster + more deterministic
            num_predict: 400,   // cap output tokens — our JSON fits in ~250
            num_ctx: 2048,      // smaller context window = less VRAM, faster
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error('Ollama timeout after 45s');
        throw new ServiceUnavailableException('Service IA timeout (Ollama)');
      }
      this.logger.error(`Ollama unreachable: ${String(err)}`);
      throw new ServiceUnavailableException('Service IA indisponible (Ollama)');
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Ollama error ${response.status}: ${body}`);
      throw new ServiceUnavailableException(`Ollama error ${response.status}`);
    }

    const raw = (await response.json()) as { response?: string };
    const jsonText = raw.response ?? '';

    let parsed: {
      score?: unknown;
      justification?: unknown;
      nextAction?: unknown;
      suggestedTasks?: unknown;
    };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      this.logger.error(`Failed to parse Ollama JSON: ${jsonText}`);
      throw new ServiceUnavailableException('Réponse IA invalide');
    }

    return this.normalize(parsed);
  }

  // ─── Normalization ──────────────────────────────────────────────────────────

  private normalize(parsed: {
    score?: unknown;
    justification?: unknown;
    nextAction?: unknown;
    suggestedTasks?: unknown;
  }): LeadPredictionResponse {
    const rawScore =
      typeof parsed.score === 'number'
        ? parsed.score
        : Number(parsed.score ?? 50);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const probability = +(score / 100).toFixed(2);
    const label: LeadPredictionResponse['label'] =
      score >= 70 ? 'Élevée' : score >= 40 ? 'Moyenne' : 'Faible';

    const justification =
      typeof parsed.justification === 'string' && parsed.justification.trim()
        ? parsed.justification.trim()
        : 'Analyse basée sur les données disponibles.';

    const nextAction =
      typeof parsed.nextAction === 'string' && parsed.nextAction.trim()
        ? parsed.nextAction.trim()
        : 'Continuer le suivi du lead.';

    const validTypes = new Set(['CALL', 'EMAIL', 'MEETING', 'TODO']);
    const validPriorities = new Set(['LOW', 'MEDIUM', 'HIGH']);

    const suggestedTasks: SuggestedTask[] = Array.isArray(parsed.suggestedTasks)
      ? (parsed.suggestedTasks as unknown[])
          .filter(
            (t): t is Record<string, unknown> =>
              t !== null && typeof t === 'object',
          )
          .slice(0, 3)
          .map((t) => ({
            title:
              typeof t.title === 'string' ? t.title.trim() : 'Tâche suggérée',
            type: validTypes.has(String(t.type))
              ? (String(t.type) as SuggestedTask['type'])
              : 'TODO',
            priority: validPriorities.has(String(t.priority))
              ? (String(t.priority) as SuggestedTask['priority'])
              : 'MEDIUM',
            dueInDays:
              typeof t.dueInDays === 'number' && t.dueInDays > 0
                ? Math.round(t.dueInDays)
                : 3,
            description:
              typeof t.description === 'string' ? t.description.trim() : '',
          }))
      : [];

    return { score, probability, label, justification, nextAction, suggestedTasks };
  }

  // ─── Prompt ─────────────────────────────────────────────────────────────────

  private buildPrompt(f: LeadPredictionFeatures): string {
    const stageFr: Record<string, string> = {
      Nouveau: 'Nouveau',
      Contacte: 'Contacté',
      Qualifie: 'Qualifié',
      Proposition: 'Proposition',
      Gagne: 'Gagné',
      Perdu: 'Perdu',
    };

    return `Expert CRM. Analyse ce lead et réponds UNIQUEMENT en JSON valide.

LEAD: ${f.firstName} ${f.lastName} | ${f.company ?? '—'} | Source: ${f.source ?? '—'} | Étape: ${stageFr[f.stage] ?? f.stage}
Interactions: ${f.interactionCount} (appels:${f.callCount} emails:${f.emailCount} réunions:${f.meetingCount})
Tâches: ${f.taskCount} total / ${f.completedTaskCount} faites / ${f.overdueTaskCount} en retard
Ancienneté: ${f.daysSinceCreation}j | Dernière activité: il y a ${f.daysSinceLastActivity}j
${f.notes ? `Notes: "${f.notes.slice(0, 200)}"` : ''}

Réponds avec exactement ce JSON:
{"score":<0-100>,"justification":"<2 phrases en français>","nextAction":"<1 action prioritaire>","suggestedTasks":[{"title":"<titre>","type":"<CALL|EMAIL|MEETING|TODO>","priority":"<HIGH|MEDIUM|LOW>","dueInDays":<1-30>,"description":"<description>"}]}`;
  }
}
