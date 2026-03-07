import { internalQuery } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getAnyUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").first();
  }
});

export const testIndiamartLeadProcessing = internalMutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const start = Date.now();
    const uniqueId = "TEST_QUERY_" + Date.now();
    const result = (await ctx.runMutation(internal.indiamartMutations.processIndiamartLead, {
      uniqueQueryId: uniqueId,
      name: "Test IndiaMART Lead",
      subject: "Test Subject",
      mobile: "9876543210",
      email: "test@example.com",
      message: "Test message",
      metadata: {
        queryTime: new Date().toISOString(),
        queryType: "W",
        mcatName: "Test Category",
        productName: "Test Product",
        countryIso: "IN",
      }
    })) as any;
    const end = Date.now();
    
    // Test deduplication by running it again
    const start2 = Date.now();
    const result2 = (await ctx.runMutation(internal.indiamartMutations.processIndiamartLead, {
      uniqueQueryId: uniqueId,
      name: "Test IndiaMART Lead Updated",
      subject: "Test Subject",
      mobile: "9876543210",
      email: "test@example.com",
      message: "Test message 2",
      metadata: {
        queryTime: new Date().toISOString(),
        queryType: "W",
        mcatName: "Test Category",
        productName: "Test Product",
        countryIso: "IN",
      }
    })) as any;
    const end2 = Date.now();

    return { 
      creation: { result, timeMs: end - start },
      deduplication: { result: result2, timeMs: end2 - start2 }
    };
  }
});

export const testWhatsAppLeadProcessing = internalMutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const start = Date.now();
    const phone = "919876543211";
    const result = (await ctx.runMutation(internal.whatsappMutations.processWhatsAppLead, {
      phoneNumber: phone,
      name: "Test WhatsApp Lead",
      message: "Test message",
    })) as any;
    const end = Date.now();

    // Test deduplication
    const start2 = Date.now();
    const result2 = (await ctx.runMutation(internal.whatsappMutations.processWhatsAppLead, {
      phoneNumber: phone,
      name: "Test WhatsApp Lead",
      message: "Test message 2",
    })) as any;
    const end2 = Date.now();

    return { 
      creation: { result, timeMs: end - start },
      deduplication: { result: result2, timeMs: end2 - start2 }
    };
  }
});

export const testProcessWhatsAppLeadPerformance = internalMutation({
  args: { iterations: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const times = [];
    for (let i = 0; i < args.iterations; i++) {
      const start = Date.now();
      await ctx.runMutation(internal.whatsappMutations.processWhatsAppLead, {
        phoneNumber: `9198765432${i % 10}`, // Mix of new and existing (10 unique numbers)
        name: `Test Lead ${i}`,
      });
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { 
      iterations: args.iterations,
      avgTimeMs: avg, 
      maxTimeMs: Math.max(...times), 
      minTimeMs: Math.min(...times) 
    };
  }
});