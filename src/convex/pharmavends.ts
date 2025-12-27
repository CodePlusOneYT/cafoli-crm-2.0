"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const fetchPharmavendsLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiUrl = "https://script.google.com/macros/s/AKfycbxKrR7SZjO_DhJwJhguvAmnejgddGydFEvJSdsnmV-hl1UQMINjWNQ-dxJRNT155m-H/exec";
    
    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`Google Script API error: ${response.status} ${response.statusText}`);
        return { success: false, error: `API returned ${response.status}` };
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error("Invalid response from Google Script API: Expected array");
        return { success: false, error: "Invalid API response" };
      }
      
      let newLeadsCount = 0;
      let duplicatesCount = 0;
      
      // Process each lead
      for (const item of data) {
        // Map fields based on the provided column headers from the image
        // "Query No.", "Source", "Query_Name", "Subject", "Email", "Mobile No.", "Message", 
        // "Alt_Email", "Alt_Mobile", "Assigned To", "Status", "Relevance", "State", 
        // "Station", "District", "Pincode", "Agency Name"
        
        const uid = String(item["Query No."] || item["Query_No"] || "");
        
        if (!uid) continue;

        // Check if lead already exists by uid
        const existing = await ctx.runQuery(internal.pharmavendsMutations.checkLeadExists, {
          uid: uid,
        });
        
        if (existing) {
          // If lead exists but is Irrelevant, reactivate it
          if (existing.type === "Irrelevant") {
            await ctx.runMutation(internal.pharmavendsMutations.reactivateLead, {
              id: existing._id,
            });
            console.log(`Reactivated irrelevant lead: ${uid}`);
            newLeadsCount++; 
          } else {
            duplicatesCount++;
          }
          continue;
        }
        
        // Create the lead
        await ctx.runMutation(internal.pharmavendsMutations.createPharmavendsLead, {
          uid: uid,
          name: item["Query_Name"] || item["Query Name"] || item["Name"] || "Unknown",
          subject: item["Subject"] || "No Subject",
          mobile: String(item["Mobile No."] || item["Mobile_No"] || item["Mobile"] || ""),
          altMobile: item["Alt_Mobile"] || item["Alt Mobile"] || undefined,
          email: item["Email"] || undefined,
          altEmail: item["Alt_Email"] || item["Alt Email"] || undefined,
          agencyName: item["Agency Name"] || item["Agency_Name"] || undefined,
          pincode: String(item["Pincode"] || ""),
          state: item["State"] || undefined,
          district: item["District"] || undefined,
          station: item["Station"] || undefined,
          message: item["Message"] || undefined,
        });
        
        newLeadsCount++;
      }
      
      console.log(`Google Sheet sync completed: ${newLeadsCount} new leads, ${duplicatesCount} duplicates skipped`);
      
      return {
        success: true,
        newLeads: newLeadsCount,
        duplicates: duplicatesCount,
        total: data.length,
      };
      
    } catch (error) {
      console.error("Error fetching leads from Google Sheet:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});