const subsidyCalc = (finalDcKw, stateData, benchmarkCostPerKw) => {
    console.log("................", finalDcKw, stateData, benchmarkCostPerKw)
    const { one_kw_rate, three_kw_rate, total_subsidy, state_top_up, name } = stateData;
    const subsidyEligibleKw = Math.min(finalDcKw, 3);

    // --- Step 1: Central CFA (same everywhere, slab-based) ---
    let central = 0;
    if (subsidyEligibleKw <= 2) {
        central = subsidyEligibleKw * one_kw_rate;
    } else if (subsidyEligibleKw > 2 && subsidyEligibleKw <= 3) {
        central = (2 * one_kw_rate) + ((subsidyEligibleKw - 2) * three_kw_rate);
    } else {
        central = (2 * one_kw_rate) + (1 * three_kw_rate);
    }
    central = Math.min(central, total_subsidy);

    // --- Step 2: State top-up ---
    let state = 0;

    // Special handling: Nagaland (percent-based scheme)
    if (name.toLowerCase() === "nagaland") {
        if (subsidyEligibleKw >= 1) {
            // First 2 kW → 96% of benchmark
            const upto2 = Math.min(subsidyEligibleKw, 2);
            state += upto2 * (benchmarkCostPerKw * 0.96);
        }
        if (subsidyEligibleKw > 2) {
            // Next 1 kW (2–3) → 85% of benchmark
            const upto3 = subsidyEligibleKw - 2;
            state += upto3 * (benchmarkCostPerKw * 0.85);
        }
        // Deduct central because above calc gave "effective subsidy"
        state = state - central;
    }
    else if (name.toLowerCase() === "ladakh") {
        // Ladakh = slab-based fixed top-up
        if (finalDcKw <= 1) state = 20000;
        else if (finalDcKw <= 2) state = 40000;
        else state = 50000; // for 3 kW and above
    }
    else if (name.toLowerCase() === "uttarakhand") {
        // Central CFA same as other special states (already done above)

        // State = 30% of benchmark × eligible kW
        state = subsidyEligibleKw * benchmarkCostPerKw * 0.30;
    }
    else if (name.toLowerCase() === "puducherry") {
        // Central CFA same as other special states (already done above)

        // State = 30% of benchmark × eligible kW
        state = subsidyEligibleKw * benchmarkCostPerKw * 0.30;
    }
    else if (name.toLowerCase() === "haryana") {
        // Haryana = % of benchmark (40% up to 3 kW, then 20%)
        if (finalDcKw <= 3) {
            central = finalDcKw * benchmarkCostPerKw * 0.40;
        } else if (finalDcKw > 3 && finalDcKw <= 10) {
            central = (3 * benchmarkCostPerKw * 0.40) +
                ((finalDcKw - 3) * benchmarkCostPerKw * 0.20);
        } else {
            // GHS / RWA common facilities
            central = finalDcKw * benchmarkCostPerKw * 0.20;
        }
        state = 0; // Haryana has no extra state subsidy
    }
    else if (name.toLowerCase() === "gujarat") {
        // Gujarat SURYA scheme (replaces central CFA completely)
        central = 0; // no central CFA allowed

        // Residential-only calculation
        if (finalDcKw <= 3) {
            state = finalDcKw * benchmarkCostPerKw * 0.40;
        } else if (finalDcKw > 3 && finalDcKw <= 10) {
            state = (3 * benchmarkCostPerKw * 0.40) +
                ((finalDcKw - 3) * benchmarkCostPerKw * 0.20);
        } else {
            state = 0; // no subsidy beyond 10 kW
        }
    }
    else if (name.toLowerCase() === "uttar pradesh") {
        // --- Central CFA (slab, capped at 78k) ---
        if (finalDcKw <= 2) {
            central = finalDcKw * 30000;
        } else if (finalDcKw > 2 && finalDcKw <= 3) {
            central = (2 * 30000) + ((finalDcKw - 2) * 18000);
        } else {
            central = 78000; // max cap
        }

        // --- State top-up (₹15k/kW up to 2 kW, max 30k) ---
        const eligibleStateKw = Math.min(finalDcKw, 2);
        state = Math.min(eligibleStateKw * 15000, 30000);
    }
    else {
        // Default logic → per kW top-up
        if (state_top_up && state_top_up > 0) {
            state = subsidyEligibleKw * state_top_up;
        }
    }

    // --- Step 3: Total ---
    const total = central + state;

    return { central, state, total };
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
            } = ctx.request.body;

            // Fetch calculator settings (includes subsidy values)
            const settingsArr = await strapi.entityService.findMany(
                "api::calculator-setting.calculator-setting",
            );
            const settings = settingsArr;
            console.log("this is the settings data", settingsArr);

            // Fetch state-specific subsidy data
            const stateDataArr = await strapi.entityService.findMany(
                "api::state.state",
                {
                    filters: { name: state_name },
                }
            );
            if (!stateDataArr || stateDataArr.length === 0) {
                return ctx.badRequest(`State ${state_name} not found`);
            }
            const stateData = stateDataArr[0];
            console.log("this is the state data", stateData);

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
            const { central: centralSubsidyInr, state: stateSubsidyInr, total: totalSubsidyInr } = subsidyCalc(subsidyEligibleKw, stateData, settings.cost_inr_per_kw);
            console.log("this is the central subsidy", centralSubsidyInr);
            console.log("this is the stateSubsidyInr", stateSubsidyInr);
            console.log("this is the totalSubsidyInr", totalSubsidyInr);

            // Step 7: Costs
            const grossCostInr = finalDcKw * settings.cost_inr_per_kw;
            const netCostInr = Math.max(grossCostInr - totalSubsidyInr, 0);

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
                state_subsidy: stateSubsidyInr,
                total_subsidy: totalSubsidyInr,
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
