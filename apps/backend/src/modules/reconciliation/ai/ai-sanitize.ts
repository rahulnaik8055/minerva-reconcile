import { z } from 'zod';

export const AI_RECOMMENDED_ACTIONS = [
  'approve',
  'reject',
  'override',
  'investigate_further',
  'escalate_to_provider',
] as const;
export type AiRecommendedAction = (typeof AI_RECOMMENDED_ACTIONS)[number];

export const AI_MIN_CONFIDENCE = 0.6;
export const AI_MAX_CONFIDENCE = 0.89;

export const aiExplanationModelSchema = z.object({
  recommendation: z.string().trim().min(1).max(2000),
  confidence: z.coerce.number().min(0).max(1),
  reasoning: z.string().trim().min(1).max(4000),
  supportingEvidence: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  contradictingEvidence: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  recommendedAction: z.preprocess(
    (val) => (Array.isArray(val) ? val[0] : val),
    z.enum(AI_RECOMMENDED_ACTIONS),
  ),
});

export interface AllowedAiEvidenceRef {
  ref: string;
  label: string;
}

export interface AiEvidenceRefDto {
  ref: string;
  label: string;
}

export interface AiExplanationDto {
  recommendation: string;
  confidence: number;
  reasoning: string;
  supportingEvidence: AiEvidenceRefDto[];
  contradictingEvidence: AiEvidenceRefDto[];
  recommendedAction: AiRecommendedAction;
}

export interface AiStatusDto {
  available: boolean;
  model: string | null;
}

export function sanitizeAiExplanation(
  raw: unknown,
  allowedRefs: AllowedAiEvidenceRef[],
): AiExplanationDto {
  const parsed = aiExplanationModelSchema.parse(raw);

  const byRef = new Map(allowedRefs.map((entry) => [entry.ref, entry]));

  const resolveRefs = (refs: string[]): AiEvidenceRefDto[] => {
    const seen = new Set<string>();
    const resolved: AiEvidenceRefDto[] = [];

    for (const ref of refs) {
      if (seen.has(ref)) {
        continue;
      }

      const hit = byRef.get(ref);

      if (hit !== undefined) {
        seen.add(ref);
        resolved.push({ ref: hit.ref, label: hit.label });
      }
    }

    return resolved;
  };

  return {
    recommendation: parsed.recommendation,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    supportingEvidence: resolveRefs(parsed.supportingEvidence),
    contradictingEvidence: resolveRefs(parsed.contradictingEvidence),
    recommendedAction: parsed.recommendedAction,
  };
}

export function buildAiSystemPrompt(): string {
  return [
    'You are an assistant inside a financial reconciliation product. You advise a human reviewer.',
    '',
    'HARD CONSTRAINTS:',
    '- You are advisory only. You CANNOT and MUST NOT create, modify, approve, reject, override or delete any financial record, proposal, evidence item, or audit entry.',
    '- Your output is a suggestion for human review only. A human decides every outcome.',
    '- Reference evidence ONLY by the exact ref strings supplied in the input (e.g. "bank", "candidate:0", "evidence:2"). Never invent refs, records, amounts, dates, or sources.',
    '- If the supplied data is insufficient to reach a view, say so plainly in your reasoning and use "investigate_further" as the recommendedAction.',
    '- Never state or imply that any action has been executed. You have no side effects.',
    '',
    'Respond with a single JSON object and nothing else, matching exactly this shape:',
    '{',
    '  "recommendation": string, // one-paragraph verdict for the reviewer',
    '  "confidence": number,     // 0..1, your confidence in the recommendation',
    '  "reasoning": string,      // grounded strictly in the supplied fields; cite refs inline like [candidate:0]',
    '  "supportingEvidence": string[],       // refs that support the recommendation',
    '  "contradictingEvidence": string[],    // refs that cut against it',
    `  "recommendedAction": "${AI_RECOMMENDED_ACTIONS.join('" | "')}"  // exactly one string from this list, NOT an array`,
    '}',
  ].join('\n');
}
