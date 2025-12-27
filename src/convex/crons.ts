import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fetch leads from Google Sheet every 5 minutes
crons.interval(
  "fetch_pharmavends_leads",
  { minutes: 5 },
  internal.pharmavends.fetchPharmavendsLeads,
  {}
);

export default crons;