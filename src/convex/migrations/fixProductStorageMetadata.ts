import { internalMutation, internalQuery, action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// Query to find products with potentially problematic storage
export const findProblematicProducts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const problematic = [];

    for (const product of products) {
      const issues = [];
      
      // Check each storage field
      if (product.mainImage) {
        const metadata = await ctx.db.system.get(product.mainImage);
        if (!metadata || !metadata.contentType || metadata.contentType === "application/octet-stream") {
          issues.push("mainImage");
        }
      }
      
      if (product.flyer) {
        const metadata = await ctx.db.system.get(product.flyer);
        if (!metadata || !metadata.contentType || metadata.contentType === "application/octet-stream") {
          issues.push("flyer");
        }
      }
      
      if (product.bridgeCard) {
        const metadata = await ctx.db.system.get(product.bridgeCard);
        if (!metadata || !metadata.contentType || metadata.contentType === "application/octet-stream") {
          issues.push("bridgeCard");
        }
      }
      
      if (product.visualaid) {
        const metadata = await ctx.db.system.get(product.visualaid);
        if (!metadata || !metadata.contentType || metadata.contentType === "application/octet-stream") {
          issues.push("visualaid");
        }
      }

      if (issues.length > 0) {
        problematic.push({
          _id: product._id,
          name: product.name,
          issues,
        });
      }
    }

    return problematic;
  },
});

// Add this new query to check individual file metadata
export const checkFileMetadata = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const metadata = await ctx.db.system.get(args.storageId);
    return metadata;
  },
});

// Action to run the full migration check and report
export const runMigration = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    count: number;
    products?: Array<{ _id: any; name: string; issues: string[]; details: any }>;
  }> => {
    const problematic: Array<{ _id: any; name: string; issues: string[] }> = await ctx.runQuery(internal.migrations.fixProductStorageMetadata.findProblematicProducts);
    
    if (problematic.length === 0) {
      return {
        success: true,
        message: "✅ All products have correct file metadata!",
        count: 0,
      };
    }

    const productsWithDetails = problematic.map(p => ({
      ...p,
      details: `Files with issues: ${p.issues.join(", ")}. These files will download as .htm because they lack proper Content-Type metadata.`
    }));

    return {
      success: false,
      message: `⚠️ Found ${problematic.length} product(s) with incorrect file metadata.\n\n` +
               `These files were uploaded without proper Content-Type headers and will download as .htm files.\n\n` +
               `Solution: Use the Edit button (✏️) on each product to re-upload the affected files.\n\n` +
               `Affected files will be replaced with properly formatted versions.`,
      count: problematic.length,
      products: productsWithDetails,
    };
  },
});

// Helper to detect MIME type from magic bytes
function detectMimeTypeFromBytes(bytes: Uint8Array): string | null {
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }
  // PDF: 25 50 44 46
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

// Action to fix files with incorrect metadata
export const fixFiles = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    fixed: number;
    failed: Array<{ productName: string; field: string; error: string }>;
  }> => {
    const problematic: Array<{ _id: any; name: string; issues: string[] }> = await ctx.runQuery(internal.migrations.fixProductStorageMetadata.findProblematicProducts);
    
    if (problematic.length === 0) {
      return {
        success: true,
        message: "No files need fixing!",
        fixed: 0,
        failed: [],
      };
    }

    let fixedCount = 0;
    const failures: Array<{ productName: string; field: string; error: string }> = [];

    for (const product of problematic) {
      for (const field of product.issues) {
        try {
          // Get the product to access the storage ID
          const productData = await ctx.runQuery(internal.migrations.fixProductStorageMetadata.getProductForFix, { 
            productId: product._id 
          });
          
          if (!productData) {
            failures.push({ productName: product.name, field, error: "Product not found" });
            continue;
          }

          const storageId = (productData as any)[field];
          if (!storageId) {
            failures.push({ productName: product.name, field, error: "Storage ID not found" });
            continue;
          }

          // Get the file URL and fetch the content
          const url = await ctx.storage.getUrl(storageId);
          if (!url) {
            failures.push({ productName: product.name, field, error: "Could not get file URL" });
            continue;
          }

          // Fetch the file content
          const response = await fetch(url);
          if (!response.ok) {
            failures.push({ productName: product.name, field, error: `Failed to fetch file: ${response.statusText}` });
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          // Detect correct MIME type
          const correctMimeType = detectMimeTypeFromBytes(bytes);
          if (!correctMimeType) {
            failures.push({ productName: product.name, field, error: "Could not detect file type" });
            continue;
          }

          // Create a blob with the correct MIME type
          const blob = new Blob([bytes], { type: correctMimeType });

          // Upload the file with correct metadata
          const uploadUrl = await ctx.storage.generateUploadUrl();
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": correctMimeType },
            body: blob,
          });

          if (!uploadResponse.ok) {
            failures.push({ productName: product.name, field, error: "Failed to upload corrected file" });
            continue;
          }

          const { storageId: newStorageId } = await uploadResponse.json();

          // Update the product with the new storage ID
          await ctx.runMutation(internal.migrations.fixProductStorageMetadata.updateProductFile, {
            productId: product._id,
            field,
            newStorageId,
            oldStorageId: storageId,
          });

          fixedCount++;
        } catch (error: any) {
          failures.push({ 
            productName: product.name, 
            field, 
            error: error.message || "Unknown error" 
          });
        }
      }
    }

    return {
      success: failures.length === 0,
      message: `Fixed ${fixedCount} file(s). ${failures.length > 0 ? `${failures.length} failed.` : ""}`,
      fixed: fixedCount,
      failed: failures,
    };
  },
});

// Helper query to get product data for fixing
export const getProductForFix = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

// Helper mutation to update product file reference
export const updateProductFile = internalMutation({
  args: {
    productId: v.id("products"),
    field: v.string(),
    newStorageId: v.id("_storage"),
    oldStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    updates[args.field] = args.newStorageId;
    
    // Also update the images array if it's the mainImage
    if (args.field === "mainImage") {
      updates.images = [args.newStorageId];
    }
    
    await ctx.db.patch(args.productId, updates);
    
    // Delete the old file
    try {
      await ctx.storage.delete(args.oldStorageId);
    } catch (e) {
      // Ignore if already deleted
      console.log("Could not delete old file:", e);
    }
  },
});