import { internalMutation, internalQuery } from "./_generated/server";

export const checkHashFormat = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (user && user.passwordHash) {
      console.log("DEBUG: Found password:", user.passwordHash);
      return user.passwordHash;
    } else {
      console.log("DEBUG: No user with password found");
      return null;
    }
  },
});

export const resetAllPasswords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const password1234 = "1234";
    const passwordOwner = "Belive*8";

    let count = 0;
    for (const user of users) {
      if (user.email?.toLowerCase() === "owner") {
        await ctx.db.patch(user._id, { passwordHash: passwordOwner });
      } else {
        await ctx.db.patch(user._id, { passwordHash: password1234 });
      }
      count++;
    }
    return `Updated passwords for ${count} users`;
  },
});

export const checkCorruptedLeads = internalQuery({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("leads").collect();
    const corrupted = leads.filter(l => !l.mobile || l.mobile.length < 10 || l.mobile.includes("+") || l.mobile.includes(" ") || l.mobile.includes("-"));
    return {
      total: leads.length,
      corruptedCount: corrupted.length,
      sample: corrupted.slice(0, 10)
    };
  }
});

export const deleteCorruptedLeads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("leads").collect();
    const corrupted = leads.filter(l => !l.mobile || l.mobile.length < 10 || l.mobile.includes("+") || l.mobile.includes(" ") || l.mobile.includes("-"));
    
    let deleted = 0;
    for (const lead of corrupted) {
      // Only delete if name is also junk (like "*")
      if (!lead.name || lead.name === "*" || lead.name.trim() === "") {
        await ctx.db.delete(lead._id);
        deleted++;
      }
    }
    return { deleted, total: corrupted.length };
  }
});

export const checkBulkContactsStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const total = await ctx.db.query("bulkContacts").take(1000);
    const replied = total.filter(c => c.status === "replied");
    const sent = total.filter(c => c.status === "sent");
    const cold = total.filter(c => c.status === "cold");
    
    // Check how many replied contacts have corresponding leads
    let repliedWithLead = 0;
    let repliedWithoutLead = 0;
    const sampleMissingLeads: any[] = [];
    
    for (const contact of replied.slice(0, 50)) {
      const lead = await ctx.db
        .query("leads")
        .withIndex("by_mobile", (q) => q.eq("mobile", contact.phoneNumber))
        .first();
      
      if (lead) {
        repliedWithLead++;
      } else {
        repliedWithoutLead++;
        if (sampleMissingLeads.length < 5) {
          sampleMissingLeads.push({ phone: contact.phoneNumber, name: contact.name });
        }
      }
    }
    
    return {
      total: total.length,
      replied: replied.length,
      sent: sent.length,
      cold: cold.length,
      repliedWithLead,
      repliedWithoutLead,
      sampleMissingLeads,
    };
  },
});

export const inspectBulkContactPhones = internalQuery({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db
      .query("bulkContacts")
      .withIndex("by_sentAt")
      .order("desc")
      .take(10);
    
    return contacts.map(c => ({
      phoneNumber: c.phoneNumber,
      phoneLength: c.phoneNumber?.length,
      name: c.name,
      status: c.status,
    }));
  },
});

export const recoverBulkContactReplies = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all bulk contacts with status "sent"
    const sentContacts = await ctx.db
      .query("bulkContacts")
      .withIndex("by_sentAt")
      .order("desc")
      .take(1000);

    let matched = 0;
    let created = 0;
    let alreadyReplied = 0;

    for (const contact of sentContacts) {
      if (contact.status === "replied") {
        alreadyReplied++;
        continue;
      }

      const phone = contact.phoneNumber;
      const cleaned = phone.replace(/\D/g, "");
      
      // Try all possible formats
      const formats = [
        phone,
        cleaned,
        cleaned.length === 10 ? "91" + cleaned : null,
        cleaned.startsWith("91") && cleaned.length === 12 ? cleaned.slice(2) : null,
        "+" + cleaned,
      ].filter(Boolean) as string[];

      let foundLead = null;
      for (const fmt of formats) {
        const lead = await ctx.db
          .query("leads")
          .withIndex("by_mobile", (q) => q.eq("mobile", fmt))
          .first();
        if (lead) {
          foundLead = lead;
          break;
        }
      }

      if (foundLead) {
        // Mark bulk contact as replied
        await ctx.db.patch(contact._id, {
          status: "replied",
          lastInteractionAt: Date.now(),
        });
        matched++;
      }
    }

    return { matched, created, alreadyReplied, total: sentContacts.length };
  },
});