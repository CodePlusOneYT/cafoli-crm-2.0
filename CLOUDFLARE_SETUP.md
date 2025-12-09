# Cloudflare Pages Deployment Setup

## Your Convex Deployment URL

Your Convex URL is: `https://polished-marmot-96.convex.cloud`

## Required Environment Variables

### 1. VITE_CONVEX_URL (Frontend Environment Variable - Cloudflare Pages)

**IMPORTANT**: After adding or updating environment variables, you MUST trigger a new deployment for changes to take effect.

1. Go to your Cloudflare Pages dashboard
2. Select your project (cafoli-crm or similar)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `VITE_CONVEX_URL`
   - **Value**: `https://polished-marmot-96.convex.cloud`
   - **Environment**: Select **both "Production" and "Preview"**
5. Click **Save**
6. **CRITICAL**: Go to **Deployments** tab and:
   - Click **Retry deployment** (preferred), OR
   - Push a new commit to trigger a rebuild
   - **Clear build cache** if the issue persists (in deployment settings)

**Troubleshooting if still not working:**
- Verify the variable name is exactly `VITE_CONVEX_URL` (case-sensitive)
- Check the deployment logs to confirm the variable is being set during build
- Ensure you're checking the correct environment (Production vs Preview)
- Try clearing Cloudflare's build cache and redeploying
- Check browser console for debug logs showing available environment variables

### 2. JWT_PRIVATE_KEY (Backend Environment Variable - Convex Dashboard)

**Note**: This should be set in your Convex backend, NOT in Cloudflare Pages.

1. Go to your Convex dashboard at https://dashboard.convex.dev
2. Select your project (polished-marmot-96)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `JWT_PRIVATE_KEY`
   - **Value**: Generate a secure private key using:
     
