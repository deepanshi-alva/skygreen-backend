'use strict';

/**
 * otp-verification service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::otp-verification.otp-verification');
