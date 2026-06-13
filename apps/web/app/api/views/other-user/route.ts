import { dynamicUserQuerySchema } from "@preo/shared";
import { errorResponse, ok } from "@/lib/http";
import { buildPartyView } from "@/lib/views";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = dynamicUserQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return ok(await buildPartyView(input.dynamicUserId, "other-user"));
  } catch (error) {
    return errorResponse(error);
  }
}

