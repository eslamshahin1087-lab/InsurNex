#!/usr/bin/env node
"use strict";

const admin=require("firebase-admin");

function env(name, fallback){
  return process.env[name] || fallback;
}
function sourceWorkspace(data){
  const organizationId=data.organizationId || null;
  const ownerId=data.ownerId || data.userId || data.createdBy || data.uid || null;
  if(organizationId){
    return {workspaceType:"organization",organizationId,ownerId};
  }
  return ownerId ? {workspaceType:"personal",organizationId:null,ownerId} : null;
}
function clean(value){return value===undefined||value===null?"":value;}
function mapDoc(source,data){
  const ws=sourceWorkspace(data);
  if(!ws)return null;
  return {
    ...data,...ws,
    migratedFrom:{collection:source,documentId:data.__sourceId||null},
    migratedAt:admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
}
const MAP={
  clients:"customers",
  quotes:"quotations",
  appointments:"calendarEvents",
  messages:"communications",
  products:"insuranceProducts"
};
const targetId=(source,id)=>"legacy_"+source+"_"+id;

async function main(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  const service=JSON.parse(raw);
  if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
  const db=admin.firestore();

  const summary=[];
  for(const [source,target] of Object.entries(MAP)){
    const snap=await db.collection(source).get();
    let migrated=0,skipped=0;
    const commits=[];
    for(const doc of snap.docs){
      const data={...doc.data(),__sourceId:doc.id};
      const payload=mapDoc(source,data);
      if(!payload){skipped++;continue;}
      delete payload.__sourceId;
      if(target==="customers"){
        payload.fullName=clean(payload.fullName||payload.name||payload.displayName);
        payload.type=payload.type||"individual";
      }
      if(target==="quotations"){
        payload.status=payload.status||"Draft";
      }
      if(target==="calendarEvents"){
        payload.status=payload.status||"scheduled";
      }
      if(target==="communications"){
        payload.channel=payload.channel||"In-app";
      }
      if(target==="insuranceProducts"){
        payload.status=payload.status||"active";
        payload.published=true;
      }
      commits.push({source, target, id:doc.id, payload});
      if(commits.length===400){
        const batch=db.batch();
        commits.splice(0).forEach(x=>batch.set(db.collection(x.target).doc(targetId(x.source,x.id)),x.payload,{merge:true}));
        await batch.commit();
        migrated+=400;
      }
    }
    if(commits.length){
      const batch=db.batch();
      commits.splice(0).forEach(x=>batch.set(db.collection(x.target).doc(targetId(x.source,x.id)),x.payload,{merge:true}));
      await batch.commit();
      migrated+=commits.length;
    }
    summary.push({source,target,migrated,skipped});
  }
  console.table(summary);
  console.log("Migration is non-destructive: source collections are never deleted or modified.");
}
main().catch(e=>{console.error(e);process.exit(1);});
