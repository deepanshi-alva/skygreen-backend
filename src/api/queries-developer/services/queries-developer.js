'use strict';

/**
 * queries-developer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::queries-developer.queries-developer');
