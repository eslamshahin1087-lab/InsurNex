import type {
  ClientWizardInput,
  RiskAssessment,
  RiskFactor,
} from './client.types';

/**
 * Rule-based risk assessment.
 * Returns a score 0-100 (higher = safer) and a list of contributing factors.
 */
export function assessRisk(input: ClientWizardInput): RiskAssessment {
  const factors: RiskFactor[] = [];

  const addFactor = (
    name: string,
    impact: number,
    severity: RiskFactor['severity'],
  ) => {
    if (impact > 0) factors.push({ name, impact, severity });
  };

  // ============================================================
  // Age / Company Age
  // ============================================================
  if (input.type === 'individual' && input.individual?.dateOfBirth) {
    const age = calcAge(input.individual.dateOfBirth);
    if (age < 25) addFactor('العميل صغير السن (<25)', 15, 'medium');
    else if (age > 60) addFactor('العميل كبير السن (>60)', 20, 'high');
  }

  if (input.type === 'corporate' && input.corporate?.incorporationDate) {
    const years = calcAge(input.corporate.incorporationDate);
    if (years < 2) addFactor('شركة حديثة (< سنتين)', 15, 'medium');
  }

  // ============================================================
  // Health (individual)
  // ============================================================
  if (input.riskData.health) {
    const h = input.riskData.health;
    if (h.smoker) addFactor('مدخن', 15, 'medium');
    if (h.chronicConditions?.length > 0)
      addFactor(`${h.chronicConditions.length} أمراض مزمنة`, 15, 'high');
    if (h.generalStatus === 'poor') addFactor('حالة صحية ضعيفة', 25, 'high');
    else if (h.generalStatus === 'fair') addFactor('حالة صحية متوسطة', 10, 'low');

    const bmi = h.height > 0 ? h.weight / Math.pow(h.height / 100, 2) : 0;
    if (bmi > 35) addFactor('مؤشر كتلة جسم مرتفع', 10, 'medium');
  }

  // ============================================================
  // Motor
  // ============================================================
  if (input.riskData.motor) {
    const m = input.riskData.motor;
    if (m.yearsNoClaims < 1) addFactor('لا يوجد سجل قيادة نظيف', 15, 'medium');
    if (m.lastAccident) {
      const monthsAgo = monthsSince(m.lastAccident);
      if (monthsAgo < 12) addFactor('حادث حديث (< سنة)', 20, 'high');
      else if (monthsAgo < 36) addFactor('حادث سابق', 10, 'medium');
    }
    if (m.annualKm > 30000) addFactor('مسافة سنوية عالية', 10, 'medium');
    if (m.usage === 'commercial') addFactor('استخدام تجاري', 10, 'medium');
  }

  // ============================================================
  // Life
  // ============================================================
  if (input.riskData.life) {
    const l = input.riskData.life;
    if (l.healthStatus === 'poor') addFactor('حالة صحية ضعيفة', 25, 'high');
    if (l.riskyOccupation) addFactor('مهنة عالية الخطورة', 20, 'high');
    if (l.dependents > 3) addFactor('عدد معالين كبير', 5, 'low');
  }

  // ============================================================
  // Corporate
  // ============================================================
  if (input.type === 'corporate' && input.corporate) {
    const c = input.corporate;
    if (c.employeeCount < 5) addFactor('عدد موظفين قليل', 5, 'low');
    if (c.sector === 'industrial') addFactor('قطاع صناعي', 10, 'medium');
  }

  if (input.riskData.business) {
    const b = input.riskData.business;
    if (b.previousClaims > 2) addFactor('مطالبات سابقة كثيرة', 20, 'high');
    else if (b.previousClaims > 0) addFactor('مطالبات سابقة', 10, 'medium');
  }

  if (input.riskData['professional-liability']) {
    const p = input.riskData['professional-liability'];
    if (p.previousDisputes > 1) addFactor('نزاعات قانونية سابقة', 20, 'high');
  }

  if (input.riskData.cyber) {
    const cy = input.riskData.cyber;
    if (!cy.hasBackups) addFactor('لا يوجد نظام نسخ احتياطي', 15, 'high');
    if (cy.previousIncidents > 0)
      addFactor('حوادث أمن سيبراني سابقة', 25, 'high');
  }

  // ============================================================
  // Completeness
  // ============================================================
  const completeness = calculateCompleteness(input);
  if (completeness < 60)
    addFactor('بيانات ناقصة', 15, 'high');
  else if (completeness < 85) addFactor('بيانات غير مكتملة', 5, 'low');

  // ============================================================
  // Score Calculation
  // ============================================================
  const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);
  const score = Math.max(0, Math.min(100, 100 - totalImpact));

  let level: RiskAssessment['level'] = 'low';
  if (score < 50) level = 'high';
  else if (score < 75) level = 'medium';

  return {
    score,
    level,
    factors,
    assessedAt: new Date(),
  };
}

// ============================================================
// Helpers
// ============================================================

function calcAge(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function monthsSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
}

export function calculateCompleteness(input: ClientWizardInput): number {
  let score = 0;
  let total = 0;

  const check = (value: unknown, weight = 1) => {
    total += weight;
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 0 &&
      !(Array.isArray(value) && value.length === 0)
    ) {
      score += weight;
    }
  };

  if (input.type === 'individual' && input.individual) {
    const i = input.individual;
    check(i.fullName, 3);
    check(i.nationalId, 3);
    check(i.dateOfBirth, 2);
    check(i.gender, 1);
    check(i.maritalStatus, 1);
    check(i.phone, 3);
    check(i.email, 1);
    check(i.city, 2);
    check(i.area, 1);
    check(i.street, 1);
    check(i.occupation, 1);
    check(i.employer, 1);
    check(i.monthlyIncome, 2);
  }

  if (input.type === 'corporate' && input.corporate) {
    const c = input.corporate;
    check(c.companyName, 3);
    check(c.commercialRegister, 3);
    check(c.taxCard, 3);
    check(c.incorporationDate, 2);
    check(c.primaryActivity, 2);
    check(c.sector, 1);
    check(c.employeeCount, 2);
    check(c.capital, 2);
    check(c.authorizedSignatory, 2);
    check(c.authorizedSignatoryNid, 2);
    check(c.phone, 2);
    check(c.email, 1);
    check(c.city, 1);
  }

  check(input.needs.length, 3);
  check(Object.keys(input.riskData).length, 3);
  check(input.documents.length, 3);
  check(input.preferences.contactMethod, 1);

  return total > 0 ? Math.round((score / total) * 100) : 0;
}