import { describe, expect, it } from "vitest";
import { getFlowAvailability } from "../src/flow";

describe("Flow availability", () => {
  it("requires Dynamic environment, auth token, and checkout id", () => {
    expect(getFlowAvailability({}).available).toBe(false);
    expect(getFlowAvailability({ environmentId: "env", authToken: "dyn", checkoutId: "checkout" }).available).toBe(true);
  });
});
