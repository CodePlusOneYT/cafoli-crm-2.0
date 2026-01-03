"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

export const testAiFeatures = internalAction({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
        const user = await ctx.runQuery(internal.test_utils.getAnyUser);
        if (!user) {
            console.error("No users found in database to run tests with.");
            return;
        }
        userId = user._id;
    }

    console.log("Starting AI Feature Tests with User:", userId);

    // 1. Test Campaign Email Generation
    console.log("\n--- Testing Campaign Email Generation ---");
    try {
      const emailContent = await ctx.runAction(api.ai.generateContent, {
        prompt: "Write an email body for the subject: Special Summer Offer",
        type: "campaign_email_content",
        context: { subject: "Special Summer Offer" },
        userId: userId,
      });
      console.log("✅ Email Generation Success:");
      console.log(emailContent.substring(0, 100) + "...");
    } catch (e) {
      console.error("❌ Email Generation Failed:", e);
    }

    // 2. Test Lead Analysis
    console.log("\n--- Testing Lead Analysis ---");
    try {
      const analysis = await ctx.runAction(api.ai.generateContent, {
        prompt: "Analyze this lead",
        type: "lead_analysis",
        context: { 
          name: "John Doe", 
          company: "Tech Corp", 
          status: "Cold", 
          source: "Website" 
        },
        userId: userId,
      });
      console.log("✅ Lead Analysis Success:");
      console.log(analysis.substring(0, 100) + "...");
    } catch (e) {
      console.error("❌ Lead Analysis Failed:", e);
    }

    // 3. Test Follow-up Suggestion (JSON Mode)
    console.log("\n--- Testing Follow-up Suggestion (JSON) ---");
    try {
      const suggestion = await ctx.runAction(api.ai.generateContent, {
        prompt: "Suggest follow-up",
        type: "follow_up_suggestion",
        context: { 
          lastInteraction: "Customer asked about pricing but didn't reply to the quote sent yesterday." 
        },
        userId: userId,
      });
      console.log("✅ Follow-up Suggestion Success:");
      console.log(suggestion);
      
      // Verify JSON parsing
      try {
        const cleanResult = suggestion.replace(/[\n\r]/g, '');
        const parsed = JSON.parse(cleanResult);
        if (parsed.days && parsed.message) {
          console.log("✅ JSON Structure Valid");
        } else {
          console.warn("⚠️ JSON Structure Invalid (missing keys)");
        }
      } catch (e) {
        console.error("❌ JSON Parsing Failed");
      }
    } catch (e) {
      console.error("❌ Follow-up Suggestion Failed:", e);
    }

    console.log("\nTests Completed.");
  },
});