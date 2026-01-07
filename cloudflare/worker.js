export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Verify Authentication
    const authHeader = request.headers.get("Authorization");
    const expectedToken = env.WORKER_AUTH_TOKEN;
    
    if (!expectedToken) {
      return new Response("Worker configuration error: WORKER_AUTH_TOKEN not set", { status: 500 });
    }

    // Allow "Bearer TOKEN" or just "TOKEN" to be flexible
    const providedToken = authHeader?.replace("Bearer ", "").trim();
    
    if (!providedToken || providedToken !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { phoneNumber, files } = await request.json();

      if (!phoneNumber || !files || !Array.isArray(files)) {
        return new Response("Invalid request body", { status: 400 });
      }

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          // 1. Fetch file from Convex (or wherever the URL points)
          const fileResponse = await fetch(file.url);
          if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
          }
          const blob = await fileResponse.blob();

          // 2. Upload to WhatsApp
          const formData = new FormData();
          formData.append("file", blob, file.fileName);
          formData.append("messaging_product", "whatsapp");
          
          // Determine correct MIME type for upload
          let mimeType = file.mimeType;
          if (!mimeType) {
             if (file.fileName.endsWith(".pdf")) mimeType = "application/pdf";
             else if (file.fileName.endsWith(".jpg") || file.fileName.endsWith(".jpeg")) mimeType = "image/jpeg";
             else if (file.fileName.endsWith(".png")) mimeType = "image/png";
             else if (file.fileName.endsWith(".mp4")) mimeType = "video/mp4";
          }
          formData.append("type", mimeType);

          const uploadUrl = `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/media`;
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
            },
            body: formData,
          });

          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) {
            throw new Error(`WhatsApp Upload Failed: ${JSON.stringify(uploadData)}`);
          }

          const mediaId = uploadData.id;

          // 3. Send Message
          const messagePayload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "image", // Default, will be overwritten
          };

          // Determine message type
          let type = "document";
          if (mimeType.startsWith("image/")) type = "image";
          else if (mimeType.startsWith("video/")) type = "video";
          else if (mimeType.startsWith("audio/")) type = "audio";

          messagePayload.type = type;
          messagePayload[type] = { id: mediaId };
          
          if (type === "document") {
            messagePayload[type].filename = file.fileName;
          }

          const sendUrl = `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/messages`;
          const sendResponse = await fetch(sendUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(messagePayload),
          });

          const sendData = await sendResponse.json();
          if (!sendResponse.ok) {
            throw new Error(`WhatsApp Send Failed: ${JSON.stringify(sendData)}`);
          }

          results.push({ fileName: file.fileName, status: "sent", messageId: sendData.messages?.[0]?.id });

        } catch (err) {
          console.error(`Error processing file ${file.fileName}:`, err);
          errors.push({ fileName: file.fileName, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results, errors }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(`Worker Error: ${err.message}`, { status: 500 });
    }
  }
};
