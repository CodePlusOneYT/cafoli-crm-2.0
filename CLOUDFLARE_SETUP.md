# Cloudflare Worker Setup for WhatsApp Media

This setup offloads heavy file transfers to a Cloudflare Worker.

## 1. Create the Worker
1. Go to your Cloudflare Dashboard > Workers & Pages.
2. Create a new Worker.
3. Copy the code from `cloudflare/worker.js` into the Worker editor.
4. Save and Deploy.

## 2. Configure Worker Environment Variables
In the Cloudflare Worker settings (Settings > Variables), add these variables:

- `CLOUD_API_ACCESS_TOKEN`: Your WhatsApp Cloud API Token (same as in Convex).
- `WA_PHONE_NUMBER_ID`: Your WhatsApp Phone Number ID (same as in Convex).
- `WORKER_AUTH_TOKEN`: A secure random string you create (e.g., "my-secret-token-123"). You will share this with Convex.

## 3. Configure Convex Environment Variables
In your Convex Dashboard (Settings > Environment Variables), add:

- `CLOUDFLARE_WORKER_URL`: The URL of your deployed worker (e.g., `https://my-worker.username.workers.dev`).
- `CLOUDFLARE_WORKER_TOKEN`: The same `WORKER_AUTH_TOKEN` you set in Cloudflare.

Once these are set, the system will automatically start using the Worker for sending product files.