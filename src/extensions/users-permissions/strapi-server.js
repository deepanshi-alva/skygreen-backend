"use strict";
const dayjs = require("dayjs");

module.exports = (plugin) => {
  const originalLogin = plugin.controllers.auth.callback;

  // ✅ Override default login controller
  plugin.controllers.auth.callback = async (ctx) => {
    // Call original Strapi login
    await originalLogin(ctx);

    try {
      console.log(
        "entered into the user era where the user login things will be stored here"
      );

      // In newer Strapi, login response is stored in ctx.body
      const user = ctx.body?.user || ctx.response?.body?.user;

      if (!user) {
        strapi.log.warn(
          "⚠️ No user found in login response — skipping attendance update."
        );
        return;
      }

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

    // Important: always return what the original login wrote
    return ctx.body;
  };

  return plugin;
};
