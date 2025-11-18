const state = require("../../state/controllers/state");

/* ----------------- Helper: Suggest SKU Options ----------------- */
function suggestSkuOptions(finalDcKw) {
  const availableInverters = [
    1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 15, 20, 25, 33, 40, 50, 75, 100,
  ];

  // Step 1: get all valid inverter options
  const valid = availableInverters
    .map((inv) => {
      const ratio = finalDcKw / inv;
      if (ratio >= 0.8 && ratio <= 1.2) {
        return {
          system_kw: finalDcKw,
          inverter_kw: inv,
          dc_ac_ratio: Number(ratio.toFixed(2)),
          bus_voltage: inv <= 2 ? 24 : inv <= 7.5 ? 48 : 96,
          phase: inv > 5 ? "Three-phase" : "Single-phase",
          note:
            ratio === 1
              ? "Perfect match"
              : ratio > 1
                ? "Over-paneling (clipping possible)"
                : "Under-paneling (future expansion room)",
        };
      }
      return null;
    })
    .filter(Boolean);

  if (valid.length === 0) return { nearestSku: null, widerSku: null };

  // Step 2: nearest = closest to ratio = 1
  let nearestSku = valid.reduce((prev, curr) => {
    const prevDiff = Math.abs(1 - prev.dc_ac_ratio);
    const currDiff = Math.abs(1 - curr.dc_ac_ratio);
    return currDiff < prevDiff ? curr : prev;
  });

  // Step 3: wider = the next higher inverter in valid list
  let widerSku = valid.find((opt) => opt.inverter_kw > nearestSku.inverter_kw);

  return { nearestSku, widerSku, allValid: valid };
}

/* ----------------- Inverter Options ----------------- */
function getInverterOptions(finalDcKw) {
  const availableInverters = [
    1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 15, 20, 25, 33, 40, 50, 75, 100,
  ];
  let options = [];

  availableInverters.forEach((inv) => {
    const ratio = finalDcKw / inv;
    if (ratio >= 0.8 && ratio <= 1.2) {
      options.push({
        inverter_size_kw: inv,
        dc_ac_ratio: ratio.toFixed(2),
        bus_voltage: inv <= 2 ? 24 : inv <= 7.5 ? 48 : 96,
        phase: inv > 5 ? "Three-phase" : "Single-phase",
        note:
          ratio === 1
            ? "Perfect match, zero clipping"
            : ratio > 1
              ? "Over-paneling (clipping possible)"
              : "Under-paneling (future expansion room)",
      });
    }
  });

  return options;
}

/* ----------------- String Design ----------------- */
function getStringDesign(panelCount) {
  const vocCold = 56.8; // Voc per panel
  const vmp = 43.82; // Vmp per panel
  const isc = 13.79; // Isc per panel

  // const maxInverterVoc = 1000;
  // const mpptWindow = [200, 800];
  const mpptCurrentLimit = 30;

  if (!panelCount || panelCount <= 0) {
    return { single_mppt: [], dual_mppt: [] };
  }

  // ---- Single MPPT ----
  let singleMppt;
  if (panelCount > 16) {
    singleMppt = {
      mppt_mode: "single",
      message: "❌ Not feasible. Use dual MPPT or increase inverter size.",
    };
  } else {
    const vocTotal = panelCount * vocCold;
    const vmpTotal = panelCount * vmp;
    const iscTotal = isc;
    const maxParallel = Math.floor(mpptCurrentLimit / iscTotal);

    singleMppt = {
      mppt_mode: "single",
      panels_per_string: panelCount,
      strings_used: 1,
      panels_connected: panelCount,
      voc_total: vocTotal.toFixed(1),
      vmp_total: vmpTotal.toFixed(1),
      isc_total: iscTotal.toFixed(1),
      max_parallel_strings: maxParallel,
    };
  }

  // ---- Dual MPPT ---- (best-fit split)
  const half = Math.floor(panelCount / 2);
  const mppt1Panels = half;
  const mppt2Panels = panelCount - half;

  const dualMppt = [
    {
      mppt: 1,
      panels_per_string: mppt1Panels,
      voc_total: (mppt1Panels * vocCold).toFixed(1),
      vmp_total: (mppt1Panels * vmp).toFixed(1),
      isc_total: isc.toFixed(1),
    },
    {
      mppt: 2,
      panels_per_string: mppt2Panels,
      voc_total: (mppt2Panels * vocCold).toFixed(1),
      vmp_total: (mppt2Panels * vmp).toFixed(1),
      isc_total: isc.toFixed(1),
    },
  ];

  return { single_mppt: singleMppt, dual_mppt: dualMppt };
}

/* ----------------- Battery Options (SKYGREEN Style Output) ----------------- */

function getBatteryOptions(finalDcKw, settings, inverterKw, psh) {
  // const psh = settings.solar_hours_per_day || 5.5;
  console.log("this is the finaldcw", finalDcKw);

  // Daily solar kWh generation (PR 0.8 + bifacial 1.05)
  const eSolar = finalDcKw * psh * 0.8 * 1.05;
  console.log("this is the esolar", eSolar, ",", finalDcKw, psh);

  // Energy available for charging after inverter/charging losses
  const eCharge = eSolar * 0.9;

  // Bus voltage based on inverter size
  let busV = 48;
  if (inverterKw <= 2) busV = 24;
  else if (inverterKw > 7.5) busV = 96;

  // ✅ Direct max battery size in Ah
  const maxBatteryAh = (eCharge * 1000) / busV;

  let output = [];

  // ---------- Helper Calculations ----------
  function backupHours(usableKwh) {
    return {
      essentials: (usableKwh / 0.4).toFixed(1),
      one_ac: (usableKwh / 1.5).toFixed(1),
      two_acs: (usableKwh / 2.7).toFixed(1),
    };
  }

  // function chargeTime(nominalKwh) {
  //   console.log("this is the nominalkwh", nominalKwh);

  //   console.log("this is the calculation for the chargetime", (nominalKwh / eCharge * psh).toFixed(1), ",", eCharge, ",", psh);
  //   return (nominalKwh / eCharge * psh).toFixed(1); // hrs needed from daily solar
  // }

  function chargeTime(nominalKwh, eff = 0.9) {
    const effectiveCharge = eCharge * eff; // adjust for chemistry
    return ((nominalKwh / effectiveCharge) * psh).toFixed(1);
  }

  function maxBatteriesPerDay(nominalKwh) {
    return Math.floor(eCharge / nominalKwh);
  }

  // ---------- Lithium Options ----------
  const lithiumOptions = [
    { ah: 100, nominal: (busV * 100) / 1000 }, // kWh = V * Ah / 1000
    { ah: 150, nominal: (busV * 150) / 1000 },
    { ah: 200, nominal: (busV * 200) / 1000 },
  ];

  // First compute max batteries for each lithium option
  let lithiumWithCapacity = lithiumOptions.map((opt) => {
    const maxPerDay = maxBatteriesPerDay(opt.nominal);
    return { ...opt, maxPerDay };
  });

  // Find the max Ah battery that can be charged (>=1 per day)
  let recommendedLithiumAh = null;
  const eligible = lithiumWithCapacity.filter((opt) => opt.maxPerDay >= 1);
  if (eligible.length > 0) {
    recommendedLithiumAh = Math.max(...eligible.map((opt) => opt.ah));
  }

  lithiumWithCapacity.forEach((opt) => {
    const usable = opt.nominal * 0.85; // ~85% usable
    const b = backupHours(usable);
    output.push({
      type: "Lithium",
      ah: opt.ah,
      nominal: opt.nominal.toFixed(1),
      usable: usable.toFixed(1),
      backup: b,
      charge_time: chargeTime(opt.nominal, 0.95),
      connection: `Single ${busV}V lithium pack (plug & play, inbuilt BMS).`,
      tradeoff:
        opt.ah === 100
          ? "Cheapest lithium option, but limited for heavy loads."
          : opt.ah === 150
            ? "Good balance of price vs backup. Suitable for households with occasional AC use."
            : "Higher cost, but gives the longest and most reliable backup.",
      recommended: opt.ah === recommendedLithiumAh, // ✅ Dynamic recommendation
      max_batteries_per_day: opt.maxPerDay,
      max_battery_ah: maxBatteryAh.toFixed(0),
    });
  });

  // Tubular Options (auto adjust for bus voltage)

  const tubularOptions = [
    { ah: 100, nominal: (busV * 100) / 1000 },
    { ah: 150, nominal: (busV * 150) / 1000 },
    { ah: 200, nominal: (busV * 200) / 1000 },
  ];

  tubularOptions.forEach((opt) => {
    const usable = opt.nominal * 0.5; // 50% usable
    const b = backupHours(usable);
    output.push({
      type: "Tubular",
      ah: opt.ah,
      nominal: opt.nominal.toFixed(1),
      usable: usable.toFixed(1),
      backup: b,
      charge_time: chargeTime(opt.nominal, 0.7),
      connection: `${busV / 12}×12V ${opt.ah}Ah in series = ${busV}V system.`,
      tradeoff:
        opt.ah === 150
          ? "Cheap, but short lifespan (3–5 yrs) and weak for heavy loads."
          : "Affordable, but bulky and needs regular maintenance.",
      recommended: false,
      max_batteries_per_day: maxBatteriesPerDay(opt.nominal),
      max_battery_ah: maxBatteryAh.toFixed(0),
    });
  });

  // ---------- Flat Plate Options ----------
  const flatPlateOptions = [
    { ah: 80, nominal: (busV * 80) / 1000 },
    { ah: 100, nominal: (busV * 100) / 1000 },
    { ah: 150, nominal: (busV * 150) / 1000 },
  ];

  flatPlateOptions.forEach((opt) => {
    const usable = opt.nominal * 0.45; // ~45% usable
    const b = backupHours(usable);
    output.push({
      type: "Flat Plate",
      ah: opt.ah,
      nominal: opt.nominal.toFixed(1),
      usable: usable.toFixed(1),
      backup: b,
      charge_time: chargeTime(opt.nominal, 0.65), // less efficient charging
      connection: `${busV / 12}×12V ${opt.ah}Ah in series = ${busV}V system.`,
      tradeoff:
        opt.ah === 100
          ? "Very low cost, but shortest lifespan (2–3 yrs) and not ideal for deep discharge."
          : "Cheapest upfront, but bulky, less efficient, and frequent replacement needed.",
      recommended: false,
      max_batteries_per_day: maxBatteriesPerDay(opt.nominal),
      max_battery_ah: maxBatteryAh.toFixed(0),
    });
  });

  return output;
}

const subsidyCalc = (finalDcKw, stateData, benchmarkCostPerKw) => {
  // console.log("................", finalDcKw, stateData, benchmarkCostPerKw);
  const { one_kw_rate, three_kw_rate, total_subsidy, state_top_up, name } =
    stateData;
  const subsidyEligibleKw = Math.min(finalDcKw, 3);

  // --- Step 1: Central CFA (same everywhere, slab-based) ---
  let central = 0;
  if (subsidyEligibleKw <= 2) {
    central = subsidyEligibleKw * one_kw_rate;
  } else if (subsidyEligibleKw > 2 && subsidyEligibleKw <= 3) {
    central = 2 * one_kw_rate + (subsidyEligibleKw - 2) * three_kw_rate;
  } else {
    central = 2 * one_kw_rate + 1 * three_kw_rate;
  }
  central = Math.min(central, total_subsidy);

  // --- Step 2: State top-up ---
  let state = 0;
  let sgst = 0;

  if (name.toLowerCase() === "manipur") {
    // ✅ Manipur = 70% CFA up to 500 kW
    const cappedKw = Math.min(finalDcKw, 500);
    const totalCost = cappedKw * benchmarkCostPerKw;
    central = totalCost * 0.7; // CFA = 70% of benchmark cost
    state = 0; // no extra state subsidy
  } else if (name.toLowerCase() === "ladakh") {
    // Ladakh = slab-based fixed top-up
    if (finalDcKw <= 1) state = 20000;
    else if (finalDcKw <= 2) state = 40000;
    else state = 50000; // for 3 kW and above
  } else if (name.toLowerCase() === "goa") {
    // ✅ Goa state subsidy logic
    const grossCost = finalDcKw * benchmarkCostPerKw;
    if (finalDcKw <= 10) {
      state = grossCost * 0.5; // 50% subsidy up to 10 kW
    } else if (finalDcKw > 10 && finalDcKw <= 30) {
      state = grossCost * 0.5 + grossCost * 0.1; // 10% subsidy for 10–30 kW
    } else {
      state = 0; // No subsidy above 30 kW
    }
  }
  else if (name.toLowerCase() === "rajasthan") {
    // const eligibleKw = Math.min(finalDcKw, 10);
    const totalSubsidy = 17000;
    // const totalSubsidy = eligibleKw * flatRate;

    state = totalSubsidy;
    sgst = 0;
  }
  if (name.toLowerCase() === "telangana") {
    // Step 2: SGST reimbursement (100% of 2.5%)
    sgst = subsidyEligibleKw * benchmarkCostPerKw * 0.025;

    // State subsidy = 0 (only SGST applied)
    state = 0;
  } else if (name.toLowerCase() === "uttarakhand") {
    // State = 30% of benchmark × eligible kW
    state = subsidyEligibleKw * benchmarkCostPerKw * 0.3;
    // ✅ Step 3: SGST reimbursement (50% of SGST @ 2.5%)
    sgst = subsidyEligibleKw * benchmarkCostPerKw * (0.025 * 0.5);
  } else if (
    name.toLowerCase() === "haryana" ||
    name.toLowerCase() === "chandigarh" ||
    name.toLowerCase() === "andhra pradesh"
  ) {
    // Haryana = % of benchmark (40% up to 3 kW, then 20%)
    if (finalDcKw <= 3) {
      central = finalDcKw * benchmarkCostPerKw * 0.4;
    } else if (finalDcKw > 3 && finalDcKw <= 10) {
      central =
        3 * benchmarkCostPerKw * 0.4 +
        (finalDcKw - 3) * benchmarkCostPerKw * 0.2;
    } else {
      central = finalDcKw * benchmarkCostPerKw * 0.2;
    }
    state = 0; // Haryana has no extra state subsidy
  } else if (name.toLowerCase() === "gujarat") {
    central = 0; // no central CFA allowed

    // Residential-only calculation
    if (finalDcKw <= 3) {
      state = finalDcKw * benchmarkCostPerKw * 0.4;
    } else if (finalDcKw > 3 && finalDcKw <= 10) {
      state =
        3 * benchmarkCostPerKw * 0.4 +
        (finalDcKw - 3) * benchmarkCostPerKw * 0.2;
    } else {
      state = 0; // no subsidy beyond 10 kW
    }
  } else if (name.toLowerCase() === "uttar pradesh") {
    // --- State top-up (₹15k/kW up to 2 kW, max 30k) ---
    const eligibleStateKw = Math.min(finalDcKw, 10);

    if (eligibleStateKw <= 10) {
      state = Math.min(eligibleStateKw * 15000, 30000);
    } else {
      state = 0;
    }
  } else if (name.toLowerCase() === "lakshadweep") {
    // Lakshadweep = 10% of system cost (1–3 kW), capped 60k
    const topUpPerKw = benchmarkCostPerKw * 0.1;
    state = subsidyEligibleKw * topUpPerKw;
    state = Math.min(state, 60000); // cap safeguard
  } else if (
    name.toLowerCase() === "madhya pradesh" ||
    name.toLowerCase() === "maharashtra"
  ) {
    // --- State subsidy percentage-based ---
    const grossCost = finalDcKw * benchmarkCostPerKw;

    if (finalDcKw <= 3) {
      state = grossCost * 0.4; // 40% of system cost
      // cap at 46,920 for 3 kW
      if (finalDcKw === 3) state = Math.min(state, 46920);
    } else if (finalDcKw > 3 && finalDcKw <= 10) {
      const first3 = 3 * benchmarkCostPerKw * 0.4;
      const rest = (finalDcKw - 3) * benchmarkCostPerKw * 0.2;
      state = first3 + rest;

      // cap at ~96,000 for 10 kW
      if (finalDcKw > 10) state = Math.min(state, 96044);
    }
  } else if (
    ["dadra & nagar haveli & daman & diu", "dnhdd"].includes(name.toLowerCase())
  ) {
    // UT top-up subsidy, capped at 10 kW
    const subsidyKw = Math.min(finalDcKw, 10);
    state = subsidyKw * (state_top_up || 0);
  } else if (
    name.toLowerCase().includes("andaman") ||
    name.toLowerCase().includes("nicobar")
  ) {
    // --- Step 1: Central CFA (extended up to 10 kW) ---
    const subsidyKw = Math.min(finalDcKw, 10);
    if (subsidyKw === 1) state = 45000;
    else if (subsidyKw === 2) state = 90000;
    else if (subsidyKw >= 3) state = 117000; // applies up to 10 kW
  } else {
    // Default logic → per kW top-up
    if (state_top_up && state_top_up > 0) {
      state = subsidyEligibleKw * state_top_up;
    }
  }

  // --- Step 3: Total ---
  const total = central + state + sgst;
  return { central, state, sgst, total, eligibleKw: subsidyEligibleKw };
};

/* ----------------- RWA / GHS Subsidy calculator ----------------- */
const rwaSubsidyCalc = (
  finalDcKw,
  stateData,
  benchmarkCostPerKw,
  perHouseSanctionedLoad,
  numHouses
) => {
  const {
    rwa_enabled,
    rwa_central_rate,
    rwa_per_house_cap_kw,
    rwa_total_cap_kw,
    rwa_mode,
    rwa_state_topup,
    name,
  } = stateData;

  if (!rwa_enabled || rwa_mode === "none") {
    return { central: 0, state: 0, sgst: 0, total: 0, eligibleKw: 0 };
  }

  console.log("entered into the rwa subsidy function", rwa_mode);

  // Eligible capacity
  const factors = [finalDcKw, rwa_total_cap_kw].filter((n) => n > 0); // ✅ remove 0 or negatives

  let eligibleKw = factors.length > 0 ? Math.min(...factors) : 0;

  console.log("this is eligible", finalDcKw, rwa_total_cap_kw, eligibleKw);

  let central = 0,
    state = 0,
    sgst = 0;

  if (name?.toLowerCase() === "telangana") {
    // ✅ Telangana RWA Rule

    // Step 1: Central CFA = ₹18,000/kW capped at 500 kW
    central = eligibleKw * 18000;
    central = Math.min(central, 500 * 18000); // max cap

    sgst = eligibleKw * benchmarkCostPerKw * (0.025 * 0.5); // 50% refund

    // No extra state subsidy
    state = 0;

    const total = central + sgst;
    return { central, state, sgst, total, eligibleKw };
  }

  /* ✅ Special handling: Himachal Pradesh */
  if (name?.toLowerCase().includes("himachal")) {
    // MNRE CFA → 20% of benchmark cost
    central = eligibleKw * benchmarkCostPerKw * 0.2;

    // HIMURJA state subsidy → ₹6000/kW
    state = eligibleKw * 6000;

    return { central, state, total: central + state, eligibleKw };
  }

  // ✅ Apply Goa-specific logic
  if (name?.toLowerCase() === "goa") {
    // Limit eligibility: min(finalDcKw, 500 kW)
    const eligibleKw = Math.min(finalDcKw, 500);

    const central = eligibleKw * benchmarkCostPerKw * 0.2; // 20%
    const state = eligibleKw * benchmarkCostPerKw * 0.5; // 50%
    const total = central + state;

    return { central, state, total, eligibleKw };
  }

  /* ✅ Telangana RWA / GHS rule */
  if (name?.toLowerCase() === "telangana") {
    // Cap at 500 kW
    const eligibleKw = Math.min(finalDcKw, 500);

    // Central CFA = ₹18,000 × eligible kW
    const central = eligibleKw * 18000;

    // State Subsidy = 20% of total cost
    const totalCost = eligibleKw * benchmarkCostPerKw;
    const state = totalCost * 0.2;

    return { central, state, total: central + state, eligibleKw };
  }

  /* ✅ Uttarakhand RWA / GHS rule */
  if (name?.toLowerCase() === "uttarakhand") {
    // Step 2: Eligible capacity
    const eligibleKw = Math.min(finalDcKw, 500);

    // Step 3: Central CFA
    const central = eligibleKw * 18000;

    // Step 4: No state subsidy
    const state = 0;

    // Step 5: SGST reimbursement (50% of 2.5%)
    const sgst = eligibleKw * benchmarkCostPerKw * 0.0125;

    // Step 6: Total
    const total = central + sgst;

    return { central, state, sgst, total, eligibleKw };
  }

  if (rwa_mode !== "state_only") {
    central = eligibleKw * rwa_central_rate;
  }

  switch (rwa_mode) {
    case "cfa_only":
      console.log("1");
      state = 0;
      break;
    case "flat_per_kw":
      console.log("2");
      state = eligibleKw * (rwa_state_topup || 0);
      break;
    case "percent_of_cost":
      console.log("3");
      state = eligibleKw * benchmarkCostPerKw * ((rwa_state_topup || 20) / 100);
      break;
    case "percent_of_cost_cfa_only":
      console.log("4");
      central =
        eligibleKw * benchmarkCostPerKw * ((rwa_state_topup || 20) / 100);
      console.log(
        eligibleKw,
        benchmarkCostPerKw,
        rwa_state_topup || 20,
        central
      );
      state = 0;
      break;
    case "fixed_per_house":
      console.log("5");
      // console.log(
      //   "we are in the switch statement and in fixed per house thing"
      // );
      state = numHouses * (rwa_state_topup || 0);
      // console.log("state subsidy in case of the fixed per house is", state);
      break;
    case "state_only":
      console.log("6");
      central = 0;
      state = eligibleKw * benchmarkCostPerKw * ((rwa_state_topup || 20) / 100);
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
        per_house_sanctioned_load_kw = 0,
        plant_size_kw = 0,
        discom_extra_charges = 200,
         psh = 5, 
      } = ctx.request.body;

      // Fetch calculator settings (includes subsidy values)
      const settingsArr = await strapi.entityService.findMany(
        "api::calculator-setting.calculator-setting"
      );
      const settings = settingsArr;
      // console.log("this is the settings data", settingsArr);

      // Fetch state-specific subsidy data
      const stateDataArr = await strapi.entityService.findMany(
        "api::state.state",
        {
          filters: { name: state_name },
          populate: {
            disclaimers: true,
            rwa_disclaimer: true,
            important_notes: true, // ✅ explicitly populate component
          },
        }
      );
      if (!stateDataArr || stateDataArr.length === 0) {
        return ctx.badRequest(`State ${state_name} not found`);
      }
      const stateData = stateDataArr[0];
      console.log("this is the state data", stateData);

      let rwa_per_house_cap_kw = stateData.rwa_per_house_cap_kw;
      // console.log("this is the rwa per house cap kw", rwa_per_house_cap_kw);
      let rwa_overall_subsidy_cap = stateData.rwa_total_cap_kw;

      // Convert roof area to sqft
      let roofSqft = roof_area_value;
      if (roof_area_unit === "sqm") roofSqft = roofSqft * 10.764;
      if (roof_area_unit === "sqyd/gaj") roofSqft = roofSqft * 9;
      if (roof_area_unit === "ground") roofSqft = roofSqft * 2400;
      if (roof_area_unit === "cent") roofSqft = roofSqft * 435.6;

      let recommendedKw = 0;
      let finalDcKw = 0;
      let panelCount = 0;
      let monthlyUnits = 0;
      let sanctionedLoadMustBe = 0;
      let dailyUnit = 0;
      let monthlySpendInr = 0;

      if (sizing_method === "plant_size") {
        if (plant_size_kw <= 0) {
          return ctx.badRequest(
            "Plant size (kW) must be provided in plant_size mode"
          );
        }

        recommendedKw = plant_size_kw;

        panelCount = Math.ceil((recommendedKw * 1000) / settings.panel_watt_w);
        finalDcKw = panelCount * (settings.panel_watt_w / 1000);
        sanctionedLoadMustBe = Math.ceil(finalDcKw);

        monthlyUnits = 0;
        monthlySpendInr = 0;
      } else if (!is_rwa) {
        if (sizing_method === "bill") {
          monthlyUnits = monthly_bill_inr / tariff_inr_per_kwh;
          monthlySpendInr = monthly_bill_inr;
        } else if (sizing_method === "units") {
          monthlyUnits = monthly_units_kwh;
          monthlySpendInr = monthly_units_kwh * tariff_inr_per_kwh;
        } else {
          return ctx.badRequest(
            "Invalid sizing_method for residential. Use 'bill' or 'units'."
          );
        }

        recommendedKw = monthlyUnits / (psh * 30);
        panelCount = Math.ceil((recommendedKw * 1000) / settings.panel_watt_w);
        finalDcKw = panelCount * (settings.panel_watt_w / 1000);
        console.log("from here the finaldckw is being calculated", finalDcKw);
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
          if (society_sanctioned_load_kw > 0)
            candidateCaps.push(society_sanctioned_load_kw);
          if (per_house_sanctioned_load_kw > 0)
            candidateCaps.push(per_house_sanctioned_load_kw * num_houses);

          if (candidateCaps.length > 0) {
            // 👉 If no proposed, fallback to the larger of society vs per-house
            recommendedKw = Math.max(...candidateCaps);
          } else {
            return ctx.badRequest("No valid RWA sizing inputs provided");
          }
        }

        panelCount = Math.ceil((recommendedKw * 1000) / settings.panel_watt_w);
        finalDcKw = panelCount * (settings.panel_watt_w / 1000);
        sanctionedLoadMustBe = Math.ceil(finalDcKw);
      }

      let totalSpend = monthlySpendInr * 12 * 30;

      console.log(
        "this is the finaldckw that is coming from the main",
        finalDcKw
      );

      // Inverter
      const inverterOptions = getInverterOptions(finalDcKw);
      const { nearestSku, widerSku, allValid } = suggestSkuOptions(finalDcKw);

      // Stringing
      const stringDesign = getStringDesign(panelCount);

      // Battery
      // inverter_kw is taken from nearestSku to decide bus voltage (24/48/96)
      const batteryOptions = getBatteryOptions(
        finalDcKw,
        settings,
        nearestSku?.inverter_kw || 5,
        psh,
      );

      // Step 5: Subsidy Eligible KW
      const subsidyResult = is_rwa
        ? rwaSubsidyCalc(
          finalDcKw,
          stateData,
          settings.rwa_cost_inr_per_kw,
          per_house_sanctioned_load_kw,
          num_houses
        )
        : subsidyCalc(finalDcKw, stateData, settings.cost_inr_per_kw);

      const {
        central: centralSubsidyInr,
        state: stateSubsidyInr,
        sgst: sgstSubsidyInr,
        total: totalSubsidyInr,
        eligibleKw,
      } = subsidyResult;
      console.log("this is the subsidy data", subsidyResult);

      // Step 7: Costs
      const systemCostPerKw = is_rwa
        ? settings.rwa_cost_inr_per_kw
        : settings.cost_inr_per_kw;
      const grossCostInr = finalDcKw * systemCostPerKw;
      const netCostInr = Math.max(grossCostInr - totalSubsidyInr, 0);

      // Step 8: Generation
      // console.log("this is the recommended system", recommendedKw);
      const dailyGen = settings.topcon_575_daily_generation * panelCount;
      const monthlyGen = dailyGen * 30;
      const annualGen = monthlyGen * 12;
      const lifetimeGen =
        annualGen *
        (settings.lifetime_years -
          (settings.degradation_pct_per_year / 100) * settings.lifetime_years);

      // Step 9: Savings
      const monthlySaving = monthlyGen * tariff_inr_per_kwh;
      const annualSaving = monthlySaving * 12;
      const lifetime_saving = annualSaving * 30;

      // Discom charge
      const discomCharge = Number(discom_extra_charges) || 200;
      const annualDiscom = discomCharge * 12;
      const totalDiscom = annualDiscom * 30;
      // console.log("this is the total discom", totalDiscom);

      // Net savings per year after discom
      const annualSavingNet = annualSaving;

      // Step 10: Payback
      let paybackYears = netCostInr > 0 ? netCostInr / annualSaving : 0;

      // Only count years after payback
      const yearsAfterPayback = Math.max(
        settings.lifetime_years - Math.ceil(paybackYears),
        0
      );

      // Net gain after payback = savings in remaining years
      const netGainAfterPayback =
        annualSavingNet * yearsAfterPayback - totalDiscom;

      // Step 11: Roof Feasibility
      let roofNeededSqft;

      // ✅ If user provided roof_area_value → use actual panel area from settings
      // Else → assume ~80 sqft per panel (default fallback)
      if (roof_area_value && roof_area_value > 0) {
        roofNeededSqft = finalDcKw * settings.panel_area_sqft;
      } else {
        roofNeededSqft = finalDcKw * 80; // fallback assumption
      }

      let roofOk = null;

      // Convert available roof input to sqft (already done earlier → roofSqft)
      // Now convert both "needed" and "available" back to user’s selected unit
      let roofNeededFinal = roofNeededSqft;
      let roofAvailableFinal = roofSqft;

      switch (roof_area_unit) {
        case "sqm":
          roofNeededFinal = roofNeededSqft / 10.764;
          roofAvailableFinal = roofSqft / 10.764;
          break;
        case "sqyd/gaj":
          roofNeededFinal = roofNeededSqft / 9;
          roofAvailableFinal = roofSqft / 9;
          break;
        case "ground":
          roofNeededFinal = roofNeededSqft / 2400;
          roofAvailableFinal = roofSqft / 2400;
          break;
        case "cent":
          roofNeededFinal = roofNeededSqft / 435.6;
          roofAvailableFinal = roofSqft / 435.6;
          break;
        default:
          // sqft → already fine
          break;
      }

      // Check feasibility
      if (roof_area_value && roof_area_value > 0) {
        roofOk = roofAvailableFinal >= roofNeededFinal;
      }

      // Disclaimer (residential vs RWA)
      const disclaimer = is_rwa
        ? stateData.rwa_disclaimer
        : stateData.disclaimers;

      const importantNotes = stateData.important_notes;
      // console.log("this is the important notes of the state", importantNotes);

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
        sgst_subsidy: sgstSubsidyInr,
        total_subsidy: totalSubsidyInr,
        eligibleKw: eligibleKw,
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
        roof_needed_sqft: roofNeededFinal,
        roof_area_available: roofAvailableFinal,
        roof_area_unit: roof_area_unit,
        roof_fits: roofOk,
        rwa_per_house_cap_kw: rwa_per_house_cap_kw,
        rwa_overall_subsidy_cap: rwa_overall_subsidy_cap,
        inverter_options: inverterOptions,
        nearest_sku: nearestSku,
        wider_sku: widerSku,
        all_valid_sku: allValid,
        string_design: stringDesign,
        battery_options: batteryOptions,
        importantNotes,
        disclaimer,
      });
    } catch (err) {
      ctx.throw(500, err);
    }
  },
};
