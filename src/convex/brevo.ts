"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

interface BrevoEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export const sendEmail = action({
  args: {
    to: v.string(),
    toName: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
    textContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    
    if (!apiKey) {
      console.error("BREVO_API_KEY not configured");
      throw new Error("Email service not configured. Please set BREVO_API_KEY in backend environment variables.");
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Cafoli Connect",
            email: "welcome@mail.skinticals.com",
          },
          to: [
            {
              email: args.to,
              name: args.toName,
            },
          ],
          subject: args.subject,
          htmlContent: args.htmlContent,
          textContent: args.textContent || args.htmlContent.replace(/<[^>]*>/g, ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Brevo API error:", data);
        throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
      }

      console.log("Email sent successfully:", data);
      return { success: true, messageId: data.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

export const sendWelcomeEmail = action({
  args: {
    leadName: v.string(),
    leadEmail: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    
    if (!apiKey) {
      console.error("BREVO_API_KEY not configured");
      throw new Error("Email service not configured. Please set BREVO_API_KEY in backend environment variables.");
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Cafoli Connect!</h1>
            </div>
            <div class="content">
              <p>Dear ${args.leadName},</p>
              
              <p>Thank you for your interest! We've received your inquiry through <strong>${args.source}</strong> and our team is excited to connect with you.</p>
              
              <p>Our dedicated team will review your requirements and reach out to you shortly with personalized solutions tailored to your needs.</p>
              
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Our team will review your inquiry within 24 hours</li>
                <li>A dedicated representative will contact you to discuss your requirements</li>
                <li>We'll provide you with customized solutions and pricing</li>
              </ul>
              
              <p>If you have any immediate questions, feel free to reply to this email or contact us directly.</p>
              
              <p>Best regards,<br>
              <strong>The Cafoli Connect Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message from Cafoli Connect CRM</p>
              <p>© ${new Date().getFullYear()} Cafoli Connect. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Cafoli Connect",
            email: "welcome@mail.skinticals.com",
          },
          to: [
            {
              email: args.leadEmail,
              name: args.leadName,
            },
          ],
          subject: "Welcome to Cafoli Connect - We've Received Your Inquiry",
          htmlContent,
          textContent: htmlContent.replace(/<[^>]*>/g, ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Brevo API error:", data);
        throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
      }

      console.log("Welcome email sent successfully:", data);
      return { success: true, messageId: data.messageId };
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});
