"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiKeys, gemmaModel } from "./lib/gemini";
import { internal } from "./_generated/api";

// Helper function to extract JSON from markdown code blocks
function extractJsonFromMarkdown(text: string): string {
  const jsonMatch = text.match(/```json([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  return text;
}

export const batchProcessLeadsBackground = internalAction({
  args: {
    processType: v.union(v.literal("summaries"), v.literal("scores"), v.literal("both")),
    processId: v.string(),
  },
  handler: async (ctx, args): Promise<{ processed: number; failed: number; total: number; stopped: boolean }> => {
    console.log(`Starting background batch processing: ${args.processType} (ID: ${args.processId})`);

    const allKeys = await getGeminiKeys(ctx);
    const numKeys = allKeys.length;

    console.log(`Using ${numKeys} API keys`);

    let offset = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    let hasMore = true;
    const failedLeads: any[] = [];

    // Helper to process a single lead
    const processSingleLead = async (lead: any) => {
        try {
          // Get WhatsApp messages
          // @ts-ignore
          const whatsappMessages = await ctx.runQuery(internal.aiBackgroundHelpers.getWhatsAppMessagesInternal, {
            leadId: lead._id,
          });

          // Get comments
          // @ts-ignore
          const comments = await ctx.runQuery(internal.aiBackgroundHelpers.getCommentsInternal, {
            leadId: lead._id,
          });

          let summary: string | undefined;

          if (args.processType === "summaries" || args.processType === "both") {
            const systemPrompt = `You are a CRM assistant. Generate a concise 1-2 sentence summary of this lead for quick prioritization. Focus on: lead quality, urgency, key action needed, and recent engagement. Be brief and actionable.`;

            const leadInfo = {
              name: lead.name,
              subject: lead.subject,
              source: lead.source,
              status: lead.status,
              type: lead.type,
              message: lead.message,
              recentComments: comments.slice(0, 3),
              whatsappActivity: whatsappMessages.length > 0 ? {
                messageCount: whatsappMessages.length,
                recentMessages: whatsappMessages.slice(0, 5).map((m: any) => `${m.direction}: ${m.content.substring(0, 100)}`),
              } : null,
            };

            const prompt = `Summarize this lead in 1-2 sentences:\\n\\n${JSON.stringify(leadInfo, null, 2)}`;
            
            const keyToUse = allKeys[Math.floor(Math.random() * allKeys.length)];
            const genAI = new GoogleGenerativeAI(keyToUse.apiKey);
            
            const model = genAI.getGenerativeModel({ model: gemmaModel });
            const result = await model.generateContent([systemPrompt, prompt]);
            const text = result.response.text();

            summary = text;
            const lastActivityHash = `${lead.lastActivity}`;
            
            // Store summary
            // @ts-ignore
            await ctx.runMutation(internal.aiBackgroundHelpers.storeSummaryInternal, {
              leadId: lead._id,
              summary: text,
              lastActivityHash,
            });
          }

          if (args.processType === "scores" || args.processType === "both") {
            if (!summary) {
              // @ts-ignore
              const existingSummary = await ctx.runQuery(internal.aiBackgroundHelpers.getSummaryInternal, {
                leadId: lead._id,
                lastActivityHash: `${lead.lastActivity}`,
              });
              summary = existingSummary?.summary;
            }

            const systemPrompt = `You are an AI lead scoring expert for pharmaceutical CRM. Score leads 0-100 based on:\n    - Engagement (comments, messages, follow-ups)\n    - Recency of activity\n    - Lead type and status\n    - Source quality\n    - WhatsApp conversation quality and engagement\n    - AI-generated summary insights\n\n    Return JSON with: { "score": <number 0-100>, "tier": "<High|Medium|Low>", "rationale": "<brief explanation>" }`;

            const daysSinceCreated = (Date.now() - lead._creationTime) / (1000 * 60 * 60 * 24);
            const daysSinceActivity = (Date.now() - lead.lastActivity) / (1000 * 60 * 60 * 24);

            const whatsappEngagement = whatsappMessages.length > 0 ? {
              totalMessages: whatsappMessages.length,
              inboundCount: whatsappMessages.filter((m: any) => m.direction === "inbound").length,
              outboundCount: whatsappMessages.filter((m: any) => m.direction === "outbound").length,
              recentActivity: whatsappMessages.slice(0, 3).map((m: any) => `${m.direction}: ${m.content.substring(0, 80)}`),
            } : null;

            const leadInfo = {
              source: lead.source,
              status: lead.status,
              type: lead.type,
              isAssigned: !!lead.assignedTo,
              hasFollowUp: !!lead.nextFollowUpDate,
              tagCount: lead.tags?.length || 0,
              commentCount: comments.length,
              messageCount: whatsappMessages.length,
              daysSinceCreated: Math.round(daysSinceCreated),
              daysSinceActivity: Math.round(daysSinceActivity),
              aiSummary: summary,
              whatsappEngagement,
            };

            const prompt = `Score this lead:\\n\\n${JSON.stringify(leadInfo, null, 2)}`;
            
            const keyToUse = allKeys[Math.floor(Math.random() * allKeys.length)];
            const genAI = new GoogleGenerativeAI(keyToUse.apiKey);
            
            const model = genAI.getGenerativeModel({ 
              model: gemmaModel,
              generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent([systemPrompt, prompt]);
            const text = result.response.text();

            let parsed;
            try {
              const cleanedText = extractJsonFromMarkdown(text);
              parsed = JSON.parse(cleanedText);
            } catch {
              parsed = { score: 50, tier: "Medium", rationale: "Unable to generate AI score" };
            }

            // Store score
            // @ts-ignore
            await ctx.runMutation(internal.aiBackgroundHelpers.storeScoreInternal, {
              leadId: lead._id,
              score: parsed.score,
              tier: parsed.tier,
              rationale: parsed.rationale,
            });
          }

          return { success: true, leadId: lead._id };
        } catch (error) {
          console.error(`Failed to process lead ${lead._id}:`, error);
          return { success: false, leadId: lead._id, error };
        }
    };

    while (hasMore) {
      // Check stop flag
      // @ts-ignore
      const control = await ctx.runQuery(internal.aiBackgroundHelpers.getBatchControlInternal, {
        processId: args.processId,
      });

      if (control?.shouldStop) {
        console.log(`Batch processing stopped by user (ID: ${args.processId})`);
        return { processed: totalProcessed, failed: totalFailed + failedLeads.length, total: totalProcessed + totalFailed + failedLeads.length, stopped: true };
      }

      // Get leads
      // @ts-ignore
      const leads = await ctx.runQuery(internal.aiBackgroundHelpers.getLeadsForBatchInternal, {
        offset,
        limit: numKeys,
      });

      if (leads.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing ${leads.length} leads sequentially (offset: ${offset})`);

      for (const lead of leads) {
        const result = await processSingleLead(lead);
        
        if (result.success) {
            totalProcessed++;
        } else {
            console.log(`Lead ${lead._id} failed, adding to retry queue.`);
            failedLeads.push(lead);
        }

        // Cooldown
        console.log("Cooling down for 15 seconds...");
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      offset += leads.length;

      // Update progress
      // @ts-ignore
      await ctx.runMutation(internal.aiBackgroundHelpers.updateBatchProgressInternal, {
        processId: args.processId,
        processed: totalProcessed,
        failed: totalFailed,
      });
    }

    // Retry Phase
    if (failedLeads.length > 0) {
        console.log(`Starting retry phase for ${failedLeads.length} leads...`);
        
        for (const lead of failedLeads) {
             // Check stop
             // @ts-ignore
             const control = await ctx.runQuery(internal.aiBackgroundHelpers.getBatchControlInternal, {
                processId: args.processId,
             });
             if (control?.shouldStop) {
                 console.log("Retry phase stopped by user");
                 break;
             }

             const result = await processSingleLead(lead);
             
             if (result.success) {
                 totalProcessed++;
             } else {
                 totalFailed++;
                 console.error(`Lead ${lead._id} failed on retry.`);
             }
             
             // Update progress
             // @ts-ignore
             await ctx.runMutation(internal.aiBackgroundHelpers.updateBatchProgressInternal, {
                processId: args.processId,
                processed: totalProcessed,
                failed: totalFailed,
             });

             // Cooldown
             console.log("Cooling down for 15 seconds...");
             await new Promise(resolve => setTimeout(resolve, 15000));
        }
    }

    // Clear the control record
    // @ts-ignore
    await ctx.runMutation(internal.aiBackgroundHelpers.deleteBatchControlInternal, {
      processId: args.processId,
    });

    console.log(`Batch processing complete. Processed: ${totalProcessed}, Failed: ${totalFailed}`);
    return { processed: totalProcessed, failed: totalFailed, total: totalProcessed + totalFailed, stopped: false };
  },
});