(() => {
  const firebaseConfig = window.INSURNEX_CONFIG?.firebase;
  if (!firebaseConfig?.projectId) throw new Error("InsurNex Firebase configuration is missing.");
  if (!window.firebase?.apps?.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  const I18N = {
    ar: {
      appName:"InsurNex", tagline:"منصة إدارة وCRM متكاملة لوسطاء التأمين",
      home:"الرئيسية", dashboard:"لوحة المتابعة", crm:"CRM", customers:"العملاء", clients:"العملاء",
      leads:"الفرص", opportunities:"الفرص البيعية", quotations:"عروض الأسعار", quotes:"عروض الأسعار",
      policies:"الوثائق", renewals:"التجديدات", claims:"المطالبات", tasks:"المهام", calendar:"التقويم",
      documents:"المستندات", insurers:"شركات التأمين", insuranceProducts:"المنتجات التأمينية",
      commissions:"العمولات", communications:"الاتصالات", reports:"التقارير", analytics:"التحليلات",
      team:"الفريق", notifications:"الإشعارات", settings:"الإعدادات", support:"الدعم",
      subscriptions:"الاشتراك", account:"الحساب", globalSearch:"بحث شامل",
      login:"تسجيل الدخول", register:"إنشاء حساب", logout:"تسجيل الخروج", forgotPassword:"نسيت كلمة المرور؟",
      email:"البريد الإلكتروني", password:"كلمة المرور", confirmPassword:"تأكيد كلمة المرور", name:"الاسم الكامل",
      mobile:"رقم الهاتف", country:"الدولة", city:"المدينة", accountType:"نوع الحساب", companyName:"اسم الشركة",
      individualBroker:"وسيط تأمين فردي", brokerageCompany:"شركة وساطة", brokerEmployee:"موظف شركة",
      manager:"مدير", customer:"عميل", admin:"مدير المنصة",
      personalWorkspace:"المساحة الشخصية", organizationWorkspace:"مساحة المؤسسة", switchWorkspace:"تبديل المساحة",
      save:"حفظ", cancel:"إلغاء", add:"إضافة", edit:"تعديل", delete:"حذف", search:"بحث", loading:"جاري التحميل...",
      retry:"إعادة المحاولة", close:"إغلاق", empty:"لا توجد بيانات بعد", saved:"تم الحفظ بنجاح.", deleted:"تم الحذف بنجاح.",
      noPermission:"ليس لديك صلاحية للوصول إلى هذه البيانات.", network:"تعذر الاتصال بالخدمة. تحقق من الاتصال وحاول مرة أخرى.",
      invalidEmail:"البريد الإلكتروني غير صالح.", invalidPassword:"كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
      passwordsMismatch:"كلمتا المرور غير متطابقتين.", accountCreated:"تم إنشاء الحساب. أكمل إعداد مساحة العمل.",
      resetSent:"تم إرسال رابط استعادة كلمة المرور.", verifyEmail:"يرجى توثيق بريدك الإلكتروني أولًا ثم تسجيل الدخول مرة أخرى.",
      brokerLicense:"رقم ترخيص الوسيط", legalName:"الاسم القانوني", registrationNumber:"رقم التسجيل",
      address:"العنوان", website:"الموقع الإلكتروني", employees:"عدد الموظفين", specialization:"التخصص",
      insuranceLines:"أنواع التأمين", nationalId:"الرقم القومي/جواز السفر", dateOfBirth:"تاريخ الميلاد", gender:"الجنس",
      occupation:"المهنة", category:"التصنيف", industry:"النشاط", source:"المصدر", stage:"المرحلة",
      priority:"الأولوية", expectedPremium:"القسط المتوقع", expectedCommission:"العمولة المتوقعة",
      closingDate:"تاريخ الإغلاق المتوقع", assignedBroker:"الوسيط المسؤول", insurer:"شركة التأمين", product:"المنتج",
      coverage:"التغطية", sumInsured:"مبلغ التأمين", premium:"القسط", deductible:"التحمل", commission:"العمولة",
      validity:"الصلاحية", policyNumber:"رقم الوثيقة", startDate:"تاريخ البداية", expiryDate:"تاريخ الانتهاء",
      paymentStatus:"حالة الدفع", policyStatus:"حالة الوثيقة", claimNumber:"رقم المطالبة", claimType:"نوع المطالبة",
      lossDate:"تاريخ الخسارة", claimAmount:"مبلغ المطالبة", dueDate:"تاريخ الاستحقاق", amount:"المبلغ",
      description:"الوصف", title:"العنوان", type:"النوع", status:"الحالة", date:"التاريخ", method:"الطريقة",
      plan:"الخطة", renewalDate:"تاريخ التجديد", body:"المحتوى", role:"الدور", permissions:"الصلاحيات",
      online:"متصل", offline:"غير متصل", syncing:"جاري المزامنة", hot:"ساخن", warm:"دافئ", cold:"بارد",
      renewalRisk:"مخاطر التجديد", crossSell:"فرصة بيع إضافي", today:"اليوم", thisMonth:"هذا الشهر",
      totalCustomers:"إجمالي العملاء", newLeads:"الفرص الجديدة", openOpportunities:"الفرص المفتوحة",
      activePolicies:"الوثائق النشطة", expiringSoon:"تنتهي قريبًا", renewalRate:"معدل التجديد",
      pendingClaims:"المطالبات المفتوحة", outstandingPayments:"المدفوعات المستحقة",
      paidCommission:"العمولة المحصلة", pendingCommission:"العمولة المعلقة", expected:"متوقع", pending:"معلق", paid:"مدفوع",
      open:"مفتوح", inProgress:"قيد التنفيذ", completed:"مكتمل", overdue:"متأخر", create:"إنشاء",
      pipeline:"مسار المبيعات", performance:"الأداء", teamPerformance:"أداء الفريق", customer360:"ملف العميل 360°",
      timeline:"الخط الزمني", overview:"نظرة عامة", portfolio:"المحفظة التأمينية", activities:"الأنشطة",
      notes:"الملاحظات", payments:"المدفوعات", claimsHistory:"سجل المطالبات", policyHistory:"سجل الوثائق",
      legalDisclaimer:"إخلاء المسؤولية", language:"اللغة", security:"الأمان", profile:"الملف الشخصي",
      professionalInfo:"البيانات المهنية", companyInfo:"بيانات الشركة", workspaceSetup:"إعداد مساحة العمل",
      complete:"إتمام الإعداد", onboarding:"إعداد الحساب", organizationCreated:"تم إنشاء المؤسسة وإعداد عضويتك كمالك.",
      newLead:"جديد", contacted:"تم التواصل", qualified:"مؤهل", quotation:"عرض سعر", proposal:"مقترح",
      negotiation:"تفاوض", won:"فوز", lost:"خسارة", viewed:"تمت المشاهدة", accepted:"مقبول", rejected:"مرفوض", expired:"منتهي",
      draft:"مسودة", active:"نشط", cancelled:"ملغى", suspended:"موقوف", renewed:"مجدد", reported:"مُبلغ عنه",
      underReview:"قيد المراجعة", documentsRequired:"مستندات مطلوبة", submitted:"مُقدم", underAssessment:"قيد التقييم",
      approved:"معتمد", settled:"تمت التسوية", closed:"مغلق"
    },
    en: {
      appName:"InsurNex", tagline:"Insurance Broker CRM & Operating System",
      home:"Home", dashboard:"Dashboard", crm:"CRM", customers:"Customers", clients:"Customers",
      leads:"Leads", opportunities:"Opportunities", quotations:"Quotations", quotes:"Quotations",
      policies:"Policies", renewals:"Renewals", claims:"Claims", tasks:"Tasks", calendar:"Calendar",
      documents:"Documents", insurers:"Insurers", insuranceProducts:"Insurance Products", commissions:"Commissions",
      communications:"Communications", reports:"Reports", analytics:"Analytics", team:"Team", notifications:"Notifications",
      settings:"Settings", support:"Support", subscriptions:"Subscription", account:"Account", globalSearch:"Global search",
      login:"Sign in", register:"Create account", logout:"Sign out", forgotPassword:"Forgot password?",
      email:"Email", password:"Password", confirmPassword:"Confirm password", name:"Full name",
      mobile:"Mobile", country:"Country", city:"City", accountType:"Account type", companyName:"Company name",
      individualBroker:"Individual Broker", brokerageCompany:"Brokerage Company", brokerEmployee:"Broker Employee",
      manager:"Manager", customer:"Customer", admin:"Platform Admin", personalWorkspace:"Personal Workspace",
      organizationWorkspace:"Organization Workspace", switchWorkspace:"Switch workspace", save:"Save", cancel:"Cancel",
      add:"Add", edit:"Edit", delete:"Delete", search:"Search", loading:"Loading...", retry:"Retry",
      close:"Close", empty:"No data yet", saved:"Saved successfully.", deleted:"Deleted successfully.",
      noPermission:"You do not have permission to access this data.", network:"Service unavailable. Check your connection and retry.",
      invalidEmail:"Invalid email address.", invalidPassword:"Password must be at least 6 characters.", passwordsMismatch:"Passwords do not match.",
      accountCreated:"Account created. Complete your workspace setup.", resetSent:"Password reset link sent.",
      verifyEmail:"Please verify your email before signing in.", brokerLicense:"Broker license number", legalName:"Legal name",
      registrationNumber:"Registration number", address:"Address", website:"Website", employees:"Employee count",
      specialization:"Specialization", insuranceLines:"Insurance lines", nationalId:"National ID / Passport",
      dateOfBirth:"Date of birth", gender:"Gender", occupation:"Occupation", category:"Category", industry:"Industry",
      source:"Source", stage:"Stage", priority:"Priority", expectedPremium:"Estimated premium", expectedCommission:"Expected commission",
      closingDate:"Expected closing date", assignedBroker:"Assigned broker", insurer:"Insurer", product:"Product",
      coverage:"Coverage", sumInsured:"Sum insured", premium:"Premium", deductible:"Deductible", commission:"Commission",
      validity:"Validity", policyNumber:"Policy number", startDate:"Start date", expiryDate:"Expiry date",
      paymentStatus:"Payment status", policyStatus:"Policy status", claimNumber:"Claim number", claimType:"Claim type",
      lossDate:"Date of loss", claimAmount:"Claim amount", dueDate:"Due date", amount:"Amount", description:"Description",
      title:"Title", type:"Type", status:"Status", date:"Date", method:"Method", plan:"Plan", renewalDate:"Renewal date",
      body:"Body", role:"Role", permissions:"Permissions", online:"Online", offline:"Offline", syncing:"Syncing",
      hot:"Hot", warm:"Warm", cold:"Cold", renewalRisk:"Renewal risk", crossSell:"Cross-sell opportunity", today:"Today",
      thisMonth:"This month", totalCustomers:"Total customers", newLeads:"New leads", openOpportunities:"Open opportunities",
      activePolicies:"Active policies", expiringSoon:"Expiring soon", renewalRate:"Renewal rate", pendingClaims:"Open claims",
      outstandingPayments:"Outstanding payments", paidCommission:"Collected commission", pendingCommission:"Pending commission",
      expected:"Expected", pending:"Pending", paid:"Paid", open:"Open", inProgress:"In progress", completed:"Completed",
      overdue:"Overdue", create:"Create", pipeline:"Sales pipeline", performance:"Performance", teamPerformance:"Team performance",
      customer360:"Customer 360°", timeline:"Timeline", overview:"Overview", portfolio:"Insurance portfolio", activities:"Activities",
      notes:"Notes", payments:"Payments", claimsHistory:"Claims history", policyHistory:"Policy history",
      legalDisclaimer:"Legal disclaimer", language:"Language", security:"Security", profile:"Profile",
      professionalInfo:"Professional details", companyInfo:"Company details", workspaceSetup:"Workspace setup",
      complete:"Complete setup", onboarding:"Account setup", organizationCreated:"Organization created and you are the owner.",
      newLead:"New", contacted:"Contacted", qualified:"Qualified", quotation:"Quotation", proposal:"Proposal",
      negotiation:"Negotiation", won:"Won", lost:"Lost", viewed:"Viewed", accepted:"Accepted", rejected:"Rejected", expired:"Expired",
      draft:"Draft", active:"Active", cancelled:"Cancelled", suspended:"Suspended", renewed:"Renewed", reported:"Reported",
      underReview:"Under review", documentsRequired:"Documents required", submitted:"Submitted", underAssessment:"Under assessment",
      approved:"Approved", settled:"Settled", closed:"Closed"
    }
  };

  let lang=localStorage.getItem("insurnex-language")||"ar";
  const state={
    user:null, profile:null, memberships:[], adminRole:null,
    workspace:{type:"personal",id:null,name:null}, cache:new Map(), online:navigator.onLine
  };

  const ROLES={
    individual_broker:["broker"],
    brokerage_company:["organizationOwner","broker"],
    broker_employee:["broker","salesAgent","customerService","operations","claimsOfficer","finance","viewer"],
    manager:["manager"],
    customer:["customer"],
    admin:["platformAdmin"]
  };

  const ROLE_LABELS={
    organizationOwner:["organizationOwner","مدير الشركة","Company Owner"],
    organizationAdmin:["organizationAdmin","مسؤول الشركة","Company Admin"],
    manager:["manager","مدير","Manager"],
    broker:["broker","وسيط","Broker"],
    salesAgent:["salesAgent","مبيعات","Sales Agent"],
    customerService:["customerService","خدمة العملاء","Customer Service"],
    operations:["operations","العمليات","Operations"],
    claimsOfficer:["claimsOfficer","المطالبات","Claims Officer"],
    finance:["finance","المالية","Finance"],
    viewer:["viewer","مشاهد","Viewer"],
    customer:["customer","عميل","Customer"]
  };

  function setLanguage(next){
    lang=next==="en"?"en":"ar";
    localStorage.setItem("insurnex-language",lang);
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==="ar"?"rtl":"ltr";
    document.dispatchEvent(new CustomEvent("insurnex:language",{detail:lang}));
  }
  function t(key){return I18N[lang]?.[key] ?? I18N.en[key] ?? key;}
  function locale(){return lang;}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function fmtDate(v){
    if(!v)return"—";
    const d=v?.toDate?v.toDate():new Date(v);
    return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(lang==="ar"?"ar-EG":"en-US",{year:"numeric",month:"short",day:"numeric"});
  }
  function fmtMoney(v,currency="EGP"){
    return new Intl.NumberFormat(lang==="ar"?"ar-EG":"en-US",{style:"currency",currency,maximumFractionDigits:0}).format(Number(v||0));
  }
  function toast(message,type="success"){
    const host=document.querySelector("#toastHost")||document.body;
    const el=document.createElement("div"); el.className="toast "+type; el.textContent=message; host.appendChild(el);
    requestAnimationFrame(()=>el.classList.add("show"));
    setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),250)},3200);
  }
  function friendlyError(err){
    const code=String(err?.code||"");
    const map={
      "auth/invalid-credential":t("login")+" — بيانات الاعتماد غير صحيحة.",
      "auth/user-not-found":"الحساب غير موجود.",
      "auth/wrong-password":"كلمة المرور غير صحيحة.",
      "auth/email-already-in-use":"هذا البريد مستخدم بالفعل.",
      "auth/weak-password":t("invalidPassword"),
      "auth/invalid-email":t("invalidEmail"),
      "auth/email-not-verified":t("verifyEmail"),
      "permission-denied":t("noPermission"),
      "storage/unauthorized":t("noPermission"),
      "storage/canceled":"تم إلغاء رفع الملف.",
      "storage/quota-exceeded":"تم تجاوز سعة التخزين المتاحة."
    };
    return map[code]||t("network");
  }

  function roles(){
    const r=state.profile?.roles||[];
    return Array.isArray(r)?r:[String(r)];
  }
  function hasRole(...wanted){const r=roles();return wanted.some(x=>r.includes(x));}
  function isPlatformAdmin(){return ["superAdmin","platformAdmin"].includes(state.adminRole)||["superAdmin","platformAdmin"].some(x=>roles().includes(x));}
  function can(module,action="read"){
    if(isPlatformAdmin())return true;
    const r=roles();
    if(action==="read")return true;
    if(["settings","team","subscriptions"].includes(module))return r.some(x=>["organizationOwner","organizationAdmin","manager"].includes(x));
    if(module==="commissions")return r.some(x=>["organizationOwner","organizationAdmin","manager","finance","broker"].includes(x));
    if(module==="claims")return r.some(x=>["organizationOwner","organizationAdmin","manager","broker","claimsOfficer","operations"].includes(x));
    if(module==="policies"||module==="quotations"||module==="opportunities")return r.some(x=>["organizationOwner","organizationAdmin","manager","broker","salesAgent","operations"].includes(x));
    if(module==="customers"||module==="leads")return r.some(x=>["organizationOwner","organizationAdmin","manager","broker","salesAgent","customerService"].includes(x));
    return r.some(x=>["organizationOwner","organizationAdmin","manager","broker","salesAgent","customerService","operations","claimsOfficer","finance"].includes(x));
  }

  async function loadIdentity(){
    const u=auth.currentUser;
    state.user=u;
    if(!u){state.profile=null;state.memberships=[];return null;}
    const snap=await db.collection("users").doc(u.uid).get();
    state.profile=snap.exists?snap.data():{};
    const ms=await db.collection("organizationMembers").where("userId","==",u.uid).limit(30).get();
    state.memberships=ms.docs.map(d=>({id:d.id,...d.data()}));
    const saved=localStorage.getItem("insurnex-workspace");
    if(saved){try{const p=JSON.parse(saved);if(p.type==="organization"&&state.memberships.some(m=>m.organizationId===p.id))state.workspace=p;}catch{}}
    if(state.workspace.id===null&&state.memberships.length===0)state.workspace={type:"personal",id:null,name:t("personalWorkspace")};
    if(state.memberships.length && !state.memberships.some(m=>m.organizationId===state.workspace.id))state.workspace={type:"organization",id:state.memberships[0].organizationId,name:state.memberships[0].organizationName||t("organizationWorkspace")};
    return state.profile;
  }

  function setWorkspace(ws){
    state.workspace=ws;
    localStorage.setItem("insurnex-workspace",JSON.stringify(ws));
    state.cache.clear();
    document.dispatchEvent(new CustomEvent("insurnex:workspace",{detail:ws}));
  }

  function scopedQuery(name,workspace=state.workspace,limit=100){
    let q=db.collection(name);
    if(workspace.type==="organization"&&workspace.id){
      q=q.where("organizationId","==",workspace.id).where("workspaceType","==","organization");
    }else{
      q=q.where("ownerId","==",auth.currentUser.uid).where("workspaceType","==","personal");
    }
    return q.limit(Math.max(1,Math.min(limit,100)));
  }

  function docPayload(data={},workspace=state.workspace){
    const user=auth.currentUser;
    if(!user)throw new Error("Not authenticated");
    return {
      ...data,
      workspaceType:workspace.type,
      organizationId:workspace.type==="organization"?workspace.id:null,
      ownerId:user.uid,
      createdBy:user.uid,
      createdAt:data.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function queryDocs(collection,workspace=state.workspace,limit=100){
    const key=collection+"|"+workspace.type+"|"+(workspace.id||"personal")+"|"+limit;
    if(state.cache.has(key))return state.cache.get(key);
    const snap=await scopedQuery(collection,workspace,limit).get();
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    rows.sort((a,b)=>{
      const ta=a.createdAt?.toMillis?a.createdAt.toMillis():Date.parse(a.createdAt||"");
      const tb=b.createdAt?.toMillis?b.createdAt.toMillis():Date.parse(b.createdAt||"");
      return (tb||0)-(ta||0);
    });
    state.cache.set(key,rows);
    return rows;
  }

  async function writeAudit(action,targetType,targetId,metadata={},before=null,after=null){
    if(!auth.currentUser)return;
    try{
      await db.collection("auditLogs").add({
        action,targetType,targetId,actorId:auth.currentUser.uid,actorEmail:auth.currentUser.email||"",
        organizationId:state.workspace.type==="organization"?state.workspace.id:null,
        metadata,before:before||null,after:after||null,createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }catch(e){console.warn("audit",e);}
  }

  async function logActivity(type,subject,metadata={}){
    try{
      const ref=await db.collection("activities").add(docPayload({
        type,subject,metadata,actorId:auth.currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()
      }));
      return ref.id;
    }catch(e){console.warn("activity",e);return null;}
  }

  function isExpiring(date,days=30){
    if(!date)return false;
    const d=date?.toDate?date.toDate():new Date(date); if(Number.isNaN(d.getTime()))return false;
    const diff=Math.ceil((d.getTime()-Date.now())/86400000);
    return diff>=0&&diff<=days;
  }

  const Domain={
    customers:{title:"customers",icon:"👥",collection:"customers",fields:[
      ["fullName","name","text"],["type","category","select","individual,SME,corporate,VIP,family,other"],
      ["mobile","mobile","tel"],["email","email","email"],["nationalId","nationalId","text"],["occupation","occupation","text"],
      ["country","country","text"],["city","city","text"],["status","status","select","active,inactive,lost"]
    ]},
    leads:{title:"leads",icon:"🎯",collection:"leads",fields:[
      ["fullName","name","text"],["phone","mobile","tel"],["email","email","email"],["source","source","select","Website,Facebook,Instagram,WhatsApp,Referral,Phone,Email,Advertisement,Existing Customer,Other"],
      ["insuranceType","type","text"],["estimatedPremium","expectedPremium","number"],["priority","priority","select","hot,warm,cold"],
      ["stage","stage","select","New,Contacted,Qualified,Quotation,Negotiation,Won,Lost"],["expectedCloseDate","closingDate","date"]
    ]},
    opportunities:{title:"opportunities",icon:"💼",collection:"opportunities",fields:[
      ["customerName","customers","text"],["insuranceType","type","text"],["product","product","text"],["insurer","insurer","text"],
      ["estimatedPremium","expectedPremium","number"],["expectedCommission","expectedCommission","number"],["probability","priority","number"],
      ["closingDate","closingDate","date"],["assignedBrokerName","assignedBroker","text"],["status","status","select","New,Quotation,Proposal,Negotiation,Won,Lost"]
    ]},
    quotations:{title:"quotations",icon:"📑",collection:"quotations",fields:[
      ["customerName","customers","text"],["product","product","text"],["insurer","insurer","text"],["coverage","coverage","textarea"],
      ["sumInsured","sumInsured","number"],["premium","premium","number"],["deductible","deductible","number"],["commissionAmount","commission","number"],
      ["validUntil","validity","date"],["status","status","select","Draft,Sent,Viewed,Accepted,Rejected,Expired"]
    ]},
    policies:{title:"policies",icon:"🛡️",collection:"policies",fields:[
      ["policyNumber","policyNumber","text"],["customerName","customers","text"],["insurer","insurer","text"],["product","product","text"],
      ["insuranceType","type","text"],["startDate","startDate","date"],["expiryDate","expiryDate","date"],["premium","premium","number"],
      ["commissionRate","commission","number"],["commissionAmount","commission","number"],["paymentStatus","paymentStatus","select","pending,partial,paid,overdue"],
      ["status","policyStatus","select","Draft,Active,Expired,Cancelled,Suspended,Renewed"]
    ]},
    renewals:{title:"renewals",icon:"🔄",collection:"renewals",fields:[
      ["policyNumber","policyNumber","text"],["customerName","customers","text"],["expiryDate","expiryDate","date"],
      ["stage","stage","select","90 Days,60 Days,45 Days,30 Days,15 Days,7 Days,Expired"],["status","status","select","Open,In Progress,Renewed,Lost,Expired"],
      ["assignedBrokerName","assignedBroker","text"],["notes","notes","textarea"]
    ]},
    claims:{title:"claims",icon:"🧾",collection:"claims",fields:[
      ["claimNumber","claimNumber","text"],["customerName","customers","text"],["policyNumber","policyNumber","text"],["insurer","insurer","text"],
      ["claimType","claimType","text"],["dateOfLoss","lossDate","date"],["amount","claimAmount","number"],
      ["status","status","select","Reported,Under Review,Documents Required,Submitted,Under Assessment,Approved,Rejected,Settled,Closed"],["description","description","textarea"]
    ]},
    tasks:{title:"tasks",icon:"✅",collection:"tasks",fields:[
      ["title","title","text"],["description","description","textarea"],["dueDate","dueDate","date"],["priority","priority","select","low,medium,high,urgent"],
      ["assignedToName","assignedBroker","text"],["status","status","select","To Do,In Progress,Completed,Overdue"],
      ["linkedEntityType","type","text"],["linkedEntityId","policyNumber","text"]
    ]},
    calendarEvents:{title:"calendar",icon:"📅",collection:"calendarEvents",fields:[
      ["title","title","text"],["date","date","datetime-local"],["type","type","select","Meeting,Call,Follow-up,Renewal,Claim deadline,Task,Policy expiry"],
      ["customerName","customers","text"],["assignedToName","assignedBroker","text"],["status","status","select","scheduled,completed,cancelled"],["notes","notes","textarea"]
    ]},
    documents:{title:"documents",icon:"📎",collection:"documents",fields:[
      ["name","name","text"],["entityType","type","select","Customer,Policy,Claim,Quotation,Company"],["entityId","policyNumber","text"],
      ["category","category","text"],["fileName","title","text"],["mimeType","type","text"],["status","status","select","active,archived"]
    ]},
    insurers:{title:"insurers",icon:"🏢",collection:"insurers",fields:[
      ["name","name","text"],["license","brokerLicense","text"],["contactName","assignedBroker","text"],["email","email","email"],
      ["phone","mobile","tel"],["website","website","url"],["commissionStructure","commission","textarea"],["status","status","select","active,inactive"]
    ]},
    insuranceProducts:{title:"insuranceProducts",icon:"📦",collection:"insuranceProducts",fields:[
      ["name","name","text"],["insuranceType","type","text"],["insurer","insurer","text"],["coverage","coverage","textarea"],
      ["exclusions","description","textarea"],["premiumRange","premium","text"],["commission","commission","number"],
      ["eligibility","notes","textarea"],["status","status","select","active,inactive"]
    ]},
    commissions:{title:"commissions",icon:"💰",collection:"commissions",fields:[
      ["policyNumber","policyNumber","text"],["customerName","customers","text"],["insurer","insurer","text"],["brokerName","assignedBroker","text"],
      ["premium","premium","number"],["commissionRate","commission","number"],["commissionAmount","amount","number"],["paidCommission","paidCommission","number"],
      ["commissionDate","date","date"],["status","status","select","Expected,Pending,Approved,Paid,Cancelled"]
    ]},
    communications:{title:"communications",icon:"💬",collection:"communications",fields:[
      ["customerName","customers","text"],["channel","type","select","Email,SMS,WhatsApp,In-app,Phone"],["subject","subject","text"],
      ["message","description","textarea"],["relatedType","type","text"],["relatedId","policyNumber","text"],["status","status","select","draft,sent,failed"]
    ]},
    supportTickets:{title:"support",icon:"🎧",collection:"supportTickets",fields:[
      ["subject","subject","text"],["priority","priority","select","low,medium,high,urgent"],["status","status","select","Open,In Progress,Waiting for User,Resolved,Closed"],
      ["message","description","textarea"]
    ]},
    subscriptions:{title:"subscriptions",icon:"💼",collection:"subscriptions",fields:[
      ["plan","plan","select","Free,Professional,Business,Enterprise"],["status","status","select","trial,active,pastDue,cancelled"],
      ["renewalDate","renewalDate","date"],["customerLimit","total","number"],["userLimit","employees","number"]
    ]},
    teams:{title:"team",icon:"👨‍👩‍👧‍👦",collection:"teams",fields:[
      ["name","name","text"],["managerName","assignedBroker","text"],["description","description","textarea"],["status","status","select","active,inactive"]
    ]}
  };

  window.addEventListener("online",()=>{state.online=true;document.dispatchEvent(new CustomEvent("insurnex:network",{detail:true}));});
  window.addEventListener("offline",()=>{state.online=false;document.dispatchEvent(new CustomEvent("insurnex:network",{detail:false}));});
  setLanguage(lang);

  window.InsurNex={
    auth,db,storage,state,I18N,Domain,ROLES,ROLE_LABELS,t,setLanguage,locale,esc,fmtDate,fmtMoney,toast,friendlyError,
    roles,hasRole,isPlatformAdmin,can,loadIdentity,setWorkspace,scopedQuery,docPayload,queryDocs,writeAudit,logActivity,isExpiring
  };
})();