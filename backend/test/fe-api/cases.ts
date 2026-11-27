/**
 * API-level test cases for SSFM features (FE-01 … FE-57).
 *
 * Only the case types that apply to each feature are defined:
 *  - Unauthenticated  : protected endpoint without a token must return 401
 *  - Forbidden        : a role not listed in @Roles must receive 403
 *  - Not found        : an id that does not exist must not expose data (404, or 403 for farm-scoped lookups)
 *  - Invalid input    : malformed input is rejected with 400
 *  - Min/Max boundary : values just outside DTO limits are rejected with 400
 *  - Business rule    : a rule enforced by the service
 *
 * Validation cases send a complete valid body (`body`) with one field changed (`patch`);
 * the runner first confirms the unchanged body passes validation, so each case fails
 * for exactly the reason it describes.
 */
import { MISSING_ID as ID, Role, USERS } from '../support/app-harness';

export type CaseType =
  | 'Unauthenticated'
  | 'Forbidden'
  | 'Not found'
  | 'Invalid input'
  | 'Min boundary'
  | 'Max boundary'
  | 'Business rule';

export interface ApiCase {
  fe: string; // 'FE-01'
  type: CaseType;
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  role: Role | null; // null = no token
  token?: 'invalid-signature' | 'expired';
  body?: Record<string, any>;
  patch?: Record<string, any>; // fields overriding `body` for the negative request
  query?: Record<string, any>;
  expect: number | number[];
  expected: string; // human readable expected result
  pre?: string; // precondition
}

const NOW = '2026-11-10T08:00:00.000Z'; // a past timestamp (records may not be in the future)
const long = (n: number) => 'x'.repeat(n);

export const B = {
  wq: { pondId: ID, recordTime: NOW, temperature: 28, ph: 7.8, dissolvedOxygen: 5, salinity: 15, alkalinity: 120, nh3: 0.1, transparency: 35 },
  pond: { name: 'Pond A1', areaSize: 1000, depth: 1.5, farmId: ID },
  farm: { name: 'Test Farm', address: 'Ca Mau', area: 5000 },
  crop: { pondId: ID, startDate: '2026-11-01', initialShrimpCount: 100000 },
  split: { transferDate: '2026-11-18', actualNurseryHarvest: 80000, destinations: [{ pondId: ID, shrimpCount: 40000 }] },
  harvest: { actualHarvestKg: 1200, actualHarvestSize: 40, actualHarvestPricePerKg: 150000 },
  inventory: { itemName: 'Feed No.2', farmId: ID, category: 'FEED', quantity: 100, unit: 'kg', minThreshold: 10 },
  usage: { quantityUsed: 5 },
  supplier: { name: 'ABC Feed Co.', farmId: ID, phone: '0912345678', email: 'sales@abc.vn' },
  sample: { casts: Array.from({ length: 5 }, () => ({ count: 20, weightGram: 150 })), netAreaSqM: 3 },
  health: { farmId: ID, pondId: ID, cropId: ID, recordTime: NOW, healthStatus: 'NORMAL', severity: 'MILD', affectedPercentage: 10 },
  mortality: { cropId: ID, deadQuantityPcs: 50 },
  incident: { cropId: ID, title: 'White feces observed', description: 'Several shrimp show white feces in pond A1.' },
  treatment: { treatment: 'Apply probiotic 2 kg/ha' },
  register: { email: 'new.manager@test.local', password: 'Abcd1234', fullName: 'New Manager', phone: '0912345678' },
  reset: { email: 'manager@test.local', otp: '123456', password: 'Abcd1234', confirmPassword: 'Abcd1234' },
  user: { email: 'staff.new@test.local', fullName: 'New Staff', password: 'Abcd1234', role: 'TECHNICIAN' },
  profile: { fullName: 'Test Manager', phone: '0912345678', address: 'Ca Mau' },
  doc: { title: 'Water quality guide', content: 'Keep dissolved oxygen above 4 mg/L.' },
  staff: { farmId: ID, userId: USERS.TECHNICIAN.id, role: 'TECHNICIAN' },
  feeding: {
    farmId: ID, pondId: ID, cropId: ID, feedingDate: '2026-11-18',
    sessions: [{ feedingSession: 'SESSION_1', feedingTime: '06:00', feedProductId: ID, feedAmount: 5, feedingMethod: 'MANUAL', feedingStatus: 'COMPLETED' }],
  },
};

const R401 = 'The API returns 401 Unauthorized and no data is returned.';
const R403 = (role: string) => `The API returns 403 Forbidden for the ${role} role and no data is changed.`;
const R404 = 'The API returns 404 Not Found (or 403 for a farm-scoped resource) and no data is exposed.';
const R400 = (what: string) => `The API returns 400 Bad Request with a validation message for ${what}; nothing is saved.`;

const unauth = (fe: string, what: string, method: ApiCase['method'], path: string, body?: any): ApiCase => ({
  fe, type: 'Unauthenticated', title: `Reject unauthenticated request to ${what}`, method, path, role: null, body, expect: 401, expected: R401,
  pre: 'No access token is sent.',
});
const forbid = (fe: string, what: string, role: Role, method: ApiCase['method'], path: string, body?: any): ApiCase => ({
  fe, type: 'Forbidden', title: `Reject request from ${role} role to ${what}`, method, path, role, body, expect: 403, expected: R403(role),
  pre: `Signed in as ${role}, a role not allowed for this action.`,
});
const notFound = (fe: string, what: string, role: Role, method: ApiCase['method'], path: string, body?: any, strict = false): ApiCase => ({
  fe, type: 'Not found', title: `Return not found for ${what}`, method, path, role, body, expect: strict ? 404 : [403, 404], expected: strict ? 'The API returns 404 Not Found and no data is exposed.' : R404,
  pre: `Signed in as ${role}; the requested id does not exist.`,
});
const invalid = (fe: string, type: 'Invalid input' | 'Min boundary' | 'Max boundary', title: string, role: Role | null, method: ApiCase['method'], path: string, body: any, patch: any, what: string, query?: any): ApiCase => ({
  fe, type,
  title: (type === 'Invalid input' ? 'Reject invalid ' : type === 'Min boundary' ? 'Reject value below minimum: ' : 'Reject value above maximum: ') + title,
  method, path, role, body, patch, query, expect: 400, expected: R400(what),
  pre: role ? `Signed in as ${role}; all other fields are valid.` : 'No session is required; all other fields are valid.',
});

export const CASES: ApiCase[] = [
  // FE-01 User Registration (public)
  invalid('FE-01', 'Invalid input', 'email format "abc" on registration', null, 'POST', '/api/auth/register', B.register, { email: 'abc' }, 'email'),
  invalid('FE-01', 'Min boundary', 'password of 7 characters (minimum is 8)', null, 'POST', '/api/auth/register', B.register, { password: 'Abc1234' }, 'password'),
  invalid('FE-01', 'Invalid input', 'phone number "091234567" (9 digits)', null, 'POST', '/api/auth/register', B.register, { phone: '091234567' }, 'phone'),
  invalid('FE-01', 'Invalid input', 'registration without full name', null, 'POST', '/api/auth/register', B.register, { fullName: '' }, 'fullName'),
  { fe: 'FE-01', type: 'Business rule', title: 'Enforce business rule: FARMER self-registration without an invitation is rejected', method: 'POST', path: '/api/auth/register', role: null, body: { ...B.register, role: 'FARMER' }, expect: 400, expected: 'The API returns 400 and states that staff accounts must register through a farm invitation.', pre: 'No invitation token is supplied.' },

  // FE-02 Sign in
  invalid('FE-02', 'Invalid input', 'email format on sign in', null, 'POST', '/api/auth/login', { email: 'manager@test.local', password: 'Abcd1234' }, { email: 'not-an-email' }, 'email'),
  invalid('FE-02', 'Invalid input', 'empty password on sign in', null, 'POST', '/api/auth/login', { email: 'manager@test.local', password: 'Abcd1234' }, { password: '' }, 'password'),
  { fe: 'FE-02', type: 'Business rule', title: 'Enforce business rule: sign in with an unregistered email is rejected', method: 'POST', path: '/api/auth/login', role: null, body: { email: 'nobody@test.local', password: 'Abcd1234' }, expect: 401, expected: 'The API returns 401 Unauthorized with an invalid-credentials message; no token is issued.', pre: 'The email is not registered.' },
  invalid('FE-02', 'Invalid input', 'Google sign in without a credential', null, 'POST', '/api/auth/google', { credential: 'token' }, { credential: '' }, 'credential'),

  // FE-03 Sign out & session invalidation
  { fe: 'FE-03', type: 'Business rule', title: 'Enforce business rule: sign out without the CSRF header is rejected', method: 'POST', path: '/api/auth/logout', role: null, expect: 403, expected: 'The API returns 403 Forbidden because the x-ssfm-csrf header is missing; the session is not changed.', pre: 'The request carries neither a refresh token in the body nor the CSRF header.' },
  { fe: 'FE-03', type: 'Unauthenticated', title: 'Reject unauthenticated request signed with a forged token', method: 'GET', path: '/api/auth/me', role: 'FARM_MANAGER', token: 'invalid-signature', expect: 401, expected: R401, pre: 'The access token is signed with a wrong secret.' },
  { fe: 'FE-03', type: 'Unauthenticated', title: 'Reject unauthenticated request with an expired access token', method: 'GET', path: '/api/auth/me', role: 'FARM_MANAGER', token: 'expired', expect: 401, expected: R401, pre: 'The access token has expired.' },
  { fe: 'FE-03', type: 'Business rule', title: 'Enforce business rule: refresh without a refresh token is rejected', method: 'POST', path: '/api/auth/refresh', role: null, body: { refreshToken: '' }, expect: [400, 401, 403], expected: 'The API rejects the refresh request and no new access token is issued.', pre: 'No refresh cookie or token is sent.' },

  // FE-04 Password reset via OTP
  invalid('FE-04', 'Invalid input', 'email format on forgot password', null, 'POST', '/api/auth/forgot-password', { email: 'manager@test.local' }, { email: 'manager' }, 'email'),
  invalid('FE-04', 'Min boundary', 'OTP with 5 digits (exactly 6 required)', null, 'POST', '/api/auth/reset-password', B.reset, { otp: '12345' }, 'otp'),
  invalid('FE-04', 'Max boundary', 'OTP with 7 digits (exactly 6 required)', null, 'POST', '/api/auth/reset-password', B.reset, { otp: '1234567' }, 'otp'),
  invalid('FE-04', 'Invalid input', 'new password without an uppercase letter', null, 'POST', '/api/auth/reset-password', B.reset, { password: 'abcd1234', confirmPassword: 'abcd1234' }, 'password'),
  unauth('FE-04', 'change password', 'PATCH', '/api/users/password', { currentPassword: 'Abcd1234', newPassword: 'Abcd1234!' }),

  // FE-05 Role-based access control
  forbid('FE-05', 'the user list', 'FARMER', 'GET', '/api/users'),
  forbid('FE-05', 'pond creation', 'TECHNICIAN', 'POST', '/api/ponds', B.pond),
  forbid('FE-05', 'water quality recording', 'FARMER', 'POST', '/api/water-quality', B.wq),
  forbid('FE-05', 'farm creation', 'ADMIN', 'POST', '/api/farms', B.farm),
  unauth('FE-05', 'the current user profile', 'GET', '/api/auth/me'),

  // FE-06 View user list
  unauth('FE-06', 'the user list', 'GET', '/api/users'),
  forbid('FE-06', 'the user list', 'FARM_MANAGER', 'GET', '/api/users'),
  invalid('FE-06', 'Min boundary', 'page size 4 (minimum is 5)', 'ADMIN', 'GET', '/api/users', undefined, undefined, 'pageSize', { pageSize: 4 }),
  invalid('FE-06', 'Max boundary', 'page size 101 (maximum is 100)', 'ADMIN', 'GET', '/api/users', undefined, undefined, 'pageSize', { pageSize: 101 }),
  invalid('FE-06', 'Invalid input', 'role filter "OWNER"', 'ADMIN', 'GET', '/api/users', undefined, undefined, 'role', { role: 'OWNER' }),

  // FE-07 View / update profile
  unauth('FE-07', 'profile update', 'PATCH', '/api/users/profile', B.profile),
  invalid('FE-07', 'Min boundary', 'full name of 2 characters (minimum is 3)', 'FARM_MANAGER', 'PATCH', '/api/users/profile', B.profile, { fullName: 'Ab' }, 'fullName'),
  invalid('FE-07', 'Max boundary', 'full name of 101 characters (maximum is 100)', 'FARM_MANAGER', 'PATCH', '/api/users/profile', B.profile, { fullName: long(101) }, 'fullName'),
  invalid('FE-07', 'Invalid input', 'phone number "12345"', 'FARM_MANAGER', 'PATCH', '/api/users/profile', B.profile, { phone: '12345' }, 'phone'),
  invalid('FE-07', 'Max boundary', 'address of 101 characters (maximum is 100)', 'FARM_MANAGER', 'PATCH', '/api/users/profile', B.profile, { address: long(101) }, 'address'),

  // FE-08 Create user account (Admin)
  unauth('FE-08', 'user creation', 'POST', '/api/users', B.user),
  forbid('FE-08', 'user creation', 'FARM_MANAGER', 'POST', '/api/users', B.user),
  invalid('FE-08', 'Invalid input', 'role "SUPERUSER"', 'ADMIN', 'POST', '/api/users', B.user, { role: 'SUPERUSER' }, 'role'),
  invalid('FE-08', 'Min boundary', 'password of 7 characters (minimum is 8)', 'ADMIN', 'POST', '/api/users', B.user, { password: 'Abc1234' }, 'password'),
  invalid('FE-08', 'Invalid input', 'email format "staff@"', 'ADMIN', 'POST', '/api/users', B.user, { email: 'staff@' }, 'email'),

  // FE-09 Lock / unlock account
  unauth('FE-09', 'account lock', 'PATCH', `/api/users/${ID}/status`, { isActive: false }),
  forbid('FE-09', 'account lock', 'FARM_MANAGER', 'PATCH', `/api/users/${ID}/status`, { isActive: false }),
  invalid('FE-09', 'Invalid input', 'lock status value "yes"', 'ADMIN', 'PATCH', `/api/users/${USERS.FARMER.id}/status`, { isActive: false }, { isActive: 'yes' }, 'isActive'),
  notFound('FE-09', 'locking a user that does not exist', 'ADMIN', 'PATCH', `/api/users/${ID}/status`, { isActive: false }, true),

  // FE-10 View farm list
  unauth('FE-10', 'the farm list', 'GET', '/api/farms'),
  forbid('FE-10', '"my farms" list', 'FARMER', 'GET', '/api/farms/my'),
  notFound('FE-10', 'a farm id that does not exist', 'FARM_MANAGER', 'GET', `/api/farms/${ID}`),

  // FE-11 Farm CRUD
  unauth('FE-11', 'farm creation', 'POST', '/api/farms', B.farm),
  forbid('FE-11', 'farm creation', 'TECHNICIAN', 'POST', '/api/farms', B.farm),
  invalid('FE-11', 'Min boundary', 'farm area 0 (minimum is 1 m²)', 'FARM_MANAGER', 'POST', '/api/farms', B.farm, { area: 0 }, 'area'),
  invalid('FE-11', 'Invalid input', 'farm without a name', 'FARM_MANAGER', 'POST', '/api/farms', B.farm, { name: '' }, 'name'),
  invalid('FE-11', 'Invalid input', 'farm status "CLOSED"', 'FARM_MANAGER', 'POST', '/api/farms', B.farm, { status: 'CLOSED' }, 'status'),
  notFound('FE-11', 'updating a farm that does not exist', 'FARM_MANAGER', 'PUT', `/api/farms/${ID}`, B.farm),

  // FE-12 Farm staff
  unauth('FE-12', 'staff assignment', 'POST', `/api/farms/${ID}/staff`, { userId: USERS.TECHNICIAN.id }),
  forbid('FE-12', 'staff assignment', 'FARMER', 'POST', `/api/farms/${ID}/staff`, { userId: USERS.TECHNICIAN.id }),
  forbid('FE-12', 'staff removal', 'TECHNICIAN', 'DELETE', `/api/farms/${ID}/staff/${USERS.FARMER.id}`),
  invalid('FE-12', 'Invalid input', 'staff role "OWNER"', 'FARM_MANAGER', 'POST', '/api/farm-staffs', B.staff, { role: 'OWNER' }, 'role'),
  notFound('FE-12', 'the staff list of a farm that does not exist', 'FARM_MANAGER', 'GET', `/api/farms/${ID}/staff`),

  // FE-13 View pond list
  unauth('FE-13', 'the pond list', 'GET', '/api/ponds'),
  notFound('FE-13', 'a pond id that does not exist', 'FARM_MANAGER', 'GET', `/api/ponds/${ID}`),

  // FE-14 Pond CRUD
  unauth('FE-14', 'pond creation', 'POST', '/api/ponds', B.pond),
  forbid('FE-14', 'pond creation', 'FARMER', 'POST', '/api/ponds', B.pond),
  invalid('FE-14', 'Min boundary', 'pond area 0.5 m² (minimum is 1)', 'FARM_MANAGER', 'POST', '/api/ponds', B.pond, { areaSize: 0.5 }, 'areaSize'),
  invalid('FE-14', 'Min boundary', 'pond depth 0.05 m (minimum is 0.1)', 'FARM_MANAGER', 'POST', '/api/ponds', B.pond, { depth: 0.05 }, 'depth'),
  invalid('FE-14', 'Invalid input', 'pond without a name', 'FARM_MANAGER', 'POST', '/api/ponds', B.pond, { name: '' }, 'name'),
  notFound('FE-14', 'updating a pond that does not exist', 'FARM_MANAGER', 'PUT', `/api/ponds/${ID}`, B.pond),
  forbid('FE-14', 'pond deletion', 'TECHNICIAN', 'DELETE', `/api/ponds/${ID}`),

  // FE-15 Assign crop & pond status
  unauth('FE-15', 'the pond overview', 'GET', '/api/ponds/overview'),
  forbid('FE-15', 'crop assignment', 'TECHNICIAN', 'POST', '/api/crops', B.crop),
  invalid('FE-15', 'Invalid input', 'stocking start date "2026-13-45"', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { startDate: '2026-13-45' }, 'startDate'),

  // FE-16 Crop CRUD
  unauth('FE-16', 'the crop list', 'GET', '/api/crops'),
  invalid('FE-16', 'Max boundary', 'target survival rate 101% (maximum is 100)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { targetSurvivalRate: 101 }, 'targetSurvivalRate'),
  invalid('FE-16', 'Min boundary', 'target harvest size 0.5 pcs/kg (minimum is 1)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { targetHarvestSize: 0.5 }, 'targetHarvestSize'),
  notFound('FE-16', 'a crop id that does not exist', 'FARM_MANAGER', 'GET', `/api/crops/${ID}`),
  forbid('FE-16', 'crop deletion', 'TECHNICIAN', 'DELETE', `/api/crops/${ID}`),

  // FE-17 Stocking information
  unauth('FE-17', 'crop update', 'PUT', `/api/crops/${ID}`, { initialShrimpCount: 100000 }),
  invalid('FE-17', 'Invalid input', 'culture stage "SEED"', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { stage: 'SEED' }, 'stage'),
  invalid('FE-17', 'Min boundary', 'expected duration 0 days (minimum is 1)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { expectedDurationDays: 0 }, 'expectedDurationDays'),
  invalid('FE-17', 'Invalid input', 'stocking count 1000.5 (must be an integer)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { initialShrimpCount: 1000.5 }, 'initialShrimpCount'),
  invalid('FE-17', 'Min boundary', 'seed unit price -1 (minimum is 0)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { seedUnitPrice: -1 }, 'seedUnitPrice'),

  // FE-18 Split & transfer
  unauth('FE-18', 'crop split', 'POST', `/api/crops/${ID}/split`, B.split),
  forbid('FE-18', 'crop split', 'TECHNICIAN', 'POST', `/api/crops/${ID}/split`, B.split),
  invalid('FE-18', 'Min boundary', 'split with no destination pond (minimum is 1)', 'FARM_MANAGER', 'POST', `/api/crops/${ID}/split`, B.split, { destinations: [] }, 'destinations'),
  invalid('FE-18', 'Min boundary', 'nursery harvest count 0 (minimum is 1)', 'FARM_MANAGER', 'POST', `/api/crops/${ID}/split`, B.split, { actualNurseryHarvest: 0 }, 'actualNurseryHarvest'),
  notFound('FE-18', 'splitting a crop that does not exist', 'FARM_MANAGER', 'POST', `/api/crops/${ID}/split`, B.split),

  // FE-19 Harvest & financial summary
  unauth('FE-19', 'crop harvest', 'PATCH', `/api/crops/${ID}/harvest`, B.harvest),
  forbid('FE-19', 'crop harvest', 'FARMER', 'PATCH', `/api/crops/${ID}/harvest`, B.harvest),
  notFound('FE-19', 'harvesting a crop that does not exist', 'FARM_MANAGER', 'PATCH', `/api/crops/${ID}/harvest`, B.harvest),
  invalid('FE-19', 'Min boundary', 'harvest size 0.5 pcs/kg (minimum is 1)', 'FARM_MANAGER', 'PATCH', `/api/crops/${ID}/harvest`, B.harvest, { actualHarvestSize: 0.5 }, 'actualHarvestSize'),
  invalid('FE-19', 'Max boundary', 'harvest note of 1001 characters (maximum is 1000)', 'FARM_MANAGER', 'PATCH', `/api/crops/${ID}/harvest`, B.harvest, { harvestNote: long(1001) }, 'harvestNote'),

  // FE-20 Crop lifecycle history
  unauth('FE-20', 'the crop detailed report', 'GET', `/api/crops/${ID}/detailed-report`),
  notFound('FE-20', 'the detailed report of a crop that does not exist', 'FARM_MANAGER', 'GET', `/api/crops/${ID}/detailed-report`),
  forbid('FE-20', 'the harvest summary', 'TECHNICIAN', 'GET', `/api/crops/${ID}/harvest-summary`),

  // FE-21 Daily feed consumption
  unauth('FE-21', 'feeding log submission', 'POST', '/api/feeding-logs', B.feeding),
  forbid('FE-21', 'feeding log submission', 'TECHNICIAN', 'POST', '/api/feeding-logs', B.feeding),
  invalid('FE-21', 'Invalid input', 'feeding session "SESSION_8"', 'FARMER', 'POST', '/api/feeding-logs', B.feeding, { sessions: [{ ...B.feeding.sessions[0], feedingSession: 'SESSION_8' }] }, 'feedingSession'),
  invalid('FE-21', 'Min boundary', 'daily log with no feeding session (minimum is 1)', 'FARMER', 'POST', '/api/feeding-logs', B.feeding, { sessions: [] }, 'sessions'),
  invalid('FE-21', 'Max boundary', 'daily log with 8 feeding sessions (maximum is 7)', 'FARMER', 'POST', '/api/feeding-logs', B.feeding, { sessions: Array.from({ length: 8 }, (_, i) => ({ ...B.feeding.sessions[0], feedingSession: `SESSION_${(i % 7) + 1}` })) }, 'sessions'),
  invalid('FE-21', 'Invalid input', 'feeding method "HAND"', 'FARMER', 'POST', '/api/feeding-logs', B.feeding, { sessions: [{ ...B.feeding.sessions[0], feedingMethod: 'HAND' }] }, 'feedingMethod'),

  // FE-22 Mortality
  unauth('FE-22', 'mortality logging', 'POST', '/api/mortality-logs', B.mortality),
  forbid('FE-22', 'mortality logging', 'ADMIN', 'POST', '/api/mortality-logs', B.mortality),
  invalid('FE-22', 'Min boundary', 'dead count 0 (minimum is 1)', 'FARMER', 'POST', '/api/mortality-logs', B.mortality, { deadQuantityPcs: 0 }, 'deadQuantityPcs'),
  invalid('FE-22', 'Invalid input', 'recorded date "yesterday"', 'FARMER', 'POST', '/api/mortality-logs', B.mortality, { recordedDate: 'yesterday' }, 'recordedDate'),
  notFound('FE-22', 'logging mortality for a crop that does not exist', 'FARMER', 'POST', '/api/mortality-logs', B.mortality),

  // FE-23 Shrimp health
  unauth('FE-23', 'shrimp health recording', 'POST', '/api/shrimp-health', B.health),
  forbid('FE-23', 'shrimp health recording', 'FARM_MANAGER', 'POST', '/api/shrimp-health', B.health),
  invalid('FE-23', 'Max boundary', 'affected percentage 101 (maximum is 100)', 'TECHNICIAN', 'POST', '/api/shrimp-health', B.health, { affectedPercentage: 101 }, 'affectedPercentage'),
  invalid('FE-23', 'Min boundary', 'affected percentage -1 (minimum is 0)', 'TECHNICIAN', 'POST', '/api/shrimp-health', B.health, { affectedPercentage: -1 }, 'affectedPercentage'),
  invalid('FE-23', 'Invalid input', 'health status "SICK"', 'TECHNICIAN', 'POST', '/api/shrimp-health', B.health, { healthStatus: 'SICK' }, 'healthStatus'),
  notFound('FE-23', 'a health record that does not exist', 'TECHNICIAN', 'GET', `/api/shrimp-health/${ID}`),

  // FE-24 Daily notes & operational observations
  unauth('FE-24', 'environment observation records', 'POST', '/api/environment', { cropId: ID }),
  forbid('FE-24', 'environment observation records', 'TECHNICIAN', 'POST', '/api/environment', { cropId: ID }),
  invalid('FE-24', 'Max boundary', 'health observation note of 501 characters (maximum is 500)', 'TECHNICIAN', 'POST', '/api/shrimp-health', B.health, { note: long(501) }, 'note'),

  // FE-25 Water quality recording
  unauth('FE-25', 'water quality recording', 'POST', '/api/water-quality', B.wq),
  forbid('FE-25', 'water quality recording', 'ADMIN', 'POST', '/api/water-quality', B.wq),
  invalid('FE-25', 'Max boundary', 'dissolved oxygen 21 mg/L (maximum is 20)', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq, { dissolvedOxygen: 21 }, 'dissolvedOxygen'),
  invalid('FE-25', 'Max boundary', 'alkalinity 301 mg/L (maximum is 300)', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq, { alkalinity: 301 }, 'alkalinity'),
  invalid('FE-25', 'Min boundary', 'NH3 -0.1 mg/L (minimum is 0)', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq, { nh3: -0.1 }, 'nh3'),
  invalid('FE-25', 'Invalid input', 'record time "now"', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq, { recordTime: 'now' }, 'recordTime'),
  notFound('FE-25', 'recording water quality for a pond that does not exist', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq),

  // FE-26 Water quality history
  unauth('FE-26', 'water quality history', 'GET', '/api/water-quality/history'),
  invalid('FE-26', 'Invalid input', 'history start date "abc"', 'FARM_MANAGER', 'GET', '/api/water-quality/history', undefined, undefined, 'fromDate', { fromDate: 'abc' }),
  invalid('FE-26', 'Invalid input', 'history sort order "up"', 'FARM_MANAGER', 'GET', '/api/water-quality/history', undefined, undefined, 'sort', { sort: 'up' }),

  // FE-27 Water quality trends
  unauth('FE-27', 'water quality trends', 'GET', '/api/water-quality/manager-trends'),
  forbid('FE-27', 'farm-wide water trends', 'TECHNICIAN', 'GET', '/api/water-quality/manager-trends'),
  invalid('FE-27', 'Min boundary', 'trend window 0 days (minimum is 1)', 'FARM_MANAGER', 'GET', '/api/water-quality/manager-trends', undefined, undefined, 'days', { days: 0 }),
  invalid('FE-27', 'Max boundary', 'trend window 32 days (maximum is 31)', 'FARM_MANAGER', 'GET', '/api/water-quality/manager-trends', undefined, undefined, 'days', { days: 32 }),
  invalid('FE-27', 'Invalid input', 'farm id "abc" (UUID required)', 'FARM_MANAGER', 'GET', '/api/water-quality/manager-trends', undefined, undefined, 'farmId', { farmId: 'abc' }),

  // FE-28 Inventory list
  unauth('FE-28', 'the inventory list', 'GET', '/api/inventory'),
  notFound('FE-28', 'an inventory item that does not exist', 'FARM_MANAGER', 'GET', `/api/inventory/${ID}`),

  // FE-29 Inventory CRUD & thresholds
  unauth('FE-29', 'inventory item creation', 'POST', '/api/inventory', B.inventory),
  forbid('FE-29', 'inventory item creation', 'FARMER', 'POST', '/api/inventory', B.inventory),
  invalid('FE-29', 'Invalid input', 'inventory category "FOOD"', 'FARM_MANAGER', 'POST', '/api/inventory', B.inventory, { category: 'FOOD' }, 'category'),
  invalid('FE-29', 'Min boundary', 'low-stock threshold -1 (minimum is 0)', 'FARM_MANAGER', 'POST', '/api/inventory', B.inventory, { minThreshold: -1 }, 'minThreshold'),
  notFound('FE-29', 'updating an inventory item that does not exist', 'FARM_MANAGER', 'PUT', `/api/inventory/${ID}`, B.inventory),
  forbid('FE-29', 'inventory item deletion', 'TECHNICIAN', 'DELETE', `/api/inventory/${ID}`),

  // FE-30 Inventory usage
  unauth('FE-30', 'inventory usage recording', 'POST', `/api/inventory/${ID}/usage`, B.usage),
  forbid('FE-30', 'inventory usage recording', 'ADMIN', 'POST', `/api/inventory/${ID}/usage`, B.usage),
  invalid('FE-30', 'Min boundary', 'usage quantity 0 (minimum is 0.01)', 'FARM_MANAGER', 'POST', `/api/inventory/${ID}/usage`, B.usage, { quantityUsed: 0 }, 'quantityUsed'),
  notFound('FE-30', 'recording usage of an item that does not exist', 'FARM_MANAGER', 'POST', `/api/inventory/${ID}/usage`, B.usage),
  unauth('FE-30', 'inventory usage history', 'GET', '/api/inventory/usage-logs'),

  // FE-31 Suppliers
  unauth('FE-31', 'supplier creation', 'POST', '/api/suppliers', B.supplier),
  forbid('FE-31', 'supplier creation', 'TECHNICIAN', 'POST', '/api/suppliers', B.supplier),
  invalid('FE-31', 'Invalid input', 'supplier email "sales@"', 'FARM_MANAGER', 'POST', '/api/suppliers', B.supplier, { email: 'sales@' }, 'email'),
  invalid('FE-31', 'Max boundary', 'supplier phone of 11 digits (maximum is 10)', 'FARM_MANAGER', 'POST', '/api/suppliers', B.supplier, { phone: '09123456789' }, 'phone'),
  notFound('FE-31', 'updating a supplier that does not exist', 'FARM_MANAGER', 'PUT', `/api/suppliers/${ID}`, { name: 'ABC Feed Co.' }),

  // FE-32 Sampling & shrimp size
  unauth('FE-32', 'size sampling', 'POST', `/api/ponds/${ID}/size-samples`, B.sample),
  forbid('FE-32', 'size sampling', 'FARMER', 'POST', `/api/ponds/${ID}/size-samples`, B.sample),
  invalid('FE-32', 'Min boundary', 'sample with 4 cast-net throws (exactly 5 required)', 'TECHNICIAN', 'POST', `/api/ponds/${ID}/size-samples`, B.sample, { casts: B.sample.casts.slice(0, 4) }, 'casts'),
  invalid('FE-32', 'Max boundary', 'sample with 6 cast-net throws (exactly 5 required)', 'TECHNICIAN', 'POST', `/api/ponds/${ID}/size-samples`, B.sample, { casts: [...B.sample.casts, { count: 20, weightGram: 150 }] }, 'casts'),
  invalid('FE-32', 'Invalid input', 'sample weight -150 g (must be positive)', 'TECHNICIAN', 'POST', `/api/ponds/${ID}/size-samples`, B.sample, { casts: [{ count: 20, weightGram: -150 }, ...B.sample.casts.slice(1)] }, 'weightGram'),
  notFound('FE-32', 'sampling a pond that does not exist', 'TECHNICIAN', 'POST', `/api/ponds/${ID}/size-samples`, B.sample),

  // FE-33 Biomass via cast-net
  invalid('FE-33', 'Invalid input', 'cast-net area 0 m² (must be positive)', 'TECHNICIAN', 'POST', `/api/ponds/${ID}/size-samples`, B.sample, { netAreaSqM: 0 }, 'netAreaSqM'),
  unauth('FE-33', 'the latest biomass sample', 'GET', `/api/ponds/${ID}/size-samples/latest`),
  forbid('FE-33', 'deleting a size sample', 'FARMER', 'DELETE', `/api/ponds/${ID}/size-samples/${ID}`),
  notFound('FE-33', 'the latest sample of a pond that does not exist', 'FARM_MANAGER', 'GET', `/api/ponds/${ID}/size-samples/latest`),

  // FE-34 Survival rate
  unauth('FE-34', 'the survival rate', 'GET', `/api/survival-rate/crop/${ID}`),
  notFound('FE-34', 'the survival rate of a crop that does not exist', 'FARM_MANAGER', 'GET', `/api/survival-rate/crop/${ID}`),
  forbid('FE-34', 'harvest count update', 'TECHNICIAN', 'PATCH', `/api/survival-rate/crop/${ID}/harvest`, { actualHarvestCount: 80000 }),
  invalid('FE-34', 'Min boundary', 'harvest size 0.05 pcs/kg (minimum is 0.1)', 'FARM_MANAGER', 'PATCH', `/api/survival-rate/crop/${ID}/harvest`, { actualHarvestCount: 80000 }, { actualHarvestSize: 0.05 }, 'actualHarvestSize'),
  invalid('FE-34', 'Min boundary', 'harvest count -1 (minimum is 0)', 'FARM_MANAGER', 'PATCH', `/api/survival-rate/crop/${ID}/harvest`, { actualHarvestCount: 80000 }, { actualHarvestCount: -1 }, 'actualHarvestCount'),

  // FE-35 FCR
  unauth('FE-35', 'FCR analysis', 'GET', `/api/ponds/${ID}/size-samples/fcr`),
  notFound('FE-35', 'FCR analysis of a pond that does not exist', 'FARM_MANAGER', 'GET', `/api/ponds/${ID}/size-samples/fcr`),

  // FE-36 Growth curve
  unauth('FE-36', 'the growth trajectory', 'GET', '/api/crops/analytics/growth-trajectory'),
  invalid('FE-36', 'Min boundary', 'growth milestone on day 0 (minimum is 1)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { growthMilestones: [{ day: 0, weight: 5 }] }, 'growthMilestones.day'),
  invalid('FE-36', 'Min boundary', 'growth milestone weight 0 g (minimum is 0.01)', 'FARM_MANAGER', 'POST', '/api/crops', B.crop, { growthMilestones: [{ day: 30, weight: 0 }] }, 'growthMilestones.weight'),

  // FE-37 Feeding recommendations — covered by the baseline functional cases only.

  // FE-38 Water quality alerts
  unauth('FE-38', 'system alerts', 'GET', '/api/admin/alerts'),
  forbid('FE-38', 'system alerts', 'FARM_MANAGER', 'GET', '/api/admin/alerts'),
  invalid('FE-38', 'Min boundary', 'pH 4.9 (minimum is 5)', 'TECHNICIAN', 'POST', '/api/water-quality', B.wq, { ph: 4.9 }, 'ph'),

  // FE-39 Weather monitoring
  unauth('FE-39', 'weather data', 'GET', '/api/weather'),

  // FE-40 Weather risk warnings
  unauth('FE-40', 'weather risk alert synchronisation', 'GET', '/api/weather/sync-alerts'),

  // FE-41 Warning history
  unauth('FE-41', 'the notification history', 'GET', '/api/notifications'),
  unauth('FE-41', 'the unread warning count', 'GET', '/api/notifications/unread-count'),

  // FE-42 Incident creation & assignment
  unauth('FE-42', 'incident creation', 'POST', '/api/incidents', B.incident),
  forbid('FE-42', 'incident creation', 'ADMIN', 'POST', '/api/incidents', B.incident),
  invalid('FE-42', 'Max boundary', 'incident title of 201 characters (maximum is 200)', 'FARMER', 'POST', '/api/incidents', B.incident, { title: long(201) }, 'title'),
  invalid('FE-42', 'Max boundary', 'incident description of 2001 characters (maximum is 2000)', 'FARMER', 'POST', '/api/incidents', B.incident, { description: long(2001) }, 'description'),
  invalid('FE-42', 'Invalid input', 'crop id "abc" (UUID required)', 'FARMER', 'POST', '/api/incidents', B.incident, { cropId: 'abc' }, 'cropId'),
  forbid('FE-42', 'technician assignment', 'TECHNICIAN', 'PATCH', `/api/incidents/${ID}/assignment`, { assignedToId: USERS.TECHNICIAN.id }),
  invalid('FE-42', 'Invalid input', 'assignee id "abc" (UUID required)', 'FARM_MANAGER', 'PATCH', `/api/incidents/${ID}/assignment`, { assignedToId: USERS.TECHNICIAN.id }, { assignedToId: 'abc' }, 'assignedToId'),
  notFound('FE-42', 'assigning an incident that does not exist', 'FARM_MANAGER', 'PATCH', `/api/incidents/${ID}/assignment`, { assignedToId: USERS.TECHNICIAN.id }),

  // FE-43 Treatment timeline
  unauth('FE-43', 'treatment updates', 'POST', `/api/incidents/${ID}/treatment-updates`, B.treatment),
  forbid('FE-43', 'treatment updates', 'ADMIN', 'POST', `/api/incidents/${ID}/treatment-updates`, B.treatment),
  invalid('FE-43', 'Invalid input', 'empty treatment description', 'TECHNICIAN', 'POST', `/api/incidents/${ID}/treatment-updates`, B.treatment, { treatment: '' }, 'treatment'),
  invalid('FE-43', 'Max boundary', 'treatment of 2001 characters (maximum is 2000)', 'TECHNICIAN', 'POST', `/api/incidents/${ID}/treatment-updates`, B.treatment, { treatment: long(2001) }, 'treatment'),
  notFound('FE-43', 'updating treatment of an incident that does not exist', 'TECHNICIAN', 'POST', `/api/incidents/${ID}/treatment-updates`, B.treatment),
  invalid('FE-43', 'Max boundary', 'reopen reason of 1001 characters (maximum is 1000)', 'FARM_MANAGER', 'PATCH', `/api/incidents/${ID}/reopen`, { reason: 'Symptoms returned' }, { reason: long(1001) }, 'reason'),
  forbid('FE-43', 'incident resolution', 'ADMIN', 'PATCH', `/api/incidents/${ID}/resolve`, { treatment: 'Recovered' }),

  // FE-44 AI water quality evaluation
  unauth('FE-44', 'the AI assistant', 'POST', '/api/chatbot/ask', { question: 'Is pH 9.2 dangerous?' }),
  invalid('FE-44', 'Invalid input', 'empty question to the AI assistant', 'TECHNICIAN', 'POST', '/api/chatbot/ask', { question: 'Is pH 9.2 dangerous?' }, { question: '' }, 'question'),

  // FE-45 AI farming advisory
  invalid('FE-45', 'Invalid input', 'unknown field "model" in an advisory request', 'FARMER', 'POST', '/api/chatbot/ask', { question: 'How to treat white feces disease?' }, { model: 'gpt-4' }, 'model'),

  // FE-46 Harvest retrospective review
  unauth('FE-46', 'the manager crop summary', 'GET', '/api/crops/analytics/manager-summary'),
  forbid('FE-46', 'the manager crop summary', 'FARMER', 'GET', '/api/crops/analytics/manager-summary'),

  // FE-47 Technical Q&A
  invalid('FE-47', 'Invalid input', 'question missing from a Q&A request', 'FARMER', 'POST', '/api/chatbot/ask', { question: 'What is a safe DO level?' }, { question: undefined }, 'question'),
  forbid('FE-47', 'the knowledge document list', 'FARMER', 'GET', '/api/chatbot/documents'),

  // FE-48 Knowledge documents
  unauth('FE-48', 'knowledge document upload', 'POST', '/api/chatbot/documents', B.doc),
  forbid('FE-48', 'knowledge document upload', 'FARMER', 'POST', '/api/chatbot/documents', B.doc),
  invalid('FE-48', 'Invalid input', 'document without content', 'FARM_MANAGER', 'POST', '/api/chatbot/documents', B.doc, { content: '' }, 'content'),
  forbid('FE-48', 'knowledge document deletion', 'TECHNICIAN', 'DELETE', `/api/chatbot/documents/${ID}`),
  notFound('FE-48', 'a knowledge document that does not exist', 'FARM_MANAGER', 'GET', `/api/chatbot/documents/${ID}`, undefined, true),
  forbid('FE-48', 'Google Drive synchronisation', 'TECHNICIAN', 'POST', '/api/chatbot/documents/drive/sync'),

  // FE-49 Context-aware consultation & agent actions
  forbid('FE-49', 'AI agent actions', 'TECHNICIAN', 'POST', '/api/chatbot/execute-action', { intent: 'CREATE_POND', data: {} }),
  invalid('FE-49', 'Invalid input', 'AI agent action "DELETE_FARM"', 'FARM_MANAGER', 'POST', '/api/chatbot/execute-action', { intent: 'CREATE_POND', data: {} }, { intent: 'DELETE_FARM' }, 'intent'),
  unauth('FE-49', 'AI agent actions', 'POST', '/api/chatbot/execute-action', { intent: 'CREATE_POND', data: {} }),

  // FE-50 Real-time alert dispatch
  unauth('FE-50', 'the unread notification counter', 'GET', '/api/notifications/unread-count'),

  // FE-51 Notification center
  unauth('FE-51', 'mark all notifications as read', 'PUT', '/api/notifications/read-all'),
  notFound('FE-51', 'marking a notification that does not exist as read', 'FARMER', 'PUT', `/api/notifications/${ID}/read`, undefined, true),
  notFound('FE-51', 'deleting a notification that does not exist', 'FARMER', 'DELETE', `/api/notifications/${ID}`, undefined, true),

  // FE-52 Farm manager dashboard
  unauth('FE-52', 'the farm manager dashboard summary', 'GET', '/api/crops/analytics/manager-summary'),
  forbid('FE-52', 'the farm manager dashboard summary', 'TECHNICIAN', 'GET', '/api/crops/analytics/manager-summary'),

  // FE-53 Technician dashboard
  unauth('FE-53', 'shrimp health history', 'GET', '/api/shrimp-health/history'),

  // FE-54 Farmer dashboard
  unauth('FE-54', 'the feeding log list', 'GET', '/api/feeding-logs'),

  // FE-55 Admin dashboard
  unauth('FE-55', 'admin dashboard statistics', 'GET', '/api/admin/dashboard-stats'),
  forbid('FE-55', 'admin dashboard statistics', 'FARM_MANAGER', 'GET', '/api/admin/dashboard-stats'),
  forbid('FE-55', 'system health metrics', 'TECHNICIAN', 'GET', '/api/admin/system-health'),
  invalid('FE-55', 'Max boundary', 'audit log page size 101 (maximum is 100)', 'ADMIN', 'GET', '/api/admin/audit-logs', undefined, undefined, 'pageSize', { pageSize: 101 }),
  invalid('FE-55', 'Min boundary', 'audit log page 0 (minimum is 1)', 'ADMIN', 'GET', '/api/admin/audit-logs', undefined, undefined, 'page', { page: 0 }),

  // FE-56 Farming performance reports
  unauth('FE-56', 'the administrative report', 'GET', '/api/admin/report'),
  forbid('FE-56', 'the administrative report', 'FARM_MANAGER', 'GET', '/api/admin/report'),

  // FE-57 Export
  unauth('FE-57', 'inventory Excel export', 'GET', `/api/chatbot/export/inventory/${ID}`),
  forbid('FE-57', 'inventory Excel export', 'FARMER', 'GET', `/api/chatbot/export/inventory/${ID}`),
  notFound('FE-57', 'exporting the inventory of a farm that does not exist', 'FARM_MANAGER', 'GET', `/api/chatbot/export/inventory/${ID}`),
];
