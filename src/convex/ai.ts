"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { internal } from "./_generated/api";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const generateContent = action({
  args: {
    prompt: v.string(),
    type: v.string(), // "chat_reply", "lead_analysis", "follow_up_suggestion"
    context: v.optional(v.any()), // Additional context like lead details, chat history
    userId: v.id("users"),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Please add it in the Integrations tab.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let systemPrompt = "";
    if (args.type === "chat_reply") {
      systemPrompt = "You are a helpful sales assistant. Draft a professional and friendly reply to the customer based on the context provided. Keep it concise and relevant to the conversation history.";
    } else if (args.type === "lead_analysis") {
      systemPrompt = "Analyze the following lead information and provide insights on lead quality, potential needs, and recommended next steps. Be brief and actionable.";
    } else if (args.type === "follow_up_suggestion") {
      systemPrompt = "Suggest a follow-up date (in days from now) and a message based on the last interaction. Return JSON format: { \"days\": number, \"message\": string }.";
    }

    const fullPrompt = `${systemPrompt}\n\nContext: ${JSON.stringify(args.context)}\n\nPrompt: ${args.prompt}`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Log the generation
      await ctx.runMutation(internal.aiMutations.logAiGeneration, {
        userId: args.userId,
        leadId: args.leadId,
        type: args.type,
        content: text,
        status: "generated",
      });

      return text;
    } catch (error) {
      console.error("AI Generation Error:", error);
      throw new Error("Failed to generate AI content");
    }
  },
});
