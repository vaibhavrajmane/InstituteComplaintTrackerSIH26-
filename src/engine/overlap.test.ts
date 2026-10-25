import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeInstitutionName,
  matchInstitution,
  computeSemanticSimilarity,
  evaluateComplaintPairOverlap,
  detectAllOverlaps,
  parseNaturalLanguageSearchFallback,
} from './overlap';
import { Institution, Complaint } from '../types';

const mockInstitution: Institution = {
  aicteId: '1-9810011223',
  name: 'Sri Venkateswara College of Engineering & Technology',
  aliases: [
    'S.V. College of Engg and Tech.',
    'Sri Venkateshwara Coll. of Engineering',
    'SVCET Tirupati',
  ],
  type: 'Affiliated',
  programs: ['B.Tech', 'M.Tech', 'MBA'],
  address: 'NH-71, Chittoor Road',
  city: 'Tirupati',
  district: 'Tirupati',
  state: 'Andhra Pradesh',
  pincode: '517127',
  region: 'Southern',
  contact: '0877-2233445',
  headOfInstitution: 'Dr. K. Sudhakar Reddy',
  approvalStatus: 'Approved',
  riskScore: 78,
};

test('1. Name normalization expands abbreviations and strips stopwords', () => {
  const norm1 = normalizeInstitutionName('Sri Venkateswara College of Engineering & Technology');
  const norm2 = normalizeInstitutionName('Sri Venkateshwara Coll. of Engg. & Tech.');
  assert.equal(norm1, 'sri venkateswara college engineering technology');
  assert.equal(norm2, 'sri venkateswara college engineering technology');
});

test('2. Fuzzy alias matching finds Sri Venkateswara College from "S.V. College Engg"', () => {
  const matches = matchInstitution('S.V. College Engg', [mockInstitution]);
  assert.ok(matches.length > 0, 'Should return at least one match');
  assert.equal(matches[0].institution.aicteId, '1-9810011223');
  assert.ok(matches[0].score >= 0.85, `Expected score >= 0.85, got ${matches[0].score}`);
  assert.equal(matches[0].resolutionStatus, 'AUTO_RESOLVED');
});

test('3. Exact AICTE Permanent ID resolves with score 1.0', () => {
  const matches = matchInstitution('1-9810011223', [mockInstitution]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].score, 1.0);
  assert.equal(matches[0].matchedOn, 'AICTE_ID');
});

test('4. Semantic similarity matches different wording on faculty salary default', () => {
  const descA = 'Faculty members in CSE and ECE have not been paid salary for the last 6 months.';
  const descB = 'Severe remuneration default by college management; teaching staff wages withheld since April.';
  const res = computeSemanticSimilarity(descA, descB);
  assert.ok(res.similarity >= 0.3, `Expected semantic similarity >= 0.3, got ${res.similarity}`);
  assert.ok(res.sharedConcepts.some((c) => c.includes('salary')));
});

test('5. Cross-bureau RB + PGRC complaints on same issue produce high overlap score and conflicting action flag', () => {
  const caseA: Complaint = {
    caseId: 'AICTE/PGRC/2026/00101',
    institutionId: mockInstitution.aicteId,
    submittedInstitutionName: 'S.V. College of Engg and Tech.',
    receivedDate: '2026-09-10',
    source: 'Faculty',
    complainantName: 'Dr. Ramesh Babu',
    complainantContact: '9848011223',
    category: 'Faculty salary/qualification',
    description: 'Faculty not paid salary for 6 months and original experience certificates withheld.',
    priority: 'High',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Smt. Meenakshi Iyer',
    lastAction: 'Clarification sought from Principal',
    lastActionDate: '2026-09-18',
    nextActionRequired: 'Verify bank disbursement statements',
    expectedDisposalDate: '2026-10-25',
    slaDays: 45,
    linkedCaseIds: [],
    attachments: [],
  };

  const caseB: Complaint = {
    caseId: 'AICTE/RB/2026/00102',
    institutionId: mockInstitution.aicteId,
    submittedInstitutionName: 'Sri Venkateshwara Coll. of Engineering',
    receivedDate: '2026-09-22',
    source: 'CPGRAMS',
    complainantName: 'Faculty Welfare Forum',
    complainantContact: '9848099887',
    category: 'Faculty salary/qualification',
    description: 'Continuous salary default by management for 6 months and violation of AICTE pay scale.',
    priority: 'Critical',
    status: 'Escalated',
    currentBureau: 'RB',
    originBureau: 'RB',
    assignedOfficer: 'Sh. Rajeshwar Rao',
    lastAction: 'Inspection ordered by Standing Hearing Committee',
    lastActionDate: '2026-10-02',
    nextActionRequired: 'Conduct EVC inspection',
    expectedDisposalDate: '2026-11-05',
    slaDays: 45,
    linkedCaseIds: [],
    attachments: [],
  };

  const evaluation = evaluateComplaintPairOverlap(caseA, caseB, mockInstitution);
  assert.equal(evaluation.isOverlap, true);
  assert.ok(evaluation.score >= 80, `Expected overlap score >= 80, got ${evaluation.score}`);
  assert.equal(evaluation.hasConflictingAction, true);
});

test('6. Dismissed false-positive overlap group stays dismissed on re-scan unless new activity occurs', () => {
  const case1: Complaint = {
    caseId: 'AICTE/PGRC/2026/00201',
    institutionId: mockInstitution.aicteId,
    receivedDate: '2026-08-01',
    source: 'Student',
    complainantName: 'Ananya K',
    complainantContact: '9000011111',
    category: 'Fee/Refund',
    description: 'Tuition fee refund delayed after admission cancellation in round 2.',
    priority: 'Medium',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Officer A',
    lastAction: 'Notice sent',
    lastActionDate: '2026-08-10',
    nextActionRequired: 'Await refund receipt',
    expectedDisposalDate: '2026-09-15',
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-FALSE-POS',
    attachments: [],
  };

  const case2: Complaint = {
    caseId: 'AICTE/AB/2026/00202',
    institutionId: mockInstitution.aicteId,
    receivedDate: '2026-08-05',
    source: 'Portal',
    complainantName: 'Rohit M',
    complainantContact: '9000022222',
    category: 'Mandatory disclosure violation',
    description: 'Mandatory disclosure PDF link broken on college website homepage.',
    priority: 'Low',
    status: 'Under Process',
    currentBureau: 'AB',
    originBureau: 'AB',
    assignedOfficer: 'Officer B',
    lastAction: 'Email reminder sent',
    lastActionDate: '2026-08-12',
    nextActionRequired: 'Verify website link',
    expectedDisposalDate: '2026-09-20',
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-FALSE-POS',
    attachments: [],
  };

  const initialGroups = detectAllOverlaps([case1, case2], [mockInstitution]);
  assert.equal(initialGroups.length, 1);

  // Simulate user dismissing as false positive
  const dismissedGroup = {
    ...initialGroups[0],
    status: 'Dismissed as false positive' as const,
    dismissReason: 'Unrelated issues: one is student fee refund, other is website link.',
  };

  const afterRescan = detectAllOverlaps([case1, case2], [mockInstitution], [dismissedGroup]);
  assert.equal(afterRescan[0].status, 'Dismissed as false positive');
});

test('7. Natural-language fallback parser extracts structured filters accurately', () => {
  const parsed = parseNaturalLanguageSearchFallback(
    'show pending fee refund cases in the Southern region older than 60 days'
  );
  assert.equal(parsed.status, 'Pending Information');
  assert.equal(parsed.category, 'Fee/Refund');
  assert.equal(parsed.region, 'Southern');
  assert.equal(parsed.minAgeDays, 60);
});
