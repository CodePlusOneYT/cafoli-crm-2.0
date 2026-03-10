const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

async function test() {
  if (!accessToken || !phoneNumberId) {
    console.log("Missing credentials");
    return;
  }
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
