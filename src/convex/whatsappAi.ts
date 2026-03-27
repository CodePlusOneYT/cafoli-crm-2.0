"use node";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { generateWithGemini, extractJsonFromMarkdown } from "./lib/gemini";

function logAiError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    `[WHATSAPP_AI][${context}] ERROR: ${message}`,
    JSON.stringify({ ...extra, stack: stack?.split("\n").slice(0, 5) })
  );
}

function logAiInfo(context: string, message: string, extra?: Record<string, unknown>) {
  console.log(`[WHATSAPP_AI][${context}] ${message}`, extra ? JSON.stringify(extra) : "");
}

// Step 1: Identify molecule from competitor brand name or URL
async function identifyMoleculeFromCompetitor(ctx: any, userMessage: string): Promise<string | null> {
  try {
    const systemPrompt = `You are a pharmaceutical expert. Given a competitor brand name or product URL, identify the active molecule/ingredient.
Return ONLY a JSON object: { "molecule": "molecule name" } or { "molecule": null } if unknown.
Examples:
- "Lubricel Eye Drop" → { "molecule": "Sodium Carboxymethylcellulose" }
- "Lubicom Plus" → { "molecule": "Carboxymethylcellulose" }
- "https://www.fibovil.com/sodium-carboxymethylcellulose-oxychloro-sterile" → { "molecule": "Sodium Carboxymethylcellulose" }
- "Dolo 650" → { "molecule": "Paracetamol" }
Return ONLY the JSON object.`;
    const { text } = await generateWithGemini(ctx, systemPrompt, `Identify molecule for: ${userMessage}`, { jsonMode: true });
    const jsonStr = extractJsonFromMarkdown(text);
    const parsed = JSON.parse(jsonStr);
    return parsed.molecule || null;
  } catch (e) {
    return null;
  }
}

// Find best matching Cafoli product by molecule
function findProductByMolecule(products: any[], molecule: string): any | null {
  if (!molecule) return null;
  const molLower = molecule.toLowerCase();
  // Exact molecule match
  let match = products.find((p: any) => p.molecule?.toLowerCase() === molLower);
  if (match) return match;
  // Partial molecule match (molecule contains or is contained in)
  match = products.find((p: any) =>
    p.molecule && (
      p.molecule.toLowerCase().includes(molLower) ||
      molLower.includes(p.molecule.toLowerCase())
    )
  );
  return match || null;
}

// Multi-level fuzzy product matching by name
function findProductByName(products: any[], resourceName: string): any | null {
  if (!resourceName) return null;
  // Exact match
  let product = products.find((p: any) => p.name === resourceName);
  if (product) return product;
  // Case-insensitive exact
  const lower = resourceName.toLowerCase();
  product = products.find((p: any) => p.name?.toLowerCase() === lower);
  if (product) return product;
  // Partial name match
  product = products.find((p: any) =>
    p.name?.toLowerCase().includes(lower) || lower.includes(p.name?.toLowerCase() || "")
  );
  if (product) return product;
  // Brand name match
  product = products.find((p: any) =>
    p.brandName && (
      p.brandName.toLowerCase().includes(lower) ||
      lower.includes(p.brandName.toLowerCase())
    )
  );
  return product || null;
}

async function sendProductToLead(ctx: any, product: any, args: { leadId: any; phoneNumber: string }, introText?: string) {
  if (introText) {
    await ctx.runAction(internal.whatsapp.internal.sendMessage, {
      leadId: args.leadId,
      phoneNumber: args.phoneNumber,
      message: introText,
    });
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Send image: external URL first, then Convex storage
  if (product.externalImageUrl) {
    try {
      const extUrl = product.externalImageUrl.toLowerCase();
      const mimeType = extUrl.endsWith(".webp") ? "image/webp" : extUrl.endsWith(".png") ? "image/png" : "image/jpeg";
      await ctx.runAction(internal.whatsapp.messages.sendMediaFromUrl, {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        url: product.externalImageUrl,
        fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.${extUrl.split(".").pop() || "jpg"}`,
        mimeType,
      });
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (imgErr) {
      logAiError("SEND_PRODUCT_EXT_IMG", imgErr, { url: product.externalImageUrl });
    }
  } else {
    const filesToSend: Array<{ storageId: string; fileName: string; type: string; label: string }> = [];
    const getExtension = async (storageId: string) => {
      const meta = await ctx.runQuery(internal.products.getStorageMetadata, { storageId: storageId as any });
      if (meta?.contentType === "image/png") return "png";
      if (meta?.contentType === "image/jpeg" || meta?.contentType === "image/jpg") return "jpg";
      if (meta?.contentType === "application/pdf") return "pdf";
      return "jpg";
    };
    if (product.mainImage) {
      const ext = await getExtension(product.mainImage);
      filesToSend.push({ storageId: product.mainImage, fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_main.${ext}`, type: "image", label: "Main Image" });
    }
    if (product.flyer) {
      const ext = await getExtension(product.flyer);
      filesToSend.push({ storageId: product.flyer, fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_flyer.${ext}`, type: "image", label: "Flyer" });
    }
    if (product.bridgeCard) {
      const ext = await getExtension(product.bridgeCard);
      filesToSend.push({ storageId: product.bridgeCard, fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_bridge_card.${ext}`, type: "image", label: "Bridge Card" });
    }
    if (product.visualaid) {
      filesToSend.push({ storageId: product.visualaid, fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_visualaid.pdf`, type: "pdf", label: "Visual Aid" });
    }
    for (const file of filesToSend) {
      try {
        const metadata = await ctx.runQuery(internal.products.getStorageMetadata, { storageId: file.storageId as any });
        if (!metadata) continue;
        let correctMimeType = metadata?.contentType;
        if (!correctMimeType || correctMimeType === "application/octet-stream" || correctMimeType === "text/html") {
          correctMimeType = file.type === "pdf" ? "application/pdf" : "image/jpeg";
        }
        await ctx.runAction("whatsapp/messages:sendMedia" as any, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          storageId: file.storageId,
          fileName: file.fileName,
          mimeType: correctMimeType,
          message: undefined
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (fileError) {
        logAiError("SEND_PRODUCT_FILE", fileError, { label: file.label, storageId: file.storageId });
      }
    }
  }

  // Send external PDF if available
  if (product.externalPdfUrl) {
    try {
      await ctx.runAction(internal.whatsapp.messages.sendMediaFromUrl, {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        url: product.externalPdfUrl,
        fileName: `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        mimeType: "application/pdf",
      });
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (pdfErr) {
      logAiError("SEND_PRODUCT_EXT_PDF", pdfErr, { url: product.externalPdfUrl });
    }
  }

  // Send product details text
  const detailsMessage = [
    `*${product.name}*`,
    product.molecule ? `Molecule: ${product.molecule}` : null,
    product.mrp ? `MRP: ₹${product.mrp}` : null,
    product.packaging ? `Packaging: ${product.packaging}` : null,
    product.description ? `\n${product.description}` : null,
    product.pageLink ? `\nMore info: ${product.pageLink}` : null,
  ].filter(Boolean).join("\n");

  await ctx.runAction(internal.whatsapp.internal.sendMessage, {
    leadId: args.leadId,
    phoneNumber: args.phoneNumber,
    message: detailsMessage,
  });
}

export const generateChatSummary = action({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const chats = await ctx.runQuery(internal.whatsappQueries.getChatsByLeadId, { leadId: args.leadId });
    if (!chats || chats.length === 0) return "No chat history found.";
    const messages = chats[0].messages || [];
    if (messages.length === 0) return "No messages to summarize.";
    const recentMessages = messages.slice(-100);
    const formattedMessages = recentMessages.map((m: any) => `${m.direction === 'inbound' ? 'Lead' : 'Agent'}: ${m.content || 'Media/File'}`).join('\n');
    const systemPrompt = `You are a helpful CRM assistant. Summarize the following WhatsApp conversation between an agent and a lead. Keep it concise and highlight key points, requested products, and any pending actions.`;
    const userPrompt = `Conversation:\n${formattedMessages}`;
    const { text } = await generateWithGemini(ctx, systemPrompt, userPrompt);
    return text;
  }
});

export const generateAndSendAiReply = action({
  args: {
    prompt: v.string(),
    context: v.object({
      leadName: v.string(),
      recentMessages: v.array(v.object({
        role: v.string(),
        content: v.string(),
      })),
    }),
    userId: v.id("users"),
    leadId: v.id("leads"),
    phoneNumber: v.string(),
    replyingToMessageId: v.optional(v.id("messages")),
    replyingToExternalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.whatsappAi.generateAndSendAiReplyInternal, args);
  },
});

export const generateAndSendAiReplyInternal = internalAction({
  args: {
    leadId: v.id("leads"),
    phoneNumber: v.string(),
    prompt: v.string(),
    context: v.any(),
    userId: v.optional(v.id("users")),
    replyingToMessageId: v.optional(v.id("messages")),
    replyingToExternalId: v.optional(v.string()),
    isAutoReply: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      logAiInfo("REPLY", "Starting AI reply generation", { leadId: args.leadId, prompt: args.prompt.substring(0, 80) });

      const products = await ctx.runQuery(internal.products.listProductsInternal);
      const rangePdfs = await ctx.runQuery(internal.rangePdfs.listRangePdfsInternal);

      // Include molecule info so AI can match competitor brands by molecule
      const productList = products.map((p: any) =>
        `- ${p.name}${p.molecule ? ` (Molecule: ${p.molecule})` : ""}${p.brandName && p.brandName !== p.name ? ` [Brand: ${p.brandName}]` : ""}`
      ).join("\n");
      const pdfNames = rangePdfs.map((p: any) => p.name).join(", ");

      const systemPrompt = `You are a helpful CRM assistant for Cafoli Lifecare, a pharmaceutical company.
You are chatting with a lead on WhatsApp.

Available Cafoli Products (with molecules):
${productList}

Available Range PDFs: ${pdfNames}

Your goal is to assist the lead, answer questions, and provide product information.

IMPORTANT RULES:
- If the user asks for a product by name (Cafoli or competitor brand), use send_product.
- For send_product, resource_name should be the EXACT Cafoli product name from the list above.
- If the user asks for a competitor brand, try to find the Cafoli equivalent by molecule and use that name.
- If you cannot identify a matching Cafoli product, use intervention_request.
- When the user asks for "full catalogue", "complete catalogue", "all products", use send_full_catalogue.
- Do NOT randomly pick unrelated products. If unsure, use intervention_request.

You can perform the following actions by returning a JSON object:
1. Reply with text: { "action": "reply", "text": "your message" }
2. Send a product: { "action": "send_product", "text": "optional intro", "resource_name": "EXACT Cafoli product name" }
3. Send a PDF: { "action": "send_pdf", "text": "optional caption", "resource_name": "exact pdf name" }
4. Send full catalogue: { "action": "send_full_catalogue", "text": "optional message" }
5. Request human intervention: { "action": "intervention_request", "text": "I will connect you with an agent.", "reason": "reason" }
6. Request contact: { "action": "contact_request", "text": "I've noted your request.", "reason": "reason" }

Always return ONLY the JSON object. Do not include other text.`;

      const chatContext = JSON.stringify(args.context);
      const userPrompt = `Context: ${chatContext}\n\nUser Message: ${args.prompt}`;

      const { text } = await generateWithGemini(ctx, systemPrompt, userPrompt, { jsonMode: true });

      const jsonStr = extractJsonFromMarkdown(text);
      let aiAction;
      try {
        aiAction = JSON.parse(jsonStr);
      } catch (e) {
        logAiError("PARSE_JSON", e, { rawText: text.substring(0, 200) });
        aiAction = { action: "reply", text: text };
      }

      logAiInfo("ACTION", `Executing AI action: ${aiAction.action}`, { resource: aiAction.resource_name });

      if (aiAction.action === "reply") {
        await ctx.runAction(internal.whatsapp.internal.sendMessage, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          message: aiAction.text,
          quotedMessageId: args.replyingToMessageId,
          quotedMessageExternalId: args.replyingToExternalId,
        });

      } else if (aiAction.action === "send_product") {
        // Step 1: Try direct name-based fuzzy match
        let product = findProductByName(products, aiAction.resource_name);

        // Step 2: If no match, try molecule-based lookup via a separate Gemini call
        if (!product) {
          logAiInfo("SEND_PRODUCT", `No direct match for "${aiAction.resource_name}", trying molecule lookup`, { leadId: args.leadId });
          const molecule = await identifyMoleculeFromCompetitor(ctx, args.prompt);
          if (molecule) {
            logAiInfo("SEND_PRODUCT", `Identified molecule: ${molecule}`, { leadId: args.leadId });
            product = findProductByMolecule(products, molecule);
            if (product) {
              logAiInfo("SEND_PRODUCT", `Matched by molecule to: ${product.name}`, { leadId: args.leadId });
              // Update intro text to mention it's the Cafoli equivalent
              if (!aiAction.text) {
                aiAction.text = `We have Cafoli's equivalent product with the same active ingredient (${molecule}):`;
              }
            }
          }
        }

        if (product) {
          logAiInfo("SEND_PRODUCT", `Sending product: ${product.name}`, { leadId: args.leadId });
          await sendProductToLead(ctx, product, { leadId: args.leadId, phoneNumber: args.phoneNumber }, aiAction.text);
        } else {
          // No match found — escalate to intervention instead of sending wrong product
          logAiInfo("SEND_PRODUCT", `No product match found for "${aiAction.resource_name}", escalating to intervention`, { leadId: args.leadId });
          await ctx.runAction(internal.whatsapp.internal.sendMessage, {
            leadId: args.leadId,
            phoneNumber: args.phoneNumber,
            message: `I wasn't able to find an exact match for "${aiAction.resource_name}" in our catalog. Let me connect you with our team who can help you better.`,
          });
          const lead = await ctx.runQuery(internal.leads.queries.basic.getLeadByIdInternal, { leadId: args.leadId });
          await ctx.runMutation(internal.interventionRequests.createInterventionRequestInternal, {
            leadId: args.leadId,
            assignedTo: (lead && lead.assignedTo && !lead.isColdCallerLead) ? lead.assignedTo : undefined,
            requestedProduct: aiAction.resource_name,
            customerMessage: args.prompt,
            aiDraftedMessage: `Customer asked for "${aiAction.resource_name}" but no matching Cafoli product was found. Please assist.`,
          });
        }

      } else if (aiAction.action === "send_pdf") {
        const pdf = rangePdfs.find((p: any) => p.name === aiAction.resource_name);
        if (pdf) {
          logAiInfo("SEND_PDF", `Sending PDF: ${pdf.name}`, { leadId: args.leadId });
          const metadata = await ctx.runQuery(internal.products.getStorageMetadata, { storageId: pdf.storageId });
          await ctx.runAction("whatsapp/messages:sendMedia" as any, {
            leadId: args.leadId,
            phoneNumber: args.phoneNumber,
            storageId: pdf.storageId,
            fileName: `${pdf.name}.pdf`,
            mimeType: metadata?.contentType || "application/pdf",
            message: aiAction.text
          });
        } else {
          logAiError("SEND_PDF", new Error(`PDF not found: ${aiAction.resource_name}`), { availableCount: rangePdfs.length });
          await ctx.runAction(internal.whatsapp.internal.sendMessage, {
            leadId: args.leadId,
            phoneNumber: args.phoneNumber,
            message: `I couldn't find the PDF for ${aiAction.resource_name}. ${aiAction.text}`,
          });
        }

      } else if (aiAction.action === "send_full_catalogue") {
        logAiInfo("SEND_CATALOGUE", `Sending full catalogue with ${rangePdfs.length} PDFs`, { leadId: args.leadId });
        const catalogueMessage = aiAction.text || "Here is our complete product catalogue:";
        await ctx.runAction(internal.whatsapp.internal.sendMessage, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          message: `${catalogueMessage}\n\nhttps://cafoli.in/allproducts.aspx`,
        });
        for (const pdf of rangePdfs) {
          try {
            const metadata = await ctx.runQuery(internal.products.getStorageMetadata, { storageId: pdf.storageId });
            await ctx.runAction("whatsapp/messages:sendMedia" as any, {
              leadId: args.leadId,
              phoneNumber: args.phoneNumber,
              storageId: pdf.storageId,
              fileName: `${pdf.name}.pdf`,
              mimeType: metadata?.contentType || "application/pdf",
              message: pdf.name
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            logAiError("SEND_CATALOGUE_PDF", error, { pdfName: pdf.name });
          }
        }

      } else if (aiAction.action === "intervention_request") {
        logAiInfo("INTERVENTION", `Creating intervention request`, { leadId: args.leadId, reason: aiAction.reason });
        await ctx.runAction(internal.whatsapp.internal.sendMessage, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          message: aiAction.text,
        });
        const lead = await ctx.runQuery(internal.leads.queries.basic.getLeadByIdInternal, { leadId: args.leadId });
        await ctx.runMutation(internal.interventionRequests.createInterventionRequestInternal, {
          leadId: args.leadId,
          assignedTo: (lead && lead.assignedTo && !lead.isColdCallerLead) ? lead.assignedTo : undefined,
          requestedProduct: aiAction.resource_name,
          customerMessage: args.prompt,
          aiDraftedMessage: aiAction.reason || "Customer needs human assistance with their inquiry.",
        });

      } else if (aiAction.action === "contact_request") {
        logAiInfo("CONTACT_REQUEST", `Creating contact request`, { leadId: args.leadId });
        await ctx.runAction(internal.whatsapp.internal.sendMessage, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          message: aiAction.text,
        });
        const lead = await ctx.runQuery(internal.leads.queries.basic.getLeadByIdInternal, { leadId: args.leadId });
        if (lead && lead.assignedTo) {
          await ctx.runMutation(internal.contactRequests.createContactRequestInternal, {
            leadId: args.leadId,
            assignedTo: lead.assignedTo,
            customerMessage: args.prompt,
          });
        } else {
          logAiInfo("CONTACT_REQUEST", "Lead has no assigned user, creating intervention request instead", { leadId: args.leadId });
          await ctx.runMutation(internal.interventionRequests.createInterventionRequestInternal, {
            leadId: args.leadId,
            assignedTo: undefined,
            requestedProduct: undefined,
            customerMessage: args.prompt,
            aiDraftedMessage: `Contact request from unassigned lead: ${aiAction.reason || "Customer wants to be contacted."}`,
          });
        }

      } else {
        logAiError("UNKNOWN_ACTION", new Error(`Unknown AI action: ${aiAction.action}`), { aiAction });
      }

      logAiInfo("REPLY", "AI reply generation complete", { action: aiAction.action, leadId: args.leadId });

    } catch (error) {
      logAiError("GENERATE_REPLY", error, { leadId: args.leadId, phoneNumber: args.phoneNumber, prompt: args.prompt.substring(0, 100) });
      try {
        await ctx.runAction(internal.whatsapp.internal.sendMessage, {
          leadId: args.leadId,
          phoneNumber: args.phoneNumber,
          message: "I'm having trouble processing your request right now. Please try again later.",
        });
      } catch (sendErr) {
        logAiError("FALLBACK_SEND", sendErr, { leadId: args.leadId });
      }
    }
  }
});