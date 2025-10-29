'use strict';

/**
 * user-activity service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-activity.user-activity');
