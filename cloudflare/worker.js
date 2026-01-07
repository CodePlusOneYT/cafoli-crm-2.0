/**
 * Cloudflare Worker for WhatsApp Media Uploads
 * Handles fetching files from Convex and uploading to WhatsApp Graph API
 * Includes Magic Byte Detection to fix MIME type mismatches (e.g. PNGs labeled as JPGs)
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
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
      return new Response("Cloudflare Worker is running! Method must be POST to send files.", { status: 200 });
    }

    // Verify Auth Token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.WORKER_AUTH_TOKEN}`) {
      return new Response("Unauthorized: Invalid WORKER_AUTH_TOKEN", { status: 401 });
    }

    try {
      const { phoneNumber, files } = await request.json();

      if (!phoneNumber || !files || !Array.isArray(files)) {
        return new Response("Invalid request body", { status: 400 });
      }

      // Send a processing message first (optional, helps debug)
      await sendWhatsAppMessage(env, phoneNumber, "text", { body: "🤖 [System] Processing media files..." });

      const results = [];

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.fileName}`);
          
          // 1. Fetch file from Convex
          const fileResponse = await fetch(file.url);
          if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
          
          const fileBuffer = await fileResponse.arrayBuffer();
          
          // 2. MAGIC BYTE DETECTION (Fixes "Sent but not received" issues)
          // Detect real mime type from file content, ignoring what Convex says
          const realMimeType = getMimeTypeFromMagicBytes(fileBuffer, file.mimeType);
          
          // Fix filename extension if needed
          let finalFileName = file.fileName;
          if (realMimeType === 'image/png' && !finalFileName.toLowerCase().endsWith('.png')) {
             finalFileName = finalFileName.replace(/\.[^/.]+$/, "") + ".png";
          } else if ((realMimeType === 'image/jpeg' || realMimeType === 'image/jpg') && !finalFileName.match(/\.jpe?g$/i)) {
             finalFileName = finalFileName.replace(/\.[^/.]+$/, "") + ".jpg";
          }

          console.log(`Detected MIME: ${realMimeType}, Final Filename: ${finalFileName}`);

          // 3. Upload to WhatsApp
          const mediaId = await uploadToWhatsApp(env, fileBuffer, realMimeType, finalFileName);
          
          // 4. Send Message
          const messageType = realMimeType.startsWith('image') ? 'image' : 
                              realMimeType.startsWith('video') ? 'video' : 
                              realMimeType.startsWith('audio') ? 'audio' : 'document';
                              
          const messageBody = { id: mediaId };
          if (messageType === 'document') messageBody.filename = finalFileName;
          
          await sendWhatsAppMessage(env, phoneNumber, messageType, messageBody);
          
          results.push({ fileName: finalFileName, status: "sent", mediaId });
          
        } catch (error) {
          console.error(`Failed to send ${file.fileName}:`, error);
          results.push({ fileName: file.fileName, status: "failed", error: error.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(`Worker Error: ${error.message}`, { status: 500 });
    }
  },
};

// --- Helpers ---

function getMimeTypeFromMagicBytes(buffer, fallbackMime) {
  const bytes = new Uint8Array(buffer).subarray(0, 4);
  const header = bytes.reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');

  // PNG: 89 50 4E 47
  if (header.startsWith('89504e47')) return 'image/png';
  
  // JPEG: FF D8 FF
  if (header.startsWith('ffd8ff')) return 'image/jpeg';
  
  // PDF: 25 50 44 46
  if (header.startsWith('25504446')) return 'application/pdf';
  
  // GIF: 47 49 46 38
  if (header.startsWith('47494638')) return 'image/gif';

  return fallbackMime || 'application/octet-stream';
}

async function uploadToWhatsApp(env, buffer, mimeType, fileName) {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("messaging_product", "whatsapp");

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
      },
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(`WhatsApp Upload Error: ${JSON.stringify(data)}`);
  return data.id;
}

async function sendWhatsAppMessage(env, to, type, content) {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type,
        [type]: content,
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(`WhatsApp Send Error: ${JSON.stringify(data)}`);
  return data;
}
