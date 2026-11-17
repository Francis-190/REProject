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
        MTO: { label: "MTO / MIY Fields", chipClass: "vpGrpChip-MTO", colCount: 3 }
    };

    const GROUP_WIDTHS = {
        CORE: 150 + 190 + 110 + 150 + 130 + 150,
        DEALER: 130 + 120 + 130 + 120 + 130 + 120 + 120 + 150,
        PRICING: 110 + 120 + 90 + 150,
        RTO: 140 + 85 + 110 + 140,
        INSURANCE: 120 + 110 + 90 + 150,
        GEM: 110 + 130 + 120 + 85 + 120 + 85 + 120 + 150,
        CSD: 110 + 120 + 120 + 85 + 120 + 150 + 140 + 150,
        MTO: 160 + 150 + 140
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

                // column-group visibility flags
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

                // user info
                // ASMEmail: "siva.durairaj@laderatechnology.com",
                ASMEmail: "anandkumar.n@laderatechnology.com",
                ASMName: "Siva Durairaj",

                // action flags
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

        formatIndian: function (v) {
            if (v === null || v === undefined || v === "") return "";
            const n = Number(v);
            if (isNaN(n)) return v;

            // Handle negative numbers
            const isNegative = n < 0;
            const absN = Math.abs(n);

            const [intPart, decPart] = absN.toFixed(2).split(".");

            let lastThree = intPart.slice(-3);
            const remaining = intPart.slice(0, -3);
            if (remaining) {
                lastThree = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
            }

            const formatted = lastThree + "." + decPart;

            // FIX: prefix with - for negative, not -,
            return isNegative ? "-" + formatted : formatted;
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
                const oVM = this.getView().getModel("vm");
                oVM.setProperty("/models", aModels);
                oVM.setProperty("/regions", aRegions);
                oVM.setProperty("/_allTableData", []);
                oVM.setProperty("/filteredModels",
                    aModels.filter(m => m.Status === "APPROVED")
                );
            });
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
            const aFilters = mFilters
                ? Object.keys(mFilters).map(sKey =>
                    new sap.ui.model.Filter(sKey, sap.ui.model.FilterOperator.EQ, mFilters[sKey])
                )
                : [];

            const oListBinding = oModel.bindList(sPath, null, null, aFilters.length ? aFilters : null);
            const aContexts = await oListBinding.requestContexts();
            return aContexts.map(oCtx => oCtx.getObject());
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

            this._resetToInitialState();

            const oVM = this.getView().getModel("vm");
            const oView = this.getView();
            const sMail = oVM.getProperty("/ASMEmail");

            oVM.setProperty("/selectedMto", sMtoMts);
            oView.setBusy(true);

            try {
                const bGemOrCsd = (sMtoMts === "GEM" || sMtoMts === "CSD");

                if (sMtoMts === "MTS") {
                    await this._goMTS(sRegion, sMail);
                } else {
                    await this._goProcessing(sRegion, sMtoMts, sMail);
                }
                const bIsMTS = sMtoMts === "MTS";
                const bIsGemCsdOrMto = ["GeM", "CSD", "MTO"].includes(sMtoMts);

                // Check if any prefilled (already calculated) rows exist in the filtered result
                const aTableData = oVM.getProperty("/tableData") || [];
                const bHasPrefilled = aTableData.some(r => r.isCalculated === true);
                const bHasChanged = aTableData.some(r => r.isChanged === true);

                oVM.setProperty("/processCalcVisible", bIsMTS);
                oVM.setProperty("/processCalcEnabled", bIsMTS && bHasChanged);

                oVM.setProperty("/saveBtnEnabled", bIsGemCsdOrMto || bHasPrefilled);
                oVM.setProperty("/applyOtherEnabled", bIsGemCsdOrMto || bHasPrefilled);

                this.byId("processcalculation").setVisible(!bGemOrCsd);
                this.byId("processcalculation").setEnabled(bIsMTS && bHasChanged);

                // Save and Apply: enable immediately if prefilled rows exist
                this.byId("saveBtn").setEnabled(bGemOrCsd || bHasPrefilled);

                const oApplyBtn = this.byId("applyOtherRegionsBtn");
                if (oApplyBtn) oApplyBtn.setEnabled(bIsGemCsdOrMto || bHasPrefilled);

            } catch (e) {
                console.error("onGoPress failed:", e);
                MessageBox.error(e.message || "Failed to load pricing data");
                oVM.setProperty("/tableData", []);
            } finally {
                oView.setBusy(false);
            }
        },

_goMTS: async function (sRegion, sMail) {
    const oVM = this.getView().getModel("vm");
    const aModelKeys = this.byId("idModelMCB").getSelectedKeys();
 
    if (!(oVM.getProperty("/_allTableData") || []).length) {
        const [aModels, aRegions, aBreakups, aSubmissionRefs] = await Promise.all([
            this._read("/ModelMasterSet",          { Mail: sMail }),
            this._read("/RegionMasterSet",         { Mail: sMail }),
            this._read("/ModelPriceBreakupSet",    { Mail: sMail }),
            this._read("/SubmissionReference")          // ← NEW: no filter needed
        ]);
 
        const aMtsApproved = aModels.filter(
            m => m.OrdType === "MTS" && m.Status === "APPROVED"
        );
 
        this._buildCartesianData(aMtsApproved, aRegions, aBreakups, aSubmissionRefs); // ← pass refs
    }
 
    const aAllData = oVM.getProperty("/_allTableData") || [];
 
    const aFiltered = aAllData.filter(oRow => {
        const bRegion = oRow.Region === sRegion;
        const bModel  = !aModelKeys.length || aModelKeys.includes(oRow.ModelCode);
        return bRegion && bModel;
    });
 
    oVM.setProperty("/tableData", aFiltered);
    oVM.setProperty("/enableEditActions", false);
    oVM.setProperty("/enableSaveActions", false);
 
    const bHasCalculated = aFiltered.some(r => r.isCalculated === true);
    this.byId("processcalculation").setEnabled(aFiltered.some(r => r.isChanged === true));
    this.byId("saveBtn").setEnabled(bHasCalculated);
 
    const oApplyBtn = this.byId("applyOtherRegionsBtn");
    if (oApplyBtn) oApplyBtn.setEnabled(bHasCalculated);
},

// ═══════════════════════════════════════════════════════════════════════════
//  CONTROLLER CHANGE — _buildCartesianData
//  Add rowStatus field:
//    "APPROVED" → breakup exists, ReferenceNum is APPROVED
//    "DRAFT"    → breakup exists, ReferenceNum is blank (saved without submit)
//    "NEW"      → no breakup, or breakup has non-approved ReferenceNum
// ═══════════════════════════════════════════════════════════════════════════

_buildCartesianData: function (aModels, aRegions, aBreakups, aSubmissionRefs) {
    aBreakups       = aBreakups       || [];
    aSubmissionRefs = aSubmissionRefs || [];

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
            let sRowStatus   = "NEW";      // default

            if (oBreakup) {
                const sRef = String(oBreakup.ReferenceNum || "").trim();

                if (sRef === "") {
                    // Saved as draft — no reference number yet
                    bShowBreakup = true;
                    sRowStatus   = "DRAFT";
                } else if (oApprovedRefs.has(sRef)) {
                    // Fully approved
                    bShowBreakup = true;
                    sRowStatus   = "APPROVED";
                } else {
                    // REJECTED / SUBMITTED — show empty editable row
                    bShowBreakup = false;
                    sRowStatus   = "NEW";
                }
            }

            if (bShowBreakup) {
                aTableData.push({
                    Model:     oModel.ModelCode,
                    ModelCode: oModel.ModelCode,
                    Region:    oRegion.Region,
                    Ort01:     oRegion.Ort01,

                    // ── Status ────────────────────────────────────────────
                    rowStatus: sRowStatus,      // "APPROVED" | "DRAFT"

                    // ── Core ──────────────────────────────────────────────
                    Basis:            oBreakup.Basis || oRegion.BasisRto,
                    InputExShowroom:  this.formatIndian(oBreakup.InputExShowroom || ""),
                    InputNsp:         this.formatIndian(oBreakup.InputNsp || ""),
                    ActualExShowroom: oBreakup.ActualExShowroom || "",
                    OnRoad:           oBreakup.OnRoad || "",

                    // ── Dealer ────────────────────────────────────────────
                    DealerMarginPerc:   oBreakup.DealerMargin || "",
                    ActualNsp:          oBreakup.ActualNsp || "",
                    IncrementalNSP:     oBreakup.IncrementalNsp || "",
                    Helmet:             oBreakup.Helmet || "",
                    Transportation:     oBreakup.Transportation || "",
                    DealerCost:         oBreakup.DealerCost || "",
                    OtherExpenses:      oBreakup.OtherExpenses || "",
                    BikeMargin:         oBreakup.BikeMargin || "",
                    ActualDealerMargin: oBreakup.ActualDealerMargin || "",
                    HelmetMargin:       oBreakup.HelmetMargin || "",
                    TotalDealerMargin:  oBreakup.TotalDealerMargin || "",
                    IncrementDlr:       oBreakup.IncrementDlr || "0",
                    Incremental2: String(
                        (parseFloat(oBreakup.BikeMargin) || 0) -
                        (parseFloat(oBreakup.ActualDealerMargin) || 0)
                    ),

                    // ── Pricing ───────────────────────────────────────────
                    Ndp:     oBreakup.Ndp || "",
                    Basic:   oBreakup.Basic || "",
                    GSTPerc: oBreakup.GstPerc ? String(parseFloat(oBreakup.GstPerc)) : "",
                    Gst:     oBreakup.Gst || "",

                    // ── RTO ───────────────────────────────────────────────
                    RtoPerc:     oBreakup.RtoPerc || "",
                    Rto:         oBreakup.Rto || "",
                    RtoWithBill: oBreakup.RtoWithBill || "",

                    // ── Insurance ─────────────────────────────────────────
                    insuranceperc:  oBreakup.InsuranceLe350 || oBreakup.InsuranceGt350 || "",
                    Insurance:      oBreakup.Insurance || "",
                    TpaPa:          oBreakup.TpaPa || "",
                    ActualGst:      oBreakup.ActualGst || "",
                    TotalInsurance: oBreakup.TotalInsurance || "",

                    // ── Reference ─────────────────────────────────────────
                    ExceptionRef: oBreakup.ExceptionRef || "E",
                    ReferenceNum: oBreakup.ReferenceNum || "",

                    // ── State flags ───────────────────────────────────────
                    isChanged:              false,
                    isCalculated:           true,
                    InputExShowroomEnabled: true,
                    InputNspEnabled:        true,
                    _origInputExShowroom:   String(oBreakup.InputExShowroom ?? ""),
                    _origInputNsp:          String(oBreakup.InputNsp ?? "")
                });

            } else {
                // NEW row — no usable breakup
                aTableData.push({
                    Model:     oModel.ModelCode,
                    ModelCode: oModel.ModelCode,
                    Region:    oRegion.Region,
                    Ort01:     oRegion.Ort01,
                    Basis:     oRegion.BasisRto,

                    rowStatus: "NEW",      // ← always NEW for empty rows

                    InputExShowroom: "",
                    InputNsp:        "",

                    InputExShowroomEnabled: true,
                    InputNspEnabled:        true,

                    isChanged:            false,
                    isCalculated:         false,
                    _origInputExShowroom: "",
                    _origInputNsp:        ""
                });
            }
        });
    });

    this.getView().getModel("vm").setProperty("/_allTableData", aTableData);
},


// ═══════════════════════════════════════════════════════════════════════════
//  CONTROLLER CHANGE — add these two formatter helpers anywhere in the controller
//  (e.g. just below the formatIndian function)
// ═══════════════════════════════════════════════════════════════════════════

formatStatusPill: function (sStatus) {
    const mConfig = {
        APPROVED: {
            label: "Approved",
            bg:     "#e6f4ea",
            color:  "#1e7e34",
            border: "#a8d5b5",
            dot:    "#1e7e34"
        },
        DRAFT: {
            label: "Draft",
            bg:     "#fff4e5",
            color:  "#b85c00",
            border: "#f5c07a",
            dot:    "#e07800"
        },
        NEW: {
            label: "New",
            bg:     "#eef1fb",
            color:  "#3a5bc7",
            border: "#b8c4f0",
            dot:    "#3a5bc7"
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


        _buildSaveItems: function (sSaveInd) {
            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
            const email = this.getView().getModel("vm").getProperty("/ASMEmail");
            const ASMName = this.getView().getModel("vm").getProperty("/ASMName");

            const strip = (v) => String(v || "").replace(/,/g, "").trim();

            return this.getRowsToSave().map(o => ({
                Mail: email,
                AsmName: ASMName,
                Model: o.Model,
                OperationNo: 0,
                SaveInd: sSaveInd,
                Region: o.Region,
                MtoMts: sMtoMts,
                Basis: o.Basis,
                ReferenceNum: o.ReferenceNum || "",
                ExceptionRef: o.ExceptionRef || "E",
                GstPerc: this.uiDec(strip(o.GSTPerc ?? 0), 3),

                // DealerMargin in payload = ActualDealerMargin (the % stored as amount in breakup)
                DealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
                InputNsp: String(this.uiDec(strip(o.InputNsp))),
                IncrementalNsp: String(this.uiDec(strip(o.IncrementalNSP ?? o.IncrementalNsp ?? 0))),
                ActualNsp: String(this.uiDec(strip(o.ActualNsp))),
                Helmet: this.uiInt(strip(o.Helmet)),
                Transportation: this.uiInt(strip(o.Transportation)),
                DealerCost: this.uiInt(strip(o.DealerCost)),
                OtherExpenses: this.uiInt(strip(o.OtherExpenses)),
                BikeMargin: this.uiInt(strip(o.BikeMargin)),
                IncrementDlr: this.uiDec(strip(o.Incremental2 ?? o.IncrementDlr ?? 0)),
                ActualDealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
                HelmetMargin: this.uiInt(strip(o.HelmetMargin)),
                TotalDealerMargin: this.uiInt(strip(o.TotalDealerMargin)),

                // ── Pricing ─────────────────────────────────────────────────────
                Ndp: this.uiInt(strip(o.Ndp)),
                Basic: this.uiInt(strip(o.Basic)),
                Gst: this.uiInt(strip(o.Gst)),
                InputExShowroom: this.uiInt(strip(o.InputExShowroom)),
                ActualExShowroom: this.uiInt(strip(o.ActualExShowroom)),

                // ── RTO ─────────────────────────────────────────────────────────
                RtoPerc: String(this.uiDec(strip(o.RtoPerc))),
                Rto: this.uiInt(strip(o.Rto)),
                RtoWithBill: this.uiInt(strip(o.RtoWithBill)),

                // ── Insurance ───────────────────────────────────────────────────
                InsuranceLe350: String(this.uiDec(strip(o.InsuranceLe350 ?? 0))),
                InsuranceGt350: String(this.uiDec(strip(o.InsuranceGt350 ?? 0))),
                Insurance: this.uiInt(strip(o.Insurance)),
                TpaPa: this.uiInt(strip(o.TpaPa)),
                ActualGst: this.uiInt(strip(o.ActualGst)),
                TotalInsurance: this.uiInt(strip(o.TotalInsurance)),

                // ── On Road ─────────────────────────────────────────────────────
                OnRoad: this.uiInt(strip(o.OnRoad)),
                Diff: this.uiInt(strip(o.Diff ?? 0))
            }));
        },

        _prepareSavePayload: function () {
            return this._buildSaveItems("");
        },

        _prepareSavePayloadForSubmit: function () {
            return this._buildSaveItems("X");
        },

        _goProcessing: async function (sRegion, sMtoMts, sMail) {
            const oVM = this.getView().getModel("vm");
            const oODataModel = this.getOwnerComponent().getModel();
            const oAction = oODataModel.bindContext("/goProcessing(...)");

            oAction.setParameter("regionCode", sRegion);
            oAction.setParameter("MTOStatus", sMtoMts);
            oAction.setParameter("Mail", sMail);

            await oAction.execute();

            const oResult = oAction.getBoundContext().getObject();
            const aResults = Array.isArray(oResult)
                ? oResult
                : (Array.isArray(oResult?.value) ? oResult.value : []);

            const bGemOrCsd = (sMtoMts === "GEM" || sMtoMts === "CSD");

            const aTableData = aResults.map(oRow => {
                const { MIYBreakup, ...oCleanRow } = oRow;
                return {
                    ...oCleanRow,
                    isChanged: false,
                    isCalculated: true,
                    isReadOnly: bGemOrCsd,
                    InputExShowroomEnabled: !bGemOrCsd,
                    InputNspEnabled: !bGemOrCsd,
                    _origInputExShowroom: String(oRow.InputExShowroom ?? ""),
                    _origInputNsp: String(oRow.InputNsp ?? "")
                };
            });

            oVM.setProperty("/tableData", aTableData);
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

            if (aActiveGroups.length === 0) {
                oVM.setProperty("/hasGroupHeaders", false);
                return;
            }

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
            if (oStrip?.getDomRef()) {
                oStrip.getDomRef().innerHTML = "";
            }
        },

        onRowValueChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oCtx = oInput.getBindingContext("vm");
            if (!oCtx) return;

            const oVM = this.getView().getModel("vm");
            const sPath = oInput.getBinding("value").getPath();
            const sNewVal = oInput.getValue().trim();
            const sFullPath = oCtx.getPath() + "/" + sPath;

            oVM.setProperty(sFullPath, sNewVal);

            const oRow = oCtx.getObject();

            const sExVal = sPath === "InputExShowroom" ? sNewVal : (oRow.InputExShowroom || "").trim();
            const sNspVal = sPath === "InputNsp" ? sNewVal : (oRow.InputNsp || "").trim();

            // Only lock the other field if the USER is actively typing in one of them
            // i.e. the field that was just changed has a value → lock the other
            // If the changed field is cleared → unlock both
            if (sPath === "InputExShowroom") {
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", true);
            } else if (sPath === "InputNsp") {
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", true);
            }

            const bExChanged = sExVal !== String(oRow._origInputExShowroom ?? "");
            const bNspChanged = sNspVal !== String(oRow._origInputNsp ?? "");

            oVM.setProperty(oCtx.getPath() + "/isChanged", bExChanged || bNspChanged);
            this.byId("processcalculation").setEnabled(this.getChangedRows().length > 0);
        },

        getChangedRows: function () {
            const aData = this.getView().getModel("vm").getProperty("/tableData") || [];
            return aData.filter(r => r.isChanged === true);
        },

        processcalculation: async function () {
            const aChangedRows = this.getChangedRows();
            if (!aChangedRows.length) {
                MessageToast.show("No changes to process");
                return;
            }

            this._openBusyDialog(
                "Process Calculation",
                "Calculating pricing data for " + aChangedRows.length + " row(s), please wait…"
            );

            try {
                await Promise.all(
                    aChangedRows.map(oRow =>
                        this._callProcessCalculation({

                            exshowroomPrice: this._stripCommas(oRow.InputExShowroom),
                            nspValue: oRow.InputExShowroom ? "" : this._stripCommas(oRow.InputNsp),

                            //changes
                            // exshowroomPrice: oRow.InputExShowroom || "",
                            // nspValue: oRow.InputExShowroom ? "" : (oRow.InputNsp || ""),
                            regionCode: oRow.Region,
                            ModelCode: oRow.Model
                        }, oRow)
                    )
                );

                this.byId("applyOtherRegionsBtn").setEnabled(true);
                this.byId("saveBtn").setEnabled(true);

                this._closeBusyDialog();

                MessageBox.success("Process Calculation completed successfully!");

            } catch (e) {
                console.error(e);
                this._closeBusyDialog();
                MessageBox.error(
                    e.message || "Process Calculation failed. Please try again.",
                    { title: "Calculation Error" }
                );
            }
        },

        // ── FIX: All field mappings corrected to match backend response keys ──
        _callProcessCalculation: function (oPayload, oRow) {
            const oODataModel = this.getOwnerComponent().getModel();
            const oVM = this.getView().getModel("vm");
            const oTable = this.byId("idvechileTable");
            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();

            const oAction = oODataModel.bindContext("/processCalculation(...)");
            oAction.setParameter("nspValue", oPayload.nspValue);
            oAction.setParameter("exshowroomPrice", oPayload.exshowroomPrice);
            oAction.setParameter("regionCode", oPayload.regionCode);
            oAction.setParameter("ModelCode", oPayload.ModelCode);
            oAction.setParameter("Mail", oVM.getProperty("/ASMEmail"));
            oAction.setParameter("MTOStatus", sMtoMts);

            return oAction.execute().then(() => {
                const r = oAction.getBoundContext().getObject();
                const oItem = oTable.getItems().find(
                    it => it.getBindingContext("vm").getObject() === oRow
                );
                const sPath = oItem.getBindingContext("vm").getPath();

                // ── Core ─────────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/isCalculated", true);
                oVM.setProperty(sPath + "/Basis", r.BasisRto);

                // ── Dealer ───────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/DealerMarginPerc", r.DealerMarginPerc);   // 4.5
                oVM.setProperty(sPath + "/ActualNsp", r.ActualNsp);          // "204678.00"
                oVM.setProperty(sPath + "/IncrementalNSP", r.IncrementalNSP);     // 0
                oVM.setProperty(sPath + "/Helmet", r.Helmet);             // "1279.00"
                oVM.setProperty(sPath + "/Transportation", r.Transportation);     // 800
                oVM.setProperty(sPath + "/DealerCost", r.DealerCost);         // "206757.00"
                oVM.setProperty(sPath + "/OtherExpenses", r.OtherExpenses);      // 1374.5
                oVM.setProperty(sPath + "/BikeMargin", r.BikeMarigin);        // 13025.69
                oVM.setProperty(sPath + "/ActualDealerMargin", r.DealerMarigin);      // "13026.00"
                oVM.setProperty(sPath + "/HelmetMargin", r.HelmetMarigin);      // 292
                oVM.setProperty(sPath + "/TotalDealerMargin", r.totalDealerMarigin); // 13317.69
                oVM.setProperty(sPath + "/Incremental2",
                    String(
                        (parseFloat(r.BikeMarigin) || 0) -
                        (parseFloat(r.DealerMarigin) || 0)
                    )
                );

                // ── Pricing ──────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/Ndp", r.NDP);                // "289460.00"
                oVM.setProperty(sPath + "/Basic", r.Basic);              // "221449.00"
                oVM.setProperty(sPath + "/GSTPerc", r.GSTPerc);            // 40
                oVM.setProperty(sPath + "/Gst", r.GSTAfterbasic);      // "88580.00"
                oVM.setProperty(sPath + "/ActualExShowroom", r.ex_showroomAfterGST);// "310029.00"

                // ── RTO ──────────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/RtoPerc", r.RTO_percentage);     // 12
                oVM.setProperty(sPath + "/Rto", r.RTO);                // "37203.00"
                oVM.setProperty(sPath + "/RtoWithBill", r.RTO_bill);           // 1025

                // ── Insurance ────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/insuranceperc", r.insuranceperc);      // 0.008456
                oVM.setProperty(sPath + "/Insurance", r.insurance);          // 2490.52
                oVM.setProperty(sPath + "/TpaPa", r.TPA_PA);             // 15492
                oVM.setProperty(sPath + "/ActualGst", r.GST_afterTPA);       // 3236.85
                oVM.setProperty(sPath + "/TotalInsurance", r.TotalInsurance);     // "21219.00"

                // ── On Road ──────────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/OnRoad", r.OnRoadPrice);        // "369477.00"

                // ── NSP fields ───────────────────────────────────────────────────────
                oVM.setProperty(sPath + "/InputNSP", r.InputNSP);           // 204678
                oVM.setProperty(sPath + "/CalculatedNSP", r.CalculatedNSP);      // 204678
                oVM.setProperty(sPath + "/IncrementalNSP", r.IncrementalNSP);     // 0

                // ── Reset dirty flags ─────────────────────────────────────────────────
                oVM.setProperty(sPath + "/_origInputExShowroom", String(oRow.InputExShowroom ?? ""));
                oVM.setProperty(sPath + "/_origInputNsp", String(oRow.InputNsp ?? ""));
                oVM.setProperty(sPath + "/isChanged", false);

                // ── Lock unused input after calculation ───────────────────────────────
                const bUsedExShowroom = !!(oRow.InputExShowroom && String(oRow.InputExShowroom).trim());
                const bUsedNsp = !bUsedExShowroom && !!(oRow.InputNsp && String(oRow.InputNsp).trim());
                oVM.setProperty(sPath + "/InputExShowroomEnabled", !bUsedNsp);
                oVM.setProperty(sPath + "/InputNspEnabled", !bUsedExShowroom);

            }).catch(oError => {
                let sMsg = "Calculation failed";
                try { sMsg = JSON.parse(oError.responseText)?.error?.message || sMsg; }
                catch (e) { sMsg = oError.message || sMsg; }
                throw new Error(sMsg);
            });
        },

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

        _prepareOtherRegions: function () {
            const oVM = this.getView().getModel("vm");
            const sSelected = this.byId("idRegionMCB").getSelectedKey();
            const aRegions = oVM.getProperty("/regions") || [];
            const mMap = {};
            aRegions.forEach(o => {
                if (o.Region !== sSelected) mMap[o.Region] = { Region: o.Region, Ort01: o.Ort01 };
            });
            const aOthers = Object.values(mMap);
            aOthers.unshift({ Region: "__ALL__", Ort01: "" });
            oVM.setProperty("/otherRegions", aOthers);
        },

        onRegionSelectionChange: function (oEvent) {
            const oMCB = oEvent.getSource();
            const aSelectedKeys = oMCB.getSelectedKeys();
            if (aSelectedKeys.includes("__ALL__")) {
                const bAllSelected = aSelectedKeys.length === oMCB.getItems().length;
                if (!bAllSelected) {
                    oMCB.setSelectedKeys(oMCB.getItems().map(i => i.getKey()).filter(k => k !== "__ALL__"));
                } else {
                    oMCB.setSelectedKeys([]);
                }
            }
        },

        onConfirmApplyOtherRegions: async function () {
            const oView = this.getView();
            oView.setBusy(true);
            try {
                const aRegionCodes = this.byId("otherRegionsMCB").getSelectedKeys();
                if (!aRegionCodes.length) { MessageToast.show("Please select at least one region"); return; }

                const aItems = this._prepareApplyPayload();
                if (!aItems.length) { MessageToast.show("No data available in table"); return; }

                const aResults = await this._callAddToOtherRegion({ items: aItems, regionCodes: aRegionCodes });

                const aSucceeded = aResults.filter(r => r.success);
                const aFailed = aResults.filter(r => !r.success && !r.error?.includes("Skipped"));
                const aSkipped = aResults.filter(r => r.error?.includes("Skipped"));

                if (aSucceeded.length) {
                    this._mergeOtherRegionResults(aSucceeded);
                }

                this._showSummaryDialog(aSucceeded, aFailed, aSkipped);

                if (!aFailed.length && !aSkipped.length) {
                    this._oApplyOtherRegionsDialog.close();
                }

            } catch (e) {
                MessageBox.error(e.message || "Failed to apply to other regions", { title: "Error" });
                console.error(e);
            } finally {
                oView.setBusy(false);
            }
        },

        // ── FIX: All field mappings corrected to match addToOtherRegion backend response ──
        _mergeOtherRegionResults: function (aSucceeded) {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            aSucceeded.forEach(r => {
                const iExisting = aData.findIndex(
                    row => row.ModelCode === r.ModelCode && row.Region === r.regionCode
                );

                const oNewRow = {
                    // ── Identity ──────────────────────────────────────────────
                    Model: r.ModelCode,
                    ModelCode: r.ModelCode,
                    Region: r.regionCode,

                    // ── Core ──────────────────────────────────────────────────
                    // FIX: BasisRto comes back as r.BasisRto
                    Basis: r.BasisRto ?? "",
                    // InputExShowroom: r.InputExShowroom ?? "",
                    // // FIX: InputNSP (capital) from backend, stored as InputNsp
                    // InputNsp: r.InputNSP ?? r.InputNsp ?? "",
                    ActualExShowroom: r.ex_showroomAfterGST ?? "",

                    InputExShowroom: this.formatIndian(r.InputExShowroom ?? r.ex_showroomAfterGST ?? ""),
                    InputNsp: this.formatIndian(r.InputNSP ?? r.CalculatedNSP ?? ""),
                    OnRoad: r.OnRoadPrice ?? "",

                    // ── Dealer ────────────────────────────────────────────────
                    // FIX: DealerMarginPerc from r.DealerMarginPerc
                    DealerMarginPerc: r.DealerMarginPerc ?? "",
                    // FIX: ActualNsp = CalculatedNSP from backend
                    ActualNsp: r.CalculatedNSP ?? r.ActualNsp ?? "",
                    // FIX: IncrementalNSP (capital NSP) = r.IncrementalNSP
                    IncrementalNSP: r.IncrementalNSP ?? "",
                    Helmet: r.Helmet ?? "",
                    Transportation: r.Transportation ?? "",
                    DealerCost: r.DealerCost ?? "",
                    OtherExpenses: r.OtherExpenses ?? "",
                    // FIX: BikeMargin from BikeMarigin
                    BikeMargin: r.BikeMarigin ?? "",
                    // FIX: Incremental2 = BikeMarigin - DealerMarigin
                    Incremental2: ((parseFloat(r.BikeMarigin) || 0) - (parseFloat(r.DealerMarigin) || 0)),
                    // FIX: ActualDealerMargin from DealerMarigin
                    ActualDealerMargin: r.DealerMarigin ?? "",
                    // FIX: HelmetMargin from HelmetMarigin
                    HelmetMargin: r.HelmetMarigin ?? "",
                    TotalDealerMargin: r.totalDealerMarigin ?? "",

                    // ── Pricing ───────────────────────────────────────────────
                    Ndp: r.NDP ?? "",
                    Basic: r.Basic ?? "",
                    // FIX: GSTPerc from r.GSTPerc
                    GSTPerc: r.GSTPerc ?? "",
                    // FIX: Gst holds GST amount (GSTAfterbasic)
                    Gst: r.GSTAfterbasic ?? "",

                    // ── RTO ───────────────────────────────────────────────────
                    RtoPerc: r.RTO_percentage ?? "",
                    // FIX: Rto from r.RTO
                    Rto: r.RTO ?? "",
                    // FIX: RtoWithBill from r.RTO_bill
                    RtoWithBill: r.RTO_bill ?? "",

                    // ── Insurance ─────────────────────────────────────────────
                    // FIX: insuranceperc is actual insurance rate, NOT GST
                    // Backend addToOtherRegion incorrectly returns GSTPerc as insuranceperc —
                    // use r.insurance as the base rate if insuranceperc is suspect
                    insuranceperc: r.insuranceperc ?? "",
                    Insurance: r.insurance ?? "",
                    TpaPa: r.TPA_PA ?? "",
                    ActualGst: r.GST_afterTPA ?? "",
                    TotalInsurance: r.TotalInsurance ?? "",

                    // ── Meta ──────────────────────────────────────────────────
                    ExceptionRef: r.ExceptionRef ?? "E",
                    ReferenceNum: r.ReferenceNum ?? "",

                    // ── Flags ─────────────────────────────────────────────────
                    isCalculated: true,
                    isChanged: false,
                    // Rows from "Apply to Other Regions" are always fully locked —
                    // the backend returns the ex-showroom and both inputs must not be editable.
                    InputExShowroomEnabled: false,
                    InputNspEnabled: false,
                    _origInputExShowroom: String(r.InputExShowroom ?? ""),
                    _origInputNsp: String(r.InputNSP ?? r.InputNsp ?? "")
                };

                if (iExisting >= 0) {
                    oVM.setProperty("/tableData/" + iExisting, oNewRow);
                } else {
                    aData.push(oNewRow);
                    oVM.setProperty("/tableData", aData);
                }
            });

            const oSaveBtn = this.byId("saveBtn");
            if (oSaveBtn) oSaveBtn.setEnabled(true);
        },

        _showSummaryDialog: function (aSucceeded, aFailed, aSkipped) {
            const INITIAL_SHOW = 4;

            const buildLines = (aItems, fnText) => aItems.map(fnText);

            const allLines = [
                ...buildLines(aSucceeded, r => ({ text: `${r.ModelCode} - ${r.regionCode} - OK`, type: "success" })),
                ...buildLines(aSkipped, r => ({ text: `${r.ModelCode} - ${r.regionCode} - No price provided`, type: "warning" })),
                ...buildLines(aFailed, r => ({ text: `${r.ModelCode} - ${r.regionCode} - ${r.error}`, type: "error" }))
            ];

            const sTitle = aFailed.length ? "Apply to Other Regions - Errors" :
                aSkipped.length ? "Apply to Other Regions - Warning" :
                    "Apply to Other Regions - Success";

            let bExpanded = false;

            const renderLines = (lines) =>
                lines.map(l => {
                    const color = l.type === "success" ? "#107e3e" : l.type === "warning" ? "#e9730c" : "#bb0000";
                    return `<div style="padding:4px 0; color:${color}; font-size:13px;">${l.text}</div>`;
                }).join("");

            const sInitialContent = renderLines(allLines.slice(0, INITIAL_SHOW));
            const sFullContent = renderLines(allLines);
            const bHasMore = allLines.length > INITIAL_SHOW;

            const sShowMoreBtn = bHasMore
                ? `<div style="margin-top:8px;">
             <a id="vpShowMoreLink" href="javascript:void(0)" style="color:#0070f2; font-size:13px;">
               Show more (${allLines.length - INITIAL_SHOW} more)
             </a>
           </div>`
                : "";

            const sHTML = `
        <div style="padding:8px;">
            <div id="vpSummaryLines">${sInitialContent}</div>
            ${sShowMoreBtn}
        </div>
    `;

            if (this._oSummaryDialog) {
                this._oSummaryDialog.destroy();
                this._oSummaryDialog = null;
            }

            this._oSummaryDialog = new sap.m.Dialog({
                title: sTitle,
                state: aFailed.length ? "Error" : aSkipped.length ? "Warning" : "Success",
                content: [
                    new sap.ui.core.HTML({
                        content: sHTML,
                        afterRendering: function () {
                            const oLink = document.getElementById("vpShowMoreLink");
                            if (oLink) {
                                oLink.addEventListener("click", function () {
                                    const oLinesDiv = document.getElementById("vpSummaryLines");
                                    if (!bExpanded) {
                                        oLinesDiv.innerHTML = sFullContent;
                                        oLink.textContent = "Show less";
                                        bExpanded = true;
                                    } else {
                                        oLinesDiv.innerHTML = sInitialContent;
                                        oLink.textContent = `Show more (${allLines.length - INITIAL_SHOW} more)`;
                                        bExpanded = false;
                                    }
                                });
                            }
                        }
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Close",
                    press: () => this._oSummaryDialog.close()
                }),
                afterClose: () => {
                    this._oSummaryDialog.destroy();
                    this._oSummaryDialog = null;
                }
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

            await oAction.execute();

            const oContext = oAction.getBoundContext();
            const oResult = oContext.getObject();

            console.log("Raw result object:", oResult);

            if (Array.isArray(oResult)) return oResult;
            if (Array.isArray(oResult?.value)) return oResult.value;

            const aValues = oModel.getObject(oContext.getPath() + "/value");
            if (Array.isArray(aValues)) return aValues;

            return [];
        },

        _prepareApplyPayload: function () {
            const aRows = this.getView().getModel("vm").getProperty("/tableData") || [];

            const mSeen = {};
            const aUniqueRows = aRows.filter(o => {
                if (mSeen[o.ModelCode]) return false;
                mSeen[o.ModelCode] = true;
                return true;
            });

            return aUniqueRows
                .filter(o => o.InputExShowroom || o.InputNsp || o.ActualExShowroom)
                .map(o => ({
                    ModelCode: o.ModelCode || o.Model,
                    nspValue: this._stripCommas(o.InputNsp || ""),
                    exshowroomPrice: this._stripCommas(o.InputExShowroom || o.ActualExShowroom || "")
                }));
        },

        getRowsToSave: function () {
            return (this.getView().getModel("vm").getProperty("/tableData") || [])
                .filter(r => r.isCalculated === true);
        },

        uiInt: function (v) { const n = Number(v); return isNaN(n) ? 0 : Math.round(n); },
        uiDec: function (v, scale = 3) { const n = Number(v); return isNaN(n) ? 0 : Number(n.toFixed(scale)); },

        // _prepareSavePayload: function () {}
        //     const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
        //     const email = this.getView().getModel("vm").getProperty("/ASMEmail");
        //     const ASMName = this.getView().getModel("vm").getProperty("/ASMName");

        //     return this.getRowsToSave().map(o => ({
        //         Mail: email,
        //         AsmName: ASMName,
        //         Model: o.Model, OperationNo: 0, SaveInd: "",
        //         Region: o.Region, MtoMts: sMtoMts,
        //         Basis: o.Basis, ReferenceNum: o.ReferenceNum || "",

        //         // FIX: DealerMargin saves from ActualDealerMargin (the actual dealer margin value)
        //         DealerMargin: String(this.uiDec(o.ActualDealerMargin)),
        //         InputNsp: String(this.uiDec(o.InputNsp)),
        //         IncrementalNsp: String(this.uiDec(o.IncrementalNsp ?? o.IncrementalNSP)),
        //         ActualNsp: String(this.uiDec(o.ActualNsp)),

        //         Helmet: this.uiInt(o.Helmet),
        //         Transportation: this.uiInt(o.Transportation),
        //         DealerCost: this.uiInt(o.DealerCost),
        //         OtherExpenses: this.uiInt(o.OtherExpenses),
        //         BikeMargin: this.uiInt(o.BikeMargin),

        //         IncrementDlr: String(this.uiDec(o.Incremental2 ?? o.IncrementDlr)),
        //         ActualDealerMargin: String(this.uiDec(o.ActualDealerMargin)),
        //         HelmetMargin: this.uiInt(o.HelmetMargin),
        //         TotalDealerMargin: this.uiInt(o.TotalDealerMargin),

        //         Ndp: this.uiInt(o.Ndp),
        //         Basic: this.uiInt(o.Basic),
        //         Gst: this.uiInt(o.Gst),
        //         InputExShowroom: this.uiInt(o.InputExShowroom),

        //         ExceptionRef: o.ExceptionRef || "E",
        //         RtoPerc: String(this.uiDec(o.RtoPerc)),
        //         Rto: this.uiInt(o.Rto),
        //         RtoWithBill: this.uiInt(o.RtoWithBill),

        //         InsuranceLe350: String(this.uiDec(o.InsuranceLe350)),
        //         InsuranceGt350: String(this.uiDec(o.InsuranceGt350)),
        //         Insurance: this.uiInt(o.Insurance),
        //         TpaPa: this.uiInt(o.TpaPa),
        //         ActualGst: this.uiInt(o.ActualGst),
        //         TotalInsurance: this.uiInt(o.TotalInsurance),

        //         OnRoad: this.uiInt(o.OnRoad),
        //         ActualExShowroom: this.uiInt(o.ActualExShowroom),
        //         Diff: this.uiInt(o.Diff || 0)
        //     }));
        // },

        // _prepareSavePayloadForSubmit: function () {
        //     const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
        //     const email = this.getView().getModel("vm").getProperty("/ASMEmail");
        //     const ASMName = this.getView().getModel("vm").getProperty("/ASMName");

        //     return this.getRowsToSave().map(o => ({
        //         Mail: email,
        //         AsmName: ASMName,
        //         Model: o.Model, OperationNo: 0, SaveInd: "X",
        //         Region: o.Region, MtoMts: sMtoMts,
        //         Basis: o.Basis, ReferenceNum: o.ReferenceNum || "",

        //         DealerMargin: String(this.uiDec(o.ActualDealerMargin)),
        //         InputNsp: String(this.uiDec(o.InputNsp)),
        //         IncrementalNsp: String(this.uiDec(o.IncrementalNsp ?? o.IncrementalNSP)),
        //         ActualNsp: String(this.uiDec(o.ActualNsp)),

        //         Helmet: this.uiInt(o.Helmet),
        //         Transportation: this.uiInt(o.Transportation),
        //         DealerCost: this.uiInt(o.DealerCost),
        //         OtherExpenses: this.uiInt(o.OtherExpenses),
        //         BikeMargin: this.uiInt(o.BikeMargin),

        //         IncrementDlr: String(this.uiDec(o.Incremental2 ?? o.IncrementDlr)),
        //         ActualDealerMargin: String(this.uiDec(o.ActualDealerMargin)),
        //         HelmetMargin: this.uiInt(o.HelmetMargin),
        //         TotalDealerMargin: this.uiInt(o.TotalDealerMargin),

        //         Ndp: this.uiInt(o.Ndp),
        //         Basic: this.uiInt(o.Basic),
        //         Gst: this.uiInt(o.Gst),
        //         InputExShowroom: this.uiInt(o.InputExShowroom),

        //         ExceptionRef: o.ExceptionRef || "E",
        //         RtoPerc: String(this.uiDec(o.RtoPerc)),
        //         Rto: this.uiInt(o.Rto),
        //         RtoWithBill: this.uiInt(o.RtoWithBill),

        //         InsuranceLe350: String(this.uiDec(o.InsuranceLe350)),
        //         InsuranceGt350: String(this.uiDec(o.InsuranceGt350)),
        //         Insurance: this.uiInt(o.Insurance),
        //         TpaPa: this.uiInt(o.TpaPa),
        //         ActualGst: this.uiInt(o.ActualGst),
        //         TotalInsurance: this.uiInt(o.TotalInsurance),

        //         OnRoad: this.uiInt(o.OnRoad),
        //         ActualExShowroom: this.uiInt(o.ActualExShowroom),
        //         Diff: this.uiInt(o.Diff || 0)
        //     }));
        // },

        // ══════════════════════════════════════════════════════════════════════
        //  SAVE
        // ══════════════════════════════════════════════════════════════════════
        onSave: async function () {
            const aItems = this._prepareSavePayload();
            if (!aItems.length) {
                MessageToast.show("No calculated rows to save");
                return;
            }

            this._openBusyDialog(
                "Saving",
                "Saving price breakup for " + aItems.length + " row(s), please wait…"
            );

            const oModel = this.getOwnerComponent().getModel();

            try {
                const oAction = oModel.bindContext("/saveToModelPriceBreakUp(...)");
                oAction.setParameter("items", aItems);
                await oAction.execute();

                this._closeBusyDialog();

                MessageBox.success(
                    "Price breakup saved successfully!\n" +
                    aItems.length + " row(s) have been saved.",
                    {
                        title: "Save Successful",
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: () => {
                            this._resetToFullInitialState();
                        }
                    }
                );

            } catch (e) {
                this._closeBusyDialog();
                MessageBox.error(
                    e.message || "Failed to save price breakup. Please try again.",
                    { title: "Save Error" }
                );
                console.error(e);
            }
        },

        onSubmit: async function () {
            const aItems = this._prepareSavePayloadForSubmit();
            if (!aItems.length) {
                MessageToast.show("No calculated rows to save");
                return;
            }

            this._openBusyDialog(
                "Submit",
                "Submitting price breakup for " + aItems.length + " row(s), please wait…"
            );

            const oModel = this.getOwnerComponent().getModel();

            try {
                const oAction = oModel.bindContext("/saveToModelPriceBreakUp(...)");
                oAction.setParameter("items", aItems);
                await oAction.execute();

                this._closeBusyDialog();

                MessageBox.success(
                    "Price breakup submitted successfully!\n" +
                    aItems.length + " row(s) have been submitted.",
                    {
                        title: "Submit Successful",
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: () => {
                            this._resetToFullInitialState();
                        }
                    }
                );

            } catch (e) {
                this._closeBusyDialog();
                MessageBox.error(
                    e.message || "Failed to submit price breakup. Please try again.",
                    { title: "Submit Error" }
                );
                console.error(e);
            }
        },

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

        // ── Upload: direct file picker ────────────────────────────────────────
        onUploadPress: function () {
            this._triggerFileInput();
        },

        // ── Download: opens ActionSheet with 3 options ────────────────────────
        onDownloadMenuPress: function (oEvent) {
            const oSheet = this.byId("downloadActionSheet");
            if (oSheet) {
                oSheet.openBy(oEvent.getSource());
            }
        },

        onExcelDownload: function () {
            const aColumns = this._getVisibleTableColumns();

            if (!aColumns.length) {
                sap.m.MessageToast.show("No data available");
                return;
            }

            const oModel = new sap.ui.model.json.JSONModel({
                columns: aColumns
            });

            const oView = this.getView();

            if (!this._oExcelFieldDialog) {
                this._oExcelFieldDialog = sap.ui.xmlfragment(
                    oView.getId(),
                    "vehiclepricingui.view.fragments.ExcelFieldDialog",
                    this
                );
                oView.addDependent(this._oExcelFieldDialog);
            }

            this._oExcelFieldDialog.setModel(oModel);
            this._oExcelFieldDialog.open();
        },

        onConfirmExcelDownload: function () {
            const oList = this.byId("excelFieldList");
            const aSelectedItems = oList.getSelectedItems();

            if (!aSelectedItems.length) {
                sap.m.MessageToast.show("Please select at least one field");
                return;
            }

            const aColumns = [];
            aSelectedItems.forEach(item => {
                const oData = item.getBindingContext().getObject();
                aColumns.push({
                    label: oData.label,
                    property: oData.property
                });
            });

            this._downloadExcel(aColumns);
            this._oExcelFieldDialog.close();
        },

        onCloseExcelDialog: function () {
            if (this._oExcelFieldDialog) {
                this._oExcelFieldDialog.close();
            }
        },

        onExcelCategoryNext: function () {
            const aCategories = this.byId("excelCategoryMCB").getSelectedKeys();

            if (!aCategories.length) {
                sap.m.MessageToast.show("Select category");
                return;
            }

            let aFields = [];
            aCategories.forEach(cat => {
                aFields = aFields.concat(EXCEL_FIELDS[cat] || []);
            });

            this._selectedExcelFields = aFields;
            this._downloadExcel(aFields);
        },

        _downloadExcel: function (selectedFields) {
            const aData = this.getView().getModel("vm").getProperty("/tableData");

            const oSettings = {
                workbook: { columns: selectedFields },
                dataSource: aData,
                fileName: "VehiclePricing.xlsx"
            };

            const oSpreadsheet = new Spreadsheet(oSettings);
            oSpreadsheet.build();
        },

        onCloseExcelCategory: function () {
            if (this._oExcelCategoryDialog) {
                this._oExcelCategoryDialog.close();
            }
        },

        _getVisibleTableColumns: function () {
            const oTable = this.byId("idvechileTable");
            const aColumns = oTable.getColumns();
            const aItems = oTable.getItems();

            if (!aItems.length) return [];

            const aCells = aItems[0].getCells();
            const aVisibleColumns = [];

            aColumns.forEach((col, index) => {
                if (!col.getVisible()) return;

                const sLabel = col.getHeader().getText();
                const oCell = aCells[index];

                let sProperty = "";

                if (oCell?.getBinding("text")) {
                    sProperty = oCell.getBinding("text").getPath();
                } else if (oCell?.getBinding("value")) {
                    sProperty = oCell.getBinding("value").getPath();
                } else if (oCell?.getBinding("number")) {
                    sProperty = oCell.getBinding("number").getPath();
                } else if (oCell?.getBinding("title")) {
                    sProperty = oCell.getBinding("title").getPath();
                } else if (oCell?.getItems) {
                    const aInner = oCell.getItems();
                    aInner.forEach(inner => {
                        if (inner.getBinding && inner.getBinding("value")) {
                            sProperty = inner.getBinding("value").getPath();
                        }
                    });
                }

                if (sProperty) {
                    aVisibleColumns.push({
                        label: sLabel,
                        property: sProperty
                    });
                }
            });

            return aVisibleColumns;
        },

        // ══════════════════════════════════════════════════════════════════════
        //  EXCEL UPLOAD
        // ══════════════════════════════════════════════════════════════════════
        // ── Kept for backwards compat; delegates to shared helper ──────────────
        onExcelUploadPress: function () {
            this._triggerFileInput();
        },

        // ── Shared file-input trigger (used by both Upload button and old handler) ──
        _triggerFileInput: function () {
            if (!this._oFileInput) {
                this._oFileInput = document.createElement("input");
                this._oFileInput.type = "file";
                this._oFileInput.accept = ".xlsx,.xls,.csv";
                this._oFileInput.style.display = "none";
                document.body.appendChild(this._oFileInput);

                this._oFileInput.addEventListener("change", (oEvent) => {
                    const oFile = oEvent.target.files[0];
                    if (oFile) {
                        this._handleExcelFile(oFile);
                    }
                    oEvent.target.value = "";
                });
            }
            this._oFileInput.click();
        },

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
                        const sText = e.target.result;
                        const aLines = sText.split(/\r?\n/).filter(l => l.trim());
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
                        if (!XLSX) {
                            MessageBox.error("XLSX library not available. Please contact your administrator.");
                            return;
                        }
                        const oWorkbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                        const sFirstSheet = oWorkbook.SheetNames[0];
                        aData = XLSX.utils.sheet_to_json(oWorkbook.Sheets[sFirstSheet], {
                            defval: "",
                            raw: false
                        });
                    }

                    if (!aData.length) {
                        MessageToast.show("No data rows found in the file");
                        return;
                    }

                    const aMapped = aData.map(oRow => ({
                        Model: oRow["Models"] || oRow["Model"] || oRow["ModelCode"] || "",
                        ModelCode: oRow["Models"] || oRow["Model"] || oRow["ModelCode"] || "",
                        Region: oRow["Region Code"] || oRow["Region"] || "",
                        Basis: oRow["Basis / RTO"] || oRow["Basis"] || "",
                        InputExShowroom: oRow["Input Ex-showroom"] || oRow["Ex-Showroom"] || oRow["Ex Showroom"] || "",
                        InputNsp: oRow["Input NSP"] || oRow["NSP Input"] || oRow["NSP Input"] || "",

                        isChanged: true,
                        isCalculated: false,
                        InputExShowroomEnabled: true,
                        InputNspEnabled: true,
                        _origInputExShowroom: "",
                        _origInputNsp: ""
                    }));

                    // const oVM = this.getView().getModel("vm");
                    // const aExisting = oVM.getProperty("/tableData") || [];
                    // oVM.setProperty("/tableData", [...aExisting, ...aMapped]);

                    //changes

                    const oVM = this.getView().getModel("vm");
                    const aExisting = oVM.getProperty("/tableData") || [];

                    // ── Duplicate check ───────────────────────────────────────────────
                    const aDuplicates = aMapped.filter(newRow =>
                        aExisting.some(
                            existingRow =>
                                String(existingRow.Region).trim() === String(newRow.Region).trim() &&
                                String(existingRow.ModelCode).trim() === String(newRow.ModelCode).trim()
                        )
                    );

                    if (aDuplicates.length) {
                        const sDetails = aDuplicates
                            .map(d => `• ${d.ModelCode} / ${d.Region}`)
                            .join("\n");
                        MessageBox.error(
                            "The following Model + Region combination(s) already exist in the table:\n\n" +
                            sDetails +
                            "\n\nPlease remove duplicates from your file and upload again.",
                            { title: "Duplicate Rows Found" }
                        );
                        return;
                    }

                    oVM.setProperty("/tableData", [...aExisting, ...aMapped]);

                    const oPopover = this.byId("excelPopover");
                    if (oPopover) oPopover.close();

                    oVM.setProperty("/selectedMto", oVM.getProperty("/selectedMto") || "MTS");
                    oVM.setProperty("/processCalcVisible", true);
                    oVM.setProperty("/processCalcEnabled", true);
                    this.byId("processcalculation").setEnabled(true);

                    MessageToast.show(aMapped.length + " row(s) loaded from " + oFile.name);

                } catch (ex) {
                    console.error("Excel parse error:", ex);
                    MessageBox.error("Failed to parse the file: " + (ex.message || "Unknown error"));
                }
            };

            if (sExt === "csv") {
                oReader.readAsText(oFile);
            } else {
                oReader.readAsArrayBuffer(oFile);
            }
        },

        onTableSelectionChange: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            this.getView().getModel("vm").setProperty("/enableSaveActions", aSelected.length > 0);
        },

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

                    const aIndices = aSelected
                        .map(item => parseInt(item.getBindingContext("vm").getPath().split("/").pop()))
                        .sort((a, b) => b - a);

                    aIndices.forEach(i => aData.splice(i, 1));
                    oVM.setProperty("/tableData", [...aData]);
                    oVM.setProperty("/enableSaveActions", false);

                    this.byId("processcalculation").setEnabled(this.getChangedRows().length > 0);
                    MessageToast.show(aIndices.length + " row(s) deleted");
                }
            });
        },

        onClear: function () {
            const oTable = this.byId("idvechileTable");
            const aSelected = oTable.getSelectedItems();
            if (!aSelected.length) { MessageToast.show("Please select at least one row"); return; }

            const oVM = this.getView().getModel("vm");
            aSelected.forEach(item => {
                const sPath = item.getBindingContext("vm").getPath();
                oVM.setProperty(sPath + "/InputExShowroom", "");
                oVM.setProperty(sPath + "/InputNsp", "");
                oVM.setProperty(sPath + "/isChanged", false);
                oVM.setProperty(sPath + "/InputExShowroomEnabled", true);
                oVM.setProperty(sPath + "/InputNspEnabled", true);
            });

            oTable.removeSelections(true);
            oVM.setProperty("/enableSaveActions", false);
            this.byId("processcalculation").setEnabled(this.getChangedRows().length > 0);
            MessageToast.show(aSelected.length + " row(s) cleared");
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
            this.byId("processcalculation").setEnabled(this.getChangedRows().length > 0);
            MessageToast.show(aSelected.length + " row(s) ready to edit");
        },

        onExcelDownloadAll: function () {
            const oView = this.getView();
            const oModel = oView.getModel("vm");
            const aData = oModel.getProperty("/tableData");

            const aAllFields = [
                { key: "Model", label: "Model", selected: true, group: "Core" },
                { key: "Region", label: "Region", selected: true, group: "Core" },
                { key: "Basis", label: "Basis / RTO", selected: true, group: "Core" },
                { key: "ActualExShowroom", label: "Ex-Showroom", selected: true, group: "Core" },
                { key: "ActualNsp", label: "NSP Input", selected: true, group: "Core" },
                { key: "OnRoad", label: "On Road Price", selected: true, group: "Core" },
                // FIX: DealerMarginPerc (not DealerMargin) for the %
                { key: "DealerMarginPerc", label: "Dealer Margin %", selected: false, group: "Dealer" },
                { key: "Helmet", label: "Helmet", selected: false, group: "Dealer" },
                { key: "Transportation", label: "Transportation", selected: false, group: "Dealer" },
                { key: "DealerCost", label: "Dealer Cost", selected: false, group: "Dealer" },
                { key: "OtherExpenses", label: "Other Expenses", selected: false, group: "Dealer" },
                { key: "BikeMargin", label: "Bike Margin", selected: false, group: "Dealer" },
                { key: "HelmetMargin", label: "Helmet Margin", selected: false, group: "Dealer" },
                { key: "TotalDealerMargin", label: "Total Dealer Margin", selected: false, group: "Dealer" },
                { key: "Ndp", label: "NDP", selected: false, group: "Pricing" },
                { key: "Basic", label: "Basic", selected: false, group: "Pricing" },
                // FIX: GSTPerc for the % column
                { key: "GSTPerc", label: "GST %", selected: false, group: "Pricing" },
                // FIX: Gst holds the GST amount
                { key: "Gst", label: "GST Amount", selected: false, group: "Pricing" },
                { key: "RtoPerc", label: "RTO %", selected: false, group: "RTO" },
                { key: "Rto", label: "RTO Amt", selected: false, group: "RTO" },
                { key: "RtoWithBill", label: "RTO (With Bill)", selected: false, group: "RTO" },
                // FIX: insuranceperc for the insurance rate
                { key: "insuranceperc", label: "Insurance %", selected: false, group: "Insurance" },
                { key: "Insurance", label: "Insurance", selected: false, group: "Insurance" },
                { key: "TpaPa", label: "TPA + PA", selected: false, group: "Insurance" },
                { key: "ActualGst", label: "GST (Ins.)", selected: false, group: "Insurance" },
                { key: "TotalInsurance", label: "Total Insurance", selected: false, group: "Insurance" },
                { key: "DiscountPerc", label: "Discount %", selected: false, group: "GeM" },
                { key: "DiscountAmount", label: "Discount Amt", selected: false, group: "GeM" },
                { key: "SubTotal", label: "Sub Total", selected: false, group: "GeM" },
                { key: "GstPerc", label: "GST %", selected: false, group: "GeM" },
                { key: "GstAmount", label: "GST Amount", selected: false, group: "GeM" },
                { key: "CessPerc", label: "Cess %", selected: false, group: "GeM" },
                { key: "CessAmount", label: "Cess Amount", selected: false, group: "GeM" },
                { key: "FinalGeMPrice", label: "Final GeM Price", selected: false, group: "GeM" },
                { key: "CsdDisPerc", label: "CSD Disc %", selected: false, group: "CSD" },
                { key: "CSD", label: "CSD Discount", selected: false, group: "CSD" },
                { key: "PreTaxNetDiscount", label: "Pre-Tax Net", selected: false, group: "CSD" },
                { key: "CsdGstPerc", label: "CSD GST %", selected: false, group: "CSD" },
                { key: "CsdGstAmount", label: "CSD GST Amt", selected: false, group: "CSD" },
                { key: "CsdExShowroom", label: "CSD Ex-Showroom", selected: false, group: "CSD" },
                { key: "IncidentalCharges", label: "Incidental Chg", selected: false, group: "CSD" },
                { key: "FinalCSDPrice", label: "Final CSD Price", selected: false, group: "CSD" },
                { key: "ReferMtsModel", label: "Refer MTS Model", selected: false, group: "MTO" },
                { key: "MiyExShowroom", label: "MIY Ex-Showroom", selected: false, group: "MTO" },
                { key: "MiyOnRoad", label: "MIY On-Road", selected: false, group: "MTO" }
            ];

            this._aExportData = aData;

            const oDialogModel = new sap.ui.model.json.JSONModel({
                fields: aAllFields,
                groups: ["Core", "Dealer", "Pricing", "RTO", "Insurance", "GeM", "CSD", "MTO"]
            });

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
                                        const aFields = this._oFieldPickerDialog.getModel("dlg").getProperty("/fields");
                                        aFields.forEach(f => f.selected = true);
                                        this._oFieldPickerDialog.getModel("dlg").setProperty("/fields", aFields);
                                    }.bind(this)
                                }),
                                new sap.m.Button({
                                    text: "Deselect All",
                                    type: "Transparent",
                                    press: function () {
                                        const aFields = this._oFieldPickerDialog.getModel("dlg").getProperty("/fields");
                                        aFields.forEach(f => f.selected = false);
                                        this._oFieldPickerDialog.getModel("dlg").setProperty("/fields", aFields);
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
                                        sorter: new sap.ui.model.Sorter("group", false, function (oContext) {
                                            const grp = oContext.getProperty("group");
                                            return { key: grp, text: grp };
                                        }),
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
                            const aFields = this._oFieldPickerDialog.getModel("dlg").getProperty("/fields");
                            const aSelected = aFields.filter(f => f.selected);

                            if (aSelected.length === 0) {
                                sap.m.MessageToast.show("Please select at least one field.");
                                return;
                            }

                            this._oFieldPickerDialog.close();
                            this._exportToExcel(this._aExportData, aSelected);
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            this._oFieldPickerDialog.close();
                        }.bind(this)
                    })
                });

                oView.addDependent(this._oFieldPickerDialog);
            }

            this._oFieldPickerDialog.setModel(oDialogModel, "dlg");
            this._oFieldPickerDialog.open();
        },

        onExcelDownloadTemplate: function () {
            const oModel = this.getView().getModel("vm");
            const aData = oModel.getProperty("/tableData");
            const aTemplateFields = [
                { key: "Model", label: "Model" },
                { key: "Region", label: "Region" },
                { key: "Basis", label: "Basis / RTO" },
                { key: "ActualExShowroom", label: "Ex-Showroom" },
                { key: "ActualNsp", label: "NSP Input" }
            ];
            this._exportToExcel(aData, aTemplateFields);
        },

        _exportToExcel: function (aData, aSelectedFields) {
            const EdmType = sap.ui.export.EdmType;

            const oSettings = {
                workbook: {
                    columns: aSelectedFields.map(f => ({
                        label: f.label,
                        property: f.key,
                        type: EdmType.String
                    }))
                },
                dataSource: aData,
                fileName: aData.length === 0
                    ? "VehiclePricing_Template.xlsx"
                    : "VehiclePricing_Export.xlsx"
            };

            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        }

    });
});