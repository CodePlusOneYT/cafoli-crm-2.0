"use node";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Parse the allproduct.aspx HTML to extract product rows
// Strategy: find each "first-all-p" td directly, then extract the next fixed-len link
// This avoids the <tr> boundary problem caused by navigation HTML bleeding into rows
function parseProductListHtml(html: string): Array<{ brandName: string; composition: string; pageUrl: string; imageUrl: string; dosageForm: string }> {
  const products: Array<{ brandName: string; composition: string; pageUrl: string; imageUrl: string; dosageForm: string }> = [];
  
  // Find all "first-all-p" td positions
  // Pattern: <td class="first-all-p ..."><a href='slug'>Brand Name</a></td>
  const firstTdRegex = /<td[^>]*class="first-all-p[^"]*"[^>]*>\s*<a\s+href='([^']+)'>([^<]+)<\/a>\s*<\/td>/gi;
  let firstTdMatch;
  
  while ((firstTdMatch = firstTdRegex.exec(html)) !== null) {
    const slug = firstTdMatch[1].trim();
    const brandName = firstTdMatch[2].trim();
    
    if (!brandName || brandName.length < 2 || !slug) continue;
    
    const pageUrl = `https://cafoli.in/${slug}`;
    const matchEnd = firstTdMatch.index + firstTdMatch[0].length;
    
    // Look for the fixed-len link in the next ~500 chars after this td
    const nextChunk = html.substring(matchEnd, matchEnd + 600);
    
    // The composition td comes immediately after: <td ...><a href='slug' class="fixed-len">Composition</a></td>
    const compMatch = nextChunk.match(/class="fixed-len">([^<]+)<\/a>/i);
    const rawComposition = compMatch ? compMatch[1].trim() : "";
    
    // Validate: reject navigation/blog content
    const isValidComposition = rawComposition &&
      rawComposition.length < 250 &&
      !rawComposition.toLowerCase().includes("guide") &&
      !rawComposition.toLowerCase().includes("franchise") &&
      !rawComposition.toLowerCase().includes("pcd") &&
      !rawComposition.toLowerCase().includes("pharma") &&
      !rawComposition.toLowerCase().includes("business") &&
      !rawComposition.toLowerCase().includes("company") &&
      !rawComposition.includes("'>") &&
      !rawComposition.includes("</");
    
    const composition = isValidComposition ? rawComposition : "";
    
    // Look for dosage form in the next td after composition
    const dosageMatch = nextChunk.match(/class="fixed-len">[^<]+<\/a>\s*<\/td>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
    const dosageForm = dosageMatch ? dosageMatch[1].trim() : "";
    
    // Look for image URL in the last-all-p td (within next 800 chars)
    const imgChunk = html.substring(matchEnd, matchEnd + 800);
    const imgMatch = imgChunk.match(/src="(https:\/\/cafoli\.in\/Static\/V1\/OtherPageImages\/[^"]+\.webp)"/i);
    const imageUrl = imgMatch ? imgMatch[1] : "";
    
    products.push({ brandName, composition, pageUrl, imageUrl, dosageForm });
  }
  
  return products;
}

// Extract product details from a product page HTML
function extractProductPageDetails(html: string): {
  composition: string | null;
  mrp: string | null;
  packaging: string | null;
  description: string | null;
  imageUrl: string | null;
  pdfUrl: string | null;
  literaturePdfUrl: string | null;
} {
  const imageMatches = [...html.matchAll(/https:\/\/cafoli\.in\/Static\/V1\/OtherPageImages\/([^"'\s]+\.webp)/gi)];
  const validImages = imageMatches
    .map(m => `https://cafoli.in/Static/V1/OtherPageImages/${m[1]}`)
    .filter(url => {
      const filename = url.split("/").pop() || "";
      return filename.length > 10;
    });
  const imageUrl = validImages[1] || validImages[0] || null;
  
  const pdfMatches = [...html.matchAll(/https:\/\/cafoli\.in\/Static\/V1\/OtherPagepdf\/([^"'\s]+\.pdf)/gi)];
  const pdfUrls = pdfMatches.map(m => `https://cafoli.in/Static/V1/OtherPagepdf/${m[1]}`);
  const pdfUrl = pdfUrls[0] || null;
  const literaturePdfUrl = pdfUrls[1] || null;
  
  // Extract composition from product page: <p class="com-name"><b class="c-name">Composition : </b>...</p>
  const compositionMatch = html.match(/<p[^>]*class="com-name"[^>]*>[\s\S]*?<b[^>]*class="c-name"[^>]*>Composition\s*:\s*<\/b>\s*([^<]+)/i) ||
                           html.match(/Composition\s*:\s*<\/b>\s*([^<\n]{5,300})/i) ||
                           html.match(/<b[^>]*>Composition\s*:\s*<\/b>\s*([^<\n]{5,300})/i);
  const composition = compositionMatch ? compositionMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  
  const mrpMatch = html.match(/[₹Rs\.]\s*(\d+(?:\.\d+)?)\s*\/-/i) ||
                   html.match(/Price\s*:\s*[₹Rs\.]*\s*(\d+)/i);
  const mrp = mrpMatch ? mrpMatch[1] : null;
  
  // Extract packaging: <p><b>Packaging : </b>10ml</p>
  const packagingMatch = html.match(/<b[^>]*>Packaging\s*:\s*<\/b>\s*([^<\n]{1,100})/i) ||
                         html.match(/Packaging\s*:\s*<\/strong>\s*([^<\n]+)/i) ||
                         html.match(/Packaging\s*:\s*([^\n<]{1,100})/i);
  const packaging = packagingMatch ? packagingMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  
  // Extract description from substantial paragraphs
  const paraMatches = [...html.matchAll(/<p[^>]*>([^<]{100,600})<\/p>/gi)];
  const description = paraMatches.length > 0 ? paraMatches[0][1].replace(/<[^>]+>/g, "").trim().substring(0, 400) : null;
  
  return { composition, mrp, packaging, description, imageUrl, pdfUrl, literaturePdfUrl };
}

export const listWebProductsPublic = action({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    return await ctx.runQuery(internal.cafoliScraperDb.listWebProducts);
  },
});

// Scrape a batch of product detail pages
export const scrapeProductDetailsBatch = internalAction({
  args: {
    products: v.array(v.object({
      brandName: v.string(),
      composition: v.optional(v.string()),
      dosageForm: v.optional(v.string()),
      pageUrl: v.string(),
      imageUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let scraped = 0;
    let failed = 0;
    
    for (const product of args.products) {
      try {
        const res = await fetch(product.pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CafoliBot/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        
        let details = { composition: null as string | null, mrp: null as string | null, packaging: null as string | null, description: null as string | null, imageUrl: product.imageUrl || null, pdfUrl: null as string | null, literaturePdfUrl: null as string | null };
        
        if (res.ok) {
          const html = await res.text();
          details = extractProductPageDetails(html);
          if (!details.imageUrl && product.imageUrl) {
            details.imageUrl = product.imageUrl;
          }
        }
        
        // Use page-extracted composition if available, else fall back to list composition
        const finalComposition = details.composition || product.composition;
        
        await ctx.runMutation(internal.cafoliScraperDb.upsertWebProduct, {
          brandName: product.brandName,
          composition: finalComposition,
          dosageForm: product.dosageForm,
          pageUrl: product.pageUrl,
          imageUrl: details.imageUrl || undefined,
          pdfUrl: details.pdfUrl || undefined,
          literaturePdfUrl: details.literaturePdfUrl || undefined,
          mrp: details.mrp || undefined,
          packaging: details.packaging || undefined,
          description: details.description || undefined,
        });
        
        scraped++;
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[SCRAPER] Failed to scrape ${product.pageUrl}:`, err);
        try {
          await ctx.runMutation(internal.cafoliScraperDb.upsertWebProduct, {
            brandName: product.brandName,
            composition: product.composition,
            dosageForm: product.dosageForm,
            pageUrl: product.pageUrl,
            imageUrl: product.imageUrl || undefined,
          });
          scraped++;
        } catch (e) {
          failed++;
        }
      }
    }
    
    return { scraped, failed };
  },
});

// Main scraper action: fetch all products from allproduct.aspx and scrape details
export const scrapeAllCafoliProducts = action({
  args: {
    batchSize: v.optional(v.number()),
    startOffset: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ total: number; scraped: number; failed: number; hasMore: boolean; nextOffset: number }> => {
    const batchSize = args.batchSize || 50;
    const startOffset = args.startOffset || 0;
    
    console.log(`[SCRAPER] Fetching product list from cafoli.in/allproduct.aspx`);
    
    const res = await fetch("https://cafoli.in/allproduct.aspx", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CafoliBot/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch product list: ${res.status}`);
    }
    
    const html = await res.text();
    const allProducts = parseProductListHtml(html);
    
    console.log(`[SCRAPER] Found ${allProducts.length} products in list`);
    
    const batch = allProducts.slice(startOffset, startOffset + batchSize);
    const hasMore = startOffset + batchSize < allProducts.length;
    const nextOffset = startOffset + batchSize;
    
    if (batch.length === 0) {
      return { total: allProducts.length, scraped: 0, failed: 0, hasMore: false, nextOffset };
    }
    
    const result = await ctx.runAction(internal.cafoliScraper.scrapeProductDetailsBatch, {
      products: batch.map(p => ({
        brandName: p.brandName,
        composition: p.composition || undefined,
        dosageForm: p.dosageForm || undefined,
        pageUrl: p.pageUrl,
        imageUrl: p.imageUrl || undefined,
      })),
    });
    
    console.log(`[SCRAPER] Batch complete: ${result.scraped} scraped, ${result.failed} failed`);
    
    return {
      total: allProducts.length,
      scraped: result.scraped,
      failed: result.failed,
      hasMore,
      nextOffset,
    };
  },
});

export const getWebProductStats = action({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const count = await ctx.runQuery(internal.cafoliScraperDb.getWebProductCount);
    return { count };
  },
});

// Fix corrupted compositions by re-fetching from product pages
// Processes in batches of 20 to avoid timeouts
export const fixCorruptedCompositions = action({
  args: {
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ fixed: number; skipped: number; failed: number; hasMore: boolean; nextOffset: number }> => {
    const offset = args.offset || 0;
    const batchSize = 20;

    // Get all products with corrupted compositions
    const allProducts: any[] = await ctx.runQuery(internal.cafoliScraperDb.listWebProducts);
    
    const corruptedProducts = allProducts.filter((p: any) => {
      if (!p.composition) return false;
      const c = p.composition.toLowerCase();
      return (
        c.includes("guide-in-pcd-franchise") ||
        c.includes("'>") ||
        c.includes("</a>") ||
        c.includes("dropdown-item") ||
        c.includes("guide") ||
        c.includes("franchise") ||
        c.includes("pcd pharma") ||
        c.includes("business") ||
        c.includes("company") ||
        p.composition.length > 300
      );
    });

    const batch = corruptedProducts.slice(offset, offset + batchSize);
    const hasMore = offset + batchSize < corruptedProducts.length;
    const nextOffset = offset + batchSize;

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const product of batch) {
      try {
        const res = await fetch(product.pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CafoliBot/1.0)" },
          signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
          // Clear the corrupted composition at minimum
          await ctx.runMutation(internal.cafoliScraperDb.patchWebProduct, {
            id: product._id,
            composition: undefined,
          });
          skipped++;
          continue;
        }

        const html = await res.text();
        
        // Extract composition using the reliable com-name pattern
        const compositionMatch = html.match(/<p[^>]*class="com-name"[^>]*>[\s\S]*?<b[^>]*class="c-name"[^>]*>Composition\s*:\s*<\/b>\s*([^<]+)/i) ||
                                 html.match(/Composition\s*:\s*<\/b>\s*([^<\n]{5,300})/i);
        const composition = compositionMatch ? compositionMatch[1].replace(/<[^>]+>/g, "").trim() : undefined;

        await ctx.runMutation(internal.cafoliScraperDb.patchWebProduct, {
          id: product._id,
          composition,
        });

        fixed++;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.error(`[FIX_COMP] Failed for ${product.pageUrl}:`, err);
        // At minimum clear the corrupted value
        try {
          await ctx.runMutation(internal.cafoliScraperDb.patchWebProduct, {
            id: product._id,
            composition: undefined,
          });
        } catch {}
        failed++;
      }
    }

    console.log(`[FIX_COMP] Batch done: ${fixed} fixed, ${skipped} skipped, ${failed} failed. Total corrupted: ${corruptedProducts.length}, hasMore: ${hasMore}`);

    return { fixed, skipped, failed, hasMore, nextOffset };
  },
});