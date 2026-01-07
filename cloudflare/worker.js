export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS (Preflight & Simple Requests)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 2. Health Check
    if (request.method === "GET") {
      return new Response("Cloudflare Worker is running! Method must be POST to send files.", {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // 3. Validate Environment Variables
    if (!env.WORKER_AUTH_TOKEN) {
      return new Response("Server Error: WORKER_AUTH_TOKEN not set in Cloudflare variables", { status: 500 });
    }
    if (!env.CLOUD_API_ACCESS_TOKEN) {
      return new Response("Server Error: CLOUD_API_ACCESS_TOKEN not set in Cloudflare variables", { status: 500 });
    }
    if (!env.WA_PHONE_NUMBER_ID) {
      return new Response("Server Error: WA_PHONE_NUMBER_ID not set in Cloudflare variables", { status: 500 });
    }

    // 4. Authenticate Request
    const authHeader = request.headers.get("Authorization");
    const expectedToken = env.WORKER_AUTH_TOKEN.trim();
    
    if (!authHeader || authHeader.replace("Bearer ", "").trim() !== expectedToken) {
      return new Response("Unauthorized: Invalid Token", { status: 401 });
    }

    // 5. Process Request
    try {
      const { phoneNumber, files } = await request.json();

      if (!phoneNumber || !files || !Array.isArray(files)) {
        return new Response("Invalid request body", { status: 400 });
      }

      const results = [];

      for (const file of files) {
        try {
          // A. Fetch file from Convex (or any URL)
          const fileResponse = await fetch(file.url);
          if (!fileResponse.ok) throw new Error(`Failed to download file: ${fileResponse.statusText}`);
          const blob = await fileResponse.blob();

          // B. Upload to WhatsApp Media API
          const formData = new FormData();
          formData.append("file", blob, file.fileName);
          formData.append("messaging_product", "whatsapp");
          formData.append("type", file.mimeType);

          const uploadResponse = await fetch(
            `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/media`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
              },
              body: formData,
            }
          );

          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(`WhatsApp Upload Failed: ${JSON.stringify(uploadData)}`);

          const mediaId = uploadData.id;

          // C. Send Message with Media ID
          let messageType = "document";
          if (file.mimeType.startsWith("image/")) messageType = "image";
          else if (file.mimeType.startsWith("video/")) messageType = "video";
          else if (file.mimeType.startsWith("audio/")) messageType = "audio";

          const messagePayload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: messageType,
            [messageType]: { id: mediaId }
          };
          
          if (messageType === "document") {
            messagePayload[messageType].filename = file.fileName;
          }

          const sendResponse = await fetch(
            `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(messagePayload),
            }
          );

          const sendData = await sendResponse.json();
          if (!sendResponse.ok) throw new Error(`WhatsApp Send Failed: ${JSON.stringify(sendData)}`);

          results.push({ fileName: file.fileName, status: "sent", messageId: sendData.messages?.[0]?.id });

        } catch (err) {
          console.error(`Error processing file ${file.fileName}:`, err);
          results.push({ fileName: file.fileName, status: "failed", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (err) {
      return new Response(`Worker Error: ${err.message}`, { status: 500 });
    }
  },
};
