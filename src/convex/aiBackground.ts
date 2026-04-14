"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateWithGemini, extractJsonFromMarkdown } from "./lib/gemini";
import { internal } from "./_generated/api";

export const batchProcessLeadsBackground = internalAction({
  args: {
    processType: v.union(v.literal("summaries"), v.literal("scores"), v.literal("both")),
    processId: v.string(),
  },
  handler: async (ctx, args): Promise<{ processed: number; failed: number; total: number; stopped: boolean }> => {
    console.log(`Starting background batch processing: ${args.processType} (ID: ${args.processId})`);

    let offset = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    let hasMore = true;
    const failedLeads: any[] = [];

    const processSingleLead = async (lead: any) => {
      try {
        // @ts-ignore
        const whatsappMessages = await ctx.runQuery(internal.aiBackgroundHelpers.getWhatsAppMessagesInternal, { leadId: lead._id });
        // @ts-ignore
        const comments = await ctx.runQuery(internal.aiBackgroundHelpers.getCommentsInternal, { leadId: lead._id });

        let summary: string | undefined;

        if (args.processType === "summaries" || args.processType === "both") {
          const systemPrompt = `You are a CRM assistant. Generate a concise 1-2 sentence summary of this lead for quick prioritization. Focus on: lead quality, urgency, key action needed, and recent engagement. Be brief and actionable.`;
          const leadInfo = {
            name: lead.name, subject: lead.subject, source: lead.source,
            status: lead.status, type: lead.type, message: lead.message,
            recentComments: comments.slice(0, 3),
            whatsappActivity: whatsappMessages.length > 0 ? {
              messageCount: whatsappMessages.length,
              recentMessages: whatsappMessages.slice(0, 5).map((m: any) => `${m.direction}: ${m.content.substring(0, 100)}`),
            } : null,
          };
          const prompt = `Summarize this lead in 1-2 sentences:\n\n${JSON.stringify(leadInfo, null, 2)}`;
          const { text } = await generateWithGemini(ctx as any, systemPrompt, prompt);
          summary = text;
          // @ts-ignore
          await ctx.runMutation(internal.aiBackgroundHelpers.storeSummaryInternal, {
            leadId: lead._id, summary: text, lastActivityHash: `${lead.lastActivity}`,
          });
        }

        if (args.processType === "scores" || args.processType === "both") {
          if (!summary) {
            // @ts-ignore
            const existingSummary = await ctx.runQuery(internal.aiBackgroundHelpers.getSummaryInternal, {
              leadId: lead._id, lastActivityHash: `${lead.lastActivity}`,
            });
            summary = existingSummary?.summary;
          }
          const systemPrompt = `You are an AI lead scoring expert for pharmaceutical CRM. Score leads 0-100 based on engagement, recency, type, status, source quality, and WhatsApp activity. Return JSON: { "score": <0-100>, "tier": "<High|Medium|Low>", "rationale": "<brief>" }`;
          const daysSinceCreated = (Date.now() - lead._creationTime) / (1000 * 60 * 60 * 24);
          const daysSinceActivity = (Date.now() - lead.lastActivity) / (1000 * 60 * 60 * 24);
          const leadInfo = {
            source: lead.source, status: lead.status, type: lead.type,
            isAssigned: !!lead.assignedTo, hasFollowUp: !!lead.nextFollowUpDate,
            tagCount: lead.tags?.length || 0, commentCount: comments.length,
            messageCount: whatsappMessages.length,
            daysSinceCreated: Math.round(daysSinceCreated), daysSinceActivity: Math.round(daysSinceActivity),
            aiSummary: summary,
          };
          const prompt = `Score this lead:\n\n${JSON.stringify(leadInfo, null, 2)}`;
          const { text } = await generateWithGemini(ctx as any, systemPrompt, prompt, { jsonMode: true });
          let parsed;
          try { parsed = JSON.parse(extractJsonFromMarkdown(text)); }
          catch { parsed = { score: 50, tier: "Medium", rationale: "Unable to generate AI score" }; }
          // @ts-ignore
          await ctx.runMutation(internal.aiBackgroundHelpers.storeScoreInternal, {
            leadId: lead._id, score: parsed.score, tier: parsed.tier, rationale: parsed.rationale,
          });
        }

        return { success: true, leadId: lead._id };
      } catch (error) {
        console.error(`Failed to process lead ${lead._id}:`, error);
        return { success: false, leadId: lead._id, error };
      }
    };

    while (hasMore) {
      // @ts-ignore
      const control = await ctx.runQuery(internal.aiBackgroundHelpers.getBatchControlInternal, { processId: args.processId });
      if (control?.shouldStop) {
        return { processed: totalProcessed, failed: totalFailed + failedLeads.length, total: totalProcessed + totalFailed + failedLeads.length, stopped: true };
      }
      // @ts-ignore
      const leads = await ctx.runQuery(internal.aiBackgroundHelpers.getLeadsForBatchInternal, { offset, limit: 5 });
      if (leads.length === 0) { hasMore = false; break; }

      for (const lead of leads) {
        const result = await processSingleLead(lead);
        if (result.success) { totalProcessed++; } else { failedLeads.push(lead); }
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
      offset += leads.length;
      // @ts-ignore
      await ctx.runMutation(internal.aiBackgroundHelpers.updateBatchProgressInternal, { processId: args.processId, processed: totalProcessed, failed: totalFailed });
    }

    for (const lead of failedLeads) {
      // @ts-ignore
      const control = await ctx.runQuery(internal.aiBackgroundHelpers.getBatchControlInternal, { processId: args.processId });
      if (control?.shouldStop) break;
      const result = await processSingleLead(lead);
      if (result.success) { totalProcessed++; } else { totalFailed++; }
      // @ts-ignore
      await ctx.runMutation(internal.aiBackgroundHelpers.updateBatchProgressInternal, { processId: args.processId, processed: totalProcessed, failed: totalFailed });
      await new Promise(resolve => setTimeout(resolve, 15000));
    }

    // @ts-ignore
    await ctx.runMutation(internal.aiBackgroundHelpers.deleteBatchControlInternal, { processId: args.processId });
    return { processed: totalProcessed, failed: totalFailed, total: totalProcessed + totalFailed, stopped: false };
  },
});