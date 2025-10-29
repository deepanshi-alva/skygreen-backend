"use strict";
const dayjs = require("dayjs");

module.exports = (plugin) => {
  const originalLogin = plugin.controllers.auth.callback;

  // 🔥 Override default login callback
  plugin.controllers.auth.callback = async (ctx) => {
    const response = await originalLogin(ctx);
    try {
      const { user } = response;
      if (!user) return response;

      console.log("entered into the user era where the user login things will be stored here ");

      // ✅ Mark user online
      await strapi.db.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: {
          is_online: true,
          last_login: dayjs().toISOString(),
        },
      });

      // ✅ Create daily user activity record
      await strapi.db.query("api::user-activity.user-activity").create({
        data: {
          user: user.id,
          login_time: dayjs().toISOString(),
          is_active: true,
          date: dayjs().format("YYYY-MM-DD"),
        },
      });

      strapi.log.info(`✅ User logged in: ${user.email}`);
    } catch (err) {
      strapi.log.error("Login hook error:", err);
    }

    return response;
  };

  return plugin;
};
