import { canton } from "@/lib/canton";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/users";
import { createAgentWalletFromEnv, parseAssetUnits } from "@preo/dynamic-integration";
import { executeApprovedActionRequestSchema } from "@preo/shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let agentActionId: string | undefined;

  try {
    const input = await parseJson(request, executeApprovedActionRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);

    if (user.cantonPartyId !== input.cantonPartyId) {
      return ok({ error: "Canton party does not match bootstrapped user" }, { status: 403 });
    }

    if (input.pendingActionStatus && input.pendingActionStatus !== "Approved") {
      return ok({ error: "Pending action must be approved before execution" }, { status: 409 });
    }

    const livePendingAction = await canton.getPendingAction(input.pendingActionContractId, user.cantonPartyId);
    if (livePendingAction && livePendingAction.payload.status !== "Approved") {
      return ok({ error: "Canton pending action is not approved" }, { status: 409 });
    }

    const agentWallet = createAgentWalletFromEnv();
    const walletAddress = await agentWallet.getAddress();
    const action = await prisma.agentAction.create({
      data: {
        userId: user.id,
        actionType: input.actionType,
        status: "pending",
        dynamicWalletAddress: walletAddress,
        pendingActionId: input.pendingActionContractId,
        amount: input.amount,
        asset: input.asset
      }
    });
    agentActionId = action.id;

    const amountUnits = parseAssetUnits(input.amount, input.asset);
    const transaction = input.toAddress
      ? input.asset.toUpperCase() === "ETH"
        ? await agentWallet.sendNative(input.toAddress as `0x${string}`, amountUnits)
        : await agentWallet.sendUsdc(input.toAddress as `0x${string}`, amountUnits)
      : { txHash: await agentWallet.signMessage(`Preo approved action ${input.actionId}`), simulated: true };

    await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: transaction.simulated ? "simulated" : "submitted",
        evmTxHash: transaction.txHash
      }
    });

    const executed = await canton.executeApprovedAction({
      user: user.cantonPartyId,
      pendingActionContractId: input.pendingActionContractId,
      runId: input.runId ?? input.actionId.split(":")[0] ?? input.actionId,
      evmTxHash: transaction.txHash
    });

    const finalAction = await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: transaction.simulated ? "simulated" : "executed",
        cantonContractId: executed.contractId
      }
    });

    return ok({
      agentActionId: finalAction.id,
      status: finalAction.status,
      dynamicWalletAddress: walletAddress,
      evmTxHash: transaction.txHash,
      simulated: transaction.simulated,
      cantonContractId: executed.contractId,
      cantonLive: executed.live
    });
  } catch (error) {
    if (agentActionId) {
      await prisma.agentAction.update({
        where: { id: agentActionId },
        data: { status: "failed", error: error instanceof Error ? error.message : String(error) }
      });
    }
    return errorResponse(error);
  }
}
