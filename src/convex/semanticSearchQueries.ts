import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

function scoreLeadRelevance(lead: any, terms: string[], originalQuery: string): number {
  const q = originalQuery.toLowerCase();
  let score = 0;

  const name = (lead.name || "").toLowerCase();
  const mobile = (lead.mobile || "").toLowerCase();
  const altMobile = (lead.altMobile || "").toLowerCase();
  const email = (lead.email || "").toLowerCase();
  const agencyName = (lead.agencyName || "").toLowerCase();
  const state = (lead.state || "").toLowerCase();
  const district = (lead.district || "").toLowerCase();
  const station = (lead.station || "").toLowerCase();
  const source = (lead.source || "").toLowerCase();
  const subject = (lead.subject || "").toLowerCase();
  const message = (lead.message || "").toLowerCase();
  const pincode = (lead.pincode || "").toLowerCase();

  // Phone number match — check all variants
  const phoneVariants = [q];
  const cleanedQ = q.replace(/[\s\-\+\(\)]/g, "");
  if (/^\d{10}$/.test(cleanedQ)) phoneVariants.push("91" + cleanedQ);
  if (/^\d{12}$/.test(cleanedQ) && cleanedQ.startsWith("91")) phoneVariants.push(cleanedQ.slice(2));

  for (const variant of phoneVariants) {
    if (mobile.includes(variant) || altMobile.includes(variant)) { score += 100; break; }
  }

  if (name === q) score += 80;
  else if (name.startsWith(q)) score += 50;
  else if (name.includes(q)) score += 30;
  if (agencyName.includes(q)) score += 25;
  if (state.includes(q) || district.includes(q) || station.includes(q)) score += 15;
  if (pincode.includes(q)) score += 20;
  if (email.includes(q)) score += 20;
  if (subject.includes(q)) score += 10;
  if (message.includes(q)) score += 5;
  if (source.includes(q)) score += 5;

  for (const term of terms) {
    if (term === originalQuery) continue;
    const t = term.toLowerCase();
    if (name.includes(t)) score += 5;
    else if (mobile.includes(t) || altMobile.includes(t)) score += 8;
    else if (agencyName.includes(t)) score += 4;
  }

  return score;
}

export const multiTermSearchQuery = internalQuery({
  args: {
    terms: v.array(v.string()),
    limit: v.number(),
    isPhoneSearch: v.optional(v.boolean()),
    originalQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seenIds = new Set<string>();
    const allResults: any[] = [];
    const originalQuery = args.originalQuery || args.terms[0] || "";

    // For phone searches, search all variants
    const termsToSearch = args.terms;

    for (const term of termsToSearch) {
      if (!term || term.length < 1) continue;
      
      try {
        const results = await ctx.db
          .query("leads")
          .withSearchIndex("search_all", (q) => q.search("searchText", term))
          .take(args.limit);

        for (const lead of results) {
          if (!seenIds.has(lead._id)) {
            seenIds.add(lead._id);
            allResults.push(lead);
          }
        }
      } catch {
        // Skip failed term searches
      }
    }

    const scored = allResults.map(lead => ({
      ...lead,
      _relevanceScore: scoreLeadRelevance(lead, args.terms, originalQuery),
    }));

    // For phone searches, include all results (don't filter by score 0)
    const relevant = args.isPhoneSearch
      ? scored
      : scored.filter(lead => lead._relevanceScore > 0);

    relevant.sort((a, b) => b._relevanceScore - a._relevanceScore);

    return relevant.slice(0, args.limit);
  },
});