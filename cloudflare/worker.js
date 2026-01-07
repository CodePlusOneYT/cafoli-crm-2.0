      // 2. Download the file
      console.log(`[Worker] Downloading from: ${file.url}`);
      const fileResponse = await fetch(file.url, {
        headers: {
          "User-Agent": "Cloudflare-Worker-WhatsApp-Relay"
        }
      });
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.statusText}`);
      }
      
      // Use blob() directly for better binary handling
      const originalBlob = await fileResponse.blob();
      
      // Force the MIME type we expect (Convex sometimes returns generic types)
      const blob = originalBlob.slice(0, originalBlob.size, file.mimeType);
      
      console.log(`[Worker] Downloaded. Size: ${blob.size} bytes, Type: ${blob.type} (Expected: ${file.mimeType})`);

      if (blob.size < 100) {
         console.warn("[Worker] Warning: File is suspiciously small. It might be an error text.");
      }

      // 3. Upload to WhatsApp
      console.log(`[Worker] Uploading to WhatsApp ...`);
      const formData = new FormData();
      
      formData.append("file", blob, file.fileName);
      formData.append("messaging_product", "whatsapp");