# Cloudflare Pages Deployment Setup

## Your Convex Deployment URL

Your Convex URL is: `https://polished-marmot-96.convex.cloud`

## Required Environment Variables

### 1. VITE_CONVEX_URL (Frontend Environment Variable - Cloudflare Pages)

**CRITICAL FIX**: Cloudflare Pages requires environment variables to be set as **Build environment variables**, not just runtime variables. The variable must have an actual value, not be empty or undefined.

**IMPORTANT**: Make sure the value field is not empty when you set the environment variable. The value should be exactly: `https://polished-marmot-96.convex.cloud` (without quotes, no trailing spaces).

**IMPORTANT**: Make sure the value field is not empty when you set the environment variable. The value should be exactly: `https://polished-marmot-96.convex.cloud` (without quotes, no trailing spaces).

1. Go to your Cloudflare Pages dashboard
2. Select your project (cafoli-crm or similar)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `VITE_CONVEX_URL`
   - **Value**: `https://polished-marmot-96.convex.cloud`
   - **Environment**: Select **both "Production" and "Preview"**
   - **IMPORTANT**: Make sure this is set as a **Build variable** (not just a runtime variable)
5. Click **Save**
6. **CRITICAL**: Go to **Deployments** tab and:
   - Click **Retry deployment** (preferred), OR
   - Push a new commit to trigger a rebuild
   - **Clear build cache** if the issue persists (in deployment settings)

**Why this is needed:**
- Vite requires environment variables at **build time**, not runtime
- The updated `vite.config.ts` now explicitly injects `VITE_CONVEX_URL` from `process.env` during the build
- Cloudflare Pages must pass the environment variable to the build process

**Troubleshooting if still not working:**
- Verify the variable name is exactly `VITE_CONVEX_URL` (case-sensitive)
- **CRITICAL**: Verify the value field is not empty - it should contain: `https://polished-marmot-96.convex.cloud`
- Check the deployment logs to confirm the variable is being set during build
- Look for a line like: "Environment: VITE_CONVEX_URL=https://polished-marmot-96.convex.cloud"
- Ensure you're checking the correct environment (Production vs Preview)
- Try clearing Cloudflare's build cache and redeploying
- Check browser console for the debug logs showing:
  - `convexUrl` value
  - `convexUrlType` (should be "string")
  - `convexUrlValue` (should show the actual URL)
- **If the value shows as "undefined" (string)**: The environment variable is being set to the literal string "undefined" instead of the actual URL. Delete and recreate the variable in Cloudflare Pages.

### 2. JWT_PRIVATE_KEY (Backend Environment Variable - Convex Dashboard)

**Note**: This should be set in your Convex backend, NOT in Cloudflare Pages.

1. Go to your Convex dashboard at https://dashboard.convex.dev
2. Select your project (polished-marmot-96)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `JWT_PRIVATE_KEY`
   - **Value**: Generate a secure private key. You can use a random string or generate one.
     - Example command to generate: `openssl rand -hex 32`
     - Or just use a long random string like: `your-secure-random-private-key-here-12345`

### 3. CONVEX_SITE_URL (Backend Environment Variable - Convex Dashboard)

**REQUIRED FOR AUTHENTICATION**: This variable is required for the authentication system to verify tokens.

1. Go to your Convex dashboard at https://dashboard.convex.dev
2. Select your project (polished-marmot-96)
3. Navigate to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Variable name**: `CONVEX_SITE_URL`
   - **Value**: `https://polished-marmot-96.convex.site`
   - **IMPORTANT**: Note that this ends in `.site`, NOT `.cloud`.

## Troubleshooting

### "Could not verify OIDC token claim" Error
If you see this error, it means one of two things:
1. **CONVEX_SITE_URL** is missing or incorrect in your Convex Dashboard.
   - Ensure it is set to `https://polished-marmot-96.convex.site`
2. **JWT_PRIVATE_KEY** is missing or mismatching.
   - Ensure you have set a `JWT_PRIVATE_KEY` in the Convex Dashboard.

### "VITE_CONVEX_URL is required" Error
If you see this error, it means the frontend cannot find the Convex URL.
1. Ensure `VITE_CONVEX_URL` is set in Cloudflare Pages -> Settings -> Environment Variables.
2. Ensure it is a **Build** variable (available at build time).
3. **Redeploy** your application after setting the variable.