export type SystemInsurerCategory = 'general' | 'life' | 'general_life' | 'takaful';
export interface SystemInsurer { id:string; name:string; shortName:string; category:SystemInsurerCategory; }
export const SYSTEM_INSURERS:SystemInsurer[] = [
  { id:'misr-insurance', name:'شركة مصر للتأمين', shortName:'Misr Insurance', category:'general' },
  { id:'misr-life', name:'شركة مصر لتأمينات الحياة', shortName:'Misr Life Insurance', category:'life' },
  { id:'axa', name:'شركة أكسا للتأمين (AXA)', shortName:'AXA', category:'general_life' },
  { id:'metlife', name:'شركة ميتلايف (MetLife)', shortName:'MetLife', category:'life' },
  { id:'allianz', name:'شركة أليانز للتأمين (Allianz)', shortName:'Allianz', category:'general_life' },
  { id:'suez-canal', name:'شركة قناة السويس للتأمين', shortName:'Suez Canal Insurance', category:'general' },
  { id:'delta', name:'شركة الدلتا للتأمين (Delta Insurance)', shortName:'Delta Insurance', category:'general' },
  { id:'chubb', name:'شركة تشب للتأمين (Chubb)', shortName:'Chubb', category:'general' },
  { id:'gig', name:'المجموعة العربية المصرية للتأمين (GIG)', shortName:'GIG', category:'general_life' },
  { id:'royal', name:'شركة رويال للتأمين', shortName:'Royal Insurance', category:'general' },
  { id:'sarwa', name:'شركة ثروة للتأمين (Sarwa Insurance)', shortName:'Sarwa Insurance', category:'general' },
  { id:'aig', name:'شركة أريج / إيه آي جي (AIG)', shortName:'AIG', category:'general' },
  { id:'arope', name:'شركة أروب للتأمين (Arope)', shortName:'Arope', category:'general_life' },
  { id:'tokio-marine', name:'شركة طوكيو مارين (Tokyo Marine)', shortName:'Tokyo Marine', category:'general' },
  { id:'mohandes', name:'شركة المهندس للتأمين', shortName:'Al Mohandes Insurance', category:'general' },
  { id:'eskan', name:'شركة إسكان للتأمين', shortName:'Eskan Insurance', category:'general' },
  { id:'libano-suisse', name:'الشركة اللبنانية السويسرية للتأمين (Libano-Suisse)', shortName:'Libano-Suisse', category:'general_life' },
  { id:'medgulf', name:'شركة المتوسط والخليج للتأمين (ميد جلف - MedGulf)', shortName:'MedGulf', category:'general_life' },
  { id:'qnb-life', name:'شركة QNB للضمان (تأمينات الحياة)', shortName:'QNB Alahli Life', category:'life' },
  { id:'egyptian-saudi', name:'بيت التأمين المصري السعودي', shortName:'Egyptian Saudi Insurance House', category:'takaful' },
  { id:'misr-takaful', name:'شركة مصر للتأمين التكافلي (ممتلكات وحياة)', shortName:'Misr Takaful', category:'takaful' },
  { id:'orient-takaful', name:'شركة أورينت للتأمين التكافلي (Orient Takaful)', shortName:'Orient Takaful', category:'takaful' },
  { id:'wethaq', name:'شركة وثاق للتأمين التكافلي', shortName:'Wethaq Takaful', category:'takaful' },
  { id:'misr-emirates-takaful', name:'الشركة المصرية الإماراتية للتأمين التكافلي (Misr Emirates Takaful)', shortName:'Misr Emirates Takaful', category:'takaful' }
];
