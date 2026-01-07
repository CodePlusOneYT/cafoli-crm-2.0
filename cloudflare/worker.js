export default {
  async fetch(request, env) {
    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Security: Verify the request comes from your Convex backend
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.WORKER_AUTH_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      // Parse the payload from Convex
      const { phoneNumber, files } = await request.json();
      const results = [];

      // Process each file sequentially
      for (const file of files) {
        try {
          // 1. Download the file from Convex Storage (using the signed URL provided)
          const fileResp = await fetch(file.url);
          if (!fileResp.ok) throw new Error(`Failed to download ${file.fileName}`);
          const blob = await fileResp.blob();

          // 2. Upload to WhatsApp Media API
          const formData = new FormData();
          formData.append("file", blob, file.fileName);
          formData.append("messaging_product", "whatsapp");

          const uploadResp = await fetch(
            `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/media`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
              },
              body: formData,
            }
          );

          const uploadData = await uploadResp.json();
          if (!uploadData.id) {
            throw new Error(`WhatsApp Upload failed: ${JSON.stringify(uploadData)}`);
          }

          // 3. Send the Message with the Media ID
          const isImage = file.mimeType.startsWith("image");
          const messageType = isImage ? "image" : "document";
          
          const messagePayload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: messageType,
            [messageType]: {
              id: uploadData.id,
              caption: file.fileName // Use filename as caption
            }
          };
          
          // Documents require a filename field
          if (!isImage) {
             messagePayload[messageType].filename = file.fileName;
          }

          const sendResp = await fetch(
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
          
          const sendData = await sendResp.json();
          results.push({ 
            fileName: file.fileName, 
            status: "sent", 
            id: sendData.messages?.[0]?.id,
            success: true 
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.fileName}:`, fileError);
          results.push({ 
            fileName: file.fileName, 
            status: "failed", 
            error: fileError.message,
            success: false
          });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
