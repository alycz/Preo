import { describe, expect, it } from "vitest";
import { cantonPartyForDynamicUser } from "../lib/users";

describe("user mapping", () => {
  it("creates stable Canton party ids from Dynamic user ids", () => {
    expect(cantonPartyForDynamicUser("dyn:user/123")).toBe("preo-dyn-user-123");
  });
});
