import { v } from "convex/values";

// Helper to standardize phone numbers
export function standardizePhoneNumber(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return "91" + cleaned;
  }
  return cleaned;
}

// Generate combined search text for leads
export function generateSearchText(data: {
  name?: string;
  subject?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  altEmail?: string;
  message?: string;
}) {
  return [
    data.name,
    data.subject,
    data.mobile,
    data.altMobile,
    data.email,
    data.altEmail,
    data.message
  ].filter(Boolean).join(" ");
}

// Helper to check permissions
export async function checkRole(ctx: any, allowedRoles: string[]) {
  const { getAuthUserId } = await import("@convex-dev/auth/server");
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  
  const user = await ctx.db.get(userId);
  if (!user || !user.role || !allowedRoles.includes(user.role)) {
    const { ROLES } = await import("./schema");
    if (user?.role === ROLES.ADMIN) return user;
    throw new Error("Permission denied");
  }
  return user;
}

// Helper to handle follow-up completion
export async function handleFollowUpChange(ctx: any, leadId: any, newDate: number | undefined, userId: any) {
  const now = Date.now();
  
  // Find pending follow-ups for this lead
  const pending = await ctx.db
    .query("followups")
    .withIndex("by_lead", (q: any) => q.eq("leadId", leadId))
    .filter((q: any) => q.eq(q.field("status"), "pending"))
    .collect();

  for (const followup of pending) {
    // Determine if it was overdue (grace period 20 mins = 1200000 ms)
    const isOverdue = now > (followup.scheduledAt + 20 * 60 * 1000);
    
    await ctx.db.patch(followup._id, {
      status: "completed",
      completedAt: now,
      completionStatus: isOverdue ? "overdue" : "timely",
    });
  }

  // Schedule new follow-up if provided
  if (newDate) {
    await ctx.db.insert("followups", {
      leadId,
      assignedTo: userId,
      scheduledAt: newDate,
      status: "pending",
    });
  }
}
