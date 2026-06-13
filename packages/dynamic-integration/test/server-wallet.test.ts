import { describe, expect, it } from "vitest";
import { DemoAgentWallet } from "../src/serverWallet";

describe("DemoAgentWallet", () => {
  it("returns simulated hashes", async () => {
    const wallet = new DemoAgentWallet();
    const result = await wallet.sendNative("0x0000000000000000000000000000000000000001", 1n);
    expect(result.simulated).toBe(true);
    expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
