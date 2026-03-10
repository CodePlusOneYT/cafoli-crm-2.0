"use node";
import { action } from "./_generated/server";

export const testFetch = action({
  args: {},
  handler: async (ctx) => {
    const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    
    if (!accessToken || !phoneNumberId) {
      return "Missing credentials";
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages?limit=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    return data;
  }
});
