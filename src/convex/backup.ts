import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const TABLES = [
  "users", "tags", "productCategories", "whatsappConfig", "geminiApiKeys", 
  "batchProcessControl", "rangePdfs", "whatsappMediaCache", "r2_leads_mock", 
  "whatsappTemplates", "templates", "products", "brevoApiKeys", "whatsappGroups", 
  "emailTemplates", "quickReplies", "exportLogs", "bulkContacts", "pushSubscriptions", 
  "leads", "campaigns", "coldCallerLeads", "contactRequests", "activityLogs", 
  "activeChatSessions", "chats", "messages", "comments", "leadSummaries", 
  "interventionRequests", "emailEnrollments", "campaignEnrollments", 
  "campaignExecutions", "followups"
] as const;

export const getTableDataBatch = query({
  args: { 
    table: v.string(),
    cursor: v.optional(v.union(v.string(), v.null()))
  },
  handler: async (ctx, args) => {
    if (!TABLES.includes(args.table as any)) throw new Error("Invalid table");
    const result = await ctx.db.query(args.table as any)
      .paginate({ cursor: args.cursor ?? null, numItems: 500 });
    return {
      page: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone
    };
  }
});

export const clearTableBatch = mutation({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    if (!TABLES.includes(args.table as any)) throw new Error("Invalid table");
    const records = await ctx.db.query(args.table as any).take(250);
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    return records.length === 250;
  }
});

export const restoreTableBatch = mutation({
  args: {
    table: v.string(),
    records: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    if (!TABLES.includes(args.table as any)) throw new Error("Invalid table");
    const idMapping: Record<string, string> = {};
    
    for (const record of args.records) {
      const { _id, _creationTime, ...data } = record;
      const newId = await ctx.db.insert(args.table as any, data);
      idMapping[_id] = newId;
    }
    
    return idMapping;
  }
});
