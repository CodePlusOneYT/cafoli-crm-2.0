export default {
  providers: [
    {
      // Fallback to the site URL if the env var is not set
      domain: process.env.CONVEX_SITE_URL || "https://polished-marmot-96.convex.site",
      applicationID: "convex",
    },
  ],
};