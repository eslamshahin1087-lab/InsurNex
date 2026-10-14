import type {
  ClientCorporate,
  ClientIndividual,
  ClientKind,
} from '../client.types';

interface Props {
  type: ClientKind;
  individual?: ClientIndividual;
  corporate?: ClientCorporate;
  onChangeIndividual: (v: ClientIndividual) => void;
  onChangeCorporate: (v: ClientCorporate) => void;
}

export default function Step2BasicInfo({
  type,
  individual,
  corporate,
  onChangeIndividual,
  onChangeCorporate,
}: Props) {
  if (type === 'individual') {
    const i: ClientIndividual = individual || {
      fullName: '',
      nationalId: '',
      dateOfBirth: '',
      gender: 'male',
      maritalStatus: 'single',
      phone: '',
      phoneAlt: '',
      email: '',
      city: '',
      area: '',
      street: '',
      occupation: '',
      employer: '',
      monthlyIncome: 0,
    };

    const set = (patch: Partial<ClientIndividual>) =>
      onChangeIndividual({ ...i, ...patch });

    return (
      <div className="step-content">
        <div className="form-grid">
          <Field label="الاسم الرباعي *" wide>
            <input
              type="text"
              value={i.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              placeholder="محمد أحمد علي حسن"
            />
          </Field>

          <Field label="الرقم القومي * (14 رقم)">
            <input
              type="text"
              inputMode="numeric"
              maxLength={14}
              value={i.nationalId}
              onChange={(e) =>
                set({ nationalId: e.target.value.replace(/\D/g, '') })
              }
              placeholder="00000000000000"
            />
          </Field>

          <Field label="تاريخ الميلاد">
            <input
              type="date"
              value={i.dateOfBirth}
              onChange={(e) => set({ dateOfBirth: e.target.value })}
            />
          </Field>

          <Field label="الجنس">
            <select
              value={i.gender}
              onChange={(e) => set({ gender: e.target.value as 'male' | 'female' })}
            >
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>

          <Field label="الحالة الاجتماعية">
            <select
              value={i.maritalStatus}
              onChange={(e) =>
                set({ maritalStatus: e.target.value as ClientIndividual['maritalStatus'] })
              }
            >
              <option value="single">أعزب</option>
              <option value="married">متزوج</option>
              <option value="divorced">مطلق</option>
              <option value="widowed">أرمل</option>
            </select>
          </Field>

          <Field label="الجوال *">
            <input
              type="tel"
              value={i.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="01xxxxxxxxx"
            />
          </Field>

          <Field label="جوال بديل">
            <input
              type="tel"
              value={i.phoneAlt || ''}
              onChange={(e) => set({ phoneAlt: e.target.value })}
            />
          </Field>

          <Field label="البريد الإلكتروني" wide>
            <input
              type="email"
              value={i.email || ''}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>

          <Field label="المحافظة">
            <input
              type="text"
              value={i.city}
              onChange={(e) => set({ city: e.target.value })}
              placeholder="القاهرة"
            />
          </Field>

          <Field label="المنطقة / الحي">
            <input
              type="text"
              value={i.area}
              onChange={(e) => set({ area: e.target.value })}
              placeholder="مدينة نصر"
            />
          </Field>

          <Field label="الشارع" wide>
            <input
              type="text"
              value={i.street}
              onChange={(e) => set({ street: e.target.value })}
            />
          </Field>

          <Field label="المهنة">
            <input
              type="text"
              value={i.occupation}
              onChange={(e) => set({ occupation: e.target.value })}
            />
          </Field>

          <Field label="جهة العمل">
            <input
              type="text"
              value={i.employer}
              onChange={(e) => set({ employer: e.target.value })}
            />
          </Field>

          <Field label="الدخل الشهري (ج.م)">
            <input
              type="number"
              min={0}
              value={i.monthlyIncome || 0}
              onChange={(e) => set({ monthlyIncome: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </div>
    );
  }

  // Corporate
  const c: ClientCorporate = corporate || {
    companyName: '',
    tradeName: '',
    commercialRegister: '',
    taxCard: '',
    incorporationDate: '',
    primaryActivity: '',
    sector: 'services',
    employeeCount: 0,
    capital: 0,
    authorizedSignatory: '',
    authorizedSignatoryNid: '',
    phone: '',
    email: '',
    website: '',
    city: '',
    area: '',
    street: '',
    hasBranches: false,
    existingInsurances: [],
  };

  const set = (patch: Partial<ClientCorporate>) =>
    onChangeCorporate({ ...c, ...patch });

  return (
    <div className="step-content">
      <div className="form-grid">
        <Field label="اسم الشركة *" wide>
          <input
            type="text"
            value={c.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
            placeholder="شركة النور للتجارة"
          />
        </Field>

        <Field label="الاسم التجاري">
          <input
            type="text"
            value={c.tradeName || ''}
            onChange={(e) => set({ tradeName: e.target.value })}
          />
        </Field>

        <Field label="السجل التجاري *">
          <input
            type="text"
            value={c.commercialRegister}
            onChange={(e) => set({ commercialRegister: e.target.value })}
          />
        </Field>

        <Field label="البطاقة الضريبية *">
          <input
            type="text"
            value={c.taxCard}
            onChange={(e) => set({ taxCard: e.target.value })}
          />
        </Field>

        <Field label="تاريخ التأسيس">
          <input
            type="date"
            value={c.incorporationDate}
            onChange={(e) => set({ incorporationDate: e.target.value })}
          />
        </Field>

        <Field label="النشاط الرئيسي">
          <input
            type="text"
            value={c.primaryActivity}
            onChange={(e) => set({ primaryActivity: e.target.value })}
          />
        </Field>

        <Field label="القطاع">
          <select
            value={c.sector}
            onChange={(e) =>
              set({ sector: e.target.value as ClientCorporate['sector'] })
            }
          >
            <option value="industrial">صناعي</option>
            <option value="trading">تجاري</option>
            <option value="services">خدمي</option>
            <option value="technology">تكنولوجيا</option>
          </select>
        </Field>

        <Field label="عدد الموظفين *">
          <input
            type="number"
            min={0}
            value={c.employeeCount || 0}
            onChange={(e) => set({ employeeCount: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="رأس المال (ج.م)">
          <input
            type="number"
            min={0}
            value={c.capital || 0}
            onChange={(e) => set({ capital: Number(e.target.value) || 0 })}
          />
        </Field>

        <Field label="المفوض بالتوقيع">
          <input
            type="text"
            value={c.authorizedSignatory}
            onChange={(e) => set({ authorizedSignatory: e.target.value })}
          />
        </Field>

        <Field label="الرقم القومي للمفوض">
          <input
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={c.authorizedSignatoryNid}
            onChange={(e) =>
              set({
                authorizedSignatoryNid: e.target.value.replace(/\D/g, ''),
              })
            }
          />
        </Field>

        <Field label="جوال الشركة *">
          <input
            type="tel"
            value={c.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </Field>

        <Field label="بريد الشركة">
          <input
            type="email"
            value={c.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>

        <Field label="الموقع الإلكتروني" wide>
          <input
            type="url"
            value={c.website || ''}
            onChange={(e) => set({ website: e.target.value })}
            placeholder="https://"
          />
        </Field>

        <Field label="المحافظة">
          <input
            type="text"
            value={c.city}
            onChange={(e) => set({ city: e.target.value })}
          />
        </Field>

        <Field label="المنطقة">
          <input
            type="text"
            value={c.area}
            onChange={(e) => set({ area: e.target.value })}
          />
        </Field>

        <Field label="الشارع" wide>
          <input
            type="text"
            value={c.street}
            onChange={(e) => set({ street: e.target.value })}
          />
        </Field>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={c.hasBranches}
          onChange={(e) => set({ hasBranches: e.target.checked })}
        />
        <span>لدى الشركة فروع أخرى</span>
      </label>
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