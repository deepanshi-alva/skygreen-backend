"use strict";
const _ = require("lodash");
// const { sendWelcomeEmail } = require("../../../../services/mailer");
const { sanitize } = require("@strapi/utils");
const utils = require("@strapi/utils");
const { ApplicationError, ValidationError } = utils.errors;
const axios = require("axios");
const auth0Domain =
  process.env.AUTH0_DOMAIN || "dev-ntf211cvb6qcng14.us.auth0.com";

module.exports = {
  async validateToken(ctx) {
    try {
      const { token, provider } = ctx.request.body;
      if (!token) {
        return ctx.unauthorized("Token is required");
      }

      let user = null;
      const trainerRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({
          where: { type: "authenticated" },
        });

      if (provider === "auth0") {
        const auth0Url = `https://${auth0Domain}/userinfo`;

        const response = await axios.get(auth0Url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("response", response.data);
        user = response.data;

        let existingUser = await strapi.db
          .query("plugin::users-permissions.user")
          .findOne({
            where: { email: user.email },
            populate: true,
          });

        if (!existingUser) {
          existingUser = await strapi.db
            .query("plugin::users-permissions.user")
            .create({
              data: {
                username: user?.nickname || user?.given_name,
                email: user?.email,
                provider: user?.provider || "auth0",
                password: user?.password || "",
                role: user?.role
                  ? { id: user?.role?.id, name: user?.role?.name }
                  : {
                      id: trainerRole?.id || 2,
                      name: trainerRole?.name || "EMPLOYEE",
                    },
                firstName:
                  user?.given_name || user?.nickname?.split(".")[0] || "Test",
                lastName:
                  user?.family_name || user?.nickname?.split(".")[1] || "",
                isVerified: user?.email_verified || true,
                confirmed: user?.email_verified || true,
              },
            });
          console.log("New user created:", existingUser);
        }
        user = existingUser;
      } else {
        const decoded = await strapi.plugins[
          "users-permissions"
        ].services.jwt.verify(token, process.env.JWT_SECRET);

        user = await strapi.db.query("plugin::users-permissions.user").findOne({
          where: { id: decoded.id },
          populate: true,
        });

        if (!user) {
          return ctx.unauthorized("User not found");
        }
      }

      return ctx.send({
        user: {
          id: user.id || user?.sub,
          username: user.username || user?.given_name,
          email: user.email,
          profileImage: user?.profileImage?.url, // user?.picture
          firstName: user.firstName || user?.given_name,
          lastName: user.lastName || user?.family_name,
          role: user.role
            ? { id: user?.role?.id, name: user?.role?.name }
            : {
                id: trainerRole?.id || 2,
                name: trainerRole?.name || "EMPLOYEE",
              },
        },
      });
    } catch (err) {
      console.error("Token validation failed:", err);
      return ctx.unauthorized("Invalid or expired token");
    }
  },

  async verifyToken(ctx) {
    try {
      const { token } = ctx.request.body;

      if (!token) {
        return ctx.badRequest({ success: false, message: "Token is required" });
      }

      const decoded = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token, process.env.JWT_SECRET);
      const user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: decoded.id }, populate: true });

      if (!user) {
        return ctx.notFound({ success: false, message: "User not found" });
      }

      if (user.isVerified) {
        return ctx.send({ success: true, message: "Already verified" });
      }

      await strapi.db.query("plugin::users-permissions.user").update({
        where: { id: user.id },
        data: { isVerified: true },
      });

    //   setImmediate(() => {
    //     sendWelcomeEmail(user);
    //   });

      return ctx.send({ success: true, message: "Verification successful" });
    } catch (err) {
      strapi.log.error("Error verifying token", err);
      return ctx.unauthorized({
        success: false,
        message: "Invalid or expired token",
      });
    }
  },

  async customResetPassword(ctx) {
    try {
      const { code, password, passwordConfirmation } = ctx.request.body;

      if (!code || !password || !passwordConfirmation) {
        throw new ValidationError("All fields are required");
      }

      if (password !== passwordConfirmation) {
        throw new ValidationError("Passwords do not match");
      }

      const decoded = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(code, process.env.JWT_SECRET);

      if (!decoded || !decoded.id) {
        throw new ApplicationError("Invalid or expired token");
      }

      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        decoded.id
      );

      if (!user) {
        throw new ApplicationError("User not found");
      }

      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        {
          data: {
            password,
          },
        }
      );

      ctx.send({
        success: true,
        message: "Password reset successful",
      });
    } catch (err) {
      console.error("Error resetting password:", err);
      ctx.badRequest(err.message || "Failed to reset password");
    }
  },
};
