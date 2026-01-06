// Wrapper to avoid deep type instantiation errors
let cachedApi: any = null;

export function getConvexApi() {
  if (!cachedApi) {
    // Dynamic require to avoid type resolution at module level
    cachedApi = require("@/convex/_generated/api").api;
  }
  return cachedApi;
}
