import { policyInputSchema, validatePolicyInput } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, policyInputSchema);
    return ok(validatePolicyInput(input));
  } catch (error) {
    return errorResponse(error);
  }
}

