import type { Schema, Attribute } from '@strapi/strapi';

export interface DisclaimerImportantNotes extends Schema.Component {
  collectionName: 'components_disclaimer_important_notes';
  info: {
    displayName: 'Important Notes';
    description: '';
  };
  attributes: {
    notes: Attribute.Text;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'disclaimer.important-notes': DisclaimerImportantNotes;
    }
  }
}
