sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/BusyDialog",
    "sap/ui/export/Spreadsheet"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyDialog, Spreadsheet) {
    "use strict";

    const GROUP_META = {
        CORE: { label: "Core Fields", chipClass: "vpGrpChip-CORE", colCount: 6 },
        DEALER: { label: "Dealer Margin", chipClass: "vpGrpChip-DEALER", colCount: 8 },
        PRICING: { label: "Price Breakup", chipClass: "vpGrpChip-PRICING", colCount: 4 },
        RTO: { label: "RTO", chipClass: "vpGrpChip-RTO", colCount: 4 },
        INSURANCE: { label: "Insurance", chipClass: "vpGrpChip-INSURANCE", colCount: 4 },
        GEM: { label: "GeM Extra Fields", chipClass: "vpGrpChip-GEM", colCount: 8 },
        CSD: { label: "CSD Extra Fields", chipClass: "vpGrpChip-CSD", colCount: 8 },
        MTO: { label: "MTO / MIY Fields", chipClass: "vpGrpChip-MTO", colCount: 7 }
    };

    const GROUP_WIDTHS = {
        CORE: 150 + 190 + 110 + 150 + 130 + 150,
        DEALER: 130 + 120 + 130 + 120 + 130 + 120 + 120 + 150,
        PRICING: 110 + 120 + 90 + 150,
        RTO: 140 + 85 + 110 + 140,
        INSURANCE: 120 + 110 + 90 + 150,
        GEM: 110 + 130 + 120 + 85 + 120 + 85 + 120 + 150,
        CSD: 110 + 120 + 120 + 85 + 120 + 150 + 140 + 150,
        MTO: 160 + 150 + 150 + 150 + 140 + 140 + 140
    };

    const EXCEL_FIELDS = {
        CORE: [
            { label: "Model", property: "Model" },
            { label: "Region", property: "Region" },
            { label: "Basis / RTO", property: "Basis" },
            { label: "Ex Showroom", property: "InputExShowroom" },
            { label: "NSP", property: "InputNsp" },
            { label: "On Road Price", property: "OnRoad" }
        ],
        DEALER: [
            { label: "Dealer Margin %", property: "DealerMarginPerc" },
            { label: "Helmet", property: "Helmet" },
            { label: "Transportation", property: "Transportation" },
            { label: "Dealer Cost", property: "DealerCost" },
            { label: "Other Expenses", property: "OtherExpenses" },
            { label: "Bike Margin", property: "BikeMargin" },
            { label: "Helmet Margin", property: "HelmetMargin" },
            { label: "Total Dealer Margin", property: "TotalDealerMargin" }
        ],
        PRICING: [
            { label: "NDP", property: "Ndp" },
            { label: "Basic", property: "Basic" },
            { label: "GST %", property: "GSTPerc" },
            { label: "GST Amount", property: "Gst" },
            { label: "Actual Ex Showroom", property: "ActualExShowroom" }
        ],
        RTO: [
            { label: "RTO %", property: "RtoPerc" },
            { label: "RTO", property: "Rto" },
            { label: "RTO With Bill", property: "RtoWithBill" }
        ],
        INSURANCE: [
            { label: "Insurance %", property: "insuranceperc" },
            { label: "Insurance", property: "Insurance" },
            { label: "TPA PA", property: "TpaPa" },
            { label: "GST After TPA", property: "ActualGst" },
            { label: "Total Insurance", property: "TotalInsurance" }
        ],
        GEM: [
            { label: "Discount %", property: "DiscountPerc" },
            { label: "Discount Amount", property: "DiscountAmount" },
            { label: "Sub Total", property: "SubTotal" },
            { label: "GST %", property: "GstPerc" },
            { label: "GST Amount", property: "GstAmount" },
            { label: "Cess %", property: "CessPerc" },
            { label: "Cess Amount", property: "CessAmount" },
            { label: "Final GeM Price", property: "FinalGeMPrice" }
        ],
        CSD: [
            { label: "CSD Discount %", property: "CsdDisPerc" },
            { label: "CSD Discount", property: "CSD" },
            { label: "Pre Tax Net", property: "PreTaxNetDiscount" },
            { label: "CSD GST %", property: "CsdGstPerc" },
            { label: "CSD GST Amount", property: "CsdGstAmount" },
            { label: "CSD Ex Showroom", property: "CsdExShowroom" },
            { label: "Incidental Charges", property: "IncidentalCharges" },
            { label: "Final CSD Price", property: "FinalCSDPrice" }
        ],
        MTO: [
            { label: "Refer MTS Model", property: "ReferMtsModel" },
            { label: "MTO NSP", property: "MtoNsp" },
            { label: "MIY Ex Showroom", property: "MiyExShowroom" },
            { label: "MIY On Road", property: "MiyOnRoad" }
        ]
    };

    return Controller.extend("vehiclepricingui.controller.vechilepricingmain", {

        onInit: async function () {
            const oView = this.getView();



            const oVM = new JSONModel({
                tableData: [],
                regionVS: "None",
                mtoVS: "None",
                selectedMto: "",
                hasGroupHeaders: false,
                colGrp: {
                    DEALER: false,
                    PRICING: false,
                    RTO: false,
                    INSURANCE: false,
                    GEM: false,
                    CSD: false,
                    MTO: false
                },
                processCalcEnabled: false,
                processCalcVisible: true,
                saveBtnEnabled: false,
                applyOtherEnabled: false,
                ASMEmail: "siva.durairaj@laderatechnology.com",
                ASMName: "Siva Durairaj",
                enableSaveActions: false,
                enableEditActions: false
            });

            this.getView().setModel(oVM, "vm");
            oView.setBusy(true);

            let sASMMail = oVM.getProperty("/ASMEmail");
            let sASMName = oVM.getProperty("/ASMName");

            if (sap.ushell && sap.ushell.Container) {
                try {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sASMMail = oUserInfo.getEmail();
                    sASMName = oUserInfo.getFullName();
                } catch (e) {
                    console.warn("Could not load user info from shell:", e);
                }
            }

            oVM.setProperty("/ASMEmail", sASMMail);
            oVM.setProperty("/ASMName", sASMName);

            await this._loadData(sASMMail);
            oView.setBusy(false);
        },

        // ── Formatters ────────────────────────────────────────────────────────
        uiInt: function (v) { const n = Number(v); return isNaN(n) ? 0 : Math.round(n); },
        uiDec: function (v, scale = 3) { const n = Number(v); return isNaN(n) ? 0 : Number(n.toFixed(scale)); },
        
        formatIndian: function (v) {
            if (v === null || v === undefined || v === "") return "";
            const n = Number(v);
            if (isNaN(n)) return v;
            const isNegative = n < 0;
            const absN = Math.abs(n);
            const [intPart, decPart] = absN.toFixed(2).split(".");
            let lastThree = intPart.slice(-3);
            const remaining = intPart.slice(0, -3);
            if (remaining) {
                lastThree = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
            }
            const formatted = lastThree + "." + decPart;
            return isNegative ? "-" + formatted : formatted;
        },

        // ── Status pill formatter ─────────────────────────────────────────────
        // Returns inline-styled HTML span — used with FormattedText in XML view
        formatStatusPill: function (sStatus) {
            const mConfig = {
                APPROVED: {
                    label: "Approved",
                    bg: "#e6f4ea",
                    color: "#1e7e34",
                    border: "#a8d5b5",
                    dot: "#1e7e34"
                },
                DRAFT: {
                    label: "Draft",
                    bg: "#fff4e5",
                    color: "#b85c00",
                    border: "#f5c07a",
                    dot: "#e07800"
                },
                NEW: {
                    label: "New",
                    bg: "#eef1fb",
                    color: "#3a5bc7",
                    border: "#b8c4f0",
                    dot: "#3a5bc7"
                }
            };

            const cfg = mConfig[sStatus] || mConfig.NEW;

            return (
                `<span style="` +
                `display:inline-flex;` +
                `align-items:center;` +
                `gap:4px;` +
                `padding:2px 9px;` +
                `border-radius:12px;` +
                `background:${cfg.bg};` +
                `border:1px solid ${cfg.border};` +
                `font-size:11px;` +
                `font-weight:500;` +
                `color:${cfg.color};` +
                `line-height:18px;` +
                `white-space:nowrap;` +
                `">` +
                `<span style="` +
                `width:6px;height:6px;` +
                `border-radius:50%;` +
                `background:${cfg.dot};` +
                `display:inline-block;` +
                `flex-shrink:0;` +
                `"></span>` +
                cfg.label +
                `</span>`
            );
        },

        _stripCommas: function (v) {
            if (v === null || v === undefined) return "";
            return String(v).replace(/,/g, "").trim();
        },

        _openBusyDialog: function (sTitle, sText) {
            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog();
            }
            this._oBusyDialog.setTitle(sTitle || "Processing");
            this._oBusyDialog.setText(sText || "Please wait…");
            this._oBusyDialog.open();
        },

        _closeBusyDialog: function () {
            if (this._oBusyDialog) {
                this._oBusyDialog.close();
            }
        },

        // ══════════════════════════════════════════════════════════════════════
        //  DATA LOADING
        // ══════════════════════════════════════════════════════════════════════
        _loadData: function () {
            const sMail = this.getView().getModel("vm").getProperty("/ASMEmail");
            return Promise.all([
                this._read("/ModelMasterSet", { Mail: sMail }),
                this._read("/RegionMasterSet", { Mail: sMail })
            ]).then(([aModels, aRegions]) => {
                console.log("📦 RAW ModelMasterSet:", aModels.length, aModels);
                console.log("📦 RAW RegionMasterSet:", aRegions.length, aRegions);

                // Deduplicate — pick latest FromDate per business key
                const aFilteredModels = this._filterValidToday(aModels, "ModelCode", ["EngineType", "CcWatt"]);
                const aFilteredRegions = this._filterValidToday(aRegions, "Region", ["Spras"]);

                console.log("✅ Filtered Models:", aFilteredModels.length, aFilteredModels);
                console.log("✅ Filtered Regions:", aFilteredRegions.length, aFilteredRegions);

                const oVM = this.getView().getModel("vm");
                oVM.setProperty("/models", aFilteredModels);
                oVM.setProperty("/regions", aFilteredRegions);
                oVM.setProperty("/_allTableData", []);
                oVM.setProperty("/filteredModels",
                    aFilteredModels.filter(m => m.Status === "APPROVED")
                );
            });
        },

        _filterValidToday: function (aRecords, sPrimaryKey, aExtraKeys, oEffectiveDate) {

            console.log("🗓️ _filterValidToday | primaryKey:", sPrimaryKey,
                "| extraKeys:", aExtraKeys, "| records in:", aRecords.length);

            // const today = oEffectiveDate ? new Date(oEffectiveDate) : new Date();

            const today = oEffectiveDate ? this._parseDate(oEffectiveDate) : new Date();

            today.setHours(0, 0, 0, 0);

            // ── Step 1: Group by business key (excluding FromDate) ──
            const mGroups = {};

            aRecords.forEach(oRecord => {
                const sGroupKey = [sPrimaryKey, ...aExtraKeys]
                    .map(k => String(oRecord[k] || ""))
                    .join("||");

                if (!mGroups[sGroupKey]) {
                    mGroups[sGroupKey] = [];
                }

                mGroups[sGroupKey].push(oRecord);
            });

            console.log("🗂️ Groups:", Object.keys(mGroups));

            const aResult = [];

            // ── Step 2: Process each group ──
            Object.entries(mGroups).forEach(([sGroupKey, aGroup]) => {

                const aWithDates = aGroup
                    .map(oRecord => {

                        let dFrom;
                        const sFrom = oRecord.FromDate;

                        // Handle SAP format: /Date(123456789)/
                        if (typeof sFrom === "string" && sFrom.startsWith("/Date(")) {
                            const ms = parseInt(sFrom.replace(/\/Date\((\d+)\)\//, "$1"), 10);
                            dFrom = new Date(ms);
                        } else {
                            dFrom = this._parseDate(sFrom);
                        }

                        dFrom.setHours(0, 0, 0, 0);

                        return {
                            record: oRecord,
                            fromDate: dFrom
                        };
                    })

                    // ✅ Step 3: REMOVE future dates
                    .filter(x => x.fromDate <= today);

                // ⚠️ If no valid past/today records → skip
                if (!aWithDates.length) {
                    console.log(`⏭️ [${sGroupKey}] skipped (only future records)`);
                    return;
                }

                // ── Step 4: Sort descending (latest first) ──
                aWithDates.sort((a, b) => b.fromDate - a.fromDate);

                console.log(`🔍 [${sGroupKey}] Valid FromDates:`,
                    aWithDates.map(x => x.fromDate.toISOString().split("T")[0]),
                    "→ picked:", aWithDates[0].fromDate.toISOString().split("T")[0]
                );

                // ── Step 5: Take latest valid record ──
                aResult.push(aWithDates[0].record);
            });

            console.log(`✅ _filterValidToday result: ${aResult.length} records`);

            return aResult;
        },

        onMtoMtsChange: function () {
            const oVM = this.getView().getModel("vm");
            const sSelectedMto = this.byId("idMtoMtsMCB").getSelectedKey();
            const aAllModels = oVM.getProperty("/models") || [];

            let aFiltered;
            if (sSelectedMto === "MTS") {
                aFiltered = aAllModels.filter(
                    m => m.OrdType === "MTS" && m.Status === "APPROVED"
                );
            } else {
                aFiltered = aAllModels.filter(m => m.Status === "APPROVED");
            }

            oVM.setProperty("/filteredModels", aFiltered);
            const oModelMCB = this.byId("idModelMCB");
            if (oModelMCB) oModelMCB.setSelectedKeys([]);
        },

        _read: async function (sPath, mFilters) {
            const oModel = this.getOwnerComponent().getModel();
            let sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");

            // Build filter query string
            let sQuery = "";
            if (mFilters && Object.keys(mFilters).length) {
                const aParts = Object.keys(mFilters).map(k => `${k} eq '${mFilters[k]}'`);
                sQuery = "?$filter=" + aParts.join(" and ");
            }

            const sFullUrl = sServiceUrl + sPath + sQuery;
            console.log("🌐 _read | URL:", sFullUrl);

            const oResponse = await fetch(sFullUrl, {
                headers: { "Accept": "application/json" },
                credentials: "include"
            });

            if (!oResponse.ok) throw new Error(`HTTP ${oResponse.status} for ${sPath}`);

            const oJson = await oResponse.json();
            const aRaw = oJson?.d?.results || oJson?.value || [];
            console.log(`📦 _read | ${sPath} raw count:`, aRaw.length, aRaw);

            return aRaw;
        },

        // ══════════════════════════════════════════════════════════════════════
        //  VALIDATION
        // ══════════════════════════════════════════════════════════════════════
        _validateMandatoryFields: function () {
            const oVM = this.getView().getModel("vm");
            const sRegion = this.byId("idRegionMCB").getSelectedKey();
            const sMto = this.byId("idMtoMtsMCB").getSelectedKey();
            let bValid = true;

            if (!sRegion) { oVM.setProperty("/regionVS", "Error"); bValid = false; }
            else oVM.setProperty("/regionVS", "None");

            if (!sMto) { oVM.setProperty("/mtoVS", "Error"); bValid = false; }
            else oVM.setProperty("/mtoVS", "None");

            if (!bValid) MessageToast.show("Please fill all mandatory fields");
            return bValid;
        },

        // ══════════════════════════════════════════════════════════════════════
        //  SEARCH
        // ══════════════════════════════════════════════════════════════════════
        onGoPress: async function () {
            if (!this._validateMandatoryFields()) return;

            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
            const sRegion = this.byId("idRegionMCB").getSelectedKey();

            console.log(sRegion);

            console.log(sMtoMts);



            this._resetToInitialState();

            const oVM = this.getView().getModel("vm");
            const oView = this.getView();
            const sMail = oVM.getProperty("/ASMEmail");

            oVM.setProperty("/selectedMto", sMtoMts);
            oView.setBusy(true);

            try {
                if (sMtoMts === "MTS") {
                    await this._goMTS(sRegion, sMail);
                } else {
                    await this._goProcessing(sRegion, sMtoMts, sMail);
                }

                // ── Process Calculation visible for ALL types ──
                this.byId("processcalculation").setVisible(true);
                this.byId("processcalculation").setEnabled(false);
                oVM.setProperty("/processCalcVisible", true);
                oVM.setProperty("/processCalcEnabled", false);
                oVM.setProperty("/saveBtnEnabled", false);
                oVM.setProperty("/applyOtherEnabled", false);

                this.byId("saveBtn").setEnabled(false);
                const oApplyBtn = this.byId("applyOtherRegionsBtn");
                if (oApplyBtn) oApplyBtn.setEnabled(false);
                const oSubmitBtn = this.byId("submitBtn");
                if (oSubmitBtn) oSubmitBtn.setEnabled(false);

            } catch (e) {
                console.error("onGoPress failed:", e);
                MessageBox.error(e.message || "Failed to load pricing data");
                oVM.setProperty("/tableData", []);
            } finally {
                oView.setBusy(false);
            }
        },

        _parseDate: function (sDate) {
            if (!sDate) return new Date();
            // Handle DD-MM-YYYY
            const match = String(sDate).match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
            // Handle ISO or SAP /Date(ms)/
            if (String(sDate).startsWith("/Date(")) {
                const ms = parseInt(sDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
                return new Date(ms);
            }
            return new Date(sDate);
        },

        // ── MTS data load ─────────────────────────────────────────────────────
        _goMTS: async function (sRegion, sMail) {
            const oVM = this.getView().getModel("vm");
            const aModelKeys = this.byId("idModelMCB").getSelectedKeys();

            const sStatus = this.byId("idStatus").getSelectedKey();
            const sEffectiveDate = oVM.getProperty("/valueDP2");

            try {
                const [aModels, aRegions, aBreakups, aSubmissionRefs] = await Promise.all([
                    this._read("/ModelMasterSet", { Mail: sMail }),
                    this._read("/RegionMasterSet", { Mail: sMail }),
                    this._read("/ModelPriceBreakupSet", { Mail: sMail }),
                    this._read("/SubmissionReference")
                ]);

                // ── Filter models with effective date ──────────────────────────────
                let aFilteredModels = this._filterValidToday(
                    aModels, "ModelCode", ["EngineType", "CcWatt"], sEffectiveDate || null
                );

                // ── Fallback: always try ModelInvalidSet if no models found ────────
                if (!aFilteredModels.length) {
                    console.log("No models in main set — trying ModelInvalidSet");
                    try {
                        const aInvalidModels = await this._read("/ModelInvalidSet", { Mail: sMail });
                        aFilteredModels = this._filterValidToday(
                            aInvalidModels, "ModelCode", ["EngineType", "CcWatt"], sEffectiveDate || null
                        );
                    } catch (oInvalidErr) {
                        console.warn("ModelInvalidSet read failed:", oInvalidErr.message);
                    }
                }

                // ── Filter regions with effective date ─────────────────────────────
                let aFilteredRegions = this._filterValidToday(
                    aRegions, "Region", ["Spras"], sEffectiveDate || null
                );

                // ── Fallback: try RegionInvalidSet if no regions found ─────────────
                if (!aFilteredRegions.length) {
                    console.log("No regions in main set — trying RegionInvalidSet");
                    try {
                        const aInvalidRegions = await this._read("/RegionInvalidSet", { Mail: sMail });
                        aFilteredRegions = this._filterValidToday(
                            aInvalidRegions, "Region", ["Spras"], sEffectiveDate || null
                        );
                    } catch (oInvalidErr) {
                        console.warn("RegionInvalidSet read failed:", oInvalidErr.message);
                    }
                }

                // Add this helper at the top of the try block
                const formatDisplayDate = (d) => {
                    if (!d) return "";
                    const oDate = new Date(d);
                    if (isNaN(oDate.getTime())) return String(d);
                    const dd = String(oDate.getDate()).padStart(2, "0");
                    const mm = String(oDate.getMonth() + 1).padStart(2, "0");
                    const yyyy = oDate.getFullYear();
                    return `${dd}-${mm}-${yyyy}`;
                };

                // ── Validate: stop early if still nothing found ────────────────────
                if (!aFilteredModels.length) {
                    MessageBox.error(
                        sEffectiveDate
                            ? `No models found for effective date: ${formatDisplayDate(sEffectiveDate)}.\nPlease check the date.`
                            : "No models found. Please contact your administrator.",
                        { title: "No Models Found" }
                    );
                    oVM.setProperty("/tableData", []);
                    return;
                }

                if (!aFilteredRegions.length) {
                    MessageBox.error(
                        sEffectiveDate
                            ? `No regions found for effective date: ${sEffectiveDate}.\nPlease check the date or contact your administrator.`
                            : "No regions found. Please contact your administrator.",
                        { title: "No Regions Found" }
                    );
                    oVM.setProperty("/tableData", []);
                    return;
                }

                // ── Status filter ──────────────────────────────────────────────────
                const mStatusMap = {
                    "ACTIVE": ["APPROVED"],
                    "IN-ACTIVE": ["REJECTED", "INACTIVE", "IN-ACTIVE"],
                    "IN-STOCK": ["IN-STOCK", "INSTOCK"]
                };
                const aAllowedStatuses = mStatusMap[sStatus?.toUpperCase()] || ["APPROVED"];

                const aMtsFiltered = aFilteredModels.filter(m =>
                    m.OrdType === "MTS" && aAllowedStatuses.includes(m.Status)
                );

                console.log("✅ _goMTS | Status filter:", sStatus, "→", aAllowedStatuses);
                console.log("✅ _goMTS | MTS filtered models:", aMtsFiltered.length);

                // ── Validate: no models match the status filter ────────────────────
                if (!aMtsFiltered.length) {
                    MessageBox.warning(
                        `No MTS models found with status "${sStatus || "ACTIVE"}".\n` +
                        (sEffectiveDate ? `Effective date: ${sEffectiveDate}\n` : "") +
                        "Please adjust your filters and try again.",
                        { title: "No Models Found" }
                    );
                    oVM.setProperty("/tableData", []);
                    return;
                }

                // ── Build table ────────────────────────────────────────────────────
                this._buildCartesianData(aMtsFiltered, aFilteredRegions, aBreakups, aSubmissionRefs);

                const aAllData = oVM.getProperty("/_allTableData") || [];
                const aFiltered = aAllData.filter(oRow => {
                    const bRegion = oRow.Region === sRegion;
                    const bModel = !aModelKeys.length || aModelKeys.includes(oRow.ModelCode);
                    return bRegion && bModel;
                });

                // ── Validate: nothing matches region/model filter ──────────────────
                if (!aFiltered.length) {
                    MessageBox.information(
                        `No data found for region "${sRegion}"` +
                        (aModelKeys.length ? ` and the selected model(s)` : "") +
                        ".\nPlease check your selection and try again.",
                        { title: "No Data Found" }
                    );
                    oVM.setProperty("/tableData", []);
                    return;
                }

                oVM.setProperty("/tableData", aFiltered);

                oVM.setProperty("/tableData", aFiltered);

// ── Seed the snapshot so processed-filter shows all rows ──
const aExistingSnap = oVM.getProperty("/_allProcessedTableData") || [];
const aSnapKeys = new Set(aExistingSnap.map(s => (s.ModelCode || s.Model) + "|" + s.Region));
const aNewSnap = [...aExistingSnap];
aFiltered.forEach(oRow => {
    const sKey = (oRow.ModelCode || oRow.Model) + "|" + oRow.Region;
    if (!aSnapKeys.has(sKey)) aNewSnap.push(JSON.parse(JSON.stringify(oRow)));
});
oVM.setProperty("/_allProcessedTableData", aNewSnap);
this._buildProcessedFilters();


                oVM.setProperty("/enableEditActions", false);
                oVM.setProperty("/enableSaveActions", false);

                this.byId("processcalculation").setEnabled(false);
                this.byId("saveBtn").setEnabled(false);
                const oSubmitBtn = this.byId("submitBtn");
                if (oSubmitBtn) oSubmitBtn.setEnabled(false);
                const oApplyBtn = this.byId("applyOtherRegionsBtn");
                if (oApplyBtn) oApplyBtn.setEnabled(false);

            } catch (oError) {
                console.error("_goMTS failed:", oError);

                // ── Parse error message from OData/fetch response ──────────────────
                let sMessage = "Failed to load MTS pricing data.";
                try {
                    const oParsed = typeof oError.responseText === "string"
                        ? JSON.parse(oError.responseText)
                        : null;
                    sMessage = oParsed?.error?.message?.value
                        || oParsed?.error?.message
                        || oError.message
                        || sMessage;
                } catch (e) {
                    sMessage = oError.message || sMessage;
                }

                MessageBox.error(sMessage, { title: "MTS Load Error" });
                oVM.setProperty("/tableData", []);
            }
        },

        // ── Build Model × Region cartesian with status logic ──────────────────
        _buildCartesianData: function (aModels, aRegions, aBreakups, aSubmissionRefs) {
            aBreakups = aBreakups || [];
            aSubmissionRefs = aSubmissionRefs || [];

            // Set of approved reference numbers
            const oApprovedRefs = new Set(
                aSubmissionRefs
                    .filter(r => r.Status === "APPROVED" && String(r.ReferenceNum || "").trim() !== "")
                    .map(r => String(r.ReferenceNum).trim())
            );

            const aTableData = [];

            aModels.forEach(oModel => {
                aRegions.forEach(oRegion => {

                    const oBreakup = aBreakups.find(
                        b => b.Model === oModel.ModelCode && b.Region === oRegion.Region
                    );

                    let bShowBreakup = false;
                    let sRowStatus = "NEW";

                    if (oBreakup) {

                        console.log(oBreakup);

                        const dealer = parseFloat(oBreakup.DealerMarigin || 0);
                        const bike = parseFloat(oBreakup.BikeMargin || 0);
                        const sRef = String(oBreakup.ReferenceNum || "").trim();
                        if (sRef === "") {
                            bShowBreakup = true;
                            sRowStatus = "DRAFT";
                        } else if (oApprovedRefs.has(sRef)) {
                            bShowBreakup = true;
                            sRowStatus = "APPROVED";
                        } else {
                            bShowBreakup = false;
                            sRowStatus = "NEW";
                        }
                    }



                    console.log(oBreakup);

                    if (bShowBreakup) {
                        aTableData.push({
                            Model: oModel.ModelCode,
                            ModelCode: oModel.ModelCode,
                            Region: oRegion.Region,
                            Ort01: oRegion.Ort01,
                            rowStatus: sRowStatus,

                            Basis: oBreakup.Basis || oRegion.BasisRto,
                            InputExShowroom: this.formatIndian(oBreakup.InputExShowroom || ""),
                            InputNsp: this.formatIndian(oBreakup.InputNsp || ""),
                            ActualExShowroom: oBreakup.ActualExShowroom || "",
                            MTSExshowroom: oBreakup.MTSExshowroom || "",
                            OnRoad: oBreakup.OnRoad || "",

                            DealerMarginPerc: oBreakup.DealerMargin || "",
                            ActualNsp: oBreakup.ActualNsp || "",
                            IncrementalNSP: oBreakup.IncrementalNsp || "",
                            Helmet: oBreakup.Helmet || "",
                            Transportation: oBreakup.Transportation || "",
                            DealerCost: oBreakup.DealerCost || "",
                            OtherExpenses: oBreakup.OtherExpenses || "",
                            BikeMargin: oBreakup.BikeMargin || "",
                            ActualDealerMargin: oBreakup.ActualDealerMargin || "",
                            HelmetMargin: oBreakup.HelmetMargin || "",
                            TotalDealerMargin: oBreakup.TotalDealerMargin || "",
                            IncrementDlr: oBreakup.IncrementDlr || "0",
                            Incremental2: String(
                                (parseFloat(oBreakup.BikeMargin) || "0") -
                                (parseFloat(oBreakup.DealerMarigin) || "0")
                            ),

                            // Incremental2: (dealer - bike).toFixed(2),

                            Ndp: oBreakup.Ndp || "",
                            Basic: oBreakup.Basic || "",
                            GSTPerc: oBreakup.GstPerc ? String(parseFloat(oBreakup.GstPerc)) : "",
                            Gst: oBreakup.Gst || "",

                            RtoPerc: oBreakup.RtoPerc || "",
                            Rto: oBreakup.Rto || "",
                            RtoWithBill: oBreakup.RtoWithBill || "",

                            insuranceperc: oBreakup.insuranceperc || "0",
                            Insurance: oBreakup.Insurance || "",
                            TpaPa: oBreakup.TpaPa || "",
                            ActualGst: oBreakup.ActualGst || "",
                            TotalInsurance: oBreakup.TotalInsurance || "",
                            ExpectedOnRoad: oBreakup.OnRoadPrice || "",




                            ExceptionRef: oBreakup.ExceptionRef || "E",
                            ReferenceNum: oBreakup.ReferenceNum || "",

                            ReferMtsModel: oBreakup.ReferModel || oBreakup.ReferMtsModel || "",

                            isChanged: false,
                            isCalculated: true,
                            InputExShowroomEnabled: true,
                            InputNspEnabled: true,
                            _origInputExShowroom: String(oBreakup.InputExShowroom ?? ""),
                            _origInputNsp: String(oBreakup.InputNsp ?? "")
                        });
                    } else {
                        aTableData.push({
                            Model: oModel.ModelCode,
                            ModelCode: oModel.ModelCode,
                            Region: oRegion.Region,
                            Ort01: oRegion.Ort01,
                            Basis: oRegion.BasisRto,
                            rowStatus: "NEW",

                            InputExShowroom: "",
                            InputNsp: "",

                            InputExShowroomEnabled: true,
                            InputNspEnabled: true,

                            isChanged: false,
                            isCalculated: false,
                            _origInputExShowroom: "",
                            _origInputNsp: ""
                        });
                    }
                });
            });

            this.getView().getModel("vm").setProperty("/_allTableData", aTableData);
        },

        _buildSaveItems: function (sSaveInd) {
            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
            const email = this.getView().getModel("vm").getProperty("/ASMEmail");
            const ASMName = this.getView().getModel("vm").getProperty("/ASMName");
            const strip = (v) => String(v || "").replace(/,/g, "").trim();

            return this.getRowsToSave().map(o => ({
                Mail: email, AsmName: ASMName,
                Model: o.Model, OperationNo: 0, SaveInd: sSaveInd,
                Region: o.Region, MtoMts: sMtoMts,
                Basis: o.Basis, ReferenceNum: o.ReferenceNum || "",
                ExceptionRef: o.ExceptionRef || "E",
                GstPerc: this.uiDec(strip(o.GSTPerc ?? 0), 3),
                DealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
                InputNsp: String(this.uiDec(strip(o.InputNsp))),
                IncrementalNsp: String(this.uiDec(strip(o.IncrementalNSP ?? o.IncrementalNsp ?? "0"))),
                ActualNsp: String(this.uiDec(strip(o.ActualNsp))),
                Helmet: this.uiInt(strip(o.Helmet)),
                Transportation: this.uiInt(strip(o.Transportation)),
                DealerCost: this.uiInt(strip(o.DealerCost)),
                OtherExpenses: this.uiInt(strip(o.OtherExpenses)),
                BikeMargin: this.uiInt(strip(o.BikeMargin)),
                IncrementDlr: this.uiDec(strip(o.Incremental2 ?? o.IncrementDlr ?? "0")),
                ActualDealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
                HelmetMargin: this.uiInt(strip(o.HelmetMargin)),
                TotalDealerMargin: this.uiInt(strip(o.TotalDealerMargin)),
                Ndp: this.uiInt(strip(o.Ndp)),
                Basic: this.uiInt(strip(o.Basic)),
                Gst: this.uiInt(strip(o.Gst)),
                InputExShowroom: this.uiInt(strip(o.InputExShowroom)),
                ActualExShowroom: this.uiInt(strip(o.ActualExShowroom)),
                RtoPerc: String(this.uiDec(strip(o.RtoPerc))),
                Rto: this.uiInt(strip(o.Rto)),
                RtoWithBill: this.uiInt(strip(o.RtoWithBill)),
                InsuranceLe350: String(this.uiDec(strip(o.InsuranceLe350 ?? 0))),
                InsuranceGt350: String(this.uiDec(strip(o.InsuranceGt350 ?? 0))),
                Insurance: this.uiInt(strip(o.Insurance)),
                TpaPa: this.uiInt(strip(o.TpaPa)),
                ActualGst: this.uiInt(strip(o.ActualGst)),
                TotalInsurance: this.uiInt(strip(o.TotalInsurance)),
                OnRoad: this.uiInt(strip(o.OnRoad)),
                Diff: this.uiInt(strip(o.Diff ?? 0)),

                // ── MTO-specific fields ──────────────────────────────────────────
                ReferenceMtsModel: o.ReferMtsModel || "",
                MtoNsp: String(this.uiDec(strip(o.MtoNsp ?? 0))),
                MiyExshowroom: this.uiInt(strip(o.MIYExShowroomTotal ?? 0)),
                MiyOnroad: this.uiInt(strip(o.MIYOnRoadTotal ?? 0)),
                ExpExshowroom: this.uiInt(strip(o.MTOExshowroomafterGMA ?? 0)),
                ExpOnroad: this.uiInt(strip(o.ExpectedOnRoad ?? 0))
            }));
        },

        _prepareSavePayload: function () { return this._buildSaveItems(""); },
        _prepareSavePayloadForSubmit: function () { return this._buildSaveItems("X"); },

_goProcessing: async function (sRegion, sMtoMts, sMail) {
    const oVM = this.getView().getModel("vm");
    const oODataModel = this.getOwnerComponent().getModel();

    const oModelMCB = this.byId("idModelMCB");
    const aModelKeys = oModelMCB ? oModelMCB.getSelectedKeys() : [];
    const sStatus = this.byId("idStatus").getSelectedKey();
    const sEffectiveDate = oVM.getProperty("/valueDP2");

    // ── Step 1: Fetch ModelPriceBreakupSet and SubmissionReferenceSet first ──
    const [aAllBreakups, aSubmissionRefs] = await Promise.all([
        this._read("/ModelPriceBreakupSet", { Mail: sMail }),
        this._read("/SubmissionReferenceSet")
    ]);

    // ── Step 2: Build approved reference set ──
    const oApprovedRefs = new Set(
        aSubmissionRefs
            .filter(r => String(r.ReferenceNum || "").trim() !== "")
            .map(r => String(r.ReferenceNum).trim())
    );

    const sRegionPadded = String(Number(sRegion)).padStart(3, "0");

    // ── Step 3: Filter MTO breakups for this region ──
    const aExistingMtoBreakups = aAllBreakups.filter(b => {
        const sRef = String(b.ReferenceNum || "").trim();
        const bRegionMatch = String(b.Region || "").padStart(3, "0") === sRegionPadded;
        const bIsMto = b.MtoMts === "MTO";
        const bModelMatch = !aModelKeys.length || aModelKeys.includes(b.Model);

        // Draft (no ref) or Approved
        const bIsValid = sRef === "" || oApprovedRefs.has(sRef);
        return bIsMto && bRegionMatch && bModelMatch && bIsValid;
    });

    console.log("Existing MTO breakups found:", aExistingMtoBreakups.length);

    // ── Step 4: Map existing breakups directly to table rows (no backend needed) ──
    const aExistingModels = new Set(aExistingMtoBreakups.map(b => b.Model));

    const aFromBreakup = aExistingMtoBreakups.map(b => {
        const sRef = String(b.ReferenceNum || "").trim();
        const sRowStatus = sRef === "" ? "DRAFT" : "APPROVED";

        const sBikeMargin = b.BikeMargin ?? b.BikeMarigin ?? "";
        const sDealerMargin = b.ActualDealerMargin ?? b.DealerMarigin ?? "";
        const sIncrementDlr = b.IncrementDlr ?? "0";

        return {
            Model: b.Model,
            ModelCode: b.Model,
            Region: b.Region,
            MtoMts: b.MtoMts,
            Basis: b.Basis || "",
            rowStatus: sRowStatus,

            isChanged: false,
            isCalculated: true,
            isReadOnly: false,

            ReferenceNum: b.ReferenceNum || "",
            ExceptionRef: b.ExceptionRef || "E",
            ReferMtsModel: b.ReferModel || b.ReferMtsModel || "",

            InputExShowroom: b.ActualExShowroom ? String(b.ActualExShowroom) : "",
            InputNsp: b.ActualNsp ? String(b.ActualNsp) : "",
            InputExShowroomEnabled: true,
            InputNspEnabled: true,
            _origInputExShowroom: String(b.ActualExShowroom ?? ""),
            _origInputNsp: String(b.ActualNsp ?? ""),

            ActualExShowroom: b.ActualExShowroom || "",
            ActualNsp: b.ActualNsp || "",
            IncrementalNSP: b.IncrementalNsp || "",
            Helmet: b.Helmet || "",
            Transportation: b.Transportation || "",
            DealerCost: b.DealerCost || "",
            OtherExpenses: b.OtherExpenses || "",
            BikeMargin: sBikeMargin,
            ActualDealerMargin: sDealerMargin,
            HelmetMargin: b.HelmetMargin || "",
            TotalDealerMargin: b.TotalDealerMargin || "",
            IncrementDlr: sIncrementDlr,
            Incremental2: String(
                (parseFloat(sBikeMargin) || 0) - (parseFloat(sDealerMargin) || 0)
            ),
            DealerMarginPerc: b.DealerMargin || "",

            Ndp: b.Ndp || "",
            Basic: b.Basic || "",
            GSTPerc: b.GstPerc || "",
            Gst: b.Gst || "",

            RtoPerc: b.RtoPerc || "",
            Rto: b.Rto || "",
            RtoWithBill: b.RtoWithBill || "",

            insuranceperc: b.insuranceperc || "0",
            Insurance: b.Insurance || "",
            TpaPa: b.TpaPa || "",
            ActualGst: b.ActualGst || "",
            TotalInsurance: b.TotalInsurance || "",

            OnRoad: b.OnRoad || "",
            MTOOnRoad: b.OnRoad || "",
            MTSExshowroom: b.MTSExshowroom || "",
            MTOExshowroomafterGMA: b.MTOExshowroomafterGMA || "",
            MIYExShowroomTotal: b.MiyExShowroomTotal || 0,
            MIYOnRoadTotal: b.MiyOnRoadTotal || 0,
            ExpectedOnRoad: b.ExpectedOnRoad || b.OnRoad || "",
            MtoNsp: b.MTO_NSP || b.ActualNsp || ""
        };
    });

    // ── Step 5: Find models that need backend calculation ──
    // Models that have NO existing MTO breakup in this region
    let aModelsForBackend = [];

    if (aModelKeys.length) {
        // User selected specific models — only send ones not already in breakup
        aModelsForBackend = aModelKeys.filter(m => !aExistingModels.has(m));
    } else {
        // No model filter — backend will figure out remaining from GMA list
        // Only call backend if there are no existing breakups at all
        // OR if we want to check for new GMA models not yet calculated
        // Pass existing models so backend can exclude them
        aModelsForBackend = null; // null means — let backend decide
    }

    console.log("Models needing backend calc:", aModelsForBackend);

    // ── Step 6: Call backend only for models not already in breakup ──
    let aFromBackend = [];

    const bNeedBackend = aModelsForBackend === null
        ? aExistingMtoBreakups.length === 0  // no existing data at all → call backend
        : aModelsForBackend.length > 0;       // some models missing → call backend

    if (bNeedBackend) {
        try {
            const oAction = oODataModel.bindContext("/goProcessing(...)");
            oAction.setParameter("regionCode", sRegion);
            oAction.setParameter("MTOStatus", sMtoMts);
            oAction.setParameter("Mail", sMail);
            oAction.setParameter("ModelCodes", aModelsForBackend || aModelKeys);
            oAction.setParameter("StatusFilter", sStatus || "ACTIVE");
            oAction.setParameter("EffectiveDate", sEffectiveDate || "");
            await oAction.execute();

            const oResult = oAction.getBoundContext().getObject();
            const aResultsRaw = Array.isArray(oResult)
                ? oResult
                : Array.isArray(oResult?.value)
                    ? oResult.value
                    : oResult && typeof oResult === "object"
                        ? [oResult]
                        : [];

            // Map backend results — these are NEW (not yet saved)
            aFromBackend = aResultsRaw.map(oRow => {
                const sRef = String(oRow.ReferenceNum || "").trim();
                const sRowStatus = sRef === "" ? "DRAFT" : "APPROVED";

                const sBikeMargin = oRow.BikeMargin ?? oRow.BikeMarigin ?? "";
                const sDealerMargin = oRow.ActualDealerMargin ?? oRow.DealerMarigin ?? "";
                const sIncrementDlr = oRow.IncrementDlr ?? "0";

                const { MIYBreakup, ...oCleanRow } = oRow;

                return {
                    ...oCleanRow,

                    rowStatus: sRowStatus,
                    isChanged: false,
                    isCalculated: true,
                    isReadOnly: false,

                    InputExShowroom: oRow.ActualExShowroom ? String(oRow.ActualExShowroom) : "",
                    InputNsp: oRow.ActualNsp ? String(oRow.ActualNsp) : "",
                    InputExShowroomEnabled: true,
                    InputNspEnabled: true,
                    _origInputExShowroom: String(oRow.ActualExShowroom ?? ""),
                    _origInputNsp: String(oRow.ActualNsp ?? ""),

                    GSTPerc: oRow.GSTPerc || oRow.Gst,
                    Gst: oRow.GSTAfterbasic,
                    IncrementalNSP: oRow.IncrementalNsp ?? "0",
                    IncrementDlr: sIncrementDlr,
                    Incremental2: String(
                        (parseFloat(sBikeMargin) || 0) - (parseFloat(sDealerMargin) || 0)
                    ),
                    ActualDealerMargin: sDealerMargin,
                    BikeMargin: sBikeMargin,

                    MtoNsp: oRow.MTO_NSP ?? null,
                    ReferMtsModel: oRow.ReferModel ?? "",
                    MIYExShowroomTotal: oRow.MiyExShowroomTotal ?? 0,
                    MIYOnRoadTotal: oRow.MiyOnRoadTotal ?? 0
                };
            });

        } catch (e) {
            console.error("Backend goProcessing failed:", e);
            // Still show existing breakup data even if backend fails
        }
    }

    // ── Step 7: Merge — existing breakup data takes priority ──
    const aMerged = [...aFromBreakup, ...aFromBackend];

    // Dedupe by Model + Region
    const aFinalResults = Object.values(
        aMerged.reduce((acc, o) => {
            const key = (o.Model || o.ModelCode) + "|" + o.Region;
            // Existing breakup (DRAFT/APPROVED) takes priority over backend NEW
            if (!acc[key] || o.rowStatus === "DRAFT" || o.rowStatus === "APPROVED") {
                acc[key] = o;
            }
            return acc;
        }, {})
    );

    console.log("Final merged results:", aFinalResults.length,
        "fromBreakup:", aFromBreakup.length,
        "fromBackend:", aFromBackend.length
    );

    oVM.setProperty("/tableData", aFinalResults);

    // ── Seed snapshot ──
    const aExistingSnap = oVM.getProperty("/_allProcessedTableData") || [];
    const aSnapKeys = new Set(aExistingSnap.map(s => (s.ModelCode || s.Model) + "|" + s.Region));
    const aNewSnap = [...aExistingSnap];
    aFinalResults.forEach(oRow => {
        const sKey = (oRow.ModelCode || oRow.Model) + "|" + oRow.Region;
        if (!aSnapKeys.has(sKey)) aNewSnap.push(JSON.parse(JSON.stringify(oRow)));
    });
    oVM.setProperty("/_allProcessedTableData", aNewSnap);
    this._buildProcessedFilters();

    oVM.setProperty("/enableEditActions", false);
    oVM.setProperty("/enableSaveActions", false);
},

        onColumnGroupChange: function () {
            const oVM = this.getView().getModel("vm");
            const aSelectedKeys = this.byId("idColumnGroupMCB").getSelectedKeys();
            ["DEALER", "PRICING", "RTO", "INSURANCE", "GEM", "CSD", "MTO"].forEach(sKey => {
                oVM.setProperty("/colGrp/" + sKey, aSelectedKeys.includes(sKey));
            });
        },

        _resetColumnGroups: function () {
            const oVM = this.getView().getModel("vm");
            const oMCB = this.byId("idColumnGroupMCB");
            if (oMCB) oMCB.setSelectedKeys([]);
            ["DEALER", "PRICING", "RTO", "INSURANCE", "GEM", "CSD", "MTO"].forEach(sKey => {
                oVM.setProperty("/colGrp/" + sKey, false);
            });
            oVM.setProperty("/hasGroupHeaders", false);
            this._clearGroupHeaderStrip();
        },

        _renderGroupHeaderStrip: function () {
            const oVM = this.getView().getModel("vm");
            const oStripBox = this.byId("idGroupHeaderStrip");
            const sSelectedMto = oVM.getProperty("/selectedMto");
            if (!oStripBox) return;
            this._clearGroupHeaderStrip();
            const aActiveGroups = ["CORE"];
            ["DEALER", "PRICING", "RTO", "INSURANCE"].forEach(k => {
                if (oVM.getProperty("/colGrp/" + k)) aActiveGroups.push(k);
            });
            if (sSelectedMto === "GeM" && oVM.getProperty("/colGrp/GEM")) aActiveGroups.push("GEM");
            if (sSelectedMto === "CSD" && oVM.getProperty("/colGrp/CSD")) aActiveGroups.push("CSD");
            if (sSelectedMto === "MTO" && oVM.getProperty("/colGrp/MTO")) aActiveGroups.push("MTO");
            if (!aActiveGroups.length) { oVM.setProperty("/hasGroupHeaders", false); return; }
            const iTotalW = aActiveGroups.reduce((sum, k) => sum + GROUP_WIDTHS[k], 0);
            aActiveGroups.forEach(sKey => {
                const oMeta = GROUP_META[sKey];
                const iW = GROUP_WIDTHS[sKey];
                const sPct = ((iW / iTotalW) * 100).toFixed(3) + "%";
                const oDom = document.createElement("div");
                oDom.className = "vpGrpChip " + oMeta.chipClass;
                oDom.style.width = sPct;
                oDom.title = oMeta.label;
                oDom.textContent = oMeta.label;
                oStripBox.getDomRef()?.appendChild(oDom);
            });
            oVM.setProperty("/hasGroupHeaders", true);
        },

        _clearGroupHeaderStrip: function () {
            const oStrip = this.byId("idGroupHeaderStrip");
            if (oStrip?.getDomRef()) oStrip.getDomRef().innerHTML = "";
        },

        // ══════════════════════════════════════════════════════════════════════
        //  ROW VALUE CHANGE
        //  Blocks typing if both fields already have values (DRAFT / APPROVED)
        // ══════════════════════════════════════════════════════════════════════
        onRowValueChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oCtx = oInput.getBindingContext("vm");
            if (!oCtx) return;

            const oVM = this.getView().getModel("vm");
            const sPath = oInput.getBinding("value").getPath();  // "InputExShowroom" or "InputNsp"
            const sNewVal = oInput.getValue().trim();
            const oRow = oCtx.getObject();

            // ── Guard: only one field may be filled at a time — applies to ALL rows ──
            const sOtherPath = sPath === "InputExShowroom" ? "InputNsp" : "InputExShowroom";
            const sOtherVal = this._stripCommas(String(oRow[sOtherPath] || ""));

            if (sNewVal !== "" && sOtherVal !== "") {
                oInput.setValueState("Error");
                oInput.setValueStateText(
                    sPath === "InputExShowroom"
                        ? "Ex-Showroom cannot be entered when NSP already has a value. Please clear NSP first."
                        : "NSP cannot be entered when Ex-Showroom already has a value. Please clear Ex-Showroom first."
                );
                // Revert to previous value
                oInput.setValue(oRow[sPath] || "");
                return;
            }

            // Clear error state
            oInput.setValueState("None");

            // Update model
            oVM.setProperty(oCtx.getPath() + "/" + sPath, sNewVal);

            // Lock the other field when one is filled; unlock when cleared
            if (sPath === "InputExShowroom") {
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", true);
            } else {
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", true);
            }

            // Mark changed
            const sExVal = sPath === "InputExShowroom" ? sNewVal : (oRow.InputExShowroom || "").trim();
            const sNspVal = sPath === "InputNsp" ? sNewVal : (oRow.InputNsp || "").trim();
            const bChanged = sExVal !== String(oRow._origInputExShowroom ?? "") ||
                sNspVal !== String(oRow._origInputNsp ?? "");
            oVM.setProperty(oCtx.getPath() + "/isChanged", bChanged);

            // Update Process Calculation button
            this._updateProcessCalcBtn();
        },

        // ══════════════════════════════════════════════════════════════════════
        //  TABLE SELECTION CHANGE
        //  Enables Process Calculation based on SELECTED rows that are changed
        //  or have data to recalculate (DRAFT / APPROVED)
        // ══════════════════════════════════════════════════════════════════════
        onTableSelectionChange: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            const oVM = this.getView().getModel("vm");

            oVM.setProperty("/enableSaveActions", aSelected.length > 0);

            this._updateProcessCalcBtn();
            this._updateActionButtons();
        },

        _updateActionButtons: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();

            const bEnable = aSelected.length > 0 && aSelected.some(oItem => {
                const oRow = oItem.getBindingContext("vm").getObject();
                return oRow.isCalculated === true ||
                    oRow.rowStatus === "DRAFT" ||
                    oRow.rowStatus === "APPROVED";
            });

            const oSaveBtn = this.byId("saveBtn");
            const oSubmit = this.byId("submitBtn");
            const oApplyBtn = this.byId("applyOtherRegionsBtn");

            if (oSaveBtn) oSaveBtn.setEnabled(bEnable);
            if (oSubmit) oSubmit.setEnabled(bEnable);
            if (oApplyBtn) oApplyBtn.setEnabled(bEnable);
        },

        // ── Central helper: decides if Process Calculation button should be on ─
        _updateProcessCalcBtn: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();

            const bCanCalc = aSelected.some(oItem => {
                const oRow = oItem.getBindingContext("vm").getObject();
                const sEx = this._stripCommas(String(oRow.InputExShowroom || ""));
                const sNsp = this._stripCommas(String(oRow.InputNsp || ""));
                // exactly one field has a value
                return (sEx !== "" && sNsp === "") || (sEx === "" && sNsp !== "");
            });

            const oBtn = this.byId("processcalculation");
            if (oBtn) oBtn.setEnabled(bCanCalc);
        },

        // ── Helper: returns selected rows that are valid for calculation ───────
        getSelectedRowsForCalc: function () {
            const oTable = this.byId("idvechileTable");
            return oTable.getSelectedItems()
                .map(oItem => oItem.getBindingContext("vm").getObject())
                .filter(oRow => {
                    const sEx = this._stripCommas(String(oRow.InputExShowroom || ""));
                    const sNsp = this._stripCommas(String(oRow.InputNsp || ""));
                    return (sEx !== "" && sNsp === "") || (sEx === "" && sNsp !== "");
                });
        },

        getChangedRows: function () {
            const aData = this.getView().getModel("vm").getProperty("/tableData") || [];
            return aData.filter(r => r.isChanged === true);
        },

processcalculation: async function () {
    const oTable = this.byId("idvechileTable");
    const aSelected = oTable.getSelectedItems();
    if (!aSelected.length) {
        MessageBox.warning("Please select at least one row.");
        return;
    }

    const aValid = [];
    const aConflict = [], aEmpty = [];
    aSelected.forEach(oItem => {
        const oRow = oItem.getBindingContext("vm").getObject();
        const sEx  = this._stripCommas(String(oRow.InputExShowroom || ""));
        const sNsp = this._stripCommas(String(oRow.InputNsp || ""));
        if (sEx && sNsp)        aConflict.push(`${oRow.Model} / ${oRow.Region}`);
        else if (!sEx && !sNsp) aEmpty.push(`${oRow.Model} / ${oRow.Region}`);
        else                    aValid.push(oRow);
    });

    if (aConflict.length) {
        MessageBox.error("Rows with both Ex-Showroom and NSP filled:\n" + aConflict.join("\n"));
        return;
    }
    if (!aValid.length) {
        MessageBox.warning("No rows with a value to calculate.");
        return;
    }

    // ── Build progress dialog ───────────────────────────────────────────────
    const BATCH = 200;
    const total  = aValid.length;
    let   done   = 0;

    if (!this._oProgressDialog) {
        this._oProgressDialog = new sap.m.Dialog({
            title: "Process Calculation",
            content: [
                new sap.m.VBox({ items: [
                    new sap.m.Text({ id: this.createId("progText"),
                        text: "Starting…",
                        wrapping: true
                    }).addStyleClass("sapUiSmallMarginBottom"),
                    new sap.m.ProgressIndicator({
                        id: this.createId("progBar"),
                        percentValue: 0,
                        displayValue: "0%",
                        state: "Information",
                        width: "100%"
                    })
                ]}).addStyleClass("sapUiSmallMargin")
            ]
        });
        this.getView().addDependent(this._oProgressDialog);
    }

    // Reset and open
    this.byId("progBar").setPercentValue(0);
    this.byId("progBar").setDisplayValue("0%");
    this.byId("progText").setText(`0 of ${total} rows calculated…`);
    this._oProgressDialog.open();

    const updateProgress = (count) => {
        const pct = Math.round((count / total) * 100);
        this.byId("progBar").setPercentValue(pct);
        this.byId("progBar").setDisplayValue(pct + "%");
        this.byId("progText").setText(`${count} of ${total} rows calculated…`);
        if (pct === 100) this.byId("progBar").setState("Success");
    };

    try {
        const oVM = this.getView().getModel("vm");
        let aTableData = JSON.parse(JSON.stringify(oVM.getProperty("/tableData") || []));
        const aFailed = [];

        // ── Group by region, then batch ─────────────────────────────────────
        // Group valid rows by region first (your existing pattern)
        const mByRegion = aValid.reduce((acc, oRow) => {
            const r = oRow.Region;
            if (!acc[r]) acc[r] = [];
            acc[r].push({
                ModelCode:       oRow.ModelCode || oRow.Model,
                nspValue:        oRow.InputExShowroom ? "" : this._stripCommas(oRow.InputNsp),
                exshowroomPrice: oRow.InputExShowroom ? this._stripCommas(oRow.InputExShowroom) : ""
            });
            return acc;
        }, {});

        for (const sRegion of Object.keys(mByRegion)) {
            const aRegionRows = mByRegion[sRegion];

            // Split into batches of BATCH size
            for (let i = 0; i < aRegionRows.length; i += BATCH) {
                const aBatch = aRegionRows.slice(i, i + BATCH);

                let aBatchResults = [];
                try {
                    aBatchResults = await this._callProcessCalculationBatch(aBatch, sRegion);
                } catch (oErr) {
                    // Record failures but keep going
                    aBatch.forEach(r => aFailed.push({
                        Model: r.ModelCode, Region: sRegion,
                        error: oErr.message || "Batch failed"
                    }));
                    done += aBatch.length;
                    updateProgress(done);
                    continue;
                }

                // Merge results into aTableData in-place
                aBatchResults.forEach(r => {
                    if (r.error) { aFailed.push(r); return; }
                    const sModel  = String(r.Model || r.ModelCode || "").trim();
                    const sReg    = String(r.Region || r.regionCode || "").trim();
                    const iIndex  = aTableData.findIndex(row =>
                        String(row.ModelCode || row.Model).trim() === sModel &&
                        String(row.Region).trim() === sReg
                    );
                    if (iIndex < 0) return;

                    const oRow = aTableData[iIndex];
                    const sIncrementDlr = r.IncrementDlr ?? r.Incremental2 ?? oRow.IncrementDlr ?? "0";
                    const rawNsp = r.InputNSP ?? r.CalculatedNSP ?? r.ActualNsp ?? null;

                    aTableData[iIndex] = {
                        ...oRow,
                        isCalculated: true, isChanged: false,
                        Basis:             r.BasisRto        ?? oRow.Basis,
                        DealerMarginPerc:  r.DealerMarginPerc ?? oRow.DealerMarginPerc,
                        ActualNsp:         r.ActualNsp        ?? oRow.ActualNsp,
                        Helmet:            r.Helmet           ?? oRow.Helmet,
                        Transportation:    r.Transportation   ?? oRow.Transportation,
                        DealerCost:        r.DealerCost       ?? oRow.DealerCost,
                        OtherExpenses:     r.OtherExpenses    ?? oRow.OtherExpenses,
                        BikeMargin:        r.BikeMargin       ?? oRow.BikeMargin,
                        ActualDealerMargin: r.DealerMarigin ?? r.ActualDealerMargin ?? oRow.ActualDealerMargin,
                        HelmetMargin:      r.HelmetMarigin ?? r.HelmetMargin ?? oRow.HelmetMargin,
                        TotalDealerMargin: r.totalDealerMarigin ?? r.TotalDealerMargin ?? oRow.TotalDealerMargin,
                        IncrementalNSP:    r.IncrementalNSP != null ? String(r.IncrementalNSP) : String(oRow.IncrementalNSP ?? ""),
                        IncrementDlr:      String(sIncrementDlr),
                        Ndp:               r.NDP ?? r.Ndp    ?? oRow.Ndp,
                        Basic:             r.Basic            ?? oRow.Basic,
                        GSTPerc:           r.GSTPerc ?? r.Gst ?? oRow.GSTPerc,
                        Gst:               r.GSTAfterbasic ?? r.Gst ?? oRow.Gst,
                        ActualExShowroom:  r.ex_showroomAfterGST ?? r.ActualExShowroom ?? oRow.ActualExShowroom,
                        MTSExshowroom:     r.MTSExshowroom    ?? oRow.MTSExshowroom,
                        RtoPerc:           r.RTO_percentage ?? r.RtoPerc ?? oRow.RtoPerc,
                        Rto:               r.RTO ?? r.Rto    ?? oRow.Rto,
                        RtoWithBill:       r.RTO_bill ?? r.RtoWithBill ?? oRow.RtoWithBill,
                        insuranceperc:     r.insuranceperc    ?? oRow.insuranceperc,
                        Insurance:         r.insurance        ?? oRow.Insurance,
                        TpaPa:             r.TPA_PA ?? r.TpaPa ?? oRow.TpaPa,
                        ActualGst:         r.GST_afterTPA ?? r.ActualGst ?? oRow.ActualGst,
                        TotalInsurance:    r.TotalInsurance   ?? oRow.TotalInsurance,
                        OnRoad:            r.OnRoadPrice ?? oRow.OnRoad,
                        InputNsp: (rawNsp != null && String(rawNsp).trim() !== "")
                            ? this.formatIndian(rawNsp) : oRow.InputNsp,
                        _rawInputNsp: rawNsp != null
                            ? String(rawNsp).replace(/,/g, "")
                            : String(oRow._rawInputNsp ?? oRow.InputNsp ?? "").replace(/,/g, ""),
                        _origInputExShowroom: String(oRow.InputExShowroom ?? ""),
                        _origInputNsp:        String(oRow.InputNsp ?? "")
                    };
                });

                done += aBatch.length;
                updateProgress(done);

                // ── Write back to model every batch so table updates live ──
                oVM.setProperty("/tableData", aTableData);
            }
        }

        // Final snapshot sync
        const aSnap = JSON.parse(JSON.stringify(oVM.getProperty("/_allProcessedTableData") || []));
        aTableData.forEach(oRow => {
            if (!oRow.isCalculated) return;
            const iIdx = aSnap.findIndex(s => s.ModelCode === oRow.ModelCode && s.Region === oRow.Region);
            iIdx >= 0 ? (aSnap[iIdx] = JSON.parse(JSON.stringify(oRow)))
                      : aSnap.push(JSON.parse(JSON.stringify(oRow)));
        });
        oVM.setProperty("/_allProcessedTableData", aSnap);
        this._buildProcessedFilters();
        this._updateActionButtons();

        this._oProgressDialog.close();

        if (aFailed.length) {
            MessageBox.warning(
                `Completed with ${aFailed.length} failure(s):\n` +
                aFailed.slice(0, 10).map(r => `• ${r.Model} / ${r.Region}: ${r.error}`).join("\n") +
                (aFailed.length > 10 ? `\n…and ${aFailed.length - 10} more` : ""),
                { title: "Partial Completion" }
            );
        } else {
            MessageBox.success(`Process Calculation completed for ${total} row(s).`);
        }

    } catch (e) {
        this._oProgressDialog.close();
        MessageBox.error(e.message || "Process Calculation failed.");
        console.error(e);
    }
},

        _callProcessCalculationBatch: async function (aItems, sRegionCode) {
            const oODataModel = this.getOwnerComponent().getModel();
            const oVM = this.getView().getModel("vm");
            const oAction = oODataModel.bindContext("/processCalculation(...)");

            oAction.setParameter("items", aItems);
            oAction.setParameter("regionCode", sRegionCode);
            oAction.setParameter("Mail", oVM.getProperty("/ASMEmail"));
            oAction.setParameter("MTOStatus", this.byId("idMtoMtsMCB").getSelectedKey());

            await oAction.execute();

            const oResult = oAction.getBoundContext().getObject();
            return Array.isArray(oResult)
                ? oResult
                : Array.isArray(oResult?.value)
                    ? oResult.value
                    : [];
        },

        // ══════════════════════════════════════════════════════════════════════
        //  APPLY TO OTHER REGIONS
        // ══════════════════════════════════════════════════════════════════════
        onApplyToOtherRegions: function () {
            const oView = this.getView();
            if (!this._oApplyOtherRegionsDialog) {
                this._oApplyOtherRegionsDialog = sap.ui.xmlfragment(
                    oView.getId(),
                    "vehiclepricingui.view.fragments.ApplyToOtherRegions",
                    this
                );
                oView.addDependent(this._oApplyOtherRegionsDialog);
            }
            this._prepareOtherRegions();
            this._oApplyOtherRegionsDialog.open();
        },

        onCancelApplyOtherRegions: function () {
            if (this._oApplyOtherRegionsDialog) this._oApplyOtherRegionsDialog.close();
        },

// ─────────────────────────────────────────────────────────────────────────────
// PASTE THESE THREE METHODS INTO vechilepricingmain.controller.js
// replacing the existing _prepareOtherRegions, onRegionSelectionChange,
// and onConfirmApplyOtherRegions methods.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tracks which regions have already been successfully processed ─────────────
// Stored on the controller instance so it survives dialog close/reopen.
// this._oAppliedRegions = new Set()   ← initialised lazily below


// ══════════════════════════════════════════════════════════════════════════════
//  _prepareOtherRegions
//  Builds the region list for the dialog.
//  • Excludes the currently-selected source region.
//  • Marks already-processed regions as disabled (_enabled = false)
//    so they render greyed-out and are un-selectable.
//  • Removes the old "__ALL__" sentinel item.
// ══════════════════════════════════════════════════════════════════════════════
_prepareOtherRegions: function () {
    const oVM        = this.getView().getModel("vm");
    const sSelected  = this.byId("idRegionMCB").getSelectedKey();
    const aRegions   = oVM.getProperty("/regions") || [];

    // Lazily initialise the applied-regions tracker
    if (!this._oAppliedRegions) {
        this._oAppliedRegions = new Set();
    }

    // De-duplicate by Region key, exclude the source region
    const mMap = {};
    aRegions.forEach(o => {
        if (o.Region !== sSelected) {
            mMap[o.Region] = {
                Region:   o.Region,
                Ort01:    o.Ort01,
                // Disable the item if it was already successfully processed
                _enabled: !this._oAppliedRegions.has(o.Region)
            };
        }
    });

    oVM.setProperty("/otherRegions", Object.values(mMap));
},


// ══════════════════════════════════════════════════════════════════════════════
//  onRegionSelectionChange
//  Enforces the 5-region maximum.
//  If the user tries to select a 6th region the token is removed immediately
//  and a warning strip is shown inside the dialog.
// ══════════════════════════════════════════════════════════════════════════════
onRegionSelectionChange: function (oEvent) {
    const oMCB          = oEvent.getSource();
    const aSelectedKeys = oMCB.getSelectedKeys();
    const MAX           = 5;

    // Show / hide the limit warning strip
    const oStrip = this.byId("regionLimitStrip");

    if (aSelectedKeys.length > MAX) {
        // Drop the item that just pushed it over the limit
        // (it is always the last one added — the changedItem from the event)
        const oChangedItem = oEvent.getParameter("changedItem");
        if (oChangedItem) {
            const aFixed = aSelectedKeys.filter(k => k !== oChangedItem.getKey());
            oMCB.setSelectedKeys(aFixed);
        } else {
            // Fallback: trim to first MAX
            oMCB.setSelectedKeys(aSelectedKeys.slice(0, MAX));
        }

        if (oStrip) oStrip.setVisible(true);
    } else {
        if (oStrip) oStrip.setVisible(aSelectedKeys.length === MAX);
    }
},


// ══════════════════════════════════════════════════════════════════════════════
//  onConfirmApplyOtherRegions
//  Same chunked logic as before, but:
//  On full success the processed region codes are added to
//    this._oAppliedRegions so they appear disabled next time.
// ══════════════════════════════════════════════════════════════════════════════
onConfirmApplyOtherRegions: async function () {
    this._oApplyOtherRegionsDialog.setBusy(true);

    try {
        const aRegionCodes = this.byId("otherRegionsMCB").getSelectedKeys();
        if (!aRegionCodes.length) {
            MessageToast.show("Please select at least one region");
            return;
        }

        // Guard: should never exceed 5 (UI already prevents it, but be safe)
        if (aRegionCodes.length > 5) {
            MessageToast.show("Please select a maximum of 5 regions at a time.");
            return;
        }

        const aItems = this._prepareApplyPayload();
        if (!aItems.length) {
            MessageToast.show("No data available");
            return;
        }

        const REGION_CHUNK = 3;
        const ITEM_CHUNK   = 100;

        // Split regions into chunks of 3
        const aRegionChunks = [];
        for (let i = 0; i < aRegionCodes.length; i += REGION_CHUNK) {
            aRegionChunks.push(aRegionCodes.slice(i, i + REGION_CHUNK));
        }

        // Split items (models) into chunks of 200
        const aItemChunks = [];
        for (let i = 0; i < aItems.length; i += ITEM_CHUNK) {
            aItemChunks.push(aItems.slice(i, i + ITEM_CHUNK));
        }

        const aAllResults = [];

        for (let r = 0; r < aRegionChunks.length; r++) {
            for (let m = 0; m < aItemChunks.length; m++) {
                const aChunkResults = await this._callAddToOtherRegion({
                    items:       aItemChunks[m],
                    regionCodes: aRegionChunks[r]
                });
                aAllResults.push(...aChunkResults);

                await new Promise(res => setTimeout(res, 500));
            }
        }

        const aSucceeded = aAllResults.filter(r =>  r.success === true || (!r.error && r.MtoMts));
        const aFailed    = aAllResults.filter(r =>  r.success === false && !r.error?.includes("Skipped"));
        const aSkipped   = aAllResults.filter(r =>  r.error?.includes("Skipped"));

        if (aSucceeded.length) {
            this._mergeOtherRegionResults(aSucceeded);
        }

        // ── Mark successfully-applied regions as processed ────────────────────
        // Only mark a region if every result for it was a success (no failures).
        if (!this._oAppliedRegions) {
            this._oAppliedRegions = new Set();
        }

        const aFailedRegions = new Set(
            aFailed.map(r => r.regionCode || r.Region).filter(Boolean)
        );

        aRegionCodes.forEach(sCode => {
            if (!aFailedRegions.has(sCode)) {
                this._oAppliedRegions.add(sCode);
            }
        });

        // Refresh the region list so disabled states update immediately
        this._prepareOtherRegions();

        // Clear the MCB selection for the next round
        const oMCB = this.byId("otherRegionsMCB");
        if (oMCB) oMCB.setSelectedKeys([]);

        // Hide the limit warning strip
        const oStrip = this.byId("regionLimitStrip");
        if (oStrip) oStrip.setVisible(false);

        this._showSummaryDialog(aSucceeded, aFailed, aSkipped);

        // Close the dialog only on full success
        if (!aFailed.length && !aSkipped.length) {
            this._oApplyOtherRegionsDialog.close();
        }

    } catch (e) {
        MessageBox.error(e.message || "Failed to apply to other regions");
    } finally {
        this._oApplyOtherRegionsDialog.setBusy(false);
    }
},

        //new changes 

        // ══════════════════════════════════════════════════════════════════════
        //  GROWING TABLE HELPER
        //  Call after every setProperty("/tableData", ...) to reset the
        //  visible window back to the first 200 rows.
        // ══════════════════════════════════════════════════════════════════════
        _resetTableGrowing: function () {
            const oTable = this.byId("idvechileTable");
            if (!oTable) return;

            const aData = this.getView().getModel("vm").getProperty("/tableData") || [];
            const PAGE = 200;

            // Reset threshold to exactly one page so "Load more" appears correctly
            oTable.setGrowingThreshold(PAGE);

            // Force binding refresh so the table re-renders from row 0
            const oBinding = oTable.getBinding("items");
            if (oBinding) oBinding.refresh();

            // Update footer info text
            const iVisible = Math.min(PAGE, aData.length);
            this.getView().getModel("vm").setProperty(
                "/tableFooterText",
                `Showing ${iVisible} of ${aData.length} rows`
            );
        },

        _mergeOtherRegionResults: function (aSucceeded) {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            aSucceeded.forEach(r => {
                const bIsMTO = !!r.MtoMts;
                const sModelCode = r.ModelCode || r.Model;
                const sRegionCode = r.regionCode || r.Region;

                const iExisting = aData.findIndex(
                    row => row.ModelCode === sModelCode && row.Region === sRegionCode
                );

                const oNewRow = {
                    Model: sModelCode,
                    ModelCode: sModelCode,
                    Region: sRegionCode,
                    MtoMts: r.MtoMts || "",
                    Basis: r.Basis || r.BasisRto || "",

                    ActualExShowroom: bIsMTO ? (r.ActualExShowroom || "") : (r.ex_showroomAfterGST || ""),
                    InputExShowroom: this.formatIndian(bIsMTO ? (r.ActualExShowroom || "") : (r.InputExShowroom || r.ex_showroomAfterGST || "")),
                    // InputNsp: this.formatIndian(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")),
                    // Add this after the InputNsp line in oNewRow:
                    InputNsp: this.formatIndian(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")),
                    _rawInputNsp: String(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")).replace(/,/g, ""),
                    OnRoad: bIsMTO ? (r.OnRoad || 0) : (r.OnRoadPrice || 0),

                    DealerMarginPerc: r.DealerMarginPerc || "",
                    ActualNsp: bIsMTO ? (r.ActualNsp || "") : (r.CalculatedNSP || ""),
                    IncrementalNSP: r.IncrementalNsp || r.IncrementalNSP || "",
                    Helmet: r.Helmet || "",
                    Transportation: r.Transportation || "",
                    DealerCost: r.DealerCost || "",
                    OtherExpenses: r.OtherExpenses || "",

                    BikeMargin: bIsMTO ? (r.BikeMargin || "") : (r.BikeMarigin || ""),
                    ActualDealerMargin: bIsMTO ? (r.ActualDealerMargin || "") : (r.DealerMarigin || ""),
                    Incremental2: String(
                        (parseFloat(bIsMTO ? r.BikeMargin : r.BikeMarigin) || 0) -
                        (parseFloat(bIsMTO ? r.ActualDealerMargin : r.DealerMarigin) || 0)
                    ),
                    HelmetMargin: bIsMTO ? (r.HelmetMargin || "") : (r.HelmetMarigin || ""),
                    TotalDealerMargin: bIsMTO ? (r.TotalDealerMargin || "") : (r.totalDealerMarigin || ""),

                    Ndp: r.Ndp || r.NDP || "",
                    Basic: r.Basic || "",
                    GSTPerc: r.GstPerc || r.GSTPerc || "",
                    Gst: r.GSTAfterbasic || r.Gst || "",
                    RtoPerc: r.RtoPerc || r.RTO_percentage || "",
                    Rto: r.Rto || r.RTO || "",
                    RtoWithBill: r.RtoWithBill || String(r.RTO_bill) || "",
                    insuranceperc: r.insuranceperc || "0",
                    Insurance: r.Insurance || r.insurance || "",
                    TpaPa: r.TpaPa || r.TPA_PA || "",
                    ActualGst: r.ActualGst || r.GST_afterTPA || "",
                    TotalInsurance: r.TotalInsurance || "",
                    ExceptionRef: r.ExceptionRef || "E",
                    ReferenceNum: r.ReferenceNum || "",
                    ReferMtsModel: r.ReferModel || r.ReferMtsModel || "",

                    MtoNsp: r.MTO_NSP || "",
                    MTSExshowroom: r.MTSExshowroom || "",
                    MTOExshowroomafterGMA: r.MTOExshowroomafterGMA || "",
                    MTOOnRoad: r.MTOOnRoad || "",
                    MIYExShowroomTotal: r.MiyExShowroomTotal || 0,
                    MIYOnRoadTotal: r.MiyOnRoadTotal || 0,

                    IncrementDlr: r.IncrementDlr || "0",
                    ExpectedOnRoad: bIsMTO ? (r.ExpectedOnRoad || "") : (r.OnRoadPrice || ""),

                    rowStatus: "NEW",
                    isCalculated: true,   // ✅ mark as calculated so filters pick it up
                    isChanged: false,
                    InputExShowroomEnabled: false,
                    InputNspEnabled: false,
                    _origInputExShowroom: "",
                    _origInputNsp: ""
                };

                if (iExisting >= 0) {
                    aData[iExisting] = oNewRow;
                } else {
                    aData.push(oNewRow);
                }
            });

            oVM.setProperty("/tableData", [...aData]);

            const aSnap = JSON.parse(JSON.stringify(oVM.getProperty("/_allProcessedTableData") || []));
            (oVM.getProperty("/tableData") || []).forEach(oRow => {
                const iIdx = aSnap.findIndex(
                    s => s.ModelCode === oRow.ModelCode && s.Region === oRow.Region
                );
                if (iIdx >= 0) {
                    aSnap[iIdx] = JSON.parse(JSON.stringify(oRow));
                } else {
                    aSnap.push(JSON.parse(JSON.stringify(oRow)));
                }
            });
            oVM.setProperty("/_allProcessedTableData", aSnap);

            // ✅ Rebuild filter dropdowns to include the newly merged regions/models
            this._buildProcessedFilters();
        },
        _showSummaryDialog: function (aSucceeded, aFailed, aSkipped) {
            const INITIAL_SHOW = 4;

            // ← normalise: MTO results use Model/Region, others use ModelCode/regionCode
            const getModel = r => r.ModelCode || r.Model || "?";
            const getRegion = r => r.regionCode || r.Region || "?";

            const allLines = [
                ...aSucceeded.map(r => ({ text: `${getModel(r)} - ${getRegion(r)} - OK`, type: "success" })),
                ...aSkipped.map(r => ({ text: `${getModel(r)} - ${getRegion(r)} - No price provided`, type: "warning" })),
                ...aFailed.map(r => ({ text: `${getModel(r)} - ${getRegion(r)} - ${r.error}`, type: "error" }))
            ];
            const sTitle = aFailed.length ? "Apply to Other Regions - Errors" :
                aSkipped.length ? "Apply to Other Regions - Warning" :
                    "Apply to Other Regions - Success";
            let bExpanded = false;
            const renderLines = lines => lines.map(l => {
                const color = l.type === "success" ? "#107e3e" : l.type === "warning" ? "#e9730c" : "#bb0000";
                return `<div style="padding:4px 0; color:${color}; font-size:13px;">${l.text}</div>`;
            }).join("");
            const sInitial = renderLines(allLines.slice(0, INITIAL_SHOW));
            const sFull = renderLines(allLines);
            const sMore = allLines.length > INITIAL_SHOW
                ? `<div style="margin-top:8px;"><a id="vpShowMoreLink" href="javascript:void(0)" style="color:#0070f2;font-size:13px;">Show more (${allLines.length - INITIAL_SHOW} more)</a></div>`
                : "";
            const sHTML = `<div style="padding:8px;"><div id="vpSummaryLines">${sInitial}</div>${sMore}</div>`;
            if (this._oSummaryDialog) { this._oSummaryDialog.destroy(); this._oSummaryDialog = null; }
            this._oSummaryDialog = new sap.m.Dialog({
                title: sTitle,
                state: aFailed.length ? "Error" : aSkipped.length ? "Warning" : "Success",
                content: [new sap.ui.core.HTML({
                    content: sHTML,
                    afterRendering: function () {
                        const oLink = document.getElementById("vpShowMoreLink");
                        if (oLink) {
                            oLink.addEventListener("click", function () {
                                const oDiv = document.getElementById("vpSummaryLines");
                                if (!bExpanded) { oDiv.innerHTML = sFull; oLink.textContent = "Show less"; bExpanded = true; }
                                else { oDiv.innerHTML = sInitial; oLink.textContent = `Show more (${allLines.length - INITIAL_SHOW} more)`; bExpanded = false; }
                            });
                        }
                    }
                })],
                beginButton: new sap.m.Button({ text: "Close", press: () => this._oSummaryDialog.close() }),
                afterClose: () => { this._oSummaryDialog.destroy(); this._oSummaryDialog = null; }
            });
            this.getView().addDependent(this._oSummaryDialog);
            this._oSummaryDialog.open();
        },

        _callAddToOtherRegion: async function (oPayload) {
            const oModel = this.getOwnerComponent().getModel();
            const oVM = this.getView().getModel("vm");
            const oAction = oModel.bindContext("/addToOtherRegion(...)");
            oAction.setParameter("Mail", oVM.getProperty("/ASMEmail"));
            oAction.setParameter("MTOStatus", this.byId("idMtoMtsMCB").getSelectedKey());
            oAction.setParameter("items", oPayload.items);
            oAction.setParameter("regionCodes", oPayload.regionCodes);
            oAction.setParameter("StatusFilter", this.byId("idStatus").getSelectedKey() || "ACTIVE");
            oAction.setParameter("EffectiveDate", oVM.getProperty("/valueDP2") || "");
            await oAction.execute();
            const oContext = oAction.getBoundContext();
            const oResult = oContext.getObject();
            if (Array.isArray(oResult)) return oResult;
            if (Array.isArray(oResult?.value)) return oResult.value;
            const aValues = oModel.getObject(oContext.getPath() + "/value");
            if (Array.isArray(aValues)) return aValues;
            return [];
        },

//         _callAddToOtherRegion: async function (oPayload) {
//     const oModel = this.getOwnerComponent().getModel();
//     const oVM = this.getView().getModel("vm");
    
//     // Get base service URL
//     const sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
//     const sFullUrl = sServiceUrl + "/addToOtherRegion";
    
//     const oBody = {
//         Mail: oVM.getProperty("/ASMEmail"),
//         MTOStatus: this.byId("idMtoMtsMCB").getSelectedKey(),
//         items: oPayload.items,
//         regionCodes: oPayload.regionCodes,
//         StatusFilter: this.byId("idStatus").getSelectedKey() || "ACTIVE",
//         EffectiveDate: oVM.getProperty("/valueDP2") || ""
//     };

//     const oResponse = await fetch(sFullUrl, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             "Accept": "application/json"
//         },
//         credentials: "include",
//         body: JSON.stringify(oBody)
//     });

//     if (!oResponse.ok) {
//         let sMessage = `HTTP ${oResponse.status}`;
//         try {
//             const oErr = await oResponse.json();
//             sMessage = oErr?.error?.message?.value || oErr?.error?.message || sMessage;
//         } catch (e) { /* ignore parse error */ }
//         throw new Error(sMessage);
//     }

//     const oJson = await oResponse.json();
    
//     // Normalize response — same as before
//     if (Array.isArray(oJson)) return oJson;
//     if (Array.isArray(oJson?.value)) return oJson.value;
//     if (Array.isArray(oJson?.d?.results)) return oJson.d.results;
//     return [];
// },

// _callAddToOtherRegion: async function (oPayload) {
//     const oModel = this.getOwnerComponent().getModel();
//     const oVM = this.getView().getModel("vm");

//     const sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
//     const sFullUrl = sServiceUrl + "/addToOtherRegion";

//     const oBody = {
//         Mail: oVM.getProperty("/ASMEmail"),
//         MTOStatus: this.byId("idMtoMtsMCB").getSelectedKey(),
//         items: oPayload.items,
//         regionCodes: oPayload.regionCodes,
//         StatusFilter: this.byId("idStatus").getSelectedKey() || "ACTIVE",
//         EffectiveDate: oVM.getProperty("/valueDP2") || ""
//     };

//     // ── Hard 55-second abort (just under typical 60s gateway timeout) ──
//     const oController = new AbortController();
//     const iTimer = setTimeout(() => oController.abort(), 55000);

//     let oResponse;
//     try {
//         oResponse = await fetch(sFullUrl, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "Accept": "application/json"
//             },
//             credentials: "include",
//             signal: oController.signal,
//             body: JSON.stringify(oBody)
//         });
//     } catch (e) {
//         if (e.name === "AbortError") {
//             throw new Error(
//                 "Request timed out. The server is taking too long.\n" +
//                 "Try selecting fewer models or fewer regions at a time."
//             );
//         }
//         throw e;
//     } finally {
//         clearTimeout(iTimer);
//     }

//     if (!oResponse.ok) {
//         let sMessage = `HTTP ${oResponse.status}`;
//         try {
//             const oErr = await oResponse.json();
//             sMessage = oErr?.error?.message?.value || oErr?.error?.message || sMessage;
//         } catch (e) { /* ignore */ }
//         throw new Error(sMessage);
//     }

//     const oJson = await oResponse.json();

//     if (Array.isArray(oJson)) return oJson;
//     if (Array.isArray(oJson?.value)) return oJson.value;
//     if (Array.isArray(oJson?.d?.results)) return oJson.d.results;
//     return [];
// },

        

     _prepareApplyPayload: function () {
    const oVM = this.getView().getModel("vm");
    const aData = oVM.getProperty("/tableData") || [];

    // ── Only send rows from the source region that the user searched for ──
    const sSourceRegion = this.byId("idRegionMCB").getSelectedKey();

    const aSourceRows = sSourceRegion
        ? aData.filter(oRow => oRow.Region === sSourceRegion)
        : aData;

    if (!aSourceRows.length) {
        MessageToast.show("No data available in table");
        return [];
    }

    return aSourceRows.map(o => ({
        ModelCode: o.ModelCode || o.Model,
        nspValue: this._stripCommas(o.InputNsp || ""),
        exshowroomPrice: this._stripCommas(o.InputExShowroom || o.ActualExShowroom || "")
    }));
},


        //new changes


        // ── Called after process calculation completes successfully ──
        // ── Called after process calculation completes successfully ──
        _buildProcessedFilters: function () {
            const oVM = this.getView().getModel("vm");

            // ✅ Always read from the accumulated snapshot — NOT from /tableData
            const aSnapshot = oVM.getProperty("/_allProcessedTableData") || [];

            const aRegions = [...new Set(aSnapshot.map(r => r.Region).filter(Boolean))]
                .sort()
                .map(r => ({ Region: r }));

            const aModels = [...new Set(aSnapshot.map(r => r.Model || r.ModelCode).filter(Boolean))]
                .sort()
                .map(m => ({ Model: m }));

            oVM.setProperty("/processedRegions", aRegions);
            oVM.setProperty("/processedModels", aModels);
            oVM.setProperty("/showProcessedFilters", aRegions.length > 0 || aModels.length > 0);

            // Reset selections
            // const oRegionFilter = this.byId("idProcessedRegionFilter");
            // const oModelFilter = this.byId("idProcessedModelFilter");
            // if (oRegionFilter) oRegionFilter.setSelectedKeys([]);
            // if (oModelFilter) oModelFilter.setSelectedKeys([]);
        },

        // ── Fired when either processed filter dropdown changes ──
        onProcessedFilterChange: function () {
            const oVM = this.getView().getModel("vm");

            const oRegionFilter = this.byId("idProcessedRegionFilter");
            const oModelFilter = this.byId("idProcessedModelFilter");

            const aSelectedRegions = oRegionFilter ? oRegionFilter.getSelectedKeys() : [];
            const aSelectedModels = oModelFilter ? oModelFilter.getSelectedKeys() : [];

            // ✅ Always filter from the accumulated snapshot
            const aAllData = oVM.getProperty("/_allProcessedTableData") || [];

            // "View All" — if nothing selected in both dropdowns, show everything
            const bShowAll = !aSelectedRegions.length && !aSelectedModels.length;
            if (bShowAll) {
                oVM.setProperty("/tableData", [...aAllData]);
                return;
            }

            const aFiltered = aAllData.filter(oRow => {
                const bRegionMatch = !aSelectedRegions.length ||
                    aSelectedRegions.includes(oRow.Region);
                const bModelMatch = !aSelectedModels.length ||
                    aSelectedModels.includes(oRow.Model || oRow.ModelCode);
                return bRegionMatch && bModelMatch;
            });

            oVM.setProperty("/tableData", aFiltered);
        },

    getRowsToSave: function () {
        const oTable = this.byId("idvechileTable");
        const aSelected = oTable ? oTable.getSelectedItems() : [];

        if (aSelected.length) {
            return aSelected
                .map(oItem => oItem.getBindingContext("vm").getObject())
                .filter(oRow => oRow.isCalculated === true);
        }

        return (this.getView().getModel("vm").getProperty("/tableData") || [])
            .filter(r => r.isCalculated === true);
    },

    _getAllProcessedRows: function () {
        const oVM = this.getView().getModel("vm");
        return (oVM.getProperty("/_allProcessedTableData") || [])
            .filter(r => r.isCalculated === true);
    },

    _buildSaveItems: function (sSaveInd, aRows) {
        const aData = Array.isArray(aRows) ? aRows : this.getRowsToSave();
        const email = this.getView().getModel("vm").getProperty("/ASMEmail");
        const ASMName = this.getView().getModel("vm").getProperty("/ASMName");
        const strip = (v) => String(v || "").replace(/,/g, "").trim();

        return aData.map(o => ({
            Mail: email,
            AsmName: ASMName,
            Model: o.Model,
            OperationNo: 0,
            SaveInd: sSaveInd,
            Region: o.Region,
            MtoMts: this.byId("idMtoMtsMCB").getSelectedKey(),
            Basis: o.Basis,
            ReferenceNum: o.ReferenceNum || "",
            ExceptionRef: o.ExceptionRef || "E",
            GstPerc: this.uiDec(strip(o.GSTPerc ?? 0), 3),
            DealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
            InputNsp: String(this.uiDec(strip(o.InputNsp))),
            IncrementalNsp: String(this.uiDec(strip(o.IncrementalNSP ?? o.IncrementalNsp ?? "0"))),
            ActualNsp: String(this.uiDec(strip(o.ActualNsp))),
            Helmet: this.uiInt(strip(o.Helmet)),
            Transportation: this.uiInt(strip(o.Transportation)),
            DealerCost: this.uiInt(strip(o.DealerCost)),
            OtherExpenses: this.uiInt(strip(o.OtherExpenses)),
            BikeMargin: this.uiInt(strip(o.BikeMargin)),
            IncrementDlr: this.uiDec(strip(o.Incremental2 ?? o.IncrementDlr ?? "0")),
            ActualDealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
            HelmetMargin: this.uiInt(strip(o.HelmetMargin)),
            TotalDealerMargin: this.uiInt(strip(o.TotalDealerMargin)),
            Ndp: this.uiInt(strip(o.Ndp)),
            Basic: this.uiInt(strip(o.Basic)),
            Gst: this.uiInt(strip(o.Gst)),
            InputExShowroom: this.uiInt(strip(o.InputExShowroom)),
            ActualExShowroom: this.uiInt(strip(o.ActualExShowroom)),
            RtoPerc: String(this.uiDec(strip(o.RtoPerc))),
            Rto: this.uiInt(strip(o.Rto)),
            RtoWithBill: this.uiInt(strip(o.RtoWithBill)),
            InsuranceLe350: String(this.uiDec(strip(o.InsuranceLe350 ?? 0))),
            InsuranceGt350: String(this.uiDec(strip(o.InsuranceGt350 ?? 0))),
            Insurance: this.uiInt(strip(o.Insurance)),
            TpaPa: this.uiInt(strip(o.TpaPa)),
            ActualGst: this.uiInt(strip(o.ActualGst)),
            TotalInsurance: this.uiInt(strip(o.TotalInsurance)),
            OnRoad: this.uiInt(strip(o.OnRoad)),
            Diff: this.uiInt(strip(o.Diff ?? 0)),
            ReferenceMtsModel: o.ReferMtsModel || "",
            MtoNsp: String(this.uiDec(strip(o.MtoNsp ?? 0))),
            MiyExshowroom: this.uiInt(strip(o.MIYExShowroomTotal ?? 0)),
            MiyOnroad: this.uiInt(strip(o.MIYOnRoadTotal ?? 0)),
            ExpExshowroom: this.uiInt(strip(o.MTOExshowroomafterGMA ?? 0)),
            ExpOnroad: this.uiInt(strip(o.ExpectedOnRoad ?? 0))
        }));
    },

    _prepareSavePayload: function () {
        return this._buildSaveItems("", this._getAllProcessedRows());
    },

    _prepareSavePayloadForSubmit: function () {
        return this._buildSaveItems("X", this._getAllProcessedRows());
    },

    onSave: function () {
        const aItems = this._prepareSavePayload();
        if (!aItems.length) {
            MessageToast.show("No processed rows to save");
            return;
        }

        MessageBox.confirm(
            "Do you want to save all processed pricing data? This will save every calculated row.",
            {
                title: "Confirm Save",
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    this._openBusyDialog("Saving", "Saving price breakup for " + aItems.length + " row(s)…");
                    try {
                        const oAction = this.getOwnerComponent().getModel().bindContext("/saveToModelPriceBreakUp(...)");
                        oAction.setParameter("items", aItems);
                        await oAction.execute();
                        this._closeBusyDialog();
                        MessageBox.success("Price breakup saved successfully!\n" + aItems.length + " row(s) saved.", {
                            title: "Save Successful",
                            actions: [MessageBox.Action.OK],
                            emphasizedAction: MessageBox.Action.OK,
                            onClose: () => this._resetToFullInitialState()
                        });
                    } catch (e) {
                        this._closeBusyDialog();
                        MessageBox.error(e.message || "Failed to save.", { title: "Save Error" });
                        console.error(e);
                    }
                }
            }
        );
    },

    onSubmit: function () {
        const aItems = this._prepareSavePayloadForSubmit();
        if (!aItems.length) {
            MessageToast.show("No processed rows to submit");
            return;
        }

        MessageBox.confirm(
            "Do you want to submit all processed pricing data? This will submit every calculated row.",
            {
                title: "Confirm Submit",
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    this._openBusyDialog("Submit", "Submitting price breakup for " + aItems.length + " row(s)…");
                    try {
                        const oAction = this.getOwnerComponent().getModel().bindContext("/saveToModelPriceBreakUp(...)");
                        oAction.setParameter("items", aItems);
                        await oAction.execute();
                        this._closeBusyDialog();
                        MessageBox.success("Price breakup submitted successfully!\n" + aItems.length + " row(s) submitted.", {
                            title: "Submit Successful",
                            actions: [MessageBox.Action.OK],
                            emphasizedAction: MessageBox.Action.OK,
                            onClose: () => this._resetToFullInitialState()
                        });
                    } catch (e) {
                        this._closeBusyDialog();
                        MessageBox.error(e.message || "Failed to submit.", { title: "Submit Error" });
                        console.error(e);
                    }
                }
            }
        );
    },

        // ══════════════════════════════════════════════════════════════════════
        //  RESET
        // ══════════════════════════════════════════════════════════════════════
        _resetToInitialState: function () {
            const oVM = this.getView().getModel("vm");
            oVM.setProperty("/tableData", []);
            oVM.setProperty("/_allTableData", []);
            this._resetColumnGroups();
            this.byId("processcalculation").setEnabled(false);
            this.byId("processcalculation").setVisible(true);
            this.byId("saveBtn").setEnabled(false);
            const oApplyBtn = this.byId("applyOtherRegionsBtn");
            if (oApplyBtn) oApplyBtn.setEnabled(false);
            oVM.setProperty("/enableSaveActions", false);
            oVM.setProperty("/enableEditActions", false);
            oVM.setProperty("/selectedMto", "");
        },

        _resetToFullInitialState: function () {
            const oVM = this.getView().getModel("vm");
            oVM.setProperty("/tableData", []);
            oVM.setProperty("/_allTableData", []);
            this.byId("idRegionMCB").setSelectedKey("");
            this.byId("idMtoMtsMCB").setSelectedKey("");
            const oModelMCB = this.byId("idModelMCB");
            if (oModelMCB) oModelMCB.setSelectedKeys([]);
            const oColGrpMCB = this.byId("idColumnGroupMCB");
            if (oColGrpMCB) oColGrpMCB.setSelectedKeys([]);
            oVM.setProperty("/regionVS", "None");
            oVM.setProperty("/mtoVS", "None");
            oVM.setProperty("/selectedMto", "");
            this._resetColumnGroups();
            this.byId("processcalculation").setEnabled(false);
            this.byId("saveBtn").setEnabled(false);
            const oApplyBtn = this.byId("applyOtherRegionsBtn");
            if (oApplyBtn) oApplyBtn.setEnabled(false);
            oVM.setProperty("/enableSaveActions", false);
            oVM.setProperty("/enableEditActions", false);
        },

        // ══════════════════════════════════════════════════════════════════════
        //  UPLOAD / DOWNLOAD
        // ══════════════════════════════════════════════════════════════════════
        onUploadPress: function () { this._triggerFileInput(); },
        onDownloadMenuPress: function (oEvent) {
            const oSheet = this.byId("downloadActionSheet");
            if (oSheet) oSheet.openBy(oEvent.getSource());
        },

        onExcelDownloadTemplate: function () {
            const EdmType = sap.ui.export.EdmType;

            const aTemplateColumns = [
                { label: "Model", property: "Model", type: EdmType.String },
                { label: "Region", property: "Region", type: EdmType.String },
                { label: "Basis / RTO", property: "Basis", type: EdmType.String },
                { label: "Ex-Showroom", property: "InputExShowroom", type: EdmType.Number, scale: 2 },
                { label: "NSP Input", property: "InputNsp", type: EdmType.Number, scale: 2 }
            ];

            // ── Pull existing table data so the user gets pre-filled rows ──
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            // ── If table has data, pre-fill Model / Region / Basis only ──
            // ── Ex-Showroom and NSP are left blank intentionally         ──
            const aTemplateData = aData.length
                ? aData.map(oRow => ({
                    Model: oRow.Model || oRow.ModelCode || "",
                    Region: oRow.Region || "",
                    Basis: oRow.Basis || "",
                    InputExShowroom: "",   // user fills this
                    InputNsp: ""   // user fills this
                }))
                : [
                    // ── Blank sample row so Excel isn't totally empty ──
                    { Model: "", Region: "", Basis: "", InputExShowroom: "", InputNsp: "" }
                ];

            const oSettings = {
                workbook: { columns: aTemplateColumns },
                dataSource: aTemplateData,
                fileName: "VehiclePricing_Template.xlsx"
            };

            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },

        onExcelDownload: function () {
            const aColumns = this._getVisibleTableColumns();
            if (!aColumns.length) { sap.m.MessageToast.show("No data available"); return; }
            const oView = this.getView();
            if (!this._oExcelFieldDialog) {
                this._oExcelFieldDialog = sap.ui.xmlfragment(
                    oView.getId(), "vehiclepricingui.view.fragments.ExcelFieldDialog", this
                );
                oView.addDependent(this._oExcelFieldDialog);
            }
            this._oExcelFieldDialog.setModel(new sap.ui.model.json.JSONModel({ columns: aColumns }));
            this._oExcelFieldDialog.open();
        },

        onConfirmExcelDownload: function () {
            const oList = this.byId("excelFieldList");
            const aSelectedItems = oList.getSelectedItems();
            if (!aSelectedItems.length) { sap.m.MessageToast.show("Please select at least one field"); return; }
            this._downloadExcel(aSelectedItems.map(item => {
                const oData = item.getBindingContext().getObject();
                return { label: oData.label, property: oData.property };
            }));
            this._oExcelFieldDialog.close();
        },

        onCloseExcelDialog: function () { if (this._oExcelFieldDialog) this._oExcelFieldDialog.close(); },

        onExcelCategoryNext: function () {
            const aCategories = this.byId("excelCategoryMCB").getSelectedKeys();
            if (!aCategories.length) { sap.m.MessageToast.show("Select category"); return; }
            let aFields = [];
            aCategories.forEach(cat => { aFields = aFields.concat(EXCEL_FIELDS[cat] || []); });
            this._downloadExcel(aFields);
        },

        _downloadExcel: function (selectedFields) {
            const oSettings = {
                workbook: { columns: selectedFields },
                dataSource: this.getView().getModel("vm").getProperty("/tableData"),
                fileName: "VehiclePricing.xlsx"
            };
            new Spreadsheet(oSettings).build();
        },

        onCloseExcelCategory: function () { if (this._oExcelCategoryDialog) this._oExcelCategoryDialog.close(); },

        _getVisibleTableColumns: function () {
            const oTable = this.byId("idvechileTable");
            const aColumns = oTable.getColumns();
            const aItems = oTable.getItems();
            if (!aItems.length) return [];
            const aCells = aItems[0].getCells();
            const aResult = [];
            aColumns.forEach((col, index) => {
                if (!col.getVisible()) return;
                const sLabel = col.getHeader().getText();
                const oCell = aCells[index];
                let sProperty = "";
                if (oCell?.getBinding("text")) sProperty = oCell.getBinding("text").getPath();
                else if (oCell?.getBinding("value")) sProperty = oCell.getBinding("value").getPath();
                else if (oCell?.getBinding("number")) sProperty = oCell.getBinding("number").getPath();
                else if (oCell?.getBinding("title")) sProperty = oCell.getBinding("title").getPath();
                else if (oCell?.getItems) {
                    oCell.getItems().forEach(inner => {
                        if (inner.getBinding?.("value")) sProperty = inner.getBinding("value").getPath();
                    });
                }
                if (sProperty) aResult.push({ label: sLabel, property: sProperty });
            });
            return aResult;
        },

        _triggerFileInput: function () {
            if (!this._oFileInput) {
                this._oFileInput = document.createElement("input");
                this._oFileInput.type = "file";
                this._oFileInput.accept = ".xlsx,.xls,.csv";
                this._oFileInput.style.display = "none";
                document.body.appendChild(this._oFileInput);
                this._oFileInput.addEventListener("change", (oEvent) => {
                    const oFile = oEvent.target.files[0];
                    if (oFile) this._handleExcelFile(oFile);
                    oEvent.target.value = "";
                });
            }
            this._oFileInput.click();
        },

        onExcelUploadPress: function () { this._triggerFileInput(); },

        _handleExcelFile: function (oFile) {
            if (!oFile) return;
            const sExt = oFile.name.split(".").pop().toLowerCase();
            if (!["xlsx", "xls", "csv"].includes(sExt)) {
                MessageToast.show("Please upload a valid Excel or CSV file");
                return;
            }
            const oReader = new FileReader();
            oReader.onload = (e) => {
                try {
                    let aData = [];
                    if (sExt === "csv") {
                        const aLines = e.target.result.split(/\r?\n/).filter(l => l.trim());
                        if (!aLines.length) { MessageToast.show("File is empty"); return; }
                        const aHeaders = aLines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
                        aData = aLines.slice(1).map(sLine => {
                            const aVals = sLine.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
                            const oRow = {};
                            aHeaders.forEach((h, i) => { oRow[h] = aVals[i] ?? ""; });
                            return oRow;
                        });
                    } else {
                        const XLSX = window.XLSX;
                        if (!XLSX) { MessageBox.error("XLSX library not available."); return; }
                        const oWB = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                        aData = XLSX.utils.sheet_to_json(oWB.Sheets[oWB.SheetNames[0]], { defval: "", raw: false });
                    }
                    if (!aData.length) { MessageToast.show("No data rows found in the file"); return; }

                    const aMapped = aData.map(oRow => ({
                        Model: oRow["Models"] || oRow["Model"] || oRow["ModelCode"] || "",
                        ModelCode: oRow["Models"] || oRow["Model"] || oRow["ModelCode"] || "",
                        Region: oRow["Region Code"] || oRow["Region"] || "",
                        Basis: oRow["Basis / RTO"] || oRow["Basis"] || "",
                        InputExShowroom: oRow["Ex-Showroom"] || oRow["Ex Showroom"] || oRow["Input Ex-showroom"] || "",
                        InputNsp: oRow["NSP Input"] || oRow["Input NSP"] || oRow["NSP Input"] || "",
                        rowStatus: "NEW",
                        isChanged: true,
                        isCalculated: false,
                        InputExShowroomEnabled: true,
                        InputNspEnabled: true,
                        _origInputExShowroom: "",
                        _origInputNsp: ""
                    }));

                    const oVM = this.getView().getModel("vm");
                    const aExisting = oVM.getProperty("/tableData") || [];

                    let iUpdated = 0;
                    let iAdded = 0;

                    aMapped.forEach(oUploaded => {
                        const sUploadedEx = String(oUploaded.InputExShowroom || "").trim();
                        const sUploadedNsp = String(oUploaded.InputNsp || "").trim();

                        // ── Guard: both fields filled in the uploaded row ──
                        if (sUploadedEx !== "" && sUploadedNsp !== "") {
                            MessageToast.show(
                                `Row ${oUploaded.Model} / ${oUploaded.Region}: ` +
                                `Both Ex-Showroom and NSP are filled — please provide only one. Row skipped.`
                            );
                            return;
                        }

                        const iMatch = aExisting.findIndex(
                            oRow =>
                                String(oRow.ModelCode).trim() === String(oUploaded.ModelCode).trim() &&
                                String(oRow.Region).trim() === String(oUploaded.Region).trim()
                        );

                        if (iMatch >= 0) {
                            // ── UPDATE existing row ──
                            const oTarget = aExisting[iMatch];

                            // Respect the lock rule: clear the other field when one is set
                            if (sUploadedEx !== "") {
                                aExisting[iMatch] = {
                                    ...oTarget,
                                    Basis: oUploaded.Basis || oTarget.Basis,
                                    InputExShowroom: sUploadedEx,
                                    InputNsp: "",           // clear NSP
                                    InputExShowroomEnabled: true,
                                    InputNspEnabled: false,        // lock NSP
                                    isChanged: true,
                                    isCalculated: false,
                                    _origInputExShowroom: oTarget._origInputExShowroom,
                                    _origInputNsp: oTarget._origInputNsp
                                };
                            } else if (sUploadedNsp !== "") {
                                aExisting[iMatch] = {
                                    ...oTarget,
                                    Basis: oUploaded.Basis || oTarget.Basis,
                                    InputExShowroom: "",           // clear Ex-Showroom
                                    InputNsp: sUploadedNsp,
                                    InputExShowroomEnabled: false,        // lock Ex-Showroom
                                    InputNspEnabled: true,
                                    isChanged: true,
                                    isCalculated: false,
                                    _origInputExShowroom: oTarget._origInputExShowroom,
                                    _origInputNsp: oTarget._origInputNsp
                                };
                            }
                            iUpdated++;
                        } else {
                            // ── ADD as new row (Model+Region not in table) ──
                            aExisting.push({
                                ...oUploaded,
                                InputNspEnabled: sUploadedEx !== "" ? false : true,
                                InputExShowroomEnabled: sUploadedNsp !== "" ? false : true
                            });
                            iAdded++;
                        }
                    });

                    oVM.setProperty("/tableData", [...aExisting]);
                    oVM.setProperty("/selectedMto", oVM.getProperty("/selectedMto") || "MTS");
                    oVM.setProperty("/processCalcVisible", true);
                    this.byId("processcalculation").setEnabled(false);

                    const aParts = [];
                    if (iUpdated) aParts.push(iUpdated + " row(s) updated");
                    if (iAdded) aParts.push(iAdded + " row(s) added");
                    MessageToast.show(aParts.join(", ") + " from " + oFile.name);

                } catch (ex) {
                    console.error("Excel parse error:", ex);
                    MessageBox.error("Failed to parse the file: " + (ex.message || "Unknown error"));
                }
            };
            sExt === "csv" ? oReader.readAsText(oFile) : oReader.readAsArrayBuffer(oFile);
        },

        // ══════════════════════════════════════════════════════════════════════
        //  ROW ACTIONS
        // ══════════════════════════════════════════════════════════════════════
        onDelete: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            if (!aSelected.length) { MessageToast.show("Please select at least one row"); return; }
            MessageBox.confirm("Are you sure you want to delete " + aSelected.length + " row(s)?", {
                title: "Confirm Delete",
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;
                    const oVM = this.getView().getModel("vm");
                    const aData = oVM.getProperty("/tableData") || [];
                    aSelected.map(item => parseInt(item.getBindingContext("vm").getPath().split("/").pop()))
                        .sort((a, b) => b - a)
                        .forEach(i => aData.splice(i, 1));
                    oVM.setProperty("/tableData", [...aData]);
                    oVM.setProperty("/enableSaveActions", false);
                    this._updateProcessCalcBtn();
                    MessageToast.show(aSelected.length + " row(s) deleted");
                }
            });
        },

        onClear: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            if (!aSelected.length) { MessageToast.show("Please select at least one row"); return; }

            MessageBox.confirm(
                "Are you sure you want to clear all data from " + aSelected.length + " selected row(s)?\nThis will reset all calculated fields.",
                {
                    title: "Confirm Clear",
                    onClose: (sAction) => {
                        if (sAction !== MessageBox.Action.OK) return;

                        const oVM = this.getView().getModel("vm");

                        aSelected.forEach(item => {
                            const sPath = item.getBindingContext("vm").getPath();
                            const oRow = item.getBindingContext("vm").getObject();

                            // Reset to a clean NEW state — keep only identity fields
                            oVM.setProperty(sPath, {
                                // ── Identity (keep as-is) ──
                                Model: oRow.Model,
                                ModelCode: oRow.ModelCode,
                                Region: oRow.Region,
                                Ort01: oRow.Ort01,
                                Basis: oRow.Basis,
                                rowStatus: "NEW",

                                // ── Input fields — cleared ──
                                InputExShowroom: "",
                                InputNsp: "",
                                _rawInputNsp: "",
                                _origInputExShowroom: "",
                                _origInputNsp: "",
                                InputExShowroomEnabled: true,
                                InputNspEnabled: true,

                                // ── State flags ──
                                isChanged: false,
                                isCalculated: false,
                                isReadOnly: false,

                                // ── Dealer fields ──
                                DealerMarginPerc: "",
                                ActualNsp: "",
                                IncrementalNSP: "",
                                Helmet: "",
                                Transportation: "",
                                DealerCost: "",
                                OtherExpenses: "",
                                BikeMargin: "",
                                ActualDealerMargin: "",
                                HelmetMargin: "",
                                TotalDealerMargin: "",
                                IncrementDlr: "0",
                                Incremental2: "0",

                                // ── Pricing fields ──
                                Ndp: "",
                                Basic: "",
                                GSTPerc: "",
                                Gst: "",
                                ActualExShowroom: "",
                                MTSExshowroom: "",
                                OnRoad: "",

                                // ── RTO fields ──
                                RtoPerc: "",
                                Rto: "",
                                RtoWithBill: "",

                                // ── Insurance fields ──
                                insuranceperc: "0",
                                Insurance: "",
                                TpaPa: "",
                                ActualGst: "",
                                TotalInsurance: "",
                                ExpectedOnRoad: "",

                                // ── GeM fields ──
                                DiscountPerc: "",
                                DiscountAmount: "",
                                SubTotal: "",
                                GstPerc: "",
                                GstAmount: "",
                                CessPerc: "",
                                CessAmount: "",
                                FinalGeMPrice: "",

                                // ── CSD fields ──
                                CsdDisPerc: "",
                                CSD: "",
                                PreTaxNetDiscount: "",
                                CsdGstPerc: "",
                                CsdGstAmount: "",
                                CsdExShowroom: "",
                                IncidentalCharges: "",
                                FinalCSDPrice: "",

                                // ── MTO fields ──
                                ReferMtsModel: "",
                                MtoNsp: "",
                                MTOOnRoad: "",
                                MTOExshowroomafterGMA: "",
                                MIYExShowroomTotal: 0,
                                MIYOnRoadTotal: 0,

                                // ── Reference fields ──
                                ExceptionRef: "E",
                                ReferenceNum: "",
                                CalculatedNSP: ""
                            });
                        });

                        oTable.removeSelections(true);
                        oVM.setProperty("/enableSaveActions", false);
                        oVM.setProperty("/enableEditActions", false);
                        this._updateProcessCalcBtn();
                        this._updateActionButtons();

                        // ── Remove cleared rows FROM the snapshot entirely ──
                        // so the filter panel doesn't hold stale calculated data,
                        // and recalculation after clear writes fresh entries cleanly.
                        const aSnap = JSON.parse(JSON.stringify(
                            oVM.getProperty("/_allProcessedTableData") || []
                        ));
                        // Collect the Model+Region keys that were just cleared
                        const aClearedKeys = new Set(
                            aSelected.map(item => {
                                const oRow = item.getBindingContext("vm").getObject();
                                return (oRow.ModelCode || oRow.Model) + "|" + oRow.Region;
                            })
                        );
                        // Remove those keys from the snapshot
                        const aFilteredSnap = aSnap.filter(s =>
                            !aClearedKeys.has((s.ModelCode || s.Model) + "|" + s.Region)
                        );
                        oVM.setProperty("/_allProcessedTableData", aFilteredSnap);

                        //changes 

                        this._buildProcessedFilters();

                        MessageToast.show(aSelected.length + " row(s) cleared");
                    }
                }
            );
        },

        onEdit: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            if (!aSelected.length) { MessageToast.show("Please select at least one row"); return; }
            const oVM = this.getView().getModel("vm");
            aSelected.forEach(item => {
                const sPath = item.getBindingContext("vm").getPath();
                oVM.setProperty(sPath + "/InputExShowroomEnabled", true);
                oVM.setProperty(sPath + "/InputNspEnabled", true);
                oVM.setProperty(sPath + "/isCalculated", false);
                oVM.setProperty(sPath + "/isChanged", true);
            });
            oTable.removeSelections(true);
            oVM.setProperty("/enableSaveActions", false);
            this._updateProcessCalcBtn();
            MessageToast.show(aSelected.length + " row(s) ready to edit");
        },

        // ══════════════════════════════════════════════════════════════════════
        //  FIXED: onExcelDownloadAll
        //  Field order matches EXACTLY the column/cell order in the XML view
        // ══════════════════════════════════════════════════════════════════════

        onExcelDownloadAll: function () {
            const oView = this.getView();
            const aData = oView.getModel("vm").getProperty("/tableData") || [];

            // ── Master field list — order matches column order in vechilepricingmain.view.xml ──
            //
            //  Column header          | Cell binding           | group
            //  ---------------------- | ---------------------- | ---------
            //  Model                  | Model                  | Core
            //  Region                 | Region                 | Core
            //  Basis / RTO            | Basis                  | Core
            //  Ex-Showroom (input)    | InputExShowroom        | Core
            //  NSP Input              | InputNsp               | Core
            //  Dealer Margin %        | DealerMarginPerc       | Dealer
            //  MTS NSP                | InputNsp               | Dealer
            //  Incremental            | IncrementalNSP         | Dealer
            //  MTO NSP                | MtoNsp                 | Dealer
            //  Helmet                 | Helmet                 | Dealer
            //  Transportation         | Transportation         | Dealer
            //  Dealer Cost            | DealerCost             | Dealer
            //  Other Expenses         | OtherExpenses          | Dealer
            //  Bike Margin            | BikeMargin             | Dealer
            //  Incremental (2nd col)  | IncrementDlr           | Dealer
            //  Dealer Margin          | ActualDealerMargin     | Dealer
            //  Helmet Margin          | HelmetMargin           | Dealer
            //  Total Dealer Margin    | TotalDealerMargin      | Dealer
            //  NDP                    | Ndp                    | Pricing
            //  Basic                  | Basic                  | Pricing
            //  GST %                  | GSTPerc                | Pricing
            //  GST                    | Gst                    | Pricing
            //  MTO Ex-showroom        | ActualExShowroom       | Pricing
            //  RTO %                  | RtoPerc                | RTO
            //  RTO                    | Rto                    | RTO
            //  RTO (With Bill)        | RtoWithBill            | RTO
            //  Insurance %            | insuranceperc          | Insurance
            //  Insurance              | Insurance              | Insurance
            //  TPA + PA               | TpaPa                  | Insurance
            //  GST (ins.)             | ActualGst              | Insurance
            //  Total Insurance        | TotalInsurance         | Insurance
            //  Discount %             | DiscountPerc           | GeM
            //  Discount Amt           | DiscountAmount         | GeM
            //  Sub Total              | SubTotal               | GeM
            //  GST %                  | GstPerc                | GeM
            //  GST Amount             | GstAmount              | GeM
            //  Cess %                 | CessPerc               | GeM
            //  Cess Amount            | CessAmount             | GeM
            //  Final GeM Price        | FinalGeMPrice          | GeM
            //  CSD Disc %             | CsdDisPerc             | CSD
            //  CSD Discount           | CSD                    | CSD
            //  Pre-Tax Net            | PreTaxNetDiscount      | CSD
            //  CSD GST %              | CsdGstPerc             | CSD
            //  CSD GST Amt            | CsdGstAmount           | CSD
            //  CSD Ex-Showroom        | CsdExShowroom          | CSD
            //  Incidental Chg         | IncidentalCharges      | CSD
            //  Final CSD Price        | FinalCSDPrice          | CSD
            //  MTO On-Road            | MTOOnRoad              | MTO
            //  Refer MTS Model        | ReferMtsModel          | MTO
            //  MTS Exshowroom         | MTSExshowroom          | MTO
            //  MIY Ex-Showroom        | MIYExShowroomTotal     | MTO
            //  Expected Ex-Showroom   | MTOExshowroomafterGMA  | MTO
            //  MIY On-Road            | MIYOnRoadTotal         | MTO
            //  Expected On-Road       | ExpectedOnRoad         | MTO

            const aAllFields = [
                // ── Core ──────────────────────────────────────────────────────────
                { key: "Model", label: "Model", group: "Core", selected: true },
                { key: "Region", label: "Region", group: "Core", selected: true },
                { key: "Basis", label: "Basis / RTO", group: "Core", selected: true },
                { key: "InputExShowroom", label: "Ex-Showroom", group: "Core", selected: true },
                { key: "InputNsp", label: "NSP Input", group: "Core", selected: true },

                // ── Dealer ────────────────────────────────────────────────────────
                { key: "DealerMarginPerc", label: "Dealer Margin %", group: "Dealer", selected: false },
                { key: "InputNsp", label: "MTS NSP", group: "Dealer", selected: false },
                { key: "IncrementalNSP", label: "Incremental NSP", group: "Dealer", selected: false },
                { key: "MtoNsp", label: "MTO NSP", group: "Dealer", selected: false },
                { key: "Helmet", label: "Helmet", group: "Dealer", selected: false },
                { key: "Transportation", label: "Transportation", group: "Dealer", selected: false },
                { key: "DealerCost", label: "Dealer Cost", group: "Dealer", selected: false },
                { key: "OtherExpenses", label: "Other Expenses", group: "Dealer", selected: false },
                { key: "BikeMargin", label: "Bike Margin", group: "Dealer", selected: false },
                { key: "IncrementDlr", label: "Incremental (DLR)", group: "Dealer", selected: false },
                { key: "ActualDealerMargin", label: "Dealer Margin", group: "Dealer", selected: false },
                { key: "HelmetMargin", label: "Helmet Margin", group: "Dealer", selected: false },
                { key: "TotalDealerMargin", label: "Total Dealer Margin", group: "Dealer", selected: false },

                // ── Pricing ───────────────────────────────────────────────────────
                { key: "Ndp", label: "NDP", group: "Pricing", selected: false },
                { key: "Basic", label: "Basic", group: "Pricing", selected: false },
                { key: "GSTPerc", label: "GST %", group: "Pricing", selected: false },
                { key: "Gst", label: "GST", group: "Pricing", selected: false },
                { key: "ActualExShowroom", label: "Ex-Showroom", group: "Pricing", selected: false },
                { key: "OnRoad", label: "On-Road", group: "Pricing", selected: false },

                // ── RTO ───────────────────────────────────────────────────────────
                { key: "RtoPerc", label: "RTO %", group: "RTO", selected: false },
                { key: "Rto", label: "RTO", group: "RTO", selected: false },
                { key: "RtoWithBill", label: "RTO (With Bill)", group: "RTO", selected: false },

                // ── Insurance ─────────────────────────────────────────────────────
                { key: "insuranceperc", label: "Insurance %", group: "Insurance", selected: false },
                { key: "Insurance", label: "Insurance", group: "Insurance", selected: false },
                { key: "TpaPa", label: "TPA + PA", group: "Insurance", selected: false },
                { key: "ActualGst", label: "GST (After TPA)", group: "Insurance", selected: false },
                { key: "TotalInsurance", label: "Total Insurance", group: "Insurance", selected: false },

                // ── GeM ───────────────────────────────────────────────────────────
                { key: "DiscountPerc", label: "Discount %", group: "GeM", selected: false },
                { key: "DiscountAmount", label: "Discount Amt", group: "GeM", selected: false },
                { key: "SubTotal", label: "Sub Total", group: "GeM", selected: false },
                { key: "GstPerc", label: "GST %", group: "GeM", selected: false },
                { key: "GstAmount", label: "GST Amount", group: "GeM", selected: false },
                { key: "CessPerc", label: "Cess %", group: "GeM", selected: false },
                { key: "CessAmount", label: "Cess Amount", group: "GeM", selected: false },
                { key: "FinalGeMPrice", label: "Final GeM Price", group: "GeM", selected: false },

                // ── CSD ───────────────────────────────────────────────────────────
                { key: "CsdDisPerc", label: "CSD Disc %", group: "CSD", selected: false },
                { key: "CSD", label: "CSD Discount", group: "CSD", selected: false },
                { key: "PreTaxNetDiscount", label: "Pre-Tax Net", group: "CSD", selected: false },
                { key: "CsdGstPerc", label: "CSD GST %", group: "CSD", selected: false },
                { key: "CsdGstAmount", label: "CSD GST Amt", group: "CSD", selected: false },
                { key: "CsdExShowroom", label: "CSD Ex-Showroom", group: "CSD", selected: false },
                { key: "IncidentalCharges", label: "Incidental Chg", group: "CSD", selected: false },
                { key: "FinalCSDPrice", label: "Final CSD Price", group: "CSD", selected: false },

                // ── MTO ───────────────────────────────────────────────────────────
                { key: "MTOOnRoad", label: "MTO On-Road", group: "MTO", selected: false },
                { key: "ReferMtsModel", label: "Refer MTS Model", group: "MTO", selected: false },
                { key: "MTSExshowroom", label: "MTS Ex-Showroom", group: "MTO", selected: false },
                { key: "MIYExShowroomTotal", label: "MIY Ex-Showroom", group: "MTO", selected: false },
                { key: "MTOExshowroomafterGMA", label: "Expected Ex-Showroom", group: "MTO", selected: false },
                { key: "MIYOnRoadTotal", label: "MIY On-Road", group: "MTO", selected: false },
                { key: "ExpectedOnRoad", label: "Expected On-Road", group: "MTO", selected: false }
            ];

            // ── Group order map — keeps picker sections in table column order ──
            const mGroupOrder = {
                "Core": "1", "Dealer": "2", "Pricing": "3", "RTO": "4",
                "Insurance": "5", "GeM": "6", "CSD": "7", "MTO": "8"
            };

            // ── Filter: Core always visible; other fields only if data exists ──
            const aCoreAlways = ["Core"];
            const aFilteredFields = aAllFields.filter(oField => {
                if (oField.group === "Core") return true;
                return aData.some(oRow => {
                    const v = oRow[oField.key];
                    return v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "0";
                });
            });

            this._aExportData = aData;

            if (!this._oFieldPickerDialog) {
                this._oFieldPickerDialog = new sap.m.Dialog({
                    title: "Select Fields to Export",
                    contentWidth: "480px",
                    contentHeight: "520px",
                    resizable: true,
                    content: [
                        new sap.m.Toolbar({
                            content: [
                                new sap.m.Button({
                                    text: "Select All",
                                    type: "Transparent",
                                    press: function () {
                                        const aF = this._oFieldPickerDialog.getModel("dlg").getProperty("/fields");
                                        aF.forEach(f => f.selected = true);
                                        this._oFieldPickerDialog.getModel("dlg").setProperty("/fields", aF);
                                    }.bind(this)
                                }),
                                new sap.m.Button({
                                    text: "Deselect All",
                                    type: "Transparent",
                                    press: function () {
                                        const aF = this._oFieldPickerDialog.getModel("dlg").getProperty("/fields");
                                        aF.forEach(f => f.selected = false);
                                        this._oFieldPickerDialog.getModel("dlg").setProperty("/fields", aF);
                                    }.bind(this)
                                })
                            ]
                        }),
                        new sap.m.ScrollContainer({
                            vertical: true,
                            horizontal: false,
                            height: "420px",
                            content: [
                                new sap.m.List({
                                    showSeparators: "None",
                                    items: {
                                        path: "dlg>/fields",
                                        groupHeaderFactory: function (oGroup) {
                                            return new sap.m.GroupHeaderListItem({
                                                title: oGroup.key + " Fields",
                                                upperCase: false
                                            });
                                        },
                                        sorter: new sap.ui.model.Sorter(
                                            "group",
                                            false,
                                            function (oCtx) {
                                                const g = oCtx.getProperty("group");
                                                return {
                                                    key: mGroupOrder[g] || g,
                                                    text: g
                                                };
                                            }
                                        ),
                                        template: new sap.m.CustomListItem({
                                            content: [
                                                new sap.m.CheckBox({
                                                    selected: "{dlg>selected}",
                                                    text: "{dlg>label}"
                                                })
                                            ]
                                        })
                                    }
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Download",
                        type: "Emphasized",
                        icon: "sap-icon://download",
                        press: function () {
                            const aF = this._oFieldPickerDialog
                                .getModel("dlg")
                                .getProperty("/fields")
                                .filter(f => f.selected);
                            if (!aF.length) {
                                sap.m.MessageToast.show("Please select at least one field.");
                                return;
                            }
                            this._oFieldPickerDialog.close();
                            this._exportToExcel(this._aExportData, aF);
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () { this._oFieldPickerDialog.close(); }.bind(this)
                    })
                });
                oView.addDependent(this._oFieldPickerDialog);
            }

            // Always rebuild model so filter is fresh with current tableData
            this._oFieldPickerDialog.setModel(
                new sap.ui.model.json.JSONModel({ fields: aFilteredFields }),
                "dlg"
            );
            this._oFieldPickerDialog.open();
        },

        // ── _exportToExcel — columns in the order the user selected them ──────
        _exportToExcel: function (aData, aSelectedFields) {
            const EdmType = sap.ui.export.EdmType;

            // Fields that should export as numbers
            const aNumericKeys = new Set([
                "InputExShowroom", "InputNsp", "ActualExShowroom", "ActualNsp",
                "Helmet", "Transportation", "DealerCost", "OtherExpenses",
                "BikeMargin", "ActualDealerMargin", "HelmetMargin", "TotalDealerMargin",
                "IncrementalNSP", "IncrementDlr", "MtoNsp",
                "Ndp", "Basic", "Gst", "GSTPerc", "GstPerc", "GstAmount",
                "Rto", "RtoWithBill",
                "Insurance", "TpaPa", "ActualGst", "TotalInsurance",
                "DiscountAmount", "SubTotal", "CessAmount", "FinalGeMPrice",
                "CSD", "PreTaxNetDiscount", "CsdGstAmount", "CsdExShowroom",
                "IncidentalCharges", "FinalCSDPrice",
                "MTSExshowroom", "MIYExShowroomTotal", "MIYOnRoadTotal",
                "MTOExshowroomafterGMA", "ExpectedOnRoad", "MTOOnRoad", "OnRoad",
                "DealerMarginPerc", "RtoPerc", "insuranceperc",
                "DiscountPerc", "CessPerc", "CsdDisPerc", "CsdGstPerc"
            ]);

            const oSettings = {
                workbook: {
                    columns: aSelectedFields.map(f => ({
                        label: f.label,
                        property: f.key,
                        type: aNumericKeys.has(f.key) ? EdmType.Number : EdmType.String,
                        scale: aNumericKeys.has(f.key) ? 2 : undefined
                    }))
                },
                dataSource: aData,
                fileName: aData.length === 0
                    ? "VehiclePricing_Template.xlsx"
                    : "VehiclePricing_Export.xlsx"
            };

            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },


        _exportToExcel: function (aData, aSelectedFields) {
            const EdmType = sap.ui.export.EdmType;

            const aNumericKeys = new Set([
                "InputExShowroom", "InputNsp", "ActualExShowroom", "ActualNsp",
                "Helmet", "Transportation", "DealerCost", "OtherExpenses",
                "BikeMargin", "ActualDealerMargin", "HelmetMargin", "TotalDealerMargin",
                "IncrementalNSP", "IncrementDlr", "MtoNsp",
                "Ndp", "Basic", "Gst", "GSTPerc", "GstPerc", "GstAmount",
                "Rto", "RtoWithBill",
                "Insurance", "TpaPa", "ActualGst", "TotalInsurance",
                "DiscountAmount", "SubTotal", "CessAmount", "FinalGeMPrice",
                "CSD", "PreTaxNetDiscount", "CsdGstAmount", "CsdExShowroom",
                "IncidentalCharges", "FinalCSDPrice",
                "MTSExshowroom", "MIYExShowroomTotal", "MIYOnRoadTotal",
                "MTOExshowroomafterGMA", "ExpectedOnRoad", "MTOOnRoad", "OnRoad",
                "DealerMarginPerc", "RtoPerc", "insuranceperc",
                "DiscountPerc", "CessPerc", "CsdDisPerc", "CsdGstPerc"
            ]);

            // Strip commas from numeric fields so EdmType.Number parses correctly
            const aCleanData = aData.map(oRow => {
                const oClean = Object.assign({}, oRow);

                // Use pre-stored raw value for InputNsp if available
                if (oClean._rawInputNsp !== undefined && oClean._rawInputNsp !== "") {
                    oClean.InputNsp = parseFloat(oClean._rawInputNsp) || 0;
                }

                aNumericKeys.forEach(sKey => {
                    if (sKey === "InputNsp") return; // already handled above
                    if (oClean[sKey] !== undefined && oClean[sKey] !== null && oClean[sKey] !== "") {
                        const n = Number(String(oClean[sKey]).replace(/,/g, ""));
                        oClean[sKey] = isNaN(n) ? oClean[sKey] : n;
                    }
                });
                return oClean;
            });

            const oSettings = {
                workbook: {
                    columns: aSelectedFields.map(f => ({
                        label: f.label,
                        property: f.key,
                        type: aNumericKeys.has(f.key) ? EdmType.Number : EdmType.String,
                        scale: aNumericKeys.has(f.key) ? 2 : undefined
                    }))
                },
                dataSource: aCleanData,
                fileName: aData.length === 0
                    ? "VehiclePricing_Template.xlsx"
                    : "VehiclePricing_Export.xlsx"
            };

            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },
    });
});