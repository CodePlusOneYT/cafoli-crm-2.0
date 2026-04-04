"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Geocode with international support — no country restriction by default
// If country is provided, try with country first, then without
async function nominatimGeocode(query: string, countryCode?: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Try with country code first if provided
    if (countryCode) {
      const urlWithCountry = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=${countryCode.toLowerCase()}`;
      const res = await fetch(urlWithCountry, {
        headers: { "User-Agent": "CafoliConnect/1.0 (hardcorgamingstyle@gmail.com)" },
      });
      if (res.ok) {
        const data: any[] = await res.json();
        if (data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      }
    }

    // Try without country restriction (international fallback)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "CafoliConnect/1.0 (hardcorgamingstyle@gmail.com)" },
    });
    if (!response.ok) return null;
    const data: any[] = await response.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Detect country code from lead data
function detectCountryCode(lead: any): string | undefined {
  if (lead.country) {
    // Map common country names to ISO codes
    const countryMap: Record<string, string> = {
      "india": "in", "in": "in",
      "usa": "us", "united states": "us", "us": "us",
      "uk": "gb", "united kingdom": "gb", "gb": "gb",
      "uae": "ae", "united arab emirates": "ae",
      "nepal": "np", "np": "np",
      "bangladesh": "bd", "bd": "bd",
      "pakistan": "pk", "pk": "pk",
      "sri lanka": "lk", "lk": "lk",
      "australia": "au", "au": "au",
      "canada": "ca", "ca": "ca",
      "germany": "de", "de": "de",
      "france": "fr", "fr": "fr",
    };
    const normalized = lead.country.toLowerCase().trim();
    return countryMap[normalized];
  }
  // Default to India if no country specified (existing leads)
  return "in";
}

export const geocodeLead = action({
  args: {
    leadId: v.id("leads"),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ lat: number; lng: number } | null> => {
    const parts = [args.city, args.state].filter(Boolean);
    if (parts.length === 0 && !args.country) return null;

    const query = [...parts, args.country].filter(Boolean).join(", ");
    
    // Detect country code for targeted search
    const countryCode = args.country ? detectCountryCode({ country: args.country }) : "in";
    const coords = await nominatimGeocode(query, countryCode);
    if (!coords) return null;

    await ctx.runMutation(internal.geocodingDb.updateLeadCoordinates, {
      id: args.leadId,
      lat: coords.lat,
      lng: coords.lng,
    });

    return coords;
  },
});

export const batchGeocodeLeads = internalAction({
  args: {},
  handler: async (ctx): Promise<{ geocoded: number; total: number }> => {
    const leads: any[] = await ctx.runQuery(internal.geocodingDb.queryLeadsNeedingGeocode, {});
    let geocoded = 0;

    // Process up to 40 leads per run (1.1s delay each = ~44s total, well within action limits)
    for (const lead of leads.slice(0, 40)) {
      // Build location query — prefer more specific data
      const countryCode = detectCountryCode(lead);
      
      // Build query parts from most specific to least
      const parts: string[] = [];
      if (lead.station) parts.push(lead.station);
      if (lead.district) parts.push(lead.district);
      if (lead.state) parts.push(lead.state);
      if (lead.country) parts.push(lead.country);
      else if (countryCode === "in") parts.push("India");

      if (parts.length === 0 && lead.pincode) {
        parts.push(lead.pincode);
        if (countryCode === "in") parts.push("India");
      }

      if (parts.length === 0) continue;

      const query = parts.join(", ");
      const coords = await nominatimGeocode(query, countryCode);
      if (coords) {
        await ctx.runMutation(internal.geocodingDb.updateLeadCoordinates, {
          id: lead._id,
          lat: coords.lat,
          lng: coords.lng,
        });
        geocoded++;
      }
      // Nominatim rate limit: 1 request/second
      await new Promise<void>((r) => setTimeout(r, 1100));
    }

    return { geocoded, total: leads.length };
  },
});