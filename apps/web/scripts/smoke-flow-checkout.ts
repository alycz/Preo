import { getFlowAvailability, createDynamicFlowConfigFromEnv } from "@preo/dynamic-integration";

const availability = getFlowAvailability(createDynamicFlowConfigFromEnv());

if (availability.available) {
  console.log(`Dynamic Flow configured with checkout ${availability.checkoutId}`);
} else {
  console.log(`Dynamic Flow unavailable: ${availability.reason}; direct testnet deposit fallback should be used.`);
}
