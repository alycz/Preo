import { partyViewRoleSchema, type PartyViewRole } from "@preo/shared";
import { canton } from "./canton";
import { getDemoParty } from "./demo-parties";
import { getRequiredUser } from "./users";

const EXPLANATIONS: Record<PartyViewRole, string> = {
  user: "User sees private payroll policy, credits, allocation runs, category balances, approvals, portfolio allocations, and their payment receipts.",
  employer: "Employer sees payroll notices it signed or observed, but not the employee's policy, balances, approvals, or portfolio.",
  recipient: "Recipient sees only payment receipts where they are the recipient.",
  operator: "Operator sees limited audit metadata and no salary allocation details.",
  "other-user": "Other user has no stakeholder relationship and should not see sensitive contracts."
};

export async function buildPartyView(dynamicUserId: string, role: PartyViewRole) {
  partyViewRoleSchema.parse(role);
  const user = await getRequiredUser(dynamicUserId);
  const party =
    role === "user"
      ? { cantonPartyId: user.cantonPartyId, displayName: "Employee" }
      : await getDemoParty(role);
  const visibleContracts = await canton.partyView(party.cantonPartyId);
  return {
    role,
    actingAs: party.displayName,
    cantonPartyId: party.cantonPartyId,
    visibleContracts,
    explanation: EXPLANATIONS[role]
  };
}

