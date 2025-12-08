# Cloudflare Pages Deployment Setup

## Required Environment Variables

You need to set these environment variables in your Cloudflare Pages dashboard:

### 1. VITE_CONVEX_URL (Frontend Environment Variable)

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `VITE_CONVEX_URL`
   - **Value**: Your Convex deployment URL (e.g., `https://your-project.convex.cloud`)
   - **Environment**: Select both "Production" and "Preview"

To find your Convex URL:
- Go to your Convex dashboard at https://dashboard.convex.dev
- Select your project
- Copy the deployment URL from the dashboard

### 2. JWT_PRIVATE_KEY (Backend Environment Variable)

**Note**: This should be set in your Convex backend, NOT in Cloudflare Pages.

1. Go to your Convex dashboard at https://dashboard.convex.dev
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `JWT_PRIVATE_KEY`
   - **Value**: Generate a secure private key using:
     