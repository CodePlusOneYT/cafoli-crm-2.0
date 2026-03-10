import { internalMutation } from "./_generated/server";

export const fixPhoneNumbers = internalMutation({
  handler: async (ctx) => {
    const leads = await ctx.db.query("leads").collect();
    let fixedLeads = 0;
    for (const lead of leads) {
      if (lead.mobile) {
        const cleaned = lead.mobile.replace(/\D/g, "");
        if (cleaned !== lead.mobile) {
          await ctx.db.patch(lead._id, { mobile: cleaned });
          fixedLeads++;
        }
      }
    }
    return { fixedLeads };
  }
});
