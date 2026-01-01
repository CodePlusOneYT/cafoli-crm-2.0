"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const sendBulkWhatsAppMessages = action({
  args: {
    leadIds: v.array(v.id("leads")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    
    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp API not configured. Please set CLOUD_API_ACCESS_TOKEN and WA_PHONE_NUMBER_ID in backend environment variables.");
    }

    const results = {
      total: args.leadIds.length,
      sent: 0,
      failed: 0,
      errors: [] as Array<{ leadId: string; error: string }>,
    };

    // Process leads in batches to avoid overwhelming the API
    for (const leadId of args.leadIds) {
      try {
        // Get lead details
        const lead = await ctx.runQuery("whatsappMutations:getLeadsForMatching" as any, {});
        const targetLead = lead.find((l: any) => l._id === leadId);
        
        if (!targetLead || !targetLead.mobile) {
          results.failed++;
          results.errors.push({
            leadId,
            error: "Lead not found or missing mobile number",
          });
          continue;
        }

        // Send message via WhatsApp Cloud API
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: targetLead.mobile,
              type: "text",
              text: { body: args.message },
            }),
          }
        );

        const data = await response.json();
        
        if (!response.ok) {
          results.failed++;
          results.errors.push({
            leadId,
            error: `WhatsApp API error: ${JSON.stringify(data)}`,
          });
          continue;
        }

        // Store message in database
        await ctx.runMutation("whatsappMutations:storeMessage" as any, {
          leadId,
          phoneNumber: targetLead.mobile,
          content: args.message,
          direction: "outbound",
          status: "sent",
          externalId: data.messages?.[0]?.id || "",
        });

        results.sent++;
        
        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({
          leadId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});
