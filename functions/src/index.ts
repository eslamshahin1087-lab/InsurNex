import Anthropic from '@anthropic-ai/sdk';
import { onCall,HttpsError,onRequest } from 'firebase-functions/v2/https';
import { defineSecret,defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue,getFirestore } from 'firebase-admin/firestore';
import { createHash,timingSafeEqual } from 'node:crypto';
initializeApp();
const ANTHROPIC_API_KEY=defineSecret('ANTHROPIC_API_KEY');
const INEX_INGEST_SECRET=defineSecret('INEX_INGEST_SECRET');
const INEX_RECEIVER_EMAIL='securepath@nex.com';
const CLAUDE_MODEL=defineString('CLAUDE_MEDICAL_MODEL',{default:'claude-haiku-4-5'});
type Metric={name:string;amount:number;share:number};type Signal={level:string;title:string;finding:string;evidence:string[];action:string};
interface MedicalContext{language:'ar'|'en';records:number;members:number;providers:number;gross:number;copay:number;net:number;copayRate:number;avgTransaction:number;avgMember:number;top10Share:number;top50Share:number;above50k:number;above100k:number;costDrivers:Metric[];providersRanked:Array<{name:string;count:number;members:number;gross:number;share:number;severity:number}>;membersRanked:Array<{name:string;count:number;gross:number;share:number;severity:number}>;activities:Array<{name:string;count:number;gross:number;share:number;severity:number}>;trend:Array<{month:string;count:number;members:number;gross:number;severity:number;partial:boolean}>;signals:Signal[];dataGaps:string[]}
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);function valid(x:MedicalContext){return x&&['ar','en'].includes(x.language)&&finite(x.records)&&finite(x.gross)&&Array.isArray(x.costDrivers)&&x.costDrivers.length<=12&&x.providersRanked.length<=12&&x.membersRanked.length<=12&&x.activities.length<=15&&x.trend.length<=36}
const schema={type:'object',properties:{executiveSummary:{type:'string'},keyFindings:{type:'array',items:{type:'string'}},costDrivers:{type:'array',items:{type:'string'}},memberInsights:{type:'array',items:{type:'string'}},providerInsights:{type:'array',items:{type:'string'}},trendInsights:{type:'array',items:{type:'string'}},riskSignals:{type:'array',items:{type:'string'}},caseManagementOpportunities:{type:'array',items:{type:'string'}},renewalConsiderations:{type:'array',items:{type:'string'}},recommendedActions:{type:'array',items:{type:'string'}},dataLimitations:{type:'array',items:{type:'string'}}},required:['executiveSummary','keyFindings','costDrivers','memberInsights','providerInsights','trendInsights','riskSignals','caseManagementOpportunities','renewalConsiderations','recommendedActions','dataLimitations'],additionalProperties:false};
export const medicalClaudeAnalysis=onCall({region:'europe-west1',secrets:[ANTHROPIC_API_KEY],enforceAppCheck:true,timeoutSeconds:60,memory:'512MiB',maxInstances:5},async(req)=>{if(!req.auth)throw new HttpsError('unauthenticated','Authentication required.');const ctx=req.data?.context as MedicalContext;if(!valid(ctx))throw new HttpsError('invalid-argument','Invalid or oversized medical analytics context.');const client=new Anthropic({apiKey:ANTHROPIC_API_KEY.value(),timeout:45000,maxRetries:2});const language=ctx.language==='ar'?'Arabic':'English';const payload=JSON.stringify(ctx);try{const message=await client.messages.create({model:CLAUDE_MODEL.value(),max_tokens:2200,temperature:0.2,system:`You are InsurNex Medical Insurance Intelligence. Analyze insurance utilization and portfolio cost only. Never diagnose, recommend treatment, or infer missing facts. Treat all numeric metrics in the supplied JSON as authoritative deterministic calculations. Clearly distinguish evidence from interpretation. Respond in ${language}. Return only JSON matching this schema: ${JSON.stringify(schema)}`,messages:[{role:'user',content:`Analyze this aggregated medical insurance context. Do not recalculate or invent values. Context: ${payload}`}]});const text=message.content.filter(x=>x.type==='text').map(x=>x.text).join('').trim().replace(/^```json\s*/,'').replace(/```$/,'').trim();let analysis:unknown;try{analysis=JSON.parse(text)}catch{throw new HttpsError('internal','Claude returned invalid structured output.');}return{analysis,usage:message.usage,model:message.model};}catch(e){if(e instanceof HttpsError)throw e;console.error('medicalClaudeAnalysis failed',e);throw new HttpsError('unavailable','AI analysis is temporarily unavailable. Deterministic analytics remain available.')}});

// InsurNex AI Copilot
export { copilotChat } from './copilot';


/**
 * Server-to-server ingress for iNex account registrations.
 * The shared secret is configured separately in Firebase Functions and Cloudflare.
 * Only minimal lead-contact data is accepted; passwords and authentication tokens
 * from iNex are never transferred into the CRM.
 */
export const ingestINexLead=onRequest({
  region:'europe-west1',
  secrets:[INEX_INGEST_SECRET],
  timeoutSeconds:20,
  maxInstances:5,
},async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(req.method!=='POST'){
    res.set('Allow','POST');
    res.status(405).json({ok:false,error:'Method not allowed.'});
    return;
  }

  const expected=Buffer.from(INEX_INGEST_SECRET.value());
  const authorization=req.get('authorization')||'';
  const match=/^Bearer\s+(.+)$/i.exec(authorization);
  const supplied=Buffer.from(match?.[1]||'');
  if(expected.length<32||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){
    res.status(401).json({ok:false,error:'Unauthorized.'});
    return;
  }

  const body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  const sourceUid=typeof body.sourceUid==='string'?body.sourceUid.trim():'';
  const name=typeof body.fullName==='string'?body.fullName.trim():'';
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const phone=typeof body.phone==='string'?body.phone.trim():'';
  const clientType=typeof body.clientType==='string'?body.clientType.trim().slice(0,40):'individual';
  const businessName=typeof body.businessName==='string'?body.businessName.trim().slice(0,180):'';

  if(!/^[A-Za-z0-9_-]{1,128}$/.test(sourceUid)||!name||name.length>160||
     !/^\S+@\S+\.\S+$/.test(email)||email.length>254||!phone||phone.length>40){
    res.status(400).json({ok:false,error:'Invalid lead payload.'});
    return;
  }

  try{
    const db=getFirestore();
    const receiver=await getAuth().getUserByEmail(INEX_RECEIVER_EMAIL);
    const receiverProfileSnap=await db.collection('users').doc(receiver.uid).get();
    if(!receiverProfileSnap.exists){
      res.status(503).json({ok:false,error:'InsurNex receiving account profile is not configured.'});
      return;
    }
    const receiverProfile=receiverProfileSnap.data()||{};
    const organizationId=typeof receiverProfile.organizationId==='string'?receiverProfile.organizationId:'';
    if(receiverProfile.status!=='active'||!organizationId){
      res.status(503).json({ok:false,error:'InsurNex receiving account is not active or has no organization.'});
      return;
    }
    const organizationSnap=await db.collection('organizations').doc(organizationId).get();
    if(!organizationSnap.exists){
      res.status(503).json({ok:false,error:'InsurNex receiving organization does not exist.'});
      return;
    }

    // A deterministic document ID makes retries safe and prevents duplicate leads
    // when the same iNex account signs in or retries the integration request.
    const sourceHash=createHash('sha256').update(sourceUid).digest('hex').slice(0,32);
    const leadId='sp_'+sourceHash;
    const leadRef=db.collection('leads').doc(leadId);
    const activityRef=db.collection('leadActivities').doc(leadId+'_created');
    const assignedToName=String(receiverProfile.displayName||receiver.displayName||'iNex').trim();
    const notes=[
      'Source: iNex',
      'iNex account ID: '+sourceUid,
      'Client type: '+(clientType||'individual'),
    ].filter(Boolean).join('\n');

    const outcome=await db.runTransaction(async(tx)=>{
      const existing=await tx.get(leadRef);
      if(existing.exists){
        const data=existing.data()||{};
        if(data.sourceSystem!=='iNex'||data.sourceExternalId!==sourceUid){
          throw new Error('LEAD_ID_COLLISION');
        }
        return {leadId,alreadyExists:true};
      }
      const now=FieldValue.serverTimestamp();
      tx.create(leadRef,{
        organizationId,
        name,
        companyName:clientType==='corporate'?businessName:'',
        phone,
        email,
        source:'website',
        priority:'medium',
        stage:'new',
        insuranceType:'Not specified',
        preferredInsurerId:'',
        preferredInsurerName:'',
        estimatedValue:0,
        assignedTo:receiver.uid,
        assignedToName,
        notes,
        lostReason:'',
        createdBy:receiver.uid,
        sourceSystem:'iNex',
        sourceExternalId:sourceUid,
        lastActivityAt:now,
        createdAt:now,
        updatedAt:now,
      });
      tx.create(activityRef,{
        organizationId,
        leadId,
        type:'created',
        message:'تم استلام Lead من SecurePath',
        createdBy:receiver.uid,
        createdAt:now,
      });
      return {leadId,alreadyExists:false};
    });
    res.status(200).json({ok:true,...outcome});
  }catch(error){
    const message=error instanceof Error?error.message:'Unknown error';
    console.error('ingestINexLead failed:',message);
    if(message==='auth/user-not-found'){
      res.status(503).json({ok:false,error:'InsurNex receiving account does not exist.'});
      return;
    }
    res.status(500).json({ok:false,error:'Unable to import this lead into InsurNex.'});
  }
});

