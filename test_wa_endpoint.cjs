const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require("dotenv").config({ path: ".env.local" });

async function run() {
  const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  
  if (!accessToken || !phoneNumberId) {
    console.log("Missing credentials");
    return;
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
  console.log(JSON.stringify(data, null, 2));
}
run();
