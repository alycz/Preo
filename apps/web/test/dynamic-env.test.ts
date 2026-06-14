import { describe, expect, it } from "vitest";
import { getClientWalletMode, getDynamicEnvironmentId, getHealthClientWalletMode } from "../lib/dynamic-env";

const validDynamicEnvironmentId = "12345678901234567890";

describe("Dynamic wallet mode", () => {
  it("uses mock mode when demo mode is enabled, even with a valid Dynamic env", () => {
    expect(getClientWalletMode({ DEMO_MODE: "true", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: validDynamicEnvironmentId })).toBe("mock");
    expect(getHealthClientWalletMode({ DEMO_MODE: "true", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: validDynamicEnvironmentId })).toBe("mock");
  });

  it("uses live mode when demo mode is disabled and a valid Dynamic env is present", () => {
    expect(getClientWalletMode({ DEMO_MODE: "false", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: validDynamicEnvironmentId })).toBe("live");
    expect(getHealthClientWalletMode({ DEMO_MODE: "false", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: validDynamicEnvironmentId })).toBe("live");
  });

  it("treats missing or placeholder Dynamic env ids as unconfigured", () => {
    expect(getDynamicEnvironmentId({ DEMO_MODE: "false", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: "placeholder" })).toBeUndefined();
    expect(getClientWalletMode({ DEMO_MODE: "false", NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: "placeholder" })).toBe("none");
  });
});
