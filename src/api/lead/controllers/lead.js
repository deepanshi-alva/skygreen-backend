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
            const { phone_number, full_name, calculator_report_token, lead_source, ...rest } = ctx.request.body.data;

            if (!phone_number) return ctx.badRequest("phone_number is required");

            const cleanPhone = phone_number.replace(/\D/g, "").slice(-10);

            const manualSources = ["ads", "referral", "direct call", "whatsapp", "email"];
            const isManual = manualSources.includes(lead_source);

            if (isManual) {
                console.log("📞 Manual lead entry");
                const newLead = await strapi.db.query("api::lead.lead").create({
                    data: {
                        phone_number: cleanPhone,
                        full_name,
                        lead_source, // ✅ keep source
                        submission_time: new Date().toISOString(),
                        ...rest,
                    },
                });
                return newLead;
            }

            // ✅ Auto/Calculator leads
            const existing = await strapi.db.query("api::lead.lead").findOne({
                where: { phone_number: cleanPhone },
            });

            if (existing) {
                console.log("♻️ Updating existing lead");
                const updated = await strapi.db.query("api::lead.lead").update({
                    where: { id: existing.id },
                    data: {
                        full_name: full_name || existing.full_name,
                        calculator_report_token,
                        lead_source, // ✅ retain source
                        submission_time: new Date().toISOString(),
                        ...rest,
                    },
                });
                return updated;
            } else {
                console.log("🆕 Creating new lead (calculator)");
                const newLead = await strapi.db.query("api::lead.lead").create({
                    data: {
                        phone_number: cleanPhone,
                        full_name,
                        calculator_report_token,
                        lead_source, // ✅ fix: add this field here
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
