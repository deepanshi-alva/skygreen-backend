import type { Schema, Attribute } from '@strapi/strapi';

export interface CalculatorSubsidy extends Schema.Component {
  collectionName: 'components_calculator_subsidies';
  info: {
    displayName: 'subsidy';
    description: '';
  };
  attributes: {
    three_kw_rate: Attribute.Integer & Attribute.DefaultTo<18000>;
    max_total_subsidy: Attribute.Integer & Attribute.DefaultTo<78000>;
    one_kw_rate: Attribute.Integer & Attribute.DefaultTo<30000>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'calculator.subsidy': CalculatorSubsidy;
    }
  }
}
