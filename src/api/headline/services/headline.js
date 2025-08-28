'use strict';

/**
 * headline service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::headline.headline');
