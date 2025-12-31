"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Process pending campaign executions
export const processCampaignExecutions = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get pending executions that are due
    const pendingExecutions = await ctx.runQuery(
      "campaignExecutorMutations:getPendingExecutions" as any,
      { now }
    );
    
    console.log(`Processing ${pendingExecutions.length} pending campaign executions`);
    
    for (const execution of pendingExecutions) {
      try {
        // Mark as executing
        await ctx.runMutation(
          "campaignExecutorMutations:markExecuting" as any,
          { executionId: execution._id }
        );
        
        // Get campaign and block details
        const campaign = await ctx.runQuery(
          "campaignExecutorMutations:getCampaignForExecution" as any,
          { campaignId: execution.campaignId }
        );
        
        if (!campaign) {
          await ctx.runMutation(
            "campaignExecutorMutations:markFailed" as any,
            { executionId: execution._id, error: "Campaign not found" }
          );
          continue;
        }
        
        const block = campaign.blocks.find((b: any) => b.id === execution.blockId);
        if (!block) {
          await ctx.runMutation(
            "campaignExecutorMutations:markFailed" as any,
            { executionId: execution._id, error: "Block not found" }
          );
          continue;
        }
        
        // Execute based on block type
        let result: any = null;
        
        if (block.type === "send_whatsapp") {
          result = await executeWhatsAppBlock(ctx, block, execution.leadId, execution.campaignId);
        } else if (block.type === "send_email") {
          result = await executeEmailBlock(ctx, execution.leadId, block.data);
        } else if (block.type === "wait") {
          result = { success: true, message: "Wait completed" };
        } else if (block.type === "add_tag") {
          result = await executeAddTagBlock(ctx, execution.leadId, block.data);
        } else if (block.type === "remove_tag") {
          result = await executeRemoveTagBlock(ctx, execution.leadId, block.data);
        }
        
        // Mark as completed
        await ctx.runMutation(
          "campaignExecutorMutations:markCompleted" as any,
          { executionId: execution._id, result }
        );
        
        // Schedule next block(s)
        await scheduleNextBlocks(ctx, execution, campaign);
        
      } catch (error) {
        console.error(`Error executing campaign block:`, error);
        await ctx.runMutation(
          "campaignExecutorMutations:markFailed" as any,
          { executionId: execution._id, error: error instanceof Error ? error.message : "Unknown error" }
        );
      }
    }
  },
});

async function executeWhatsAppBlock(
  ctx: any,
  block: any,
  lead: any,
  campaignId: Id<"campaigns">
) {
  try {
    // Get template
    const template = await ctx.db.get(block.templateId);
    
    if (!template) {
      throw new Error(`Template ${block.templateId} not found`);
    }

    // Replace variables in template
    let message = template.content;
    message = message.replace(/\{\{name\}\}/g, lead.name || "");
    message = message.replace(/\{\{company\}\}/g, lead.company || "");
    message = message.replace(/\{\{subject\}\}/g, lead.subject || "");

    // Send WhatsApp message using the template action
    const result = await ctx.scheduler.runAfter(
      0,
      "whatsappTemplatesActions:sendTemplateToLead" as any,
      {
        leadId: lead._id,
        templateId: block.templateId,
      }
    );

    console.log(`WhatsApp sent to ${lead.name} (${lead.mobile}) for campaign ${campaignId}`);
    return { success: true };
  } catch (error) {
    console.error("Error executing WhatsApp block:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function executeEmailBlock(ctx: any, leadId: string, blockData: any) {
  const lead = await ctx.runQuery(
    "campaignExecutorMutations:getLead" as any,
    { leadId }
  );
  
  if (!lead || !lead.email) {
    throw new Error("Lead not found or missing email address");
  }

  // Send email using Brevo
  try {
    await ctx.runAction(
      "brevo:sendEmailInternal" as any,
      {
        to: lead.email,
        toName: lead.name || "Valued Customer",
        subject: blockData.subject || "Message from Cafoli Connect",
        htmlContent: blockData.htmlContent || blockData.message || "Hello!",
        textContent: blockData.textContent,
      }
    );

    return { success: true, message: "Email sent" };
  } catch (error) {
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function executeAddTagBlock(ctx: any, leadId: string, blockData: any) {
  await ctx.runMutation(
    "campaignExecutorMutations:addTagToLead" as any,
    { leadId, tagId: blockData.tagId }
  );
  return { success: true, message: "Tag added" };
}

async function executeRemoveTagBlock(ctx: any, leadId: string, blockData: any) {
  await ctx.runMutation(
    "campaignExecutorMutations:removeTagFromLead" as any,
    { leadId, tagId: blockData.tagId }
  );
  return { success: true, message: "Tag removed" };
}

async function scheduleNextBlocks(ctx: any, execution: any, campaign: any) {
  const currentBlock = campaign.blocks.find((b: any) => b.id === execution.blockId);
  
  // Find connections from this block
  const nextConnections = campaign.connections.filter((c: any) => c.from === execution.blockId);
  
  for (const conn of nextConnections) {
    const nextBlock = campaign.blocks.find((b: any) => b.id === conn.to);
    if (!nextBlock) continue;
    
    // Calculate delay based on block type
    let delay = 0;
    if (nextBlock.type === "wait") {
      const duration = nextBlock.data.duration || 1;
      const unit = nextBlock.data.unit || "hours";
      
      if (unit === "minutes") delay = duration * 60 * 1000;
      else if (unit === "hours") delay = duration * 60 * 60 * 1000;
      else if (unit === "days") delay = duration * 24 * 60 * 60 * 1000;
    }
    
    // Schedule next execution
    await ctx.runMutation(
      "campaignExecutorMutations:scheduleExecution" as any,
      {
        campaignId: execution.campaignId,
        enrollmentId: execution.enrollmentId,
        leadId: execution.leadId,
        blockId: conn.to,
        scheduledFor: Date.now() + delay,
      }
    );
  }
}