import { Prisma } from "@prisma/client";
import { evmVerifyDepositRequestSchema } from "@preo/shared";
import type { Hex } from "viem";
import { canton } from "@/lib/canton";
import { getReceiptDeposit, makeDemoVerifiedVaultDeposit, type VerifiedVaultDeposit } from "@/lib/evm-funding";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { externalRefHash, getSettlementConfig, preoUserIdHash } from "@/lib/settlement";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

function eventPayload(deposit: VerifiedVaultDeposit): Prisma.InputJsonValue {
  return {
    eventName: deposit.eventName,
    chainId: deposit.chainId,
    txHash: deposit.txHash,
    logIndex: deposit.logIndex,
    vaultAddress: deposit.vaultAddress,
    tokenAddress: deposit.tokenAddress,
    preoUserIdHash: deposit.preoUserIdHash,
    amount: deposit.amount,
    amountUnits: deposit.amountUnits,
    externalRef: deposit.externalRef,
    sender: deposit.sender,
    recordedBy: deposit.recordedBy
  };
}

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, evmVerifyDepositRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const config = getSettlementConfig();
    const chainId = input.chainId ?? config.chainId;
    if (chainId !== config.chainId) {
      return ok({ error: `Unsupported settlement chain ${chainId}` }, { status: 400 });
    }

    const txHash = input.txHash as Hex;
    const expectedUserHash = preoUserIdHash(user.id);
    const deposit =
      config.demoMode && !config.rpcUrl
        ? makeDemoVerifiedVaultDeposit({
            txHash,
            config,
            expectedUserHash,
            amount: input.demoAmount ?? "250.00",
            sourceRef: externalRefHash(input.sourceRef ?? `demo-${txHash}`),
            logIndex: input.expectedLogIndex
          })
        : await getReceiptDeposit(txHash, config, expectedUserHash, input.expectedLogIndex);

    if (!deposit) {
      return ok({ error: "Transaction receipt does not contain a matching Preo funding vault deposit event" }, { status: 404 });
    }

    const existing = await prisma.evmEvent.findUnique({
      where: {
        chainId_txHash_logIndex: {
          chainId: deposit.chainId,
          txHash: deposit.txHash,
          logIndex: deposit.logIndex
        }
      }
    });

    if (existing?.cantonCreditContractId) {
      return ok({
        status: "settled",
        duplicate: true,
        evmEventId: existing.id,
        cantonCreditContractId: existing.cantonCreditContractId
      });
    }

    const credit = await canton.createPayrollCredit({
      user: user.cantonPartyId,
      amount: deposit.amount,
      asset: "USDC",
      sourceRef: input.sourceRef ?? deposit.externalRef,
      evmTxHash: deposit.txHash
    });

    const evmEvent = existing
      ? await prisma.evmEvent.update({
          where: { id: existing.id },
          data: {
            userId: user.id,
            processedAt: new Date(),
            cantonCreditContractId: credit.contractId
          }
        })
      : await prisma.evmEvent.create({
          data: {
            userId: user.id,
            chainId: deposit.chainId,
            txHash: deposit.txHash,
            logIndex: deposit.logIndex,
            eventName: deposit.eventName,
            vaultAddress: deposit.vaultAddress,
            tokenAddress: deposit.tokenAddress,
            preoUserIdHash: deposit.preoUserIdHash,
            amount: deposit.amount,
            externalRef: deposit.externalRef,
            payload: eventPayload(deposit),
            processedAt: new Date(),
            cantonCreditContractId: credit.contractId
          }
        });

    const intent = await prisma.fundingIntent.findFirst({
      where: {
        userId: user.id,
        externalRef: input.sourceRef
      },
      orderBy: { createdAt: "desc" }
    });

    const intentData = {
      provider: intent?.provider ?? "evm_vault",
      amount: deposit.amount,
      token: "USDC",
      chainId: deposit.chainId,
      tokenAddress: deposit.tokenAddress,
      destinationAddress: deposit.vaultAddress,
      externalRef: input.sourceRef ?? deposit.externalRef,
      logIndex: deposit.logIndex,
      status: "settled",
      settlementTxHash: deposit.txHash,
      cantonCreditContractId: credit.contractId,
      metadata: {
        eventName: deposit.eventName,
        evmEventId: evmEvent.id,
        cantonLive: credit.live
      } as Prisma.InputJsonValue
    };

    const fundingIntent = intent
      ? await prisma.fundingIntent.update({ where: { id: intent.id }, data: intentData })
      : await prisma.fundingIntent.create({ data: { ...intentData, userId: user.id } });

    return ok({
      status: "settled",
      duplicate: Boolean(existing),
      provider: fundingIntent.provider,
      fundingIntentId: fundingIntent.id,
      evmEventId: evmEvent.id,
      chainId: deposit.chainId,
      txHash: deposit.txHash,
      logIndex: deposit.logIndex,
      eventName: deposit.eventName,
      amount: deposit.amount,
      tokenAddress: deposit.tokenAddress,
      vaultAddress: deposit.vaultAddress,
      cantonCreditContractId: credit.contractId,
      cantonLive: credit.live,
      nextAction: "run_payroll_allocation"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
