import { approvalActionRequestSchema } from "@preo/shared";
import { canton } from "@/lib/canton";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { recordCantonContract } from "@/lib/orchestration";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, input] = await Promise.all([context.params, parseJson(request, approvalActionRequestSchema)]);
    const user = await getRequiredUser(input.dynamicUserId);
    const approval = await canton.rejectPendingAction(id, user.cantonPartyId);
    await recordCantonContract(approval, { userId: user.id, partyId: user.cantonPartyId });
    return ok({ approval });
  } catch (error) {
    return errorResponse(error);
  }
}

