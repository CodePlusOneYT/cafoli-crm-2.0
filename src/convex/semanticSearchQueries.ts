import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Score a lead against a set of search terms
function scoreLeadRelevance(lead: any, terms: string[]): number {
  const searchableText = [
    lead.name,
    lead.mobile,
    lead.altMobile,
    lead.email,
    lead.agencyName,
    lead.state,
    lead.district,
    lead.station,
    lead.source,
    lead.subject,
    lead.message,
    lead.pincode,
  ].filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (searchableText.includes(t)) {
      // Exact match in name gets highest score
      if ((lead.name || "").toLowerCase().includes(t)) score += 10;
      // Mobile match
      else if ((lead.mobile || "").includes(t)) score += 8;
      // Agency match
      else if ((lead.agencyName || "").toLowerCase().includes(t)) score += 6;
      // Other fields
      else score += 3;
    }
  }
  return score;
}

export const multiTermSearchQuery = internalQuery({
  args: {
    terms: v.array(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const seenIds = new Set<string>();
    const allResults: any[] = [];

    // Search with each term
    for (const term of args.terms) {
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

    // Score and rank results
    const scored = allResults.map(lead => ({
      ...lead,
      _relevanceScore: scoreLeadRelevance(lead, args.terms),
    }));

    scored.sort((a, b) => b._relevanceScore - a._relevanceScore);

    return scored.slice(0, args.limit);
  },
});