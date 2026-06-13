import { dynamicUserQuerySchema, policyRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { createPolicyForUser, getActivePolicyForUser } from "@/lib/orchestration";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, policyRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const { contract, cache } = await createPolicyForUser(user, input);
    return ok({
      policyContractId: contract.contractId,
      version: cache.version,
      active: cache.active,
      policy: contract.payload
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const input = dynamicUserQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const user = await getRequiredUser(input.dynamicUserId);
    const { cache, contract } = await getActivePolicyForUser(user);
    return ok({
      policyContractId: contract?.contractId ?? cache?.cantonContractId ?? null,
      version: cache?.version ?? (contract?.payload as { version?: number } | undefined)?.version ?? null,
      active: Boolean(cache?.active ?? (contract?.payload as { active?: boolean } | undefined)?.active),
      policy: contract?.payload ?? null,
      cache
    });
  } catch (error) {
    return errorResponse(error);
  }
}

