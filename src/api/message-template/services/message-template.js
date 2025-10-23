'use strict';

/**
 * message-template service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::message-template.message-template');
