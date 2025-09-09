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
    else if (name.toLowerCase() === "uttarakhand" || name.toLowerCase() === "puducherry") {
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
            central = finalDcKw * benchmarkCostPerKw * 0.20;
        }
        state = 0; // Haryana has no extra state subsidy
    }
    else if (name.toLowerCase() === "gujarat") {
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
        // --- State top-up (₹15k/kW up to 2 kW, max 30k) ---
        const eligibleStateKw = Math.min(finalDcKw, 2);
        state = Math.min(eligibleStateKw * 15000, 30000);
    }
    else if (name.toLowerCase() === "lakshadweep") {
        // Lakshadweep = 10% of system cost (1–3 kW), capped 60k
        const topUpPerKw = benchmarkCostPerKw * 0.10;
        state = subsidyEligibleKw * topUpPerKw;
        state = Math.min(state, 60000); // cap safeguard
    }
    else if (name.toLowerCase() === "madhya pradesh") {
        // --- State subsidy percentage-based ---
        const grossCost = finalDcKw * benchmarkCostPerKw;

        if (finalDcKw <= 3) {
            state = grossCost * 0.40; // 40% of system cost
            // cap at 46,920 for 3 kW
            if (finalDcKw === 3) state = Math.min(state, 46920);
        } else if (finalDcKw > 3 && finalDcKw <= 10) {
            const first3 = 3 * benchmarkCostPerKw * 0.40;
            const rest = (finalDcKw - 3) * benchmarkCostPerKw * 0.20;
            state = first3 + rest;

            // cap at ~96,000 for 10 kW
            if (finalDcKw === 10) state = Math.min(state, 96044);
        }
    }
    else if (["dadra & nagar haveli & daman & diu", "dnhdd"].includes(name.toLowerCase())) {
        // UT top-up subsidy, capped at 10 kW
        const subsidyKw = Math.min(finalDcKw, 10);
        state = subsidyKw * (state_top_up || 0);
    }
    else if (name.toLowerCase().includes("andaman") || name.toLowerCase().includes("nicobar")) {
        // --- Step 1: Central CFA (extended up to 10 kW) ---
        const subsidyKw = Math.min(finalDcKw, 10);
        if (subsidyKw === 1) state = 45000;
        else if (subsidyKw === 2) state = 90000;
        else if (subsidyKw >= 3) state = 117000; // applies up to 10 kW
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

// --------------------
// RWA / GHS Subsidy calculator
// --------------------
const rwaSubsidyCalc = (finalDcKw, stateData, benchmarkCostPerKw, numHouses, recommendedKw) => {
    const {
        rwa_enabled,
        rwa_central_rate,
        rwa_per_house_cap_kw,
        rwa_total_cap_kw,
        rwa_mode,
        rwa_state_top_up
    } = stateData;

    if (!rwa_enabled || rwa_mode === "none") {
        return { central: 0, state: 0, total: 0, eligibleKw: 0 };
    }

    // Eligible capacity
    const eligibleKw = Math.min(finalDcKw, recommendedKw, numHouses * rwa_per_house_cap_kw, rwa_total_cap_kw);
    console.log("this is the subsidy eligible for", eligibleKw, recommendedKw, finalDcKw, numHouses * rwa_per_house_cap_kw, rwa_total_cap_kw)

    let central = 0, state = 0;

    if (rwa_mode !== "state_only") {
        central = eligibleKw * rwa_central_rate;
    }

    switch (rwa_mode) {
        case "cfa_only":
            state = 0;
            break;
        case "flat_per_kw":
            state = eligibleKw * (rwa_state_top_up || 0);
            break;
        case "percent_of_cost":
            state = eligibleKw * benchmarkCostPerKw * ((rwa_state_top_up || 20) / 100);
            break;
        case "fixed_per_house":
            state = numHouses * (rwa_state_top_up || 0);
            break;
        case "state_only":
            central = 0;
            state = eligibleKw * benchmarkCostPerKw * ((rwa_state_top_up || 20) / 100);
            break;
    }

    return { central, state, total: central + state, eligibleKw };
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
                is_rwa = false,
                num_houses = 1,
                proposed_capacity_kw = 0,
                society_sanctioned_load_kw = 0,
                per_house_sanctioned_load_kw = 0
            } = ctx.request.body;

            // Fetch calculator settings (includes subsidy values)
            const settingsArr = await strapi.entityService.findMany(
                "api::calculator-setting.calculator-setting",
            );
            const settings = settingsArr;
            // console.log("this is the settings data", settingsArr);

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
            // console.log("this is the state data", stateData);

            let rwa_per_house_cap_kw = stateData.rwa_per_house_cap_kw;
            console.log("this is the rwa per house cap kw", rwa_per_house_cap_kw)

            // Convert roof area to sqft
            let roofSqft = roof_area_value;
            if (roof_area_unit === "sqm") roofSqft = roofSqft * 10.764;
            if (roof_area_unit === "sqyd") roofSqft = roofSqft * 9;
            if (roof_area_unit === "ground") roofSqft = roofSqft * 2400;
            if (roof_area_unit === "cent") roofSqft = roofSqft * 435.6;

            let recommendedKw = 0;
            let finalDcKw = 0;
            let panelCount = 0;
            let monthlyUnits = 0;
            let sanctionedLoadMustBe = 0;
            let dailyUnit = 0;
            let monthlySpendInr = 0;

            // ----------------------
            // Residential Path
            // ----------------------
            if (!is_rwa) {
                if (sizing_method === "bill") {
                    monthlyUnits = monthly_bill_inr / tariff_inr_per_kwh;
                    monthlySpendInr = monthly_bill_inr;
                } else if (sizing_method === "units") {
                    monthlyUnits = monthly_units_kwh;
                    monthlySpendInr = monthly_units_kwh * tariff_inr_per_kwh;
                } else {
                    return ctx.badRequest("Invalid sizing_method for residential. Use 'bill' or 'units'.");
                }

                recommendedKw = monthlyUnits / (settings.solar_hours_per_day * 30);
                panelCount = Math.ceil((recommendedKw * 1000) / settings.panel_watt_w);
                finalDcKw = panelCount * (settings.panel_watt_w / 1000);
                sanctionedLoadMustBe = Math.ceil(finalDcKw);
                dailyUnit = monthlyUnits / 30;

                // ----------------------
                // RWA / GHS Path
                // ----------------------
            } else {
                const candidateCaps = [];

                if (proposed_capacity_kw > 0) {
                    // 👉 If user gave a proposed capacity, always respect that
                    recommendedKw = proposed_capacity_kw;
                } else {
                    if (society_sanctioned_load_kw > 0) candidateCaps.push(society_sanctioned_load_kw);
                    if (per_house_sanctioned_load_kw > 0) candidateCaps.push(per_house_sanctioned_load_kw * num_houses);

                    if (candidateCaps.length > 0) {
                        // 👉 If no proposed, fallback to the larger of society vs per-house
                        recommendedKw = Math.max(...candidateCaps);
                    } else {
                        return ctx.badRequest("No valid RWA sizing inputs provided");
                    }
                }

                panelCount = Math.ceil((recommendedKw * 1000) / settings.panel_watt_w);
                finalDcKw = panelCount * (settings.panel_watt_w / 1000);
                sanctionedLoadMustBe = Math.ceil(recommendedKw);
            }


            let totalSpend = monthlySpendInr * 12 * 30;

            // Step 5: Subsidy Eligible KW
            const subsidyResult = is_rwa
                ? rwaSubsidyCalc(finalDcKw, stateData, settings.rwa_cost_inr_per_kw, num_houses, recommendedKw)
                : subsidyCalc(finalDcKw, stateData, settings.cost_inr_per_kw);

            const { central: centralSubsidyInr, state: stateSubsidyInr, total: totalSubsidyInr, eligibleKw } = subsidyResult;

            // Step 7: Costs
            const systemCostPerKw = is_rwa ? settings.rwa_cost_inr_per_kw : settings.cost_inr_per_kw;
            const grossCostInr = recommendedKw * systemCostPerKw;
            const netCostInr = Math.max(grossCostInr - totalSubsidyInr, 0);

            // Step 8: Generation
            console.log("this is the recommended system", recommendedKw)
            const dailyGen = settings.topcon_575_daily_generation * panelCount;
            const monthlyGen = dailyGen * 30;
            const annualGen = monthlyGen * 12;
            const lifetimeGen = annualGen * (settings.lifetime_years - (settings.degradation_pct_per_year / 100 * settings.lifetime_years));

            // Step 9: Savings
            const monthlySaving = monthlyGen * tariff_inr_per_kwh;
            const annualSaving = monthlySaving * 12;
            const lifetime_saving = annualSaving * 30;

            // Discom charge
            const discomCharge = 200;
            const annualDiscom = discomCharge * 12;
            const totalDiscom = annualDiscom * 30;
            console.log("this is the total discom", totalDiscom)

            // Net savings per year after discom
            const annualSavingNet = annualSaving;

            // Step 10: Payback
            let paybackYears = netCostInr > 0 ? (netCostInr / annualSaving) : 0;

            // Only count years after payback
            const yearsAfterPayback = Math.max(settings.lifetime_years - Math.ceil(paybackYears), 0);

            // Net gain after payback = savings in remaining years
            const netGainAfterPayback = (annualSavingNet * yearsAfterPayback) - (totalDiscom);

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
                roofOk = null;
            }

            // Disclaimer (residential vs RWA)
            const disclaimer = is_rwa
                ? stateData.rwa_disclaimer
                : stateData.disclaimers;


            ctx.send({
                state: state_name,
                is_rwa,
                num_houses,
                recommended_kw: recommendedKw,
                final_dc_kw: finalDcKw,
                sanctioned_load_must_be: sanctionedLoadMustBe,
                panel_count: panelCount,
                subsidy_eligible_kw: eligibleKw,
                monthly_unit: monthlyUnits,
                monthly_spend: monthlySpendInr,
                total_spend: totalSpend,
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
                annual_saving_net: annualSavingNet,
                years_after_payback: yearsAfterPayback,
                net_gain_after_payback: netGainAfterPayback,
                payback_years: paybackYears,
                roof_needed_sqft: roofNeededSqft,
                roof_area_available: roofSqft,
                roof_fits: roofOk,
                rwa_per_house_cap_kw: rwa_per_house_cap_kw,
                disclaimer
            });
        } catch (err) {
            ctx.throw(500, err);
        }
    }
};
