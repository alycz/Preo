const placeholderDynamicEnvironmentIds = new Set(["test", "placeholder", "your_environment_id", "your-dynamic-environment-id"]);

export function getDynamicEnvironmentId() {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID?.trim();

  if (!environmentId || placeholderDynamicEnvironmentIds.has(environmentId.toLowerCase()) || environmentId.length < 20) {
    return undefined;
  }

  return environmentId;
}

export function isDynamicEnvironmentConfigured() {
  return Boolean(getDynamicEnvironmentId());
}
