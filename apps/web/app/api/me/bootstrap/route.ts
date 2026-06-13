import { bootstrapRequestSchema } from "@preo/shared";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cantonPartyForDynamicUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, bootstrapRequestSchema);
    const agentWallet = createAgentWalletFromEnv();
    const agentWalletAddress = await agentWallet.getAddress();

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
        cantonPartyId: cantonPartyForDynamicUser(input.dynamicUserId)
      }
    });

    return ok({
      preoUserId: user.id,
      cantonPartyId: user.cantonPartyId,
      primaryWalletAddress: user.primaryWalletAddress,
      agentWalletAddress: user.agentWalletAddress,
      hasPolicy: false,
      hasCantonProfile: false
    });
  } catch (error) {
    return errorResponse(error);
  }
}
