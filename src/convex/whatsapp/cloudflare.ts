"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const sendFilesViaWorker = internalAction({
  args: {
    phoneNumber: v.string(),
    files: v.array(v.object({
      url: v.string(),
      fileName: v.string(),
      mimeType: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
    const workerToken = process.env.CLOUDFLARE_WORKER_TOKEN;

    if (!workerUrl || !workerToken) {
      throw new Error("Cloudflare Worker not configured (Missing CLOUDFLARE_WORKER_URL or CLOUDFLARE_WORKER_TOKEN)");
    }

    console.log(`[CLOUDFLARE_RELAY] Sending ${args.files.length} files to worker: ${workerUrl}`);

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        phoneNumber: args.phoneNumber,
        files: args.files,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[CLOUDFLARE_RELAY] Worker Error: ${text}`);
      throw new Error(`Cloudflare Worker failed: ${text}`);
    }

    const result = await response.json();
    console.log(`[CLOUDFLARE_RELAY] Result:`, result);
    return result;
  },
});
