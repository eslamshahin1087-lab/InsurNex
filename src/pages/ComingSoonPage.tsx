import { useLocation } from 'react-router-dom';
export default function ComingSoonPage(){const path=useLocation().pathname.slice(1);return <main className="dashboard"><section className="panel"><span className="eyebrow">InsurNex Module</span><h1>{path || 'Module'}</h1><p>تم حجز هذا المسار داخل البنية الجديدة وسيتم بناء وظائفه في الـSprint الخاص به.</p></section></main>}
