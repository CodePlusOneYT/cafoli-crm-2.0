import { v } from "convex/values";

// Campaign block type validators
export const waitBlockValidator = v.object({
  type: v.literal("wait"),
  duration: v.number(),
  unit: v.union(v.literal("minutes"), v.literal("hours"), v.literal("days")),
});

export const sendEmailBlockValidator = v.object({
  type: v.literal("send_email"),
  subject: v.string(),
  content: v.string(),
  trackOpens: v.optional(v.boolean()),
  trackClicks: v.optional(v.boolean()),
});

export const sendWhatsAppBlockValidator = v.object({
  type: v.literal("send_whatsapp"),
  templateId: v.id("templates"),
  templateName: v.string(),
});

export const conditionalBlockValidator = v.object({
  type: v.literal("conditional"),
  condition: v.union(
    v.literal("email_opened"),
    v.literal("email_replied"),
    v.literal("email_link_clicked"),
    v.literal("whatsapp_read"),
    v.literal("whatsapp_replied")
  ),
  timeLimit: v.number(),
  timeLimitUnit: v.union(v.literal("minutes"), v.literal("hours"), v.literal("days")),
  truePath: v.array(v.string()), // Block IDs for true path
  falsePath: v.array(v.string()), // Block IDs for false path
});

export const abTestBlockValidator = v.object({
  type: v.literal("ab_test"),
  splitPercentage: v.number(), // 0-100, percentage for path A
  pathA: v.array(v.string()), // Block IDs for path A
  pathB: v.array(v.string()), // Block IDs for path B
});

export const addTagBlockValidator = v.object({
  type: v.literal("add_tag"),
  tagId: v.id("tags"),
});

export const removeTagBlockValidator = v.object({
  type: v.literal("remove_tag"),
  tagId: v.id("tags"),
});

export const leadConditionBlockValidator = v.object({
  type: v.literal("lead_condition"),
  condition: v.union(
    v.literal("has_tags"),
    v.literal("overdue_followup"),
    v.literal("followup_in_more_than"),
    v.literal("followup_in_less_than")
  ),
  tagIds: v.optional(v.array(v.id("tags"))),
  timeValue: v.optional(v.number()),
  timeUnit: v.optional(v.union(v.literal("minutes"), v.literal("hours"), v.literal("days"))),
  truePath: v.array(v.string()),
  falsePath: v.array(v.string()),
});

export const campaignBlockValidator = v.union(
  waitBlockValidator,
  sendEmailBlockValidator,
  sendWhatsAppBlockValidator,
  conditionalBlockValidator,
  abTestBlockValidator,
  addTagBlockValidator,
  removeTagBlockValidator,
  leadConditionBlockValidator
);

export const leadSelectionValidator = v.object({
  type: v.union(v.literal("all"), v.literal("filtered")),
  tagIds: v.optional(v.array(v.id("tags"))),
  statuses: v.optional(v.array(v.string())),
  sources: v.optional(v.array(v.string())),
  autoEnrollNew: v.optional(v.boolean()),
});
