"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { generateWithGemini } from "./lib/gemini";

// Detect if a query is a phone number or numeric ID (should not be AI-expanded)
function isPhoneOrNumericQuery(query: string): boolean {
  const cleaned = query.replace(/[\s\-\+\(\)]/g, "");
  // Pure digits (phone number, pincode, ID)
  if (/^\d{4,}$/.test(cleaned)) return true;
  // Starts with + and mostly digits (international phone)
  if (/^\+\d{5,}$/.test(cleaned)) return true;
  return false;
}

// Detect if a query is a short exact-match query (name, city, etc.) that shouldn't be expanded
function isExactMatchQuery(query: string): boolean {
  // Single word queries under 4 chars — just search directly
  if (query.split(/\s+/).length === 1 && query.length <= 3) return true;
  return false;
}

// Helper: expand a search query with synonyms and related pharmaceutical terms using AI
async function expandQuery(ctx: any, query: string): Promise<string[]> {
  if (!query || query.length < 2) return [query];

  // Never expand phone numbers, numeric IDs, or very short queries
  if (isPhoneOrNumericQuery(query) || isExactMatchQuery(query)) {
    return [query];
  }

  try {
    const systemPrompt = `You are a pharmaceutical CRM search assistant. Your job is to expand search queries with synonyms, abbreviations, and related terms to improve search recall.

Given a search query, return a JSON array of search terms that should be searched to find relevant leads. Include:
- The original query
- Common abbreviations (e.g., "BP" for "blood pressure")
- Brand names and generic names (e.g., "Paracetamol" and "Acetaminophen")
- Related pharmaceutical terms
- Common misspellings
- Partial matches that would be useful

Return ONLY a JSON array of strings, no explanation. Maximum 5 terms. Keep each term short (1-3 words).
IMPORTANT: Do NOT include generic medical terms that would match thousands of leads. Only include terms closely related to the specific query.`;

    const userPrompt = `Search query: "${query}"\n\nReturn a JSON array of search terms.`;

    const result = await generateWithGemini(ctx, systemPrompt, userPrompt, { jsonMode: true });
    
    try {
      const parsed = JSON.parse(result.text);
      if (Array.isArray(parsed)) {
        const terms = [query, ...parsed.filter((t: any) => typeof t === "string" && t !== query)];
        return terms.slice(0, 5);
      }
    } catch {
      // JSON parse failed, fall back
    }
  } catch (error) {
    console.warn("AI query expansion failed, using original query:", error);
  }

  // Fallback: split into tokens
  const tokens = query.split(/\s+/).filter(t => t.length >= 2);
  return tokens.length > 1 ? [query, ...tokens] : [query];
}

// Expand a search query with synonyms and related pharmaceutical terms using AI
export const expandSearchQuery = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args): Promise<string[]> => {
    return expandQuery(ctx, args.query.trim());
  },
});

// Full semantic search: expand query with AI, then search with multiple terms
export const semanticSearchLeads = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const query = args.query.trim();
    if (!query) return [];

    const limit = args.limit ?? 50;
    const isPhoneSearch = isPhoneOrNumericQuery(query);

    // Step 1: Expand query with AI (skipped for phone/numeric queries)
    const searchTerms: string[] = await expandQuery(ctx, query);

    // Step 2: Search with each term, collect results
    const results = await ctx.runQuery(internal.semanticSearchQueries.multiTermSearchQuery, {
      terms: searchTerms.slice(0, 5),
      limit,
      isPhoneSearch,
      originalQuery: query,
    });

    return results;
  },
});