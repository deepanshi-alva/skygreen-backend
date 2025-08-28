const subsidyCalc = (finalDcKw, settings) => {
    console.log("................", finalDcKw, settings.subsidy)
    let subsidy = 0;
    const { three_kw_rate, one_kw_rate, max_total_subsidy } = settings.subsidy;

    if (finalDcKw <= 2) {
        subsidy = finalDcKw * one_kw_rate;
    } else if (finalDcKw > 2 && finalDcKw <= 3) {
        subsidy = (2 * one_kw_rate) + ((finalDcKw - 2) * three_kw_rate);
    } else {
        subsidy = (2 * one_kw_rate) + (1 * three_kw_rate);
    }

    console.log("this is the calculation", subsidy);
    return Math.min(subsidy, max_total_subsidy);
};

module.exports = {
    async estimate(ctx) {
        try {
            const {
                state_name,
                sizing_method,
                monthly_bill_inr,
                tariff_inr_per_kwh = 8,
                monthly_units_kwh,
                roof_area_value,
                roof_area_unit = "sqft",
                sanctioned_load_kw = 1,
            } = ctx.request.body;

            // Fetch calculator settings (includes subsidy values)
            const settingsArr = await strapi.entityService.findMany(
                "api::calculator-setting.calculator-setting",
                { populate: { subsidy: true } }   // 👈 force load nested component
            );
            const settings = settingsArr;
            console.log("this is the settings data", settingsArr);

            // Convert roof area to sqft
            let roofSqft = roof_area_value;
            if (roof_area_unit === "sqm") roofSqft = roofSqft * 10.764;
            if (roof_area_unit === "sqyd") roofSqft = roofSqft * 9;
            if (roof_area_unit === "ground") roofSqft = roofSqft * 2400;
            if (roof_area_unit === "cent") roofSqft = roofSqft * 435.6;

            // Step 1: Recommended KW (only from bill or units)
            let monthlyUnits = 0;
            if (sizing_method === "bill") {
                monthlyUnits = monthly_bill_inr / tariff_inr_per_kwh;
            } else if (sizing_method === "units") {
                monthlyUnits = monthly_units_kwh;
            } else {
                return ctx.badRequest("Invalid sizing method. Use 'bill' or 'units'.");
            }

            // Step 2: Recommended kw
            console.log("this is the monthlyunit", monthlyUnits)
            const recommendedKw = monthlyUnits / (settings.solar_hours_per_day * 30);
            console.log("this is the recommended kw", recommendedKw);

            // Step 3: Panel Count
            const panelCount = Math.ceil(recommendedKw * 1000 / settings.panel_watt_w);
            console.log("this is the panelCount", panelCount);

            // Step 4: Final DC KW SDC
            const finalDcKw = panelCount * (settings.panel_watt_w / 1000);
            console.log("this is the sdc", finalDcKw);

            // Step 5: Subsidy Eligible KW
            const subsidyEligibleKw = Math.min(finalDcKw, 3);
            console.log("this is the subsidyEligibleKw", subsidyEligibleKw);

            // Step 6: Subsidy INR
            const centralSubsidyInr = subsidyCalc(subsidyEligibleKw, settings);
            console.log("this is the central subsidy", centralSubsidyInr);

            // Step 7: Costs
            const grossCostInr = finalDcKw * settings.cost_inr_per_kw;
            const netCostInr = Math.max(grossCostInr - centralSubsidyInr, 0);

            // Step 8: Generation
            const dailyGen = settings.topcon_575_daily_generation * panelCount;
            const monthlyGen = dailyGen * 30;
            const annualGen = monthlyGen * 12;
            const lifetimeGen = annualGen * (settings.lifetime_years - (settings.degradation_pct_per_year / 100 * settings.lifetime_years));

            // Step 9: Savings
            const monthlySaving = monthlyGen * tariff_inr_per_kwh;
            const annualSaving = monthlySaving * 12;

            // Step 10: Payback
            let paybackYears = netCostInr > 0 ? (netCostInr / annualSaving) : 0;

            // Step 11: Roof Feasibility
            let roofNeededSqft;
            let roofOk = null;

            if (roof_area_value && roof_area_value > 0) {
                // User provided area → check eligibility
                roofNeededSqft = panelCount * settings.panel_area_sqft;
                roofOk = roofSqft >= roofNeededSqft;
            } else {
                // No area given → only recommend required area
                roofNeededSqft = panelCount * 60;
                roofOk = null; // means "not checked"
            }

            const dailyUnit = monthlyUnits / 30;
            const lifetime_saving = annualSaving * 30;

            ctx.send({
                state: state_name,
                recommended_kw: recommendedKw,
                final_dc_kw: finalDcKw,
                panel_count: panelCount,
                subsidy_eligible_kw: subsidyEligibleKw,
                monthly_unit: monthlyUnits,
                daily_unit: dailyUnit,
                central_subsidy_inr: centralSubsidyInr,
                gross_cost_inr: grossCostInr,
                net_cost_inr: netCostInr,
                daily_gen_kwh: dailyGen,
                monthly_gen_kwh: monthlyGen,
                annual_gen_y1_kwh: annualGen,
                lifetime_gen_kwh: lifetimeGen,
                monthly_saving_inr: monthlySaving,
                annual_saving_inr: annualSaving,
                lifetime_saving_inr: lifetime_saving,
                payback_years: paybackYears,
                roof_needed_sqft: roofNeededSqft,
                roof_area_available: roofSqft,
                roof_fits: roofOk
            });
        } catch (err) {
            ctx.throw(500, err);
        }
    }
};
