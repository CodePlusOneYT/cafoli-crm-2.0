// Use dynamic import to avoid deep type instantiation at build time
let cachedApi: any = null;

export function getConvexApiRuntime(): any {
  if (!cachedApi) {
    // This will be resolved at runtime, not build time
    cachedApi = require("@/convex/_generated/api").api;
  }
  return cachedApi;
}

// Backward compatibility - same as getConvexApiRuntime
export function getConvexApi(): any {
  return getConvexApiRuntime();
}