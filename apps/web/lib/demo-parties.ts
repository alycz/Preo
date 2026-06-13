import { canton } from "./canton";
import { prisma } from "./prisma";

const DEMO_PARTIES = [
  { role: "employer", cantonPartyId: "preo-demo-employer", displayName: "Demo Employer" },
  { role: "recipient", cantonPartyId: "preo-demo-recipient", displayName: "Demo Recipient" },
  { role: "operator", cantonPartyId: "preo-demo-operator", displayName: "Preo Operator" },
  { role: "other-user", cantonPartyId: "preo-demo-other-user", displayName: "Other User" }
] as const;

export type DemoPartyRole = (typeof DEMO_PARTIES)[number]["role"];

export async function ensureDemoParties() {
  const parties = await Promise.all(
    DEMO_PARTIES.map(async (party) => {
      await canton.allocateParty(party.cantonPartyId, party.displayName);
      return prisma.demoParty.upsert({
        where: { role: party.role },
        update: {
          cantonPartyId: party.cantonPartyId,
          displayName: party.displayName
        },
        create: party
      });
    })
  );

  return Object.fromEntries(parties.map((party) => [party.role, party])) as Record<DemoPartyRole, (typeof parties)[number]>;
}

export async function getDemoParty(role: DemoPartyRole) {
  const existing = await prisma.demoParty.findUnique({ where: { role } });
  if (existing) {
    return existing;
  }
  const parties = await ensureDemoParties();
  return parties[role];
}

