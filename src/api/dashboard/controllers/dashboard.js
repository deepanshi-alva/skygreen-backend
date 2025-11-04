"use strict";
const dayjs = require("dayjs");

module.exports = {
    async getUserInsights(ctx) {
        try {
            const today = dayjs().format("YYYY-MM-DD");
            const weekStart = dayjs().startOf("week").format("YYYY-MM-DD");
            const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");

            // ---------------------------
            // 1️⃣ Total users
            const totalUsers = await strapi.db.query("plugin::users-permissions.user").count();

            // ---------------------------
            // 2️⃣ Currently online users
            const onlineUsers = await strapi.db
                .query("plugin::users-permissions.user")
                .count({
                    where: { is_online: true },
                });

            // ---------------------------
            // 4️⃣ Inactive users (not logged in for > 7 days)
            const inactiveUsers = await strapi.db
                .query("plugin::users-permissions.user")
                .count({
                    where: {
                        last_login: { $lt: dayjs().subtract(7, "day").toISOString() },
                    },
                });

            const offlineUsers = await strapi.db
                .query("plugin::users-permissions.user")
                .count({
                    where: { is_online: false },
                });

            // ---------------------------
            // 💼 LEAD STATS
            const totalLeads = await strapi.db.query("api::lead.lead").count();

            const untouchedLeads = await strapi.db
                .query("api::lead.lead")
                .count({
                    where: { stage_at_which_case_is: "untouched" },
                });

            const activeLeads = await strapi.db
                .query("api::lead.lead")
                .count({
                    where: { stage_at_which_case_is: "active" },
                });

            const pendingLeads = await strapi.db
                .query("api::lead.lead")
                .count({
                    where: { stage_at_which_case_is: "pending" },
                });

            const resolvedLeads = await strapi.db
                .query("api::lead.lead")
                .count({
                    where: { stage_at_which_case_is: "resolved" },
                });

            const followupScheduled = await strapi.db
                .query("api::lead.lead")
                .count({
                    where: { stage_at_which_case_is: "followup scheduled" },
                });

            console.log("this is the summary", totalLeads)

            // ---------------------------
            // 🧩 Final structured response
            ctx.send({
                summary: {
                    totalUsers,
                    onlineUsers,
                    // loggedInToday,
                    inactiveUsers,
                    offlineUsers,
                    totalLeads,
                    untouchedLeads,
                    activeLeads,
                    pendingLeads,
                    resolvedLeads,
                    followupScheduled,
                },
            });
        } catch (err) {
            console.error("User Insights Error:", err);
            ctx.internalServerError("Error generating user insights");
        }
    },
};
