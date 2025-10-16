// 'use strict';

// /**
//  * lead controller
//  */

// const { createCoreController } = require('@strapi/strapi').factories;

// module.exports = createCoreController('api::lead.lead');


const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::lead.lead", ({ strapi }) => ({
  async create(ctx) {
    try {
      const { phone_number, full_name, calculator_report_token, lead_source, ...rest } =
        ctx.request.body.data;

      if (!phone_number) return ctx.badRequest("phone_number is required");

      const cleanPhone = phone_number.replace(/\D/g, "").slice(-10);

      // ✅ Lead ID generator (only for new entries)
      const generateLeadId = () => {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // e.g., 20251016
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase(); // random 6 chars
        return `LD-${datePart}-${rand}`;
      };

      const manualSources = ["ads", "referral", "direct call", "whatsapp", "email"];
      const isManual = manualSources.includes(lead_source);

      // 🧩 Manual entry always creates new lead
      if (isManual) {
        console.log("📞 Manual lead entry");
        const newLead = await strapi.db.query("api::lead.lead").create({
          data: {
            lead_id: generateLeadId(), // ✅ new ID only for new record
            phone_number: cleanPhone,
            full_name,
            lead_source,
            submission_time: new Date().toISOString(),
            ...rest,
          },
        });
        return newLead;
      }

      // 🧩 Auto/Calculator flow
      const existing = await strapi.db.query("api::lead.lead").findOne({
        where: { phone_number: cleanPhone },
      });

      if (existing) {
        console.log("♻️ Updating existing lead, keeping existing lead_id");
        const updated = await strapi.db.query("api::lead.lead").update({
          where: { id: existing.id },
          data: {
            full_name: full_name || existing.full_name,
            calculator_report_token,
            lead_source,
            submission_time: new Date().toISOString(),
            ...rest,
          },
        });
        return updated;
      } else {
        console.log("🆕 Creating new lead (calculator)");
        const newLead = await strapi.db.query("api::lead.lead").create({
          data: {
            lead_id: generateLeadId(), // ✅ generate ID for new calculator leads
            phone_number: cleanPhone,
            full_name,
            calculator_report_token,
            lead_source,
            submission_time: new Date().toISOString(),
            ...rest,
          },
        });
        return newLead;
      }
    } catch (err) {
      console.error("❌ Lead create/update error:", err);
      ctx.throw(500, "Failed to create or update lead");
    }
  },
}));
