import type {
  ClientRiskData,
  InsuranceNeed,
} from '../client.types';

interface Props {
  needs: InsuranceNeed[];
  riskData: ClientRiskData;
  onChange: (data: ClientRiskData) => void;
}

export default function Step4RiskData({ needs, riskData, onChange }: Props) {
  const set = <K extends keyof ClientRiskData>(
    key: K,
    value: ClientRiskData[K],
  ) => {
    onChange({ ...riskData, [key]: value });
  };

  if (needs.length === 0) {
    return (
      <div className="step-content">
        <div className="wizard-hint">
          لم تختر أي احتياج. عُد للخطوة السابقة واختر احتياجًا واحدًا على الأقل.
        </div>
      </div>
    );
  }

  return (
    <div className="step-content">
      <p className="step-intro">
        أدخل بيانات المخاطر لكل احتياج. هذه البيانات تُستخدم في تقييم المخاطر
        وفي طلب عروض الأسعار.
      </p>

      {needs.includes('motor') && (
        <section className="risk-section">
          <h3>🚗 بيانات السيارة</h3>
          <div className="form-grid">
            <Field label="الماركة">
              <input
                type="text"
                value={riskData.motor?.vehicleMake || ''}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), vehicleMake: e.target.value })
                }
              />
            </Field>
            <Field label="الموديل">
              <input
                type="text"
                value={riskData.motor?.vehicleModel || ''}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), vehicleModel: e.target.value })
                }
              />
            </Field>
            <Field label="سنة الصنع">
              <input
                type="number"
                min={1980}
                max={2030}
                value={riskData.motor?.vehicleYear || 2020}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), vehicleYear: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="القيمة التقديرية (ج.م)">
              <input
                type="number"
                min={0}
                value={riskData.motor?.estimatedValue || 0}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), estimatedValue: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="الاستخدام">
              <select
                value={riskData.motor?.usage || 'personal'}
                onChange={(e) =>
                  set('motor', {
                    ...(riskData.motor || defaultMotor()),
                    usage: e.target.value as 'personal' | 'commercial',
                  })
                }
              >
                <option value="personal">شخصي</option>
                <option value="commercial">تجاري</option>
              </select>
            </Field>
            <Field label="كم سنويًا">
              <input
                type="number"
                min={0}
                value={riskData.motor?.annualKm || 0}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), annualKm: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="سنوات بدون مطالبات">
              <input
                type="number"
                min={0}
                value={riskData.motor?.yearsNoClaims || 0}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), yearsNoClaims: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="تاريخ آخر حادث">
              <input
                type="date"
                value={riskData.motor?.lastAccident || ''}
                onChange={(e) =>
                  set('motor', { ...(riskData.motor || defaultMotor()), lastAccident: e.target.value })
                }
              />
            </Field>
          </div>
        </section>
      )}

      {needs.includes('health') && (
        <section className="risk-section">
          <h3>🏥 البيانات الصحية</h3>
          <div className="form-grid">
            <Field label="الحالة العامة">
              <select
                value={riskData.health?.generalStatus || 'good'}
                onChange={(e) =>
                  set('health', {
                    ...(riskData.health || defaultHealth()),
                    generalStatus: e.target.value as 'excellent' | 'good' | 'fair' | 'poor',
                  })
                }
              >
                <option value="excellent">ممتازة</option>
                <option value="good">جيدة</option>
                <option value="fair">متوسطة</option>
                <option value="poor">ضعيفة</option>
              </select>
            </Field>
            <Field label="الطول (سم)">
              <input
                type="number"
                value={riskData.health?.height || 0}
                onChange={(e) =>
                  set('health', { ...(riskData.health || defaultHealth()), height: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="الوزن (كجم)">
              <input
                type="number"
                value={riskData.health?.weight || 0}
                onChange={(e) =>
                  set('health', { ...(riskData.health || defaultHealth()), weight: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="تاريخ آخر فحص">
              <input
                type="date"
                value={riskData.health?.lastCheckup || ''}
                onChange={(e) =>
                  set('health', { ...(riskData.health || defaultHealth()), lastCheckup: e.target.value })
                }
              />
            </Field>
            <Field label="الأمراض المزمنة (مفصولة بفواصل)" wide>
              <input
                type="text"
                value={(riskData.health?.chronicConditions || []).join(', ')}
                onChange={(e) =>
                  set('health', {
                    ...(riskData.health || defaultHealth()),
                    chronicConditions: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="سكري، ضغط"
              />
            </Field>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={riskData.health?.smoker || false}
              onChange={(e) =>
                set('health', { ...(riskData.health || defaultHealth()), smoker: e.target.checked })
              }
            />
            <span>مدخن</span>
          </label>
        </section>
      )}

      {needs.includes('life') && (
        <section className="risk-section">
          <h3>👨‍👩‍👧 بيانات تأمين الحياة</h3>
          <div className="form-grid">
            <Field label="عدد المعالين">
              <input
                type="number"
                min={0}
                value={riskData.life?.dependents || 0}
                onChange={(e) =>
                  set('life', { ...(riskData.life || defaultLife()), dependents: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="الحالة الصحية">
              <select
                value={riskData.life?.healthStatus || 'good'}
                onChange={(e) =>
                  set('life', {
                    ...(riskData.life || defaultLife()),
                    healthStatus: e.target.value as 'excellent' | 'good' | 'fair' | 'poor',
                  })
                }
              >
                <option value="excellent">ممتازة</option>
                <option value="good">جيدة</option>
                <option value="fair">متوسطة</option>
                <option value="poor">ضعيفة</option>
              </select>
            </Field>
            <Field label="الراتب السنوي (ج.م)">
              <input
                type="number"
                min={0}
                value={riskData.life?.annualSalary || 0}
                onChange={(e) =>
                  set('life', { ...(riskData.life || defaultLife()), annualSalary: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={riskData.life?.riskyOccupation || false}
              onChange={(e) =>
                set('life', { ...(riskData.life || defaultLife()), riskyOccupation: e.target.checked })
              }
            />
            <span>مهنة عالية الخطورة</span>
          </label>
        </section>
      )}

      {needs.includes('property') && (
        <section className="risk-section">
          <h3>🏠 بيانات العقار</h3>
          <div className="form-grid">
            <Field label="نوع العقار">
              <select
                value={riskData.property?.propertyType || 'apartment'}
                onChange={(e) =>
                  set('property', {
                    ...(riskData.property || defaultProperty()),
                    propertyType: e.target.value as 'apartment' | 'villa' | 'office' | 'warehouse',
                  })
                }
              >
                <option value="apartment">شقة</option>
                <option value="villa">فيلا</option>
                <option value="office">مكتب</option>
                <option value="warehouse">مخزن</option>
              </select>
            </Field>
            <Field label="القيمة (ج.م)">
              <input
                type="number"
                value={riskData.property?.propertyValue || 0}
                onChange={(e) =>
                  set('property', { ...(riskData.property || defaultProperty()), propertyValue: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="سنة البناء">
              <input
                type="number"
                min={1900}
                value={riskData.property?.yearBuilt || 2010}
                onChange={(e) =>
                  set('property', { ...(riskData.property || defaultProperty()), yearBuilt: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="الموقع">
              <input
                type="text"
                value={riskData.property?.location || ''}
                onChange={(e) =>
                  set('property', { ...(riskData.property || defaultProperty()), location: e.target.value })
                }
              />
            </Field>
          </div>
        </section>
      )}

      {needs.includes('business') && (
        <section className="risk-section">
          <h3>🏢 البيانات التجارية</h3>
          <div className="form-grid">
            <Field label="الإيراد السنوي (ج.م)">
              <input
                type="number"
                value={riskData.business?.annualRevenue || 0}
                onChange={(e) =>
                  set('business', { ...(riskData.business || defaultBusiness()), annualRevenue: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="عدد الموظفين">
              <input
                type="number"
                value={riskData.business?.employeesCount || 0}
                onChange={(e) =>
                  set('business', { ...(riskData.business || defaultBusiness()), employeesCount: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="نوع الصناعة">
              <input
                type="text"
                value={riskData.business?.industryType || ''}
                onChange={(e) =>
                  set('business', { ...(riskData.business || defaultBusiness()), industryType: e.target.value })
                }
              />
            </Field>
            <Field label="مطالبات سابقة">
              <input
                type="number"
                min={0}
                value={riskData.business?.previousClaims || 0}
                onChange={(e) =>
                  set('business', { ...(riskData.business || defaultBusiness()), previousClaims: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </section>
      )}

      {needs.includes('professional-liability') && (
        <section className="risk-section">
          <h3>⚖️ المسؤولية المهنية</h3>
          <div className="form-grid">
            <Field label="القطاع">
              <input
                type="text"
                value={riskData['professional-liability']?.sector || ''}
                onChange={(e) =>
                  set('professional-liability', {
                    ...(riskData['professional-liability'] || defaultProf()),
                    sector: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="الإيراد السنوي">
              <input
                type="number"
                value={riskData['professional-liability']?.annualTurnover || 0}
                onChange={(e) =>
                  set('professional-liability', {
                    ...(riskData['professional-liability'] || defaultProf()),
                    annualTurnover: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="عدد العملاء">
              <input
                type="number"
                value={riskData['professional-liability']?.clientsCount || 0}
                onChange={(e) =>
                  set('professional-liability', {
                    ...(riskData['professional-liability'] || defaultProf()),
                    clientsCount: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="نزاعات سابقة">
              <input
                type="number"
                min={0}
                value={riskData['professional-liability']?.previousDisputes || 0}
                onChange={(e) =>
                  set('professional-liability', {
                    ...(riskData['professional-liability'] || defaultProf()),
                    previousDisputes: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </section>
      )}

      {needs.includes('cyber') && (
        <section className="risk-section">
          <h3>🛡️ التأمين السيبراني</h3>
          <div className="form-grid">
            <Field label="الإيراد السنوي">
              <input
                type="number"
                value={riskData.cyber?.annualRevenue || 0}
                onChange={(e) =>
                  set('cyber', { ...(riskData.cyber || defaultCyber()), annualRevenue: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="عدد السجلات">
              <input
                type="number"
                value={riskData.cyber?.dataRecordsCount || 0}
                onChange={(e) =>
                  set('cyber', { ...(riskData.cyber || defaultCyber()), dataRecordsCount: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="حوادث سابقة">
              <input
                type="number"
                min={0}
                value={riskData.cyber?.previousIncidents || 0}
                onChange={(e) =>
                  set('cyber', { ...(riskData.cyber || defaultCyber()), previousIncidents: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={riskData.cyber?.hasBackups || false}
              onChange={(e) =>
                set('cyber', { ...(riskData.cyber || defaultCyber()), hasBackups: e.target.checked })
              }
            />
            <span>يوجد نظام نسخ احتياطي</span>
          </label>
        </section>
      )}

      {needs.includes('equipment') && (
        <section className="risk-section">
          <h3>🏗️ المعدات والآلات</h3>
          <div className="form-grid">
            <Field label="نوع المعدات">
              <input
                type="text"
                value={riskData.equipment?.equipmentType || ''}
                onChange={(e) =>
                  set('equipment', { ...(riskData.equipment || defaultEquipment()), equipmentType: e.target.value })
                }
              />
            </Field>
            <Field label="القيمة الإجمالية">
              <input
                type="number"
                value={riskData.equipment?.totalValue || 0}
                onChange={(e) =>
                  set('equipment', { ...(riskData.equipment || defaultEquipment()), totalValue: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="عدد المعدات">
              <input
                type="number"
                value={riskData.equipment?.equipmentCount || 0}
                onChange={(e) =>
                  set('equipment', { ...(riskData.equipment || defaultEquipment()), equipmentCount: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="سنة الشراء">
              <input
                type="number"
                value={riskData.equipment?.yearPurchased || 2020}
                onChange={(e) =>
                  set('equipment', { ...(riskData.equipment || defaultEquipment()), yearPurchased: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </section>
      )}

      {needs.includes('travel') && (
        <section className="risk-section">
          <h3>✈️ السفر</h3>
          <div className="form-grid">
            <Field label="الوجهات" wide>
              <input
                type="text"
                value={riskData.travel?.destinations || ''}
                onChange={(e) =>
                  set('travel', { ...(riskData.travel || defaultTravel()), destinations: e.target.value })
                }
                placeholder="أوروبا، آسيا"
              />
            </Field>
            <Field label="المدة (يوم)">
              <input
                type="number"
                value={riskData.travel?.duration || 0}
                onChange={(e) =>
                  set('travel', { ...(riskData.travel || defaultTravel()), duration: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="نوع الرحلة">
              <select
                value={riskData.travel?.tripType || 'leisure'}
                onChange={(e) =>
                  set('travel', {
                    ...(riskData.travel || defaultTravel()),
                    tripType: e.target.value as 'leisure' | 'business' | 'study',
                  })
                }
              >
                <option value="leisure">ترفيهية</option>
                <option value="business">عمل</option>
                <option value="study">دراسة</option>
              </select>
            </Field>
            <Field label="عدد المسافرين">
              <input
                type="number"
                value={riskData.travel?.travelersCount || 1}
                onChange={(e) =>
                  set('travel', { ...(riskData.travel || defaultTravel()), travelersCount: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`form-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

// ============================================================
// Defaults
// ============================================================

const defaultMotor = () => ({
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: new Date().getFullYear(),
  estimatedValue: 0,
  usage: 'personal' as const,
  annualKm: 0,
  yearsNoClaims: 0,
});

const defaultHealth = () => ({
  generalStatus: 'good' as const,
  chronicConditions: [],
  medications: '',
  surgeries: '',
  smoker: false,
  height: 0,
  weight: 0,
});

const defaultLife = () => ({
  dependents: 0,
  healthStatus: 'good' as const,
  riskyOccupation: false,
  annualSalary: 0,
  existingLifeInsurance: false,
});

const defaultProperty = () => ({
  propertyType: 'apartment' as const,
  propertyValue: 0,
  yearBuilt: 2010,
  location: '',
  hasSecuritySystem: false,
});

const defaultTravel = () => ({
  destinations: '',
  duration: 0,
  tripType: 'leisure' as const,
  travelersCount: 1,
});

const defaultBusiness = () => ({
  annualRevenue: 0,
  employeesCount: 0,
  industryType: '',
  previousClaims: 0,
});

const defaultProf = () => ({
  sector: '',
  annualTurnover: 0,
  clientsCount: 0,
  previousDisputes: 0,
});

const defaultEquipment = () => ({
  equipmentType: '',
  totalValue: 0,
  equipmentCount: 0,
  yearPurchased: 2020,
});

const defaultCyber = () => ({
  annualRevenue: 0,
  dataRecordsCount: 0,
  hasBackups: false,
  previousIncidents: 0,
});