import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from './ThemeProvider';

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'تلقائي', Icon: Laptop },
  { value: 'light', label: 'فاتح', Icon: Sun },
  { value: 'dark', label: 'داكن', Icon: Moon },
];

export default function ThemeSettings() {
  const { mode, setMode } = useTheme();
  return <section className="theme-settings" dir="rtl">
    <h3>المظهر</h3>
    <p>اختر مظهر InsurNex أو اجعله يتبع إعداد الجهاز.</p>
    <div className="theme-options">
      {options.map(({ value, label, Icon }) => (
        <button key={value} type="button" className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  </section>;
}
