import {
  Complaint,
  ComplaintCategory,
  Priority,
  Bureau,
  Region,
  CaseStatus,
} from '../types';
import {
  redactPII,
  computeSemanticSimilarity,
  parseNaturalLanguageSearchFallback,
  suggestClassificationFallback,
} from '../engine/overlap';

/**
 * Typed API Service layer (src/services/api.ts)
 * Wraps server-side Gemini AI endpoints with automatic graceful fallback to the deterministic rule-based engine.
 */

const similarityCache = new Map<string, {
  sameUnderlyingIssue: boolean;
  similarity: number;
  explanation: string;
  usedAI: boolean;
}>();

export async function checkAIAvailability(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.available);
  } catch {
    return false;
  }
}

export async function evaluateSemanticSimilarityAPI(
  descriptionA: string,
  descriptionB: string
): Promise<{
  sameUnderlyingIssue: boolean;
  similarity: number;
  explanation: string;
  usedAI: boolean;
}> {
  const key = [descriptionA.slice(0, 80), descriptionB.slice(0, 80)].sort().join('||');
  if (similarityCache.has(key)) {
    return similarityCache.get(key)!;
  }

  const redactedA = redactPII(descriptionA);
  const redactedB = redactPII(descriptionB);

  try {
    const res = await fetch('/api/ai/similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptionA: redactedA, descriptionB: redactedB }),
    });
    const json = await res.json();
    if (!json.fallback && json.data) {
      const result = {
        sameUnderlyingIssue: Boolean(json.data.sameUnderlyingIssue),
        similarity: Number(json.data.similarity ?? 0.5),
        explanation: String(json.data.explanation ?? 'Evaluated via Gemini semantic analysis.'),
        usedAI: true,
      };
      similarityCache.set(key, result);
      return result;
    }
  } catch {
    // Fallback below
  }

  const offline = computeSemanticSimilarity(redactedA, redactedB);
  const displaySim = offline.similarity >= 0.25 ? Math.min(0.95, Number((0.55 + offline.similarity * 0.4).toFixed(2))) : offline.similarity;
  const fallbackResult = {
    sameUnderlyingIssue: offline.similarity >= 0.25,
    similarity: displaySim,
    explanation: offline.sharedConcepts.length
      ? `Rule-based TF-IDF + Domain Synonym Engine matched shared concepts: ${offline.sharedConcepts.join(', ')}.`
      : 'Rule-based TF-IDF cosine similarity found low lexical/domain overlap between descriptions.',
    usedAI: false,
  };
  similarityCache.set(key, fallbackResult);
  return fallbackResult;
}

export async function generateCaseSummaryAPI(
  complaint: Complaint,
  timelineRemarks: string[]
): Promise<{
  bullets: string[];
  recommendedNextStep: string;
  usedAI: boolean;
}> {
  const redactedDesc = redactPII(complaint.description);
  const timelineSummary = timelineRemarks.map((r, i) => `${i + 1}. ${redactPII(r)}`).join('\n');

  try {
    const res = await fetch('/api/ai/case-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: complaint.category,
        status: complaint.status,
        currentBureau: complaint.currentBureau,
        redactedDescription: redactedDesc,
        timelineSummary,
      }),
    });
    const json = await res.json();
    if (!json.fallback && json.data?.bullets?.length) {
      return {
        bullets: json.data.bullets.slice(0, 5),
        recommendedNextStep: json.data.recommendedNextStep,
        usedAI: true,
      };
    }
  } catch {
    // Fallback below
  }

  return {
    bullets: [
      `Case ${complaint.caseId} filed via ${complaint.source} on ${complaint.receivedDate} under "${complaint.category}" (${complaint.priority} priority).`,
      `Currently assigned to ${complaint.currentBureau} (Officer: ${complaint.assignedOfficer}) with status "${complaint.status}".`,
      `Core issue: ${redactedDesc.slice(0, 140)}${redactedDesc.length > 140 ? '...' : ''}`,
      `Latest recorded action (${complaint.lastActionDate}): ${complaint.lastAction}.`,
      complaint.overlapGroupId
        ? `Flagged in active cross-bureau overlap group (${complaint.overlapGroupId}); requires inter-bureau coordination before final order.`
        : `SLA target window is ${complaint.slaDays} days (Expected disposal: ${complaint.expectedDisposalDate}).`,
    ],
    recommendedNextStep: complaint.overlapGroupId
      ? `Coordinate with sister bureaus in Overlap Group ${complaint.overlapGroupId} and execute: ${complaint.nextActionRequired}.`
      : complaint.nextActionRequired,
    usedAI: false,
  };
}

export async function parseNaturalLanguageSearchAPI(query: string): Promise<{
  region?: Region;
  bureau?: Bureau;
  category?: ComplaintCategory;
  status?: CaseStatus;
  priority?: Priority;
  minAgeDays?: number;
  overdueOnly?: boolean;
  overlapOnly?: boolean;
  searchTerm?: string;
  explanation: string;
  usedAI: boolean;
}> {
  try {
    const res = await fetch('/api/ai/nl-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: redactPII(query) }),
    });
    const json = await res.json();
    if (!json.fallback && json.data) {
      return {
        ...json.data,
        explanation: json.data.explanation || 'Structured filters extracted via Gemini AI',
        usedAI: true,
      };
    }
  } catch {
    // Fallback below
  }

  const fb = parseNaturalLanguageSearchFallback(query);
  return {
    ...fb,
    usedAI: false,
  };
}

export async function suggestComplaintClassificationAPI(description: string): Promise<{
  category: ComplaintCategory;
  priority: Priority;
  suggestedBureau: Bureau;
  reasoning: string;
  usedAI: boolean;
}> {
  const redactedDescription = redactPII(description);
  try {
    const res = await fetch('/api/ai/suggest-classification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redactedDescription }),
    });
    const json = await res.json();
    if (!json.fallback && json.data?.category) {
      return {
        category: json.data.category as ComplaintCategory,
        priority: json.data.priority as Priority,
        suggestedBureau: json.data.suggestedBureau as Bureau,
        reasoning: json.data.reasoning,
        usedAI: true,
      };
    }
  } catch {
    // Fallback below
  }

  const fb = suggestClassificationFallback(redactedDescription);
  return {
    ...fb,
    usedAI: false,
  };
}

export async function generateExecutiveReportSummaryAPI(
  reportTitle: string,
  metricsSummary: string
): Promise<{ summary: string; usedAI: boolean }> {
  try {
    const res = await fetch('/api/ai/executive-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportTitle, metricsSummary }),
    });
    const json = await res.json();
    if (!json.fallback && json.data?.summary) {
      return { summary: json.data.summary, usedAI: true };
    }
  } catch {
    // Fallback below
  }

  return {
    summary: `Executive Briefing (${reportTitle}): Analysis of current AICTE IICMD records reflects ${metricsSummary}. Bureaus are advised to prioritize beyond-SLA grievances and resolve flagged cross-bureau overlaps through designated Lead Bureaus to prevent conflicting regulatory directives.`,
    usedAI: false,
  };
}
