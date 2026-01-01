"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helper to generate HTML for PDF report
function generateReportHTML(stats: any, title: string, dateRange: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .stat-section { margin: 20px 0; }
          .stat-item { display: inline-block; margin: 10px 20px 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; }
          .stat-label { font-weight: bold; color: #667eea; }
          .stat-value { font-size: 24px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #667eea; color: white; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p><strong>Period:</strong> ${dateRange}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>

        <div class="stat-section">
          <h2>Summary</h2>
          <div class="stat-item">
            <div class="stat-label">Total Leads</div>
            <div class="stat-value">${stats.totalLeads}</div>
          </div>
        </div>

        <div class="stat-section">
          <h2>Lead Sources</h2>
          <table>
            <thead>
              <tr><th>Source</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${stats.sources.map((s: any) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="stat-section">
          <h2>Lead Status</h2>
          <table>
            <thead>
              <tr><th>Status</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${stats.status.map((s: any) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="stat-section">
          <h2>Lead Relevancy</h2>
          <table>
            <thead>
              <tr><th>Type</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${stats.relevancy.map((s: any) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        ${stats.assignment && stats.assignment.length > 0 ? `
        <div class="stat-section">
          <h2>Lead Assignment</h2>
          <table>
            <thead>
              <tr><th>Assigned To</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${stats.assignment.map((s: any) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="stat-section">
          <h2>Follow-up Punctuality</h2>
          <table>
            <thead>
              <tr><th>Status</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${stats.punctuality.map((s: any) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Cafoli Connect CRM - Automated Report</p>
        </div>
      </body>
    </html>
  `;
}

export const sendScheduledReports = internalAction({
  args: {
    reportType: v.string(), // "daily", "weekly", "monthly", "quarterly", "yearly"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let startDate: number;
    let dateRangeLabel: string;

    // Calculate date range based on report type
    switch (args.reportType) {
      case "daily":
        startDate = now - 24 * 60 * 60 * 1000; // Last 24 hours
        dateRangeLabel = new Date(startDate).toLocaleDateString('en-IN') + " - " + new Date(now).toLocaleDateString('en-IN');
        break;
      case "weekly":
        startDate = now - 7 * 24 * 60 * 60 * 1000; // Last 7 days
        dateRangeLabel = "Week of " + new Date(startDate).toLocaleDateString('en-IN');
        break;
      case "monthly":
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        startDate = lastMonth.getTime();
        dateRangeLabel = lastMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        break;
      case "quarterly":
        const lastQuarter = new Date(now);
        lastQuarter.setMonth(lastQuarter.getMonth() - 3);
        startDate = lastQuarter.getTime();
        dateRangeLabel = "Quarter ending " + new Date(now).toLocaleDateString('en-IN');
        break;
      case "yearly":
        const lastYear = new Date(now);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        lastYear.setMonth(0);
        lastYear.setDate(1);
        startDate = lastYear.getTime();
        dateRangeLabel = lastYear.getFullYear().toString();
        break;
      default:
        throw new Error("Invalid report type");
    }

    // Get all staff users
    const allUsers = await ctx.runQuery(internal.users.getAllUsersInternal);
    const staffUsers = allUsers.filter((u: any) => u.role === "staff");

    // Generate overall report
    const overallStats = await ctx.runQuery(internal.reports.getReportStats, {
      startDate,
      endDate: now,
    });

    if (!overallStats) {
      console.error("Failed to generate overall stats");
      return { success: false, error: "Failed to generate overall stats" };
    }

    const overallHTML = generateReportHTML(
      overallStats,
      `Overall ${args.reportType.charAt(0).toUpperCase() + args.reportType.slice(1)} Report`,
      dateRangeLabel
    );

    // Generate individual staff reports
    const staffReports = await Promise.all(
      staffUsers.map(async (user: any) => {
        const userStats = await ctx.runQuery(internal.reports.getReportStats, {
          startDate,
          endDate: now,
          userId: user._id,
        });

        if (!userStats) return null;

        const html = generateReportHTML(
          userStats,
          `${user.name} - ${args.reportType.charAt(0).toUpperCase() + args.reportType.slice(1)} Report`,
          dateRangeLabel
        );

        return {
          userName: user.name,
          html,
        };
      })
    );

    // Combine all reports into email body
    let emailBody = `
      <h2>Cafoli Connect CRM - ${args.reportType.charAt(0).toUpperCase() + args.reportType.slice(1)} Reports</h2>
      <p>Period: ${dateRangeLabel}</p>
      <hr/>
      <h3>Overall Report</h3>
      ${overallHTML}
      <hr/>
    `;

    staffReports.forEach((report) => {
      if (report) {
        emailBody += `
          <h3>${report.userName} Report</h3>
          ${report.html}
          <hr/>
        `;
      }
    });

    // Send email using Brevo
    try {
      await ctx.runAction(internal.brevo.sendEmailInternal, {
        to: "info@cafoli.in",
        toName: "Cafoli Admin",
        subject: `Cafoli CRM - ${args.reportType.charAt(0).toUpperCase() + args.reportType.slice(1)} Report - ${dateRangeLabel}`,
        htmlContent: emailBody,
      });

      console.log(`${args.reportType} report sent successfully`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send ${args.reportType} report:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});
