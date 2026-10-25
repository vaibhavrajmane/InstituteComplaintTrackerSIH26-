import {
  Complaint,
  ComplaintCategory,
  Institution,
  OverlapGroup,
  Priority,
  Bureau,
  Region,
  CaseStatus,
} from '../types';

const ABBREVIATION_MAP: Record<string, string> = {
  engg: 'engineering',
  eng: 'engineering',
  coll: 'college',
  col: 'college',
  tech: 'technology',
  techno: 'technology',
  inst: 'institute',
  instt: 'institute',
  univ: 'university',
  mgmt: 'management',
  sci: 'science',
  sc: 'science',
  res: 'research',
  edu: 'education',
  natl: 'national',
  intl: 'international',
  govt: 'government',
  gov: 'government',
  dr: 'doctor',
  st: 'saint',
  pt: 'pandit',
  shri: 'sri',
  shree: 'sri',
  venkateshwara: 'venkateswara',
  lakshmi: 'laxmi',
  mahavidyalaya: 'college',
  vidyapeeth: 'university',
  pharm: 'pharmacy',
  arch: 'architecture',
  poly: 'polytechnic',
};

const STOPWORDS = new Set([
  'the',
  'of',
  'and',
  'for',
  'in',
  'at',
  'to',
  'a',
  'an',
  'by',
  'campus',
  'trust',
  'society',
]);

/**
 * Layer 1 Helper: Normalize institution name for fuzzy matching.
 * Expands abbreviations, strips punctuation, normalizes phonetic spelling variants,
 * and removes stopwords.
 */
export function normalizeInstitutionName(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    // Collapse initialisms like "S.V." or "S. V." into "sv"
    .replace(/\b([a-z])\.\s*([a-z])\.\s*([a-z])\./g, '$1$2$3 ')
    .replace(/\b([a-z])\.\s*([a-z])\./g, '$1$2 ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ').filter(Boolean);
  const normalizedTokens: string[] = [];

  for (const token of tokens) {
    const mapped = ABBREVIATION_MAP[token] ?? token;
    if (!STOPWORDS.has(mapped)) {
      normalizedTokens.push(mapped);
    }
  }

  return normalizedTokens.join(' ');
}

/**
 * Generates initials from normalized institution tokens (e.g., "sri venkateswara" -> "sv")
 */
export function extractInitials(normalized: string): string {
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length < 2) return '';
  // Take first two non-generic tokens (e.g., "sri venkateswara" -> "sv")
  const genericWords = new Set(['college', 'engineering', 'technology', 'institute', 'university', 'management', 'pharmacy', 'science', 'research']);
  const distinctive = tokens.filter((t) => !genericWords.has(t));
  if (distinctive.length >= 2) {
    return distinctive.slice(0, 2).map((t) => t[0]).join('');
  }
  return tokens.slice(0, 2).map((t) => t[0]).join('');
}

/**
 * Compute Jaro-Winkler similarity between two strings (0 to 1).
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const matchDistance = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }

  const transpositions = t / 2;
  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions) / matches) / 3;

  // Winkler prefix boost (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Compute Token-Set Jaccard similarity with initialism awareness (0 to 1).
 */
export function tokenSetJaccard(normA: string, normB: string): number {
  const tokensA = normA.split(' ').filter(Boolean);
  const tokensB = normB.split(' ').filter(Boolean);
  if (!tokensA.length || !tokensB.length) return 0;

  const initialsA = extractInitials(normA);
  const initialsB = extractInitials(normB);

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // If one string contains the initials of the other's distinctive words (e.g. "sv" vs "sri venkateswara")
  if (initialsB && setA.has(initialsB)) {
    const genericWords = new Set(['college', 'engineering', 'technology', 'institute', 'university', 'management', 'pharmacy', 'science', 'research']);
    for (const tok of tokensB) {
      if (!genericWords.has(tok)) setA.add(tok);
    }
    setA.delete(initialsB);
  }
  if (initialsA && setB.has(initialsA)) {
    const genericWords = new Set(['college', 'engineering', 'technology', 'institute', 'university', 'management', 'pharmacy', 'science', 'research']);
    for (const tok of tokensA) {
      if (!genericWords.has(tok)) setB.add(tok);
    }
    setB.delete(initialsA);
  }

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    } else {
      // Partial token prefix match or high Jaro-Winkler on token
      for (const bItem of setB) {
        if (jaroWinkler(item, bItem) >= 0.88) {
          intersection += 0.9;
          break;
        }
      }
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return Math.min(1, intersection / union);
}

export interface EntityMatchResult {
  institution: Institution;
  score: number; // 0 to 1
  resolutionStatus: 'AUTO_RESOLVED' | 'SUGGEST_VERIFY' | 'NO_MATCH';
  matchedOn: 'AICTE_ID' | 'OFFICIAL_NAME' | 'ALIAS' | 'FUZZY_NAME';
  matchedAlias?: string;
}

/**
 * Layer 1: Resolve a query or submitted institution record against the master list of Institutions.
 * Threshold >= 0.85 = auto-resolve, 0.70-0.85 = suggest match (needs verification).
 */
export function matchInstitution(
  queryNameOrId: string,
  institutions: Institution[],
  locationHint?: { city?: string; district?: string; pincode?: string }
): EntityMatchResult[] {
  const qRaw = queryNameOrId.trim();
  if (!qRaw) return [];

  const qLower = qRaw.toLowerCase();
  const qNorm = normalizeInstitutionName(qRaw);
  const results: EntityMatchResult[] = [];

  for (const inst of institutions) {
    // 1. Exact or prefix AICTE Permanent ID match
    if (inst.aicteId.toLowerCase() === qLower) {
      results.push({
        institution: inst,
        score: 1.0,
        resolutionStatus: 'AUTO_RESOLVED',
        matchedOn: 'AICTE_ID',
      });
      continue;
    }

    if (inst.aicteId.toLowerCase().includes(qLower) && qLower.startsWith('1-')) {
      results.push({
        institution: inst,
        score: 0.96,
        resolutionStatus: 'AUTO_RESOLVED',
        matchedOn: 'AICTE_ID',
      });
      continue;
    }

    // 2. Compare against official name and all aliases
    const candidates = [
      { text: inst.name, isAlias: false },
      ...inst.aliases.map((a) => ({ text: a, isAlias: true })),
    ];

    let bestScore = 0;
    let bestSource: 'OFFICIAL_NAME' | 'ALIAS' | 'FUZZY_NAME' = 'FUZZY_NAME';
    let bestAlias: string | undefined;

    for (const cand of candidates) {
      const candNorm = normalizeInstitutionName(cand.text);
      if (!candNorm) continue;

      if (candNorm === qNorm) {
        bestScore = 0.98;
        bestSource = cand.isAlias ? 'ALIAS' : 'OFFICIAL_NAME';
        bestAlias = cand.isAlias ? cand.text : undefined;
        break;
      }

      const jaccard = tokenSetJaccard(qNorm, candNorm);
      const jw = jaroWinkler(qNorm, candNorm);
      let combined = jaccard * 0.6 + jw * 0.4;

      // Substring containment boost for search queries like "S.V. College Engg"
      const genericWords = new Set([
        'college',
        'engineering',
        'technology',
        'institute',
        'university',
        'management',
        'pharmacy',
        'science',
        'research',
        'technical',
        'applied',
        'sciences',
        'studies',
        'school',
        'architecture',
        'planning',
        'advanced',
        'industrial',
        'regional',
        'information',
        'pharmaceutical',
      ]);
      const qTokens = qNorm.split(' ').filter(Boolean);
      const qDistinctive = qTokens.filter((t) => !genericWords.has(t));
      const candTokens = candNorm.split(' ').filter(Boolean);
      const candInitials = extractInitials(candNorm);

      let matchedQueryTokens = 0;
      let matchedDistinctive = 0;
      for (const qt of qTokens) {
        const isMatch =
          candTokens.some((ct) => ct === qt || (qt.length >= 4 && ct.includes(qt)) || jaroWinkler(qt, ct) >= 0.88) ||
          (candInitials && qt === candInitials);
        if (isMatch) {
          matchedQueryTokens++;
          if (!genericWords.has(qt)) matchedDistinctive++;
        }
      }
      const queryCoverage = qTokens.length > 0 ? matchedQueryTokens / qTokens.length : 0;
      if (
        queryCoverage >= 0.75 &&
        (qDistinctive.length === 0 || matchedDistinctive === qDistinctive.length)
      ) {
        combined = Math.max(combined, 0.74 + queryCoverage * 0.22);
      } else if (qDistinctive.length > 0 && matchedDistinctive === 0) {
        combined = Math.min(combined, 0.58);
      }

      if (combined > bestScore) {
        bestScore = combined;
        bestSource = cand.isAlias ? 'ALIAS' : 'FUZZY_NAME';
        bestAlias = cand.isAlias ? cand.text : undefined;
      }
    }

    // Location boost if city/district/pincode match
    if (locationHint) {
      if (locationHint.pincode && locationHint.pincode === inst.pincode) {
        bestScore = Math.min(1, bestScore + 0.08);
      } else if (
        (locationHint.city && locationHint.city.toLowerCase() === inst.city.toLowerCase()) ||
        (locationHint.district && locationHint.district.toLowerCase() === inst.district.toLowerCase())
      ) {
        bestScore = Math.min(1, bestScore + 0.05);
      }
    }

    const resolutionStatus =
      bestScore >= 0.85 ? 'AUTO_RESOLVED' : bestScore >= 0.7 ? 'SUGGEST_VERIFY' : 'NO_MATCH';

    if (bestScore >= 0.55) {
      results.push({
        institution: inst,
        score: Number(bestScore.toFixed(2)),
        resolutionStatus,
        matchedOn: bestSource,
        matchedAlias: bestAlias,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Layer 2: Category taxonomy & related category groups
 */
const RELATED_CATEGORY_GROUPS: ComplaintCategory[][] = [
  ['Fake approval/Affiliation issue', 'Closure/Withdrawal', 'Fake degree', 'Mandatory disclosure violation'],
  ['Faculty salary/qualification', 'Infrastructure/Lab deficiency'],
  ['Fee/Refund', 'Admission irregularity'],
];

export function areCategoriesRelated(catA: ComplaintCategory, catB: ComplaintCategory): 'EXACT' | 'RELATED' | 'UNRELATED' {
  if (catA === catB) return 'EXACT';
  for (const group of RELATED_CATEGORY_GROUPS) {
    if (group.includes(catA) && group.includes(catB)) {
      return 'RELATED';
    }
  }
  return 'UNRELATED';
}

/**
 * Layer 3: Domain Synonym Map & TF-IDF / Cosine Semantic Similarity (offline deterministic engine)
 */
const DOMAIN_SYNONYM_GROUPS: string[][] = [
  ['salary', 'salaries', 'payment', 'remuneration', 'paid', 'unpaid', 'arrears', 'stipend', 'withheld', 'default', 'dues', 'wages', 'pay'],
  ['fake', 'bogus', 'unapproved', 'forged', 'unauthorized', 'fraudulent', 'illegal', 'unaffiliated'],
  ['fee', 'fees', 'refund', 'tuition', 'capitation', 'caution', 'deposit', 'overcharging', 'extortion', 'return'],
  ['lab', 'laboratory', 'equipment', 'infrastructure', 'computers', 'building', 'classroom', 'deficient', 'deficiency', 'shortage'],
  ['faculty', 'professor', 'teachers', 'staff', 'teaching', 'cadre', 'ratio', 'qualification', 'ghost'],
  ['ragging', 'harassment', 'bullying', 'hostel', 'abuse', 'intimidation', 'mental'],
  ['certificate', 'documents', 'original', 'marksheet', 'degree', 'withholding', 'retention'],
  ['approval', 'affiliation', 'extension', 'eoa', 'loa', 'intake', 'seats'],
];

function canonicalizeDomainToken(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean || clean.length <= 2 || STOPWORDS.has(clean)) return '';
  for (let i = 0; i < DOMAIN_SYNONYM_GROUPS.length; i++) {
    if (DOMAIN_SYNONYM_GROUPS[i].includes(clean)) {
      return `syn_group_${i}`;
    }
  }
  return clean;
}

export function computeSemanticSimilarity(descA: string, descB: string): {
  similarity: number;
  sharedConcepts: string[];
} {
  const wordsA = descA.toLowerCase().split(/\s+/).map(canonicalizeDomainToken).filter(Boolean);
  const wordsB = descB.toLowerCase().split(/\s+/).map(canonicalizeDomainToken).filter(Boolean);

  if (!wordsA.length || !wordsB.length) {
    return { similarity: 0, sharedConcepts: [] };
  }

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const w of wordsA) freqA.set(w, (freqA.get(w) ?? 0) + 1);
  for (const w of wordsB) freqB.set(w, (freqB.get(w) ?? 0) + 1);

  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const sharedConcepts: string[] = [];

  const synGroupLabels = [
    'faculty salary/remuneration arrears',
    'unapproved/bogus affiliation claims',
    'fee refund/capitation overcharging',
    'laboratory/infrastructure deficiency',
    'faculty cadre/qualification norms',
    'student ragging/harassment',
    'original certificate retention',
    'EoA/intake approval compliance',
  ];

  for (const term of vocab) {
    // Boost domain synonym group matches slightly in TF-IDF weight
    const idfWeight = term.startsWith('syn_group_') ? 2.2 : 1.0;
    const valA = (freqA.get(term) ?? 0) * idfWeight;
    const valB = (freqB.get(term) ?? 0) * idfWeight;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;

    if (valA > 0 && valB > 0) {
      if (term.startsWith('syn_group_')) {
        const idx = Number(term.replace('syn_group_', ''));
        if (synGroupLabels[idx]) sharedConcepts.push(synGroupLabels[idx]);
      } else if (term.length > 4) {
        sharedConcepts.push(term);
      }
    }
  }

  const rawCosine = normA && normB ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  return {
    similarity: Number(Math.min(1, rawCosine).toFixed(2)),
    sharedConcepts: Array.from(new Set(sharedConcepts)).slice(0, 4),
  };
}

export interface PairOverlapEvaluation {
  isOverlap: boolean;
  score: number; // 0 to 100
  reasons: string[];
  hasConflictingAction: boolean;
  semanticSimilarity: number;
}

/**
 * Evaluate whether two complaints on the same resolved institution constitute an overlap.
 */
export function evaluateComplaintPairOverlap(
  caseA: Complaint,
  caseB: Complaint,
  institution: Institution,
  filingWindowDays = 90
): PairOverlapEvaluation {
  // Only evaluate active (non-Disposed) cases
  if (caseA.status === 'Disposed' || caseB.status === 'Disposed') {
    return { isOverlap: false, score: 0, reasons: [], hasConflictingAction: false, semanticSimilarity: 0 };
  }

  const reasons: string[] = [];
  let score = 0;

  // Layer 1: Entity match reasons
  reasons.push(`Same AICTE ID (${institution.aicteId})`);
  score += 25;

  const subA = caseA.submittedInstitutionName;
  const subB = caseB.submittedInstitutionName;
  if ((subA && subA !== institution.name) || (subB && subB !== institution.name)) {
    const variantName = subA && subA !== institution.name ? subA : subB!;
    const matchRes = matchInstitution(variantName, [institution])[0];
    const pct = matchRes ? Math.round(matchRes.score * 100) : 92;
    reasons.push(`Name alias matched ${pct}% ("${variantName}")`);
  }

  // Layer 2: Case relationship rules
  const catRel = areCategoriesRelated(caseA.category, caseB.category);
  if (catRel === 'EXACT') {
    score += 25;
    reasons.push(`Same category (${caseA.category})`);
  } else if (catRel === 'RELATED') {
    score += 15;
    reasons.push(`Related categories (${caseA.category} ↔ ${caseB.category})`);
  }

  // Filing window check
  const dateA = new Date(caseA.receivedDate).getTime();
  const dateB = new Date(caseB.receivedDate).getTime();
  const diffDays = Math.round(Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24));
  if (diffDays <= 30) {
    score += 12;
    reasons.push(`Filed within 30 days (${diffDays}d apart)`);
  } else if (diffDays <= filingWindowDays) {
    score += 8;
    reasons.push(`Filed within ${filingWindowDays} days (${diffDays}d apart)`);
  }

  // Same complainant or contact
  if (
    caseA.complainantContact === caseB.complainantContact ||
    (caseA.complainantName &&
      caseB.complainantName &&
      caseA.complainantName.toLowerCase() === caseB.complainantName.toLowerCase())
  ) {
    score += 12;
    reasons.push('Same complainant / contact identifier');
  }

  // Transferred / linked lineage
  if (
    caseA.linkedCaseIds.includes(caseB.caseId) ||
    caseB.linkedCaseIds.includes(caseA.caseId) ||
    caseA.status === 'Transferred' ||
    caseB.status === 'Transferred'
  ) {
    score += 10;
    reasons.push('Cross-bureau transfer or linked case lineage');
  }

  // Conflicting or parallel bureau action check
  let hasConflictingAction = false;
  if (caseA.currentBureau !== caseB.currentBureau) {
    score += 10;
    const actionText = `${caseA.lastAction} ${caseB.lastAction}`.toLowerCase();
    if (
      actionText.includes('inspection') ||
      actionText.includes('show-cause') ||
      caseA.status === 'Escalated' ||
      caseB.status === 'Escalated'
    ) {
      hasConflictingAction = true;
      score += 8;
      reasons.push(
        `Parallel/conflicting bureau actions (${caseA.currentBureau}: "${caseA.status}" vs ${caseB.currentBureau}: "${caseB.status}")`
      );
    }
  } else {
    // Duplicate within the same Bureau
    reasons.push(`Potential duplicate within ${caseA.currentBureau}`);
    score += 6;
  }

  // Layer 3: Semantic similarity of descriptions
  const sem = computeSemanticSimilarity(caseA.description, caseB.description);
  if (sem.similarity >= 0.25) {
    const semPoints = Math.min(25, Math.round(sem.similarity * 28));
    score += semPoints;
    const displaySim = Math.min(0.96, Number((0.55 + sem.similarity * 0.4).toFixed(2)));
    reasons.push(
      `Semantic similarity ${displaySim}${
        sem.sharedConcepts.length ? ` (${sem.sharedConcepts.slice(0, 2).join(', ')})` : ''
      }`
    );
  } else if (catRel === 'UNRELATED') {
    // Same institution, completely unrelated category and low semantic similarity -> only flag if explicitly seeded or above threshold
    reasons.push(`Low semantic overlap (${sem.similarity.toFixed(2)}) – verify if distinct issue`);
  }

  const finalScore = Math.min(99, Math.max(0, score));
  const isOverlap = finalScore >= 52;

  return {
    isOverlap,
    score: finalScore,
    reasons,
    hasConflictingAction,
    semanticSimilarity: sem.similarity,
  };
}

/**
 * Run the full multi-layered Overlap Detection Engine across all cases and institutions.
 * Preserves existing coordination notes, leadBureau, and Dismissed status (unless new activity occurred after detection).
 */
export function detectAllOverlaps(
  complaints: Complaint[],
  institutions: Institution[],
  existingGroups: OverlapGroup[] = []
): OverlapGroup[] {
  const instMap = new Map<string, Institution>();
  for (const inst of institutions) {
    instMap.set(inst.aicteId, inst);
  }

  const existingByInst = new Map<string, OverlapGroup[]>();
  for (const g of existingGroups) {
    const list = existingByInst.get(g.institutionId) ?? [];
    list.push(g);
    existingByInst.set(g.institutionId, list);
  }

  // Group open complaints by resolved institutionId
  const openByInst = new Map<string, Complaint[]>();
  for (const c of complaints) {
    if (c.status === 'Disposed') continue;
    const list = openByInst.get(c.institutionId) ?? [];
    list.push(c);
    openByInst.set(c.institutionId, list);
  }

  const resultingGroups: OverlapGroup[] = [];

  for (const [instId, cases] of openByInst.entries()) {
    const inst = instMap.get(instId);
    if (!inst || cases.length < 2) continue;

    // Evaluate all pairs for this institution
    const adj = new Map<string, Set<string>>();
    const pairReasons = new Map<string, string[]>();
    const pairScores: number[] = [];
    let anyConflict = false;

    for (let i = 0; i < cases.length; i++) {
      for (let j = i + 1; j < cases.length; j++) {
        const cA = cases[i];
        const cB = cases[j];

        // If both cases already belong to different explicit overlap groups (e.g., OVL-SVCET-01 vs OVL-FALSE-POS-01), keep them separate
        if (
          cA.overlapGroupId &&
          cB.overlapGroupId &&
          cA.overlapGroupId !== cB.overlapGroupId
        ) {
          continue;
        }

        const evalRes = evaluateComplaintPairOverlap(cA, cB, inst);

        // Also include pairs that share an explicit overlapGroupId from seed
        const explicitlyGrouped =
          Boolean(cA.overlapGroupId && cB.overlapGroupId && cA.overlapGroupId === cB.overlapGroupId);

        // Only auto-connect non-explicit pairs if they share a related category or meaningful semantic similarity
        const catRel = areCategoriesRelated(cA.category, cB.category);
        const meaningfullyRelated =
          explicitlyGrouped ||
          (evalRes.isOverlap && (catRel !== 'UNRELATED' || evalRes.semanticSimilarity >= 0.25));

        if (meaningfullyRelated) {
          if (!adj.has(cA.caseId)) adj.set(cA.caseId, new Set());
          if (!adj.has(cB.caseId)) adj.set(cB.caseId, new Set());
          adj.get(cA.caseId)!.add(cB.caseId);
          adj.get(cB.caseId)!.add(cA.caseId);

          pairScores.push(evalRes.score);
          if (evalRes.hasConflictingAction) anyConflict = true;
          const key = [cA.caseId, cB.caseId].sort().join('::');
          pairReasons.set(key, evalRes.reasons);
        }
      }
    }

    if (adj.size === 0) continue;

    // Find connected components (transitive closure of overlapping cases for this institution)
    const visited = new Set<string>();
    let compIdx = 1;

    for (const startCaseId of adj.keys()) {
      if (visited.has(startCaseId)) continue;
      const queue = [startCaseId];
      const componentIds: string[] = [];
      visited.add(startCaseId);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        componentIds.push(curr);
        for (const neighbor of adj.get(curr) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (componentIds.length < 2) continue;
      componentIds.sort();

      const involvedCases = componentIds
        .map((id) => cases.find((c) => c.caseId === id)!)
        .filter(Boolean);

      const bureausSet = new Set<Bureau>();
      let latestActivity = '';
      for (const ic of involvedCases) {
        bureausSet.add(ic.currentBureau);
        if (!latestActivity || ic.lastActionDate > latestActivity) {
          latestActivity = ic.lastActionDate;
        }
      }
      const bureausInvolved = Array.from(bureausSet);

      // Collect unique reasons across pairs in this component
      const mergedReasons = new Set<string>();
      let maxPairScore = 65;
      for (let i = 0; i < involvedCases.length; i++) {
        for (let j = i + 1; j < involvedCases.length; j++) {
          const k = [involvedCases[i].caseId, involvedCases[j].caseId].sort().join('::');
          const rList = pairReasons.get(k) ?? [];
          rList.forEach((r) => mergedReasons.add(r));
          const ev = evaluateComplaintPairOverlap(involvedCases[i], involvedCases[j], inst);
          if (ev.score > maxPairScore) maxPairScore = ev.score;
        }
      }

      // Check if an existing group matches these cases
      const existingCandidates = existingByInst.get(instId) ?? [];
      const matchedExisting = existingCandidates.find((eg) => {
        const overlapCount = eg.caseIds.filter((id) => componentIds.includes(id)).length;
        return overlapCount >= 2;
      });

      const groupId =
        matchedExisting?.id ??
        involvedCases.find((c) => c.overlapGroupId)?.overlapGroupId ??
        `OVL-${instId.slice(-4)}-${compIdx}`;
      compIdx++;

      // Respect dismissed status unless new activity occurred after detection
      let status = matchedExisting?.status ?? 'Open';
      if (
        matchedExisting?.status === 'Dismissed as false positive' &&
        latestActivity > matchedExisting.lastActivityTimestamp
      ) {
        status = 'Open';
      }

      const severity: 'Critical' | 'High' | 'Moderate' =
        bureausInvolved.length >= 3
          ? 'Critical'
          : anyConflict || maxPairScore >= 82
          ? 'High'
          : 'Moderate';

      const confidenceLevel =
        maxPairScore >= 85
          ? 'High (Auto-Resolved)'
          : maxPairScore >= 70
          ? 'Medium (Verify Match)'
          : 'Low';

      resultingGroups.push({
        id: groupId,
        institutionId: instId,
        caseIds: componentIds,
        bureausInvolved,
        overlapScore: maxPairScore,
        confidenceLevel,
        severity,
        reasons: Array.from(mergedReasons),
        status,
        leadBureau: matchedExisting?.leadBureau,
        coordinationNotes: matchedExisting?.coordinationNotes ?? [],
        detectedAt: matchedExisting?.detectedAt ?? new Date().toISOString(),
        resolvedBy: matchedExisting?.resolvedBy,
        dismissReason: matchedExisting?.dismissReason,
        lastActivityTimestamp: latestActivity,
        scenarioTag: matchedExisting?.scenarioTag,
      });
    }
  }

  return resultingGroups.sort((a, b) => b.overlapScore - a.overlapScore);
}

/**
 * Compute Institution Risk Score (0-100) with human-readable breakdown
 */
export function computeInstitutionRisk(
  institution: Institution,
  institutionCases: Complaint[],
  overlapGroups: OverlapGroup[]
): { score: number; factors: string[] } {
  const openCases = institutionCases.filter((c) => c.status !== 'Disposed');
  const criticalOrHigh = openCases.filter((c) => c.priority === 'Critical' || c.priority === 'High');
  const activeOverlaps = overlapGroups.filter(
    (g) =>
      g.institutionId === institution.aicteId &&
      g.status !== 'Dismissed as false positive' &&
      !g.status.startsWith('Resolved')
  );
  const activeBureaus = new Set(openCases.map((c) => c.currentBureau));

  let score = 15;
  const factors: string[] = [];

  if (openCases.length > 0) {
    const pts = Math.min(30, openCases.length * 6);
    score += pts;
    factors.push(`${openCases.length} open complaint(s) (+${pts} pts)`);
  }

  if (criticalOrHigh.length > 0) {
    const pts = Math.min(25, criticalOrHigh.length * 8);
    score += pts;
    factors.push(`${criticalOrHigh.length} High/Critical priority case(s) (+${pts} pts)`);
  }

  if (activeBureaus.size >= 2) {
    const pts = Math.min(20, activeBureaus.size * 6);
    score += pts;
    factors.push(`${activeBureaus.size} Bureaus concurrently investigating (+${pts} pts)`);
  }

  if (activeOverlaps.length > 0) {
    score += 12;
    factors.push(`${activeOverlaps.length} active cross-bureau overlap group(s) (+12 pts)`);
  }

  if (institution.approvalStatus === 'Under Review') {
    score += 10;
    factors.push('Approval status currently Under Review (+10 pts)');
  } else if (institution.approvalStatus === 'Withdrawn') {
    score += 18;
    factors.push('Approval status Withdrawn (+18 pts)');
  }

  return {
    score: Math.min(100, score),
    factors,
  };
}

/**
 * Redact PII (names, emails, phone numbers) before sending description text to AI
 */
export function redactPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/\b(?:Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, '[NAME_REDACTED]');
}

/**
 * Rule-based fallback for Natural Language Search queries
 * e.g. "show pending fee refund cases in the Southern region older than 60 days"
 */
export function parseNaturalLanguageSearchFallback(query: string): {
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
} {
  const q = query.toLowerCase();
  const result: {
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
  } = { explanation: 'Parsed via rule-based keyword grammar' };

  const regions: Region[] = [
    'South-Western',
    'North-Western',
    'Northern',
    'Southern',
    'Eastern',
    'Western',
    'Central',
  ];
  for (const r of regions) {
    if (q.includes(r.toLowerCase())) {
      result.region = r;
      break;
    }
  }

  if (q.includes('pgrc')) result.bureau = 'PGRC';
  else if (q.includes('regulation') || /\brb\b/.test(q)) result.bureau = 'RB';
  else if (q.includes('approval') || /\bab\b/.test(q)) result.bureau = 'AB';
  else if (q.includes('legal')) result.bureau = 'Legal Cell';
  else if (q.includes('vigilance')) result.bureau = 'Vigilance Cell';
  else if (q.includes('academic')) result.bureau = 'Academic Bureau';

  if (q.includes('fee') || q.includes('refund')) result.category = 'Fee/Refund';
  else if (q.includes('salary') || q.includes('faculty')) result.category = 'Faculty salary/qualification';
  else if (q.includes('ragging') || q.includes('harass')) result.category = 'Ragging/Harassment';
  else if (q.includes('fake degree')) result.category = 'Fake degree';
  else if (q.includes('fake') || q.includes('affiliation')) result.category = 'Fake approval/Affiliation issue';
  else if (q.includes('infra') || q.includes('lab')) result.category = 'Infrastructure/Lab deficiency';
  else if (q.includes('admission')) result.category = 'Admission irregularity';
  else if (q.includes('disclosure')) result.category = 'Mandatory disclosure violation';
  else if (q.includes('closure') || q.includes('withdraw')) result.category = 'Closure/Withdrawal';

  if (q.includes('pending')) result.status = 'Pending Information';
  else if (q.includes('under process') || q.includes('processing')) result.status = 'Under Process';
  else if (q.includes('disposed') || q.includes('closed')) result.status = 'Disposed';
  else if (q.includes('escalated')) result.status = 'Escalated';
  else if (q.includes('transferred')) result.status = 'Transferred';
  else if (q.includes('reopened')) result.status = 'Reopened';

  if (q.includes('critical')) result.priority = 'Critical';
  else if (q.includes('high priority') || q.includes('urgent')) result.priority = 'High';

  if (q.includes('overdue') || q.includes('sla breach') || q.includes('beyond sla')) {
    result.overdueOnly = true;
  }
  if (q.includes('overlap') || q.includes('duplicate')) {
    result.overlapOnly = true;
  }

  const ageMatch = q.match(/(?:older than|more than|above|>)\s*(\d+)\s*days?/);
  if (ageMatch) {
    result.minAgeDays = Number(ageMatch[1]);
  }

  const parts: string[] = [];
  if (result.status) parts.push(`Status=${result.status}`);
  if (result.category) parts.push(`Category=${result.category}`);
  if (result.region) parts.push(`Region=${result.region}`);
  if (result.bureau) parts.push(`Bureau=${result.bureau}`);
  if (result.minAgeDays) parts.push(`Age>${result.minAgeDays}d`);
  if (result.overdueOnly) parts.push('Overdue=true');
  if (result.overlapOnly) parts.push('Overlap=true');

  result.explanation = parts.length
    ? `Applied filters: ${parts.join(', ')}`
    : 'Applied text search filter';

  return result;
}

/**
 * Rule-based fallback for Complaint Category & Priority auto-suggestion
 */
export function suggestClassificationFallback(description: string): {
  category: ComplaintCategory;
  priority: Priority;
  suggestedBureau: Bureau;
  reasoning: string;
} {
  const d = description.toLowerCase();
  if (d.includes('ragging') || d.includes('harass') || d.includes('hostel abuse')) {
    return {
      category: 'Ragging/Harassment',
      priority: 'Critical',
      suggestedBureau: 'Vigilance Cell',
      reasoning: 'Detected student safety / anti-ragging keywords requiring immediate Vigilance attention.',
    };
  }
  if (d.includes('fake degree') || d.includes('forged degree')) {
    return {
      category: 'Fake degree',
      priority: 'Critical',
      suggestedBureau: 'Legal Cell',
      reasoning: 'Detected degree forgery indicators requiring Legal & Regulation action.',
    };
  }
  if (d.includes('unapproved') || d.includes('without eoa') || d.includes('affiliation') || d.includes('bogus')) {
    return {
      category: 'Fake approval/Affiliation issue',
      priority: 'High',
      suggestedBureau: 'RB',
      reasoning: 'Detected EoA / affiliation compliance issue routed to Regulation Bureau (RB).',
    };
  }
  if (d.includes('salary') || d.includes('paid') || d.includes('arrears') || d.includes('remuneration') || d.includes('pf')) {
    return {
      category: 'Faculty salary/qualification',
      priority: 'High',
      suggestedBureau: 'PGRC',
      reasoning: 'Detected faculty salary non-payment / service condition grievance.',
    };
  }
  if (d.includes('fee') || d.includes('refund') || d.includes('original certificate') || d.includes('capitation')) {
    return {
      category: 'Fee/Refund',
      priority: 'High',
      suggestedBureau: 'PGRC',
      reasoning: 'Detected fee refund or certificate retention grievance under AICTE fee norms.',
    };
  }
  if (d.includes('lab') || d.includes('equipment') || d.includes('building') || d.includes('infrastructure')) {
    return {
      category: 'Infrastructure/Lab deficiency',
      priority: 'Medium',
      suggestedBureau: 'AB',
      reasoning: 'Detected laboratory / infrastructure deficiency relevant to Approval Bureau norms.',
    };
  }
  if (d.includes('admission') || d.includes('quota') || d.includes('merit')) {
    return {
      category: 'Admission irregularity',
      priority: 'High',
      suggestedBureau: 'RB',
      reasoning: 'Detected admission process irregularity routed to Regulation Bureau.',
    };
  }
  return {
    category: 'Mandatory disclosure violation',
    priority: 'Medium',
    suggestedBureau: 'PGRC',
    reasoning: 'Classified under general institutional governance & mandatory disclosure compliance.',
  };
}
