const { ConvexHttpClient } = require("convex/browser");
require("dotenv").config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function run() {
  // We can't easily query all without a function, let's just create a convex function to check
}
run();
