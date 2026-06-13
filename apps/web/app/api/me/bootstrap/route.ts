import { bootstrapRequestSchema } from "@preo/shared";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { canton } from "@/lib/canton";
import { ensureDemoParties } from "@/lib/demo-parties";
import { recordCantonContract } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";
import { cantonPartyForDynamicUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, bootstrapRequestSchema);
    const agentWallet = createAgentWalletFromEnv();
    const agentWalletAddress = await agentWallet.getAddress();

    const cantonPartyId = cantonPartyForDynamicUser(input.dynamicUserId);
    await canton.allocateParty(cantonPartyId, input.email ?? input.dynamicUserId);
    await ensureDemoParties();

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

    const existingProfiles = await canton.query("Preo.User:UserProfile", { user: user.cantonPartyId }, user.cantonPartyId);
    const profile = existingProfiles[0] ?? (await canton.createUserProfile(user.cantonPartyId, input.email ?? input.dynamicUserId));
    await recordCantonContract(profile, { userId: user.id, partyId: user.cantonPartyId });
    const activePolicy = await prisma.policyCache.findFirst({ where: { userId: user.id, active: true } });

    return ok({
      preoUserId: user.id,
      cantonPartyId: user.cantonPartyId,
      primaryWalletAddress: user.primaryWalletAddress,
      agentWalletAddress: user.agentWalletAddress,
      hasPolicy: Boolean(activePolicy),
      hasCantonProfile: true
    });
  } catch (error) {
    return errorResponse(error);
  }
}
