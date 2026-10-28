import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  createExtendedClient,
  saveClientAiAnalysis,
} from '../features/clients/client.service';
import Step1TypeSelector from '../features/clients/components/Step1TypeSelector';
import Step2BasicInfo from '../features/clients/components/Step2BasicInfo';
import Step3Needs from '../features/clients/components/Step3Needs';
import Step4RiskData from '../features/clients/components/Step4RiskData';
import Step5Documents from '../features/clients/components/Step5Documents';
import Step6Review from '../features/clients/components/Step6Review';
import AiAnalysisChatBox from '../features/clients/components/AiAnalysisChatBox';
import type {
  ClientDocument,
  ClientRiskData,
  ClientWizardInput,
  InsuranceNeed,
} from '../features/clients/client.types';
import { assessRisk } from '../features/clients/risk-assessment.service';
import { uploadClientDocumentsAtomic, type PendingClientDocument } from '../features/operations/operations-document.service';
import '../theme/client-wizard.css';

const STEP_LABELS = [
  'النوع',
  'البيانات',
  'الاحتياجات',
  'المخاطر',
  'المستندات',
  'المراجعة',
];

const emptyInput: ClientWizardInput = {
  type: 'individual',
  needs: [],
  riskData: {},
  documents: [],
  preferences: {
    contactMethod: 'whatsapp',
    bestTime: 'morning',
    whatsappOptIn: true,
  },
  tags: [],
};

export default function ClientWizardPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ClientWizardInput>(emptyInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [created, setCreated] = useState<{
    id: string;
    code: string;
    clientName: string;
  } | null>(null);

  const update = useCallback((patch: Partial<ClientWizardInput>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleNeed = useCallback((need: InsuranceNeed) => {
    setData((prev) => ({
      ...prev,
      needs: prev.needs.includes(need)
        ? prev.needs.filter((n) => n !== need)
        : [...prev.needs, need],
    }));
  }, []);

  const addDocument = useCallback((doc: ClientDocument) => {
    setData((prev) => ({ ...prev, documents: [...prev.documents, doc] }));
  }, []);

  const removeDocument = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }));
  }, []);

  const canProceed = useMemo(() => {
    if (step === 0) return !!data.type;
    if (step === 1) {
      if (data.type === 'individual') {
        const i = data.individual;
        return !!(i?.fullName && i?.nationalId && i?.phone);
      }
      const c = data.corporate;
      return !!(
        c?.companyName &&
        c?.commercialRegister &&
        c?.taxCard &&
        c?.phone
      );
    }
    if (step === 2) return data.needs.length > 0;
    if (step === 3) return true;
    if (step === 4) return data.documents.length > 0;
    return true;
  }, [step, data]);

  const riskPreview = useMemo(() => assessRisk(data), [data]);

  async function handleCreate() {
    if (!user || !profile) return;
    const orgId = profile.organizationId;
    if (!orgId) {
      setError('حسابك غير مربوط بمؤسسة.');
      return;
    }

    setSaving(true);
    setError('');
    setUploadWarning('');
    try {
      const clientName =
        data.type === 'individual'
          ? data.individual?.fullName || 'عميل'
          : data.corporate?.companyName || 'شركة';

      // Never serialize the in-memory File or a temporary URL into the client record.
      const safeDocuments: ClientDocument[] = data.documents.map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
        url: '',
        fileName: item.fileName,
        mimeType: item.mimeType,
        size: item.size,
        uploadedAt: item.uploadedAt,
        verified: item.verified,
        ...(item.verifiedBy ? { verifiedBy: item.verifiedBy } : {}),
      }));
      const res = await createExtendedClient(
        { ...data, documents: safeDocuments },
        orgId,
        user.uid,
      );

      const pendingDocuments: PendingClientDocument[] = data.documents.flatMap((item) => {
        if (!item.pendingFile) return [];
        const isIdentity = /national-id|signatory-id|tax-card|commercial-register|license/.test(item.type);
        return [{
          file: item.pendingFile,
          name: item.label,
          category: isIdentity ? 'identity' : 'other',
          notes: `Wizard document type: ${item.type}`,
        }];
      });

      if (pendingDocuments.length > 0) {
        try {
          const firebaseToken = await user.getIdToken();
          await uploadClientDocumentsAtomic({
            organizationId: orgId,
            clientId: res.id,
            userId: user.uid,
            firebaseToken,
            documents: pendingDocuments,
          });
        } catch (uploadError) {
          console.error('Client was created but staged document upload failed:', uploadError);
          setUploadWarning(
            'تم إنشاء ملف العميل، لكن تعذر رفع مستند أو أكثر. لم تُحذف بيانات العميل. افتح قسم المستندات داخل ملف العميل لإعادة الرفع، ولا تعِد إنشاء العميل.',
          );
        }
      }

      setCreated({ id: res.id, code: res.code, clientName });
    } catch (e) {
      console.error(e);
      setError('تعذر إنشاء العميل: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAiAnalysisReady(aiAnalysis: {
    summary: string;
    recommendations: string[];
    suggestedProducts: Array<{
      productName: string;
      reason: string;
      estimatedPremium: number;
    }>;
    analyzedAt: unknown;
  }) {
    if (!created) return;
    try {
      await saveClientAiAnalysis(created.id, aiAnalysis);
    } catch (e) {
      console.warn('Failed to save AI analysis', e);
    }
  }

  if (created) {
    return (
      <main className="mobile-page wizard-page" dir="rtl">
        <div className="inx-container">
          {uploadWarning && <div className="wizard-error" role="alert">{uploadWarning}</div>}
          <AiAnalysisChatBox
            clientId={created.id}
            clientName={created.clientName}
            clientCode={created.code}
            wizardData={data}
            riskAssessment={riskPreview}
            onAnalysisReady={handleAiAnalysisReady}
            onClose={() => navigate(`/clients/${created.id}`)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-page wizard-page" dir="rtl">
      <div className="inx-container">
        <header className="wizard-head">
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => (step === 0 ? navigate('/clients') : setStep(step - 1))}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="wizard-title">
            <span className="eyebrow">عميل جديد</span>
            <h2>{STEP_LABELS[step]}</h2>
          </div>
          <div className="wizard-progress-text">
            {step + 1} / {STEP_LABELS.length}
          </div>
        </header>

        <div className="wizard-steps">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`wizard-step-dot ${
                i < step ? 'done' : i === step ? 'active' : ''
              }`}
            >
              <span className="dot">
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        <div className="wizard-content">
          {step === 0 && (
            <Step1TypeSelector
              value={data.type}
              onChange={(type) =>
                update({
                  type,
                  individual: undefined,
                  corporate: undefined,
                  needs: [],
                  riskData: {},
                  documents: [],
                })
              }
            />
          )}

          {step === 1 && (
            <Step2BasicInfo
              type={data.type}
              individual={data.individual}
              corporate={data.corporate}
              onChangeIndividual={(v) => update({ individual: v })}
              onChangeCorporate={(v) => update({ corporate: v })}
            />
          )}

          {step === 2 && (
            <Step3Needs
              type={data.type}
              needs={data.needs}
              onToggle={toggleNeed}
            />
          )}

          {step === 3 && (
            <Step4RiskData
              needs={data.needs}
              riskData={data.riskData}
              onChange={(riskData: ClientRiskData) => update({ riskData })}
            />
          )}

          {step === 4 && (
            <Step5Documents
              type={data.type}
              needs={data.needs}
              documents={data.documents}
              organizationId={profile?.organizationId || ''}
              onAdd={addDocument}
              onRemove={removeDocument}
            />
          )}

          {step === 5 && (
            <Step6Review data={data} riskAssessment={riskPreview} />
          )}
        </div>

        {error && <div className="wizard-error">{error}</div>}

        <div className="wizard-footer">
          {step > 0 && (
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => setStep(step - 1)}
              disabled={saving}
            >
              السابق
            </button>
          )}

          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed}
            >
              التالي <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              <Save size={16} /> {saving ? 'جاري الإنشاء...' : 'إنشاء العميل'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}