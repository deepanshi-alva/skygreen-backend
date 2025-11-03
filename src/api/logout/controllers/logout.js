"use strict";
const dayjs = require("dayjs");
const jwt = require("jsonwebtoken");

module.exports = {
  async handleLogout(ctx) {
    try {
      console.log("entered into the logout thing");

      // ✅ Extract token from Authorization header
      const authHeader =
        ctx.request.header.authorization || ctx.request.header.Authorization;

      if (!authHeader) {
        console.log("❌ Missing Authorization header");
        return ctx.badRequest("Missing Authorization header");
      }

      const token = authHeader.replace("Bearer ", "").trim();

      // ✅ Decode the token using Strapi's JWT secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const payload = typeof decoded === "string" ? JSON.parse(decoded) : decoded;
      const userId = payload.id || payload.user?.id;


      if (!userId) {
        console.log("❌ Invalid token — userId not found");
        return ctx.badRequest("Invalid token: userId missing");
      }

      console.log("✅ Decoded userId from token:", userId);

      // ✅ Mark user offline
      await strapi.db.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: {
          is_online: false,
          last_logout: dayjs().toISOString(),
        },
      });

      // ✅ Mark their active record as closed
      // await strapi.db.query("api::user-activity.user-activity").updateMany({
      //   where: {
      //     user: {
      //       id: userId, // ✅ Proper relational filter
      //     },
      //     is_active: true,
      //   },
      //   data: {
      //     is_active: false,
      //     logout_time: dayjs().toISOString(),
      //   },
      // });

      // ✅ Get all active records for this user
      const activeRecords = await strapi.db.query("api::user-activity.user-activity").findMany({
        where: {
          user: userId, // Works because we just read, not update
          is_active: true,
        },
        select: ["id"],
      });

      for (const record of activeRecords) {
        await strapi.db.query("api::user-activity.user-activity").update({
          where: { id: record.id },
          data: {
            is_active: false,
            logout_time: dayjs().toISOString(),
          },
        });
      }

      console.log(`✅ Logout recorded successfully for user ${userId}`);
      ctx.send({ ok: true, message: "Logout recorded successfully" });
    } catch (err) {
      console.error("Logout error:", err);
      ctx.internalServerError("Error during logout");
    }
  },
};
