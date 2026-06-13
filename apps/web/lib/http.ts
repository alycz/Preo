import { ZodError, type ZodSchema } from "zod";
import { ApiError } from "./orchestration";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function ok(payload: unknown, init?: ResponseInit) {
  return Response.json(payload, init);
}

export function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return Response.json({ error: "Invalid request", details: error.issues }, { status });
  }
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}
