"use strict";
const dayjs = require("dayjs");

module.exports = {
  async handleLogout(ctx) {
    try {
      console.log("entered into the logout thing");
      const { userId } = ctx.request.body;
      if (!userId) return ctx.badRequest("Missing userId");
      console.log("entered into the logout thing");
      // Update user status
      await strapi.db.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: {
          is_online: false,
          last_logout: dayjs().toISOString(),
        },
      });

      // Update open activity record
      await strapi.db.query("api::user-activity.user-activity").updateMany({
        where: { user: userId, is_active: true },
        data: {
          is_active: false,
          logout_time: dayjs().toISOString(),
        },
      });

      ctx.send({ ok: true, message: "Logout recorded successfully" });
    } catch (err) {
      strapi.log.error("Logout error:", err);
      ctx.internalServerError("Error during logout");
    }
  },
};
