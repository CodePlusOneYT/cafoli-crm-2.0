import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Score a lead against a set of search terms
// Returns 0 if no meaningful match (used to filter out irrelevant results)
function scoreLeadRelevance(lead: any, terms: string[], originalQuery: string): number {
  const q = originalQuery.toLowerCase();
  let score = 0;

  // Direct field checks for exact/partial matches
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

  // Phone number match — highest priority
  if (mobile.includes(q) || altMobile.includes(q)) score += 100;
  // Exact name match
  if (name === q) score += 80;
  else if (name.startsWith(q)) score += 50;
  else if (name.includes(q)) score += 30;
  // Agency match
  if (agencyName.includes(q)) score += 25;
  // Location match
  if (state.includes(q) || district.includes(q) || station.includes(q)) score += 15;
  // Pincode match
  if (pincode.includes(q)) score += 20;
  // Email match
  if (email.includes(q)) score += 20;
  // Subject/message match
  if (subject.includes(q)) score += 10;
  if (message.includes(q)) score += 5;
  if (source.includes(q)) score += 5;

  // Also score against expanded terms (but with lower weight)
  for (const term of terms) {
    if (term === originalQuery) continue; // Already scored above
    const t = term.toLowerCase();
    if (name.includes(t)) score += 5;
    else if (mobile.includes(t)) score += 8;
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

    // For phone searches, search only with the original query (no expansion)
    const termsToSearch = args.isPhoneSearch ? [originalQuery] : args.terms;

    // Search with each term
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

    // Score and rank results
    const scored = allResults.map(lead => ({
      ...lead,
      _relevanceScore: scoreLeadRelevance(lead, args.terms, originalQuery),
    }));

    // Filter out leads with zero relevance score (no meaningful match)
    const relevant = scored.filter(lead => lead._relevanceScore > 0);

    relevant.sort((a, b) => b._relevanceScore - a._relevanceScore);

    return relevant.slice(0, args.limit);
  },
});