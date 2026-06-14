import { createAgentWalletFromEnv } from "@preo/dynamic-integration";
import type { User } from "@prisma/client";
import type { BootstrapResponse } from "@preo/shared";
import { canton } from "./canton";
import { ensureDemoParties } from "./demo-parties";
import { recordCantonContract } from "./orchestration";
import { prisma } from "./prisma";

export type BootstrapUserInput = {
  dynamicUserId: string;
  primaryWalletAddress?: string;
  email?: string;
  requireCantonProfile?: boolean;
};

export function cantonPartyForDynamicUser(dynamicUserId: string) {
  return `preo-${dynamicUserId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export async function ensureBootstrappedUser(input: BootstrapUserInput): Promise<{ user: User; bootstrap: BootstrapResponse }> {
  const requireCantonProfile = input.requireCantonProfile ?? true;
  let agentWalletAddress: `0x${string}` | undefined;
  try {
    const agentWallet = createAgentWalletFromEnv();
    agentWalletAddress = await agentWallet.getAddress();
  } catch (error) {
    if (requireCantonProfile) {
      throw error;
    }
  }

  const cantonPartyId = cantonPartyForDynamicUser(input.dynamicUserId);
  const user = await prisma.user.upsert({
    where: { dynamicUserId: input.dynamicUserId },
    update: {
      email: input.email,
      primaryWalletAddress: input.primaryWalletAddress,
      agentWalletAddress
    },
    create: {
      dynamicUserId: input.dynamicUserId,
      email: input.email,
      primaryWalletAddress: input.primaryWalletAddress,
      agentWalletAddress,
      cantonPartyId
    }
  });

  let hasCantonProfile = false;
  try {
    await canton.allocateParty(cantonPartyId, input.email ?? input.dynamicUserId);
    await ensureDemoParties();
    const existingProfiles = await canton.query("Preo.User:UserProfile", { user: user.cantonPartyId }, user.cantonPartyId);
    const profile = existingProfiles[0] ?? (await canton.createUserProfile(user.cantonPartyId, input.email ?? input.dynamicUserId));
    await recordCantonContract(profile, { userId: user.id, partyId: user.cantonPartyId });
    hasCantonProfile = true;
  } catch (error) {
    if (requireCantonProfile) {
      throw error;
    }
  }
  const activePolicy = await prisma.policyCache.findFirst({ where: { userId: user.id, active: true } });

  return {
    user,
    bootstrap: {
      preoUserId: user.id,
      cantonPartyId: user.cantonPartyId,
      primaryWalletAddress: user.primaryWalletAddress,
      agentWalletAddress: user.agentWalletAddress,
      hasPolicy: Boolean(activePolicy),
      hasCantonProfile
    }
  };
}

export async function getRequiredUser(dynamicUserId: string) {
  const user = await prisma.user.findUnique({ where: { dynamicUserId } });
  if (!user) {
    throw new Error("User has not been bootstrapped");
  }
  return user;
}
