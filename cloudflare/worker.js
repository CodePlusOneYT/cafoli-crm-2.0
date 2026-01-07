export default {
  async fetch(request, env) {
    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Health Check
    if (request.method === "GET") {
      return new Response("Cloudflare Worker is running! Use POST to send files.", { status: 200 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 1. Validate Configuration
    const WORKER_TOKEN = env.WORKER_AUTH_TOKEN?.trim();
    const WA_TOKEN = env.CLOUD_API_ACCESS_TOKEN?.trim();
    const PHONE_ID = env.WA_PHONE_NUMBER_ID?.trim();

    if (!WORKER_TOKEN) return new Response("Error: WORKER_AUTH_TOKEN not set in Cloudflare", { status: 500 });
    if (!WA_TOKEN) return new Response("Error: CLOUD_API_ACCESS_TOKEN not set in Cloudflare", { status: 500 });
    if (!PHONE_ID) return new Response("Error: WA_PHONE_NUMBER_ID not set in Cloudflare", { status: 500 });

    // 2. Validate Request Authorization
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader.replace("Bearer ", "").trim() !== WORKER_TOKEN) {
      return new Response("Unauthorized: Invalid Token", { status: 401 });
    }

    try {
      const payload = await request.json();
      const { phoneNumber, files } = payload;

      if (!phoneNumber || !files || !Array.isArray(files)) {
        return new Response("Invalid request body", { status: 400 });
      }

      console.log(`[START] Processing ${files.length} files for ${phoneNumber}`);

      // 3. Send Debug Text Message (To confirm connectivity)
      // We send this first to ensure the user knows something is happening
      try {
        await fetch(
          `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${WA_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: phoneNumber,
              type: "text",
              text: { body: "🤖 [System] Processing media files... please wait." },
            }),
          }
        );
        console.log("[DEBUG_MSG_SENT] System message sent.");
      } catch (e) {
        console.error("[DEBUG_MSG_FAIL] Failed to send system message:", e);
      }

      const results = [];

      // 4. Process Each File
      for (const file of files) {
        try {
          console.log(`[FILE] Processing: ${file.fileName} (${file.mimeType})`);

          // A. Download File
          const fileResponse = await fetch(file.url, {
            headers: { "User-Agent": "CloudflareWorker/1.0" }
          });
          
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.statusText}`);
          }

          const arrayBuffer = await fileResponse.arrayBuffer();
          
          if (arrayBuffer.byteLength < 100) {
             // Check if it's a text error
             const text = new TextDecoder().decode(arrayBuffer);
             console.warn(`[FILE] Suspiciously small file (${arrayBuffer.byteLength} bytes): ${text}`);
             if (text.includes("Error") || text.includes("NotFound")) {
                throw new Error(`Downloaded file appears to be an error message: ${text}`);
             }
          }

          console.log(`[FILE] Downloaded ${arrayBuffer.byteLength} bytes.`);

          // B. MAGIC BYTE DETECTION (Crucial Fix)
          // Detect the REAL mime type from the file header
          const headerBytes = new Uint8Array(arrayBuffer.slice(0, 12));
          let detectedMime = null;

          if (headerBytes[0] === 0xFF && headerBytes[1] === 0xD8 && headerBytes[2] === 0xFF) {
            detectedMime = "image/jpeg";
          } else if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4E && headerBytes[3] === 0x47) {
            detectedMime = "image/png";
          } else if (headerBytes[0] === 0x25 && headerBytes[1] === 0x50 && headerBytes[2] === 0x44 && headerBytes[3] === 0x46) {
            detectedMime = "application/pdf";
          } else if (headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46 && headerBytes[8] === 0x57 && headerBytes[9] === 0x45 && headerBytes[10] === 0x42 && headerBytes[11] === 0x50) {
            detectedMime = "image/webp";
          }

          // Use detected mime if found, otherwise fallback to provided
          const finalMimeType = detectedMime || file.mimeType || "application/octet-stream";
          
          if (detectedMime && detectedMime !== file.mimeType) {
            console.log(`[FILE] MIME CORRECTION: Declared '${file.mimeType}' -> Detected '${detectedMime}'`);
          }

          // C. Create Blob with Correct Type
          const fileBlob = new Blob([arrayBuffer], { type: finalMimeType });

          // D. Upload to WhatsApp
          const formData = new FormData();
          formData.append("file", fileBlob, file.fileName);
          formData.append("messaging_product", "whatsapp");
          formData.append("type", finalMimeType); // Explicitly state type

          const uploadResponse = await fetch(
            `https://graph.facebook.com/v20.0/${PHONE_ID}/media`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${WA_TOKEN}` },
              body: formData,
            }
          );

          const uploadData = await uploadResponse.json();

          if (!uploadResponse.ok || !uploadData.id) {
            throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
          }

          const mediaId = uploadData.id;
          console.log(`[FILE] Uploaded. Media ID: ${mediaId} (Type: ${finalMimeType})`);

          // E. Send Message
          // Determine message type based on FINAL mime type
          let messageType = "document";
          if (finalMimeType.startsWith("image/")) messageType = "image";
          else if (finalMimeType.startsWith("video/")) messageType = "video";
          else if (finalMimeType.startsWith("audio/")) messageType = "audio";

          const messagePayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            type: messageType,
            [messageType]: {
              id: mediaId,
              // Add caption if it's an image/video to ensure it renders nicely
              caption: messageType === "image" || messageType === "video" ? file.fileName : undefined,
              // Add filename for documents
              filename: messageType === "document" ? file.fileName : undefined
            }
          };

          console.log(`[FILE] Sending message with ID: ${mediaId} as ${messageType}...`);

          const sendResponse = await fetch(
            `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${WA_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(messagePayload),
            }
          );

          const sendData = await sendResponse.json();

          if (!sendResponse.ok) {
            throw new Error(`Send failed: ${JSON.stringify(sendData)}`);
          }

          console.log(`[FILE] Message Sent! ID: ${sendData.messages?.[0]?.id}`);
          results.push({ status: "sent", fileName: file.fileName, messageId: sendData.messages?.[0]?.id });

        } catch (error) {
          console.error(`[FILE] Error processing ${file.fileName}:`, error);
          results.push({ status: "failed", fileName: file.fileName, error: error.message });
          
          // Try to send error notification to user
          try {
             await fetch(
              `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
              {
                method: "POST",
                headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: phoneNumber,
                  type: "text",
                  text: { body: `⚠️ Failed to send ${file.fileName}. Please contact support.` }
                }),
              }
            );
          } catch (e) {}
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      console.error("[WORKER] Critical Error:", err);
      return new Response(`Worker Error: ${err.message}`, { status: 500 });
    }
  },
};
