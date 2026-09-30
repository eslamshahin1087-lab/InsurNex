"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, updateDoc, deleteDoc, getDoc } = require("firebase/firestore");

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: "demo-insurnex-rules",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
  });

  try {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, "organizations/org-1"), { ownerId: "owner-1", name: "Test Brokerage" });
      const members = [
        { id: "org-1_owner-1", userId: "owner-1", role: "organizationOwner" },
        { id: "org-1_admin-1", userId: "admin-1", role: "organizationAdmin" },
        { id: "org-1_manager-1", userId: "manager-1", role: "manager" },
        { id: "org-1_broker-1", userId: "broker-1", role: "broker" }
      ];
      for (const member of members) {
        await setDoc(doc(db, "organizationMembers/" + member.id), {
          organizationId: "org-1", userId: member.userId, role: member.role,
          status: "active", createdAt: "original-created-at"
        });
      }
      await setDoc(doc(db, "users/user-1"), {
        uid: "user-1", accountType: "individual_broker", roles: ["broker"], name: "Test User"
      });
      await setDoc(doc(db, "leads/org-lead"), {
        workspaceType: "organization", organizationId: "org-1", ownerId: "owner-1", title: "Private lead"
      });
    });

    const ownerDb = testEnv.authenticatedContext("owner-1").firestore();
    const adminDb = testEnv.authenticatedContext("admin-1").firestore();
    const managerDb = testEnv.authenticatedContext("manager-1").firestore();
    const brokerDb = testEnv.authenticatedContext("broker-1").firestore();
    const outsiderDb = testEnv.authenticatedContext("outsider-1").firestore();
    const userDb = testEnv.authenticatedContext("user-1").firestore();

    await assertFails(updateDoc(doc(managerDb, "organizationMembers/org-1_manager-1"), { role: "organizationOwner" }));
    await assertFails(deleteDoc(doc(managerDb, "organizationMembers/org-1_owner-1")));
    await assertFails(setDoc(doc(managerDb, "organizationMembers/org-1_escalation"), {
      organizationId: "org-1", userId: "escalation", role: "organizationOwner", status: "active"
    }));
    await assertFails(setDoc(doc(adminDb, "organizationMembers/org-1_second-admin"), {
      organizationId: "org-1", userId: "second-admin", role: "organizationAdmin", status: "active"
    }));
    await assertFails(deleteDoc(doc(adminDb, "organizationMembers/org-1_owner-1")));

    await assertSucceeds(setDoc(doc(ownerDb, "organizationMembers/org-1_new-broker"), {
      organizationId: "org-1", userId: "new-broker", role: "broker", status: "active"
    }));
    await assertSucceeds(updateDoc(doc(managerDb, "organizationMembers/org-1_broker-1"), {
      status: "suspended", updatedAt: "test-update"
    }));
    await assertFails(updateDoc(doc(userDb, "users/user-1"), { accountType: "brokerage_company" }));
    await assertFails(updateDoc(doc(userDb, "users/user-1"), { organizationId: "org-1" }));
    await assertFails(getDoc(doc(outsiderDb, "leads/org-lead")));
    await assertFails(setDoc(doc(outsiderDb, "leads/outsider-lead"), {
      workspaceType: "organization", organizationId: "org-1", ownerId: "outsider-1", title: "Must be denied"
    }));
    await assertSucceeds(getDoc(doc(brokerDb, "leads/org-lead")));

    // New organization + owner membership must still work atomically during company registration.
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await deleteDoc(doc(db, "organizations/org-new"));
      await deleteDoc(doc(db, "organizationMembers/org-new_new-owner"));
    });
    const ownerRegistrationDb = testEnv.authenticatedContext("new-owner").firestore();
    const { writeBatch } = require("firebase/firestore");
    const batch = writeBatch(ownerRegistrationDb);
    batch.set(doc(ownerRegistrationDb, "organizations/org-new"), { ownerId: "new-owner", name: "New Brokerage" });
    batch.set(doc(ownerRegistrationDb, "organizationMembers/org-new_new-owner"), {
      organizationId: "org-new", userId: "new-owner", role: "organizationOwner", status: "active"
    });
    await assertSucceeds(batch.commit());

    console.log("Firestore security tests passed: membership escalation denied, workspace isolation enforced, owner onboarding preserved.");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
