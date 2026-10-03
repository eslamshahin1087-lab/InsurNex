import { Home, LogOut, MoreHorizontal, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { signOut } from '../features/auth/auth.service';
import { useAuth } from '../features/auth/auth-context';
const items = [['/','الرئيسية',Home],['/clients','CRM',Users],['/policies','الوثائق',ShieldCheck],['/renewals','التجديدات',RefreshCcw]] as const;
export default function AppLayout(){const {profile}=useAuth();return <div className="mobile-shell" dir="rtl"><header className="app-header"><img src="/branding/insurnex-brand.png" alt="InsurNex"/><div className="app-user"><strong>{profile?.displayName||'InsurNex'}</strong><small>{profile?.role==='owner'?'مالك المؤسسة':profile?.role||'Workspace'}</small></div><button className="circle-button" onClick={()=>void signOut()} aria-label="تسجيل الخروج"><LogOut size={18}/></button></header><div className="app-body"><Outlet/></div><nav className="app-tabbar">{items.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' }><Icon size={22}/><span>{label}</span></NavLink>)}<NavLink to="/more"><MoreHorizontal size={23}/><span>المزيد</span></NavLink></nav></div>}
