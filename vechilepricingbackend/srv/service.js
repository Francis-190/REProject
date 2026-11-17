const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { getDestination, buildHeadersForDestination } = require('@sap-cloud-sdk/connectivity');
const { ConnectionBackend } = require('./lib/ConnectionHandler');
const { to } = require('@sap/cds/lib/srv/cds-connect');


const toNum = (v) => {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const stra = (v) => (v === null || v === undefined ? "" : String(v));

const S4_STRING_FIELDS = {
  Model: 40, ModelName: 100, Region: 3, RegionName: 100, MtoMts: 4, Basis: 20,
  ReferenceNum: 10, Mail: 241, AsmName: 100, SaveInd: 1, ExceptionRef: 1, ReferenceMtsModel: 40
};

// CSN scale: default 3, these four are 6
const S4_SCALE = { InsuranceLe350: 6, InsuranceGt350: 6, Insurance: 6, TotalInsurance: 6 };

const S4_DECIMAL_FIELDS = [
  "DealerMargPerc", "DealerMargin", "GstPerc", "GstAftBasic", "Gst",
  "InputNsp", "IncrementalNsp", "ActualNsp", "Helmet", "Transportation", "DealerCost",
  "OtherExpenses", "BikeMargin", "IncrementDlr", "ActualDealerMargin", "HelmetMargin",
  "TotalDealerMargin", "Ndp", "Basic", "InputExShowroom", "ActualExShowroom",
  "RtoPerc", "Rto", "RtoWithBill", "InsuranceLe350", "InsuranceGt350", "InsurancePerc",
  "Insurance", "TpaPa", "InsuranceGst", "ActualGst", "TotalInsurance", "OnRoad", "Diff",
  "MtoNsp", "MtsExshwroom", "MtsOnRoad", "MtoExShwroom", "MtoOnRoad", "MtoExShwAftGma",
  "MiyExshowroom", "MiyOnroad", "ExpExshowroom", "ExpOnroad",
  "DiscPerc", "DiscAmount", "SubTotal", "GemGstPerc", "GemGstAmount", "HelmetCost",
  "GemBasic", "FinalGemPrice",
  "CsdNsp", "BasicPriceWo", "CsdDiscPerc", "Csd", "PretaxNetDisc", "CsdGstPerc",
  "CsdGstAmount", "CsdExshwroom", "IncidentalPerc", "IncidentalCharges",
  "FinalCsdPrice", "CsdOnroad"
];

const S4_ALIASES = {
  DealerMarginPerc: "DealerMargPerc", GSTAfterbasic: "GstAftBasic", GSTPerc: "GstPerc",
  insuranceperc: "InsurancePerc", ReferMtsModel: "ReferenceMtsModel", ReferModel: "ReferenceMtsModel",
  MIYExShowroomTotal: "MiyExshowroom", MIYOnRoadTotal: "MiyOnroad",
  MTSExshowroom: "MtsExshwroom", MtsExShowroom: "MtsExshwroom", MTSOnRoad: "MtsOnRoad",
  MTO_Exshowroom: "MtoExShwroom", MTOOnRoad: "MtoOnRoad", MTOExshowroomafterGMA: "MtoExShwAftGma",
  ExpectedOnRoad: "ExpOnroad", MTO_NSP: "MtoNsp", Description: "ModelName", Ort01: "RegionName",
  FinalGeMPrice: "FinalGemPrice", DiscountPerc: "DiscPerc", DiscountAmount: "DiscAmount",
  BasicPriceWO: "BasicPriceWo", CsdDisPerc: "CsdDiscPerc", CSD: "Csd",
  PreTaxNetDiscount: "PretaxNetDisc", CsdExShowroom: "CsdExshwroom",
  FinalCSDPrice: "FinalCsdPrice", CsdOnRoad: "CsdOnroad"
};

const PART_COUNT = 20;

function flattenParts(src) {
  const out = {};
  const parts = String(src.MtoMts || "").toUpperCase() === "MTO" && Array.isArray(src.MiyBreakup)
    ? src.MiyBreakup : [];
  for (let i = 1; i <= PART_COUNT; i++) {
    const p = parts[i - 1];
    out[`Part${i}`] = p ? str(p.PartCode).slice(0, 100) : "";
    out[`Part${i}Price`] = String(Number((p ? toNum(p.PartPrice) : 0).toFixed(3)));
  }
  return out;
}

function mapToS4Payload(ui) {
  const src = { ...ui };
  for (const [from, target] of Object.entries(S4_ALIASES)) {
    if ((src[target] === undefined || src[target] === null || src[target] === "") && ui[from] != null) {
      src[target] = ui[from];
    }
  }
  if (src.GstAftBasic === undefined || src.GstAftBasic === "") src.GstAftBasic = src.Gst;
  if (src.ExpExshowroom === undefined || src.ExpExshowroom === "") src.ExpExshowroom = src.MtoExShwAftGma;

  const out = {};
  for (const [k, len] of Object.entries(S4_STRING_FIELDS)) out[k] = str(src[k]).slice(0, len);
  out.SaveInd = str(src.SaveInd ?? "X").slice(0, 1);
  out.ExceptionRef = str(src.ExceptionRef || "E").slice(0, 1);
  out.OperationNo = Math.trunc(toNum(src.OperationNo));
  S4_DECIMAL_FIELDS.forEach(k => {
    out[k] = String(Number(toNum(src[k]).toFixed(S4_SCALE[k] ?? 3)));
  });
  Object.assign(out, flattenParts(src));
  return out;
}

function buildBatchPayload(items) {
  const stamp = Date.now();
  const batchId = `batch_${stamp}`;
  const changesetId = `changeset_${stamp}`;

  let body = `--${batchId}\r\n`;
  body += `Content-Type: multipart/mixed; boundary=${changesetId}\r\n\r\n`;

  items.forEach((item, idx) => {
    body += `--${changesetId}\r\n`;
    body += `Content-Type: application/http\r\n`;
    body += `Content-Transfer-Encoding: binary\r\n`;
    body += `Content-ID: ${idx + 1}\r\n\r\n`;
    body += `POST ModelPriceBreakupSet HTTP/1.1\r\n`;
    body += `Content-Type: application/json\r\n`;
    body += `Accept: application/json\r\n\r\n`;
    body += `${JSON.stringify(mapToS4Payload(item))}\r\n\r\n`;
  });

  body += `--${changesetId}--\r\n\r\n`;
  body += `--${batchId}--`;
  return { body, batchId };
}

function buildPostPriceBatchPayload(oBody) {
  const stamp = Date.now();
  const batchId = `batch_${stamp}`;
  const changesetId = `changeset_${stamp}`;

  let body = `--${batchId}\r\n`;
  body += `Content-Type: multipart/mixed; boundary=${changesetId}\r\n\r\n`;

  body += `--${changesetId}\r\n`;
  body += `Content-Type: application/http\r\n`;
  body += `Content-Transfer-Encoding: binary\r\n`;
  body += `Content-ID: 1\r\n\r\n`;
  body += `POST PostPriceSet HTTP/1.1\r\n`;
  body += `Content-Type: application/json\r\n`;
  body += `Accept: application/json\r\n\r\n`;
  body += `${JSON.stringify(oBody)}\r\n\r\n`;

  body += `--${changesetId}--\r\n\r\n`;
  body += `--${batchId}--`;

  return { body, batchId };
}

function buildRecallDeleteBatchPayload(sEntityUrl) {
  const batchId = 'batch';
  const changesetId = 'changeset';

  let body = `--${batchId}\r\n`;
  body += `Content-Type: multipart/mixed; boundary=${changesetId}\r\n\r\n`;

  body += `--${changesetId}\r\n`;
  body += `Content-Type: application/http\r\n`;
  body += `Content-Transfer-Encoding: binary\r\n\r\n`;

  body += `DELETE ${sEntityUrl} HTTP/1.1\r\n\r\n`;
  body += `Content-Type: application/json\r\n\r\n`;

  body += `--${changesetId}--\r\n\r\n`;
  body += `--${batchId}--\r\n`;

  return { body, batchId };
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(v);
}

function str(v) {
  return v === null || v === undefined ? "" : String(v);
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

const BASE_FROM_BREAKUP = [
  "Model", "ModelName", "SaveInd", "OperationNo", "Mail", "AsmName", "Region", "RegionName", "Basis",
  "DealerMargPerc", "InputNsp", "IncrementalNsp", "ActualNsp", "Helmet", "Transportation", "DealerCost",
  "OtherExpenses", "BikeMargin", "IncrementDlr", "ActualDealerMargin", "HelmetMargin", "TotalDealerMargin",
  "Ndp", "Basic", "Gst", "GstAftBasic", "GstPerc", "InputExShowroom", "ActualExShowroom", "ExceptionRef",
  "RtoPerc", "Rto", "RtoWithBill", "InsuranceLe350", "InsuranceGt350", "InsurancePerc", "Insurance",
  "TpaPa", "InsuranceGst", "ActualGst", "TotalInsurance", "OnRoad", "Diff", "ReferenceNum"
];
function baseFromBreakup(bp) {
  const o = {};
  BASE_FROM_BREAKUP.forEach(k => { o[k] = bp[k] ?? null; });
  // UI-friendly aliases (so the frontend mapping stays simple)
  o.DealerMarginPerc = bp.DealerMargPerc ?? null;
  o.insuranceperc = bp.InsurancePerc || "0";
  o.GSTPerc = bp.GstPerc ?? null;
  return o;
}

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
    PartsSet, SubmissionReference, ApproverSet, VariantVariableSet, ReferenceNumSet, PostPriceSet,
    ModelInvalidSet, RegionInvalidSet, SubmissionReferenceRecallSet, revertData, PostPriceStatusSet
  } = this.entities;

  const getApproverMails = async () => {
    const aApprovers = await backendconnect.run(SELECT.from('ApproverSet'));
    return [...new Set(aApprovers.map(a => String(a.Mail ?? '').trim()).filter(Boolean))];
  };

  const readForAllMails = async (entityName) => {
    const aMails = await getApproverMails();
    const chunks = await Promise.all(
      aMails.map(m =>
        backendconnect.run(SELECT.from(entityName).where({ Mail: m }))
          .catch(err => { console.warn(`${entityName} failed for ${m}: ${err.message}`); return []; })
      )
    );
    return chunks.flat();
  };


const stra = (v) => (v === null || v === undefined ? "" : String(v));
const modelDescOf = (masters, code) =>
  stra((masters || []).find(m => m.ModelCode === code)?.Description);


  // ── READ passthroughs ──────────────────────────────────────────────────────
  // this.on('READ', RegionMasterSet, async (req) => backendconnect.read(req.query));
  this.on('READ', RegionMasterSet, () => readForAllMails('RegionMasterSet'));
  // this.on('READ', ModelMasterSet, async (req) => backendconnect.read(req.query));
  this.on('READ', ModelMasterSet, () => readForAllMails('ModelMasterSet'));
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
  this.on('READ', ModelInvalidSet, async (req) => backendconnect.read(req.query));
  this.on('READ', RegionInvalidSet, async (req) => backendconnect.read(req.query));
  this.on('READ', SubmissionReferenceRecallSet, async (req) => backendconnect.read(req.query));

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

      console.log(csrfResponse.data);
      console.log(csrfResponse.headers);


      const csrfToken = csrfResponse.headers['x-csrf-token'];
      const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');

      if (!csrfToken) {
        return req.reject(500, 'Failed to retrieve CSRF token or cookies from S/4');
      }

      // const { body, batchId } = buildBatchPayload(items);

      const chunkSize = 100000;

      let allResponses = [];

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);

        const { body, batchId } = buildBatchPayload(chunk);

        console.log('ModelName/RegionName sent:', chunk.map(i => [i.Model, i.ModelName, i.Region, i.RegionName]));
        console.log('Payload: ', body);


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

        // allResponses.push(response.data);
        const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const bad = raw.match(/HTTP\/1\.1 (4|5)\d\d[^\r\n]*/);
        if (bad) {
          const msg = (raw.match(/"value"\s*:\s*"([^"]+)"/) || [])[1] || bad[0];
          console.error('S/4 changeset failed:', raw);
          return req.reject(400, msg);   // whole changeset is rolled back by SAP
        }
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

      //new code -11/10

      // ── Mails allowed to read SubmissionReferenceSet (from ApproverSet) ──────
      const ApproverSet = await backendconnect.run(SELECT.from('ApproverSet'));
      const approverMails = [
        ...new Set(ApproverSet.map(a => String(a.Mail ?? '').trim()).filter(Boolean))
      ];
      console.log(`Approver mails for submission ref: ${approverMails.length}`);

      const fetchSubmissionRefs = async () => {
        const chunks = await Promise.all(
          approverMails.map(m =>
            backendconnect
              .run(SELECT.from('SubmissionReferenceSet').where({ Mail: m }))
              .catch(err => {
                console.warn(`SubmissionReferenceSet failed for ${m}: ${err.message}`);
                return [];
              })
          )
        );
        const seen = new Set();
        return chunks.flat().filter(s => {
          if (seen.has(s.ReferenceNum)) return false;
          seen.add(s.ReferenceNum);
          return true;
        });
      };


      // const [
      //   regionMasterRaw,
      //   modelMasterRaw,
      //   pricingComponentsSetRaw,
      //   RTOMasterSetRaw,
      //   RTOExpenseSetRaw,
      //   GMAComponentsSetRaw,
      //   ModelPriceBreakupSet,
      //   PartsSetRaw,
      //   VariantVariableSet,
      //   SubmissionReferenceSet
      // ] = await Promise.all([
      //   backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
      //   backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
      //   backendconnect.run(SELECT.from('VariantVariableSet')),
      //   // backendconnect.run(SELECT.from('SubmissionReferenceSet'))
      //   fetchSubmissionRefs()
      // ]);

      const fetchByMails = async (entityName) => {
        const chunks = await Promise.all(
          approverMails.map(m =>
            backendconnect
              .run(SELECT.from(entityName).where({ Mail: m }))
              .catch(err => {
                console.warn(`${entityName} failed for ${m}: ${err.message}`);
                return [];
              })
          )
        );

        return chunks.flat();
      };


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
        fetchByMails('RegionMasterSet'),
        fetchByMails('ModelMasterSet'),
        fetchByMails('PricingComponentsSet'),
        fetchByMails('RtoMasterSet'),
        fetchByMails('RTOExpenseSet'),
        fetchByMails('GMAComponentsSet'),
        backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
        fetchByMails('PartsSet'),
        backendconnect.run(SELECT.from('VariantVariableSet')),
        fetchSubmissionRefs()
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
          // const HelmetMargin = Number(pricing.HelmetMargin) || 292;

          // new update 18-19 
          const HelmetMargin = Number(model.HelmetMargin);

          const GST_FACTOR = 1 + GST / 100;

          const evPricing = pricingComponentsSet.find(p =>
            p.Region === regionCodeStr && p.EngineType === "ICE"
          ) || pricing;

          const Insurance_GST = ccValue <= 450
            ? Number(evPricing.InsuranceLe350)
            : Number(evPricing.InsuranceGt350);

          const MTS_NSP = Number(mtsRecord.ActualNsp);
          const MTS_Helmet = Number(mtsRecord.Helmet);
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
          let MTO_OnRoad_Final_expected = null;

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

              MTO_OnRoad_Final_expected =
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

          const MTS_OnRoad_Final = MTS_OnRoad_Calculated;                 // 2,16,158 (6% RTO)
          const ExpectedOnRoad_NoSlabJump = MTO_Expected_OnRoad;          // 2,24,438
          const OnRoadDiff = MTO_OnRoad_Final - MTO_Expected_OnRoad;      // 4,021

          results.push({
            Model: displayModel,
            ReferModel: referenceModel,
            ModelName: modelDescOf(modelMaster, displayModel),
            Description: modelDescOf(modelMaster, displayModel),
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

            // OnRoad: roundToWholeWith00(MTO_OnRoad_Final_expected) || roundToWholeWith00(MTO_OnRoad_Final),

            OnRoad: RtoSlabChanged
              ? roundToWholeWith00(MTO_OnRoad_Final_expected)   // Scenario 5: 2,28,459
              : roundToWholeWith00(MTO_OnRoad_Final),           // normal flow

            MTOOnRoad: roundToWholeWith00(MTO_OnRoad_Final),
            ExpectedOnRoad: roundToWholeWith00(MTO_OnRoad_Final),

            MiyExShowroomTotal: to2(miyExShowroomTotal),
            MiyOnRoadTotal: to2(miyOnRoadTotal),
            MiyBreakup: miyBreakup,

            MTSExshowroom: roundToWholeWith00(MTSExshowroom),
            // MTSOnRoad: roundToWholeWith00(MTO_OnRoad_Final - miyOnRoadTotal),
            MTSOnRoad: MTS_OnRoad_Final,
            MTOExshowroomafterGMA: roundToWholeWith00(MTSExshowroom + miyExShowroomTotal),
            MTO_NSP: roundToWholeWith00(MTO_NSP),
            MTO_Exshowroom: roundToWholeWith00(MTO_ExShowroom),
          });
        }

        return results;
      }

      // else if (MTOStatus === "GeM" || MTOStatus === "GEM") {
      //   const DISCOUNT_PERC = 12;

      //   const approvedRefs = new Set(
      //     SubmissionReferenceSet
      //       .filter(s => s.Status === "APPROVED")
      //       .map(s => s.ReferenceNum)
      //   );

      //   // ── Only approved MTS records
      //   // let approvedMtsBreakups = ModelPriceBreakupSet.filter(bp =>
      //   //   bp.MtoMts === "MTS" &&
      //   //   approvedRefs.has(bp.ReferenceNum)
      //   // );

      //   let approvedMtsBreakups = ModelPriceBreakupSet.filter(bp =>
      //     bp.MtoMts === "MTS" &&
      //     approvedRefs.has(bp.ReferenceNum) &&
      //     String(bp.Region ?? "").trim().padStart(3, "0") === regionCodeStr
      //   );

      //   if (aModelFilter) {
      //     approvedMtsBreakups = approvedMtsBreakups.filter(bp => aModelFilter.includes(bp.Model));
      //   }

      //   if (!approvedMtsBreakups.length) {
      //     return req.error(404, `No approved MTS pricing data found for GeM calculation`);
      //   }

      //   // ── STEP 1: for EACH REGION, find the single record (model) with the lowest ExShowroom
      //   const lowestByRegion = new Map();
      //   for (const bp of approvedMtsBreakups) {
      //     const exShow = Number(bp.ActualExShowroom ?? 0);
      //     if (!exShow) continue;

      //     // normalized so "West" / "WEST " are treated as the same region
      //     const regionKey = String(bp.Region ?? "").trim().toUpperCase();
      //     const existing = lowestByRegion.get(regionKey);
      //     if (!existing || exShow < Number(existing.ActualExShowroom)) {
      //       lowestByRegion.set(regionKey, bp);
      //     }
      //   }

      //   if (!lowestByRegion.size) {
      //     return req.error(404, `No records with valid ActualExShowroom found for GeM calculation`);
      //   }

      //   const HELMET_COST_KEY = "GEM_HELMET_COST";
      //   const helmetEntry = VariantVariableSet.find(v => v.Low === HELMET_COST_KEY);
      //   const helmetCost = helmetEntry ? Number(helmetEntry.High) : 1338;

      //   const gemResults = [];

      //   // ── One iteration per region, using only that region's lowest model
      //   for (const bp of lowestByRegion.values()) {
      //     const modelCode = bp.Model;
      //     const MtsExShowroom = Number(bp.ActualExShowroom);

      //     const model = relevantModels.find(m => m.ModelCode === modelCode);
      //     if (!model) {
      //       console.warn(`GeM: model master missing for ${modelCode} (${bp.Region}) — skipping`);
      //       continue;
      //     }

      //     const GST = Number(model.GstPerc);
      //     if (!GST) {
      //       console.warn(`GeM: GstPerc missing/zero for model ${modelCode} (${bp.Region}) — skipping`);
      //       continue;
      //     }

      //     // ── STEP 2: 12% discount on the region's lowest ex-showroom
      //     const DiscountAmount = MtsExShowroom * (DISCOUNT_PERC / 100);
      //     const SubTotal = MtsExShowroom - DiscountAmount; // new derived ex-showroom

      //     // ── STEP 3 & 4: reverse-calculate Basic from the derived ex-showroom
      //     // SubTotal = (Basic + HelmetCost) * (1 + GST/100)
      //     const BasicInclHelmet = SubTotal / (1 + GST / 100);
      //     const GstAmount = SubTotal - BasicInclHelmet;
      //     const Basic = SubTotal - GstAmount; // your original logic
      //     // To deduct helmet cost, use instead:
      //     // const Basic = BasicInclHelmet - helmetCost;

      //     // gemResults.push({
      //     //   Model: bp.Model, SaveInd: bp.SaveInd, OperationNo: bp.OperationNo,
      //     //   Mail: bp.Mail, AsmName: bp.AsmName, Region: bp.Region,
      //     //   MtoMts: "GeM", Basis: bp.Basis,
      //     //   DealerMarginPerc: bp.DealerMargin ?? null, DealerMarigin: bp.BikeMargin ?? null,
      //     //   insuranceperc: bp.InsurancePerc || "0",
      //     //   InputNsp: bp.InputNsp, IncrementalNsp: bp.IncrementalNsp, ActualNsp: bp.ActualNsp,
      //     //   Helmet: bp.Helmet, Transportation: bp.Transportation, DealerCost: bp.DealerCost,
      //     //   OtherExpenses: bp.OtherExpenses, BikeMargin: bp.BikeMargin, IncrementDlr: bp.IncrementDlr,
      //     //   ActualDealerMargin: bp.ActualDealerMargin, HelmetMargin: bp.HelmetMargin,
      //     //   TotalDealerMargin: bp.TotalDealerMargin, Ndp: bp.Ndp,
      //     //   Basic: bp.Basic, Gst: bp.Gst,
      //     //   InputExShowroom: bp.InputExShowroom, ExceptionRef: bp.ExceptionRef,
      //     //   RtoPerc: bp.RtoPerc, Rto: bp.Rto, RtoWithBill: bp.RtoWithBill,
      //     //   InsuranceLe350: bp.InsuranceLe350, InsuranceGt350: bp.InsuranceGt350,
      //     //   Insurance: bp.Insurance, TpaPa: bp.TpaPa, ActualGst: bp.ActualGst,
      //     //   TotalInsurance: bp.TotalInsurance, OnRoad: bp.OnRoad,
      //     //   ActualExShowroom: bp.ActualExShowroom,
      //     //   Diff: bp.Diff, ReferenceNum: bp.ReferenceNum,
      //     //   GstPerc: bp.GstPerc,

      //     //   // GeM-derived fields
      //     //   MtsExShowroom: roundToWholeWith00(MtsExShowroom),
      //     //   DiscountPerc: DISCOUNT_PERC,
      //     //   DiscountAmount: roundToWholeWith00(DiscountAmount),
      //     //   SubTotal: roundToWholeWith00(SubTotal),

      //     //   GemGstPerc: to0(GST),
      //     //   HelmetCost: to2(helmetCost),
      //     //   GemBasic: roundToWholeWith00(Basic),
      //     //   GemGstAmount: roundToWholeWith00(GstAmount),

      //     //   FinalGeMPrice: roundToWholeWith00(SubTotal)
      //     // });

      //     gemResults.push({
      //       ...baseFromBreakup(bp),
      //       ModelName: bp.ModelName || model.Description || "",
      //       RegionName: bp.RegionName || region.Ort01 || "",
      //       MtoMts: "GeM",

      //       MtsExshwroom: roundToWholeWith00(MtsExShowroom),
      //       DiscPerc: to2(DISCOUNT_PERC),
      //       DiscAmount: roundToWholeWith00(DiscountAmount),
      //       SubTotal: roundToWholeWith00(SubTotal),
      //       GemGstPerc: to0(GST),
      //       HelmetCost: to2(helmetCost),
      //       GemBasic: roundToWholeWith00(Basic),
      //       GemGstAmount: roundToWholeWith00(GstAmount),
      //       FinalGemPrice: roundToWholeWith00(SubTotal),

      //       // old names kept so the current UI bindings keep working
      //       MtsExShowroom: roundToWholeWith00(MtsExShowroom),
      //       DiscountPerc: DISCOUNT_PERC,
      //       DiscountAmount: roundToWholeWith00(DiscountAmount),
      //       FinalGeMPrice: roundToWholeWith00(SubTotal)
      //     });
      //   }

      //   return gemResults;
      // }

      else if (MTOStatus === "GeM" || MTOStatus === "GEM") {
        const DISCOUNT_PERC = 12;

        const approvedRefs = new Set(
          SubmissionReferenceSet
            .filter(s => s.Status === "APPROVED")
            .map(s => s.ReferenceNum)
        );

        // ── Approved MTS records, ALL regions (Pan India) – no region filter
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

        // ── STEP 1: for EACH MODEL, find the record with the lowest ExShowroom across Pan India
        const lowestByModel = new Map();
        for (const bp of approvedMtsBreakups) {
          const exShow = Number(bp.ActualExShowroom ?? 0);
          if (!exShow) continue;

          const modelKey = String(bp.Model ?? "").trim();
          const existing = lowestByModel.get(modelKey);
          if (!existing || exShow < Number(existing.ActualExShowroom)) {
            lowestByModel.set(modelKey, bp);
          }
        }

        if (!lowestByModel.size) {
          return req.error(404, `No records with valid ActualExShowroom found for GeM calculation`);
        }

        // ── Helmet cost from TVARVC (maintained table)
        const HELMET_COST_KEY = "GEM_HELMET_COST";
        // const DEFAULT_HELMET_COST = 1134;

        const helmetEntry = VariantVariableSet.find(v => v.Low === HELMET_COST_KEY);
        let helmetCost = Number(helmetEntry?.High);

        if (!helmetCost || isNaN(helmetCost)) {
          // console.warn(`GeM: ${HELMET_COST_KEY} not maintained in TVARVC, using default ${DEFAULT_HELMET_COST}`);
          // helmetCost = DEFAULT_HELMET_COST;

          req.error(400, 'GeM: ${HELMET_COST_KEY} not maintained in TVARVC')
        }

        const gemResults = [];

        // ── One iteration per model, using that model's Pan India lowest ex-showroom
        for (const bp of lowestByModel.values()) {
          const modelCode = bp.Model;
          const MtsExShowroom = Number(bp.ActualExShowroom);

          const model = relevantModels.find(m => m.ModelCode === modelCode);
          if (!model) {
            console.warn(`GeM: model master missing for ${modelCode} — skipping`);
            continue;
          }

          const GST = Number(model.GstPerc);
          if (!GST) {
            console.warn(`GeM: GstPerc missing/zero for model ${modelCode} — skipping`);
            continue;
          }

          // ── STEP 2: 12% discount (rounded first, as in the example: 16,721)
          const DiscountAmount = Math.round(MtsExShowroom * DISCOUNT_PERC / 100);
          const SubTotal = MtsExShowroom - DiscountAmount;   // new derived ex-showroom

          // ── STEP 3 & 4: reverse calculation
          // SubTotal = (Basic + HelmetCost) * (1 + GST/100)
          const BasicInclHelmet = SubTotal / (1 + GST / 100);
          const GstAmount = SubTotal - BasicInclHelmet;
          const Basic = SubTotal - GstAmount;

          gemResults.push({
            ...baseFromBreakup(bp),
            ModelName: bp.ModelName || model.Description || "",
            RegionName: bp.RegionName || "",   // region where the lowest price was found
            MtoMts: "GeM",

            MtsExshwroom: roundToWholeWith00(MtsExShowroom),
            DiscPerc: to2(DISCOUNT_PERC),
            DiscAmount: roundToWholeWith00(DiscountAmount),
            SubTotal: roundToWholeWith00(SubTotal),
            GemGstPerc: to0(GST),
            HelmetCost: to2(helmetCost),
            GemBasic: roundToWholeWith00(Basic),
            GemGstAmount: roundToWholeWith00(GstAmount),
            FinalGemPrice: roundToWholeWith00(SubTotal),

            // old names kept so the current UI bindings keep working
            MtsExShowroom: roundToWholeWith00(MtsExShowroom),
            DiscountPerc: DISCOUNT_PERC,
            DiscountAmount: roundToWholeWith00(DiscountAmount),
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

        const incidentalEntry = VariantVariableSet.find(v => v.Low === "CSD_INCIDENTCHARGE_PERCENT");
        const incidentalRate = Number(incidentalEntry.High);

        if (!incidentalRate || isNaN(incidentalRate)) {

          req.error(400, 'CSD: ${CSD_INCIDENTCHARGE_PERCENT} not maintained in TVARVC')
        }

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
            ...baseFromBreakup(bp),
            ModelName: bp.ModelName || model.Description || "",
            RegionName: bp.RegionName || region.Ort01 || "",
            MtoMts: "CSD",

            CsdNsp: roundToWholeWith00(CsdNsp),
            BasicPriceWo: roundToWholeWith00(BasicPrice),
            CsdDiscPerc: to2(CsdDisPerc),
            Csd: roundToWholeWith00(DiscountAmount),
            PretaxNetDisc: roundToWholeWith00(PreTaxNetDiscount),
            CsdGstPerc: to2(GstPerc),
            CsdGstAmount: roundToWholeWith00(GstAmount),
            CsdExshwroom: roundToWholeWith00(CsdExShowroom),
            IncidentalPerc: to2(incidentalRate),
            IncidentalCharges: roundToWholeWith00(IncidentalCharges),
            FinalCsdPrice: roundToWholeWith00(FinalCSDPrice),
            CsdOnroad: roundToWholeWith00(CsdOnRoad),


          });
        }
        return csdResults;
      }


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
          // const HelmetMargin = Number(evPricing.HelmetMargin);

          //new change
          const HelmetMargin = Number(model.HelmetMargin);

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
            ModelName: modelDescOf(modelMaster, displayModel),
            Description: modelDescOf(modelMaster, displayModel),
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

          // ── Mails allowed to read SubmissionReferenceSet (from ApproverSet) ──────
          const ApproverSet = await backendconnect.run(SELECT.from('ApproverSet'));
          const approverMails = [
            ...new Set(ApproverSet.map(a => String(a.Mail ?? '').trim()).filter(Boolean))
          ];
          console.log(`Approver mails for submission ref: ${approverMails.length}`);

          const fetchSubmissionRefs = async () => {
            const chunks = await Promise.all(
              approverMails.map(m =>
                backendconnect
                  .run(SELECT.from('SubmissionReferenceSet').where({ Mail: m }))
                  .catch(err => {
                    console.warn(`SubmissionReferenceSet failed for ${m}: ${err.message}`);
                    return [];
                  })
              )
            );
            const seen = new Set();
            return chunks.flat().filter(s => {
              if (seen.has(s.ReferenceNum)) return false;
              seen.add(s.ReferenceNum);
              return true;
            });
          };


          // const [
          //   regionMasterRaw,
          //   modelMasterRaw,
          //   pricingComponentsSetRaw,
          //   RTOMasterSetRaw,
          //   RTOExpenseSetRaw,
          //   GMAComponentsSetRaw,
          //   ModelPriceBreakupSetRaw,
          //   PartsSetRaw,
          //   VariantVariableSetRaw,
          //   SubmissionReferenceSetRaw
          // ] = await Promise.all([
          //   backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
          //   backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
          //   backendconnect.run(SELECT.from('VariantVariableSet')),
          //   backendconnect.run(SELECT.from('SubmissionReferenceSet'))
          // ]);


          const fetchByMails = async (entityName) => {
            const chunks = await Promise.all(
              approverMails.map(m =>
                backendconnect
                  .run(SELECT.from(entityName).where({ Mail: m }))
                  .catch(err => {
                    console.warn(`${entityName} failed for ${m}: ${err.message}`);
                    return [];
                  })
              )
            );

            return chunks.flat();
          };


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

            // backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
            fetchByMails('RegionMasterSet'),
            // backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
            fetchByMails('ModelMasterSet'),
            // backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
            fetchByMails('PricingComponentsSet'),
            // backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
            fetchByMails('RtoMasterSet'),
            // backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
            fetchByMails('RTOExpenseSet'),
            // backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
            fetchByMails('GMAComponentsSet'),
            backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
            // backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
            fetchByMails('PartsSet'),
            backendconnect.run(SELECT.from('VariantVariableSet')),
            // backendconnect.run(SELECT.from('SubmissionReferenceSet'))
            fetchSubmissionRefs()
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
            // const HelmetMargin = Number(pricing.HelmetMargin) || 292;
            //new change
            const HelmetMargin = Number(model.HelmetMargin);
            const GST_FACTOR = 1 + GST / 100;
            const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
            const insurance = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);

            const MTS_NSP = Number(mtsRecord.ActualNsp);
            const MTS_Helmet = Number(mtsRecord.Helmet);
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

      const ApproverSet = await backendconnect.run(SELECT.from('ApproverSet'));
      const approverMails = [
        ...new Set(ApproverSet.map(a => String(a.Mail ?? '').trim()).filter(Boolean))
      ];
      console.log(`Approver mails for submission ref: ${approverMails.length}`);

      const fetchByMails = async (entityName) => {
        const chunks = await Promise.all(
          approverMails.map(m =>
            backendconnect
              .run(SELECT.from(entityName).where({ Mail: m }))
              .catch(err => {
                console.warn(`${entityName} failed for ${m}: ${err.message}`);
                return [];
              })
          )
        );

        return chunks.flat();
      };

      const [
        regionMasterRaw,
        modelMasterRaw,
        pricingComponentRaw,
        RtoMasterSetRaw,
        RTOExpenseSetRaw,
        VariantVariableSet
      ] = await Promise.all([
        // backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
        fetchByMails('RegionMasterSet'),
        // backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
        fetchByMails('ModelMasterSet'),
        // backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
        fetchByMails('PricingComponentsSet'),
        // backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
        fetchByMails('RtoMasterSet'),
        // backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
        fetchByMails('RTOExpenseSet'),
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
        // const Helmet = Number(pricingComponents.Helmet) || 1279;
        // New change

        const Helmet = Number(model.Helmet);

        const Transportation = Number(pricingComponents.Transportation);
        // const HelmetMarigin = Number(pricingComponents.HelmetMargin) || 292;

        const HelmetMarigin = Number(model.HelmetMargin);

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
            ModelName: stra(model.Description),
            Description: stra(model.Description),
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
              insuranceperc: bp.InsurancePerc || "0",
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

    // ── Mails allowed to read SubmissionReferenceSet (from ApproverSet) ──────
    const ApproverSet = await backendconnect.run(SELECT.from('ApproverSet'));
    const approverMails = [
      ...new Set(ApproverSet.map(a => String(a.Mail ?? '').trim()).filter(Boolean))
    ];
    console.log(`Approver mails for submission ref: ${approverMails.length}`);

    const fetchSubmissionRefs = async () => {
      const chunks = await Promise.all(
        approverMails.map(m =>
          backendconnect
            .run(SELECT.from('SubmissionReferenceSet').where({ Mail: m }))
            .catch(err => {
              console.warn(`SubmissionReferenceSet failed for ${m}: ${err.message}`);
              return [];
            })
        )
      );
      const seen = new Set();
      return chunks.flat().filter(s => {
        if (seen.has(s.ReferenceNum)) return false;
        seen.add(s.ReferenceNum);
        return true;
      });
    };

    const fetchByMails = async (entityName) => {
      const chunks = await Promise.all(
        approverMails.map(m =>
          backendconnect
            .run(SELECT.from(entityName).where({ Mail: m }))
            .catch(err => {
              console.warn(`${entityName} failed for ${m}: ${err.message}`);
              return [];
            })
        )
      );

      return chunks.flat();
    };

    // ── Base fetches (always needed) ─────────────────────────────────────────
    const basePromise = Promise.all([
      // backendconnect.run(SELECT.from('RegionMasterSet').where({ Mail })),
      fetchByMails('RegionMasterSet'),
      // backendconnect.run(SELECT.from('ModelMasterSet').where({ Mail })),
      fetchByMails('ModelMasterSet'),
      // backendconnect.run(SELECT.from('PricingComponentsSet').where({ Mail })),
      fetchByMails('PricingComponentsSet'),
      // backendconnect.run(SELECT.from('RtoMasterSet').where({ Mail })),
      fetchByMails('RtoMasterSet'),
      // backendconnect.run(SELECT.from('RTOExpenseSet').where({ Mail })),
      fetchByMails('RTOExpenseSet'),
      backendconnect.run(SELECT.from('VariantVariableSet')),
    ]);

    // ── MTO-only fetches (fired in parallel with base) ────────────────────────
    const mtoPromise = MTOStatus === "MTO"
      ? Promise.all([
        // backendconnect.run(SELECT.from('GMAComponentsSet').where({ Mail })),
        fetchByMails('GMAComponentsSet'),
        // backendconnect.run(SELECT.from('ModelPriceBreakupSet')),
        fetchByMails('ModelPriceBreakupSet'),
        // backendconnect.run(SELECT.from('PartsSet').where({ Mail })),
        fetchByMails('PartsSet'),
        // backendconnect.run(SELECT.from('SubmissionReferenceSet')),
        fetchSubmissionRefs()
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
          // const HelmetMargin = Number(pricing.HelmetMargin) || 50;
          // new change

          const HelmetMargin = Number(model.HelmetMargin);

          const GST_FACTOR = 1 + GST / 100;

          const Insurance_GST_Actual = getInsuranceGstActual(ccValue, VariantVariableSet);
          const insurance = ccValue <= 350 ? Number(pricing.InsuranceLe350) : Number(pricing.InsuranceGt350);

          const MTS_NSP = Number(mtsRecord.ActualNsp);
          const MTS_Helmet = Number(mtsRecord.Helmet);
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
            ModelName: modelDescOf(modelMaster, displayModel),
            Description: modelDescOf(modelMaster, displayModel),
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
          // const Helmet = Number(pricing.Helmet);
          //new change
          const Helmet = Number(model.Helmet);

          const Transportation = Number(pricing.Transportation);
          // const HelmetMargin = Number(pricing.HelmetMargin);
          //new change

          const HelmetMargin = Number(model.HelmetMargin);

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
            ModelName: stra(model.Description),
            Description: stra(model.Description),
            success: true,
            BasisRto: region.BasisRto,
            DealerMarigin: roundToWholeWith00(DealerMarigin),
            Helmet: roundToWholeWith00(Helmet),
            Transportation: to2(Transportation),
            DealerCost: roundToWholeWith00(DealerCost),
            OtherExpenses: to2(otherExpenses),
            HelmetMarigin: roundToWholeWith00(HelmetMargin),
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

      console.log(response);


      console.log("S/4 MERGE response:", response.status, response.data);
      return response.status;

    } catch (e) {
      console.error("S/4 update failed:", e.response?.data || e.message);
      return req.error(
        e.response?.status || 500,
        e.response?.data?.error?.message?.value || e.message || "Failed to update submission"
      );
    }
  });


  this.on("DELETE", SubmissionReferenceRecallSet, async (req) => {
    console.log("🔥 Custom DELETE handler reached for SubmissionReferenceRecallSet");
    console.log("🔥 Custom DELETE handler reached");
    console.log("ReferenceNum:", req.params[0]?.ReferenceNum);


    const { ReferenceNum } = req.params[0] || {};


    if (!ReferenceNum) {
      return req.error(400, "ReferenceNum is required");
    }

    try {

      const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

      const csrfResponse = await executeHttpRequest(destination, {
        method: 'GET',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/SubmissionReferenceSet',
        headers: { 'X-CSRF-Token': 'Fetch', 'Accept': 'application/json' }
      });

      const csrfToken = csrfResponse.headers['x-csrf-token'];
      const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');

      console.log(csrfResponse.data);
      console.log(csrfResponse.headers);


      // ✅ only require the token — matches saveToModelPriceBreakUp's working pattern
      if (!csrfToken) {
        return req.error(500, 'Failed to retrieve CSRF token from S/4');
      }

      const sEntityUrl = `SubmissionReferenceRecallSet(ReferenceNum='${encodeURIComponent(ReferenceNum)}')`;
      const { body, batchId } = buildRecallDeleteBatchPayload(sEntityUrl);

      const response = await executeHttpRequest(destination, {
        method: 'POST',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/$batch',
        headers: {
          'Content-Type': `multipart/mixed; boundary=${batchId}`,
          'Accept': 'multipart/mixed',
          'X-CSRF-Token': csrfToken,
          'Cookie': cookies

        },
        data: body
      });

      console.log("S/4 BATCH DELETE raw response:", response.status, response.data);

      const sResponseText = typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

      const bInnerSuccess = /HTTP\/1\.1 20[04]/.test(sResponseText);

      if (!bInnerSuccess) {
        console.error("Batch DELETE failed inside changeset:", sResponseText);
        return req.error(500, "Recall failed — batch operation returned an error");
      }

      // return req.reply({ success: true, ReferenceNum });
      return `Submission ${ReferenceNum} recalled successfully`;

    } catch (e) {


      console.error("S/4 batch delete failed — status:", e.response?.status);
      console.error("S/4 batch delete failed — raw body:", e.response?.data);
      console.error("S/4 batch delete failed — message:", e.message);
      console.error("S/4 batch delete failed:", e.response?.data || e.message);

      return req.error(
        e.response?.status || 500,
        e.response?.data?.error?.message?.value || e.message || "Failed to recall submission"
      );
    }
  });

  this.on('READ', ReferenceNumSet, async (req) => backendconnect.read(req.query));


  //post price logic for date

  // this.on("CREATE", PostPriceSet, async (req) => {
  //   const { ReferenceNum, StockTransferDate, DealerBillingDate, CustomerBillingDate, CsdDate, GemDate, UpdatedOn, UpdatedBy } = req.data;

  //   if (!ReferenceNum) return req.error(400, "Refernce number is required")


  //   try {
  //     const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

  //     const csrfResponse = await executeHttpRequest(destination, {
  //       method: 'GET',
  //       url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/PostPriceSet',
  //       headers: { 'X-CSRF-Token': 'Fetch', 'Accept': 'application/json' }
  //     });

  //     const csrfToken = csrfResponse.headers['x-csrf-token'];
  //     // const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
  //     if (!csrfToken) return req.error(500, 'Failed to retrieve CSRF token from S/4');

  //     const toODataDate = (date) => {
  //       if (!date) return null;
  //       const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  //       return `/Date(${ms})/`;
  //     };

  //     const oBody = {
  //       ReferenceNum,
  //       StockTransferDate: StockTransferDate ? toODataDate(StockTransferDate) : null,
  //       DealerBillingDate: DealerBillingDate ? toODataDate(DealerBillingDate) : null,
  //       CustomerBillingDate: CustomerBillingDate ? toODataDate(CustomerBillingDate) : null,
  //       CsdDate: CsdDate ? toODataDate(CsdDate) : null,
  //       GemDate: GemDate ? toODataDate(GemDate) : null,

  //       UpdatedOn: UpdatedOn ? toODataDate(UpdatedOn) : null,
  //       UpdatedBy: UpdatedBy || ""
  //     };

  //     const entityUrl = `/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/PostPriceSet(ReferenceNum='${encodeURIComponent(ReferenceNum)}')`;

  //     console.log(oBody);

  //     const response = await executeHttpRequest(destination, {
  //       method: 'POST',
  //       url: entityUrl,
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Accept': 'application/json',
  //         'X-CSRF-Token': csrfToken,
  //         // 'Cookie': cookies
  //       },
  //       data: oBody
  //     });

  //     console.log("S/4 MERGE response:", response.status, response.data);
  //     return req.reply({ success: true, ...oBody });

  //   } catch (e) {
  //     console.error("S/4 update failed:", e.response?.data || e.message);
  //     return req.error(
  //       e.response?.status || 500,
  //       e.response?.data?.error?.message?.value || e.message || "Failed to update submission"
  //     );
  //   }
  // });

  this.on("CREATE", PostPriceSet, async (req) => {
    const { ReferenceNum, StockTransferDate, DealerBillingDate, CustomerBillingDate,
      CsdDate, GemDate, UpdatedOn, UpdatedBy } = req.data;

    if (!ReferenceNum) return req.error(400, "Reference number is required");

    try {
      const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

      // 1. Fetch CSRF token + session cookies
      const csrfResponse = await executeHttpRequest(destination, {
        method: 'GET',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/PostPriceSet',
        headers: { 'X-CSRF-Token': 'Fetch', 'Accept': 'application/json' }
      });

      const csrfToken = csrfResponse.headers['x-csrf-token'];
      const cookies = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
      if (!csrfToken) return req.error(500, 'Failed to retrieve CSRF token from S/4');

      const toODataDate = (date) => {
        if (!date) return null;
        const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
        return `/Date(${ms})/`;
      };

      const oBody = {
        ReferenceNum,
        StockTransferDate: toODataDate(StockTransferDate),
        DealerBillingDate: toODataDate(DealerBillingDate),
        CustomerBillingDate: toODataDate(CustomerBillingDate),
        CsdDate: toODataDate(CsdDate),
        GemDate: toODataDate(GemDate),
        UpdatedOn: toODataDate(UpdatedOn),
        UpdatedBy: UpdatedBy || ""
      };

      // 2. Build and send the batch
      const { body, batchId } = buildPostPriceBatchPayload(oBody);
      console.log('PostPrice batch payload:', body);

      const response = await executeHttpRequest(destination, {
        method: 'POST',
        url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/$batch',
        headers: {
          'Content-Type': `multipart/mixed; boundary=${batchId}`,
          'Accept': 'multipart/mixed',
          'X-CSRF-Token': csrfToken,
          ...(cookies && { 'Cookie': cookies })
        },
        data: body
      });

      // 3. $batch returns 202 even if the changeset failed, so inspect the inner response
      const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      console.log("S/4 BATCH response:", response.status, raw);

      const bad = raw.match(/HTTP\/1\.1 (4|5)\d\d[^\r\n]*/);
      if (bad) {
        const msg = (raw.match(/"message"\s*:\s*\{[^}]*"value"\s*:\s*"([^"]+)"/) || [])[1]
          || (raw.match(/<message[^>]*>([^<]+)<\/message>/) || [])[1]
          || bad[0];
        console.error('S/4 PostPrice changeset failed:', raw);
        return req.error(400, msg);
      }

      return req.reply({ success: response.status, ...oBody });

    } catch (e) {
      console.error("S/4 PostPrice batch failed:", e.response?.data || e.message);
      return req.error(
        e.response?.status || 500,
        e.response?.data?.error?.message?.value || e.message || "Failed to post price"
      );
    }
  });


  this.on('getApprovalDetailedData', async (req) => {
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

  //post price logic for date

  // this.on(checkpricingStatus, async () => {


  //   const ENTITIES = [
  //     'RegionMasterSet',
  //     'ModelMasterSet',
  //     'PricingComponentsSet',
  //     'RTOExpenseSet',
  //     'RtoMasterSet',
  //     'GMAComponentsSet',
  //     'PartsSet'
  //   ];

  //   const getApproverMails = async () => {
  //     const aApprovers = await backendconnect.run(SELECT.from('ApproverSet'));
  //     return [...new Set(aApprovers.map(a => String(a.Mail ?? '').trim()).filter(Boolean))];
  //   };

  //   // Reads one entity for all approver mails, optionally with an extra filter
  //   const readForAllMails = async (entityName, aMails, extraWhere = {}) => {
  //     const chunks = await Promise.all(
  //       aMails.map(m =>
  //         backendconnect
  //           .run(SELECT.from(entityName).where({ Mail: m, ...extraWhere }))
  //           .catch(err => {
  //             console.warn(`${entityName} failed for ${m}: ${err.message}`);
  //             return [];
  //           })
  //       )
  //     );
  //     return chunks.flat();
  //   };

  //   // Keep the READ handlers at service level (not inside the action)
  //   this.on('READ', RegionMasterSet, async () => readForAllMails('RegionMasterSet', await getApproverMails()));
  //   this.on('READ', ModelMasterSet, async () => readForAllMails('ModelMasterSet', await getApproverMails()));
  //   this.on('READ', PricingComponentsSet, async () => readForAllMails('PricingComponentsSet', await getApproverMails()));
  //   this.on('READ', RTOExpenseSet, async () => readForAllMails('RTOExpenseSet', await getApproverMails()));
  //   this.on('READ', RtoMasterSet, async () => readForAllMails('RtoMasterSet', await getApproverMails()));
  //   this.on('READ', GMAComponentsSet, async () => readForAllMails('GMAComponentsSet', await getApproverMails()));
  //   this.on('READ', PartsSet, async () => readForAllMails('PartsSet', await getApproverMails()));





  this.on('checkpricingStatus', async () => {
    console.log('💐 checkpricingStatus triggered');

    // Fetch all users and roles
    const aUsers = await backendconnect.run(
      SELECT.from('ApproverSet')
    );

    // Collect unique emails based on role
    const aSubmitterMails = [
      ...new Set(
        aUsers
          .filter(user => user.Role === 'SUBMITTER')
          .map(user => String(user.Mail ?? '').trim())
          .filter(Boolean)
      )
    ];

    const aApproverMails = [
      ...new Set(
        aUsers
          .filter(user =>
            ['APPROVER', 'APPROVER1', 'APPROVER2']
              .includes(user.Role)
          )
          .map(user => String(user.Mail ?? '').trim())
          .filter(Boolean)
      )
    ];

    console.log('Submitter emails:', aSubmitterMails);
    console.log('Approver emails:', aApproverMails);

    // Entities to check
    const ENTITIES = [
      RegionMasterSet,
      ModelMasterSet,
      PricingComponentsSet,
      RTOExpenseSet,
      RtoMasterSet,
      GMAComponentsSet,
      PartsSet
    ];

    // Count records by role and status
    const getStatusCounts = async (entityName) => {
      const counts = {
        submitter: {
          total: 0,
          submitted: 0,
          approved: 0
        },
        approver: {
          submitted: 0,
          approved: 0
        }
      };

      try {
        // Submitters: fetch all their records
        if (aSubmitterMails.length > 0) {
          const submitterRecords = await backendconnect.run(
            SELECT.from(entityName)
              .columns('Mail', 'Status')
              .where({
                Mail: { in: aSubmitterMails }
              })
          );

          counts.submitter.total = submitterRecords.length;

          for (const record of submitterRecords) {
            if (record.Status === 'SUBMITTED') {
              counts.submitter.submitted++;
            } else if (record.Status === 'APPROVED') {
              counts.submitter.approved++;
            }
          }
        }

        // Approvers: fetch SUBMITTED and APPROVED records
        if (aApproverMails.length > 0) {
          const approverRecords = await backendconnect.run(
            SELECT.from(entityName)
              .columns('Mail', 'Status')
              .where({
                Mail: { in: aApproverMails },
                Status: { in: ['SUBMITTED', 'APPROVED'] }
              })
          );

          for (const record of approverRecords) {
            if (record.Status === 'SUBMITTED') {
              counts.approver.submitted++;
            } else if (record.Status === 'APPROVED') {
              counts.approver.approved++;
            }
          }
        }
      } catch (error) {
        console.error(
          `${entityName} failed: ${error.message}`
        );
      }

      return counts;
    };

    // Process all entities in parallel
    const results = await Promise.all(
      ENTITIES.map(async entity => ({
        entity,
        ...(await getStatusCounts(entity))
      }))
    );

    // Entity-wise summary
    const summary = Object.fromEntries(
      results.map(result => [
        result.entity,
        {
          submitter: result.submitter,
          approver: result.approver
        }
      ])
    );

    // Overall totals
    const totalSubmitterRecords = results.reduce(
      (sum, result) => sum + result.submitter.total,
      0
    );

    const totalSubmitterSubmitted = results.reduce(
      (sum, result) => sum + result.submitter.submitted,
      0
    );

    const totalSubmitterApproved = results.reduce(
      (sum, result) => sum + result.submitter.approved,
      0
    );

    const totalApproverSubmitted = results.reduce(
      (sum, result) => sum + result.approver.submitted,
      0
    );

    const totalApproverApproved = results.reduce(
      (sum, result) => sum + result.approver.approved,
      0
    );

    return {
      submitter: {
        totalRecords: totalSubmitterRecords,
        totalSubmitted: totalSubmitterSubmitted,
        totalApproved: totalSubmitterApproved
      },
      approver: {
        totalSubmitted: totalApproverSubmitted,
        totalApproved: totalApproverApproved
      },
      summary
    };
  });


  this.on('CREATE', PostPriceStatusSet, async (req) => {
    console.log('💐 PostPriceStatusSet triggered');

    const { ReferenceNum } = req.data;

    const statusUpdate = await backendconnect.run(
      SELECT.from('PostPriceStatusSet').where({ ReferenceNum })
    );

    console.log("All records:", statusUpdate);

    return {
      value: statusUpdate
    };
  });

  this.on('getPostPriceStatus', async (req) => {
    const { refId } = req.data;
    if (!refId) return req.error(400, 'refId is required');

    try {
      return await backendconnect.run(
        SELECT.from('PostPriceStatusSet').where({ ReferenceNum: refId })
      );
    } catch (e) {
      console.error('getPostPriceStatus failed:', e);
      return req.error(e.response?.status || 500, e.message || 'Failed to fetch post price status');
    }
  });

});