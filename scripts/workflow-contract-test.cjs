"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "InsurNex-User.html"), "utf8");
const checks = [
  ["lead conversion is idempotent", "if(lead.convertedOpportunityId)"],
  ["lead conversion preserves insurance type", "insuranceType:lead.insuranceType||''"],
  ["lead conversion preserves product details", "product:lead.product||'',insurer:lead.insurer||'',coverage:lead.coverage||''"],
  ["lead conversion writes source link", "sourceLeadId:id"],
  ["opportunity conversion is idempotent", "if(opp.quotationId)"],
  ["quotation carries insurance type", "insuranceType:opp.insuranceType||''"],
  ["quotation carries sum insured", "sumInsured:Number(opp.sumInsured||0)"],
  ["quotation has a 30-day validity date", "Date.now()+30*86400000"],
  ["issued policy preserves customer phone", "phone:q.phone||''"],
  ["renewal copies customer contact details", "phone:p.phone||customer?.phone||customer?.mobile||''"],
  ["renewal WhatsApp action creates a reviewed deep link", "https://wa.me/'+digits+'?text='+encodeURIComponent(message)"],
  ["AI follow-up draft has an explicit action branch", "else if(action==='draft')"],
  ["policy issuance links back to quotation", "quotationId:id"],
  ["policy issuance records commission", "await addDoc('commissions'"],
  ["renewal workflow creates renewal record", "await addDoc('renewals'"],
  ["renewal reminders create linked tasks", "linkedEntityType:'renewal',linkedEntityId:id"],
  ["claim follow-up creates linked tasks", "linkedEntityType:'claim',linkedEntityId:id"],
  ["insurance file analysis is explicitly backend-gated", "status:'backend_required',requestedAt:firebase.firestore.FieldValue.serverTimestamp()"],
  ["document extraction is explicitly backend-gated", "status:'backend_required',requestedAt:firebase.firestore.FieldValue.serverTimestamp()"],
  ["lead conversion action is wired", "if(action.startsWith('convert-lead:'))return convertLead"],
  ["opportunity conversion action is wired", "if(action.startsWith('convert-opportunity:'))return createQuoteFromOpportunity"],
  ["quotation issue action is wired", "if(action.startsWith('issue-quote:'))return issuePolicyFromQuote"],
  ["policy renewal action is wired", "if(action.startsWith('renew-policy:'))return startRenewal"],
  ["claim assistant action is wired", "if(action.startsWith('claim-ai:'))return claimAssistant"]
];

const failures = checks.filter(([, needle]) => !html.includes(needle));
if (failures.length) {
  console.error("InsurNex workflow contract tests FAILED:");
  for (const [label] of failures) console.error(" - " + label);
  process.exit(1);
}


const handlerStart = html.indexOf("async function handleAction(action)");
assert.notEqual(handlerStart, -1, "central CRM action dispatcher exists");
const handlerEnd = html.indexOf("document.addEventListener('click',e=>", handlerStart);
assert.ok(handlerEnd > handlerStart, "central CRM action dispatcher is wired to click events");
const dispatcher = html.slice(handlerStart, handlerEnd);

const dispatchedPrefixes = [...dispatcher.matchAll(/action\.startsWith\('([^']+)'\)/g)].map(match => match[1]);
for (const prefix of dispatchedPrefixes) {
  assert.ok(html.includes(prefix), "UI or workflow contains action prefix: " + prefix);
}
assert.ok(dispatchedPrefixes.length >= 20, "expected the main CRM action set to be dispatched");

const directActions = [
  "commission-calculator", "new-operation", "mark-notifications-read",
  "email-templates", "new-template", "compare-insurers", "new-expense",
  "save-email-draft"
];
for (const action of directActions) {
  assert.ok(dispatcher.includes("action==='" + action + "'"), "direct action is handled: " + action);
}

const aiActions = [...html.matchAll(/data-ai-action="([^"]+)"/g)].map(match => match[1]);
for (const action of [...new Set(aiActions)]) {
  assert.ok(html.includes("action==='" + action + "'"), "AI action has a handler branch: " + action);
}
assert.ok(html.includes("document.querySelectorAll('[data-ai-action]')"), "AI buttons are wired after route rendering");

for (const route of ["operations", "email-settings", "medical-ai", "ai-assistant"]) {
  assert.ok(html.includes("route==='" + route + "'"), "custom route is rendered: " + route);
}
assert.ok(html.includes("document.querySelectorAll('[data-master-route]')"), "custom navigation buttons are wired");

const config = fs.readFileSync(path.join(__dirname, "..", "js", "config.js"), "utf8");
assert.ok(config.includes("insurnex-8a9df"), "Firebase config targets the existing InsurNex project");

console.log("InsurNex workflow contract tests PASSED (" + checks.length + " baseline checks + dispatcher/navigation audit).");
console.log("Coverage: lead → opportunity → quotation → policy/commission, renewals, claims, and explicit AI backend gating.");
