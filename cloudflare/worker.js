export default {
  async fetch(request, env) {
    // Handle CORS
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
      return new Response("Method not allowed", { status: 405 });
    }

    // 1. Validate Auth
    const authHeader = request.headers.get("Authorization");
    const expectedToken = env.WORKER_AUTH_TOKEN;
    
    if (!authHeader || authHeader.replace("Bearer ", "").trim() !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const { phoneNumber, files } = await request.json();

      if (!phoneNumber || !files || !Array.isArray(files)) {
        throw new Error("Invalid request body");
      }

      // 2. Send Debug Message (Keep this for now to confirm connectivity)
      await sendWhatsAppMessage(env, phoneNumber, "text", {
        body: `[System] Processing ${files.length} file(s)...`
      });

      const results = [];

      // 3. Process Files
      for (const file of files) {
        try {
          console.log(`Processing file: ${file.fileName} (${file.mimeType})`);

          // A. Download from Convex (Source)
          const sourceResponse = await fetch(file.url);
          if (!sourceResponse.ok) {
            throw new Error(`Failed to download from source: ${sourceResponse.status}`);
          }

          // CRITICAL FIX: Read as ArrayBuffer first to ensure binary integrity
          const arrayBuffer = await sourceResponse.arrayBuffer();
          
          if (arrayBuffer.byteLength === 0) {
            throw new Error("Downloaded file is empty (0 bytes)");
          }

          // CRITICAL FIX: Create Blob with EXPLICIT MIME type
          // WhatsApp requires the blob to have the correct type property
          const fileBlob = new Blob([arrayBuffer], { type: file.mimeType });

          console.log(`Downloaded ${file.fileName}: ${fileBlob.size} bytes, type: ${fileBlob.type}`);

          // B. Upload to WhatsApp
          const formData = new FormData();
          formData.append("messaging_product", "whatsapp");
          // IMPORTANT: The third argument 'filename' is required by WhatsApp for documents
          formData.append("file", fileBlob, file.fileName);

          const uploadResponse = await fetch(
            `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/media`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
                // Do NOT set Content-Type header for FormData, fetch does it automatically with boundary
              },
              body: formData,
            }
          );

          const uploadResult = await uploadResponse.json();

          if (!uploadResponse.ok || !uploadResult.id) {
            console.error("WhatsApp Upload Failed:", JSON.stringify(uploadResult));
            throw new Error(`WhatsApp Media Upload Failed: ${JSON.stringify(uploadResult)}`);
          }

          const mediaId = uploadResult.id;
          console.log(`Media Uploaded. ID: ${mediaId}`);

          // C. Send Media Message
          const mediaType = file.mimeType.startsWith("image") ? "image" : 
                           file.mimeType.startsWith("video") ? "video" : 
                           file.mimeType.startsWith("audio") ? "audio" : "document";

          const messageBody = {
            id: mediaId,
            caption: file.fileName // Optional caption
          };
          
          // For documents, filename is required in the message payload too
          if (mediaType === "document") {
            messageBody.filename = file.fileName;
          }

          await sendWhatsAppMessage(env, phoneNumber, mediaType, messageBody);
          
          results.push({ fileName: file.fileName, status: "sent", mediaId });

        } catch (err) {
          console.error(`Error processing ${file.fileName}:`, err);
          results.push({ fileName: file.fileName, status: "failed", error: err.message });
          
          // Notify user of failure
          await sendWhatsAppMessage(env, phoneNumber, "text", {
            body: `[System] Failed to send ${file.fileName}: ${err.message}`
          });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

// Helper to send messages
async function sendWhatsAppMessage(env, to, type, content) {
  const url = `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: type,
    [type]: content
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Message Send Error:", err);
    throw new Error(`Failed to send message: ${err}`);
  }
  
  return response.json();
}
