const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { getDestination, buildHeadersForDestination } = require('@sap-cloud-sdk/connectivity');
const { ConnectionBackend } = require('./lib/ConnectionHandler');
const { to } = require('@sap/cds/lib/srv/cds-connect');

// const doc = cds.compile(..., { docs: true })
function buildBatchPayload(items) {
  const batchId = 'batch';
  const changesetId = 'changeset';

  let body = `--${batchId}\r\n`;
  body += `Content-Type: multipart/mixed; boundary=${changesetId}\r\n\r\n`;

  items.forEach(item => {
    const payload = mapToS4Payload(item);

    body += `--${changesetId}\r\n`;
    body += `Content-Type: application/http\r\n`;
    body += `Content-Transfer-Encoding: binary\r\n\r\n`;

    body += `POST ModelPriceBreakupSet HTTP/1.1\r\n`;
    body += `Content-Type: application/json\r\n\r\n`;

    body += `${JSON.stringify(payload)}\r\n`;
  });

  body += `--${changesetId}--\r\n`;
  body += `--${batchId}--`;

  return { body, batchId };
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(v);
}

function str(v) {
  return v === null || v === undefined ? "" : String(v);
}

function mapToS4Payload(ui) {
  const s = (v) => (v === null || v === undefined) ? "" : String(v);
  const n = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? 0 : Number(v);

  return {
    Model: s(ui.Model),
    OperationNo: n(ui.OperationNo ?? 0),
    SaveInd: s(ui.SaveInd ?? "X"),
    Region: s(ui.Region),
    MtoMts: s(ui.MtoMts),
    Basis: s(ui.Basis),
    ReferenceNum: s(ui.ReferenceNum ?? ""),
    Mail: s(ui.Mail),
    AsmName: s(ui.AsmName),

    DealerMargPerc: s(ui.DealerMarginPerc ?? ui.DealerMargPerc ?? ""),   // ← SAP field
    InputNsp: s(ui.InputNsp),
    IncrementalNsp: s(ui.IncrementalNsp),
    ActualNsp: s(ui.ActualNsp),

    Helmet: s(ui.Helmet),
    Transportation: s(ui.Transportation),
    DealerCost: s(ui.DealerCost),
    OtherExpenses: s(ui.OtherExpenses),
    BikeMargin: s(ui.BikeMargin),
    DealerMargin: s(ui.DealerMargin ?? ui.ActualDealerMargin),            // total dealer margin rupee

    IncrementDlr: s(ui.IncrementDlr),
    ActualDealerMargin: s(ui.ActualDealerMargin),
    HelmetMargin: s(ui.HelmetMargin),
    TotalDealerMargin: s(ui.TotalDealerMargin),

    Ndp: s(ui.Ndp),
    Basic: s(ui.Basic),
    Gst: s(ui.Gst ?? ui.GSTAfterbasic),                                   // rupee amount
    GstAftBasic: s(ui.GSTAfterbasic ?? ui.Gst),                          // ← SAP field (same value)
    InputExShowroom: s(ui.InputExShowroom ?? ui.ex_showroomAfterGST ?? ui.ActualExShowroom),
    ActualExShowroom: s(ui.ActualExShowroom ?? ui.ex_showroomAfterGST),

    ExceptionRef: s(ui.ExceptionRef ?? "E"),
    RtoPerc: s(ui.RTO_percentage ?? ui.RtoPerc),
    Rto: s(ui.RTO ?? ui.Rto),
    RtoWithBill: s(ui.RTO_bill ?? ui.RtoWithBill),

    InsuranceLe350: s(ui.InsuranceLe350),
    InsuranceGt350: s(ui.InsuranceGt350),
    InsurancePerc: s(ui.insuranceperc ?? ui.InsurancePerc ?? ""),         // ← SAP field
    Insurance: s(ui.insurance ?? ui.Insurance),
    TpaPa: s(ui.TPA_PA ?? ui.TpaPa),
    InsuranceGst: s(ui.GST_afterTPA ?? ui.ActualGst),                    // ← SAP field
    TotalInsurance: s(ui.TotalInsurance),

    OnRoad: s(ui.OnRoadPrice ?? ui.OnRoad),
    Diff: s(ui.Diff ?? 0),
    GstPerc: s(ui.GstPerc ?? 0),

    // ── MTO-specific fields ──────────────────────────────────────────────
    ReferenceMtsModel: s(ui.ReferenceMtsModel ?? ui.ReferModel ?? ""),
    MtoNsp: s(ui.MtoNsp ?? ui.MTO_NSP ?? ""),                            // ← SAP: MtoNsp
    MiyExshowroom: s(ui.MiyExshowroom ?? ui.MIYExShowroomTotal ?? ""),   // ← SAP: MiyExshowroom
    MiyOnroad: s(ui.MiyOnroad ?? ui.MIYOnRoadTotal ?? ""),               // ← SAP: MiyOnroad
    MtsExshwroom: s(ui.MtsExshwroom ?? ""),                             // ← SAP: MtsExshwroom
    MtsOnRoad: s(ui.MtsOnRoad ?? ""),                                    // ← SAP: MtsOnRoad
    MtoExShwroom: s(ui.MTO_Exshowroom ?? ui.ActualExShowroom ?? ""),     // ← SAP: MtoExShwroom
    MtoOnRoad: s(ui.MTOOnRoad ?? ui.OnRoad ?? ""),                       // ← SAP: MtoOnRoad
    MtoExShwAftGma: s(ui.MtoExShwAftGma ?? ""),                   // ← SAP: MtoExShwAftGma
    ExpExshowroom: s(ui.ExpExshowroom ?? ui.MTOExshowroomafterGMA ?? ""),
    ExpOnroad: s(ui.ExpOnroad ?? ui.ExpectedOnRoad ?? "")
  };
}

function calcRtoBill(exshowroom, rto, regionCodeStr, variantVariableSet, RTO_percentage) {
  const prefix2 = String(Number(regionCodeStr)).padStart(2, '0') + "_";
  const prefix3 = String(Number(regionCodeStr)).padStart(3, '0') + "_";

  const getVar = (suffix) => {
    let entry = variantVariableSet.find(v => v.Low === prefix2 + suffix);
    if (!entry) entry = variantVariableSet.find(v => v.Low === prefix3 + suffix);
    return entry ? entry.High : null;
  };

  const rtoExpensePercentRaw = getVar("RTO_EXPENSE_PERCENT");
  const rtoExpenseAmountRaw = getVar("RTO_EXPENSE_AMOUNT");

  const rtoExpensePercent = Number(rtoExpensePercentRaw ?? 0);
  const rtoExpenseAmount = Number(rtoExpenseAmountRaw ?? 0);

  // ── If both config values are missing or zero, signal caller to use RTOExpense fallback ──
  const hasValidData = (rtoExpensePercentRaw !== null && rtoExpensePercent !== 0)
    || (rtoExpenseAmountRaw !== null && rtoExpenseAmount !== 0);

  if (!hasValidData) return null;   // triggers the || fallback in caller

  const rtoExpenseRef = getVar("RTO_EXPENSE_PERCENT_REF");

  if (rtoExpenseRef === "RTO") {
    const RTOamount = exshowroom * (RTO_percentage / 100);
    return (RTOamount * (rtoExpensePercent / 100)) + rtoExpenseAmount;
  } else {
    return (exshowroom * (RTO_percentage / 100)) + rtoExpenseAmount;
  }
}

// ── Latest-record helpers ──────────────────────────────────────────────────

/**
 * Combines FromDate + FromTime into a single comparable Date.
 */
function getRecordDateTime(record) {
  const date = new Date(record.FromDate);
  const timeInMs = record.FromTime?.ms ?? 0;
  return new Date(date.getTime() + timeInMs);
}

/**
 * From an array of records, returns only the latest record per unique key.
 * @param {Array} records - Full dataset
 * @param {Function} keyFn - Function that returns a string key for a record
 * @returns {Array} - One latest record per key
 */
function getLatestPerKey(records, keyFn) {
  const map = new Map();

  for (const record of records) {
    const key = keyFn(record);
    const existing = map.get(key);

    const recordDateTime = getRecordDateTime(record);
    const existingDateTime = existing ? getRecordDateTime(existing) : null;

    if (!existing || recordDateTime > existingDateTime) {
      map.set(key, record);
    }
  }

  return Array.from(map.values());
}

/**
 * Like getLatestPerKey but only considers records with FromDate <= effectiveDate.
 * @param {Array}    records       - Full dataset
 * @param {Function} keyFn        - Function that returns a string key for a record
 * @param {Date}     effectiveDate - Upper-bound date (inclusive)
 * @returns {Array} - One latest record per key, as of effectiveDate
 */
function getLatestPerKeyAsOf(records, keyFn, effectiveDate) {
  const map = new Map();

  for (const record of records) {
    const recDate = new Date(record.FromDate);
    recDate.setHours(0, 0, 0, 0);

    // Skip records that are in the future relative to effectiveDate
    if (recDate > effectiveDate) continue;

    const key = keyFn(record);
    const existing = map.get(key);

    const recordDateTime = getRecordDateTime(record);
    const existingDateTime = existing ? getRecordDateTime(existing) : null;

    if (!existing || recordDateTime > existingDateTime) {
      map.set(key, record);
    }
  }

  return Array.from(map.values());
}


module.exports = cds.service.impl(async function () {

  const backendconnect = await cds.connect.to("vechilePricing");

  const {
    RegionMasterSet, ModelMasterSet, PricingComponentsSet, ModelPriceBreakupSet,
    RTOExpenseSet, RtoMasterSet, GMAComponentsSet, SubmissionReferenceSet,
    PartsSet, SubmissionReference, ApproverSet, VariantVariableSet, ReferenceNumSet, getApprovalDetailedData
  } = this.entities;

  // ── READ passthroughs ──────────────────────────────────────────────────────
  this.on('READ', RegionMasterSet, async (req) => backendconnect.read(req.query));
  this.on('READ', ModelMasterSet, async (req) => backendconnect.read(req.query));
  this.on('READ', PricingComponentsSet, async (req) => backendconnect.read(req.query));
  this.on('READ', ModelPriceBreakupSet, async (req) => backendconnect.read(req.query));
  this.on('READ', RTOExpenseSet, async (req) => backendconnect.read(req.query));
  this.on('READ', RtoMasterSet, async (req) => backendconnect.read(req.query));
  this.on('READ', GMAComponentsSet, async (req) => backendconnect.read(req.query));
  this.on('READ', SubmissionReferenceSet, async (req) => backendconnect.read(req.query));
  this.on('READ', PartsSet, async (req) => backendconnect.read(req.query));
  this.on('READ', SubmissionReference, async (req) => backendconnect.read(req.query));
  this.on('READ', ApproverSet, async (req) => backendconnect.read(req.query));
  this.on('READ', VariantVariableSet, async (req) => backendconnect.read(req.query));

  // ── Rounding helpers ───────────────────────────────────────────────────────
  const to2 = (v) => {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return Number(Number(v).toFixed(2));
  };
  const to6 = (v) => {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return Number(Number(v).toFixed(6));
  };
  const to0 = (v) => {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return Math.round(Number(v));
  };
  const roundToWholeWith00 = (v) => {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    return (Math.round(Number(v))).toFixed(2);
  };

  const reverseSolveDealerCost = (Basic, otherExpenses, GST, DealerMarginPerc, DealerMargCalc, HelmetMargin = 0) => {
    if (DealerMargCalc === "NDP") {
      const divisor = 1 + (1 + (GST / 100)) * (DealerMarginPerc / 100);
      return (Basic - otherExpenses - HelmetMargin) / divisor;
    }
    return Basic - otherExpenses - HelmetMargin;
  };

  const getInsuranceGstActual = (ccValue, VariantVariableSet) => {
    const key = ccValue <= 350 ? "LT350_INSURANCE_GST" : "GT350_INSURANCE_GST";
    const entry = VariantVariableSet.find(v => v.Low === key);
    if (!entry) throw new Error(`Insurance GST configuration missing for ${key}`);
    return Number(entry.High);
  };


  // ── saveToModelPriceBreakUp ────────────────────────────────────────────────
  this.on('saveToModelPriceBreakUp', async (req) => {
    try {
      const items = req.data.items;

      if (!Array.isArray(items) || items.length === 0) {
        return req.reject(400, 'No items provided for save');
      }

      items.forEach((item, idx) => {
        const { Model, Region, MtoMts } = item;
        if (!Model || !Region || !MtoMts) {
          req.reject(400, `Missing mandatory fields (Model / Region / MtoMts) at index ${idx}`);
        }
      });

      const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

      const csrfResponse = await executeHttpRequest(destination, {
        method: 'GET',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/ModelPriceBreakupSet',
        headers: { 'X-CSRF-Token': 'Fetch', 'Accept': 'application/json' }
      });

      const csrfToken = csrfResponse.headers['x-csrf-token'];
      const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');

      if (!csrfToken || !cookies) {
        return req.reject(500, 'Failed to retrieve CSRF token or cookies from S/4');
      }

      const { body, batchId } = buildBatchPayload(items);

      const chunkSize = 100000;

      let allResponses = [];

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);

        const { body, batchId } = buildBatchPayload(chunk);

        console.log('Payload: ', body);


        const response = await executeHttpRequest(destination, {
          method: 'POST',
          url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/$batch',
          headers: {
            'Content-Type': `multipart/mixed; boundary=${batchId}`,
            'X-CSRF-Token': csrfToken,
            'Cookie': cookies
          },
          data: body
        });

        allResponses.push(response.data);
      }

      return {
        message: 'Model Price Breakup saved successfully',
        responses: allResponses
      };
    } catch (error) {
      console.error('S/4 Batch Save Error:', error.response?.data || error.message);
      return req.reject(
        error.response?.status || 500,
        error.response?.data?.error?.message?.value || 'Failed to save Model Price Breakup'
      );
    }
  });


  // ── goProcessing ───────────────────────────────────────────────────────────
  this.on('goProcessing', async (req) => {


    try {
      const { regionCode, MTOStatus, Mail, ModelCodes, StatusFilter, EffectiveDate } = req.data;
      // const regionCodeStr = String(regionCode).padStart(2, '0');

      //changes

      const regionCodeStr = String(Number(regionCode)).padStart(3, '0');

      const aModelFilter = Array.isArray(ModelCodes) && ModelCodes.length > 0 ? ModelCodes : null;

      // ── Resolve effective date — default to today ──────────────────────────
      // const effectiveDate = EffectiveDate ? new Date(EffectiveDate) : new Date();
      // effectiveDate.setHours(0, 0, 0, 0);

      //changes

      function parseSafeDate(dateStr) {
        if (!dateStr) return new Date();
        // "YYYY-MM-DD" — parse as LOCAL date, not UTC
        const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return new Date(dateStr);
      }
      const effectiveDate = parseSafeDate(EffectiveDate);
      effectiveDate.setHours(0, 0, 0, 0);

      if (EffectiveDate) effectiveDate.setDate(effectiveDate.getDate() + 1);

      // ── Status → allowed SAP Status values ────────────────────────────────
      const mStatusMap = {
        "ACTIVE": ["APPROVED"],
        "IN-ACTIVE": ["REJECTED", "INACTIVE", "IN-ACTIVE"],
        "IN-STOCK": ["IN-STOCK", "INSTOCK"]
      };
      const aAllowedStatuses = mStatusMap[StatusFilter?.toUpperCase()] || ["APPROVED"];

      const [
        regionMasterRaw,
        modelMasterRaw,
        pricingComponentsSetRaw,
        RTOMasterSetRaw,
        RTOExpenseSetRaw,
        GMAComponentsSetRaw,
        ModelPriceBreakupSet,
        PartsSetRaw,
        VariantVariableSet,
        SubmissionReferenceSet
      ] = await Promise.all([
        backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
        backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
        backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
        backendconnect.run(SELECT.from('ModelPriceBreakupSet').where({ Mail })),
        backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
        backendconnect.run(SELECT.from('VariantVariableSet')),
        backendconnect.run(SELECT.from('SubmissionReferenceSet'))
      ]);

      // ── Filter each master to latest record per natural key as of effectiveDate ──
      const regionMaster = getLatestPerKeyAsOf(regionMasterRaw, r => r.Region, effectiveDate);

      let modelMasterFiltered = getLatestPerKeyAsOf(modelMasterRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`, effectiveDate);
      // ── Fallback to ModelInvalidSet if no records found for effectiveDate ──
      if (!modelMasterFiltered.length && EffectiveDate) {
        console.log("goProcessing: no models in main set for effectiveDate — trying ModelInvalidSet");
        const modelInvalidRaw = await backendconnect.run(SELECT.from('ModelInvalidSet').where({ Mail }));
        modelMasterFiltered = getLatestPerKeyAsOf(modelInvalidRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`, effectiveDate);
      }
      const modelMaster = modelMasterFiltered;

      const pricingComponentsSet = getLatestPerKeyAsOf(pricingComponentsSetRaw, p => `${p.Region}|${p.EngineType}`, effectiveDate);
      // const RTOMasterSet = getLatestPerKeyAsOf(RTOMasterSetRaw, r => `${r.RegionCode}|${r.Slab}`, effectiveDate);

      //changes 

      const RTOMasterSet = getLatestPerKeyAsOf(
        RTOMasterSetRaw,
        r => String(r.RegionCode).padStart(3, '0') + "|" + r.Slab,  // normalize to 3-digit
        effectiveDate
      );
      const RTOExpenseSet = getLatestPerKeyAsOf(RTOExpenseSetRaw, r => `${r.RegionCode}|${r.Slab}`, effectiveDate);
      const GMAComponentsSet = getLatestPerKeyAsOf(GMAComponentsSetRaw, g => g.Models, effectiveDate);
      const PartsSet = getLatestPerKeyAsOf(PartsSetRaw, p => p.PartCode, effectiveDate);

      const region = regionMaster.find(r => r.Region === regionCodeStr);
      if (!region) return req.error(404, `No Region found for region ${regionCodeStr}`);

      const pricingMatches = pricingComponentsSet.filter(p =>
        p.Region === regionCodeStr && p.EngineType === "ICE"
      );

      // const RTOExpense = RTOExpenseSet.find(m => String(m.RegionCode).padStart(3, '0') === regionCodeStr);
      // if (!RTOExpense) return req.error(404, `No RTO expense for region ${regionCodeStr}`);

      // console.log(RTOExpense);

      const pricing = pricingMatches[0] ?? null;
      if (!pricing) return req.error(404, `Pricing components missing for region: ${regionCodeStr} / ICE`);

      const returnError = (req, code, message) => {
        console.error(`[ERROR ${code}]: ${message}`);
        return req.error(code, message);
      };

      // ── Use aAllowedStatuses instead of hardcoded validStatuses ───────────
      const relevantModels = modelMaster.filter(
        m => aAllowedStatuses.includes(m.Status)
      );
      if (!relevantModels.length) {
        return req.error(404, `No valid models found for OrdType: ${MTOStatus}`);
      }

      const getInsuranceGstActual = (ccValue, VariantVariableSet) => {
        const key = ccValue <= 350 ? "LT350_INSURANCE_GST" : "GT350_INSURANCE_GST";
        const entry = VariantVariableSet.find(v => v.Low === key);
        if (!entry) throw new Error(`Insurance GST configuration missing for ${key}`);
        return Number(entry.High);
      };

      // ── MTO Branch ──────────────────────────────────────────────────────────
      if (MTOStatus === "MTO") {

        let mtoGMAList = GMAComponentsSet.filter(g => g.MtsMto === "MTO");
        if (aModelFilter) {
          mtoGMAList = mtoGMAList.filter(g =>
            aModelFilter.includes(g.Models) || aModelFilter.includes(g.ReferMtsModel)
          );
        }
        if (!mtoGMAList.length) return req.error(404, "No MTO GMA records found for the selected models");

        const approvedRefs = SubmissionReferenceSet
          .filter(s => s.Status === "APPROVED")
          .map(s => s.ReferenceNum);

        const approvedBreakups = ModelPriceBreakupSet
          .filter(b => approvedRefs.includes(b.ReferenceNum));

        console.log(approvedBreakups);


        const results = [];

        for (const gma of mtoGMAList) {
          const referenceModel = gma.ReferMtsModel;
          const displayModel = gma.Models;

          if (!referenceModel) {
            return returnError(req, 400, `GMA entry missing ReferMtsModel. Display model: ${displayModel}`);
          }

          const mtsRecord = approvedBreakups.find(
            m => m.Model === referenceModel && m.MtoMts === "MTS" && m.Region === regionCodeStr
          );
          if (!mtsRecord) {
            console.warn(`No APPROVED MTS record for reference model: ${referenceModel} — skipping`);
            continue;
          }

          console.log("mts record: ", mtsRecord);


          const exshowroomRaw = Number(mtsRecord.ActualExShowroom);
          if (!exshowroomRaw) {
            console.warn(`ActualExShowroom is zero/missing for model: ${referenceModel} — skipping`);
            continue;
          }

          const model = relevantModels.find(m => m.ModelCode === referenceModel);
          if (!model) {
            console.warn(`Model master missing for: ${referenceModel} — skipping`);
            continue;
          }

          const ccValue = Number(model.CcWatt);
          const GST = Number(model.GstPerc);
          const DealerMarginPerc = Number(model.DealerMargin);
          const DealerMargCalc = model.DealerMargCalc ?? "NDP";

          if (!ccValue) { console.warn(`CcWatt zero/missing for: ${referenceModel}`); continue; }
          if (!GST) { console.warn(`GstPerc zero/missing for: ${referenceModel}`); continue; }

          const otherExpenses = ccValue < 500 ? Number(pricing.OtExpLt500) : Number(pricing.OtExpGt500);
          const HelmetMargin = Number(pricing.HelmetMargin) || 292;
          // new update 18-19 
          //  const HelmetMargin = Number(modelMaster.HelmetMargin);
          const GST_FACTOR = 1 + GST / 100;

          const evPricing = pricingComponentsSet.find(p =>
            p.Region === regionCodeStr && p.EngineType === "ICE"
          ) || pricing;

          const Insurance_GST = ccValue <= 450
            ? Number(evPricing.InsuranceLe350)
            : Number(evPricing.InsuranceGt350);

          const MTS_NSP = Number(mtsRecord.ActualNsp);
          const MTS_Helmet = Number(mtsRecord.Helmet) || 1279;
          const MTS_Transport = Number(mtsRecord.Transportation);
          const MTSExshowroom = exshowroomRaw;

          const insurance = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);
          const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
          const MTS_TpaPa = Number(mtsRecord.TpaPa ?? 0);
          var MTS_RtoPerc = parseFloat(mtsRecord.RtoPerc ?? 0);

          console.log(`insurance rate used: ${insurance}, cc: ${ccValue}`);

          // ── Recalculate MTS OnRoad live ──────────────────────────────────────
          const MTS_TotalDealerMargin_Base = Number(mtsRecord.BikeMargin) + HelmetMargin;
          const MTS_DealerCost_Calc = MTS_NSP + MTS_Helmet + MTS_Transport;
          const MTS_Basic_Calc = Math.round(MTS_DealerCost_Calc + otherExpenses + MTS_TotalDealerMargin_Base);
          const MTS_GSTAmount_Calc = Math.round(MTS_Basic_Calc * (GST / 100));
          const MTS_ExShowroom_Calc = MTS_Basic_Calc + MTS_GSTAmount_Calc;
          const MTS_Rto_Calc = Math.round((region.BasisRto === "BASIC" ? MTS_Basic_Calc : MTS_ExShowroom_Calc) * (MTS_RtoPerc / 100));
          //  changes 


          const MTS_RTOExpenseSlabs = RTOExpenseSet.filter(m =>
            String(m.RegionCode).padStart(3, '0') === regionCodeStr.padStart(3, '0')
          );
          const MTS_RTOExpenseMatch = MTS_RTOExpenseSlabs.find(m =>
            MTS_ExShowroom_Calc >= Number(m.MinRange) && MTS_ExShowroom_Calc <= Number(m.MaxRange)
          );
          const regionPrefixMTS = regionCodeStr.padStart(3, '0');
          const variantPercentMTS = VariantVariableSet.find(v => v.Low === `${regionPrefixMTS}_RTO_EXPENSE_PERCENT`);
          const variantAmountMTS = VariantVariableSet.find(v => v.Low === `${regionPrefixMTS}_RTO_EXPENSE_AMOUNT`);

          let MTS_RtoWithBill_Calc;
          if (variantPercentMTS && variantAmountMTS) {
            MTS_RtoWithBill_Calc = (MTS_Rto_Calc * Number(variantPercentMTS.High) / 100) + Number(variantAmountMTS.High);
          } else if (!MTS_RTOExpenseMatch) {
            MTS_RtoWithBill_Calc = calcRtoBill(MTS_ExShowroom_Calc, MTS_Rto_Calc, regionCodeStr, VariantVariableSet, MTS_RtoPerc);
          } else {
            MTS_RtoWithBill_Calc = Number(MTS_RTOExpenseMatch.Expense);
          }

          const MTS_Insurance_Calc = Math.round((0.95 * MTS_ExShowroom_Calc) * insurance);
          const MTS_GST_Insurance_Calc = Math.round((MTS_Insurance_Calc + MTS_TpaPa) * (Insurance_GST_Actual / 100));
          const MTS_TotalInsurance_Calc = MTS_Insurance_Calc + MTS_TpaPa + MTS_GST_Insurance_Calc;
          const MTS_OnRoad_Calculated = MTS_ExShowroom_Calc + MTS_Rto_Calc + MTS_RtoWithBill_Calc + MTS_TotalInsurance_Calc;

          console.log(`MTS recalc: ExShow=${MTS_ExShowroom_Calc}, OnRoad=${MTS_OnRoad_Calculated} (stored=${mtsRecord.OnRoad})`);

          // ── STEP 1: Classify parts ───────────────────────────────────────────
          let miyExShowroomTotal = 0;
          let miyGmaCostTotal = 0;
          let miyMarkupTotal = 0;
          let miyBreakup = [];
          let exShowroomRunning = exshowroomRaw;

          for (let i = 0; i <= 20; i++) {
            const pCode = gma[`Part${i}`];
            if (!pCode) continue;

            const part = PartsSet.find(p => p.PartCode === pCode);
            if (!part) { console.warn(`PartCode ${pCode} not found — skipping part`); continue; }
            if (!["EX SHOWROOM", "ON ROAD"].includes(part.ExShowOnRoad)) {
              console.warn(`Invalid ExShowOnRoad "${part.ExShowOnRoad}" for PartCode: ${pCode} — skipping`);
              continue;
            }

            const miyCost = Number(part.MiyCost || 0);
            const miyMarkup = Number(part.MiyMarkup || 0);
            const partPrice = miyCost + miyMarkup;

            if (part.ExShowOnRoad === "EX SHOWROOM") {
              const before = exShowroomRunning;
              exShowroomRunning += miyCost;
              miyExShowroomTotal += miyCost;
              miyBreakup.push({
                PartCode: part.PartCode, Description: part.PartDescr,
                ExShowOnRoad: "EX SHOWROOM",
                MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                ExShowroomBefore: to2(before), ExShowroomAfter: to2(exShowroomRunning)
              });
            } else {
              miyGmaCostTotal += miyCost;
              miyMarkupTotal += miyMarkup;
              miyBreakup.push({
                PartCode: part.PartCode, Description: part.PartDescr,
                ExShowOnRoad: "ON ROAD",
                MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                ExShowroomBefore: null, ExShowroomAfter: null
              });
            }
          }

          const miyOnRoadTotal = miyGmaCostTotal;

          // ── Declare ALL MTO fields ONCE ──────────────────────────────────────
          let MTO_NSP = MTS_NSP;
          let MTO_DealerCost = 0;
          let MTO_NDP = 0;
          let MTO_Basic = 0;
          let MTO_GSTAmount = 0;
          let MTO_ExShowroom = exshowroomRaw;
          let MTO_Rto = 0;
          let MTO_RtoWithBill = 0;
          let MTO_Insurance = 0;
          let MTO_TpaPa = MTS_TpaPa;
          let MTO_GST_Insurance = 0;
          let MTO_TotalInsurance = 0;
          let MTO_OnRoad_Final = 0;
          let MTO_DealerMargin = Number(mtsRecord.BikeMargin);

          let MTO_TotalDealerMargin = MTO_DealerMargin + HelmetMargin + miyMarkupTotal;

          // ── STEP 2: ExShowroom solver (S1, S2, S3 only) ──────────────────────
          if (miyExShowroomTotal > 0) {
            const targetExshowroom = exShowroomRunning;

            let calculatedExshowroom = exshowroomRaw;
            let iteration = 0;

            MTO_NSP = MTS_NSP;

            while (Math.abs(calculatedExshowroom - targetExshowroom) > 1) {
              if (++iteration > 50000) { console.warn("Max iterations reached in MTO ExShowroom solver"); break; }

              if (calculatedExshowroom < targetExshowroom) { MTO_NSP += 1; } else { MTO_NSP -= 1; }

              MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              calculatedExshowroom = MTO_Basic + MTO_GSTAmount;
            }

            MTO_ExShowroom = calculatedExshowroom;
            console.log(`ExShowroom solver converged: iterations=${iteration}, NSP=${MTO_NSP}, ExShowroom=${MTO_ExShowroom}`);
          }

          // ── STEP 3: Derive all MTO figures from converged NSP ────────────────
          MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
          MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
          MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
          MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
          MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

          MTO_Rto = Math.round(
            (region.BasisRto === "BASIC" ? MTO_Basic : MTO_ExShowroom) * (MTS_RtoPerc / 100)
          );

          const RTOExpenseSlabs = RTOExpenseSet.filter(m =>
            String(m.RegionCode).padStart(3, '0') === regionCodeStr.padStart(3, '0')
          );
          const RTOExpenseMatch = RTOExpenseSlabs.find(m =>
            MTO_ExShowroom >= Number(m.MinRange) && MTO_ExShowroom <= Number(m.MaxRange)
          );

          const regionPrefix = regionCodeStr.padStart(3, '0');
          const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          if (variantPercentEntry && variantAmountEntry) {
            MTO_RtoWithBill = (MTO_Rto * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
          } else if (!RTOExpenseMatch) {
            MTO_RtoWithBill = calcRtoBill(MTO_ExShowroom, MTO_Rto, regionCodeStr, VariantVariableSet, MTS_RtoPerc);
          } else {
            MTO_RtoWithBill = Number(RTOExpenseMatch.Expense);
          }

          MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
          MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
          MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;

          MTO_OnRoad_Final =
            Math.round(MTO_ExShowroom) +
            Math.round(MTO_Rto) +
            Math.round(MTO_RtoWithBill) +
            Math.round(MTO_TotalInsurance);

          console.log(`Step 3 done: MTO_NSP=${MTO_NSP}, MTO_ExShowroom=${MTO_ExShowroom}, MTO_OnRoad_Final=${MTO_OnRoad_Final}`);
          console.log(`Step 3 breakdown: ExShowroom=${MTO_ExShowroom}, Rto=${MTO_Rto}, RtoWithBill=${MTO_RtoWithBill}, Insurance=${MTO_TotalInsurance}`);
          console.log(`Expected: ExShowroom=343116, Rto=42199, RtoWithBill=~1025(TN slab), TotalInsurance=21272`);
          console.log(`RTO priority: variantPercent=${variantPercentEntry?.Low}, RTOExpenseMatch=${RTOExpenseMatch?.Expense}`);
          console.log(`RtoPerc raw: ${mtsRecord.RtoPerc}, parsed: ${MTS_RtoPerc}`);
          console.log(`RTO check: ${MTO_ExShowroom} * ${MTS_RtoPerc}% = ${MTO_ExShowroom * MTS_RtoPerc / 100}`);
          console.log(`Insurance breakdown: Insurance=${MTO_Insurance}, TpaPa=${MTO_TpaPa}, GST_Insurance=${MTO_GST_Insurance}, Total=${MTO_TotalInsurance}`);
          console.log(`OnRoad breakdown: ExShowroom=${MTO_ExShowroom} + Rto=${MTO_Rto} + RtoWithBill=${MTO_RtoWithBill} + TotalInsurance=${MTO_TotalInsurance} = ${MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance}`);

          // ── STEP 4a: S4 — no OE part, GMA on-road only ──────────────────────
          if (miyOnRoadTotal > 0 && miyExShowroomTotal === 0) {
            const targetOnRoad = Math.round(MTS_OnRoad_Calculated + miyGmaCostTotal);

            let currentNSP_OnRoad = MTO_NSP;
            let calculatedOnRoad = MTO_OnRoad_Final;
            let iteration2 = 0;

            console.log(`S4 solver: target=${targetOnRoad}, startOnRoad=${calculatedOnRoad}, startNSP=${currentNSP_OnRoad}`);

            while (Math.abs(calculatedOnRoad - targetOnRoad) > 1) {
              if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in OnRoad solver S4"); break; }

              if (calculatedOnRoad < targetOnRoad) { currentNSP_OnRoad += 1; } else { currentNSP_OnRoad -= 1; }

              MTO_DealerCost = currentNSP_OnRoad + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
              MTO_Rto = Math.round((region.BasisRto === "BASIC" ? MTO_Basic : MTO_ExShowroom) * (MTS_RtoPerc / 100));

              const _rtoExpMatch4 = RTOExpenseSlabs.find(m =>
                MTO_ExShowroom >= Number(m.MinRange) && MTO_ExShowroom <= Number(m.MaxRange)
              );
              if (variantPercentEntry && variantAmountEntry) {
                MTO_RtoWithBill = (MTO_Rto * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
              } else if (!_rtoExpMatch4) {
                MTO_RtoWithBill = calcRtoBill(MTO_ExShowroom, MTO_Rto, regionCodeStr, VariantVariableSet, MTS_RtoPerc);
              } else {
                MTO_RtoWithBill = Number(_rtoExpMatch4.Expense);
              }

              MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
              MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
              MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
              calculatedOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
            }

            MTO_NSP = currentNSP_OnRoad;
            MTO_OnRoad_Final = calculatedOnRoad;
            console.log(`S4 solver converged: iterations=${iteration2}, NSP=${MTO_NSP}, OnRoad=${MTO_OnRoad_Final}`);
            console.log(`Pre-S4: MTO_OnRoad_Final=${MTO_OnRoad_Final}, mtsRecord.OnRoad=${mtsRecord.OnRoad}, miyGmaCostTotal=${miyGmaCostTotal}`);
          }

          // ── STEP 4b: S2/S3 — OE part + GMA on-road ──────────────────────────
          if (miyOnRoadTotal > 0 && miyExShowroomTotal > 0) {
            const targetOnRoad = Math.round(MTO_OnRoad_Final + miyOnRoadTotal);
            let currentNSP_OnRoad = MTO_NSP;
            let calculatedOnRoad = MTO_OnRoad_Final;
            let iteration2 = 0;

            console.log(`S2/S3 solver: target=${targetOnRoad}, startOnRoad=${calculatedOnRoad}, startNSP=${currentNSP_OnRoad}`);

            while (Math.abs(calculatedOnRoad - targetOnRoad) > 1) {
              if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in OnRoad solver S2/S3"); break; }

              if (calculatedOnRoad < targetOnRoad) { currentNSP_OnRoad += 1; } else { currentNSP_OnRoad -= 1; }

              MTO_DealerCost = currentNSP_OnRoad + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
              MTO_Rto = Math.round((region.BasisRto === "BASIC" ? MTO_Basic : MTO_ExShowroom) * (MTS_RtoPerc / 100));

              const _rtoExpMatch = RTOExpenseSlabs.find(m =>
                MTO_ExShowroom >= Number(m.MinRange) && MTO_ExShowroom <= Number(m.MaxRange)
              );
              if (variantPercentEntry && variantAmountEntry) {
                MTO_RtoWithBill = (MTO_Rto * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
              } else if (!_rtoExpMatch) {
                MTO_RtoWithBill = calcRtoBill(MTO_ExShowroom, MTO_Rto, regionCodeStr, VariantVariableSet, MTS_RtoPerc);
              } else {
                MTO_RtoWithBill = Number(_rtoExpMatch.Expense);
              }

              MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
              MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
              MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
              calculatedOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
            }

            MTO_NSP = currentNSP_OnRoad;
            MTO_OnRoad_Final = calculatedOnRoad;
            console.log(`S2/S3 solver converged: iterations=${iteration2}, NSP=${MTO_NSP}, OnRoad=${MTO_OnRoad_Final}`);
          }


          // ── STEP 5: Build result row ─────────────────────────────────────────
          const IncrementalNsp = MTO_NSP - MTS_NSP;


          //new changes for scenori 5 

          let RtoSlabChanged = false;
          let PreviousRtoPerc = MTS_RtoPerc;
          let NewRtoPerc = MTS_RtoPerc;

          // ── STEP 4c: Scenario 5 (RTO Slab Re-Evaluation based on new ExShowroom) ──

          console.log(
            `\n[SCENARIO 5 CHECK] Starting fresh RTO lookup for Model: ${displayModel}`
          );

          console.log(
            `[SCENARIO 5 CHECK] Current MTO_ExShowroom: ${MTO_ExShowroom}, ` +
            `Current MTS_RtoPerc: ${MTS_RtoPerc}%`
          );

          // Save the On-Road price calculated by Scenarios 1-4 as the "Expected" price
          let MTO_Expected_OnRoad = MTO_OnRoad_Final;

          // Do a fresh lookup in RTOMaster using the newly calculated MTO_ExShowroom
          const freshRtoMaster = RTOMasterSet
            .filter(
              r =>
                String(r.RegionCode).padStart(3, "0") ===
                regionCodeStr.padStart(3, "0")
            )
            .find(
              r =>
                ccValue >= Number(r.CcMin) &&
                ccValue <= Number(r.CcMax) &&
                MTO_ExShowroom >= Number(r.MinRange) &&
                MTO_ExShowroom <= Number(r.MaxRange)
            );

          if (freshRtoMaster) {
            const freshRtoPerc = parseFloat(freshRtoMaster.RtoPercent);

            console.log(
              `[SCENARIO 5 CHECK] Fresh Lookup Found RTO Perc: ${freshRtoPerc}% ` +
              `for ExShowroom range ${freshRtoMaster.MinRange}-${freshRtoMaster.MaxRange}`
            );

            // ── SCENARIO 5 TRIGGER ──
            // If the new Ex-Showroom pushed the RTO into a new slab
            if (freshRtoPerc !== MTS_RtoPerc) {

              RtoSlabChanged = true;
              PreviousRtoPerc = MTS_RtoPerc;
              NewRtoPerc = freshRtoPerc;

              console.log(
                `[SCENARIO 5 TRIGGERED] RTO Slab Changed! ` +
                `Old: ${PreviousRtoPerc}% -> New: ${NewRtoPerc}%`
              );

              console.log(
                `[SCENARIO 5 TRIGGERED] RTO Slab Jumped! ` +
                `Old: ${MTS_RtoPerc}% -> New: ${freshRtoPerc}%`
              );

              console.log(
                `[SCENARIO 5 TRIGGERED] Old RTO Tax: ${MTO_Rto} | ` +
                `Old RtoWithBill: ${MTO_RtoWithBill} | ` +
                `Old OnRoad: ${MTO_Expected_OnRoad}`
              );

              // ── 1. Calculate new Base RTO Tax using the fresh RTO % ──

              let freshRto = 0;

              if (freshRtoPerc === 0 && freshRtoMaster.PriceValue) {
                freshRto = Number(freshRtoMaster.PriceValue);
              } else {
                freshRto = Math.round(
                  (
                    region.BasisRto === "BASIC"
                      ? MTO_Basic
                      : MTO_ExShowroom
                  ) *
                  (freshRtoPerc / 100)
                );
              }

              // Changes as standard data for use case

              // ── 2. Fresh RTO Expense Lookup (Registration/Handling charges) ──

              const freshRtoExpMatch = RTOExpenseSlabs.find(
                m =>
                  MTO_ExShowroom >= Number(m.MinRange) &&
                  MTO_ExShowroom <= Number(m.MaxRange)
              );

              let freshRtoWithBill = 0;

              if (variantPercentEntry && variantAmountEntry) {

                freshRtoWithBill =
                  (freshRto * Number(variantPercentEntry.High) / 100) +
                  Number(variantAmountEntry.High);

              } else if (!freshRtoExpMatch) {

                freshRtoWithBill = calcRtoBill(
                  MTO_ExShowroom,
                  freshRto,
                  regionCodeStr,
                  VariantVariableSet,
                  freshRtoPerc
                );

              } else {

                freshRtoWithBill = Number(freshRtoExpMatch.Expense);
              }

              // ── 3. Overwrite MTO RTO variables with the higher slab values ──

              MTO_Rto = freshRto;
              MTO_RtoWithBill = freshRtoWithBill;
              MTS_RtoPerc = freshRtoPerc;

              // Update the percent so the JSON output reflects the new slab

              // ── 4. Recalculate Final On-Road Price with the new RTO ──

              MTO_OnRoad_Final =
                MTO_ExShowroom +
                MTO_Rto +
                MTO_RtoWithBill +
                MTO_TotalInsurance;

              console.log(
                `[SCENARIO 5 TRIGGERED] New RTO Tax: ${MTO_Rto} | ` +
                `New RtoWithBill: ${MTO_RtoWithBill}`
              );

              console.log(
                `[SCENARIO 5 TRIGGERED] Final MTO OnRoad jumped to: ` +
                `${MTO_OnRoad_Final} ` +
                `(Difference: ${MTO_OnRoad_Final - MTO_Expected_OnRoad})\n`
              );

            } else {

              console.log(
                `[SCENARIO 5 CHECK] No slab jump. ` +
                `RTO remains at ${MTS_RtoPerc}%. ` +
                `MTO_OnRoad_Final stays ${MTO_OnRoad_Final}.\n`
              );
            }

          } else {

            console.log(
              `[SCENARIO 5 CHECK] WARNING: No matching RTO slab found in master ` +
              `for ExShowroom ${MTO_ExShowroom}\n`
            );
          }


          //custom data implememntation for RTO change values

          // ================================================================
          // STEP 4c: SCENARIO 5
          // RTO SLAB RE-EVALUATION BASED ON NEW EX-SHOWROOM
          // ================================================================

          // Keep original MTS RTO percentage unchanged
          // let RtoSlabChanged = false;
          // let PreviousRtoPerc = Number(MTS_RtoPerc);
          // let NewRtoPerc = Number(MTS_RtoPerc);

          // console.log(`\n================================================`);
          // console.log(`[SCENARIO 5 CHECK] Starting RTO Slab Re-Evaluation`);
          // console.log(`================================================`);

          // console.log(
          //   `[SCENARIO 5 CHECK] Model: ${displayModel}`
          // );

          // console.log(
          //   `[SCENARIO 5 CHECK] New MTO ExShowroom: ${MTO_ExShowroom}`
          // );

          // console.log(
          //   `[SCENARIO 5 CHECK] Original MTS RTO %: ${MTS_RtoPerc}%`
          // );


          // // ================================================================
          // // TEMPORARY TEST RTO SLABS
          // // ================================================================

          // const TEST_RTO_SLABS = [
          //   {
          //     minRange: 1,
          //     maxRange: 200000,
          //     rtoPercent: 10
          //   },
          //   {
          //     minRange: 200001,
          //     maxRange: 500000,
          //     rtoPercent: 12
          //   },
          //   {
          //     minRange: 500001,
          //     maxRange: 1000000,
          //     rtoPercent: 15
          //   }
          // ];


          // // ================================================================
          // // SAVE ON-ROAD PRICE BEFORE SCENARIO 5
          // // ================================================================

          // const MTO_Expected_OnRoad = MTO_OnRoad_Final;


          // // ================================================================
          // // FIND NEW RTO SLAB
          // // ================================================================

          // const freshRtoMaster = TEST_RTO_SLABS.find(slab =>
          //   MTO_ExShowroom >= Number(slab.minRange) &&
          //   MTO_ExShowroom <= Number(slab.maxRange)
          // );


          // if (freshRtoMaster) {

          //   const freshRtoPerc = Number(freshRtoMaster.rtoPercent);

          //   console.log(
          //     `[SCENARIO 5 CHECK] Matching Slab Found: ` +
          //     `${freshRtoMaster.minRange} - ${freshRtoMaster.maxRange}`
          //   );

          //   console.log(
          //     `[SCENARIO 5 CHECK] Fresh RTO %: ${freshRtoPerc}%`
          //   );


          //   // ==============================================================
          //   // CHECK WHETHER RTO SLAB CHANGED
          //   // ==============================================================

          //   if (freshRtoPerc !== Number(MTS_RtoPerc)) {

          //     RtoSlabChanged = true;

          //     PreviousRtoPerc = Number(MTS_RtoPerc);
          //     NewRtoPerc = freshRtoPerc;


          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] RTO Slab Changed!`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] Old RTO %: ${PreviousRtoPerc}%`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO %: ${NewRtoPerc}%`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New ExShowroom: ${MTO_ExShowroom}`
          //     );


          //     // ============================================================
          //     // 1. CALCULATE NEW RTO
          //     // ============================================================

          //     let freshRto = 0;

          //     if (
          //       freshRtoPerc === 0 &&
          //       freshRtoMaster.PriceValue
          //     ) {

          //       freshRto = Number(freshRtoMaster.PriceValue);

          //     } else {

          //       const rtoBasis =
          //         region.BasisRto === "BASIC"
          //           ? MTO_Basic
          //           : MTO_ExShowroom;

          //       freshRto = Math.round(
          //         rtoBasis * (freshRtoPerc / 100)
          //       );
          //     }


          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO Tax: ${freshRto}`
          //     );


          //     // ============================================================
          //     // 2. FRESH RTO EXPENSE LOOKUP
          //     // ============================================================

          //     const freshRtoExpMatch = RTOExpenseSlabs.find(m =>
          //       MTO_ExShowroom >= Number(m.MinRange) &&
          //       MTO_ExShowroom <= Number(m.MaxRange)
          //     );


          //     let freshRtoWithBill = 0;


          //     // Variant-based RTO expense
          //     if (
          //       variantPercentEntry &&
          //       variantAmountEntry
          //     ) {

          //       freshRtoWithBill =
          //         (
          //           freshRto *
          //           Number(variantPercentEntry.High) /
          //           100
          //         ) +
          //         Number(variantAmountEntry.High);

          //     }

          //     // No RTO expense slab
          //     else if (!freshRtoExpMatch) {

          //       freshRtoWithBill = calcRtoBill(
          //         MTO_ExShowroom,
          //         freshRto,
          //         regionCodeStr,
          //         VariantVariableSet,
          //         freshRtoPerc
          //       );

          //     }

          //     // RTO expense slab found
          //     else {

          //       freshRtoWithBill =
          //         Number(freshRtoExpMatch.Expense);
          //     }


          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO With Bill: ${freshRtoWithBill}`
          //     );


          //     // ============================================================
          //     // 3. UPDATE MTO RTO VALUES
          //     // ============================================================

          //     MTO_Rto = freshRto;

          //     MTO_RtoWithBill = freshRtoWithBill;


          //     // IMPORTANT:
          //     // Do NOT do:
          //     //
          //     // MTS_RtoPerc = freshRtoPerc;
          //     //
          //     // because MTS_RtoPerc is const and represents the
          //     // original MTS RTO percentage.
          //     //
          //     // New percentage is stored in:
          //     //
          //     // NewRtoPerc
          //     //


          //     // ============================================================
          //     // 4. RECALCULATE FINAL ON-ROAD
          //     // ============================================================

          //     MTO_OnRoad_Final =
          //       Math.round(MTO_ExShowroom) +
          //       Math.round(MTO_Rto) +
          //       Math.round(MTO_RtoWithBill) +
          //       Math.round(MTO_TotalInsurance);


          //     // ============================================================
          //     // 5. DIFFERENCE
          //     // ============================================================

          //     const onRoadDifference =
          //       MTO_OnRoad_Final - MTO_Expected_OnRoad;


          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] Old RTO: ${PreviousRtoPerc}%`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO: ${NewRtoPerc}%`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO Tax: ${MTO_Rto}`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New RTO With Bill: ${MTO_RtoWithBill}`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] Old OnRoad: ${MTO_Expected_OnRoad}`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] New OnRoad: ${MTO_OnRoad_Final}`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] OnRoad Difference: ${onRoadDifference}`
          //     );

          //     console.log(
          //       `[SCENARIO 5 TRIGGERED] RtoSlabChanged: ${RtoSlabChanged}`
          //     );

          //   } else {

          //     console.log(
          //       `[SCENARIO 5 CHECK] No slab change.`
          //     );

          //     console.log(
          //       `[SCENARIO 5 CHECK] RTO remains ${MTS_RtoPerc}%`
          //     );

          //   }

          // } else {

          //   console.log(
          //     `[SCENARIO 5 CHECK] WARNING: No test RTO slab found for ExShowroom ${MTO_ExShowroom}`
          //   );

          // }

          results.push({
            Model: displayModel,
            ReferModel: referenceModel,
            OperationNo: 0,
            SaveInd: "X",
            Mail: gma.Mail ?? mtsRecord.Mail ?? "",
            AsmName: gma.AsmName ?? mtsRecord.AsmName ?? "",
            Region: regionCodeStr,
            MtoMts: "MTO",
            Basis: region.BasisRto,
            ReferenceNum: mtsRecord.ReferenceNum ?? "",
            insuranceperc: to6(insurance),

            InputNsp: to2(MTS_NSP),
            IncrementalNsp: roundToWholeWith00(Math.abs(IncrementalNsp)),
            ActualNsp: roundToWholeWith00(MTS_NSP),

            Helmet: to2(MTS_Helmet),
            Transportation: to2(MTS_Transport),
            DealerCost: roundToWholeWith00(MTO_DealerCost),
            OtherExpenses: to2(otherExpenses),
            BikeMargin: roundToWholeWith00(MTO_DealerMargin),
            DealerMarginPerc: to2(DealerMarginPerc),
            IncrementDlr: to2(miyMarkupTotal),
            ActualDealerMargin: roundToWholeWith00(MTO_TotalDealerMargin),
            HelmetMargin: to2(HelmetMargin),
            TotalDealerMargin: roundToWholeWith00(MTO_TotalDealerMargin),

            Ndp: roundToWholeWith00(MTO_NDP),
            Basic: roundToWholeWith00(MTO_Basic),
            Gst: to0(GST),
            GSTAfterbasic: roundToWholeWith00(MTO_GSTAmount),
            ActualExShowroom: roundToWholeWith00(MTO_ExShowroom),
            InputExShowroom: to2(model.InputExShowroom ?? null),
            Diff: to2(0),
            GstPerc: to0(GST),
            ExceptionRef: mtsRecord.ExceptionRef ?? "E",

            RtoPerc: to2(MTS_RtoPerc),
            Rto: roundToWholeWith00(MTO_Rto),
            RtoWithBill: roundToWholeWith00(MTO_RtoWithBill),

            //             RtoPerc: to2(MTS_RtoPerc),
            // Rto: roundToWholeWith00(MTO_Rto),
            // RtoWithBill: roundToWholeWith00(MTO_RtoWithBill),

            RtoSlabChanged: RtoSlabChanged,
            PreviousRtoPerc: to2(PreviousRtoPerc),
            NewRtoPerc: to2(NewRtoPerc),

            InsuranceLe350: to6(Number(pricing.InsuranceLe350)),
            InsuranceGt350: to6(Number(pricing.InsuranceGt350)),
            Insurance: roundToWholeWith00(MTO_Insurance),
            TpaPa: roundToWholeWith00(MTO_TpaPa),
            ActualGst: roundToWholeWith00(MTO_GST_Insurance),
            TotalInsurance: roundToWholeWith00(MTO_TotalInsurance),

            OnRoad: roundToWholeWith00(MTO_OnRoad_Final),
            MTOOnRoad: roundToWholeWith00(MTO_OnRoad_Final),
            ExpectedOnRoad: roundToWholeWith00(MTO_OnRoad_Final),

            MiyExShowroomTotal: to2(miyExShowroomTotal),
            MiyOnRoadTotal: to2(miyOnRoadTotal),
            MiyBreakup: miyBreakup,

            MTSExshowroom: roundToWholeWith00(MTSExshowroom),
            MTSOnRoad: roundToWholeWith00(MTO_OnRoad_Final - miyOnRoadTotal),
            MTOExshowroomafterGMA: roundToWholeWith00(MTSExshowroom + miyExShowroomTotal),
            MTO_NSP: roundToWholeWith00(MTO_NSP),
            MTO_Exshowroom: roundToWholeWith00(MTO_ExShowroom),
          });
        }

        return results;
      }

            else if (MTOStatus === "GeM" || MTOStatus === "GEM") {
        const DISCOUNT_PERC = 12;

        const approvedRefs = new Set(
          SubmissionReferenceSet
            .filter(s => s.Status === "APPROVED")
            .map(s => s.ReferenceNum)
        );

        // ── Only approved MTS records
        let approvedMtsBreakups = ModelPriceBreakupSet.filter(bp =>
          bp.MtoMts === "MTS" &&
          approvedRefs.has(bp.ReferenceNum)
        );

        if (aModelFilter) {
          approvedMtsBreakups = approvedMtsBreakups.filter(bp => aModelFilter.includes(bp.Model));
        }

        if (!approvedMtsBreakups.length) {
          return req.error(404, `No approved MTS pricing data found for GeM calculation`);
        }

        // ── STEP 1: for EACH REGION, find the single record (model) with the lowest ExShowroom
        const lowestByRegion = new Map();
        for (const bp of approvedMtsBreakups) {
          const exShow = Number(bp.ActualExShowroom ?? 0);
          if (!exShow) continue;

          // normalized so "West" / "WEST " are treated as the same region
          const regionKey = String(bp.Region ?? "").trim().toUpperCase();
          const existing = lowestByRegion.get(regionKey);
          if (!existing || exShow < Number(existing.ActualExShowroom)) {
            lowestByRegion.set(regionKey, bp);
          }
        }

        if (!lowestByRegion.size) {
          return req.error(404, `No records with valid ActualExShowroom found for GeM calculation`);
        }

        const HELMET_COST_KEY = "GEM_HELMET_COST";
        const helmetEntry = VariantVariableSet.find(v => v.Low === HELMET_COST_KEY);
        const helmetCost = helmetEntry ? Number(helmetEntry.High) : 1338;

        const gemResults = [];

        // ── One iteration per region, using only that region's lowest model
        for (const bp of lowestByRegion.values()) {
          const modelCode = bp.Model;
          const MtsExShowroom = Number(bp.ActualExShowroom);

          const model = relevantModels.find(m => m.ModelCode === modelCode);
          if (!model) {
            console.warn(`GeM: model master missing for ${modelCode} (${bp.Region}) — skipping`);
            continue;
          }

          const GST = Number(model.GstPerc);
          if (!GST) {
            console.warn(`GeM: GstPerc missing/zero for model ${modelCode} (${bp.Region}) — skipping`);
            continue;
          }

          // ── STEP 2: 12% discount on the region's lowest ex-showroom
          const DiscountAmount = MtsExShowroom * (DISCOUNT_PERC / 100);
          const SubTotal = MtsExShowroom - DiscountAmount; // new derived ex-showroom

          // ── STEP 3 & 4: reverse-calculate Basic from the derived ex-showroom
          // SubTotal = (Basic + HelmetCost) * (1 + GST/100)
          const BasicInclHelmet = SubTotal / (1 + GST / 100);
          const GstAmount = SubTotal - BasicInclHelmet;
          const Basic = SubTotal - GstAmount; // your original logic
          // To deduct helmet cost, use instead:
          // const Basic = BasicInclHelmet - helmetCost;

          gemResults.push({
            Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
            Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
            MtoMts: "GeM", Basis: bp.Basis,
            DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
            insuranceperc: bp.insuranceperc || "0",
            InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
            Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
            OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
            ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
            TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp,
            Basic: bp.Basic, Gst: bp.Gst,
            InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
            RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
            InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
            Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
            TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
            ActualExShowroom: bp.ActualExShowroom,
            Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,

            // GeM-derived fields
            MtsExShowroom: roundToWholeWith00(MtsExShowroom),
            DiscountPerc: DISCOUNT_PERC,
            DiscountAmount: roundToWholeWith00(DiscountAmount),
            SubTotal: roundToWholeWith00(SubTotal),

            GemGstPerc: to0(GST),
            HelmetCost: to2(helmetCost),
            GemBasic: roundToWholeWith00(Basic),
            GemGstAmount: roundToWholeWith00(GstAmount),

            FinalGeMPrice: roundToWholeWith00(SubTotal)
          });
        }

        return gemResults;
      }

      else if (MTOStatus === "CSD") {
        const approvedRefs = SubmissionReferenceSet
          .filter(s => s.Status === "APPROVED")
          .map(s => s.ReferenceNum);

        // Step 1: approved MTS records only
        let regionBreakups = ModelPriceBreakupSet.filter(bp =>
          bp.Region === regionCodeStr &&
          bp.MtoMts === "MTS" &&
          approvedRefs.includes(bp.ReferenceNum)
        );

        if (aModelFilter) {
          regionBreakups = regionBreakups.filter(bp => aModelFilter.includes(bp.Model));
        }

        if (!regionBreakups.length) {
          return req.error(404, `No approved MTS ModelPriceBreakup data found for region: ${regionCodeStr}`);
        }

        const incidentalEntry = VariantVariableSet.find(v => v.Low === "CSD_INCIDENTAL_PERC");
        const incidentalRate = incidentalEntry ? Number(incidentalEntry.High) / 100 : 0.01;

        const csdResults = [];
        for (const bp of regionBreakups) {
          // Step 2: model master data (discount %, GST %)
          const model = relevantModels.find(m => m.ModelCode === bp.Model);
          if (!model) { console.warn(`CSD: model master missing for ${bp.Model}, skipping`); continue; }

          // Step 3: ActualNsp as the Basic value;
          const ActualNsp = Number(bp.ActualNsp);
          if (!ActualNsp) { console.warn(`CSD: ActualNsp is zero for model ${bp.Model}, skipping`); continue; }

          // Step 4: discount rate
          var CsdDisPerc = Number(model.CsdDisPerc || 3.25);

            
            if (CsdDisPerc === 0) {

              CsdDisPerc = 3.25;
            }

          // Step 5: GST rate — engine-size specific (350cc/650cc)
          const GstPerc = Number(model.CsdGstPerc || model.GstPerc || 0);

          // Step 6: CSD NSP = ActualNsp + Transportation + Other Expenses + Total Dealer Margin
          const Transportation = Number(bp.Transportation || 0);
          const OtherExpenses = Number(bp.OtherExpenses || 0);
          const TotalDealerMargin = Number(bp.TotalDealerMargin || 0); // from approved MTS model
          const CsdNsp = ActualNsp + Transportation + OtherExpenses + TotalDealerMargin;

          // Step 7: Basic Price = Basic − Helmet − Helmet Margin
          const BasicField = Number(bp.Basic || 0);
          const Helmet = Number(bp.Helmet || 0);
          const HelmetMargin = Number(bp.HelmetMargin || 0);
          const BasicPrice = BasicField - Helmet - HelmetMargin;

          // Step 8: Discount Amount = CSD NSP × Discount %
          const DiscountAmount = CsdNsp * (CsdDisPerc / 100);

          // Step 9: Pre-Tax Net Discount = Basic Price − Discount Amount
          const PreTaxNetDiscount = BasicPrice - DiscountAmount;

          // Step 10: GST Amount = Pre-Tax Net Discount × GST %
          const GstAmount = PreTaxNetDiscount * (GstPerc / 100);

          // Step 11: CSD Ex-showroom = Pre-Tax Net Discount + GST Amount
          const CsdExShowroom = PreTaxNetDiscount + GstAmount;

          // Step 12: Incidental Charges = Pre-Tax Net Discount × incidental rate (TVARVS)
          const IncidentalCharges = PreTaxNetDiscount * incidentalRate;

          // Step 13: Final CSD Price = CSD Ex-showroom + Incidental Charges
          const FinalCSDPrice = CsdExShowroom + IncidentalCharges;

          // Step 14: RTO, RTO(With Bill), Total Insurance — straight from approved MTS
          const Rto = Number(bp.Rto || 0);
          const RtoWithBill = Number(bp.RtoWithBill || 0);
          const TotalInsurance = Number(bp.TotalInsurance || 0);

          // Step 15: CSD On-road = CSD Ex-showroom + RTO + RTO(With Bill) + Total Insurance
          const CsdOnRoad = CsdExShowroom + Rto + RtoWithBill + TotalInsurance;

          csdResults.push({
            Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
            Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
            MtoMts: "CSD", Basis: bp.Basis,
            DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
            InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
            Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
            OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
            ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
            TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp, Basic: bp.Basic, Gst: bp.Gst,
            InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
            RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
            InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
            Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
            TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
            ActualExShowroom: bp.ActualExShowroom, Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,
            GstPerc: to2(GstPerc),
            insuranceperc: bp.insuranceperc || "0",

            CsdNsp: roundToWholeWith00(CsdNsp),
            BasicPriceWO: roundToWholeWith00(BasicPrice),
            CsdDisPerc: to2(CsdDisPerc),
            CSD: roundToWholeWith00(DiscountAmount),
            PreTaxNetDiscount: roundToWholeWith00(PreTaxNetDiscount),
            CsdGstPerc: to2(GstPerc),
            CsdGstAmount: roundToWholeWith00(GstAmount),
            CsdExShowroom: roundToWholeWith00(CsdExShowroom),
            IncidentalPerc: to2(incidentalRate * 100),
            IncidentalCharges: roundToWholeWith00(IncidentalCharges),
            FinalCSDPrice: roundToWholeWith00(FinalCSDPrice),
            CsdOnRoad: roundToWholeWith00(CsdOnRoad)
          });
        }
        return csdResults;
      }

      //old code below

      // else if (MTOStatus === "CSD") {
      //   const approvedRefs = SubmissionReferenceSet
      //     .filter(s => s.Status === "APPROVED")
      //     .map(s => s.ReferenceNum);

      //   let regionBreakups = ModelPriceBreakupSet.filter(bp =>
      //     bp.Region === regionCodeStr &&
      //     approvedRefs.includes(bp.ReferenceNum)
      //   );

      //   if (aModelFilter) {
      //     regionBreakups = regionBreakups.filter(bp => aModelFilter.includes(bp.Model));
      //   }

      //   if (!regionBreakups.length) {
      //     return req.error(404, `No ModelPriceBreakup data found for region: ${regionCodeStr}`);
      //   }

      //   // ── Fetch CSD Index No from VariantVariable table ──────────────────────
      //   // Key convention: "CSD_INDEX_{ModelCode}" or a shared key — confirm with team
      //   // Fetching incidental % from VariantVariable (key: CSD_INCIDENTAL_PERC, fallback 1%)
      //   const incidentalEntry = VariantVariableSet.find(v => v.Low === "CSD_INCIDENTAL_PERC");
      //   const incidentalPerc = incidentalEntry ? Number(incidentalEntry.High) / 100 : 0.01;

      //   const csdResults = [];

      //   for (const bp of regionBreakups) {
      //     const model = relevantModels.find(m => m.ModelCode === bp.Model);
      //     if (!model) {
      //       console.warn(`CSD: model master missing for ${bp.Model}, skipping`);
      //       continue;
      //     }

      //     //CSD discount rate

      //     const CSDdiscountRate = Number(model.CsdDisPerc);


      //     // ── NSP = ActualNsp from approved MTS breakup ──────────────────────
      //     const NSP = Number(bp.ActualNsp ?? 0);
      //     if (!NSP) {
      //       console.warn(`CSD: ActualNsp is zero for model ${bp.Model}, skipping`);
      //       continue;
      //     }

      //     // ── BASIC PRICE (W/O) = Basic from MTS breakup ────────────────────
      //     const BasicPriceWO = Number(bp.Basic ?? 0);

      //     console.log(BasicPriceWO);


      //     // ── Discount amt to CSD from model master ──────────────────────────────

      //     const DisAmtToCSD =  NSP * CSDdiscountRate;

      //     const PreTaxNetDis = BasicPriceWO - DisAmtToCSD;


      //     // ── GST: 18% (<=350cc) or 40% (>350cc) from model master ──────────
      //     const GstPerc = Number(model.GstPerc || 0);

      //     const GSTAmount = PreTaxNetDis * (GstPerc/100)

      //     // ── CSD Exshowroom ──────────
      //     const CsdExshowroom = PreTaxNetDis + GSTAmount;

      //         // ── 1% incendental charges ──────────

      //         const IncindentalCharges = PreTaxNetDis * (1/100);

      //         // ── Final CSD price to CSD customer ──────────

      //     const finalCSD = CsdExshowroom + IncindentalCharges;

      //     // // ── CESS: 3% only for Kerala (region 011) ─────────────────────────
      //     // const CessPerc = regionCodeStr === "011" ? 3 : 0;

      //     // // ── CSD Index No from model master ────────────────────────────────
      //     const CsdIndexNo = model.CsdIndex ?? "";

      //     // // ── Calculations ──────────────────────────────────────────────────
      //     // const DiscountAmountToCSD = NSP * (CsdDisPerc / 100);
      //     // const PreTaxNetDiscount = BasicPriceWO - DiscountAmountToCSD;
      //     // const GstAmount = PreTaxNetDiscount * (GstPerc / 100);
      //     // const CessAmount = PreTaxNetDiscount * (CessPerc / 100);
      //     // const CsdExShowroom = PreTaxNetDiscount + GstAmount;
      //     // const IncidentalCharges = PreTaxNetDiscount * 0.01;
      //     // const FinalCSDPrice = CsdExShowroom + IncidentalCharges;

      //     // ── RTO, RTO(With Bill), Insurance — as per MTS file ──────────────
      //     const Rto = Number(bp.Rto ?? 0);
      //     const RtoWithBill = Number(bp.RtoWithBill ?? 0);
      //     const TotalInsurance = Number(bp.TotalInsurance ?? 0);

      //     const CSDOnRoad = CsdExshowroom + Rto + RtoWithBill + TotalInsurance;

      //     csdResults.push({
      //       Model:              bp.Model,
      //       SaveInd:            bp.SaveInd,
      //       OperationNo:        bp.OperationNo,
      //       Mail:               bp.Mail,
      //       AsmName:            bp.AsmName,
      //       Region:             bp.Region,
      //       MtoMts:             "CSD",
      //       Basis:              bp.Basis,
      //       ReferenceNum:       bp.ReferenceNum,

      //       DealerMarginPerc:   bp.DealerMargin   ?? null,
      //       DealerMarigin:      bp.BikeMargin     ?? null,
      //       insuranceperc:      bp.insuranceperc  || "0",
      //       InputNsp:           bp.InputNsp,
      //       IncrementalNsp:     bp.IncrementalNsp,
      //       ActualNsp:          bp.ActualNsp,          // MTS NSP = CSD NSP base
      //       Helmet:             bp.Helmet,
      //       Transportation:     bp.Transportation,
      //       DealerCost:         bp.DealerCost,
      //       OtherExpenses:      bp.OtherExpenses,
      //       BikeMargin:         bp.BikeMargin,
      //       IncrementDlr:       bp.IncrementDlr,
      //       ActualDealerMargin: bp.ActualDealerMargin,
      //       HelmetMargin:       bp.HelmetMargin,
      //       TotalDealerMargin:  bp.TotalDealerMargin,
      //       Ndp:                bp.Ndp,
      //       Basic:              bp.Basic,              // BASIC PRICE
      //       Gst:                bp.Gst,
      //       GSTAfterbasic:      bp.GSTAfterbasic,
      //       ActualExShowroom:   bp.ActualExShowroom,
      //       InputExShowroom:    bp.InputExShowroom,
      //       Diff:               bp.Diff,
      //       ExceptionRef:       bp.ExceptionRef,
      //       RtoPerc:            bp.RtoPerc,
      //       InsuranceLe350:     bp.InsuranceLe350,
      //       InsuranceGt350:     bp.InsuranceGt350,
      //       Insurance:          bp.Insurance,
      //       TpaPa:              bp.TpaPa,
      //       ActualGst:          bp.ActualGst,
      //       OnRoad:             bp.OnRoad,             // MTS OnRoad 

      //       CsdIndexNo:               CsdIndexNo,
      //       CSDDiscount:              to2(CSDdiscountRate),
      //       CsdNsp:                   roundToWholeWith00(NSP),           // NSP
      //       BasicPriceWO:             roundToWholeWith00(BasicPriceWO),  // BASIC PRICE
      //       DiscountAmountToCSD:      roundToWholeWith00(DisAmtToCSD),
      //       PreTaxNetDiscount:        roundToWholeWith00(PreTaxNetDis),
      //       CsdGstPerc:               to2(GstPerc),
      //       CsdGstAmount:             roundToWholeWith00(GSTAmount),
      //       // CessPerc:                 to2(CessPerc),
      //       // CessAmount:               roundToWholeWith00(CessAmount),
      //       CsdExShowroom:            roundToWholeWith00(CsdExshowroom),
      //       IncidentalCharges:        roundToWholeWith00(IncindentalCharges),
      //       FinalCSDPrice:            roundToWholeWith00(finalCSD),
      //       CsdRto:                   roundToWholeWith00(Rto),
      //       CsdRtoWithBill:           roundToWholeWith00(RtoWithBill),
      //       CsdTotalInsurance:        roundToWholeWith00(TotalInsurance),
      //       CSDOnRoad:                roundToWholeWith00(CSDOnRoad),
      //     });
      //   }

      //   return csdResults;
      // }

      // ── EV Branch ───────────────────────────────────────────────────────────
      else if (MTOStatus === "EV") {
        let evGMAList = GMAComponentsSet.filter(g => g.MtsMto === "EV");

        if (aModelFilter) {
          evGMAList = evGMAList.filter(g =>
            aModelFilter.includes(g.Models) || aModelFilter.includes(g.ReferMtsModel)
          );
        }

        if (!evGMAList.length) {
          console.log("No EV GMA records found for region:", regionCodeStr, "— skipping EV processing");
          return [];
        }

        const results = [];

        for (const gma of evGMAList) {
          const referenceModel = gma.ReferMtsModel;
          const displayModel = gma.Models;

          if (!referenceModel) {
            return returnError(req, 400, `GMA entry is missing ReferMtsModel. Display model: ${displayModel}`);
          }

          const breakup = ModelPriceBreakupSet.find(m => m.Model === referenceModel);
          if (!breakup) return returnError(req, 404, `Price breakup missing for model: ${referenceModel}`);

          const exshowroom = Number(breakup.ActualExShowroom);
          if (!exshowroom) return returnError(req, 422, `ActualExShowroom is zero or missing for model: ${referenceModel}`);

          const model = relevantModels.find(m => m.ModelCode === referenceModel);
          if (!model) return returnError(req, 404, `Model master missing for: ${referenceModel}`);

          const ccValue = Number(model.CcWatt);
          const GST = Number(model.GstPerc);
          const DealerMarginPerc = Number(model.DealerMargin);
          const DealerMargCalc = model.DealerMargCalc ?? "NDP";

          if (!ccValue) return returnError(req, 422, `CcWatt is zero/missing for model: ${referenceModel}`);
          if (!GST) return returnError(req, 422, `GstPerc is zero/missing for model: ${referenceModel}`);

          const evPricing = pricingComponentsSet.find(p =>
            p.Region === regionCodeStr && p.EngineType === "EV"
          ) || pricing;

          if (!evPricing) return returnError(req, 404, `No pricing components found for region: ${regionCodeStr}`);

          const otherExpenses = ccValue < 500
            ? Number(evPricing.OtExpLt500)
            : Number(evPricing.OtExpGt500);
          const HelmetMargin = Number(evPricing.HelmetMargin);

          const Basic = exshowroom / (1 + GST / 100);
          const GSTAfterbasic = Basic * (GST / 100);

          const DealerCost = reverseSolveDealerCost(
            Basic, otherExpenses, GST, DealerMarginPerc, DealerMargCalc, HelmetMargin
          );
          if (!DealerCost && DealerCost !== 0) {
            return returnError(req, 422, `reverseSolveDealerCost returned invalid value for model: ${referenceModel}`);
          }

          const NDP = DealerCost * (1 + GST / 100);
          const DealerMarigin = DealerMargCalc === "NDP" ? NDP * (DealerMarginPerc / 100) : 0;
          const NSP = DealerCost - Number(evPricing.Helmet) - Number(evPricing.Transportation);
          const TotalDealerMargin = DealerMarigin + HelmetMargin;

          const RTOMasterSlabs = RTOMasterSet.filter(r =>
            String(r.RegionCode).padStart(2, '0') === regionCodeStr
          );

          if (!RTOMasterSlabs.length) return returnError(req, 404, `No RTO master slabs for region: ${regionCodeStr}`);

          const rtoMaster = RTOMasterSlabs.find(r =>
            ccValue >= Number(r.CcMin) && ccValue <= Number(r.CcMax) &&
            exshowroom >= Number(r.MinRange) && exshowroom <= Number(r.MaxRange)
          );

          if (!rtoMaster) return returnError(req, 404, `RTO slab not matched for ccValue: ${ccValue}, exshowroom: ${exshowroom}`);

          const RtoPerc = Number(rtoMaster.RtoPercent);

          let Rto;
          if (RtoPerc === 0) {
            Rto = Number(rtoMaster.PriceValue);
          } else {
            Rto = (region.BasisRto === "BASIC" ? Basic : exshowroom) * (RtoPerc / 100);
          }

          const RtoWithBill = calcRtoBill(exshowroom, Rto, regionCodeStr, VariantVariableSet, RtoPerc) ||
            (() => {
              const rtoExp = RTOExpenseSet.find(r =>
                exshowroom >= Number(r.MinRange) && exshowroom <= Number(r.MaxRange)
              );
              return rtoExp ? Number(rtoExp.Expense) : 0;
            })();

          const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
          const Insurance_GST = ccValue <= 350
            ? Number(evPricing.InsuranceLe350)
            : Number(evPricing.InsuranceGt350);
          const Insurance = (0.95 * exshowroom) * Insurance_GST;
          const TpaPa = ccValue <= 350
            ? Number(evPricing.TpaPaLe350)
            : Number(evPricing.TpaPaGt350);
          const ActualGst = (Insurance + TpaPa) * (Insurance_GST_Actual / 100);
          const TotalInsurance = Insurance + TpaPa + ActualGst;
          const OnRoad = exshowroom + Rto + RtoWithBill + TotalInsurance;

          results.push({
            Model: displayModel, OperationNo: 0, SaveInd: "",
            insuranceperc: Insurance_GST,
            Region: regionCodeStr, MtoMts: "EV", Basis: region.BasisRto,
            DealerMarginPerc: to2(DealerMarginPerc),
            DealerMarigin: roundToWholeWith00(DealerMarigin),
            InputNsp: to2(model.InputNsp ?? null),
            IncrementalNsp: roundToWholeWith00(model.IncrementalNsp ?? null),
            ActualNsp: roundToWholeWith00(NSP),
            Helmet: to2(Number(evPricing.Helmet)),
            Transportation: to2(Number(evPricing.Transportation)),
            DealerCost: roundToWholeWith00(DealerCost),
            OtherExpenses: to2(otherExpenses),
            BikeMargin: to2(DealerMarigin),
            IncrementDlr: to2(TotalDealerMargin - DealerMarigin),
            ActualDealerMargin: to2(TotalDealerMargin),
            HelmetMargin: to2(HelmetMargin),
            TotalDealerMargin: to2(TotalDealerMargin),
            Ndp: roundToWholeWith00(NDP),
            Basic: roundToWholeWith00(Basic),
            Gst: to0(GST),
            GSTAfterbasic: roundToWholeWith00(GSTAfterbasic),
            InputExShowroom: to2(model.InputExShowroom ?? null),
            ActualExShowroom: roundToWholeWith00(exshowroom),
            Diff: to2(exshowroom - (model.InputExShowroom ?? 0)),
            ExceptionRef: "E",
            RtoPerc: to0(RtoPerc),
            Rto: roundToWholeWith00(Rto),
            RtoWithBill: roundToWholeWith00(RtoWithBill),
            InsuranceLe350: to6(Number(evPricing.InsuranceLe350)),
            InsuranceGt350: to6(Number(evPricing.InsuranceGt350)),
            Insurance: roundToWholeWith00(Insurance),
            TpaPa: roundToWholeWith00(TpaPa),
            ActualGst: roundToWholeWith00(ActualGst),
            TotalInsurance: roundToWholeWith00(TotalInsurance),
            OnRoad: roundToWholeWith00(OnRoad),
            ReferenceNum: ""
          });
        }
        return results;
      }

      else {
        return req.error(400, `Unknown MTOStatus value: "${MTOStatus}". Expected: MTO, EV, GeM, or CSD.`);
      }

    } catch (e) {
      console.error(e);
      return req.error(500, e.message);
    }
  });


  // ── processCalculation ────────────────────────────────────────────────────

  this.on('processCalculation', async (req) => {
    try {
      const { items, regionCode, Mail, MTOStatus } = req.data;

      if (!Mail) return req.error(400, "Mail is mandatory");
      if (!regionCode) return req.error(400, "regionCode is mandatory");
      if (!Array.isArray(items) || !items.length) return req.error(400, "No items provided");

      // ── MTO Branch ────────────────────────────────────────────────────────

      for (const item of items) {
        if (MTOStatus === "MTO") {
          const [
            regionMasterRaw,
            modelMasterRaw,
            pricingComponentsSetRaw,
            RTOMasterSetRaw,
            RTOExpenseSetRaw,
            GMAComponentsSetRaw,
            ModelPriceBreakupSetRaw,
            PartsSetRaw,
            VariantVariableSetRaw,
            SubmissionReferenceSetRaw
          ] = await Promise.all([
            backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
            backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
            backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
            backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
            backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
            backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
            backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
            backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
            backendconnect.run(SELECT.from('VariantVariableSet')),
            backendconnect.run(SELECT.from('SubmissionReferenceSet'))
          ]);

          const regionMaster = getLatestPerKey(regionMasterRaw, r => r.Region);
          const modelMaster = getLatestPerKey(modelMasterRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`);
          const pricingComponentsSet = getLatestPerKey(pricingComponentsSetRaw, p => `${p.Region}|${p.EngineType}`);
          const RTOMasterSet = getLatestPerKey(RTOMasterSetRaw, r => String(r.RegionCode).padStart(3, '0') + "|" + r.Slab);
          const RTOExpenseSet = getLatestPerKey(RTOExpenseSetRaw, r => `${r.RegionCode}|${r.Slab}`);
          const GMAComponentsSet = getLatestPerKey(GMAComponentsSetRaw, g => g.Models);
          const PartsSet = getLatestPerKey(PartsSetRaw, p => p.PartCode);
          const VariantVariableSet = VariantVariableSetRaw;
          const ModelPriceBreakupSet = ModelPriceBreakupSetRaw;
          const SubmissionReferenceSet = SubmissionReferenceSetRaw;

          const rCodeStr = regionCode;
          const regionCodeStr = rCodeStr;

          const region = regionMaster.find(r => r.Region === rCodeStr);
          if (!region) return req.error(404, `Region ${rCodeStr} not found`);

          const pricing = pricingComponentsSet.find(p => p.Region === rCodeStr && p.EngineType === "ICE");
          if (!pricing) return req.error(404, `Pricing components missing for region: ${rCodeStr} / ICE`);

          const aModelFilter = items.map(i => String(i.ModelCode || "").trim()).filter(Boolean);

          const approvedRefs = SubmissionReferenceSet
            .filter(s => s.Status === "APPROVED")
            .map(s => s.ReferenceNum);

          const approvedBreakups = ModelPriceBreakupSet
            .filter(b => approvedRefs.includes(b.ReferenceNum));

          const specialRegions = ["026", "002", "015", "02"];

          const RTOExpenseSetICE = RTOExpenseSetRaw.filter(row => row.EngineType === 'ICE');

          const getRTOExpenseSlabs = (regionStr) =>
            RTOExpenseSetICE.filter(m =>
              String(Number(m.RegionCode)).padStart(3, '0') === regionStr.padStart(3, '0')
            );

          const getRTOMasterSlabs = (regionStr) =>
            RTOMasterSet.filter(m =>
              String(Number(m.RegionCode)) === String(Number(regionStr))
            );

          let mtoGMAList = GMAComponentsSet.filter(g => g.MtsMto === "MTO");
          if (aModelFilter.length) {
            mtoGMAList = mtoGMAList.filter(g =>
              aModelFilter.includes(g.Models) || aModelFilter.includes(g.ReferMtsModel)
            );
          }
          if (!mtoGMAList.length) return req.error(404, "No MTO GMA records found for the selected models");

          const results = [];

          for (const gma of mtoGMAList) {
            const referenceModel = gma.ReferMtsModel;
            const displayModel = gma.Models;

            const inputItem = items.find(item => item.ModelCode === displayModel);

            const nspFromPayload = inputItem ? parseFloat(inputItem.nspValue) : 0;
            const actualNsp = nspFromPayload;
            const inputNspProvided = actualNsp != null && !isNaN(actualNsp) && actualNsp > 0;

            if (!referenceModel) {
              results.push({ Model: displayModel, Region: rCodeStr, success: false, error: `GMA entry missing ReferMtsModel` });
              continue;
            }

            const mtsRecord = approvedBreakups.find(
              m => m.Model === referenceModel && m.MtoMts === "MTS" && m.Region === rCodeStr
            );

            console.log("MTS Record approved: ", mtsRecord);

            if (!mtsRecord) {
              console.warn(`No APPROVED MTS record for reference model: ${referenceModel} — skipping`);
              continue;
            }

            const exshowroomRaw = Number(mtsRecord.ActualExShowroom);
            if (!exshowroomRaw) {
              console.warn(`ActualExShowroom is zero/missing for model: ${referenceModel} — skipping`);
              continue;
            }

            const model = modelMaster.find(m => m.ModelCode === referenceModel);
            if (!model) {
              console.warn(`Model master missing for: ${referenceModel} — skipping`);
              continue;
            }

            const ccValue = Number(model.CcWatt);
            const GST = Number(model.GstPerc);
            const DealerMarginPerc = Number(model.DealerMargin);
            const DealerMargCalc = model.DealerMargCalc ?? "NDP";

            if (!ccValue) { console.warn(`CcWatt zero/missing for: ${referenceModel}`); continue; }
            if (!GST) { console.warn(`GstPerc zero/missing for: ${referenceModel}`); continue; }

            const otherExpenses = ccValue < 500 ? Number(pricing.OtExpLt500) : Number(pricing.OtExpGt500);
            const HelmetMargin = Number(pricing.HelmetMargin) || 292;
            const GST_FACTOR = 1 + GST / 100;
            const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
            const insurance = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);

            const MTS_NSP = Number(mtsRecord.ActualNsp);
            const MTS_Helmet = Number(pricing.Helmet) || 1279;
            const MTS_Transport = Number(pricing.Transportation);
            const MTSExshowroom = exshowroomRaw;
            const MTS_TpaPa = Number(mtsRecord.TpaPa ?? 0);
            const MTS_RtoPerc = parseFloat(mtsRecord.RtoPerc ?? 0);

            const MTS_TotalDealerMargin_Base = Number(mtsRecord.BikeMargin) + HelmetMargin;
            const MTS_DealerCost_Calc = MTS_NSP + MTS_Helmet + MTS_Transport;
            const MTS_Basic_Calc = Math.round(MTS_DealerCost_Calc + otherExpenses + MTS_TotalDealerMargin_Base);
            const MTS_GSTAmount_Calc = Math.round(MTS_Basic_Calc * (GST / 100));
            const MTS_ExShowroom_Calc = MTS_Basic_Calc + MTS_GSTAmount_Calc;

            const getMTORtoPerc = (basic, exShow) => {
              const slabs = getRTOMasterSlabs(rCodeStr);
              const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;
              const match = slabs.find(m =>
                ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
                priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
              );
              return { match, rtoPerc: match ? Number(match.RtoPercent) : 0 };
            };

            const resolveRtoWithBill = (exShow, rto, rtoExpSlabs, basic) => {
              const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;
              const match = rtoExpSlabs.find(m =>
                priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
              );
              if (variantPercentEntry && variantAmountEntry) {
                return (rto * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
              } else if (!match) {
                const { rtoPerc: mtoRtoPerc } = getMTORtoPerc(
                  region.BasisRto === "BASIC" ? MTO_Basic : exShow,
                  exShow
                );
                return calcRtoBill(exShow, rto, regionCodeStr, VariantVariableSet, mtoRtoPerc);
              } else {
                return Number(match.Expense);
              }
            };

            const resolveRto = (rtoExpSlabs, basic, exShow) => {
              const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;
              if (specialRegions.includes(regionCodeStr)) {
                const RTOMasterSlabs = getRTOMasterSlabs(rCodeStr);
                if (!RTOMasterSlabs.length) return null;
                const slabMatch = RTOMasterSlabs.find(m =>
                  ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
                  priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
                );
                if (!slabMatch) return 0;
                const rtoPerc = Number(slabMatch.RtoPercent);
                return rtoPerc > 0
                  ? Math.round((region.BasisRto === "BASIC" ? basic : exShow) * (rtoPerc / 100))
                  : Number(slabMatch.PriceValue);
              }
              const { match, rtoPerc } = getMTORtoPerc(basic, exShow);
              if (!match) return 0;
              const priceBase = region.BasisRto === "BASIC" ? basic : exShow;
              return rtoPerc > 0
                ? Math.round(priceBase * (rtoPerc / 100))
                : Number(match.PriceValue);
            };

            const resolveRtoFull = (basic, exShow) => {
              const { match, rtoPerc } = getMTORtoPerc(basic, exShow);
              if (!match) return 0;
              const priceBase = region.BasisRto === "BASIC" ? basic : exShow;
              return rtoPerc > 0
                ? Math.round(priceBase * (rtoPerc / 100))
                : Number(match.PriceValue);
            };


            // ── Fetch draft breakup (no ReferenceNum) for MTO NSP input scenario ──────
            // let draftBreakup = null;
            // if (inputNspProvided) {
            //   // Draft records have no ReferenceNum (empty string or null)
            //   draftBreakup = ModelPriceBreakupSet.find(b =>
            //     b.Model === displayModel &&
            //     b.Region === rCodeStr &&
            //     b.MtoMts === "MTO" &&
            //     (!b.ReferenceNum || b.ReferenceNum.trim() === "")
            //   );

            //   console.log("Draft data: ",draftBreakup);

            //   if (draftBreakup) {
            //     console.log("Draft breakup found for MTO NSP input:", draftBreakup);
            //   } else {
            //     console.warn(`No draft MTO breakup found for model: ${displayModel}, region: ${rCodeStr}`);
            //   }
            // }

            // // ── Extract the 6 display fields from draft breakup ───────────────────────
            // const draftMTSExshowroom   = draftBreakup ? Number(draftBreakup.MtsExshwroom   ?? 0) : null;
            // const draftMiyExshowroom   = draftBreakup ? Number(draftBreakup.MiyExshowroom ?? 0) : null;
            // const draftExpExshowroom   = draftBreakup ? Number(draftBreakup.ExpExshowroom ?? 0) : null;
            // const draftMTSOnRoad       = draftBreakup ? Number(draftBreakup.MtsOnRoad        ?? 0) : null;
            // const draftMiyOnRoad       = draftBreakup ? Number(draftBreakup.MiyOnroad   ?? 0) : null;
            // const draftExpOnRoad       = draftBreakup ? Number(draftBreakup.ExpOnroad ?? 0) : null;

            const RTOExpenseSlabs = getRTOExpenseSlabs(rCodeStr);
            const regionPrefix = rCodeStr.padStart(3, '0');
            const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
            const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

            // ── MTS OnRoad recalc ──────────────────────────────────────────────
            const MTS_Rto_Stored = resolveRtoFull(MTS_Basic_Calc, MTSExshowroom);
            const MTS_RtoWithBill_Stored = resolveRtoWithBill(MTSExshowroom, MTS_Rto_Stored, RTOExpenseSlabs, MTS_Basic_Calc);
            const MTS_Insurance_Stored = Math.round((0.95 * MTSExshowroom) * insurance);
            const MTS_GST_Ins_Stored = Math.round((MTS_Insurance_Stored + MTS_TpaPa) * (Insurance_GST_Actual / 100));
            const MTS_TotalIns_Stored = MTS_Insurance_Stored + MTS_TpaPa + MTS_GST_Ins_Stored;

            // ── KEY: Store MTS OnRoad before any MTO computation ──────────────
            const MTS_OnRoad_Calculated = MTSExshowroom + MTS_Rto_Stored + MTS_RtoWithBill_Stored + MTS_TotalIns_Stored;

            console.log("MTS OnRoad (stored baseline):", MTS_OnRoad_Calculated);
            console.log(Number(mtsRecord.OnRoad));

            // ── Parts classification ───────────────────────────────────────────
            let miyExShowroomTotal = 0;
            let miyGmaCostTotal = 0;
            let miyMarkupTotal = 0;
            let miyBreakup = [];
            let exShowroomRunning = exshowroomRaw;

            for (let i = 0; i <= 20; i++) {
              const pCode = gma[`Part${i}`];
              if (!pCode) continue;
              const part = PartsSet.find(p => p.PartCode === pCode);
              if (!part) { console.warn(`PartCode ${pCode} not found — skipping`); continue; }
              if (!["EX SHOWROOM", "ON ROAD"].includes(part.ExShowOnRoad)) continue;

              const miyCost = Number(part.MiyCost || 0);
              const miyMarkup = Number(part.MiyMarkup || 0);
              const partPrice = miyCost + miyMarkup;

              if (part.ExShowOnRoad === "EX SHOWROOM") {
                const before = exShowroomRunning;
                exShowroomRunning += miyCost;
                miyExShowroomTotal += miyCost;
                miyBreakup.push({
                  PartCode: part.PartCode, Description: part.PartDescr,
                  ExShowOnRoad: "EX SHOWROOM",
                  MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                  ExShowroomBefore: to2(before), ExShowroomAfter: to2(exShowroomRunning)
                });
              } else {
                miyGmaCostTotal += miyCost;
                miyMarkupTotal += miyMarkup;
                miyBreakup.push({
                  PartCode: part.PartCode, Description: part.PartDescr,
                  ExShowOnRoad: "ON ROAD",
                  MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                  ExShowroomBefore: null, ExShowroomAfter: null
                });
              }
            }

            const miyOnRoadTotal = miyGmaCostTotal;

            // ── MTO working variables ──────────────────────────────────────────
            let MTO_NSP = inputNspProvided ? actualNsp : MTS_NSP;
            let MTO_DealerCost = 0;
            let MTO_NDP = 0;
            let MTO_Basic = 0;
            let MTO_GSTAmount = 0;
            // let MTO_ExShowroom = exshowroomRaw;
            let MTO_ExShowroom = 0;

            if (inputNspProvided) {
              MTO_ExShowroom
            }
            else {
              MTO_ExShowroom = exshowroomRaw;
            }

            let MTO_Rto = 0;
            let MTO_RtoWithBill = 0;
            let MTO_Insurance = 0;
            let MTO_TpaPa = MTS_TpaPa;
            let MTO_GST_Insurance = 0;
            let MTO_TotalInsurance = 0;
            let MTO_OnRoad_Final = 0;
            let MTO_DealerMargin = Number(mtsRecord.BikeMargin);
            let targetOnRoad = 0;

            const MTO_ActualDealerMargin = MTO_DealerMargin + miyMarkupTotal;
            const MTO_TotalDealerMargin = MTO_DealerMargin + miyMarkupTotal + HelmetMargin;


            // ── GENERIC NSP INPUT HANDLER ─────────────────────────────────────────────
            // When NSP is directly provided, forward-calculate everything fresh.
            // This runs for ALL scenarios (no GMA, EX SHOWROOM only, ON ROAD only, both).
            if (inputNspProvided) {

              // ── Draft breakup is MANDATORY when NSP is provided ──────────────────
              const draftBreakup = ModelPriceBreakupSet.find(b =>
                b.Model === displayModel &&
                b.Region === rCodeStr &&
                b.MtoMts === "MTO" &&
                (!b.ReferenceNum || b.ReferenceNum.trim() === "")
              );

              if (!draftBreakup) {
                console.warn(`No draft MTO breakup found for model: ${displayModel}, region: ${rCodeStr} — skipping`);
                results.push({
                  Model: displayModel,
                  Region: rCodeStr,
                  success: false,
                  error: `Draft breakup missing for model: ${displayModel}`
                });
                continue;
              }

              console.log("Draft breakup found:", draftBreakup);

              // ── 6 display fields — always from draft ─────────────────────────────
              const draftMTSExshowroom = Number(draftBreakup.MtsExshwroom ?? 0);
              const draftMiyExshowroom = Number(draftBreakup.MiyExshowroom ?? 0);
              const draftExpExshowroom = Number(draftBreakup.ExpExshowroom ?? 0);
              const draftMTSOnRoad = Number(draftBreakup.MtsOnRoad ?? 0);
              const draftMiyOnRoad = Number(draftBreakup.MiyOnroad ?? 0);
              const draftExpOnRoad = Number(draftBreakup.ExpOnroad ?? 0);

              // ── Core pricing — forward calculated from given NSP ─────────────────
              MTO_NSP = actualNsp;
              MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

              const { rtoPerc: _rtoPerc } = getMTORtoPerc(MTO_Basic, MTO_ExShowroom);
              MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
              MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
              MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
              MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
              MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
              MTO_OnRoad_Final = Math.round(MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance);

              const IncrementalNsp = MTO_NSP - MTS_NSP;

              results.push({
                Model: displayModel,
                ReferModel: referenceModel,
                OperationNo: 0,
                SaveInd: "X",
                Mail: gma.Mail ?? mtsRecord.Mail ?? "",
                AsmName: gma.AsmName ?? mtsRecord.AsmName ?? "",
                Region: rCodeStr,
                MtoMts: "MTO",
                Basis: region.BasisRto,
                ReferenceNum: mtsRecord.ReferenceNum ?? "",
                insuranceperc: to6(insurance),

                InputNsp: to2(MTS_NSP),
                IncrementalNsp: roundToWholeWith00(IncrementalNsp),
                ActualNsp: roundToWholeWith00(MTO_NSP),

                Helmet: to2(MTS_Helmet),
                Transportation: to2(MTS_Transport),
                DealerCost: roundToWholeWith00(MTO_DealerCost),
                OtherExpenses: to2(otherExpenses),
                BikeMargin: roundToWholeWith00(MTO_DealerMargin),
                DealerMarginPerc: to2(DealerMarginPerc),
                IncrementDlr: to2(miyMarkupTotal),
                ActualDealerMargin: roundToWholeWith00(MTO_ActualDealerMargin),
                HelmetMargin: to2(HelmetMargin),
                TotalDealerMargin: roundToWholeWith00(MTO_TotalDealerMargin),

                Ndp: roundToWholeWith00(MTO_NDP),
                Basic: roundToWholeWith00(MTO_Basic),
                Gst: to0(GST),
                GSTAfterbasic: roundToWholeWith00(MTO_GSTAmount),
                ActualExShowroom: roundToWholeWith00(MTO_ExShowroom),
                InputExShowroom: to2(model.InputExShowroom ?? null),
                Diff: to2(0),
                GstPerc: to0(GST),
                ExceptionRef: mtsRecord.ExceptionRef ?? "E",

                RtoPerc: to2(_rtoPerc),
                Rto: roundToWholeWith00(MTO_Rto),
                RtoWithBill: roundToWholeWith00(MTO_RtoWithBill),

                InsuranceLe350: to6(Number(pricing.InsuranceLe350)),
                InsuranceGt350: to6(Number(pricing.InsuranceGt350)),
                Insurance: roundToWholeWith00(MTO_Insurance),
                TpaPa: roundToWholeWith00(MTO_TpaPa),
                ActualGst: roundToWholeWith00(MTO_GST_Insurance),
                TotalInsurance: roundToWholeWith00(MTO_TotalInsurance),

                OnRoad: roundToWholeWith00(MTO_OnRoad_Final),
                MTOOnRoad: roundToWholeWith00(MTO_OnRoad_Final - miyOnRoadTotal),

                MTSExshowroom: roundToWholeWith00(draftMTSExshowroom),
                MTOExshowroomafterGMA: roundToWholeWith00(draftExpExshowroom),
                MiyExShowroomTotal: to2(draftMiyExshowroom),
                MiyOnRoadTotal: roundToWholeWith00(draftMiyOnRoad),
                MTSOnRoad: roundToWholeWith00(draftMTSOnRoad),
                ExpectedOnRoad: roundToWholeWith00(draftExpOnRoad),

                MTO_NSP: roundToWholeWith00(MTO_NSP),
                MiyBreakup: miyBreakup,
                MTO_Exshowroom: roundToWholeWith00(MTO_ExShowroom),
              });

              continue; // skip all goal-seek branches below
            }
            // ── STEP 2: ExShowroom solver ──────────────────────────────────────
            // Only needed when back-calculating NSP from target exshowroom (no direct NSP input)
            if (miyExShowroomTotal > 0 && !inputNspProvided) {
              const targetExshowroom = exShowroomRunning;
              let calculatedExshowroom = exshowroomRaw;
              let iteration = 0;

              while (Math.abs(calculatedExshowroom - targetExshowroom) > 1) {
                if (++iteration > 50000) { console.warn("❌ Max iterations reached in ExShowroom solver"); break; }
                if (calculatedExshowroom < targetExshowroom) { MTO_NSP += 1; } else { MTO_NSP -= 1; }
                MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
                MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
                MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
                MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
                calculatedExshowroom = MTO_Basic + MTO_GSTAmount;
              }
              MTO_ExShowroom = calculatedExshowroom;
            }

            const MTOExshowroomafterGMA = MTSExshowroom + miyExShowroomTotal;

            // ── STEP 3: Forward calculation from MTO_NSP (given or solved) ────
            MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
            MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
            MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
            MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
            // MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

            if (miyExShowroomTotal > 0) {
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
            }

            else {
              MTO_ExShowroom
            }

            const { rtoPerc: MTO_RtoPercCalc } = getMTORtoPerc(MTO_Basic, MTO_ExShowroom);
            MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
            MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
            MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
            MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
            MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
            MTO_OnRoad_Final = Math.round(MTO_ExShowroom) + Math.round(MTO_Rto) + Math.round(MTO_RtoWithBill) + Math.round(MTO_TotalInsurance);

            // ── STEP 4a: S4 — ON ROAD parts only ─────────────────────────────
            if (miyOnRoadTotal > 0 && miyExShowroomTotal === 0) {
              if (inputNspProvided) {

                //      MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

                //     console.log("revised MTO: ", MTO_ExShowroom);


                //     const { rtoPerc: MTO_RtoPercCalc } = getMTORtoPerc(MTO_Basic, MTO_ExShowroom);
                // MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
                // MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
                // MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
                // MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
                // MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
                //  MTO_OnRoad_Final = Math.round(MTO_ExShowroom) + Math.round(MTO_Rto) + Math.round(MTO_RtoWithBill) + Math.round(MTO_TotalInsurance);



                // NSP directly given — forward calculate from Step 3 is already done.
                // Add GMA on-road cost on top of the NSP-driven OnRoad.
                MTO_OnRoad_Final = Math.round(MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance) + miyOnRoadTotal;
              } else {
                // Goal seek: find NSP that makes OnRoad = MTS_OnRoad_Calculated + GMA on-road cost
                targetOnRoad = Math.round(MTS_OnRoad_Calculated + miyGmaCostTotal);
                let currentNSP = MTO_NSP;
                let calcOnRoad = MTO_OnRoad_Final;
                let iteration2 = 0;

                while (Math.abs(calcOnRoad - targetOnRoad) > 1) {
                  if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in S4 solver"); break; }
                  if (calcOnRoad < targetOnRoad) { currentNSP += 1; } else { currentNSP -= 1; }
                  MTO_DealerCost = currentNSP + MTS_Helmet + MTS_Transport;
                  MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
                  MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
                  MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
                  MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
                  MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
                  MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
                  MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
                  MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
                  MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
                  calcOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
                }
                MTO_NSP = currentNSP;
                MTO_OnRoad_Final = calcOnRoad;
              }
            }

            // ── STEP 4b: S2/S3 — both EX SHOWROOM and ON ROAD parts ──────────
            if (miyOnRoadTotal > 0 && miyExShowroomTotal > 0) {
              if (inputNspProvided) {
                // ── NSP given: forward calc already done in Step 3 ────────────
                // MTO_ExShowroom, MTO_Rto, MTO_RtoWithBill, MTO_TotalInsurance
                // are all computed from the given NSP in Step 3.
                //
                // Do NOT add miyOnRoadTotal on top — the provided NSP already
                // encodes the full MTO pricing premium.  The GMA on-road cost is
                // tracked separately for display/diff purposes only.
                //
                // MTO_OnRoad_Final stays exactly as computed in Step 3.
                console.log(`inputNspProvided S2/S3: NSP=${MTO_NSP}, ExShow=${MTO_ExShowroom}, OnRoad=${MTO_OnRoad_Final}, GMAOnRoad=${miyOnRoadTotal} (NOT added — NSP already encodes premium)`);

              } else {
                // ── Goal seek: find NSP so OnRoad = MTS_OnRoad_Calculated + GMA cost ──
                targetOnRoad = Math.round(MTS_OnRoad_Calculated + miyGmaCostTotal);

                let currentNSP = MTS_NSP; // always reset to MTS_NSP baseline
                let _dc = currentNSP + MTS_Helmet + MTS_Transport;
                let _basic = Math.round(_dc + otherExpenses + MTO_TotalDealerMargin);
                let _gst = Math.round(_basic * (GST / 100));
                let _exShow = _basic + _gst;
                let _rto = resolveRtoFull(_basic, _exShow);
                let _rtoWithBill = resolveRtoWithBill(_exShow, _rto, RTOExpenseSlabs, _basic);
                let _ins = Math.round((0.95 * _exShow) * insurance);
                let _gstIns = Math.round((_ins + MTO_TpaPa) * (Insurance_GST_Actual / 100));
                let _totalIns = _ins + MTO_TpaPa + _gstIns;
                let calcOnRoad = _exShow + _rto + _rtoWithBill + _totalIns;

                let iteration2 = 0;
                while (Math.abs(calcOnRoad - targetOnRoad) > 1) {
                  if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in OnRoad solver S2/S3"); break; }
                  if (calcOnRoad < targetOnRoad) { currentNSP += 1; } else { currentNSP -= 1; }
                  MTO_DealerCost = currentNSP + MTS_Helmet + MTS_Transport;
                  MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
                  MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
                  MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
                  MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
                  const rto23 = resolveRto(RTOExpenseSlabs, MTO_Basic, MTO_ExShowroom);
                  if (rto23 === null) break;
                  MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
                  MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
                  MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
                  MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
                  MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
                  calcOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
                }
                MTO_NSP = currentNSP;
                MTO_OnRoad_Final = calcOnRoad;
                console.log(`S2/S3 solver converged: iterations=${iteration2}, NSP=${MTO_NSP}, OnRoad=${MTO_OnRoad_Final}`);
              }
            }

            // ── No GMA at all — use stored MTS values directly ────────────────
            if (miyOnRoadTotal === 0 && miyExShowroomTotal === 0) {
              MTO_ExShowroom = Number(mtsRecord.ActualExShowroom);
              MTO_Rto = Number(mtsRecord.Rto);
              MTO_RtoWithBill = Number(mtsRecord.RtoWithBill);
              MTO_Insurance = Number(mtsRecord.Insurance);
              MTO_TpaPa = Number(mtsRecord.TpaPa ?? 0);
              MTO_GST_Insurance = Number(mtsRecord.ActualGst);
              MTO_TotalInsurance = Number(mtsRecord.TotalInsurance);
              MTO_OnRoad_Final = Number(mtsRecord.OnRoad);
            }

            // ── STEP 5: Build result ───────────────────────────────────────────
            const IncrementalNsp = MTO_NSP - MTS_NSP;

            // ── ExpectedOnRoad: what we expect MTO OnRoad to be ───────────────
            // When NSP is provided: trust the forward calc (MTO_OnRoad_Final from Step 3).
            // When goal-seeking:    MTS OnRoad + GMA on-road cost is the target.
            const ExpectedOnRoad_Calc = inputNspProvided
              ? MTO_OnRoad_Final
              : Math.round(MTS_OnRoad_Calculated + miyGmaCostTotal);

            let baseOnRoad = targetOnRoad;
            if (baseOnRoad === 0) {
              baseOnRoad = MTO_OnRoad_Final;
            }

            console.log('Base on road: ', baseOnRoad);

            results.push({
              Model: displayModel,
              ReferModel: referenceModel,
              OperationNo: 0,
              SaveInd: "X",
              Mail: gma.Mail ?? mtsRecord.Mail ?? "",
              AsmName: gma.AsmName ?? mtsRecord.AsmName ?? "",
              Region: rCodeStr,
              MtoMts: "MTO",
              Basis: region.BasisRto,
              ReferenceNum: mtsRecord.ReferenceNum ?? "",
              insuranceperc: to6(insurance),

              InputNsp: to2(MTS_NSP),
              IncrementalNsp: roundToWholeWith00(IncrementalNsp),
              ActualNsp: roundToWholeWith00(MTS_NSP),

              Helmet: to2(MTS_Helmet),
              Transportation: to2(MTS_Transport),
              DealerCost: roundToWholeWith00(MTO_DealerCost),
              OtherExpenses: to2(otherExpenses),
              BikeMargin: roundToWholeWith00(MTO_DealerMargin),
              DealerMarginPerc: to2(DealerMarginPerc),
              IncrementDlr: to2(miyMarkupTotal),
              ActualDealerMargin: roundToWholeWith00(MTO_ActualDealerMargin),
              HelmetMargin: to2(HelmetMargin),
              TotalDealerMargin: roundToWholeWith00(MTO_TotalDealerMargin),

              Ndp: roundToWholeWith00(MTO_NDP),
              Basic: roundToWholeWith00(MTO_Basic),
              Gst: to0(GST),
              GSTAfterbasic: roundToWholeWith00(MTO_GSTAmount),
              ActualExShowroom: roundToWholeWith00(MTO_ExShowroom),
              InputExShowroom: to2(model.InputExShowroom ?? null),
              Diff: to2(0),
              GstPerc: to0(GST),
              ExceptionRef: mtsRecord.ExceptionRef ?? "E",

              RtoPerc: to2(MTO_RtoPercCalc),
              Rto: roundToWholeWith00(MTO_Rto),
              RtoWithBill: roundToWholeWith00(MTO_RtoWithBill),

              InsuranceLe350: to6(Number(pricing.InsuranceLe350)),
              InsuranceGt350: to6(Number(pricing.InsuranceGt350)),
              Insurance: roundToWholeWith00(MTO_Insurance),
              TpaPa: roundToWholeWith00(MTO_TpaPa),
              ActualGst: roundToWholeWith00(MTO_GST_Insurance),
              TotalInsurance: roundToWholeWith00(MTO_TotalInsurance),

              OnRoad: roundToWholeWith00(MTO_OnRoad_Final),
              // MTOOnRoad: pure MTO vehicle OnRoad (without GMA on-road addon)
              MTOOnRoad: roundToWholeWith00(MTO_OnRoad_Final - miyOnRoadTotal),
              // MTSOnRoad: the MTS baseline OnRoad (stored before any MTO computation)
              // MTSOnRoad: roundToWholeWith00(MTS_OnRoad_Calculated),
              // MTSOnRoad: roundToWholeWith00(targetOnRoad - miyOnRoadTotal),
              // ExpectedOnRoad: roundToWholeWith00(targetOnRoad),

              // MTSOnRoad: roundToWholeWith00(baseOnRoad - miyOnRoadTotal),
              MTSOnRoad: (inputNspProvided && draftMTSOnRoad !== null) ? roundToWholeWith00(draftMTSOnRoad) : roundToWholeWith00(baseOnRoad - miyOnRoadTotal),
              // ExpectedOnRoad: roundToWholeWith00(baseOnRoad),
              ExpectedOnRoad: (inputNspProvided && draftExpOnRoad !== null) ? roundToWholeWith00(draftExpOnRoad) : roundToWholeWith00(baseOnRoad),
              MTO_NSP: roundToWholeWith00(MTO_NSP),

              // MiyExShowroomTotal: to2(miyExShowroomTotal),
              MiyExShowroomTotal: (inputNspProvided && draftMiyExshowroom !== null) ? to2(draftMiyExshowroom) : to2(miyExShowroomTotal),
              // MiyOnRoadTotal: to2(miyOnRoadTotal),
              MiyOnRoadTotal: (inputNspProvided && draftMiyOnRoad !== null) ? roundToWholeWith00(draftMiyOnRoad) : to2(miyOnRoadTotal),
              MiyBreakup: miyBreakup,

              // MTSExshowroom: roundToWholeWith00(MTSExshowroom),
              MTSExshowroom: (inputNspProvided && draftMTSExshowroom !== null) ? roundToWholeWith00(draftMTSExshowroom) : roundToWholeWith00(MTSExshowroom),
              // MTOExshowroomafterGMA: roundToWholeWith00(MTSExshowroom + miyExShowroomTotal),
              MTOExshowroomafterGMA: (inputNspProvided && draftExpExshowroom !== null) ? roundToWholeWith00(draftExpExshowroom) : roundToWholeWith00(MTSExshowroom + miyExShowroomTotal),
              MTO_Exshowroom: roundToWholeWith00(MTO_ExShowroom),
            });
          }

          return results;
        }

      }
      // ── END MTO Branch ────────────────────────────────────────────────────

      const rCodeStr = String(regionCode).padStart(3, '0');

      const [
        regionMasterRaw,
        modelMasterRaw,
        pricingComponentRaw,
        RtoMasterSetRaw,
        RTOExpenseSetRaw,
        VariantVariableSet
      ] = await Promise.all([
        backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
        backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
        backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
        backendconnect.run(SELECT.from('VariantVariableSet'))
      ]);

      const regionMaster = getLatestPerKey(regionMasterRaw, r => r.Region);
      const modelMaster = getLatestPerKey(modelMasterRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`);
      const pricingComponent = getLatestPerKey(pricingComponentRaw, p => `${p.Region}|${p.EngineType}`);
      const RtoMasterSet = getLatestPerKey(RtoMasterSetRaw, r => `${r.RegionCode}|${r.Slab}`);
      const RTOExpenseSet = getLatestPerKey(RTOExpenseSetRaw, r => `${r.RegionCode}|${r.Slab}`);

      const region = regionMaster.find(r => r.Region === rCodeStr);
      if (!region) return req.error(404, `Region ${rCodeStr} not found`);

      const RTOMaster = RtoMasterSet.find(m => String(m.RegionCode).padStart(3, '0') === rCodeStr);
      if (!RTOMaster) return req.error(404, `No RTO master for region ${rCodeStr}`);

      // const RTOExpense = RTOExpenseSet.find(m => String(m.RegionCode).padStart(3, '0') === rCodeStr);
      // if (!RTOExpense) return req.error(404, `No RTO expense for region ${rCodeStr}`);

      const pricingComponents = pricingComponent.find(p => p.Region === rCodeStr);
      if (!pricingComponents) return req.error(404, `No pricing for region ${rCodeStr}`);

      const results = [];

      for (const item of items) {
        const ModelCode = String(item.ModelCode || "").trim();
        if (!ModelCode) {
          results.push({ Region: rCodeStr, success: false, error: "ModelCode is mandatory" });
          continue;
        }

        const hasNSP = item.nspValue != null && item.nspValue !== "" && Number(item.nspValue) > 0;
        const hasExShowroom = item.exshowroomPrice != null && item.exshowroomPrice !== "" && Number(item.exshowroomPrice) > 0;
        if (!hasNSP && !hasExShowroom) {
          results.push({
            Model: ModelCode,
            Region: rCodeStr,
            success: false,
            error: "No price provided"
          });
          continue;
        }

        const model = modelMaster.find(m => m.ModelCode === ModelCode);
        if (!model) {
          results.push({
            Model: ModelCode,
            Region: rCodeStr,
            success: false,
            error: `Model ${ModelCode} not found`
          });
          continue;
        }

        const ccValue = Number(model.CcWatt);
        const GST = Number(model.GstPerc);
        const DealerMarginPerc = Number(model.DealerMargin);
        const DealerMargCalc = model.DealerMargCalc ?? "NDP";
        const Helmet = Number(pricingComponents.Helmet) || 1279;
        const Transportation = Number(pricingComponents.Transportation);
        const HelmetMarigin = Number(pricingComponents.HelmetMargin) || 292;
        const otherExpensesValue = ccValue < 500
          ? Number(pricingComponents.OtExpLt500)
          : Number(pricingComponents.OtExpGt500);

        const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
        const insurance_GST = ccValue <= 350
          ? Number(pricingComponents.InsuranceLe350)
          : Number(pricingComponents.InsuranceGt350);
        const TPA_PA = ccValue <= 350
          ? Number(pricingComponents.TpaPaLe350)
          : Number(pricingComponents.TpaPaGt350);

        let result;

        const normalizeRegion = (val) => String(Number(val)).padStart(3, '0');
        const regionCodeStr = normalizeRegion(regionCode);

        if (hasNSP) {
          const DealerCost = Number(item.nspValue) + Helmet + Transportation;
          const NDP = DealerCost * (1 + GST / 100);
          const DealerMarigin = DealerMargCalc === "NDP" ? NDP * (DealerMarginPerc / 100) : 0;
          const totalDealerMarigin = DealerMarigin + HelmetMarigin;
          const Basic = DealerCost + otherExpensesValue + totalDealerMarigin;
          const GSTAfterbasic = Basic * (GST / 100);
          const ex_showroomAfterGST = Basic + GSTAfterbasic;

          const RTOMasterSlabs = RtoMasterSet.filter(
            m => String(m.RegionCode).padStart(3, '0') === rCodeStr
          );

          const RTOExpenseSlabs = RTOExpenseSet.filter(
            m => String(m.RegionCode).padStart(3, '0') === rCodeStr
          );

          const priceForSlabCheck = region.BasisRto === "BASIC" ? Basic : ex_showroomAfterGST;

          const matchedSlab = RTOMasterSlabs.find(m =>
            ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );

          // const RTO_percentage = matchedSlab ? Number(matchedSlab.RtoPercent) : 0;

          // let RTO;
          // if (regionCode === "026" || regionCode === "002") {
          //   RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          // } else if (!matchedSlab || RTO_percentage === 0) {
          //   RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          // } else {
          //   RTO = priceForSlabCheck * (RTO_percentage / 100);
          // }

          // const matchedExpenseSlab = RTOExpenseSlabs.find(m =>
          //   priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          // );

          // console.log('RTOExpenseSlabs:', RTOExpenseSlabs.length, '| matchedExpenseSlab:', matchedExpenseSlab ?? 'NO MATCH');

          // const regionPrefix = regionCodeStr.padStart(3, '0');
          // const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          // const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // let RTO_bill;
          // if (variantPercentEntry && variantAmountEntry) {
          //   const percent = Number(variantPercentEntry.High);
          //   const fixedAmt = Number(variantAmountEntry.High);
          //   RTO_bill = (RTO * percent / 100) + fixedAmt;
          // } else if (matchedExpenseSlab) {
          //   RTO_bill = Number(matchedExpenseSlab.Expense);
          // } else {
          //   RTO_bill = calcRtoBill(ex_showroomAfterGST, RTO, regionCodeStr, VariantVariableSet, RTO_percentage);
          // }


          const regionPrefix = regionCodeStr.padStart(3, '0');
          const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // ── RTO percentage: variant table takes priority over slab ──
          const RTO_percentage = (matchedSlab ? Number(matchedSlab.RtoPercent) : 0);

          let RTO;
          if (regionCode === "026" || regionCode === "002") {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else if (!matchedSlab || RTO_percentage === 0) {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else {
            RTO = priceForSlabCheck * (RTO_percentage / 100);
          }

          const matchedExpenseSlab = RTOExpenseSlabs.find(m =>
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );

          console.log('RTOExpenseSlabs:', RTOExpenseSlabs.length, '| matchedExpenseSlab:', matchedExpenseSlab ?? 'NO MATCH');

          let RTO_bill;
          if (variantPercentEntry && variantAmountEntry) {
            const percent = Number(variantPercentEntry.High);
            const fixedAmt = Number(variantAmountEntry.High);
            RTO_bill = (RTO * percent / 100) + fixedAmt;
          } else if (matchedExpenseSlab) {
            RTO_bill = Number(matchedExpenseSlab.Expense);
          } else {
            RTO_bill = calcRtoBill(ex_showroomAfterGST, RTO, regionCodeStr, VariantVariableSet, RTO_percentage);
          }
          const insurance_int = (0.95 * ex_showroomAfterGST) * insurance_GST;
          const GST_afterTPA = (TPA_PA + insurance_int) * (Insurance_GST_Actual / 100);
          const TotalInsurance = insurance_int + TPA_PA + GST_afterTPA;
          const OnRoadPrice = ex_showroomAfterGST + RTO + RTO_bill + TotalInsurance;

          const NSP = Number(item.nspValue);

          result = {
            BasisRto: region.BasisRto,
            DealerMarigin: roundToWholeWith00(DealerMarigin),
            Helmet: roundToWholeWith00(Helmet),
            Transportation: to2(Transportation),
            DealerCost: roundToWholeWith00(DealerCost),
            OtherExpenses: to2(otherExpensesValue),
            HelmetMarigin: to2(HelmetMarigin),
            NDP: roundToWholeWith00(NDP),
            totalDealerMarigin: to2(totalDealerMarigin),
            BikeMargin: to2(DealerMarigin),
            Basic: roundToWholeWith00(Basic),
            GSTAfterbasic: roundToWholeWith00(GSTAfterbasic),
            ex_showroomAfterGST: roundToWholeWith00(ex_showroomAfterGST),
            RTO_percentage: to2(RTO_percentage),
            RTO: roundToWholeWith00(RTO),
            RTO_bill: to2(RTO_bill),
            insurance: to2(insurance_int),
            insuranceperc: to6(insurance_GST),
            TPA_PA: to2(TPA_PA),
            GST_afterTPA: to2(GST_afterTPA),
            TotalInsurance: roundToWholeWith00(TotalInsurance),
            OnRoadPrice: roundToWholeWith00(OnRoadPrice),
            DealerMarginPerc: to2(DealerMarginPerc),
            GSTPerc: to0(GST),
            ActualNsp: roundToWholeWith00(NSP),
            InputNSP: to2(NSP),
            CalculatedNSP: to2(NSP),
            IncrementalNSP: roundToWholeWith00(0),
            Model: ModelCode,
            Region: rCodeStr
          };
        }

        //new code 17/08
        //     else if (MTOStatus === "CSD") {
        // const [
        //   modelMasterRaw,
        //   ModelPriceBreakupSetRaw,
        //   VariantVariableSetRaw,
        //   SubmissionReferenceSetRaw
        // ] = await Promise.all([
        //   backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
        //   backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
        //   backendconnect.run(SELECT.from('VariantVariableSet')),
        //   backendconnect.run(SELECT.from('SubmissionReferenceSet'))
        // ]);

        // const modelMaster = getLatestPerKey(modelMasterRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`);
        // const relevantModels = modelMaster; // add status filter here if goProcessing's aAllowedStatuses should also apply
        // const ModelPriceBreakupSet = ModelPriceBreakupSetRaw;
        // const VariantVariableSet = VariantVariableSetRaw;
        // const SubmissionReferenceSet = SubmissionReferenceSetRaw;

        // const rCodeStr = String(Number(regionCode)).padStart(3, '0');
        // const aModelFilter = items.map(i => String(i.ModelCode || "").trim()).filter(Boolean);

        // const approvedRefs = SubmissionReferenceSet
        //   .filter(s => s.Status === "APPROVED")
        //   .map(s => s.ReferenceNum);

        // let regionBreakups = ModelPriceBreakupSet.filter(bp =>
        //   bp.Region === rCodeStr &&
        //   bp.MtoMts === "MTS" &&
        //   approvedRefs.includes(bp.ReferenceNum)
        // );

        // if (aModelFilter.length) {
        //   regionBreakups = regionBreakups.filter(bp => aModelFilter.includes(bp.Model));
        // }

        // if (!regionBreakups.length) {
        //   return req.error(404, `No approved MTS ModelPriceBreakup data found for region: ${rCodeStr}`);
        // }

        // const incidentalEntry = VariantVariableSet.find(v => v.Low === "CSD_INCIDENTAL_PERC");
        // const incidentalRate = incidentalEntry ? Number(incidentalEntry.High) / 100 : 0.01;

        // const csdResults = [];
        // for (const bp of regionBreakups) {
        //   const model = relevantModels.find(m => m.ModelCode === bp.Model);
        //   if (!model) { console.warn(`CSD: model master missing for ${bp.Model}, skipping`); continue; }

        //   const ActualNsp = Number(bp.ActualNsp);
        //   if (!ActualNsp) { console.warn(`CSD: ActualNsp is zero for model ${bp.Model}, skipping`); continue; }

        //   const CsdDisPerc = Number(model.CsdDisPerc || 0);
        //   const GstPerc = Number(model.CsdGstPerc || model.GstPerc || 0);

        //   const Transportation = Number(bp.Transportation || 0);
        //   const OtherExpenses = Number(bp.OtherExpenses || 0);
        //   const TotalDealerMargin = Number(bp.TotalDealerMargin || 0);
        //   const CsdNsp = ActualNsp + Transportation + OtherExpenses + TotalDealerMargin;

        //   const BasicField = Number(bp.Basic || 0);
        //   const Helmet = Number(bp.Helmet || 0);
        //   const HelmetMargin = Number(bp.HelmetMargin || 0);
        //   const BasicPrice = BasicField - Helmet - HelmetMargin;

        //   const DiscountAmount = CsdNsp * (CsdDisPerc / 100);
        //   const PreTaxNetDiscount = BasicPrice - DiscountAmount;
        //   const GstAmount = PreTaxNetDiscount * (GstPerc / 100);
        //   const CsdExShowroom = PreTaxNetDiscount + GstAmount;
        //   const IncidentalCharges = PreTaxNetDiscount * incidentalRate;
        //   const FinalCSDPrice = CsdExShowroom + IncidentalCharges;

        //   const Rto = Number(bp.Rto || 0);
        //   const RtoWithBill = Number(bp.RtoWithBill || 0);
        //   const TotalInsurance = Number(bp.TotalInsurance || 0);
        //   const CsdOnRoad = CsdExShowroom + Rto + RtoWithBill + TotalInsurance;

        //   csdResults.push({
        //     Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
        //     Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
        //     MtoMts: "CSD", Basis: bp.Basis,
        //     DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
        //     InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
        //     Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
        //     OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
        //     ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
        //     TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp, Basic: bp.Basic, Gst: bp.Gst,
        //     InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
        //     RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
        //     InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
        //     Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
        //     TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
        //     ActualExShowroom: bp.ActualExShowroom, Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,

        //     CsdNsp: roundToWholeWith00(CsdNsp),
        //     BasicPriceWO: roundToWholeWith00(BasicPrice),
        //     CsdDisPerc: to2(CsdDisPerc),
        //     CSD: roundToWholeWith00(DiscountAmount),
        //     PreTaxNetDiscount: roundToWholeWith00(PreTaxNetDiscount),
        //     CsdGstPerc: to2(GstPerc),
        //     CsdGstAmount: roundToWholeWith00(GstAmount),
        //     CsdExShowroom: roundToWholeWith00(CsdExShowroom),
        //     IncidentalPerc: to2(incidentalRate * 100),
        //     IncidentalCharges: roundToWholeWith00(IncidentalCharges),
        //     FinalCSDPrice: roundToWholeWith00(FinalCSDPrice),
        //     CsdOnRoad: roundToWholeWith00(CsdOnRoad)
        //   });
        // }
        // return csdResults;

        else if (MTOStatus === "CSD") {
          const approvedRefs = SubmissionReferenceSet
            .filter(s => s.Status === "APPROVED")
            .map(s => s.ReferenceNum);

          // Step 1: approved MTS records only
          let regionBreakups = ModelPriceBreakupSet.filter(bp =>
            bp.Region === regionCodeStr &&
            bp.MtoMts === "MTS" &&
            approvedRefs.includes(bp.ReferenceNum)
          );

          if (aModelFilter) {
            regionBreakups = regionBreakups.filter(bp => aModelFilter.includes(bp.Model));
          }

          if (!regionBreakups.length) {
            return req.error(404, `No approved MTS ModelPriceBreakup data found for region: ${regionCodeStr}`);
          }

          const incidentalEntry = VariantVariableSet.find(v => v.Low === "CSD_INCIDENTAL_PERC");
          const incidentalRate = incidentalEntry ? Number(incidentalEntry.High) / 100 : 0.01;

          

          const csdResults = [];
          for (const bp of regionBreakups) {
            // Step 2: model master data (discount %, GST %)
            const model = relevantModels.find(m => m.ModelCode === bp.Model);
            if (!model) { console.warn(`CSD: model master missing for ${bp.Model}, skipping`); continue; }

            // Step 3: ActualNsp as the Basic value; skip if zero/missing
            const ActualNsp = Number(bp.ActualNsp);
            if (!ActualNsp) { console.warn(`CSD: ActualNsp is zero for model ${bp.Model}, skipping`); continue; }

            // Step 4: discount rate
            var CsdDisPerc = Number(model.CsdDisPerc || 0);


            // Step 5: GST rate — engine-size specific (350cc/650cc)
            const GstPerc = Number(model.CsdGstPerc || model.GstPerc || 0);

            // Step 6: CSD NSP = ActualNsp + Transportation + Other Expenses + Total Dealer Margin
            const Transportation = Number(bp.Transportation || 0);
            const OtherExpenses = Number(bp.OtherExpenses || 0);
            const TotalDealerMargin = Number(bp.TotalDealerMargin || 0); // from approved MTS model
            const CsdNsp = ActualNsp + Transportation + OtherExpenses + TotalDealerMargin;

            // Step 7: Basic Price = Basic − Helmet − Helmet Margin
            const BasicField = Number(bp.Basic || 0);
            const Helmet = Number(bp.Helmet || 0);
            const HelmetMargin = Number(bp.HelmetMargin || 0);
            const BasicPrice = BasicField - Helmet - HelmetMargin;

            // Step 8: Discount Amount = CSD NSP × Discount %
            const DiscountAmount = CsdNsp * (CsdDisPerc / 100);

            // Step 9: Pre-Tax Net Discount = Basic Price − Discount Amount
            const PreTaxNetDiscount = BasicPrice - DiscountAmount;

            // Step 10: GST Amount = Pre-Tax Net Discount × GST %
            const GstAmount = PreTaxNetDiscount * (GstPerc / 100);

            // Step 11: CSD Ex-showroom = Pre-Tax Net Discount + GST Amount
            const CsdExShowroom = PreTaxNetDiscount + GstAmount;

            // Step 12: Incidental Charges = Pre-Tax Net Discount × incidental rate (TVARVS)
            const IncidentalCharges = PreTaxNetDiscount * incidentalRate;

            // Step 13: Final CSD Price = CSD Ex-showroom + Incidental Charges
            const FinalCSDPrice = CsdExShowroom + IncidentalCharges;

            // Step 14: RTO, RTO(With Bill), Total Insurance — straight from approved MTS
            const Rto = Number(bp.Rto || 0);
            const RtoWithBill = Number(bp.RtoWithBill || 0);
            const TotalInsurance = Number(bp.TotalInsurance || 0);

            // Step 15: CSD On-road = CSD Ex-showroom + RTO + RTO(With Bill) + Total Insurance
            const CsdOnRoad = CsdExShowroom + Rto + RtoWithBill + TotalInsurance;

            csdResults.push({
              Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
              Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
              MtoMts: "CSD", Basis: bp.Basis,
              DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
              InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
              Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
              OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
              ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
              TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp, Basic: bp.Basic, Gst: bp.Gst,
              InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
              RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
              InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
              Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
              TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
              ActualExShowroom: bp.ActualExShowroom, Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,
              GSTPerc: bp.GSTPerc,
              InsurancePerc: bp.InsurancePerc,

              CsdNsp: roundToWholeWith00(CsdNsp),
              BasicPriceWO: roundToWholeWith00(BasicPrice),
              CsdDisPerc: to2(CsdDisPerc),
              CSD: roundToWholeWith00(DiscountAmount),
              PreTaxNetDiscount: roundToWholeWith00(PreTaxNetDiscount),
              CsdGstPerc: to2(GstPerc),
              CsdGstAmount: roundToWholeWith00(GstAmount),
              CsdExShowroom: roundToWholeWith00(CsdExShowroom),
              IncidentalPerc: to2(incidentalRate * 100),
              IncidentalCharges: roundToWholeWith00(IncidentalCharges),
              FinalCSDPrice: roundToWholeWith00(FinalCSDPrice),
              CsdOnRoad: roundToWholeWith00(CsdOnRoad)
            });
          }
          return csdResults;


          //new code 17/08

        } else if (MTOStatus === "GeM" || MTOStatus === "GEM") {
          const [
            modelMasterRaw,
            ModelPriceBreakupSetRaw,
            VariantVariableSetRaw,
            SubmissionReferenceSetRaw
          ] = await Promise.all([
            backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
            backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
            backendconnect.run(SELECT.from('VariantVariableSet')),
            backendconnect.run(SELECT.from('SubmissionReferenceSet'))
          ]);

          const modelMaster = getLatestPerKey(modelMasterRaw, m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`);
          const relevantModels = modelMaster;
          const ModelPriceBreakupSet = ModelPriceBreakupSetRaw;
          const VariantVariableSet = VariantVariableSetRaw;
          const SubmissionReferenceSet = SubmissionReferenceSetRaw;

          const aModelFilter = items.map(i => String(i.ModelCode || "").trim()).filter(Boolean);
          const DISCOUNT_PERC = 12;

          const approvedRefs = SubmissionReferenceSet
            .filter(s => s.Status === "APPROVED")
            .map(s => s.ReferenceNum);

          let approvedMtsBreakups = ModelPriceBreakupSet.filter(bp =>
            bp.MtoMts === "MTS" &&
            approvedRefs.includes(bp.ReferenceNum)
          );

          if (aModelFilter.length) {
            approvedMtsBreakups = approvedMtsBreakups.filter(bp => aModelFilter.includes(bp.Model));
          }

          if (!approvedMtsBreakups.length) {
            return req.error(404, `No approved MTS pricing data found for GeM calculation`);
          }

          const lowestByModel = new Map();
          for (const bp of approvedMtsBreakups) {
            const exShow = Number(bp.ActualExShowroom ?? 0);
            if (!exShow) continue;
            const existing = lowestByModel.get(bp.Model);
            if (!existing || exShow < Number(existing.ActualExShowroom)) {
              lowestByModel.set(bp.Model, bp);
            }
          }

          if (!lowestByModel.size) {
            return req.error(404, `No models with valid ActualExShowroom found for GeM calculation`);
          }

          const HELMET_COST_KEY = "GEM_HELMET_COST";
          const helmetEntry = VariantVariableSet.find(v => v.Low === HELMET_COST_KEY);
          const helmetCost = helmetEntry ? Number(helmetEntry.High) : 1338;

          const gemResults = [];
          for (const [modelCode, bp] of lowestByModel) {
            const MtsExShowroom = Number(bp.ActualExShowroom);

            const model = relevantModels.find(m => m.ModelCode === modelCode);
            if (!model) { console.warn(`GeM: model master missing for ${modelCode} — skipping`); continue; }

            const GST = Number(model.GstPerc);
            if (!GST) { console.warn(`GeM: GstPerc missing/zero for model ${modelCode} — skipping`); continue; }

            const DiscountAmount = MtsExShowroom * (DISCOUNT_PERC / 100);
            const SubTotal = MtsExShowroom - DiscountAmount;

            const BasicInclHelmet = SubTotal / (1 + GST / 100);
            const GstAmount = SubTotal - BasicInclHelmet;
            const Basic = SubTotal - GstAmount;

            gemResults.push({
              Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
              Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
              MtoMts: "GeM", Basis: bp.Basis,
              DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
              insuranceperc: bp.insuranceperc || "0",
              InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
              Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
              OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
              ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
              TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp,
              Basic: bp.Basic, Gst: bp.Gst,
              InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
              RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
              InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
              Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
              TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
              ActualExShowroom: bp.ActualExShowroom, Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,

              MtsExShowroom: roundToWholeWith00(MtsExShowroom),
              DiscountPerc: DISCOUNT_PERC,
              DiscountAmount: roundToWholeWith00(DiscountAmount),
              SubTotal: roundToWholeWith00(SubTotal),

              GemGstPerc: to0(GST),
              HelmetCost: to2(helmetCost),
              GemBasic: roundToWholeWith00(Basic),
              GemGstAmount: roundToWholeWith00(GstAmount),

              FinalGeMPrice: roundToWholeWith00(SubTotal)
            });
          }
          return gemResults;
        }
        else {
          const exshowroom = Number(item.exshowroomPrice);
          const Basic = exshowroom / (1 + GST / 100);
          const GSTAfterbasic = Basic * (GST / 100);
          const DealerCost = reverseSolveDealerCost(Basic, otherExpensesValue, GST, DealerMarginPerc, DealerMargCalc, HelmetMarigin);
          const NDP = DealerCost * (1 + GST / 100);
          const DealerMarigin = DealerMargCalc === "NDP" ? NDP * (DealerMarginPerc / 100) : 0;
          const totalDealerMarigin = DealerMarigin + HelmetMarigin;
          const NSP = DealerCost - Helmet - Transportation;

          const ex_showroomAfterGST = Basic + GSTAfterbasic;

          const RTOMasterSlabs = RtoMasterSet.filter(
            m => String(m.RegionCode).padStart(3, '0') === rCodeStr
          );

          const RTOExpenseSlabs = RTOExpenseSet.filter(
            m => String(m.RegionCode).padStart(3, '0') === rCodeStr
          );

          const priceForSlabCheck = region.BasisRto === "BASIC" ? Basic : exshowroom;

          const matchedSlab = RTOMasterSlabs.find(m =>
            ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );


          // const RTO_percentage = matchedSlab ? Number(matchedSlab.RtoPercent) : 0;

          // let RTO;
          // if (regionCode === "026" || regionCode === "002") {
          //   RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          // } else if (!matchedSlab || RTO_percentage === 0) {
          //   RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          // } else {
          //   RTO = priceForSlabCheck * (RTO_percentage / 100);
          // }

          // console.log(RTOExpenseSlabs);
          // console.log(priceForSlabCheck);

          // const matchedExpenseSlab = RTOExpenseSlabs.find(m =>
          //   priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          // );

          // console.log('RTOExpenseSlabs:', RTOExpenseSlabs.length, '| matchedExpenseSlab:', matchedExpenseSlab ?? 'NO MATCH');

          // const regionPrefix = regionCodeStr.padStart(3, '0');
          // const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          // const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // let RTO_bill;
          // if (variantPercentEntry && variantAmountEntry) {
          //   const percent = Number(variantPercentEntry.High);
          //   const fixedAmt = Number(variantAmountEntry.High);
          //   RTO_bill = (RTO * percent / 100) + fixedAmt;
          // } else if (matchedExpenseSlab) {
          //   RTO_bill = Number(matchedExpenseSlab.Expense);
          // } else {
          //   RTO_bill = calcRtoBill(exshowroom, RTO, regionCodeStr, VariantVariableSet, RTO_percentage);
          // }


          const regionPrefix = regionCodeStr.padStart(3, '0');
          const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // ── RTO percentage: variant table takes priority over slab ──
          const RTO_percentage = (matchedSlab ? Number(matchedSlab.RtoPercent) : 0);

          let RTO;
          if (regionCode === "026" || regionCode === "002") {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else if (!matchedSlab || RTO_percentage === 0) {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else {
            RTO = priceForSlabCheck * (RTO_percentage / 100);
          }

          const matchedExpenseSlab = RTOExpenseSlabs.find(m =>
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );

          console.log('RTOExpenseSlabs:', RTOExpenseSlabs.length, '| matchedExpenseSlab:', matchedExpenseSlab ?? 'NO MATCH');

          let RTO_bill;
          if (variantPercentEntry && variantAmountEntry) {
            const percent = Number(variantPercentEntry.High);
            const fixedAmt = Number(variantAmountEntry.High);
            RTO_bill = (RTO * percent / 100) + fixedAmt;
          } else if (matchedExpenseSlab) {
            RTO_bill = Number(matchedExpenseSlab.Expense);
          } else {
            RTO_bill = calcRtoBill(ex_showroomAfterGST, RTO, regionCodeStr, VariantVariableSet, RTO_percentage);
          }

          const insurance_int = (0.95 * exshowroom) * insurance_GST;
          const GST_afterTPA = (TPA_PA + insurance_int) * (Insurance_GST_Actual / 100);
          const TotalInsurance = insurance_int + TPA_PA + GST_afterTPA;
          const OnRoadPrice = exshowroom + RTO + RTO_bill + TotalInsurance;

          result = {
            BasisRto: region.BasisRto,
            DealerMarigin: to2(DealerMarigin),
            Helmet: roundToWholeWith00(Helmet),
            Transportation: to2(Transportation),
            DealerCost: roundToWholeWith00(DealerCost),
            OtherExpenses: to2(otherExpensesValue),
            HelmetMarigin: to2(HelmetMarigin),
            NDP: roundToWholeWith00(NDP),
            totalDealerMarigin: to2(totalDealerMarigin),
            BikeMargin: to2(DealerMarigin),
            Basic: roundToWholeWith00(Basic),
            GSTAfterbasic: roundToWholeWith00(GSTAfterbasic),
            ex_showroomAfterGST: roundToWholeWith00(exshowroom),
            RTO_percentage: to2(RTO_percentage),
            RTO: roundToWholeWith00(RTO),
            RTO_bill: to2(RTO_bill),
            insurance: to2(insurance_int),
            insuranceperc: to6(insurance_GST),
            TPA_PA: to2(TPA_PA),
            GST_afterTPA: to2(GST_afterTPA),
            TotalInsurance: roundToWholeWith00(TotalInsurance),
            OnRoadPrice: roundToWholeWith00(OnRoadPrice),
            DealerMarginPerc: to2(DealerMarginPerc),
            GSTPerc: to0(GST),
            ActualNsp: roundToWholeWith00(NSP),
            InputNSP: to2(NSP),
            CalculatedNSP: to2(NSP),
            IncrementalNSP: roundToWholeWith00(0),
            Model: ModelCode,
            Region: rCodeStr
          };
        }

        results.push(result);
      }

      return results;
    } catch (error) {
      console.error("processCalculation failed:", error);
      return req.reject(500, error.message || "Pricing calculation failed");
    }
  });



  // ── addToOtherRegion ──────────────────────────────────────────────────────
  this.on('addToOtherRegion', async (req) => {
    const { items, regionCodes, Mail, MTOStatus, StatusFilter, EffectiveDate } = req.data;

    if (!Mail) return req.error(400, "Mail is mandatory");
    if (!MTOStatus) return req.error(400, "MTOStatus is mandatory");

    function parseSafeDate(dateStr) {
      if (!dateStr) return new Date();
      const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return new Date(dateStr);
    }
    const effectiveDate = parseSafeDate(EffectiveDate);
    effectiveDate.setHours(0, 0, 0, 0);
    if (EffectiveDate) effectiveDate.setDate(effectiveDate.getDate() + 1);

    const mStatusMap = {
      "ACTIVE": ["APPROVED"],
      "IN-ACTIVE": ["REJECTED", "INACTIVE", "IN-ACTIVE"],
      "IN-STOCK": ["IN-STOCK", "INSTOCK"]
    };
    const aAllowedStatuses = mStatusMap[StatusFilter] || ["APPROVED"];

    // ── Base fetches (always needed) ─────────────────────────────────────────
    const basePromise = Promise.all([
      backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
      backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
      backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
      backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
      backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
      backendconnect.run(SELECT.from('VariantVariableSet')),
    ]);

    // ── MTO-only fetches (fired in parallel with base) ────────────────────────
    const mtoPromise = MTOStatus === "MTO"
      ? Promise.all([
        backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
        backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
        backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
        backendconnect.run(SELECT.from('SubmissionReferenceSet')),
      ])
      : Promise.resolve([null, null, null, null]);

    // ── Await both groups together ────────────────────────────────────────────
    const [
      [
        regionMasterRaw,
        modelMasterRaw,
        pricingComponentsSetRaw,
        RTOMasterSetRaw,
        RTOExpenseSetRaw,
        VariantVariableSet,
      ],
      [
        GMAComponentsSetRaw,
        MasterModelPriceBreakupSet,
        PartsSetRaw,
        SubmissionReferenceSet,
      ]
    ] = await Promise.all([basePromise, mtoPromise]);

    // ── Filter to latest record per natural key as of effectiveDate ───────────
    const regionMaster = getLatestPerKeyAsOf(regionMasterRaw, r => r.Region, effectiveDate);

    let modelMasterFiltered = getLatestPerKeyAsOf(
      modelMasterRaw,
      m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`,
      effectiveDate
    );
    if (!modelMasterFiltered.length && EffectiveDate) {
      console.log("addToOtherRegion: no models in main set for effectiveDate — trying ModelInvalidSet");
      const modelInvalidRaw = await backendconnect.run(SELECT.from('ModelInvalidSet').where({ Mail }));
      modelMasterFiltered = getLatestPerKeyAsOf(
        modelInvalidRaw,
        m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`,
        effectiveDate
      );
    }
    const modelMaster = modelMasterFiltered;

    const pricingComponentsSet = getLatestPerKeyAsOf(
      pricingComponentsSetRaw,
      p => `${p.Region}|${p.EngineType}`,
      effectiveDate
    );
    const RTOMasterSet = getLatestPerKeyAsOf(
      RTOMasterSetRaw,
      r => String(r.RegionCode).padStart(3, '0') + "|" + r.Slab,
      effectiveDate
    );
    const RTOExpenseSet = getLatestPerKeyAsOf(
      RTOExpenseSetRaw,
      r => `${r.RegionCode}|${r.Slab}`,
      effectiveDate
    );

    const normalizeRegion = (val) => String(Number(val)).padStart(3, '0');

    const results = [];

    if (MTOStatus === "MTO") {

      // ── Filter MTO sets — reuse the already-fetched raw data ─────────────────
      // No separate fetches needed; regionMaster, modelMaster, etc. are reused directly.
      const regionMasterMTO = regionMaster;   // same filtered result
      const pricingComponentsSetMTO = pricingComponentsSet;
      const RTOMasterSetMTO = RTOMasterSet;
      const RTOExpenseSetMTO = RTOExpenseSet;

      // modelMaster needs its own fallback pass for MTO (same logic, same data)
      let modelMasterMTOFiltered = getLatestPerKeyAsOf(
        modelMasterRaw,
        m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`,
        effectiveDate
      );
      if (!modelMasterMTOFiltered.length && EffectiveDate) {
        console.log("addToOtherRegion MTO: no models in main set — trying ModelInvalidSet");
        const modelInvalidRaw = await backendconnect.run(SELECT.from('ModelInvalidSet').where({ Mail }));
        modelMasterMTOFiltered = getLatestPerKeyAsOf(
          modelInvalidRaw,
          m => `${m.ModelCode}|${m.EngineType}|${m.CcWatt}`,
          effectiveDate
        );
      }
      const modelMasterMTO = modelMasterMTOFiltered;

      // ── Filter MTO-exclusive sets ─────────────────────────────────────────────
      const GMAComponentsSet = getLatestPerKeyAsOf(GMAComponentsSetRaw, g => g.Models, effectiveDate);
      const PartsSet = getLatestPerKeyAsOf(PartsSetRaw, p => p.PartCode, effectiveDate);

      const _processGoLogicMTO = async (regionCode, MTOStatus, Mail, ModelCodes, prefetched) => {
        const {
          regionMaster, modelMaster, pricingComponentsSet,
          RTOMasterSet, RTOExpenseSet, GMAComponentsSet,
          ModelPriceBreakupSet, PartsSet, VariantVariableSet,
          SubmissionReferenceSet
        } = prefetched;

        const regionCodeStr = String(Number(regionCode)).padStart(3, '0');
        const aModelFilter = Array.isArray(ModelCodes) && ModelCodes.length > 0 ? ModelCodes : null;

        const region = regionMaster.find(r => r.Region === regionCodeStr);
        if (!region) throw new Error("Region not found");

        const pricingMatches = pricingComponentsSet.filter(
          p => p.Region === regionCodeStr && p.EngineType === "ICE"
        );
        const pricing = pricingMatches[0] ?? null;
        if (!pricing) throw new Error(`Pricing components missing for region: ${regionCodeStr} / ICE`);

        const relevantModels = modelMaster.filter(m => aAllowedStatuses.includes(m.Status));
        if (!relevantModels.length) throw new Error(`No valid models found`);

        let mtoGMAList = GMAComponentsSet.filter(g => g.MtsMto === "MTO");
        if (aModelFilter) {
          mtoGMAList = mtoGMAList.filter(g =>
            aModelFilter.includes(g.Models) || aModelFilter.includes(g.ReferMtsModel)
          );
        }
        if (!mtoGMAList.length) throw new Error("No MTO GMA records found for the selected models");

        const approvedRefs = SubmissionReferenceSet
          .filter(s => s.Status === "APPROVED")
          .map(s => s.ReferenceNum);

        const approvedBreakups = ModelPriceBreakupSet
          .filter(b => approvedRefs.includes(b.ReferenceNum));

        const results = [];
        const specialRegions = ["026", "002", "015", "02"];

        const RTOExpenseSetICE = RTOExpenseSetRaw.filter(row => row.EngineType === 'ICE');

        const getRTOExpenseSlabs = (regionStr) =>
          RTOExpenseSetICE.filter(m =>
            String(Number(m.RegionCode)).padStart(3, '0') === regionStr.padStart(3, '0')
          );

        const getRTOMasterSlabs = (regionStr) =>
          RTOMasterSet.filter(m =>
            String(Number(m.RegionCode)) === String(Number(regionStr))
          );

        for (const gma of mtoGMAList) {
          const referenceModel = gma.ReferMtsModel;
          const displayModel = gma.Models;

          if (!referenceModel) {
            results.push({ Model: displayModel, Region: regionCodeStr, success: false, error: `GMA entry missing ReferMtsModel. Display model: ${displayModel}` });
            continue;
          }

          const mtsRecord = await approvedBreakups.find(
            m => m.Model === referenceModel && m.MtoMts === "MTS" && m.Region === regionCodeStr
          );
          if (!mtsRecord) {
            console.warn(`No APPROVED MTS record for reference model: ${referenceModel} — skipping`);
            continue;
          }

          const exshowroomRaw = Number(mtsRecord.ActualExShowroom);
          if (!exshowroomRaw) {
            console.warn(`ActualExShowroom is zero/missing for model: ${referenceModel} — skipping`);
            continue;
          }

          const model = relevantModels.find(m => m.ModelCode === referenceModel);
          if (!model) {
            console.warn(`Model master missing for: ${referenceModel} — skipping`);
            continue;
          }

          const ccValue = Number(model.CcWatt);
          const GST = Number(model.GstPerc);
          const DealerMarginPerc = Number(model.DealerMargin);
          const DealerMargCalc = model.DealerMargCalc ?? "NDP";

          if (!ccValue) { console.warn(`CcWatt zero/missing for: ${referenceModel}`); continue; }
          if (!GST) { console.warn(`GstPerc zero/missing for: ${referenceModel}`); continue; }

          const otherExpenses = ccValue < 500 ? Number(pricing.OtExpLt500) : Number(pricing.OtExpGt500);
          const HelmetMargin = Number(pricing.HelmetMargin);
          const GST_FACTOR = 1 + GST / 100;

          const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
          const insurance = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);

          const MTS_NSP = Number(mtsRecord.ActualNsp);
          const MTS_Helmet = Number(pricing.Helmet);
          const MTS_Transport = Number(pricing.Transportation);
          const MTSExshowroom = exshowroomRaw;
          const MTS_TpaPa = Number(mtsRecord.TpaPa ?? 0);
          const MTS_RtoPerc = parseFloat(mtsRecord.RtoPerc ?? 0);

          const MTS_TotalDealerMargin_Base = Number(mtsRecord.BikeMargin) + HelmetMargin;
          const MTS_DealerCost_Calc = MTS_NSP + MTS_Helmet + MTS_Transport;
          const MTS_Basic_Calc = Math.round(MTS_DealerCost_Calc + otherExpenses + MTS_TotalDealerMargin_Base);
          const MTS_GSTAmount_Calc = Math.round(MTS_Basic_Calc * (GST / 100));
          const MTS_ExShowroom_Calc = MTS_Basic_Calc + MTS_GSTAmount_Calc;

          const MTS_Rto_Calc = (() => {
            if (specialRegions.includes(regionCodeStr) || !MTS_RtoPerc) {
              const slabs = RTOMasterSet.filter(m =>
                String(Number(m.RegionCode)).padStart(3, '0') === regionCodeStr
              );
              const match = slabs.find(m =>
                ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
                MTS_ExShowroom_Calc >= Number(m.MinRange) && MTS_ExShowroom_Calc <= Number(m.MaxRange)
              );
              return match ? Number(match.PriceValue) : 0;
            }
            return Math.round(
              (region.BasisRto === "BASIC" ? MTS_Basic_Calc : MTS_ExShowroom_Calc) * (MTS_RtoPerc / 100)
            );
          })();

          const MTS_RTOExpenseSlabs = getRTOExpenseSlabs(regionCodeStr);
          const MTS_RTOExpenseMatch = MTS_RTOExpenseSlabs.find(m =>
            MTS_ExShowroom_Calc >= Number(m.MinRange) && MTS_ExShowroom_Calc <= Number(m.MaxRange)
          );
          const regionPrefixMTS = regionCodeStr.padStart(3, '0');
          const variantPercentMTS = VariantVariableSet.find(v => v.Low === `${regionPrefixMTS}_RTO_EXPENSE_PERCENT`);
          const variantAmountMTS = VariantVariableSet.find(v => v.Low === `${regionPrefixMTS}_RTO_EXPENSE_AMOUNT`);

          let MTS_RtoWithBill_Calc;
          if (variantPercentMTS && variantAmountMTS) {
            MTS_RtoWithBill_Calc = (MTS_Rto_Calc * Number(variantPercentMTS.High) / 100) + Number(variantAmountMTS.High);
          } else if (!MTS_RTOExpenseMatch) {
            MTS_RtoWithBill_Calc = calcRtoBill(MTS_ExShowroom_Calc, MTS_Rto_Calc, regionCodeStr, VariantVariableSet, MTS_RtoPerc);
          } else {
            MTS_RtoWithBill_Calc = Number(MTS_RTOExpenseMatch.Expense);
          }

          const MTS_Insurance_Calc = Math.round((0.95 * MTS_ExShowroom_Calc) * insurance);
          const MTS_GST_Insurance_Calc = Math.round((MTS_Insurance_Calc + MTS_TpaPa) * (Insurance_GST_Actual / 100));
          const MTS_TotalInsurance_Calc = MTS_Insurance_Calc + MTS_TpaPa + MTS_GST_Insurance_Calc;

          // ── Parts classification ──────────────────────────────────────────────
          let miyExShowroomTotal = 0;
          let miyGmaCostTotal = 0;
          let miyMarkupTotal = 0;
          let miyBreakup = [];
          let exShowroomRunning = exshowroomRaw;

          for (let i = 0; i <= 20; i++) {
            const pCode = gma[`Part${i}`];
            if (!pCode) continue;
            const part = PartsSet.find(p => p.PartCode === pCode);
            if (!part) { console.warn(`PartCode ${pCode} not found — skipping part`); continue; }
            if (!["EX SHOWROOM", "ON ROAD"].includes(part.ExShowOnRoad)) {
              console.warn(`Invalid ExShowOnRoad "${part.ExShowOnRoad}" for PartCode: ${pCode} — skipping`);
              continue;
            }
            const miyCost = Number(part.MiyCost || 0);
            const miyMarkup = Number(part.MiyMarkup || 0);
            const partPrice = miyCost + miyMarkup;

            if (part.ExShowOnRoad === "EX SHOWROOM") {
              const before = exShowroomRunning;
              exShowroomRunning += miyCost;
              miyExShowroomTotal += miyCost;
              miyBreakup.push({
                PartCode: part.PartCode, Description: part.PartDescr,
                ExShowOnRoad: "EX SHOWROOM",
                MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                ExShowroomBefore: to2(before), ExShowroomAfter: to2(exShowroomRunning)
              });
            } else {
              miyGmaCostTotal += miyCost;
              miyMarkupTotal += miyMarkup;
              miyBreakup.push({
                PartCode: part.PartCode, Description: part.PartDescr,
                ExShowOnRoad: "ON ROAD",
                MiyCost: to2(miyCost), MiyMarkup: to2(miyMarkup), PartPrice: to2(partPrice),
                ExShowroomBefore: null, ExShowroomAfter: null
              });
            }
          }

          const miyOnRoadTotal = miyGmaCostTotal;

          // ── MTO working variables ─────────────────────────────────────────────
          let MTO_NSP = MTS_NSP;
          let MTO_DealerCost = 0;
          let MTO_NDP = 0;
          let MTO_Basic = 0;
          let MTO_GSTAmount = 0;
          let MTO_ExShowroom = exshowroomRaw;
          let MTO_Rto = 0;
          let MTO_RtoWithBill = 0;
          let MTO_Insurance = 0;
          let MTO_TpaPa = MTS_TpaPa;
          let MTO_GST_Insurance = 0;
          let MTO_TotalInsurance = 0;
          let MTO_OnRoad_Final = 0;
          let MTO_DealerMargin = Number(mtsRecord.BikeMargin);

          let targetOnRoad = 0;

          const MTO_ActualDealerMargin = MTO_DealerMargin + miyMarkupTotal;
          const MTO_TotalDealerMargin = MTO_DealerMargin + miyMarkupTotal + HelmetMargin;

          const regionPrefix = regionCodeStr.padStart(3, '0');
          const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // Helper: fresh MTO RTO% from slab (never uses MTS_RtoPerc)
          const getMTORtoPerc = (basic, exShow) => {
            const slabs = getRTOMasterSlabs(regionCodeStr);
            const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;
            const match = slabs.find(m =>
              ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
              priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
            );
            return { match, rtoPerc: match ? Number(match.RtoPercent) : 0 };
          };

          const resolveRtoWithBill = (exShow, rto, rtoExpSlabs, basic) => {
            const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;
            const match = rtoExpSlabs.find(m =>
              priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)  // ← consistent
            );
            if (variantPercentEntry && variantAmountEntry) {
              return (rto * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
            } else if (!match) {
              const { rtoPerc: mtoRtoPerc } = getMTORtoPerc(
                region.BasisRto === "BASIC" ? MTO_Basic : exShow,
                exShow
              );
              return calcRtoBill(exShow, rto, regionCodeStr, VariantVariableSet, mtoRtoPerc);
            } else {
              return Number(match.Expense);
            }
          };

          const resolveRto = (rtoExpSlabs, basic, exShow) => {

            const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;


            if (specialRegions.includes(regionCodeStr)) {
              const RTOMasterSlabs = getRTOMasterSlabs(regionCodeStr);
              if (!RTOMasterSlabs.length) return null;
              const slabMatch = RTOMasterSlabs.find(m =>
                ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
                priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)  // ← same bug
              );
              if (!slabMatch) return 0;
              const rtoPerc = Number(slabMatch.RtoPercent);
              return rtoPerc > 0
                ? Math.round((region.BasisRto === "BASIC" ? basic : exShow) * (rtoPerc / 100))
                : Number(slabMatch.PriceValue);
            }
            const { match, rtoPerc } = getMTORtoPerc(basic, exShow);
            if (!match) return 0;
            const priceBase = region.BasisRto === "BASIC" ? basic : exShow;
            return rtoPerc > 0
              ? Math.round(priceBase * (rtoPerc / 100))
              : Number(match.PriceValue);
          };

          const resolveRtoFull = (basic, exShow) => {

            const priceForSlabCheck = region.BasisRto === "BASIC" ? basic : exShow;


            const { match, rtoPerc } = getMTORtoPerc(basic, exShow);
            if (!match) return 0;
            const priceBase = region.BasisRto === "BASIC" ? basic : exShow;
            return rtoPerc > 0
              ? Math.round(priceBase * (rtoPerc / 100))
              : Number(match.PriceValue);
          };

          const RTOExpenseSlabs = getRTOExpenseSlabs(regionCodeStr);

          const MTS_Rto_Stored = resolveRtoFull(MTS_Basic_Calc, MTSExshowroom);
          const MTS_RtoWithBill_Stored = resolveRtoWithBill(MTSExshowroom, MTS_Rto_Stored, RTOExpenseSlabs, MTS_Basic_Calc);
          const MTS_Insurance_Stored = Math.round((0.95 * MTSExshowroom) * insurance);
          const MTS_GST_Ins_Stored = Math.round((MTS_Insurance_Stored + MTS_TpaPa) * (Insurance_GST_Actual / 100));
          const MTS_TotalIns_Stored = MTS_Insurance_Stored + MTS_TpaPa + MTS_GST_Ins_Stored;
          const MTS_OnRoad_Calculated = MTSExshowroom + MTS_Rto_Stored + MTS_RtoWithBill_Stored + MTS_TotalIns_Stored;

          const MTS_road = Number(mtsRecord.OnRoad);






          // ── STEP 2: ExShowroom solver ─────────────────────────────────────────
          if (miyExShowroomTotal > 0) {
            const targetExshowroom = exShowroomRunning;
            let calculatedExshowroom = exshowroomRaw;
            let iteration = 0;
            MTO_NSP = MTS_NSP;

            while (Math.abs(calculatedExshowroom - targetExshowroom) > 1) {
              if (++iteration > 50000) { console.warn("❌ Max iterations reached in MTO ExShowroom solver"); break; }
              if (calculatedExshowroom < targetExshowroom) { MTO_NSP += 1; } else { MTO_NSP -= 1; }
              MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              calculatedExshowroom = MTO_Basic + MTO_GSTAmount;
            }
            MTO_ExShowroom = calculatedExshowroom;
            console.log(`ExShowroom solver converged: iterations=${iteration}, NSP=${MTO_NSP}, ExShowroom=${MTO_ExShowroom}`);
          }

          const MTOExshowroomafterGMA = MTSExshowroom + miyExShowroomTotal;

          // ── STEP 3: Derive all MTO figures ────────────────────────────────────
          MTO_DealerCost = MTO_NSP + MTS_Helmet + MTS_Transport;
          MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
          MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
          MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
          // MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

          if (miyExShowroomTotal > 0) {
            MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;
          }

          else {
            MTO_ExShowroom
          }

          MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
          MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
          MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
          MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
          MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
          MTO_OnRoad_Final = Math.round(MTO_ExShowroom) + Math.round(MTO_Rto) + Math.round(MTO_RtoWithBill) + Math.round(MTO_TotalInsurance);

          // ── STEP 4a: S4 — ON ROAD parts only ─────────────────────────────────
          if (miyOnRoadTotal > 0 && miyExShowroomTotal === 0) {
            targetOnRoad = Math.round(MTS_OnRoad_Calculated + miyGmaCostTotal);
            let currentNSP = MTO_NSP;
            let calcOnRoad = MTO_OnRoad_Final;
            let iteration2 = 0;

            while (Math.abs(calcOnRoad - targetOnRoad) > 1) {
              if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in OnRoad solver S4"); break; }
              if (calcOnRoad < targetOnRoad) { currentNSP += 1; } else { currentNSP -= 1; }
              MTO_DealerCost = currentNSP + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

              const rto4 = resolveRto(RTOExpenseSlabs, MTO_Basic, MTO_ExShowroom);
              if (rto4 === null) break;
              MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);
              MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
              MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
              MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
              MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
              calcOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
            }
            MTO_NSP = currentNSP;
            MTO_OnRoad_Final = calcOnRoad;
            console.log(`S4 solver converged: iterations=${iteration2}, NSP=${MTO_NSP}, OnRoad=${MTO_OnRoad_Final}`);
          }

          // ── STEP 4b: S2/S3 — both EX SHOWROOM and ON ROAD parts ──────────────
          if (miyOnRoadTotal > 0 && miyExShowroomTotal > 0) {
            targetOnRoad = Math.round(MTO_OnRoad_Final + miyOnRoadTotal);
            let currentNSP = MTO_NSP;
            let calcOnRoad = MTO_OnRoad_Final;
            let iteration2 = 0;

            while (Math.abs(calcOnRoad - targetOnRoad) > 1) {
              if (++iteration2 > 50000) { console.warn("❌ Max iterations reached in OnRoad solver S2/S3"); break; }
              if (calcOnRoad < targetOnRoad) { currentNSP += 1; } else { currentNSP -= 1; }
              MTO_DealerCost = currentNSP + MTS_Helmet + MTS_Transport;
              MTO_NDP = Math.round(MTO_DealerCost * GST_FACTOR);
              MTO_Basic = Math.round(MTO_DealerCost + otherExpenses + MTO_TotalDealerMargin);
              MTO_GSTAmount = Math.round(MTO_Basic * (GST / 100));
              MTO_ExShowroom = MTO_Basic + MTO_GSTAmount;

              const rto23 = resolveRto(RTOExpenseSlabs, MTO_Basic, MTO_ExShowroom);
              if (rto23 === null) break;
              MTO_Rto = resolveRtoFull(MTO_Basic, MTO_ExShowroom);

              MTO_RtoWithBill = resolveRtoWithBill(MTO_ExShowroom, MTO_Rto, RTOExpenseSlabs, MTO_Basic);
              MTO_Insurance = Math.round((0.95 * MTO_ExShowroom) * insurance);
              MTO_GST_Insurance = Math.round((MTO_Insurance + MTO_TpaPa) * (Insurance_GST_Actual / 100));
              MTO_TotalInsurance = MTO_Insurance + MTO_TpaPa + MTO_GST_Insurance;
              calcOnRoad = MTO_ExShowroom + MTO_Rto + MTO_RtoWithBill + MTO_TotalInsurance;
            }
            MTO_NSP = currentNSP;
            MTO_OnRoad_Final = calcOnRoad;
            console.log(`S2/S3 solver converged: iterations=${iteration2}, NSP=${MTO_NSP}, OnRoad=${MTO_OnRoad_Final}`);
          }

          // ── STEP 5: Build result row ──────────────────────────────────────────
          const IncrementalNsp = MTO_NSP - MTS_NSP;

          let baseOnRoad = targetOnRoad;

          if (baseOnRoad === 0) {
            baseOnRoad = MTO_OnRoad_Final
          }

          console.log('Base on road: ', baseOnRoad);



          results.push({
            Model: displayModel,
            ReferModel: referenceModel,
            OperationNo: 0,
            SaveInd: "X",
            Mail: gma.Mail ?? mtsRecord.Mail ?? "",
            AsmName: gma.AsmName ?? mtsRecord.AsmName ?? "",
            Region: regionCodeStr,
            MtoMts: "MTO",
            Basis: region.BasisRto,
            ReferenceNum: mtsRecord.ReferenceNum ?? "",
            insuranceperc: to6(insurance),
            InputNsp: to2(MTS_NSP),
            IncrementalNsp: roundToWholeWith00(Math.abs(IncrementalNsp)),
            ActualNsp: roundToWholeWith00(MTS_NSP),
            Helmet: to2(MTS_Helmet),
            Transportation: to2(MTS_Transport),
            DealerCost: roundToWholeWith00(MTO_DealerCost),
            OtherExpenses: to2(otherExpenses),
            BikeMargin: roundToWholeWith00(MTO_DealerMargin),
            DealerMarginPerc: to2(DealerMarginPerc),
            IncrementDlr: to2(miyMarkupTotal),
            ActualDealerMargin: roundToWholeWith00(MTO_ActualDealerMargin),
            HelmetMargin: to2(HelmetMargin),
            TotalDealerMargin: roundToWholeWith00(MTO_TotalDealerMargin),
            Ndp: roundToWholeWith00(MTO_NDP),
            Basic: roundToWholeWith00(MTO_Basic),
            Gst: to0(GST),
            GSTAfterbasic: roundToWholeWith00(MTO_GSTAmount),
            ActualExShowroom: roundToWholeWith00(MTO_ExShowroom),
            InputExShowroom: to2(model.InputExShowroom ?? null),
            Diff: to2(0),
            GstPerc: to0(GST),
            ExceptionRef: (mtsRecord.ExceptionRef && mtsRecord.ExceptionRef.trim() !== "")
              ? mtsRecord.ExceptionRef : "E",
            RtoPerc: to2(MTS_RtoPerc),
            Rto: roundToWholeWith00(MTO_Rto),
            RtoWithBill: roundToWholeWith00(MTO_RtoWithBill),
            InsuranceLe350: to6(Number(pricing.InsuranceLe350)),
            InsuranceGt350: to6(Number(pricing.InsuranceGt350)),
            Insurance: roundToWholeWith00(MTO_Insurance),
            TpaPa: roundToWholeWith00(MTO_TpaPa),
            ActualGst: roundToWholeWith00(MTO_GST_Insurance),
            TotalInsurance: roundToWholeWith00(MTO_TotalInsurance),
            OnRoad: roundToWholeWith00(MTO_OnRoad_Final),
            MTOOnRoad: roundToWholeWith00(MTO_OnRoad_Final),

            MiyExShowroomTotal: to2(miyExShowroomTotal),
            MiyOnRoadTotal: to2(miyOnRoadTotal),
            MiyBreakup: miyBreakup,
            MTSExshowroom: roundToWholeWith00(MTSExshowroom),
            // MTSOnRoad: roundToWholeWith00(MTO_OnRoad_Final - miyOnRoadTotal),

            MTSOnRoad: roundToWholeWith00(baseOnRoad - miyOnRoadTotal),
            ExpectedOnRoad: roundToWholeWith00(baseOnRoad),
            MTOExshowroomafterGMA: roundToWholeWith00(MTSExshowroom + miyExShowroomTotal),
            MTO_NSP: roundToWholeWith00(MTO_NSP),
            MTO_Exshowroom: roundToWholeWith00(MTO_ExShowroom),
          });
        }

        return results;
      };

      const prefetched = {
        regionMaster: regionMasterMTO,
        modelMaster: modelMasterMTO,
        pricingComponentsSet: pricingComponentsSetMTO,
        RTOMasterSet: RTOMasterSetMTO,
        RTOExpenseSet: RTOExpenseSetMTO,
        GMAComponentsSet,
        ModelPriceBreakupSet: MasterModelPriceBreakupSet,
        PartsSet,
        VariantVariableSet,          // ← was VariantVariableSetMTO (same data, one fetch)
        SubmissionReferenceSet
      };

      const BATCH_SIZE = 10;
      const allPairs = regionCodes.flatMap(regionCode =>
        items.map(item => ({ regionCode, item }))
      );

      for (let i = 0; i < allPairs.length; i += BATCH_SIZE) {
        const batch = allPairs.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ({ regionCode, item }) => {
            try {
              const aRes = await _processGoLogicMTO(
                regionCode, MTOStatus, Mail, [item.ModelCode], prefetched
              );
              if (Array.isArray(aRes) && aRes.length > 0) {
                results.push(...aRes);
              } else {
                results.push({ Model: item.ModelCode, Region: regionCode, MtoMts: MTOStatus, success: false, error: "No result from processing" });
              }
            } catch (e) {
              results.push({ Model: item.ModelCode, Region: regionCode, MtoMts: MTOStatus, success: false, error: e.message });
            }
          })
        );
      }

      return results;
    }

    // ── Non-MTO path ─────────────────────────────────────────────────────────
    for (const regionCode of regionCodes) {
      const regionCodeStr = normalizeRegion(regionCode);
      const region = regionMaster.find(r => r.Region === regionCodeStr);
      if (!region) {
        items.forEach(item => results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: `Region ${regionCodeStr} not found` }));
        continue;
      }

      const engineType = MTOStatus === "EV" ? "EV" : "ICE";
      const pricing = pricingComponentsSet.find(p =>
        normalizeRegion(p.Region) === regionCodeStr && p.EngineType === engineType
      );
      if (!pricing) {
        items.forEach(item => results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: `No pricingComponents for region ${regionCodeStr} and EngineType ${engineType}` }));
        continue;
      }

      const RTOMaster = RTOMasterSet.find(m => normalizeRegion(m.RegionCode) === regionCodeStr);
      if (!RTOMaster) {
        items.forEach(item => results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: `RTO Master missing for region ${regionCodeStr}` }));
        continue;
      }

      for (const item of items) {
        const hasPrice = item.exshowroomPrice != null && item.exshowroomPrice !== "" && Number(item.exshowroomPrice) > 0;
        const hasNsp = item.nspValue != null && item.nspValue !== "" && Number(item.nspValue) > 0;

        if (!hasPrice && !hasNsp) {
          results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: "Skipped - no price provided" });
          continue;
        }

        try {
          const model = modelMaster.find(m => m.ModelCode === item.ModelCode);
          if (!model) {
            results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: `Model ${item.ModelCode} not found` });
            continue;
          }

          const ccValue = Number(model.CcWatt);
          const GST = Number(model.GstPerc);
          const DealerMarginPerc = Number(model.DealerMargin);
          const DealerMargCalc = model.DealerMargCalc ?? "NDP";
          const Helmet = Number(pricing.Helmet);
          const Transportation = Number(pricing.Transportation);
          const HelmetMargin = Number(pricing.HelmetMargin);
          const otherExpenses = ccValue < 500 ? Number(pricing.OtExpLt500) : Number(pricing.OtExpGt500);

          let exshowroom;
          if (hasPrice) {
            exshowroom = Number(item.exshowroomPrice);
          } else {
            const DealerCostNsp = Number(item.nspValue) + Helmet + Transportation;
            const NDPNsp = DealerCostNsp * (1 + GST / 100);
            const DealerMarginNsp = DealerMargCalc === "NDP" ? NDPNsp * (DealerMarginPerc / 100) : 0;
            const totalDlrNsp = DealerMarginNsp + HelmetMargin;
            const BasicNsp = DealerCostNsp + otherExpenses + totalDlrNsp;
            exshowroom = BasicNsp * (1 + GST / 100);
          }

          const Basic = exshowroom / (1 + GST / 100);
          const DealerCost = reverseSolveDealerCost(Basic, otherExpenses, GST, DealerMarginPerc, DealerMargCalc, HelmetMargin);
          const OutputNSP = DealerCost - Helmet - Transportation;

          const frontendNSP = (
            item.nspValue != null && item.nspValue !== "" &&
            !isNaN(Number(item.nspValue)) && Number(item.nspValue) > 0
          ) ? Number(item.nspValue) : null;

          const incrementalNSP = frontendNSP !== null ? OutputNSP - frontendNSP : 0;

          const GSTAfterbasic = Basic * (GST / 100);
          const NDP = DealerCost * (1 + GST / 100);
          const DealerMarigin = DealerMargCalc === "NDP" ? NDP * (DealerMarginPerc / 100) : 0;
          const totalDealerMarigin = DealerMarigin + HelmetMargin;

          const RTOMasterSlabs = RTOMasterSet.filter(m =>
            String(Number(m.RegionCode)) === String(Number(regionCodeStr))
          );

          if (!RTOMasterSlabs.length) {
            console.warn(`No RTO Master data for region ${regionCodeStr} — aborting`);
            results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: `RTO Master data missing for region ${regionCodeStr}.` });
            continue;
          }

          const priceForSlabCheck = region.BasisRto === "BASIC" ? Basic : exshowroom;
          const matchedSlab = RTOMasterSlabs.find(m =>
            ccValue >= Number(m.CcMin) && ccValue <= Number(m.CcMax) &&
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );

          const regionPrefix = regionCodeStr.padStart(3, '0');
          const variantPercentEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_PERCENT`);
          const variantAmountEntry = VariantVariableSet.find(v => v.Low === `${regionPrefix}_RTO_EXPENSE_AMOUNT`);

          // const RTO_percentage = matchedSlab ? Number(matchedSlab.RtoPercent) : 0;
          const RTO_percentage = (matchedSlab ? Number(matchedSlab.RtoPercent) : 0);


          let RTO;
          if (regionCode === "026" || regionCode === "002") {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else if (!matchedSlab || RTO_percentage === 0) {
            RTO = matchedSlab ? Number(matchedSlab.PriceValue) : 0;
          } else {
            RTO = priceForSlabCheck * (RTO_percentage / 100);
          }

          const RTOExpenseSlabs = RTOExpenseSet.filter(
            m => String(m.RegionCode).padStart(3, '0') === regionCodeStr.padStart(3, '0')
          );
          const matchedExpenseSlab = RTOExpenseSlabs.find(m =>
            priceForSlabCheck >= Number(m.MinRange) && priceForSlabCheck <= Number(m.MaxRange)
          );



          let RTO_bill;
          if (variantPercentEntry && variantAmountEntry) {
            RTO_bill = (RTO * Number(variantPercentEntry.High) / 100) + Number(variantAmountEntry.High);
          } else if (matchedExpenseSlab) {
            RTO_bill = Number(matchedExpenseSlab.Expense);
          } else {
            RTO_bill = calcRtoBill(exshowroom, RTO, regionCodeStr, VariantVariableSet, RTO_percentage);
          }

          const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
          const insurance_GST = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);
          const insurance_int = (0.95 * exshowroom) * insurance_GST;
          const TPA_PA = ccValue <= 350 ? Number(pricing.TpaPaLe350) : Number(pricing.TpaPaGt350);
          const GST_afterTPA = (insurance_int + TPA_PA) * (Insurance_GST_Actual / 100);
          const TotalInsurance = insurance_int + TPA_PA + GST_afterTPA;
          const OnRoadPrice = exshowroom + RTO_bill + TotalInsurance + RTO;

          results.push({
            regionCode,
            ModelCode: item.ModelCode,
            success: true,
            BasisRto: region.BasisRto,
            DealerMarigin: roundToWholeWith00(DealerMarigin),
            Helmet: roundToWholeWith00(Helmet),
            Transportation: to2(Transportation),
            DealerCost: roundToWholeWith00(DealerCost),
            OtherExpenses: to2(otherExpenses),
            HelmetMarigin: to2(HelmetMargin),
            NDP: roundToWholeWith00(NDP),
            totalDealerMarigin: to2(totalDealerMarigin),
            BikeMarigin: to2(DealerMarigin),
            Basic: roundToWholeWith00(Basic),
            GSTAfterbasic: roundToWholeWith00(GSTAfterbasic),
            ex_showroomAfterGST: roundToWholeWith00(exshowroom),
            RTO_percentage: to2(RTO_percentage),
            RTO: roundToWholeWith00(RTO),
            RTO_bill: to2(RTO_bill),
            insurance: to2(insurance_int),
            insuranceperc: to6(insurance_GST),
            TPA_PA: to2(TPA_PA),
            GST_afterTPA: to2(GST_afterTPA),
            TotalInsurance: roundToWholeWith00(TotalInsurance),
            OnRoadPrice: roundToWholeWith00(OnRoadPrice),
            DealerMarginPerc: to2(DealerMarginPerc),
            GSTPerc: to0(GST),
            InputNSP: to2(frontendNSP),
            CalculatedNSP: roundToWholeWith00(OutputNSP),
            IncrementalNSP: roundToWholeWith00(incrementalNSP),
            InputExShowroom: exshowroom
          });

        } catch (e) {
          results.push({ regionCode, ModelCode: item.ModelCode, success: false, error: e.message });
        }
      }
    }

    return results;
  });


  // ── UPDATE SubmissionReferenceSet ─────────────────────────────────────────
  this.on("UPDATE", SubmissionReferenceSet, async (req) => {
    const { ReferenceNum, Mail, Status, Comments, CreatedOn, CreatedBy, StatChangedOn, StatChangedBy } = req.data;

    if (!ReferenceNum || !Mail) return req.error(400, "ReferenceNum and Mail are required");
    if (!["APPROVED", "REJECTED"].includes(Status)) return req.error(400, "Invalid Status value");
    if (Status === "REJECTED" && !Comments) return req.error(400, "Comments are mandatory for rejection");

    try {
      const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

      const csrfResponse = await executeHttpRequest(destination, {
        method: 'GET',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/SubmissionReferenceSet',
        headers: { 'X-CSRF-Token': 'Fetch', 'Accept': 'application/json' }
      });

      const csrfToken = csrfResponse.headers['x-csrf-token'];
      const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
      if (!csrfToken || !cookies) return req.error(500, 'Failed to retrieve CSRF token from S/4');

      const toODataDate = (date) => {
        if (!date) return null;
        const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
        return `/Date(${ms})/`;
      };

      const oBody = {
        Mail, ReferenceNum, Status,
        Comments: Comments || "",
        CreatedOn: CreatedOn ? toODataDate(CreatedOn) : null,
        CreatedBy: CreatedBy || "",
        StatChangedOn: toODataDate(StatChangedOn) || toODataDate(new Date()),
        StatChangedBy: Mail
      };

      const entityUrl = `/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/SubmissionReferenceSet(ReferenceNum='${encodeURIComponent(ReferenceNum)}',Mail='${encodeURIComponent(Mail)}')`;

      const response = await executeHttpRequest(destination, {
        method: 'PUT',
        url: entityUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': cookies
        },
        data: oBody
      });

      console.log("S/4 MERGE response:", response.status, response.data);
      return req.reply({ success: true, ...oBody });

    } catch (e) {
      console.error("S/4 update failed:", e.response?.data || e.message);
      return req.error(
        e.response?.status || 500,
        e.response?.data?.error?.message?.value || e.message || "Failed to update submission"
      );
    }
  });

  this.on('READ', ReferenceNumSet, async (req) => backendconnect.read(req.query));

  this.on(getApprovalDetailedData, async (req) => {
    try {
        const { refId } = req.data;

        const selectSubmissionRef = await backendconnect.run(
            SELECT.from('ModelPriceBreakupSet')
                .where({ ReferenceNum: refId })
        );

            console.log("Reference:", refId);
    console.log("Rows returned from backend:", selectSubmissionRef.length);
    console.log("Rows:", JSON.stringify(selectSubmissionRef, null, 2));

        // console.log(selectSubmissionRef);

        return selectSubmissionRef;
    } catch (error) {
        console.error('Error fetching approval detailed data:', error);
        return req.error(500, 'Failed to fetch approval detailed data');
    }
});

});