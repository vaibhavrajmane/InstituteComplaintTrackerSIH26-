import {
  Institution,
  Complaint,
  ActionHistory,
  OverlapGroup,
  Alert,
  AuditLog,
  Region,
  Bureau,
  ComplaintCategory,
  ComplaintSource,
  Priority,
  CaseStatus,
  SLAConfig,
  UserProfile,
} from '../types';
import { detectAllOverlaps, computeInstitutionRisk } from '../engine/overlap';

// Deterministic PRNG (Mulberry32) so seed data is 100% reproducible
function createRNG(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  'Fake approval/Affiliation issue': 45,
  'Fee/Refund': 30,
  'Faculty salary/qualification': 45,
  'Infrastructure/Lab deficiency': 60,
  'Admission irregularity': 30,
  'Ragging/Harassment': 15,
  'Mandatory disclosure violation': 30,
  'Closure/Withdrawal': 60,
  'Fake degree': 30,
  Other: 45,
};

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'USR-CHAIRMAN',
    name: 'Prof. T.G. Sitharam (Chairman Office)',
    designation: 'Competent Authority / Super Admin',
    roleType: 'SUPER_ADMIN',
    bureau: 'HQ',
    canEditAll: true,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: true,
    canAccessAdmin: true,
  },
  {
    id: 'USR-MEMSEC',
    name: 'Dr. Abhay Jere (Advisor / Member Secretary Office)',
    designation: 'Senior Management (Global Read-Only & Escalations)',
    roleType: 'SENIOR_MANAGEMENT',
    bureau: 'HQ',
    canEditAll: false,
    canEditOwnBureau: false,
    canResolveOverlaps: false,
    canViewUnmaskedPII: true,
    canAccessAdmin: false,
  },
  {
    id: 'USR-PGRC',
    name: 'Smt. Meenakshi Iyer',
    designation: 'Assistant Director, Public Grievance Redressal Cell (PGRC)',
    roleType: 'BUREAU_OFFICER',
    bureau: 'PGRC',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: true,
    canAccessAdmin: false,
  },
  {
    id: 'USR-RB',
    name: 'Sh. Rajeshwar Rao',
    designation: 'Deputy Director, Regulation Bureau (RB)',
    roleType: 'BUREAU_OFFICER',
    bureau: 'RB',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: true,
    canAccessAdmin: false,
  },
  {
    id: 'USR-AB',
    name: 'Dr. Rameshwar Prasad',
    designation: 'Director, Approval Bureau (AB)',
    roleType: 'BUREAU_OFFICER',
    bureau: 'AB',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: false,
    canAccessAdmin: false,
  },
  {
    id: 'USR-LEGAL',
    name: 'Adv. Vikramaditya Sen',
    designation: 'Legal Officer, Legal Cell',
    roleType: 'BUREAU_OFFICER',
    bureau: 'Legal Cell',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: true,
    canAccessAdmin: false,
  },
  {
    id: 'USR-VIG',
    name: 'Sh. Arvind Deshmukh',
    designation: 'Chief Vigilance Officer, Vigilance Cell',
    roleType: 'BUREAU_OFFICER',
    bureau: 'Vigilance Cell',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: true,
    canAccessAdmin: false,
  },
  {
    id: 'USR-SRO',
    name: 'Dr. S. Sundararajan',
    designation: 'Regional Officer, Southern Regional Office (Chennai)',
    roleType: 'REGIONAL_OFFICER',
    bureau: 'Southern RO',
    region: 'Southern',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: false,
    canAccessAdmin: false,
  },
  {
    id: 'USR-NRO',
    name: 'Dr. Pradeep Kumar Garg',
    designation: 'Regional Officer, Northern Regional Office (Kanpur)',
    roleType: 'REGIONAL_OFFICER',
    bureau: 'Northern RO',
    region: 'Northern',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: false,
    canAccessAdmin: false,
  },
  {
    id: 'USR-WRO',
    name: 'Dr. Chandrakant Kulkarni',
    designation: 'Regional Officer, Western Regional Office (Mumbai)',
    roleType: 'REGIONAL_OFFICER',
    bureau: 'Western RO',
    region: 'Western',
    canEditAll: false,
    canEditOwnBureau: true,
    canResolveOverlaps: true,
    canViewUnmaskedPII: false,
    canAccessAdmin: false,
  },
];

interface SeedInstitutionTemplate {
  aicteId: string;
  name: string;
  aliases: string[];
  type: Institution['type'];
  city: string;
  district: string;
  state: string;
  pincode: string;
  region: Region;
  headOfInstitution: string;
  approvalStatus: Institution['approvalStatus'];
}

const CORE_INSTITUTIONS: SeedInstitutionTemplate[] = [
  {
    aicteId: '1-9810011223',
    name: 'Sri Venkateswara College of Engineering & Technology',
    aliases: [
      'S.V. College of Engg and Tech.',
      'Sri Venkateshwara Coll. of Engineering',
      'SVCET Tirupati',
      'S.V. College Engg',
    ],
    type: 'Autonomous',
    city: 'Tirupati',
    district: 'Tirupati',
    state: 'Andhra Pradesh',
    pincode: '517127',
    region: 'Southern',
    headOfInstitution: 'Dr. K. Sudhakar Reddy',
    approvalStatus: 'Under Review',
  },
  {
    aicteId: '1-9820044551',
    name: 'Chhatrapati Shivaji Maharaj Institute of Technology & Management',
    aliases: [
      'C.S.M. Inst. of Tech. and Mgmt',
      'Shivaji Maharaj College of Engg Panvel',
      'CSMITM Navi Mumbai',
    ],
    type: 'Affiliated',
    city: 'Navi Mumbai',
    district: 'Raigad',
    state: 'Maharashtra',
    pincode: '410206',
    region: 'Western',
    headOfInstitution: 'Dr. Milind Deshpande',
    approvalStatus: 'Under Review',
  },
  {
    aicteId: '1-9830077882',
    name: 'Maharaja Agrasen Institute of Engineering & Applied Sciences',
    aliases: [
      'M.A. Instt. of Engg & Applied Sc.',
      'Maharaja Agrasen Technical Campus Rohini',
      'MAIEAS Delhi',
    ],
    type: 'Affiliated',
    city: 'New Delhi',
    district: 'North West Delhi',
    state: 'Delhi',
    pincode: '110085',
    region: 'North-Western',
    headOfInstitution: 'Prof. S.K. Chakravorty',
    approvalStatus: 'Approved',
  },
  {
    aicteId: '1-9840099114',
    name: 'Dr. B.R. Ambedkar Regional College of Engineering & Technology',
    aliases: [
      'Ambedkar Reg. Coll. of Engg.',
      'BRARCET Kanpur',
      'Dr. Ambedkar Technical Institute Kanpur (Old Name)',
    ],
    type: 'Affiliated',
    city: 'Kanpur',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    pincode: '208024',
    region: 'Northern',
    headOfInstitution: 'Dr. Virendra प्रताप Singh',
    approvalStatus: 'Under Review',
  },
  {
    aicteId: '1-9850033449',
    name: 'Netaji Subhas Chandra Bose Institute of Engineering & Management',
    aliases: [
      'N.S.C.B. Inst. of Engg. & Mgmt.',
      'Subhas Bose Engineering College Salt Lake',
      'NSCBIEM Kolkata',
    ],
    type: 'Affiliated',
    city: 'Kolkata',
    district: 'North 24 Parganas',
    state: 'West Bengal',
    pincode: '700091',
    region: 'Eastern',
    headOfInstitution: 'Prof. Debashish Chatterjee',
    approvalStatus: 'Approved',
  },
  {
    aicteId: '1-9860055667',
    name: 'Rani Durgavati Vishwavidyalaya Institute of Pharmaceutical & Technical Sciences',
    aliases: [
      'R.D.V. Inst. of Pharm. & Tech. Sciences',
      'Rani Durgavati Technical College Jabalpur',
      'RDVIPTS Jabalpur',
    ],
    type: 'University',
    city: 'Jabalpur',
    district: 'Jabalpur',
    state: 'Madhya Pradesh',
    pincode: '482001',
    region: 'Central',
    headOfInstitution: 'Dr. Alok Kumar Tiwari',
    approvalStatus: 'Approved',
  },
  {
    aicteId: '1-9870088990',
    name: 'Sir M. Visvesvaraya Institute of Information Technology & Engineering',
    aliases: [
      'M. Visvesvaraya Inst. of IT & Engg',
      'SMVIITE Yelahanka',
      'Visvesvaraya College of Engg Bengaluru',
    ],
    type: 'Autonomous',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '562157',
    region: 'South-Western',
    headOfInstitution: 'Dr. H.N. Narasimha Murthy',
    approvalStatus: 'Approved',
  },
  {
    aicteId: '1-9880012345',
    name: 'Sardar Vallabhbhai Patel Institute of Advanced Engineering & Research',
    aliases: [
      'S.V. Patel Inst. of Adv. Engg.',
      'SVPIAER Vadodara',
      'Patel Engineering College Waghodia',
    ],
    type: 'Affiliated',
    city: 'Vadodara',
    district: 'Vadodara',
    state: 'Gujarat',
    pincode: '391760',
    region: 'Central',
    headOfInstitution: 'Dr. Bhavesh Patel',
    approvalStatus: 'Under Review',
  },
  {
    aicteId: '1-9890054321',
    name: 'PSG College of Advanced Technology & Industrial Research',
    aliases: [
      'P.S.G. Coll. of Adv. Tech.',
      'PSGCATIR Peelamedu',
      'PSG Tech Industrial Campus Coimbatore',
    ],
    type: 'Autonomous',
    city: 'Coimbatore',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641004',
    region: 'Southern',
    headOfInstitution: 'Dr. R. Rudramoorthy',
    approvalStatus: 'Approved',
  },
  {
    aicteId: '1-9900067890',
    name: 'Bhagwan Parshuram College of Engineering & Management Studies',
    aliases: [
      'B.P. Coll. of Engg. and Mgmt.',
      'Bhagwan Parshuram Tech Institute Sonipat',
      'BPCEMS Sonipat',
    ],
    type: 'Affiliated',
    city: 'Sonipat',
    district: 'Sonipat',
    state: 'Haryana',
    pincode: '131001',
    region: 'North-Western',
    headOfInstitution: 'Dr. Rajender Singh Hooda',
    approvalStatus: 'Withdrawn',
  },
];

const REGIONAL_LOCATIONS: {
  region: Region;
  city: string;
  district: string;
  state: string;
  pincodePrefix: string;
}[] = [
  { region: 'Southern', city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu', pincodePrefix: '6000' },
  { region: 'Southern', city: 'Hyderabad', district: 'Rangareddy', state: 'Telangana', pincodePrefix: '5000' },
  { region: 'Southern', city: 'Madurai', district: 'Madurai', state: 'Tamil Nadu', pincodePrefix: '6250' },
  { region: 'South-Western', city: 'Mysuru', district: 'Mysuru', state: 'Karnataka', pincodePrefix: '5700' },
  { region: 'South-Western', city: 'Kochi', district: 'Ernakulam', state: 'Kerala', pincodePrefix: '6820' },
  { region: 'South-Western', city: 'Mangaluru', district: 'Dakshina Kannada', state: 'Karnataka', pincodePrefix: '5750' },
  { region: 'Western', city: 'Pune', district: 'Pune', state: 'Maharashtra', pincodePrefix: '4110' },
  { region: 'Western', city: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', pincodePrefix: '4400' },
  { region: 'Western', city: 'Panaji', district: 'North Goa', state: 'Goa', pincodePrefix: '4030' },
  { region: 'Central', city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', pincodePrefix: '4620' },
  { region: 'Central', city: 'Ahmedabad', district: 'Ahmedabad', state: 'Gujarat', pincodePrefix: '3800' },
  { region: 'Central', city: 'Raipur', district: 'Raipur', state: 'Chhattisgarh', pincodePrefix: '4920' },
  { region: 'Northern', city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', pincodePrefix: '2260' },
  { region: 'Northern', city: 'Prayagraj', district: 'Prayagraj', state: 'Uttar Pradesh', pincodePrefix: '2110' },
  { region: 'Northern', city: 'Patna', district: 'Patna', state: 'Bihar', pincodePrefix: '8000' },
  { region: 'North-Western', city: 'Jaipur', district: 'Jaipur', state: 'Rajasthan', pincodePrefix: '3020' },
  { region: 'North-Western', city: 'Chandigarh', district: 'Chandigarh', state: 'Chandigarh', pincodePrefix: '1600' },
  { region: 'North-Western', city: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', pincodePrefix: '1410' },
  { region: 'Eastern', city: 'Bhubaneswar', district: 'Khordha', state: 'Odisha', pincodePrefix: '7510' },
  { region: 'Eastern', city: 'Guwahati', district: 'Kamrup', state: 'Assam', pincodePrefix: '7810' },
  { region: 'Eastern', city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', pincodePrefix: '8340' },
];

const INSTITUTION_PREFIXES = [
  'Sri Siddhartha',
  'Gokaraju Rangaraju',
  'Vellore Vidya',
  'Symbiosis Vishwa',
  'Kalinga Bharati',
  'Dayananda Sagar',
  'Thapar Vidya',
  'Birla Vishvakarma',
  'Hindustan Presidency',
  'Maulana Azad',
  'Pandit Deendayal',
  'Swami Vivekananda',
  'Acharya Nagarjuna',
  'Kakatiya Technological',
  'Dr. D.Y. Patil',
  'MIT World',
  'Bharati Vidyapeeth',
  'galgotias Memorial',
  'Pranveer Singh',
  'Haldia Regional',
  'Siliguri Pioneer',
  'Nirma Vidya',
  'Lakshmi Narain',
  'Shri Ramdeobaba',
  'Bannari Amman',
  'Kongu Nadu',
  'Sona Premier',
  'Rajagiri Saint',
  'Mar Athanasius',
  'Manipal Coastal',
  'KLE Technological',
  'B.M.S. Heritage',
  'R.V. National',
  'Pimpri Chinchwad',
  'Vishwakarma Global',
  'Walchand Sangli',
  'Acropolis Malwa',
  'Medi-Caps Central',
  'Gyan Ganga',
  'Bhilai Steel City',
  'Institute of Engineering &',
  'lovely Professional',
  'Chitkara Alpine',
  'Poornima Aravalli',
  'Swami Keshvanand',
  'Muzaffarpur Bihari',
  'Silicon Eastern',
  'Gandhi Institute for',
  'iter Siksha',
  'Assam Down Town',
];

const INSTITUTION_SUFFIXES = [
  'College of Engineering & Technology',
  'Institute of Technology & Management',
  'College of Engineering',
  'Institute of Pharmaceutical & Technical Sciences',
  'School of Architecture & Planning',
  'Technical Campus & Research Center',
];

const OFFICERS_BY_BUREAU: Record<Bureau, string[]> = {
  RB: ['Sh. Rajeshwar Rao', 'Dr. Anupam Mishra', 'Smt. Kavita Nair'],
  PGRC: ['Smt. Meenakshi Iyer', 'Sh. Harish Chandra', 'Ms. Pooja Sharma'],
  AB: ['Dr. Rameshwar Prasad', 'Sh.Sanjay Kulkarni', 'Dr. Neha Verma'],
  'Legal Cell': ['Adv. Vikramaditya Sen', 'Smt. Aparna Bose'],
  'Vigilance Cell': ['Sh. Arvind Deshmukh', 'Sh. Rajeev Lochan'],
  'Academic Bureau': ['Prof. Nandini Mukhopadhyay', 'Dr. Vivek Joshi'],
  'Northern RO': ['Dr. Pradeep Kumar Garg', 'Sh. Manish Tiwari'],
  'Southern RO': ['Dr. S. Sundararajan', 'Smt. Revathi Subramanian'],
  'Eastern RO': ['Dr. Subrata Chattopadhyay', 'Sh. Biplab Das'],
  'Western RO': ['Dr. Chandrakant Kulkarni', 'Smt. Snehal Joshi'],
  'Central RO': ['Dr. Rajeev Tripathi', 'Sh. Amitabh Dubey'],
  'South-Western RO': ['Dr. K.S. Venkatesh', 'Smt. Nandita Hegde'],
  'North-Western RO': ['Dr. Harpreet Singh', 'Sh. Deepak Arora'],
};

const COMPLAINANT_NAMES = [
  'Aarav Sharma',
  'Priya Nair',
  'Dr. Karthik Subramanian',
  'Rohan Deshmukh',
  'Ananya Chatterjee',
  'Prof. S.N. Murthy',
  'Vikramjit Singh',
  'Meera Krishnan',
  'Suresh Babu R.',
  'Divya Prakash',
  'Mohammed Tariq',
  'Neha Gupta',
  'Aditya Verma',
  'Kavya Reddy',
  'Faculty Welfare Association',
  'Parents Action Committee',
  'Final Year B.Tech Batch Representative',
  'Anonymous Whistleblower (Verified)',
];

const CATEGORY_DESCRIPTIONS: Record<ComplaintCategory, string[]> = {
  'Faculty salary/qualification': [
    'Teaching staff in Computer Science and Electronics departments have not been paid regular monthly salary for the past 5 months; PF contributions also deducted but not deposited.',
    'Institution is employing unapproved guest lecturers without M.Tech/Ph.D. qualifications while showing ghost faculty names on the AICTE portal.',
    'Management is withholding 40% of AICTE 7th CPC scale pay and confiscating original degree certificates of newly joined Assistant Professors.',
  ],
  'Fee/Refund': [
    'Student withdrew admission before the AICTE cutoff date of October 15, but the college administration refuses to refund the ₹1,15,000 tuition deposit and retains original 10th/12th marksheets.',
    'Institution is demanding ₹45,000 cash as mandatory placement & development fee above the state fee regulatory committee approved ceiling.',
    'Caution money deposit of ₹15,000 not refunded to 180 graduated students of the 2025 batch despite repeated representations.',
  ],
  'Fake approval/Affiliation issue': [
    'Institution is advertising admissions for B.Tech Artificial Intelligence & Data Science (120 seats) without obtaining Extension of Approval (EoA) from AICTE for the current academic session.',
    'Running an unapproved off-campus study center in an industrial commercial complex without university affiliation or AICTE clearance.',
    'Misleading newspaper advertisements claiming Autonomous status and NBA accreditation for all branches when accreditation expired 2 years ago.',
  ],
  'Infrastructure/Lab deficiency': [
    'Mechanical and Civil Engineering laboratories lack functional testing machines; students are taken to a nearby polytechnic only during inspection days.',
    'Severe shortage of licensed software, computer terminals, and barrier-free ramps/lifts despite claiming 100% infrastructure readiness in EoA affidavit.',
    'Library has fewer than 35% of required national/international journals and hostel potable water & fire safety NOC has expired.',
  ],
  'Admission irregularity': [
    'Management quota seats filled without publishing merit rank list or conducting transparent counseling, violating state CET and AICTE guidelines.',
    'Admitted 25 excess students in Lateral Entry 2nd year B.Tech beyond the sanctioned intake capacity.',
    'Denied admission to state entrance exam allotted scholarship category candidates citing unavailability of seats.',
  ],
  'Ragging/Harassment': [
    'Senior hostel students subjected first-year B.Tech residents to late-night ragging and intimidation in Block C; warden failed to convene the Anti-Ragging Squad.',
    'Workplace harassment and arbitrary termination threat against female faculty members who raised concerns over maternity leave norms.',
  ],
  'Mandatory disclosure violation': [
    'Mandatory Disclosure document, audited balance sheet, faculty list with PAN/AICTE IDs, and fee structure are completely missing from the official college website.',
    'Grievance Redressal Committee (GRC) and Internal Complaints Committee (ICC) contact numbers on the website are non-functional.',
  ],
  'Closure/Withdrawal': [
    'Management abruptly announced closure of M.Tech and Diploma shifts mid-semester without arranging student transfer or obtaining progressive closure approval.',
    'Applied for course reduction without clearing pending dues of 28 teaching and non-teaching staff members.',
  ],
  'Fake degree': [
    'Issuing backdated B.Tech and MBA provisional certificates to candidates who never attended regular classes or appeared in university examinations.',
    'Verification request from employer revealed fabricated transcript serial numbers issued under the institution seal.',
  ],
  Other: [
    'Irregularities in utilization of AICTE MODROBS and Pragati/Saksham scholarship grants meant for meritorious students.',
    'Non-issuance of Bonafide and No-Objection Certificates to students applying for national internships and GATE fellowships.',
  ],
};

export interface SeedDatabase {
  institutions: Institution[];
  complaints: Complaint[];
  actionHistories: Record<string, ActionHistory[]>;
  overlapGroups: OverlapGroup[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  slaConfig: SLAConfig;
}

export function generateSeedDatabase(): SeedDatabase {
  const rng = createRNG(20261024);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // 1. Build 60 Institutions
  const institutions: Institution[] = [];

  for (const core of CORE_INSTITUTIONS) {
    institutions.push({
      ...core,
      programs: ['B.Tech (CSE, ECE, ME)', 'M.Tech', 'MBA', 'MCA'],
      address: `Plot ${Math.floor(rng() * 90 + 10)}, Knowledge Park / Institutional Area, ${core.city}`,
      contact: `0${Math.floor(rng() * 800 + 110)}-${Math.floor(rng() * 8000000 + 2000000)}`,
      riskScore: 50,
    });
  }

  for (let i = 0; i < 50; i++) {
    const loc = REGIONAL_LOCATIONS[i % REGIONAL_LOCATIONS.length];
    const prefix = INSTITUTION_PREFIXES[i % INSTITUTION_PREFIXES.length];
    const suffix = INSTITUTION_SUFFIXES[i % INSTITUTION_SUFFIXES.length];
    const fullName = `${prefix} ${suffix}`;
    const shortWords = prefix.split(' ');
    const initials = shortWords.map((w) => w[0]?.toUpperCase() ?? '').join('.');
    const aicteId = `1-${9100000000 + i * 135791}`;

    const types: Institution['type'][] = ['Affiliated', 'Autonomous', 'Standalone', 'University'];
    const approvals: Institution['approvalStatus'][] = [
      'Approved',
      'Approved',
      'Approved',
      'Under Review',
      'Approved',
      'Withdrawn',
    ];

    institutions.push({
      aicteId,
      name: fullName,
      aliases: [
        `${initials}. Coll. of Engg. ${loc.city}`,
        `${prefix} Tech Campus ${loc.city}`,
      ],
      type: types[i % types.length],
      programs: i % 3 === 0 ? ['B.Tech', 'MBA', 'B.Pharm'] : ['B.Tech', 'M.Tech', 'Diploma'],
      address: `Sector ${Math.floor(rng() * 25 + 1)}, Industrial & Educational Zone, ${loc.city}`,
      city: loc.city,
      district: loc.district,
      state: loc.state,
      pincode: `${loc.pincodePrefix}${String((i % 89) + 10)}`,
      region: loc.region,
      contact: `0${Math.floor(rng() * 800 + 110)}-${Math.floor(rng() * 8000000 + 2000000)}`,
      headOfInstitution: `Dr. ${['R.K.', 'S.P.', 'A.K.', 'M.V.', 'N.K.'][i % 5]} ${
        ['Sharma', 'Iyer', 'Kulkarni', 'Chatterjee', 'Reddy', 'Verma', 'Patel'][i % 7]
      }`,
      approvalStatus: approvals[i % approvals.length],
      riskScore: 25,
    });
  }

  // Reference date: 2026-10-24
  const NOW_MS = new Date('2026-10-24T12:00:00Z').getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const isoDate = (ms: number) => new Date(ms).toISOString().split('T')[0];
  const isoDateTime = (ms: number) => new Date(ms).toISOString();

  const complaints: Complaint[] = [];
  const actionHistories: Record<string, ActionHistory[]> = {};

  function addCaseWithHistory(c: Complaint, customHistory?: ActionHistory[]) {
    complaints.push(c);
    if (customHistory) {
      actionHistories[c.caseId] = customHistory;
      return;
    }

    const rcvMs = new Date(c.receivedDate).getTime();
    const lastMs = new Date(c.lastActionDate).getTime();
    const span = Math.max(DAY_MS * 3, lastMs - rcvMs);

    const history: ActionHistory[] = [
      {
        id: `ACT-${c.caseId}-1`,
        caseId: c.caseId,
        timestamp: isoDateTime(rcvMs + 3600 * 1000 * 2),
        actionType: 'Received',
        fromBureau: c.originBureau,
        officer: 'Central Registry Desk',
        remarks: `Complaint registered via ${c.source} regarding ${c.category}. Auto-matched to AICTE ID ${c.institutionId}.`,
        documents: c.attachments.length ? [c.attachments[0].name] : ['Grievance_Application.pdf'],
      },
      {
        id: `ACT-${c.caseId}-2`,
        caseId: c.caseId,
        timestamp: isoDateTime(rcvMs + span * 0.25),
        actionType: 'Assigned',
        fromBureau: c.originBureau,
        toBureau: c.originBureau,
        officer: c.assignedOfficer,
        remarks: `Case scrutiny initiated by ${c.originBureau}. Notice issued to Principal / Registrar for parawise comments within 15 days.`,
        documents: ['Notice_For_Parawise_Comments.pdf'],
      },
    ];

    if (c.originBureau !== c.currentBureau || c.status === 'Transferred') {
      history.push({
        id: `ACT-${c.caseId}-3`,
        caseId: c.caseId,
        timestamp: isoDateTime(rcvMs + span * 0.55),
        actionType: 'Transferred',
        fromBureau: c.originBureau,
        toBureau: c.currentBureau,
        officer: OFFICERS_BY_BUREAU[c.originBureau][0],
        remarks: `Transferred from ${c.originBureau} to ${c.currentBureau} as subject matter involves regulatory/statutory jurisdiction.`,
        documents: ['Inter_Bureau_Transfer_Memo.pdf'],
      });
    } else {
      history.push({
        id: `ACT-${c.caseId}-3`,
        caseId: c.caseId,
        timestamp: isoDateTime(rcvMs + span * 0.55),
        actionType: 'Reply received',
        fromBureau: c.currentBureau,
        officer: c.assignedOfficer,
        remarks: 'Interim response uploaded by institution; supporting annexures verified against EoA records.',
        documents: ['Institution_Compliance_Reply.pdf'],
      });
    }

    if (c.status === 'Escalated') {
      history.push({
        id: `ACT-${c.caseId}-4`,
        caseId: c.caseId,
        timestamp: isoDateTime(lastMs),
        actionType: 'Escalated',
        fromBureau: c.currentBureau,
        toBureau: c.currentBureau,
        officer: c.assignedOfficer,
        remarks: c.lastAction,
        documents: ['Show_Cause_And_Escalation_Order.pdf'],
      });
    } else if (c.status === 'Disposed') {
      history.push({
        id: `ACT-${c.caseId}-4`,
        caseId: c.caseId,
        timestamp: isoDateTime(lastMs),
        actionType: 'Disposed',
        fromBureau: c.currentBureau,
        officer: c.assignedOfficer,
        remarks: `Case disposed after compliance verification: ${c.lastAction}`,
        documents: ['Final_Speaking_Disposal_Order.pdf'],
      });
    } else {
      history.push({
        id: `ACT-${c.caseId}-4`,
        caseId: c.caseId,
        timestamp: isoDateTime(lastMs),
        actionType: c.lastAction.toLowerCase().includes('inspection')
          ? 'Inspection ordered'
          : c.lastAction.toLowerCase().includes('show-cause')
          ? 'Show-cause notice'
          : 'Remark',
        fromBureau: c.currentBureau,
        officer: c.assignedOfficer,
        remarks: c.lastAction,
        documents: ['Case_Noting_Sheet.pdf'],
      });
    }

    actionHistories[c.caseId] = history;
  }

  // =========================================================================
  // SEED 14 INTENTIONAL OVERLAP SCENARIOS (Covering a, b, c, d, e, f + more)
  // =========================================================================

  // SCENARIO A & C: Sri Venkateswara College of Engineering & Technology (1-9810011223)
  // Open PGRC and RB cases on the same underlying issue with DIFFERENT WORDING ("faculty not paid for 6 months" vs "salary default by management")
  // AND name aliases ("S.V. College of Engg and Tech." vs "Sri Venkateshwara Coll. of Engineering")
  addCaseWithHistory({
    caseId: 'AICTE/PGRC/2026/00101',
    institutionId: '1-9810011223',
    submittedInstitutionName: 'S.V. College of Engg and Tech.',
    receivedDate: isoDate(NOW_MS - 34 * DAY_MS),
    source: 'Faculty',
    complainantName: 'Dr. K. Venkata Subbaiah & 14 Faculty Members',
    complainantContact: '9848011223',
    category: 'Faculty salary/qualification',
    description:
      'Faculty not paid for 6 months in CSE and ECE departments at S.V. College of Engg and Tech., Tirupati. Management is also withholding original Ph.D. and M.Tech degree certificates.',
    priority: 'Critical',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Smt. Meenakshi Iyer',
    lastAction: 'Clarification sought from Principal on 6-month salary disbursement bank statements',
    lastActionDate: isoDate(NOW_MS - 6 * DAY_MS),
    nextActionRequired: 'Verify bank NEFT salary scrolls and coordinate with Regulation Bureau',
    expectedDisposalDate: isoDate(NOW_MS + 11 * DAY_MS),
    slaDays: 45,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-SVCET-01',
    attachments: [
      { name: 'Bank_Statement_NonPayment_Proof.pdf', size: '1.4 MB', uploadedAt: isoDate(NOW_MS - 34 * DAY_MS), type: 'application/pdf' },
      { name: 'Signed_Faculty_Representation_Tirupati.pdf', size: '840 KB', uploadedAt: isoDate(NOW_MS - 34 * DAY_MS), type: 'application/pdf' },
    ],
  });

  addCaseWithHistory({
    caseId: 'AICTE/RB/2026/00102',
    institutionId: '1-9810011223',
    submittedInstitutionName: 'Sri Venkateshwara Coll. of Engineering',
    receivedDate: isoDate(NOW_MS - 22 * DAY_MS),
    source: 'CPGRAMS',
    complainantName: 'AP Engineering Teachers Association',
    complainantContact: '9848099887',
    category: 'Faculty salary/qualification',
    description:
      'Severe salary default by management since April 2026 at Sri Venkateshwara Coll. of Engineering, Tirupati. Teaching staff remuneration arrears exceed ₹1.8 Crore in violation of AICTE 7th CPC norms.',
    priority: 'Critical',
    status: 'Escalated',
    currentBureau: 'RB',
    originBureau: 'RB',
    assignedOfficer: 'Sh. Rajeshwar Rao',
    lastAction: 'Inspection ordered by Standing Hearing Committee (SHC) to verify faculty acquaintance rolls',
    lastActionDate: isoDate(NOW_MS - 3 * DAY_MS),
    nextActionRequired: 'Execute Expert Visit Committee (EVC) inspection',
    expectedDisposalDate: isoDate(NOW_MS + 23 * DAY_MS),
    slaDays: 45,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-SVCET-01',
    attachments: [
      { name: 'CPGRAMS_Forwarding_Dossier_RB.pdf', size: '2.1 MB', uploadedAt: isoDate(NOW_MS - 22 * DAY_MS), type: 'application/pdf' },
    ],
  });

  // Also add Southern RO case on the same SV College issue so 3 Bureaus are involved!
  addCaseWithHistory({
    caseId: 'AICTE/Southern RO/2026/00103',
    institutionId: '1-9810011223',
    submittedInstitutionName: 'SVCET Tirupati',
    receivedDate: isoDate(NOW_MS - 15 * DAY_MS),
    source: 'Letter',
    complainantName: 'Dr. M. Rajasekhar',
    complainantContact: '9848011223',
    category: 'Faculty salary/qualification',
    description:
      'Non-payment of monthly salaries for 6 months and coercive retention of original educational certificates of faculty members at SVCET Tirupati.',
    priority: 'High',
    status: 'Pending Information',
    currentBureau: 'Southern RO',
    originBureau: 'Southern RO',
    assignedOfficer: 'Dr. S. Sundararajan',
    lastAction: 'Show-cause notice issued by Southern Regional Office Chennai',
    lastActionDate: isoDate(NOW_MS - 4 * DAY_MS),
    nextActionRequired: 'Await regional committee verification report',
    expectedDisposalDate: isoDate(NOW_MS + 30 * DAY_MS),
    slaDays: 45,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-SVCET-01',
    attachments: [
      { name: 'SRO_Show_Cause_Notice_103.pdf', size: '620 KB', uploadedAt: isoDate(NOW_MS - 15 * DAY_MS), type: 'application/pdf' },
    ],
  });

  // SCENARIO F: False-Positive Pair on Sri Venkateswara College (1-9810011223) - Unrelated Issues to demonstrate Dismiss Workflow
  addCaseWithHistory({
    caseId: 'AICTE/PGRC/2026/00104',
    institutionId: '1-9810011223',
    submittedInstitutionName: 'Sri Venkateswara College of Engineering & Technology',
    receivedDate: isoDate(NOW_MS - 40 * DAY_MS),
    source: 'Student',
    complainantName: 'K. Sai Teja',
    complainantContact: '9440123456',
    category: 'Fee/Refund',
    description:
      'Delay in refund of ₹18,000 hostel mess caution deposit after completion of B.Tech Mechanical final semester.',
    priority: 'Low',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Ms. Pooja Sharma',
    lastAction: 'Accounts officer directed to process NEFT refund within 7 working days',
    lastActionDate: isoDate(NOW_MS - 12 * DAY_MS),
    nextActionRequired: 'Collect UTR receipt from institution',
    expectedDisposalDate: isoDate(NOW_MS + 5 * DAY_MS),
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-FALSE-POS-01',
    attachments: [{ name: 'Hostel_Caution_Receipt.pdf', size: '310 KB', uploadedAt: isoDate(NOW_MS - 40 * DAY_MS), type: 'application/pdf' }],
  });

  addCaseWithHistory({
    caseId: 'AICTE/Academic Bureau/2026/00105',
    institutionId: '1-9810011223',
    submittedInstitutionName: 'Sri Venkateswara College of Engineering & Technology',
    receivedDate: isoDate(NOW_MS - 36 * DAY_MS),
    source: 'Portal',
    complainantName: 'Nikhil Kumar',
    complainantContact: '9440654321',
    category: 'Other',
    description:
      'Request for clarification on credit transfer equivalence for SWAYAM NPTEL elective course in 7th semester.',
    priority: 'Low',
    status: 'Under Process',
    currentBureau: 'Academic Bureau',
    originBureau: 'Academic Bureau',
    assignedOfficer: 'Prof. Nandini Mukhopadhyay',
    lastAction: 'Forwarded AICTE credit framework circular to Dean Academics',
    lastActionDate: isoDate(NOW_MS - 14 * DAY_MS),
    nextActionRequired: 'Confirm credit mapping in autonomous syllabus',
    expectedDisposalDate: isoDate(NOW_MS + 9 * DAY_MS),
    slaDays: 45,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-FALSE-POS-01',
    attachments: [{ name: 'NPTEL_Credit_Query.pdf', size: '220 KB', uploadedAt: isoDate(NOW_MS - 36 * DAY_MS), type: 'application/pdf' }],
  });

  // SCENARIO B: 3 Bureaus Involved on Chhatrapati Shivaji Maharaj Institute (1-9820044551) - Unapproved Course / Fake Approval
  addCaseWithHistory({
    caseId: 'AICTE/AB/2026/00106',
    institutionId: '1-9820044551',
    submittedInstitutionName: 'C.S.M. Inst. of Tech. and Mgmt',
    receivedDate: isoDate(NOW_MS - 52 * DAY_MS),
    source: 'Parent',
    complainantName: 'Sh. Sanjay Sawant',
    complainantContact: '9820112233',
    category: 'Fake approval/Affiliation issue',
    description:
      'Institution admitted 120 students in B.Tech Cyber Security & Blockchain without AICTE Extension of Approval (EoA) for 2026-27.',
    priority: 'Critical',
    status: 'Under Process',
    currentBureau: 'AB',
    originBureau: 'AB',
    assignedOfficer: 'Dr. Rameshwar Prasad',
    lastAction: 'EoA docket cross-checked; Cyber Security intake was rejected during scrutiny committee',
    lastActionDate: isoDate(NOW_MS - 8 * DAY_MS),
    nextActionRequired: 'Joint action with Regulation Bureau and Legal Cell',
    expectedDisposalDate: isoDate(NOW_MS - 7 * DAY_MS), // Overdue
    slaDays: 45,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-CSMITM-02',
    attachments: [{ name: 'Admission_Brochure_Unapproved_Branch.pdf', size: '3.2 MB', uploadedAt: isoDate(NOW_MS - 52 * DAY_MS), type: 'application/pdf' }],
  });

  addCaseWithHistory({
    caseId: 'AICTE/RB/2026/00107',
    institutionId: '1-9820044551',
    submittedInstitutionName: 'Chhatrapati Shivaji Maharaj Institute of Technology & Management',
    receivedDate: isoDate(NOW_MS - 44 * DAY_MS),
    source: 'RTI',
    complainantName: 'Activist Vivek Patwardhan',
    complainantContact: '9820445566',
    category: 'Admission irregularity',
    description:
      'Illegal admissions conducted in unapproved B.Tech Cyber Security division at Panvel campus without sanctioned intake.',
    priority: 'Critical',
    status: 'Escalated',
    currentBureau: 'RB',
    originBureau: 'RB',
    assignedOfficer: 'Sh. Rajeshwar Rao',
    lastAction: 'Show-cause notice issued under Clause 11 of AICTE Approval Process Handbook for withdrawal of approval',
    lastActionDate: isoDate(NOW_MS - 5 * DAY_MS),
    nextActionRequired: 'Personal hearing before Standing Appellate Committee',
    expectedDisposalDate: isoDate(NOW_MS - 14 * DAY_MS), // Overdue
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-CSMITM-02',
    attachments: [{ name: 'Show_Cause_Notice_Clause11.pdf', size: '1.1 MB', uploadedAt: isoDate(NOW_MS - 5 * DAY_MS), type: 'application/pdf' }],
  });

  addCaseWithHistory({
    caseId: 'AICTE/Legal Cell/2026/00108',
    institutionId: '1-9820044551',
    submittedInstitutionName: 'Shivaji Maharaj College of Engg Panvel',
    receivedDate: isoDate(NOW_MS - 29 * DAY_MS),
    source: 'Student',
    complainantName: 'Prathamesh Jadhav & 32 Students',
    complainantContact: '9820778899',
    category: 'Fake approval/Affiliation issue',
    description:
      'University refused exam registration for 1st year Cyber Security batch at Shivaji Maharaj College of Engg Panvel stating AICTE approval was never granted.',
    priority: 'Critical',
    status: 'Under Process',
    currentBureau: 'Legal Cell',
    originBureau: 'PGRC',
    assignedOfficer: 'Adv. Vikramaditya Sen',
    lastAction: 'Drafting counter-affidavit and student relocation directive to nearby approved colleges',
    lastActionDate: isoDate(NOW_MS - 2 * DAY_MS),
    nextActionRequired: 'Finalize student supernumerary reallocation order',
    expectedDisposalDate: isoDate(NOW_MS + 16 * DAY_MS),
    slaDays: 45,
    linkedCaseIds: ['AICTE/RB/2026/00107'],
    overlapGroupId: 'OVL-CSMITM-02',
    attachments: [{ name: 'University_Exam_Rejection_Circular.pdf', size: '950 KB', uploadedAt: isoDate(NOW_MS - 29 * DAY_MS), type: 'application/pdf' }],
  });

  // SCENARIO D: Case referencing the institution by an OLD NAME ("Dr. Ambedkar Technical Institute Kanpur (Old Name)")
  addCaseWithHistory({
    caseId: 'AICTE/PGRC/2026/00109',
    institutionId: '1-9840099114',
    submittedInstitutionName: 'Dr. Ambedkar Technical Institute Kanpur (Old Name)',
    receivedDate: isoDate(NOW_MS - 28 * DAY_MS),
    source: 'Student',
    complainantName: 'ashutosh Mishra',
    complainantContact: '9415012345',
    category: 'Fee/Refund',
    description:
      'Original migration and 12th standard certificates retained by Dr. Ambedkar Technical Institute Kanpur demanding full 4-year tuition fee from student who left after 1st semester.',
    priority: 'High',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Sh. Harish Chandra',
    lastAction: 'Directed institute to return original certificates within 48 hours per AICTE public notice',
    lastActionDate: isoDate(NOW_MS - 7 * DAY_MS),
    nextActionRequired: 'Impose penalty via Northern RO if certificates not returned',
    expectedDisposalDate: isoDate(NOW_MS + 2 * DAY_MS),
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-KANPUR-03',
    attachments: [{ name: 'Fee_Demand_Letter_Kanpur.pdf', size: '540 KB', uploadedAt: isoDate(NOW_MS - 28 * DAY_MS), type: 'application/pdf' }],
  });

  addCaseWithHistory({
    caseId: 'AICTE/Northern RO/2026/00110',
    institutionId: '1-9840099114',
    submittedInstitutionName: 'Dr. B.R. Ambedkar Regional College of Engineering & Technology',
    receivedDate: isoDate(NOW_MS - 19 * DAY_MS),
    source: 'CPGRAMS',
    complainantName: 'Ashutosh Mishra (via Parent Sh. R.K. Mishra)',
    complainantContact: '9415012345',
    category: 'Fee/Refund',
    description:
      'Refusal to refund ₹88,000 fee and illegal retention of original high school & intermediate marksheets by BRARCET Kanpur.',
    priority: 'High',
    status: 'Under Process',
    currentBureau: 'Northern RO',
    originBureau: 'Northern RO',
    assignedOfficer: 'Dr. Pradeep Kumar Garg',
    lastAction: 'Regional Office issued stern warning notice to Registrar',
    lastActionDate: isoDate(NOW_MS - 4 * DAY_MS),
    nextActionRequired: 'Coordinate with PGRC HQ to avoid duplicate show-cause notices',
    expectedDisposalDate: isoDate(NOW_MS + 11 * DAY_MS),
    slaDays: 30,
    linkedCaseIds: [],
    overlapGroupId: 'OVL-KANPUR-03',
    attachments: [{ name: 'CPGRAMS_Receipt_NRO.pdf', size: '480 KB', uploadedAt: isoDate(NOW_MS - 19 * DAY_MS), type: 'application/pdf' }],
  });

  // SCENARIO E: A PGRC case already transferred to RB while a duplicate still sits open in PGRC (Maharaja Agrasen 1-9830077882)
  addCaseWithHistory({
    caseId: 'AICTE/RB/2026/00111',
    institutionId: '1-9830077882',
    submittedInstitutionName: 'Maharaja Agrasen Institute of Engineering & Applied Sciences',
    receivedDate: isoDate(NOW_MS - 48 * DAY_MS),
    source: 'Portal',
    complainantName: 'Rohit Khatri & Batchmates',
    complainantContact: '9811223344',
    category: 'Admission irregularity',
    description:
      'Charging ₹1,50,000 undisclosed capitation fee in cash for B.Tech CSE management quota admissions at Rohini campus.',
    priority: 'High',
    status: 'Transferred',
    currentBureau: 'RB',
    originBureau: 'PGRC',
    assignedOfficer: 'Dr. Anupam Mishra',
    lastAction: 'Transferred from PGRC to RB; committee constituted to audit admission register',
    lastActionDate: isoDate(NOW_MS - 10 * DAY_MS),
    nextActionRequired: 'Audit admission fee bank receipts for 2026-27 intake',
    expectedDisposalDate: isoDate(NOW_MS - 18 * DAY_MS), // Overdue
    slaDays: 30,
    linkedCaseIds: ['AICTE/PGRC/2026/00112'],
    overlapGroupId: 'OVL-MAIEAS-04',
    attachments: [{ name: 'Admission_Audit_Transfer_Order.pdf', size: '1.2 MB', uploadedAt: isoDate(NOW_MS - 10 * DAY_MS), type: 'application/pdf' }],
  });

  addCaseWithHistory({
    caseId: 'AICTE/PGRC/2026/00112',
    institutionId: '1-9830077882',
    submittedInstitutionName: 'M.A. Instt. of Engg & Applied Sc.',
    receivedDate: isoDate(NOW_MS - 31 * DAY_MS),
    source: 'Email',
    complainantName: 'Rohit Khatri',
    complainantContact: '9811223344',
    category: 'Fee/Refund',
    description:
      'Duplicate grievance open in PGRC: Undisclosed capitation fee collected without official receipt during B.Tech CSE spot round admission.',
    priority: 'High',
    status: 'Under Process',
    currentBureau: 'PGRC',
    originBureau: 'PGRC',
    assignedOfficer: 'Smt. Meenakshi Iyer',
    lastAction: 'Preliminary notice sent by PGRC (unaware earlier file AICTE/RB/2026/00111 was already transferred to RB)',
    lastActionDate: isoDate(NOW_MS - 5 * DAY_MS),
    nextActionRequired: 'Merge duplicate PGRC file into lead RB investigation',
    expectedDisposalDate: isoDate(NOW_MS - 1 * DAY_MS),
    slaDays: 30,
    linkedCaseIds: ['AICTE/RB/2026/00111'],
    overlapGroupId: 'OVL-MAIEAS-04',
    attachments: [{ name: 'Email_Representation_Copy.pdf', size: '410 KB', uploadedAt: isoDate(NOW_MS - 31 * DAY_MS), type: 'application/pdf' }],
  });

  // Additional realistic overlap groups (Groups 5 to 13) across regions
  const extraOverlaps: {
    groupId: string;
    instId: string;
    aliasA: string;
    aliasB: string;
    bureauA: Bureau;
    bureauB: Bureau;
    bureauC?: Bureau;
    cat: ComplaintCategory;
    descA: string;
    descB: string;
    descC?: string;
    prio: Priority;
  }[] = [
    {
      groupId: 'OVL-NSCB-05',
      instId: '1-9850033449',
      aliasA: 'N.S.C.B. Inst. of Engg. & Mgmt.',
      aliasB: 'Subhas Bose Engineering College Salt Lake',
      bureauA: 'AB',
      bureauB: 'Eastern RO',
      cat: 'Infrastructure/Lab deficiency',
      descA: 'Severe deficiency in high-voltage Electrical Machines lab and absence of fire safety NOC in main academic block.',
      descB: 'Electrical and Mechanical laboratories lack functional equipment; building fire safety certificate expired in 2024.',
      prio: 'High',
    },
    {
      groupId: 'OVL-RDV-06',
      instId: '1-9860055667',
      aliasA: 'R.D.V. Inst. of Pharm. & Tech. Sciences',
      aliasB: 'Rani Durgavati Technical College Jabalpur',
      bureauA: 'Vigilance Cell',
      bureauB: 'Central RO',
      bureauC: 'PGRC',
      cat: 'Ragging/Harassment',
      descA: 'Serious ragging incident reported in Boys Hostel Wing-2; Anti-Ragging Helpline complaint forwarded for immediate inquiry.',
      descB: 'Physical intimidation and ragging of first-year B.Pharm students by seniors in Hostel Wing-2 at Jabalpur campus.',
      descC: 'Parents complaint regarding hostel ragging and inaction by Chief Warden at RDVIPTS Jabalpur.',
      prio: 'Critical',
    },
    {
      groupId: 'OVL-SMV-07',
      instId: '1-9870088990',
      aliasA: 'M. Visvesvaraya Inst. of IT & Engg',
      aliasB: 'Visvesvaraya College of Engg Bengaluru',
      bureauA: 'PGRC',
      bureauB: 'South-Western RO',
      cat: 'Faculty salary/qualification',
      descA: 'Non-implementation of 7th Pay Commission DA arrears and arbitrary deduction of 25% basic pay for 42 faculty members.',
      descB: 'Management withholding Dearness Allowance and 25% monthly salary of teaching staff at Yelahanka campus.',
      prio: 'High',
    },
    {
      groupId: 'OVL-SVP-08',
      instId: '1-9880012345',
      aliasA: 'S.V. Patel Inst. of Adv. Engg.',
      aliasB: 'Patel Engineering College Waghodia',
      bureauA: 'Legal Cell',
      bureauB: 'RB',
      cat: 'Fake degree',
      descA: 'Verification alert: 14 backdated B.Tech Civil degree certificates detected during PSU recruitment verification.',
      descB: 'Complaint regarding issuance of unverified backdated engineering provisional certificates without university exam records.',
      prio: 'Critical',
    },
    {
      groupId: 'OVL-PSG-09',
      instId: '1-9890054321',
      aliasA: 'P.S.G. Coll. of Adv. Tech.',
      aliasB: 'PSG Tech Industrial Campus Coimbatore',
      bureauA: 'AB',
      bureauB: 'Academic Bureau',
      cat: 'Mandatory disclosure violation',
      descA: 'Mandatory disclosure link on official portal does not list program-wise faculty student ratio or audited fee structure.',
      descB: 'Non-publication of AICTE mandatory disclosure annexures and faculty cadre details on college website.',
      prio: 'Medium',
    },
    {
      groupId: 'OVL-BPC-10',
      instId: '1-9900067890',
      aliasA: 'B.P. Coll. of Engg. and Mgmt.',
      aliasB: 'Bhagwan Parshuram Tech Institute Sonipat',
      bureauA: 'RB',
      bureauB: 'North-Western RO',
      bureauC: 'PGRC',
      cat: 'Closure/Withdrawal',
      descA: 'Unilateral suspension of B.Tech Mechanical and Civil classes mid-year without AICTE progressive closure permission.',
      descB: 'Students stranded as management locked academic blocks and halted classes without transfer arrangement.',
      descC: 'Faculty and students protesting sudden unapproved closure of engineering departments at Sonipat campus.',
      prio: 'Critical',
    },
    {
      groupId: 'OVL-PUNE-11',
      instId: institutions[16].aicteId,
      aliasA: institutions[16].aliases[0],
      aliasB: institutions[16].name,
      bureauA: 'PGRC',
      bureauB: 'Western RO',
      cat: 'Fee/Refund',
      descA: 'Refusal to refund ₹95,000 tuition fee to 18 students who cancelled admissions within AICTE stipulated deadline.',
      descB: 'Withholding admission cancellation fee refund and original leaving certificates of 1st year engineering students.',
      prio: 'High',
    },
    {
      groupId: 'OVL-HYD-12',
      instId: institutions[11].aicteId,
      aliasA: institutions[11].aliases[0],
      aliasB: institutions[11].name,
      bureauA: 'RB',
      bureauB: 'AB',
      cat: 'Infrastructure/Lab deficiency',
      descA: 'Operating two shifts in shared classrooms and showing same computer laboratory for both B.Tech and MCA intakes.',
      descB: 'Inspection discrepancy: shortage of 180 computer systems and overlapping lab utilization between degree and master programs.',
      prio: 'High',
    },
    {
      groupId: 'OVL-BBSR-13',
      instId: institutions[28].aicteId,
      aliasA: institutions[28].aliases[0],
      aliasB: institutions[28].name,
      bureauA: 'Vigilance Cell',
      bureauB: 'Eastern RO',
      cat: 'Other',
      descA: 'Misappropriation of ₹22 Lakhs AICTE MODROBS laboratory modernization grant through fictitious vendor invoices.',
      descB: 'Audit objection regarding unutilized MODROBS grant equipment and missing stock register entries.',
      prio: 'Critical',
    },
  ];

  let seq = 113;
  for (const item of extraOverlaps) {
    const sla = DEFAULT_SLA_CONFIG[item.cat];
    const cId1 = `AICTE/${item.bureauA}/2026/${String(seq++).padStart(5, '0')}`;
    const cId2 = `AICTE/${item.bureauB}/2026/${String(seq++).padStart(5, '0')}`;

    addCaseWithHistory({
      caseId: cId1,
      institutionId: item.instId,
      submittedInstitutionName: item.aliasA,
      receivedDate: isoDate(NOW_MS - Math.floor(rng() * 25 + 15) * DAY_MS),
      source: 'Portal',
      complainantName: pick(COMPLAINANT_NAMES),
      complainantContact: `98${Math.floor(rng() * 80000000 + 10000000)}`,
      category: item.cat,
      description: item.descA,
      priority: item.prio,
      status: 'Under Process',
      currentBureau: item.bureauA,
      originBureau: item.bureauA,
      assignedOfficer: OFFICERS_BY_BUREAU[item.bureauA][0],
      lastAction: `Show-cause notice issued by ${item.bureauA}; awaiting documentary evidence`,
      lastActionDate: isoDate(NOW_MS - Math.floor(rng() * 6 + 2) * DAY_MS),
      nextActionRequired: 'Review compliance affidavit and coordinate with sister bureaus',
      expectedDisposalDate: isoDate(NOW_MS + Math.floor(rng() * 14 - 4) * DAY_MS),
      slaDays: sla,
      linkedCaseIds: [],
      overlapGroupId: item.groupId,
      attachments: [{ name: `${item.groupId}_Evidence_A.pdf`, size: '1.1 MB', uploadedAt: isoDate(NOW_MS - 20 * DAY_MS), type: 'application/pdf' }],
    });

    addCaseWithHistory({
      caseId: cId2,
      institutionId: item.instId,
      submittedInstitutionName: item.aliasB,
      receivedDate: isoDate(NOW_MS - Math.floor(rng() * 20 + 8) * DAY_MS),
      source: 'CPGRAMS',
      complainantName: pick(COMPLAINANT_NAMES),
      complainantContact: `98${Math.floor(rng() * 80000000 + 10000000)}`,
      category: item.cat,
      description: item.descB,
      priority: item.prio,
      status: item.prio === 'Critical' ? 'Escalated' : 'Pending Information',
      currentBureau: item.bureauB,
      originBureau: item.bureauB,
      assignedOfficer: OFFICERS_BY_BUREAU[item.bureauB][0],
      lastAction: `Inspection ordered by ${item.bureauB} committee`,
      lastActionDate: isoDate(NOW_MS - Math.floor(rng() * 5 + 1) * DAY_MS),
      nextActionRequired: 'Verify physical compliance report',
      expectedDisposalDate: isoDate(NOW_MS + Math.floor(rng() * 18 - 5) * DAY_MS),
      slaDays: sla,
      linkedCaseIds: [],
      overlapGroupId: item.groupId,
      attachments: [{ name: `${item.groupId}_Evidence_B.pdf`, size: '920 KB', uploadedAt: isoDate(NOW_MS - 12 * DAY_MS), type: 'application/pdf' }],
    });

    if (item.bureauC && item.descC) {
      const cId3 = `AICTE/${item.bureauC}/2026/${String(seq++).padStart(5, '0')}`;
      addCaseWithHistory({
        caseId: cId3,
        institutionId: item.instId,
        submittedInstitutionName: item.aliasB,
        receivedDate: isoDate(NOW_MS - Math.floor(rng() * 14 + 5) * DAY_MS),
        source: 'Email',
        complainantName: pick(COMPLAINANT_NAMES),
        complainantContact: `98${Math.floor(rng() * 80000000 + 10000000)}`,
        category: item.cat,
        description: item.descC,
        priority: item.prio,
        status: 'Under Process',
        currentBureau: item.bureauC,
        originBureau: item.bureauC,
        assignedOfficer: OFFICERS_BY_BUREAU[item.bureauC][0],
        lastAction: `Urgent report called by ${item.bureauC}`,
        lastActionDate: isoDate(NOW_MS - 2 * DAY_MS),
        nextActionRequired: 'Consolidate findings with Vigilance & Regional Office',
        expectedDisposalDate: isoDate(NOW_MS + 7 * DAY_MS),
        slaDays: sla,
        linkedCaseIds: [],
        overlapGroupId: item.groupId,
        attachments: [{ name: `${item.groupId}_Evidence_C.pdf`, size: '780 KB', uploadedAt: isoDate(NOW_MS - 8 * DAY_MS), type: 'application/pdf' }],
      });
    }
  }

  // =========================================================================
  // GENERATE REMAINING CASES UP TO 400 TOTAL OVER LAST 24 MONTHS
  // Realistic status distribution: ~35% Disposed, ~30% Under Process,
  // ~12% Pending Information, ~8% Transferred, ~7% Escalated, ~5% Received, ~3% Reopened
  // =========================================================================
  const allBureaus: Bureau[] = [
    'PGRC',
    'RB',
    'AB',
    'Legal Cell',
    'Vigilance Cell',
    'Academic Bureau',
    'Southern RO',
    'Northern RO',
    'Western RO',
    'Eastern RO',
    'Central RO',
    'South-Western RO',
    'North-Western RO',
  ];

  const allCategories = Object.keys(DEFAULT_SLA_CONFIG) as ComplaintCategory[];
  const allSources: ComplaintSource[] = [
    'Portal',
    'CPGRAMS',
    'Student',
    'Faculty',
    'Parent',
    'Email',
    'RTI',
    'Letter',
    'Public',
  ];

  const statusWeights: { status: CaseStatus; weight: number }[] = [
    { status: 'Disposed', weight: 36 },
    { status: 'Under Process', weight: 29 },
    { status: 'Pending Information', weight: 12 },
    { status: 'Transferred', weight: 8 },
    { status: 'Escalated', weight: 7 },
    { status: 'Received', weight: 5 },
    { status: 'Reopened', weight: 3 },
  ];

  function pickWeightedStatus(): CaseStatus {
    const r = rng() * 100;
    let acc = 0;
    for (const sw of statusWeights) {
      acc += sw.weight;
      if (r <= acc) return sw.status;
    }
    return 'Under Process';
  }

  while (complaints.length < 400) {
    const instIdx = complaints.length % institutions.length;
    const inst = institutions[instIdx];
    // For the first 10 showcase institutions (which already have curated active overlap scenarios),
    // make additional background cases Disposed historical records so active overlap groups remain crisp.
    const status = instIdx < 10 ? 'Disposed' : pickWeightedStatus();
    const cat = allCategories[(complaints.length * 3) % allCategories.length];
    const slaDays = DEFAULT_SLA_CONFIG[cat];

    // Pick bureau aligned with region or HQ bureaus
    const regionBureau = `${inst.region} RO` as Bureau;
    const bureauPool: Bureau[] = ['PGRC', 'RB', 'AB', 'Legal Cell', 'Vigilance Cell', 'Academic Bureau', regionBureau];
    const currentBureau = bureauPool[complaints.length % bureauPool.length];
    const originBureau = status === 'Transferred' ? 'PGRC' : currentBureau;

    // Spread receivedDate over last 24 months (720 days)
    // Open cases are mostly within last 120 days, with ~25% older than SLA so total overdue is ~18%
    let ageDays: number;
    if (status === 'Disposed') {
      ageDays = Math.floor(rng() * 680 + 25);
    } else {
      const makeOverdue = rng() < 0.28;
      if (makeOverdue) {
        ageDays = slaDays + Math.floor(rng() * 55 + 5);
      } else {
        ageDays = Math.floor(rng() * (slaDays - 3) + 2);
      }
    }

    const rcvMs = NOW_MS - ageDays * DAY_MS;
    const year = new Date(rcvMs).getFullYear();
    const caseId = `AICTE/${currentBureau}/${year}/${String(seq++).padStart(5, '0')}`;

    const expMs = rcvMs + slaDays * DAY_MS;
    const lastActionOffset = Math.min(ageDays - 1, Math.floor(rng() * 20 + 2));
    const lastMs = NOW_MS - Math.max(1, lastActionOffset) * DAY_MS;

    const prios: Priority[] = ['Low', 'Medium', 'Medium', 'High', 'High', 'Critical'];
    const priority = cat === 'Ragging/Harassment' || cat === 'Fake degree' ? 'Critical' : pick(prios);

    const descTemplates = CATEGORY_DESCRIPTIONS[cat];
    const baseDesc = descTemplates[complaints.length % descTemplates.length];
    const useAlias = rng() < 0.25 && inst.aliases.length > 0;
    const subName = useAlias ? inst.aliases[0] : inst.name;

    const lastActionByStatus: Record<CaseStatus, string> = {
      Received: 'Grievance docketed and assigned to scrutiny officer for initial verification',
      'Under Process': 'Show-cause notice / clarification letter issued to Head of Institution',
      'Pending Information': 'Awaiting notarized compliance affidavit and supporting bank/academic records from institution',
      Transferred: `Transferred from ${originBureau} to ${currentBureau} for statutory action`,
      Escalated: 'Escalated to Standing Hearing Committee (SHC) due to non-submission of satisfactory reply',
      Disposed: 'Compliance verified by committee; speaking order issued and case closed',
      Reopened: 'Case reopened on fresh representation by complainant citing partial non-compliance',
    };

    const nextActionByStatus: Record<CaseStatus, string> = {
      Received: 'Issue initial notice within 7 days',
      'Under Process': 'Scrutinize institutional reply and verify documents',
      'Pending Information': 'Send final reminder before escalating to Hearing Committee',
      Transferred: 'Assign inspecting officer in receiving bureau',
      Escalated: 'Schedule SHC hearing and EVC inspection',
      Disposed: 'No further action required (Archived)',
      Reopened: 'Conduct fresh verification of compliance claims',
    };

    addCaseWithHistory({
      caseId,
      institutionId: inst.aicteId,
      submittedInstitutionName: subName,
      receivedDate: isoDate(rcvMs),
      source: allSources[complaints.length % allSources.length],
      complainantName: COMPLAINANT_NAMES[complaints.length % COMPLAINANT_NAMES.length],
      complainantContact: `9${Math.floor(rng() * 899999999 + 100000000)}`,
      category: cat,
      description: `${baseDesc} (Ref: ${subName}, ${inst.city}).`,
      priority,
      status,
      currentBureau,
      originBureau,
      assignedOfficer: pick(OFFICERS_BY_BUREAU[currentBureau]),
      lastAction: lastActionByStatus[status],
      lastActionDate: isoDate(lastMs),
      nextActionRequired: nextActionByStatus[status],
      expectedDisposalDate: isoDate(expMs),
      slaDays,
      linkedCaseIds: [],
      attachments: [
        {
          name: `Annexure_${caseId.replace(/\//g, '_')}.pdf`,
          size: `${Math.floor(rng() * 1800 + 250)} KB`,
          uploadedAt: isoDate(rcvMs),
          type: 'application/pdf',
        },
      ],
      disposedDate: status === 'Disposed' ? isoDate( Math.min(NOW_MS - DAY_MS, rcvMs + Math.floor(rng() * 35 + 8) * DAY_MS) ) : undefined,
    });
  }

  // Run Overlap Detection Engine on the seeded cases
  const detectedGroups = detectAllOverlaps(complaints, institutions);

  // Enrich specific seeded overlap groups with coordination notes and scenario tags
  const overlapGroups: OverlapGroup[] = detectedGroups.map((g) => {
    if (g.id === 'OVL-SVCET-01') {
      return {
        ...g,
        scenarioTag: 'Scenario A & C: PGRC + RB + SRO Parallel Actions & Semantic Match',
        coordinationNotes: [
          {
            id: 'CN-1',
            author: 'Smt. Meenakshi Iyer',
            bureau: 'PGRC',
            timestamp: isoDateTime(NOW_MS - 3 * DAY_MS),
            message:
              'PGRC has already requested 6-month salary bank scrolls from SVCET Tirupati. Requesting RB to share EVC inspection schedule so we do not issue conflicting directions.',
          },
          {
            id: 'CN-2',
            author: 'Sh. Rajeshwar Rao',
            bureau: 'RB',
            timestamp: isoDateTime(NOW_MS - 2 * DAY_MS),
            message:
              'Noted. Standing Hearing Committee ordered EVC inspection on AICTE/RB/2026/00102. Suggesting RB be designated Lead Bureau to consolidate PGRC & Southern RO notices.',
          },
        ],
      };
    }
    if (g.id === 'OVL-FALSE-POS-01') {
      return {
        ...g,
        overlapScore: 54,
        confidenceLevel: 'Medium (Verify Match)',
        severity: 'Moderate',
        scenarioTag: 'Scenario F: False-Positive Pair (Same Institution, Unrelated Issues)',
        reasons: [
          'Same AICTE ID (1-9810011223)',
          'Filed within 30 days (4d apart)',
          'Low semantic overlap (0.08) – Hostel mess deposit refund vs NPTEL credit transfer query',
        ],
      };
    }
    if (g.id === 'OVL-CSMITM-02') {
      return {
        ...g,
        status: 'Coordination Initiated',
        leadBureau: 'RB',
        scenarioTag: 'Scenario B: 3 Bureaus Involved (AB + RB + Legal Cell)',
        coordinationNotes: [
          {
            id: 'CN-3',
            author: 'Dr. Rameshwar Prasad',
            bureau: 'AB',
            timestamp: isoDateTime(NOW_MS - 4 * DAY_MS),
            message:
              'Approval Bureau confirms no EoA was granted for B.Tech Cyber Security. Forwarded scrutiny sheet to RB and Legal Cell.',
          },
        ],
      };
    }
    if (g.id === 'OVL-KANPUR-03') {
      return {
        ...g,
        scenarioTag: 'Scenario D: Old Institution Name Matched via Alias Resolution',
      };
    }
    if (g.id === 'OVL-MAIEAS-04') {
      return {
        ...g,
        scenarioTag: 'Scenario E: Transferred to RB while Duplicate Remains Open in PGRC',
      };
    }
    return g;
  });

  // Update each complaint's overlapGroupId based on detected groups
  const caseToGroup = new Map<string, string>();
  for (const og of overlapGroups) {
    for (const cid of og.caseIds) {
      caseToGroup.set(cid, og.id);
    }
  }
  for (const c of complaints) {
    if (caseToGroup.has(c.caseId)) {
      c.overlapGroupId = caseToGroup.get(c.caseId);
    }
  }

  // Compute dynamic Institution Risk Scores
  for (const inst of institutions) {
    const instCases = complaints.filter((c) => c.institutionId === inst.aicteId);
    const { score } = computeInstitutionRisk(inst, instCases, overlapGroups);
    inst.riskScore = score;
  }

  // Generate Alerts
  const alerts: Alert[] = [];
  let alertSeq = 1;

  for (const og of overlapGroups.slice(0, 10)) {
    const inst = institutions.find((i) => i.aicteId === og.institutionId);
    for (const b of og.bureausInvolved) {
      alerts.push({
        id: `ALT-OVL-${alertSeq++}`,
        type: 'Overlap',
        institutionId: og.institutionId,
        overlapGroupId: og.id,
        caseId: og.caseIds[0],
        targetBureau: b,
        region: inst?.region,
        severity: og.severity === 'Critical' ? 'Critical' : 'High',
        message: `Potential Overlapping Cases (${og.caseIds.length} files across ${og.bureausInvolved.join(', ')}) detected for ${inst?.name ?? og.institutionId}. Coordination required.`,
        createdAt: isoDateTime(NOW_MS - (alertSeq % 5) * 3600 * 1000 * 5),
        read: false,
      });
    }
  }

  // SLA Breach & Approaching SLA alerts
  const openComplaints = complaints.filter((c) => c.status !== 'Disposed');
  for (const c of openComplaints.slice(0, 25)) {
    const expMs = new Date(c.expectedDisposalDate).getTime();
    const daysRemaining = Math.ceil((expMs - NOW_MS) / DAY_MS);
    const inst = institutions.find((i) => i.aicteId === c.institutionId);

    if (daysRemaining < 0) {
      alerts.push({
        id: `ALT-SLA-${alertSeq++}`,
        type: 'SLA breach',
        caseId: c.caseId,
        institutionId: c.institutionId,
        targetBureau: c.currentBureau,
        region: inst?.region,
        severity: 'Critical',
        message: `SLA Breached by ${Math.abs(daysRemaining)} days on ${c.caseId} (${c.category} – ${inst?.name}). Immediate disposal or escalation required.`,
        createdAt: isoDateTime(NOW_MS - 3600 * 1000 * 8),
        read: false,
      });
    } else if (daysRemaining <= 7) {
      alerts.push({
        id: `ALT-APP-${alertSeq++}`,
        type: 'Approaching SLA',
        caseId: c.caseId,
        institutionId: c.institutionId,
        targetBureau: c.currentBureau,
        region: inst?.region,
        severity: daysRemaining <= 3 ? 'High' : 'Medium',
        message: `SLA due in ${daysRemaining} day(s) for ${c.caseId} (${c.category}). Next action: ${c.nextActionRequired}.`,
        createdAt: isoDateTime(NOW_MS - 3600 * 1000 * 12),
        read: daysRemaining > 5,
      });
    }
  }

  // Escalation & Pending reminder alerts
  for (const c of openComplaints.filter((x) => x.status === 'Escalated').slice(0, 6)) {
    const inst = institutions.find((i) => i.aicteId === c.institutionId);
    alerts.push({
      id: `ALT-ESC-${alertSeq++}`,
      type: 'Escalation',
      caseId: c.caseId,
      institutionId: c.institutionId,
      targetBureau: c.currentBureau,
      region: inst?.region,
      severity: 'Critical',
      message: `Case ${c.caseId} escalated to Standing Hearing Committee for ${inst?.name}.`,
      createdAt: isoDateTime(NOW_MS - 3600 * 1000 * 18),
      read: false,
    });
  }

  // Initial Immutable Audit Logs
  const auditLogs: AuditLog[] = [
    {
      id: 'AUD-1001',
      timestamp: isoDateTime(NOW_MS - 6 * 3600 * 1000),
      user: 'System Overlap Engine v2.4',
      role: 'Automated Governance Service',
      bureau: 'HQ',
      action: 'OVERLAP_SCAN_COMPLETED',
      targetId: 'GLOBAL',
      details: `Scanned 400 complaints across 60 institutions; flagged ${overlapGroups.length} cross-bureau overlap groups.`,
    },
    {
      id: 'AUD-1002',
      timestamp: isoDateTime(NOW_MS - 5 * 3600 * 1000),
      user: 'Sh. Rajeshwar Rao',
      role: 'BUREAU_OFFICER',
      bureau: 'RB',
      action: 'CASE_ESCALATED',
      targetId: 'AICTE/RB/2026/00102',
      details: 'Ordered EVC inspection on Sri Venkateswara College of Engineering & Technology (1-9810011223).',
    },
    {
      id: 'AUD-1003',
      timestamp: isoDateTime(NOW_MS - 4 * 3600 * 1000),
      user: 'Smt. Meenakshi Iyer',
      role: 'BUREAU_OFFICER',
      bureau: 'PGRC',
      action: 'COORDINATION_NOTE_POSTED',
      targetId: 'OVL-SVCET-01',
      details: 'Posted cross-bureau coordination note on OVL-SVCET-01 regarding 6-month faculty salary non-payment.',
    },
    {
      id: 'AUD-1004',
      timestamp: isoDateTime(NOW_MS - 2 * 3600 * 1000),
      user: 'Dr. Rameshwar Prasad',
      role: 'BUREAU_OFFICER',
      bureau: 'AB',
      action: 'COORDINATION_INITIATED',
      targetId: 'OVL-CSMITM-02',
      details: 'Initiated tri-bureau coordination (AB, RB, Legal Cell) for unapproved Cyber Security course at 1-9820044551.',
    },
  ];

  return {
    institutions,
    complaints,
    actionHistories,
    overlapGroups,
    alerts,
    auditLogs,
    slaConfig: DEFAULT_SLA_CONFIG,
  };
}
