// 'use strict';

// /**
//  * join-us controller
//  */

// const { createCoreController } = require('@strapi/strapi').factories;

// module.exports = createCoreController('api::join-us.join-us');


// ./src/api/join-us/controllers/join-us.js
const { createCoreController } = require('@strapi/strapi').factories;
const verifyRecaptcha = require("../../../utils/recaptcha");

module.exports = createCoreController('api::join-us.join-us', ({ strapi }) => ({
  async create(ctx) {
    const { token, data } = ctx.request.body;

    // verify recaptcha
    const isHuman = await verifyRecaptcha(token);
    console.log("is the captcha verified", isHuman);
    if (!isHuman) {
      return ctx.badRequest("reCAPTCHA failed. Try again.");
    }

    // call default core create
    const response = await super.create(ctx); 
    return response;
  },
}));