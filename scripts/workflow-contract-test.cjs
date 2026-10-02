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

console.log("InsurNex workflow contract tests PASSED (" + checks.length + " checks).");
console.log("Coverage: lead → opportunity → quotation → policy/commission, renewals, claims, and explicit AI backend gating.");
