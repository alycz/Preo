import { dynamicUserQuerySchema } from "@preo/shared";
import { canton } from "@/lib/canton";
import { errorResponse, ok } from "@/lib/http";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = dynamicUserQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const user = await getRequiredUser(input.dynamicUserId);
    const approvals = await canton.listApprovals(user.cantonPartyId);
    return ok({ approvals });
  } catch (error) {
    return errorResponse(error);
  }
}

