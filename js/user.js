(function(){
  document.body.classList.add("insurnex-user");
  var auth=InsurNex.auth, db=InsurNex.db, storage=InsurNex.storage, state=InsurNex.state, Domain=InsurNex.Domain;
  var t=InsurNex.t, esc=InsurNex.esc, fmtDate=InsurNex.fmtDate, fmtMoney=InsurNex.fmtMoney, toast=InsurNex.toast, friendlyError=InsurNex.friendlyError;
  var view=(location.hash||"#home").slice(1), search="";

  var nav=[
    ["home","home","⌂"],["crm","crm","👥"],["leads","leads","🎯"],["opportunities","opportunities","💼"],
    ["quotations","quotations","📑"],["policies","policies","🛡️"],["renewals","renewals","🔄"],["claims","claims","🧾"],
    ["tasks","tasks","✅"],["payments","payments","💳"],["calendarEvents","calendar","📅"],["documents","documents","📎"],["insurers","insurers","🏢"],
    ["insuranceProducts","insuranceProducts","📦"],["commissions","commissions","💰"],["communications","communications","💬"],
    ["reports","reports","📈"],["analytics","analytics","📊"],["team","team","👨‍👩‍👧‍👦"],["notifications","notifications","🔔"],
    ["subscriptions","subscriptions","💳"],["supportTickets","support","🎧"],["account","account","⚙️"]
  ];
  var shortNav=[["home","home","⌂"],["crm","crm","👥"],["leads","leads","🎯"],["renewals","renewals","🔄"],["account","account","⚙️"]];

  function mark(){return '<div class="brand-mark image-mark" aria-label="InsurNex"><img src="assets/logo.svg" alt="InsurNex"></div>';}
  function modal(title,html){
    document.getElementById("modalTitle").textContent=title;
    document.getElementById("modalBody").innerHTML=html;
    document.getElementById("modal").classList.add("show");
  }
  function closeModal(){document.getElementById("modal").classList.remove("show");}
  function navigate(v){view=v;search="";location.hash=v;render();}
  function localLabel(k){return t(k)||k;}

  function accountTypeOptions(){
    return '<option value="individual_broker">'+t("individualBroker")+'</option>'+
      '<option value="brokerage_company">'+t("brokerageCompany")+'</option>'+
      '<option value="broker_employee">'+t("brokerEmployee")+'</option>'+
      '<option value="manager">'+t("manager")+'</option>'+
      '<option value="customer">'+t("customer")+'</option>';
  }

  function authPage(mode,error){
    var login=mode==="login";
    var logo='<div class="auth-logo-mark"><img src="assets/logo.svg" alt="InsurNex" loading="eager" decoding="async"></div>';
    var companyFields=!login?(
      '<section id="companyFields" class="auth-company" style="display:none">'+
      '<div class="auth-section-label">'+t("companyInfo")+'</div>'+
      '<div class="form-grid">'+
      '<div class="field"><label>'+t("legalName")+'</label><input name="legalName" autocomplete="organization"></div>'+
      '<div class="field"><label>'+t("registrationNumber")+'</label><input name="registrationNumber"></div>'+
      '<div class="field"><label>'+t("brokerLicense")+'</label><input name="companyLicense"></div>'+
      '<div class="field"><label>'+t("employees")+'</label><input name="employees" type="number" min="1"></div>'+
      '<div class="field field-full"><label>'+t("address")+'</label><input name="companyAddress" autocomplete="street-address"></div>'+
      '<div class="field"><label>'+t("website")+'</label><input name="website" type="url"></div>'+
      '<div class="field"><label>'+t("specialization")+'</label><input name="specialization"></div>'+
      '</div></section>'
    ):'';

    document.getElementById("app").innerHTML=
      '<main class="auth-wrap"><section class="auth-card auth-card-pro">'+
      '<div class="auth-top">'+
        '<div class="auth-brand">'+logo+'<div class="auth-brand-copy"><div class="brand-name">InsurNex</div><div class="subtitle">'+esc(t("tagline"))+'</div></div></div>'+
        '<div class="auth-language"><button id="lang" type="button" class="auth-icon-btn">'+(InsurNex.locale()==="ar"?"EN":"ع")+'</button></div>'+
      '</div>'+
      '<div class="auth-divider"></div>'+
      '<div class="auth-intro">'+
        '<div class="eyebrow">INSURTECH BROKER OS</div>'+
        '<h1 class="auth-title">'+(login?t("login"):t("register"))+'</h1>'+
        '<p class="auth-copy">إدارة العملاء، الوثائق، عروض الأسعار، التجديدات والمطالبات من مساحة عمل واحدة.</p>'+
      '</div>'+
      (error?'<div class="error-box auth-error">'+esc(error)+'</div>':'')+
      '<form id="authForm" class="form-stack auth-form">'+
      (!login?
        '<div class="form-grid">'+
          '<div class="field"><label>'+t("name")+'</label><input name="name" autocomplete="name" required></div>'+
          '<div class="field"><label>'+t("mobile")+'</label><input name="mobile" type="tel" autocomplete="tel" required></div>'+
          '<div class="field"><label>'+t("country")+'</label><input name="country" value="Egypt" autocomplete="country-name"></div>'+
          '<div class="field"><label>'+t("city")+'</label><input name="city" autocomplete="address-level2"></div>'+
        '</div>':'')+
      '<div class="field"><label>'+t("email")+'</label><input type="email" name="email" autocomplete="email" inputmode="email" required></div>'+
      '<div class="field"><label>'+t("password")+'</label><input type="password" name="password" minlength="6" autocomplete="'+(login?"current-password":"new-password")+'" required></div>'+
      (!login?
        '<div class="field"><label>'+t("confirmPassword")+'</label><input type="password" name="confirmPassword" minlength="6" autocomplete="new-password" required></div>'+
        '<div class="field"><label>'+t("accountType")+'</label><select id="accountType" name="accountType">'+accountTypeOptions()+'</select></div>'+
        companyFields+
        '<label class="checkbox auth-terms"><input type="checkbox" name="terms" required><span>أوافق على شروط الاستخدام وسياسة الخصوصية.</span></label>':'')+
      '<button class="btn btn-primary auth-submit" type="submit">'+(login?t("login"):t("register"))+'</button>'+
      '</form>'+
      '<div class="auth-actions">'+
        '<button id="switchAuth" type="button" class="auth-secondary">'+(login?t("register"):t("login"))+'</button>'+
        (login?'<button id="forgot" type="button" class="auth-link">'+t("forgotPassword")+'</button>':'')+
      '</div>'+
      '<div class="auth-security">'+
        '<span><b>Firebase Auth</b><small>Authentication</small></span>'+
        '<span><b>Firestore</b><small>Workspace data</small></span>'+
        '<span><b>RBAC</b><small>Access control</small></span>'+
      '</div>'+
      '</section></main>';

    document.getElementById("switchAuth").onclick=function(){authPage(login?"register":"login");};
    document.getElementById("lang").onclick=function(){InsurNex.setLanguage(InsurNex.locale()==="ar"?"en":"ar");authPage(mode);};
    if(login)document.getElementById("forgot").onclick=forgot;
    if(!login){
      var type=document.getElementById("accountType"),box=document.getElementById("companyFields");
      type.onchange=function(){box.style.display=this.value==="brokerage_company"?"block":"none";};
    }
    document.getElementById("authForm").onsubmit=async function(e){
      e.preventDefault();
      var form=e.currentTarget;
      var submit=form.querySelector(".auth-submit");
      if(submit){submit.disabled=true;submit.textContent=login?"جاري تسجيل الدخول…":"جاري إنشاء الحساب…";}
      try{
        var f=new FormData(form);
        if(login)await doLogin(f);else await doRegister(f);
      }catch(err){
        authPage(mode,friendlyError(err));
      }
    };
  }

  async function doLogin(f){
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await auth.signInWithEmailAndPassword(String(f.get("email")).trim(),String(f.get("password")));
    if(!auth.currentUser.emailVerified){await auth.signOut();var er=new Error("email-not-verified");er.code="auth/email-not-verified";throw er;}
    await InsurNex.loadIdentity();
    await enter();
  }

  async function doRegister(f){
    var password=String(f.get("password")||""), confirm=String(f.get("confirmPassword")||"");
    if(password!==confirm){var e=new Error("mismatch");e.code="auth/password-mismatch";throw e;}
    var c=await auth.createUserWithEmailAndPassword(String(f.get("email")).trim(),password);
    var uid=c.user.uid,type=String(f.get("accountType")||"individual_broker"),batch=db.batch();
    var roles=type==="brokerage_company"?["organizationOwner","broker"]:
      type==="manager"?["manager"]:
      type==="customer"?["customer"]:["broker"];
    var userData={
      uid:uid,email:c.user.email,name:String(f.get("name")||""),mobile:String(f.get("mobile")||""),
      country:String(f.get("country")||""),city:String(f.get("city")||""),accountType:type,roles:roles,
      onboardingComplete:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(db.collection("users").doc(uid),userData);
    batch.set(db.collection("brokerProfiles").doc(uid),{
      userId:uid,licenseNumber:String(f.get("companyLicense")||""),specialization:String(f.get("specialization")||""),
      companyName:String(f.get("companyName")||""),createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    var createdWorkspace=null;
    if(type==="brokerage_company"){
      var org=db.collection("organizations").doc(),name=String(f.get("name")||f.get("legalName")||"InsurNex Brokerage");
      batch.set(org,{
        name:name,legalName:String(f.get("legalName")||name),ownerId:uid,licenseNumber:String(f.get("companyLicense")||""),
        registrationNumber:String(f.get("registrationNumber")||""),country:String(f.get("country")||""),
        city:String(f.get("city")||""),address:String(f.get("companyAddress")||""),website:String(f.get("website")||""),
        employeeCount:Number(f.get("employees")||0),primaryContact:String(f.get("name")||""),status:"active",
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection("organizationMembers").doc(org.id+"_"+uid),{
        organizationId:org.id,organizationName:name,userId:uid,role:"organizationOwner",status:"active",
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      createdWorkspace={type:"organization",id:org.id,name:name};
    }
    await batch.commit();
    if(createdWorkspace)InsurNex.setWorkspace(createdWorkspace);
    try{await c.user.sendEmailVerification();}catch(e){}
    await InsurNex.loadIdentity();
    toast(t("accountCreated"));
    await enter();
  }

  async function forgot(){
    var email=prompt(t("email"));
    if(!email)return;
    try{await auth.sendPasswordResetEmail(email.trim());toast(t("resetSent"));}catch(e){toast(friendlyError(e),"error");}
  }

  function allowedNav(){
    var isCustomer=InsurNex.hasRole("customer");
    if(!isCustomer)return nav;
    return nav.filter(function(n){return ["home","crm","policies","claims","documents","communications","notifications","account"].includes(n[0]);});
  }

  function shell(){
    var links=allowedNav().map(function(n){return '<a class="drawer-link" href="#'+n[0]+'" data-nav="'+n[0]+'"><span>'+n[2]+' '+t(n[1])+'</span><span>›</span></a>';}).join("");
    var bottom=shortNav.filter(function(n){return allowedNav().some(function(a){return a[0]===n[0];});}).map(function(n){
      return '<button data-nav="'+n[0]+'" class="'+(view===n[0]?"active":"")+'"><span class="icon">'+n[2]+'</span><span>'+t(n[1])+'</span></button>';
    }).join("")+'<button id="openMenu"><span class="icon">☰</span><span>Menu</span></button>';

    document.getElementById("app").innerHTML='<div class="app-shell"><aside class="desktop-drawer"><div class="drawer-head">'+mark()+
      ' <strong>InsurNex</strong></div><div class="section-note" style="margin:8px 10px 14px">'+esc(state.workspace.name||t("personalWorkspace"))+
      '</div>'+links+'</aside><main class="main"><header class="topbar"><div class="brand">'+mark()+
      '<div><div class="brand-name">InsurNex</div><div class="subtitle">'+esc(state.workspace.name||t("personalWorkspace"))+
      '</div></div></div><div class="actions"><span class="badge '+(state.online?"success":"danger")+'">'+
      (state.online?t("online"):t("offline"))+'</span><button class="btn" id="globalSearch" aria-label="'+t("globalSearch")+'">⌕</button>'+
      '<button class="btn" id="lang">'+(InsurNex.locale()==="ar"?"EN":"AR")+'</button><button class="btn" id="menu">☰</button>'+
      '<button class="btn" id="logout">⇥</button></div></header><section id="view" class="content"></section></main><nav class="bottom-nav">'+bottom+
      '</nav><div class="drawer" id="drawer"><div class="drawer-panel"><div class="drawer-head"><strong>InsurNex</strong>'+
      '<button class="close" id="closeDrawer">×</button></div>'+links+
      '<div class="workspace-card" style="margin-top:12px"><div>'+(state.workspace.type==="organization"?"🏢":"👤")+
      '</div><div><div class="list-title">'+esc(state.workspace.name||t("personalWorkspace"))+
      '</div><div class="list-sub">'+esc((state.profile&&state.profile.roles||["broker"]).join(" · "))+
      '</div></div></div><button class="btn" id="switchWorkspace" style="margin-top:10px">'+t("switchWorkspace")+
      '</button><button class="btn btn-danger" id="logoutDrawer" style="margin-top:10px">'+t("logout")+
      '</button></div></div></div>';

    document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(e){e.preventDefault();navigate(b.dataset.nav);var d=document.getElementById("drawer");if(d)d.classList.remove("show");};});
    document.getElementById("menu").onclick=function(){document.getElementById("drawer").classList.add("show");};
    document.getElementById("openMenu").onclick=function(){document.getElementById("drawer").classList.add("show");};
    document.getElementById("closeDrawer").onclick=function(){document.getElementById("drawer").classList.remove("show");};
    document.getElementById("drawer").onclick=function(e){if(e.target.id==="drawer")e.currentTarget.classList.remove("show");};
    document.getElementById("logout").onclick=logout;
    document.getElementById("logoutDrawer").onclick=logout;
    document.getElementById("lang").onclick=function(){InsurNex.setLanguage(InsurNex.locale()==="ar"?"en":"ar");shell();render();};
    document.getElementById("switchWorkspace").onclick=switchWorkspace;
    document.getElementById("globalSearch").onclick=globalSearch;
  }

  async function switchWorkspace(){
    var opts=[{type:"personal",id:null,name:t("personalWorkspace")}].concat(state.memberships.map(function(m){
      return {type:"organization",id:m.organizationId,name:m.organizationName||t("organizationWorkspace")};
    }));
    if(opts.length===1){toast(t("personalWorkspace"));return;}
    var n=prompt(opts.map(function(o,i){return(i+1)+". "+o.name;}).join("\n")),i=parseInt(n,10)-1;
    if(opts[i]){InsurNex.setWorkspace(opts[i]);shell();render();}
  }

  async function enter(){
    shell();
    if(!(state.profile&&state.profile.onboardingComplete)){onboarding();}else{await render();}
  }

  function onboarding(){
    var p=state.profile||{}, company=state.profile?.accountType==="brokerage_company";
    modal(t("onboarding"),'<form id="onboard" class="form-stack"><div class="hero"><div class="eyebrow">InsurNex</div>'+
      '<h2>'+t("workspaceSetup")+'</h2><p>'+esc(t("tagline"))+'</p></div>'+
      '<div class="form-grid"><div class="field"><label>'+t("brokerLicense")+'</label><input name="license" value="'+esc(p.licenseNumber||"")+'"></div>'+
      '<div class="field"><label>'+t("specialization")+'</label><input name="specialization" value="'+esc(p.specialization||"")+'"></div>'+
      '<div class="field"><label>'+t("country")+'</label><input name="country" value="'+esc(p.country||"Egypt")+'"></div>'+
      '<div class="field"><label>'+t("city")+'</label><input name="city" value="'+esc(p.city||"")+'"></div>'+
      (company?'<div class="field"><label>'+t("legalName")+'</label><input name="legalName"></div><div class="field"><label>'+t("registrationNumber")+
      '</label><input name="registrationNumber"></div>':'')+'</div>'+
      '<div class="field"><label>'+t("insuranceLines")+'</label><textarea name="insuranceLines" placeholder="Motor, Medical, Life..."></textarea></div>'+
      '<div class="form-actions"><button class="btn btn-primary">'+t("complete")+'</button></div></form>');
    document.getElementById("onboard").onsubmit=async function(e){
      e.preventDefault();var f=new FormData(e.currentTarget);
      try{
        await db.collection("users").doc(state.user.uid).update({
          country:f.get("country"),city:f.get("city"),onboardingComplete:true,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection("brokerProfiles").doc(state.user.uid).set({
          licenseNumber:f.get("license"),specialization:f.get("specialization"),insuranceLines:String(f.get("insuranceLines")||"").split(",").map(function(x){return x.trim();}).filter(Boolean),
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
        if(state.workspace.type==="organization"&&state.workspace.id){
          var patch={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
          if(f.get("legalName"))patch.legalName=f.get("legalName");
          if(f.get("registrationNumber"))patch.registrationNumber=f.get("registrationNumber");
          if(Object.keys(patch).length>1)await db.collection("organizations").doc(state.workspace.id).update(patch);
        }
        closeModal();await InsurNex.loadIdentity();shell();await render();toast(t("saved"));
      }catch(err){toast(friendlyError(err),"error");}
    };
  }

  function closeRecordModal(){closeModal();}

  async function render(){
    var root=document.getElementById("view"); if(!root)return;
    root.innerHTML='<div class="loading">'+t("loading")+'</div>';
    try{
      if(view==="home")root.innerHTML=await home();
      else if(view==="crm")root.innerHTML=await customers();
      else if(view==="analytics")root.innerHTML=await analytics();
      else if(view==="reports")root.innerHTML=await reports();
      else if(view==="account")root.innerHTML=account();
      else if(view==="notifications")root.innerHTML=await notifications();
      else if(view==="documents")root.innerHTML=await documents();
      else if(view==="subscriptions")root.innerHTML=await subscription();
      else if(view==="team")root.innerHTML=await team();
      else if(view==="opportunities")root.innerHTML=await pipeline();
      else if(view==="global-search")root.innerHTML=await searchPage();
      else root.innerHTML=await records(view);
      wire();
    }catch(err){
      console.error(err);
      root.innerHTML='<div class="error-box"><strong>'+t("network")+'</strong><div style="margin-top:8px">'+esc(friendlyError(err))+
        '</div><div style="margin-top:10px"><button class="btn" id="retry">'+t("retry")+'</button></div></div>';
      document.getElementById("retry").onclick=render;
    }
  }

  async function syncRenewalAutomation(policies,existingRenewals){
    function checkpoint(days){
      if(days<=0)return "Expired";
      if(days<=7)return "7 Days";
      if(days<=15)return "15 Days";
      if(days<=30)return "30 Days";
      if(days<=45)return "45 Days";
      if(days<=60)return "60 Days";
      if(days<=90)return "90 Days";
      return null;
    }
    var current=existingRenewals||[];
    for(var i=0;i<policies.length;i++){
      var p=policies[i],expiry=p.expiryDate?new Date(p.expiryDate):null;
      if(!expiry||Number.isNaN(expiry.getTime()))continue;
      var days=Math.ceil((expiry.getTime()-Date.now())/86400000),stage=checkpoint(days);
      if(!stage)continue;
      var exists=current.some(function(r){return (r.policyId===p.id||r.policyNumber===p.policyNumber)&&r.stage===stage;});
      if(exists)continue;
      var key=String(p.id||p.policyNumber||"policy").replace(/[^a-zA-Z0-9_-]/g,"_")+"_"+stage.replace(/\s+/g,"_");
      var renewalData=InsurNex.docPayload({policyId:p.id,policyNumber:p.policyNumber||"",customerId:p.customerId||null,customerName:p.customerName||"",expiryDate:p.expiryDate,stage:stage,status:"Open",assignedBrokerName:state.profile?.name||""});
      await db.collection("renewals").doc(key).set(renewalData,{merge:true});
      await db.collection("tasks").doc(key+"_task").set(InsurNex.docPayload({title:"Renew "+(p.policyNumber||"policy"),description:"Policy expires in "+days+" days.",dueDate:p.expiryDate,priority:days<=15?"high":"medium",status:"To Do",linkedEntityType:"renewal",linkedEntityId:key}),{merge:true});
      await db.collection("notifications").doc(key+"_notification").set({recipientId:state.user.uid,title:"Renewal reminder",body:"Policy "+(p.policyNumber||"")+" reaches "+stage+" reminder stage.",type:"renewal",organizationId:state.workspace.type==="organization"?state.workspace.id:null,createdAt:firebase.firestore.FieldValue.serverTimestamp(),read:false},{merge:true});
      current.push({...renewalData,stage});
    }
    state.cache.clear();
  }

  async function home(){
    var names=["customers","leads","opportunities","policies","renewals","claims","tasks","commissions"];
    var all=await Promise.all(names.map(function(c){return InsurNex.queryDocs(Domain[c]?Domain[c].collection:c);}));
    var customersRows=all[0],leads=all[1],opps=all[2],policies=all[3],renewals=all[4],claims=all[5],tasks=all[6],comm=all[7];
    var payments=await InsurNex.queryDocs("payments");
    await syncRenewalAutomation(policies,renewals);
    var exp=policies.filter(function(p){return InsurNex.isExpiring(p.expiryDate,30);}).length;
    var activePolicies=policies.filter(function(p){return ["Active","active","Renewed"].includes(p.status);}).length;
    var premium=policies.reduce(function(n,p){return n+Number(p.premium||0);},0);
    var expected=comm.reduce(function(n,c){return n+Number(c.commissionAmount||c.amount||0);},0);
    var paid=comm.filter(function(c){return c.status==="Paid";}).reduce(function(n,c){return n+Number(c.paidCommission||c.commissionAmount||0);},0);
    var openClaims=claims.filter(function(c){return !["Settled","Closed","Rejected"].includes(c.status);}).length;
    var renewEligible=renewals.length?renewals.filter(function(r){return ["Renewed","Lost"].indexOf(r.status)<0;}).length:0;
    var renewed=renewals.filter(function(r){return r.status==="Renewed";}).length;
    var renewalRate=renewals.length?Math.round(renewed/renewals.length*100):0;
    var hot=leads.filter(function(l){return l.priority==="hot";}).length;
    var paidByPolicy={};
    payments.forEach(function(p){
      var key=String(p.policyNumber||"");
      if(!key||!["paid","partial"].includes(String(p.status||"").toLowerCase()))return;
      paidByPolicy[key]=(paidByPolicy[key]||0)+Number(p.amount||0);
    });
    var outstanding=policies.reduce(function(total,p){
      var premium=Number(p.premium||0),status=String(p.paymentStatus||"").toLowerCase(),policyNo=String(p.policyNumber||"");
      if(!premium||status==="paid")return total;
      if(status==="partial")return total+Math.max(0,premium-(paidByPolicy[policyNo]||0));
      return total+premium;
    },0);
    var cross=await crossSellSuggestions(customersRows,policies);
    return '<div class="page-head"><div><div class="eyebrow">InsurNex</div><h1>'+t("dashboard")+'</h1>'+
      '<div class="muted">'+esc(state.profile&&state.profile.name||state.user.email)+' · '+esc(state.workspace.name||t("personalWorkspace"))+
      '</div></div><div class="actions"><button class="btn btn-accent" data-add="customers">'+t("add")+" "+t("customers")+
      '</button><button class="btn" data-route="global-search">⌕ '+t("globalSearch")+'</button></div></div>'+
      '<div class="hero" style="margin-bottom:14px"><div class="eyebrow">'+(state.workspace.type==="organization"?t("organizationWorkspace"):t("personalWorkspace"))+
      '</div><h2>'+esc(state.workspace.name||t("personalWorkspace"))+'</h2><p>'+esc(t("tagline"))+'</p></div>'+
      '<div class="stats"><div class="stat"><div class="value">'+customersRows.length+'</div><div class="label">'+t("totalCustomers")+
      '</div></div><div class="stat"><div class="value">'+leads.length+'</div><div class="label">'+t("newLeads")+'</div></div>'+
      '<div class="stat"><div class="value">'+opps.filter(function(x){return !["Won","Lost"].includes(x.status);}).length+'</div><div class="label">'+t("openOpportunities")+
      '</div></div><div class="stat"><div class="value">'+activePolicies+'</div><div class="label">'+t("activePolicies")+'</div></div>'+
      '<div class="stat"><div class="value">'+exp+'</div><div class="label">'+t("expiringSoon")+'</div></div><div class="stat"><div class="value">'+renewalRate+'%</div><div class="label">'+t("renewalRate")+
      '</div></div><div class="stat"><div class="value">'+openClaims+'</div><div class="label">'+t("pendingClaims")+'</div></div>'+
      '<div class="stat"><div class="value">'+fmtMoney(expected)+'</div><div class="label">'+t("expectedCommission")+'</div></div></div>'+
      '<div class="grid grid-2" style="margin-top:14px"><div class="card"><div class="page-head"><h3>'+t("pipeline")+
      '</h3><button class="btn btn-sm" data-route="opportunities">'+t("openOpportunities")+'</button></div>'+pipelineSummary(leads,opps)+'</div>'+
      '<div class="card"><div class="page-head"><h3>'+t("performance")+'</h3></div><div class="list">'+
      '<div class="list-row"><span>'+t("premium")+'</span><strong>'+fmtMoney(premium)+'</strong></div>'+
      '<div class="list-row"><span>'+t("expectedCommission")+'</span><strong>'+fmtMoney(expected)+'</strong></div>'+
      '<div class="list-row"><span>'+t("paidCommission")+'</span><strong>'+fmtMoney(paid)+'</strong></div>'+
      '<div class="list-row"><span>'+t("outstandingPayments")+'</span><strong>'+fmtMoney(outstanding)+'</strong></div></div></div></div>'+
      '<div class="grid grid-2" style="margin-top:14px"><div class="card"><div class="page-head"><h3>'+t("renewalRisk")+'</h3></div>'+
      renewalRiskList(policies,renewals)+'</div><div class="card"><div class="page-head"><h3>'+t("crossSell")+'</h3></div>'+
      (cross.length?'<div class="list">'+cross.slice(0,5).map(function(x){return '<div class="list-row"><div><div class="list-title">'+esc(x.customer)+'</div><div class="list-sub">'+esc(x.suggestion)+'</div></div><span class="badge warn">'+t("crossSell")+'</span></div>';}).join("")+
      '</div>':'<div class="empty">'+t("empty")+'</div>')+'</div></div>'+
      '<div class="card" style="margin-top:14px"><div class="page-head"><h3>'+t("tasks")+'</h3><button class="btn btn-sm" data-route="tasks">'+t("tasks")+'</button></div>'+taskList(tasks)+'</div>'+
      '<div class="section-note" style="margin-top:12px">'+t("legalDisclaimer")+': InsurNex is a broker CRM/operating platform and does not itself provide insurance advice or act as an insurer.</div>';
  }

  function pipelineSummary(leads,opps){
    var stages=["New","Contacted","Qualified","Quotation","Proposal","Negotiation","Won","Lost"];
    return '<div class="list">'+stages.map(function(s){
      var n=leads.filter(function(x){return x.stage===s;}).length+opps.filter(function(x){return x.status===s;}).length;
      return '<div class="list-row"><span>'+esc(s)+'</span><strong>'+n+'</strong></div>';
    }).join("")+'</div>';
  }

  function renewalRiskList(policies,renewals){
    var exp=policies.filter(function(p){return InsurNex.isExpiring(p.expiryDate,45);}).slice(0,6);
    if(!exp.length&&!renewals.length)return '<div class="empty">'+t("empty")+'</div>';
    var rows=exp.map(function(p){return '<div class="list-row"><div><div class="list-title">'+esc(p.customerName||p.policyNumber)+'</div><div class="list-sub">'+fmtDate(p.expiryDate)+' · '+esc(p.policyNumber||"")+'</div></div><span class="badge danger">'+t("renewalRisk")+'</span></div>';});
    return '<div class="list">'+rows.join("")+'</div>';
  }

  function taskList(rows){
    if(!rows.length)return '<div class="empty"><div class="emoji">✅</div>'+t("empty")+'</div>';
    return '<div class="list">'+rows.filter(function(r){return r.status!=="Completed";}).slice(0,6).map(function(r){
      return '<div class="list-row"><div class="list-main"><div class="list-title">'+esc(r.title||"Task")+
      '</div><div class="list-sub">'+fmtDate(r.dueDate)+' · '+esc(r.assignedToName||"")+'</div></div><span class="badge '+
      (r.priority==="urgent"||r.status==="Overdue"?"danger":"")+'">'+esc(r.priority||"medium")+'</span></div>';
    }).join("")+'</div>';
  }

  async function customers(){
    var rows=await InsurNex.queryDocs("customers");
    var q=search.toLowerCase(); rows=rows.filter(function(r){return !q||JSON.stringify(r).toLowerCase().indexOf(q)>=0;});
    return '<div class="page-head"><div><div class="eyebrow">👥 '+t("crm")+'</div><h1>'+t("customers")+'</h1>'+
      '<div class="muted">'+t("customer360")+'</div></div><div class="actions"><button class="btn btn-primary" data-add="customers">'+t("add")+
      '</button><button class="btn" data-csv="customers">CSV</button></div></div>'+
      '<div class="card" style="margin-bottom:14px"><div class="field"><label>'+t("search")+'</label><input id="search" value="'+esc(search)+'" placeholder="'+t("globalSearch")+'"></div></div>'+
      (rows.length?'<div class="table-wrap desktop-table"><table class="data-table"><thead><tr><th>'+t("name")+'</th><th>'+t("category")+
      '</th><th>'+t("mobile")+'</th><th>'+t("email")+'</th><th>'+t("status")+'</th><th></th></tr></thead><tbody>'+
      rows.map(function(r){return '<tr><td><button class="btn btn-sm" data-customer="'+r.id+'">'+esc(r.fullName||"—")+'</button></td><td>'+esc(r.type||"—")+
      '</td><td>'+esc(r.mobile||"—")+'</td><td>'+esc(r.email||"—")+'</td><td><span class="badge success">'+esc(r.status||"active")+
      '</span></td><td><div class="actions"><button class="btn" data-edit="customers:'+r.id+'">'+t("edit")+
      '</button><button class="btn btn-danger" data-del="customers:'+r.id+'">'+t("delete")+'</button></div></td></tr>';}).join("")+
      '</tbody></table></div>':'<div class="card empty desktop-table-empty">👥<br>'+t("empty")+'</div>')+
      mobileRecordCards("customers",rows,Domain.customers);
  }

  async function customer360(id){
    var customer=(state.cache.get("customers")||[]).find(function(x){return x.id===id;});
    if(!customer){var s=await db.collection("customers").doc(id).get();customer={id:id,...s.data()};}
    var related=await Promise.all(["policies","renewals","claims","quotations","communications","tasks"].map(function(c){return InsurNex.queryDocs(c);}));
    var policies=related[0].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    var renewals=related[1].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    var claims=related[2].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    var quotes=related[3].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    var comms=related[4].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    var tasks=related[5].filter(function(x){return x.customerName===customer.fullName||x.customerId===id;});
    modal(t("customer360"),'<div class="grid grid-2"><div class="card"><h3>'+esc(customer.fullName||"")+
      '</h3><div class="muted">'+esc(customer.email||"")+' · '+esc(customer.mobile||"")+
      '</div><div class="list" style="margin-top:10px"><div class="list-row"><span>'+t("category")+'</span><strong>'+esc(customer.type||"")+
      '</strong></div><div class="list-row"><span>'+t("occupation")+'</span><strong>'+esc(customer.occupation||"—")+
      '</strong></div><div class="list-row"><span>'+t("country")+'</span><strong>'+esc(customer.country||"—")+'</strong></div></div></div>'+
      '<div class="card"><h3>'+t("portfolio")+'</h3><div class="stats"><div class="stat"><div class="value">'+policies.length+'</div><div class="label">'+t("policies")+
      '</div></div><div class="stat"><div class="value">'+renewals.length+'</div><div class="label">'+t("renewals")+'</div></div>'+
      '<div class="stat"><div class="value">'+claims.length+'</div><div class="label">'+t("claims")+'</div></div><div class="stat"><div class="value">'+quotes.length+'</div><div class="label">'+t("quotations")+'</div></div></div></div></div>'+
      '<div class="grid grid-2" style="margin-top:12px"><div class="card"><h3>'+t("policyHistory")+'</h3>'+miniRows(policies,["policyNumber","product","expiryDate"])+'</div>'+
      '<div class="card"><h3>'+t("claimsHistory")+'</h3>'+miniRows(claims,["claimNumber","status","amount"])+'</div></div>'+
      '<div class="card" style="margin-top:12px"><h3>'+t("timeline")+'</h3>'+timeline(customer,policies,quotes,renewals,claims,comms,tasks)+'</div>');
  }

  function miniRows(rows,keys){
    if(!rows.length)return '<div class="empty">'+t("empty")+'</div>';
    return '<div class="list">'+rows.slice(0,6).map(function(r){return '<div class="list-row">'+
      '<div><div class="list-title">'+esc(r[keys[0]]||"—")+'</div><div class="list-sub">'+esc(r[keys[1]]||"—")+'</div></div>'+
      '<span class="badge">'+esc(String(r[keys[2]]||"—"))+'</span></div>';}).join("")+'</div>';
  }

  function timeline(customer,policies,quotes,renewals,claims,comms,tasks){
    var items=[];
    items.push({date:customer.createdAt,label:"Lead/customer created"});
    policies.forEach(x=>items.push({date:x.startDate,label:"Policy "+(x.policyNumber||"")+" issued"}));
    quotes.forEach(x=>items.push({date:x.createdAt,label:"Quotation "+(x.status||"created")}));
    renewals.forEach(x=>items.push({date:x.expiryDate,label:"Renewal "+(x.stage||"")}));
    claims.forEach(x=>items.push({date:x.lossDate||x.createdAt,label:"Claim "+(x.status||"reported")}));
    comms.forEach(x=>items.push({date:x.createdAt,label:"Communication via "+(x.channel||"")}));
    tasks.forEach(x=>items.push({date:x.dueDate,label:"Task "+(x.title||"")}));
    items.sort(function(a,b){return new Date(b.date||0)-new Date(a.date||0);});
    return '<div class="list">'+items.slice(0,12).map(function(x){return '<div class="list-row"><div><div class="list-title">'+esc(x.label)+
      '</div><div class="list-sub">'+fmtDate(x.date)+'</div></div><span>•</span></div>';}).join("")+'</div>';
  }

  async function pipeline(){
    var leads=await InsurNex.queryDocs("leads"),opps=await InsurNex.queryDocs("opportunities"),stages=["New","Contacted","Qualified","Quotation","Proposal","Negotiation","Won","Lost"];
    return '<div class="page-head"><div><div class="eyebrow">💼 '+t("pipeline")+'</div><h1>'+t("opportunities")+'</h1></div>'+
      '<div class="actions"><button class="btn btn-primary" data-add="opportunities">'+t("add")+' '+t("opportunities")+
      '</button><button class="btn" data-add="leads">'+t("add")+' '+t("leads")+'</button></div></div>'+
      '<div class="grid grid-4">'+stages.map(function(stage){var rs=leads.filter(function(x){return x.stage===stage;}).concat(opps.filter(function(x){return x.status===stage;}));
        return '<div class="card"><div class="page-head"><h3>'+esc(stage)+'</h3><span class="badge">'+rs.length+'</span></div>'+
          (rs.length?'<div class="list">'+rs.slice(0,8).map(function(r){return '<div class="card" style="padding:10px"><div class="list-title">'+esc(r.fullName||r.customerName||r.title||"Record")+
          '</div><div class="list-sub">'+esc(r.insuranceType||r.product||"")+'</div><div class="list-sub">'+fmtMoney(r.estimatedPremium||r.expectedCommission||0)+'</div></div>';}).join("")+
          '</div>':'<div class="empty">—</div>')+'</div>';}).join("")+'</div>';
  }

  function mobileRecordCards(viewName,rows,def){
    if(!rows.length)return '<div class="mobile-list"><div class="mobile-empty">'+t("empty")+'</div></div>';
    return '<div class="mobile-list">'+rows.map(function(r){
      var status=r.status||"—";
      var title=r[def.fields[0][0]]||r.customerName||r.policyNumber||"—";
      var metas=def.fields.slice(1,4).map(function(f){
        var v=r[f[0]];
        return v==null||v===""?"":'<span>'+esc(v)+'</span>';
      }).filter(Boolean).join("");
      return '<article class="record-card"><div class="record-card-head"><div><div class="record-card-title">'+esc(title)+'</div><div class="record-card-meta">'+metas+'</div></div><span class="badge '+(String(status).toLowerCase().indexOf("active")>=0||["Won","Paid","Approved","Completed","Renewed"].includes(status)?"success":"")+'">'+esc(status)+'</span></div>'+
        '<div class="record-card-actions">'+(viewName==="customers"?'<button class="btn btn-ghost" data-customer="'+r.id+'">'+t("customer360")+'</button>':'')+
        '<button class="btn btn-primary" data-edit="'+viewName+':'+r.id+'">'+t("edit")+'</button>'+
        '<button class="btn btn-danger" data-del="'+viewName+':'+r.id+'">'+t("delete")+'</button></div></article>';
    }).join("")+'</div>';
  }

  async function records(viewName){
    var def=Domain[viewName];
    if(!def)return '<div class="card empty">'+t("empty")+'</div>';
    var rows=await InsurNex.queryDocs(def.collection),q=search.toLowerCase();
    rows=rows.filter(function(r){return !q||JSON.stringify(r).toLowerCase().indexOf(q)>=0;});
    var head=def.fields.slice(0,6).map(function(f){return '<th>'+localLabel(f[1])+'</th>';}).join("");
    var body=rows.map(function(r){
      var status=r.status||"—";
      return '<tr>'+def.fields.slice(0,6).map(function(f){return '<td>'+esc(r[f[0]]==null||r[f[0]]===""?"—":r[f[0]])+'</td>';}).join("")+
        '<td><span class="badge '+(String(status).toLowerCase().indexOf("active")>=0||["Won","Paid","Approved","Completed","Renewed"].includes(status)?"success":"")+
        '">'+esc(status)+'</span></td><td><div class="actions">'+(viewName==="customers"?'<button class="btn" data-customer="'+r.id+'">'+t("customer360")+'</button>':'')+
        '<button class="btn" data-edit="'+viewName+':'+r.id+'">'+t("edit")+
        '</button><button class="btn btn-danger" data-del="'+viewName+':'+r.id+'">'+t("delete")+'</button></div></td></tr>';
    }).join("");
    return '<div class="page-head"><div><div class="eyebrow">'+def.icon+' '+localLabel(def.title)+'</div><h1>'+localLabel(def.title)+'</h1></div>'+
      '<div class="actions"><button class="btn btn-primary" data-add="'+viewName+'">'+t("add")+'</button><button class="btn" data-csv="'+viewName+'">CSV</button></div></div>'+
      '<div class="card" style="margin-bottom:14px"><div class="field"><label>'+t("search")+'</label><input id="search" value="'+esc(search)+'"></div></div>'+
      (rows.length?'<div class="table-wrap desktop-table"><table class="data-table"><thead><tr>'+head+'<th>'+t("status")+'</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>'+
      '<div class="section-note desktop-table-note" style="margin-top:10px">'+rows.length+' records · '+(state.online?t("online"):t("offline"))+'</div>'+
      '':'<div class="card empty desktop-table-empty">'+def.icon+'<br>'+t("empty")+'</div>')+
      mobileRecordCards(viewName,rows,def);
  }

  function formHtml(c,row){
    var def=Domain[c]; if(!def)return "";
    return '<form id="recordForm" class="form-stack"><div class="form-grid">'+def.fields.map(function(f){
      var key=f[0],lab=f[1],type=f[2],opts=f[3],value=row[key]??"";
      if(type==="textarea")return '<div class="field" style="grid-column:1/-1"><label>'+localLabel(lab)+'</label><textarea name="'+key+'">'+esc(value)+'</textarea></div>';
      if(type==="select")return '<div class="field"><label>'+localLabel(lab)+'</label><select name="'+key+'">'+String(opts).split(",").map(function(o){return '<option value="'+esc(o.trim())+'" '+(String(value)===o.trim()?"selected":"")+'>'+esc(o.trim())+'</option>';}).join("")+'</select></div>';
      return '<div class="field"><label>'+localLabel(lab)+'</label><input type="'+type+'" name="'+key+'" value="'+esc(value)+'"></div>';
    }).join("")+'</div><div class="form-actions"><button type="button" class="btn" data-close-modal>'+t("cancel")+
      '</button><button class="btn btn-primary">'+t("save")+'</button></div></form>';
  }

  async function edit(viewName,id){
    var def=Domain[viewName];if(!def)return;
    if(!id&&!InsurNex.can(viewName,"write")){toast(t("noPermission"),"error");return;}
    var cached=state.cache.get(def.collection)||[],row=id?(cached.find(function(x){return x.id===id;})||{}):{};
    modal(id?t("edit"):t("add"),formHtml(viewName,row));
    document.getElementById("recordForm").onsubmit=async function(e){
      e.preventDefault();var f=new FormData(e.currentTarget),d={};
      def.fields.forEach(function(x){var v=f.get(x[0]);d[x[0]]=x[2]==="number"&&v!==""?Number(v):v;});
      try{
        if(id){
          var existing=row;await db.collection(def.collection).doc(id).update(Object.assign({},d,{updatedAt:firebase.firestore.FieldValue.serverTimestamp()}));
          await InsurNex.writeAudit("update",def.collection,id,{},existing,Object.assign({},existing,d));
          await InsurNex.logActivity("update",def.collection+" / "+id);
        }else{
          var ref=await db.collection(def.collection).add(InsurNex.docPayload(d));
          await InsurNex.writeAudit("create",def.collection,ref.id,{},null,d);
          await InsurNex.logActivity("create",def.collection+" / "+ref.id);
          if(def.collection==="policies"&&Number(d.commissionAmount||0)>0){
            await db.collection("commissions").add(InsurNex.docPayload({
              policyNumber:d.policyNumber,customerName:d.customerName,insurer:d.insurer,brokerName:state.profile?.name||"",
              premium:Number(d.premium||0),commissionRate:Number(d.commissionRate||0),commissionAmount:Number(d.commissionAmount||0),
              paidCommission:0,commissionDate:d.startDate||null,status:"Expected"
            }));
          }
        }
        state.cache.clear();closeModal();toast(t("saved"));render();
      }catch(err){toast(friendlyError(err),"error");}
    };
  }

  async function del(viewName,id){
    var def=Domain[viewName];if(!def||!confirm(t("delete")+"?"))return;
    if(!InsurNex.can(viewName,"write")){toast(t("noPermission"),"error");return;}
    try{
      var snap=await db.collection(def.collection).doc(id).get(),before=snap.exists?snap.data():null;
      await db.collection(def.collection).doc(id).delete();
      await InsurNex.writeAudit("delete",def.collection,id,{},before,null);
      state.cache.clear();toast(t("deleted"));render();
    }catch(err){toast(friendlyError(err),"error");}
  }

  async function documents(){
    var rows=await InsurNex.queryDocs("documents");
    return '<div class="page-head"><div><div class="eyebrow">📎 '+t("documents")+'</div><h1>'+t("documents")+
      '</h1><div class="muted">Secure workspace document management</div></div><button class="btn btn-primary" id="upload">'+t("add")+
      '</button></div>'+(rows.length?'<div class="grid grid-2">'+rows.map(function(r){return '<div class="card"><div class="list-title">'+esc(r.name||r.fileName||"Document")+
      '</div><div class="list-sub">'+esc(r.category||r.entityType||"")+' · '+esc(r.fileName||"")+'</div><div class="actions" style="margin-top:10px"><a class="btn" href="'+
      esc(r.url||"#")+'" target="_blank" rel="noopener">'+t("open")+'</a></div></div>';}).join("")+
      '</div>':'<div class="card empty">📎<br>'+t("empty")+'</div>');
  }

  async function upload(){
    modal(t("documents"),'<form id="docForm" class="form-stack"><div class="form-grid"><div class="field"><label>'+t("name")+'</label><input name="name" required></div>'+
      '<div class="field"><label>File</label><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" required></div>'+
      '<div class="field"><label>'+t("type")+'</label><select name="entityType"><option>Customer</option><option>Policy</option><option>Claim</option><option>Quotation</option><option>Company</option></select></div>'+
      '<div class="field"><label>'+t("category")+'</label><input name="category"></div><div class="field"><label>'+t("policyNumber")+'</label><input name="entityId"></div></div>'+
      '<div class="form-actions"><button class="btn" type="button" data-close-modal>'+t("cancel")+'</button><button class="btn btn-primary">'+t("save")+'</button></div></form>');
    document.getElementById("docForm").onsubmit=async function(e){
      e.preventDefault();var f=new FormData(e.currentTarget),file=f.get("file");
      if(!file||!file.name)return;
      if(file.size>10*1024*1024){toast("Maximum file size is 10 MB","error");return;}
      try{
        var workspaceId=state.workspace.id||state.user.uid,safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path="documents/"+workspaceId+"/"+Date.now()+"_"+safe;
        var ref=storage.ref(path);await ref.put(file);var url=await ref.getDownloadURL();
        var data=InsurNex.docPayload({name:f.get("name"),entityType:f.get("entityType"),entityId:f.get("entityId"),category:f.get("category"),
          fileName:file.name,mimeType:file.type,size:file.size,storagePath:path,url:url,status:"active"});
        var snap=await db.collection("documents").add(data);await InsurNex.writeAudit("create","documents",snap.id);state.cache.clear();closeModal();toast(t("saved"));render();
      }catch(err){toast(friendlyError(err),"error");}
    };
  }

  async function notifications(){
    var s=await db.collection("notifications").where("recipientId","==",state.user.uid).limit(50).get(),rows=s.docs.map(function(d){return {id:d.id,...d.data()};});
    return '<div class="page-head"><div><div class="eyebrow">🔔 '+t("notifications")+'</div><h1>'+t("notifications")+'</h1></div></div>'+
      '<div class="card">'+(rows.length?'<div class="list">'+rows.map(function(r){return '<div class="list-row"><div class="list-main"><div class="list-title">'+esc(r.title||"Notification")+
      '</div><div class="list-sub">'+esc(r.body||"")+' · '+fmtDate(r.createdAt)+'</div></div><span class="badge '+(r.read?"":"warn")+'">'+(r.read?"✓":"new")+
      '</span></div>';}).join("")+'</div>':'<div class="empty">🔔<br>'+t("empty")+'</div>')+'</div>';
  }

  async function subscription(){
    var rows=await InsurNex.queryDocs("subscriptions");
    return '<div class="page-head"><div><div class="eyebrow">💳 '+t("subscriptions")+'</div><h1>'+t("subscriptions")+'</h1></div></div>'+
      '<div class="grid grid-3">'+["Free","Professional","Business","Enterprise"].map(function(plan){var active=rows.some(function(r){return r.plan===plan&&r.status==="active";});
        return '<div class="card"><div class="eyebrow">'+esc(plan)+'</div><h3>'+esc(plan)+'</h3><div class="list"><div class="list-row"><span>Status</span><strong>'+
        (active?t("active"):"Available")+'</strong></div><div class="list-row"><span>'+t("customers")+'</span><strong>Configurable</strong></div><div class="list-row"><span>'+t("team")+'</span><strong>'+(["Business","Enterprise"].includes(plan)?"Multi-user":"Single workspace")+
        '</strong></div></div></div>';}).join("")+'</div><div class="section-note" style="margin-top:12px">Pricing and limits are configuration-driven and managed by platform administration.</div>';
  }

  async function team(){
    if(state.workspace.type!=="organization")return '<div class="card empty">'+t("organizationWorkspace")+' required.</div>';
    var members=await db.collection("organizationMembers").where("organizationId","==",state.workspace.id).limit(100).get();
    var teams=await InsurNex.queryDocs("teams");
    return '<div class="page-head"><div><div class="eyebrow">👨‍👩‍👧‍👦 '+t("team")+'</div><h1>'+t("teamPerformance")+'</h1></div>'+
      '<button class="btn btn-primary" data-add="teams">'+t("add")+' '+t("team")+'</button></div>'+
      '<div class="stats"><div class="stat"><div class="value">'+members.size+'</div><div class="label">'+t("employees")+'</div></div>'+
      '<div class="stat"><div class="value">'+teams.length+'</div><div class="label">'+t("team")+'</div></div></div>'+
      '<div class="grid grid-2" style="margin-top:14px"><div class="card"><h3>'+t("employees")+'</h3><div class="list">'+
      members.docs.map(function(d){var x=d.data();return '<div class="list-row"><div><div class="list-title">'+esc(x.userId)+'</div><div class="list-sub">'+esc(x.role||"")+'</div></div><span class="badge">'+esc(x.status||"active")+'</span></div>';}).join("")+
      '</div></div><div class="card"><h3>'+t("team")+'</h3>'+miniRows(teams,["name","managerName","status"])+'</div></div>';
  }

  async function analytics(){
    var leads=await InsurNex.queryDocs("leads"),policies=await InsurNex.queryDocs("policies"),renewals=await InsurNex.queryDocs("renewals"),
      claims=await InsurNex.queryDocs("claims"),comm=await InsurNex.queryDocs("commissions"),customersRows=await InsurNex.queryDocs("customers");
    var won=leads.filter(function(x){return x.stage==="Won";}).length, conversion=leads.length?Math.round(won/leads.length*100):0;
    var premium=policies.reduce(function(n,x){return n+Number(x.premium||0);},0);
    var expected=comm.reduce(function(n,x){return n+Number(x.commissionAmount||0);},0),paid=comm.filter(function(x){return x.status==="Paid";}).reduce(function(n,x){return n+Number(x.paidCommission||x.commissionAmount||0);},0);
    var openClaims=claims.filter(function(x){return !["Settled","Closed","Rejected"].includes(x.status);}).length;
    var renewalRate=renewals.length?Math.round(renewals.filter(function(x){return x.status==="Renewed";}).length/renewals.length*100):0;
    return '<div class="page-head"><div><div class="eyebrow">📊 '+t("analytics")+'</div><h1>'+t("analytics")+'</h1></div></div>'+
      '<div class="stats"><div class="stat"><div class="value">'+conversion+'%</div><div class="label">Lead conversion</div></div>'+
      '<div class="stat"><div class="value">'+customersRows.length+'</div><div class="label">'+t("totalCustomers")+'</div></div>'+
      '<div class="stat"><div class="value">'+fmtMoney(premium)+'</div><div class="label">'+t("premium")+'</div></div>'+
      '<div class="stat"><div class="value">'+fmtMoney(expected)+'</div><div class="label">'+t("expectedCommission")+'</div></div>'+
      '<div class="stat"><div class="value">'+fmtMoney(paid)+'</div><div class="label">'+t("paidCommission")+'</div></div>'+
      '<div class="stat"><div class="value">'+renewalRate+'%</div><div class="label">'+t("renewalRate")+'</div></div>'+
      '<div class="stat"><div class="value">'+openClaims+'</div><div class="label">'+t("pendingClaims")+'</div></div>'+
      '<div class="stat"><div class="value">'+policies.length+'</div><div class="label">'+t("policies")+'</div></div></div>'+
      '<div class="grid grid-2" style="margin-top:14px"><div class="card"><h3>'+t("pipeline")+'</h3>'+pipelineSummary(leads,[])+'</div>'+
      '<div class="card"><h3>'+t("claims")+'</h3>'+miniRows(claims,["claimNumber","status","amount"])+'</div></div>';
  }

  async function reports(){
    var data=await Promise.all(["customers","leads","policies","renewals","claims","commissions"].map(function(c){return InsurNex.queryDocs(c);}));
    var titles=[t("customers"),t("leads"),t("policies"),t("renewals"),t("claims"),t("commissions")];
    var values=data.map(function(x){return x.length;});
    return '<div class="page-head"><div><div class="eyebrow">📈 '+t("reports")+'</div><h1>'+t("reports")+'</h1></div>'+
      '<div class="actions"><button class="btn" id="exportReport">CSV</button></div></div>'+
      '<div class="grid grid-3">'+values.map(function(v,i){return '<div class="card"><div class="eyebrow">'+esc(titles[i])+'</div><div class="stat" style="margin-top:8px"><div class="value">'+v+
      '</div><div class="label">'+esc(titles[i])+'</div></div></div>';}).join("")+'</div>'+
      '<div class="card" style="margin-top:14px"><h3>'+t("performance")+'</h3><p class="section-note">Reports are computed from the active workspace and can be exported for downstream Excel/PDF tooling.</p></div>';
  }

  async function searchPage(){
    var q=prompt(t("globalSearch"),"")||"";search=q.trim();if(!search)return '<div class="card empty">'+t("empty")+'</div>';
    var modules=["customers","leads","opportunities","quotations","policies","claims","tasks","documents","insurers","insuranceProducts"];
    var out=[];
    for(var i=0;i<modules.length;i++){
      var key=Domain[modules[i]]?Domain[modules[i]].collection:modules[i], rows=await InsurNex.queryDocs(key, state.workspace, 30);
      rows.filter(function(r){return JSON.stringify(r).toLowerCase().indexOf(search.toLowerCase())>=0;}).slice(0,6).forEach(function(r){out.push({module:modules[i],row:r});});
    }
    return '<div class="page-head"><div><div class="eyebrow">⌕ '+t("globalSearch")+'</div><h1>'+esc(search)+'</h1></div></div>'+
      (out.length?'<div class="grid grid-2">'+out.map(function(x){return '<div class="card"><div class="eyebrow">'+esc(x.module)+'</div><div class="list-title">'+
      esc(x.row.fullName||x.row.customerName||x.row.name||x.row.title||x.row.policyNumber||x.row.claimNumber||"Record")+'</div>'+
      '<div class="list-sub">'+esc(x.row.status||x.row.stage||x.row.email||"")+'</div></div>';}).join("")+
      '</div>':'<div class="card empty">'+t("empty")+'</div>');
  }

  async function crossSellSuggestions(customersRows,policies){
    var result=[];
    var lines=["Motor","Medical","Life","Property","Travel","Marine","Engineering","Liability"];
    customersRows.slice(0,50).forEach(function(c){
      var types=policies.filter(function(p){return p.customerName===c.fullName||p.customerId===c.id;}).map(function(p){return String(p.insuranceType||"");});
      if(!types.length)return;
      var missing=lines.find(function(x){return !types.includes(x);});
      if(missing)result.push({customer:c.fullName,suggestion:missing+" insurance may be a potential cross-sell."});
    });
    return result;
  }

  function account(){
    var p=state.profile||{};
    return '<div class="page-head"><div><div class="eyebrow">⚙️ '+t("account")+'</div><h1>'+t("profile")+'</h1></div>'+
      '<div class="actions"><button class="btn btn-primary" id="profileEdit">'+t("edit")+'</button></div></div>'+
      '<div class="grid grid-2"><div class="card"><h3>'+esc(p.name||"")+'</h3><div class="muted">'+esc(state.user.email||"")+'</div>'+
      '<div class="list" style="margin-top:12px"><div class="list-row"><span>'+t("mobile")+'</span><strong>'+esc(p.mobile||"—")+'</strong></div>'+
      '<div class="list-row"><span>'+t("accountType")+'</span><strong>'+esc(p.accountType||"—")+'</strong></div>'+
      '<div class="list-row"><span>'+t("role")+'</span><strong>'+esc((p.roles||[]).join(" · "))+'</strong></div>'+
      '<div class="list-row"><span>'+t("country")+'</span><strong>'+esc(p.country||"—")+'</strong></div>'+
      '<div class="list-row"><span>'+t("city")+'</span><strong>'+esc(p.city||"—")+'</strong></div></div></div>'+
      '<div class="card"><h3>'+t("switchWorkspace")+'</h3><div class="list">'+
      ([{type:"personal",id:null,name:t("personalWorkspace")}].concat(state.memberships.map(function(m){return {type:"organization",id:m.organizationId,name:m.organizationName||t("organizationWorkspace")};}))).map(function(w){
        return '<div class="list-row"><div class="list-title">'+esc(w.name)+'</div><button class="btn" data-workspace="'+esc(JSON.stringify(w))+'">'+
        (state.workspace.type===w.type&&state.workspace.id===w.id?"✓":t("switchWorkspace"))+'</button></div>';
      }).join("")+'</div></div></div>'+
      '<div class="card" style="margin-top:14px"><h3>'+t("settings")+'</h3><div class="list"><div class="list-row"><span>'+t("language")+'</span><button class="btn" id="langPage">AR / EN</button></div>'+
      '<div class="list-row"><span>'+t("security")+'</span><span class="badge success">Firebase Auth + RBAC</span></div>'+
      '<div class="list-row"><span>'+t("legalDisclaimer")+'</span><span class="muted">Configurable by Admin</span></div></div></div>';
  }

  function profileEdit(){
    var p=state.profile||{};
    modal(t("profile"),'<form id="profileForm" class="form-stack"><div class="form-grid"><div class="field"><label>'+t("name")+'</label><input name="name" value="'+esc(p.name||"")+'"></div>'+
      '<div class="field"><label>'+t("mobile")+'</label><input name="mobile" value="'+esc(p.mobile||"")+'"></div><div class="field"><label>'+t("country")+
      '</label><input name="country" value="'+esc(p.country||"")+'"></div><div class="field"><label>'+t("city")+'</label><input name="city" value="'+esc(p.city||"")+
      '"></div></div><button class="btn btn-primary">'+t("save")+'</button></form>');
    document.getElementById("profileForm").onsubmit=async function(e){e.preventDefault();try{var d=Object.fromEntries(new FormData(e.currentTarget));
      await db.collection("users").doc(state.user.uid).update(Object.assign({},d,{updatedAt:firebase.firestore.FieldValue.serverTimestamp()}));
      await InsurNex.loadIdentity();closeModal();shell();render();toast(t("saved"));
    }catch(err){toast(friendlyError(err),"error");}};
  }

  function csvExport(rows,fileName){
    if(!rows.length){toast(t("empty"),"error");return;}
    var keys=Object.keys(rows[0]).filter(function(k){return k!=="id";});
    var out=[keys.join(",")].concat(rows.map(function(r){return keys.map(function(k){var v=r[k];if(v&&v.toDate)v=v.toDate().toISOString();v=String(v==null?"":v).replace(/"/g,'""');return '"'+v+'"';}).join(",");}));
    var blob=new Blob(["\ufeff"+out.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url);
  }

  function wire(){
    var s=document.getElementById("search");
    if(s)s.oninput=function(){search=this.value;render();};
    document.querySelectorAll("[data-add]").forEach(function(b){b.onclick=function(){edit(b.dataset.add,null);};});
    document.querySelectorAll("[data-edit]").forEach(function(b){var p=b.dataset.edit.split(":");b.onclick=function(){edit(p[0],p[1]);};});
    document.querySelectorAll("[data-del]").forEach(function(b){var p=b.dataset.del.split(":");b.onclick=function(){del(p[0],p[1]);};});
    document.querySelectorAll("[data-customer]").forEach(function(b){b.onclick=function(){customer360(b.dataset.customer);};});
    document.querySelectorAll("[data-workspace]").forEach(function(b){b.onclick=function(){try{InsurNex.setWorkspace(JSON.parse(b.dataset.workspace));shell();render();}catch(e){}};});
    document.querySelectorAll("[data-route]").forEach(function(b){b.onclick=function(){navigate(b.dataset.route);};});
    document.getElementById("upload")?.addEventListener("click",upload);
    document.getElementById("profileEdit")?.addEventListener("click",profileEdit);
    document.getElementById("langPage")?.addEventListener("click",function(){InsurNex.setLanguage(InsurNex.locale()==="ar"?"en":"ar");shell();render();});
    document.getElementById("exportReport")?.addEventListener("click",async function(){var rows=await InsurNex.queryDocs("policies");csvExport(rows,"insurnex-report.csv");});
  }

  async function globalSearch(){location.hash="global-search";view="global-search";await render();}
  async function logout(){await auth.signOut();location.hash="";authPage("login");}

  document.addEventListener("click",function(e){if(e.target.matches("[data-close-modal]")||e.target.id==="modal")closeRecordModal();});
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(function(e){console.warn("InsurNex service worker unavailable",e);});}
  auth.onAuthStateChanged(async function(user){
    try{if(!user){authPage("login");return;}await InsurNex.loadIdentity();await enter();}
    catch(e){console.error(e);authPage("login",friendlyError(e));}
  });
  window.addEventListener("hashchange",function(){view=(location.hash||"#home").slice(1);if(state.user){shell();render();}});
  document.addEventListener("insurnex:language",function(){if(state.user){shell();render();}});
  document.addEventListener("insurnex:workspace",function(){if(state.user){shell();render();}});
})();