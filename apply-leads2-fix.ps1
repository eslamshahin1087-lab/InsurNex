param([switch]$Rollback)
$ErrorActionPreference='Stop'
$root=(Get-Location).Path
$backup=Join-Path $root '.insurnex-leads2-fix-backup'
$files=@('src\types\lead.ts','src\pages\NotificationsPage.tsx')
function WriteUtf8([string]$p,[string]$s){$d=Split-Path -Parent $p;if($d-and!(Test-Path $d)){New-Item -ItemType Directory -Force $d|Out-Null};[IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))}
if(!(Test-Path (Join-Path $root 'package.json'))){throw 'Run from InsurNex project root.'}
if($Rollback){if(!(Test-Path $backup)){throw 'Fix backup not found.'};foreach($f in $files){$s=Join-Path $backup $f;$d=Join-Path $root $f;if(Test-Path $s){New-Item -ItemType Directory -Force (Split-Path -Parent $d)|Out-Null;Copy-Item $s $d -Force}else{if(Test-Path $d){Remove-Item $d -Force}}};Write-Host 'Fix rollback complete.' -ForegroundColor Green;exit 0}
if(Test-Path $backup){throw 'Fix backup already exists. Use -Rollback first if reapplying.'}
New-Item -ItemType Directory -Force $backup|Out-Null
foreach($f in $files){$s=Join-Path $root $f;if(Test-Path $s){$d=Join-Path $backup $f;New-Item -ItemType Directory -Force (Split-Path -Parent $d)|Out-Null;Copy-Item $s $d -Force}}
WriteUtf8 (Join-Path $root 'src\types\lead.ts') @'
export type LeadStage='new'|'contacted'|'qualified'|'quotation'|'negotiation'|'won'|'lost';
export type LeadSource='website'|'referral'|'phone'|'email'|'social'|'campaign'|'walk_in'|'existing_client'|'other';
export type LeadPriority='low'|'medium'|'high';
export interface Lead{id:string;organizationId:string;name:string;companyName?:string;phone:string;email:string;source:LeadSource;priority:LeadPriority;stage:LeadStage;insuranceType:string;preferredInsurerId?:string;preferredInsurerName?:string;estimatedValue:number;assignedTo:string;assignedToName?:string;notes?:string;lostReason?:string;clientId?:string;convertedAt?:unknown;wonAt?:unknown;lostAt?:unknown;lastActivityAt?:unknown;createdBy:string;createdAt?:unknown;updatedAt?:unknown;}
export type LeadInput=Omit<Lead,'id'|'organizationId'|'createdBy'|'createdAt'|'updatedAt'|'convertedAt'|'wonAt'|'lostAt'|'lastActivityAt'|'clientId'>;
export const LEAD_STAGE_LABELS:Record<LeadStage,string>={new:'جديد',contacted:'تم التواصل',qualified:'مؤهل',quotation:'عرض سعر',negotiation:'تفاوض',won:'ناجح',lost:'مفقود'};
export const LEAD_SOURCE_LABELS:Record<LeadSource,string>={website:'الموقع الإلكتروني',referral:'ترشيح',phone:'اتصال هاتفي',email:'البريد الإلكتروني',social:'وسائل التواصل',campaign:'حملة تسويقية',walk_in:'زيارة مباشرة',existing_client:'عميل حالي',other:'أخرى'};
export const LEAD_PRIORITY_LABELS:Record<LeadPriority,string>={low:'منخفضة',medium:'متوسطة',high:'مرتفعة'};
'@
WriteUtf8 (Join-Path $root 'src\pages\NotificationsPage.tsx') @'
import { Bell, ClipboardCheck, ListTodo, RefreshCcw, Target, type LucideIcon } from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { buildNotifications,type AppNotification } from '../features/notifications/notification.service';
const icons:Record<AppNotification['type'],LucideIcon>={task:ListTodo,claim:ClipboardCheck,renewal:RefreshCcw,lead:Target};
export default function NotificationsPage(){const {profile}=useAuth();const [items,setItems]=useState<AppNotification[]>([]);const load=useCallback(async()=>{if(profile)setItems(await buildNotifications(profile.organizationId))},[profile]);useEffect(()=>{void load()},[load]);return <main className="mobile-page"><header className="mobile-page-heading"><span className="eyebrow">Notification Center</span><h1>الإشعارات</h1><p>المهام والمطالبات والتجديدات وفرص البيع التي تحتاج انتباهك.</p></header><section className="notification-list">{items.map(n=>{const Icon=icons[n.type];return <Link to={n.href} key={n.id} className={`notification-card severity-${n.severity}`}><span className="notification-icon"><Icon size={19}/></span><span><b>{n.title}</b><small>{n.body}</small></span><Bell size={16}/></Link>})}{items.length===0&&<div className="empty">لا توجد إشعارات تتطلب المتابعة الآن.</div>}</section></main>}
'@
Write-Host 'Leads 2 fix applied.' -ForegroundColor Green
Write-Host 'Run: npm run build' -ForegroundColor Cyan
Write-Host 'Rollback: powershell -ExecutionPolicy Bypass -File .\apply-leads2-fix.ps1 -Rollback' -ForegroundColor Yellow
