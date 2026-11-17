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
            { label: "Final CSD Price", property: "FinalCSDPrice" },
            { label: "CSD On-Road", property: "CsdOnroad" }
        ],
        MTO: [
            { label: "Refer MTS Model", property: "ReferMtsModel" },
            { label: "MTO NSP", property: "MtoNsp" },
            { label: "MIY Ex Showroom", property: "MiyExShowroom" },
            { label: "MIY On Road", property: "MiyOnRoad" }
        ]
    };

    const ENTITY_LABELS = {
        RegionMasterSet: "Region Master",
        ModelMasterSet: "Model Master",
        PricingComponentsSet: "Pricing Components",
        RTOExpenseSet: "RTO Expense",
        RtoMasterSet: "RTO Master",
        GMAComponentsSet: "GMA Components",
        PartsSet: "Parts"
    };

    return Controller.extend("vehiclepricingui.controller.vechilepricingmain", {

        onInit: function () {
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
                ASMEmail: "francisajay.ds@laderatechnology.com",
                ASMName: "Francis Ajay D S",
                enableSaveActions: false,
                enableEditActions: false,

                enableButtons: false,

                saveTooltip: "",
                submitTooltip: "",

            });
            this.getView().setModel(oVM, "vm");

            this.getOwnerComponent().getRouter()
                .getRoute("vechilepricingmain")
                .attachPatternMatched(this._onRouteMatched, this);

            this._getUserRestriction();
        },

_getUserRestriction: async function () {
    const oModel = this.getView().getModel("vm");
    try {
        const oMailUser = await this.getOwnerComponent()._checkUserRole();
        const sRole = String(oMailUser?.Role || "").toUpperCase();
        const bIsApprover = ["APPROVER1", "APPROVER2"].includes(sRole);

        oModel.setProperty("/isApprover", bIsApprover);
        oModel.setProperty("/enableButtons", !bIsApprover);
        oModel.setProperty(
            "/saveTooltip",
            bIsApprover ? "You do not have permission to perform this action" : ""
        );
        oModel.setProperty(
            "/submitTooltip",
            bIsApprover ? "You do not have permission to perform this action" : ""
        );
    } catch (oError) {
        console.error("Failed to check user role", oError);
        oModel.setProperty("/enableButtons", false);
    }
    this._updateActionButtons();
},


        _onRouteMatched: async function () {
            if (this._bLoading) return;
            this._bLoading = true;

            const oView = this.getView();
            const oVM = oView.getModel("vm");

            try {
                oView.setBusy(true);

                // Clear leftovers from the previous visit
                this._resetToFullInitialState();
                oVM.setProperty("/blocked", false);
                oVM.setProperty("/models", []);
                oVM.setProperty("/regions", []);
                oVM.setProperty("/filteredModels", []);

                // User info
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

                // Pending master-data popup
                const bProceed = await this._checkPendingMasterData();
                if (!bProceed) {
                    this._leaveApp();
                    return;
                }

                await this._loadData(sASMMail);

            } finally {
                this._bLoading = false;
                oView.setBusy(false);
            }
        },
        _callCheckPricingStatus: async function () {
            const oAction = this.getOwnerComponent().getModel()
                .bindContext("/checkpricingStatus(...)");
            await oAction.execute();

            const oResult = oAction.getBoundContext().getObject();

            if (Array.isArray(oResult?.value)) return oResult.value[0] || null;
            if (oResult?.value && typeof oResult.value === "object") return oResult.value;
            return oResult || null;
        },

        _getPendingEntities: function (oStatus) {
            const oSummary = oStatus?.summary || {};

            return Object.entries(oSummary)
                .map(([sKey, oEntry]) => {
                    // "vechilesrv_vechileprocingAPIs_ModelMasterSet" -> "ModelMasterSet"
                    const sEntity = sKey.split("_").pop();
                    const iPending = Math.max(
                        Number(oEntry?.approver?.submitted) || 0,
                        Number(oEntry?.submitter?.submitted) || 0
                    );
                    return {
                        name: ENTITY_LABELS[sEntity] || sEntity,
                        count: iPending
                    };
                })
                .filter(o => o.count > 0);
        },

        _checkPendingMasterData: async function () {
            let oStatus;
            try {
                oStatus = await this._callCheckPricingStatus();
            } catch (e) {
                console.warn("checkpricingStatus failed:", e);
                return true; // don't block the user if the status API is down
            }

            const aPending = this._getPendingEntities(oStatus);
            if (!aPending.length) return true;

            return new Promise(resolve => {
                let bProceed = false;
                const iTotal = aPending.reduce((s, o) => s + o.count, 0);

                // ── Aligned table: Name | Pending ──
                const oTable = new sap.m.Table({
                    width: "100%",
                    fixedLayout: true,
                    showSeparators: "Inner",
                    columns: [
                        new sap.m.Column({
                            width: "70%",
                            header: new sap.m.Text({ text: "Master Data" })
                        }),
                        new sap.m.Column({
                            width: "30%",
                            hAlign: "End",
                            header: new sap.m.Text({ text: "Pending" })
                        })
                    ],
                    items: aPending.map(o => new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.ObjectStatus({
                                text: o.name,
                                icon: "sap-icon://pending",
                                state: "Warning"
                            }),
                            new sap.m.ObjectNumber({
                                number: String(o.count),
                                state: "Warning",
                                emphasized: true
                            })
                        ]
                    }))
                });

                const oContent = new sap.m.VBox({
                    width: "100%",
                    items: [
                        new sap.m.Text({
                            text: "The following master data is still pending approval:",
                            wrapping: true
                        }).addStyleClass("sapUiSmallMarginBottom"),

                        oTable,

                        new sap.m.Text({
                            text: `Total pending: ${iTotal}`,
                            wrapping: true
                        }).addStyleClass("sapUiSmallMarginTop"),

                        new sap.m.Text({
                            text: "Pricing will be calculated using only the currently approved master data. " +
                                "The pending changes listed above are not included. Do you want to continue?",
                            wrapping: true,
                            width: "100%"
                        }).addStyleClass("sapUiSmallMarginTop")
                    ]
                }).addStyleClass("sapUiContentPadding");

                const oDialog = new sap.m.Dialog({
                    title: "Pending Master Data Approvals",
                    type: "Message",
                    state: "Warning",
                    contentWidth: "32rem",
                    draggable: true,
                    content: [oContent],
                    beginButton: new sap.m.Button({
                        text: "Yes, Proceed",
                        type: "Emphasized",
                        press: () => { bProceed = true; oDialog.close(); }
                    }),
                    endButton: new sap.m.Button({
                        text: "No",
                        press: () => { oDialog.close(); }
                    }),
                    afterClose: () => {
                        oDialog.destroy();
                        resolve(bProceed);   // Esc / No → false, Yes → true
                    }
                });

                this.getView().addDependent(oDialog);
                oDialog.open();
            });
        },

        _leaveApp: function () {
            this.getView().getModel("vm").setProperty("/blocked", true);
            window.history.back();
        },

        formatRecordCount: function (aData) {
            var iCount = aData ? aData.length : 0;
            return iCount + (iCount === 1 ? " record" : " records");
        },

        _getModelDescription: function (sCode) {
            const aModels = this.getView().getModel("vm").getProperty("/models") || [];
            const o = aModels.find(m => String(m.ModelCode).trim() === String(sCode).trim());
            return o ? (o.Description || "") : "";
        },

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



        _loadData: async function () {
            const oVM = this.getView().getModel("vm");
            const sMail = oVM.getProperty("/ASMEmail");

            try {
                // 1. Fetch all users and roles
                const aApprovers = await this._read("/ApproverSet", {});


                // 2. Get only APPROVER1 and APPROVER2 email IDs
                const aApproverMails = [
                    ...new Set(
                        aApprovers
                            .filter(o =>
                                o.Role === "SUBMITTER" ||
                                o.Role === "Submitter"
                            )
                            .map(o => o.Mail)
                            .filter(Boolean)
                    )
                ];


                // 3. Retrieve master data for every approver email
                const aResults = await Promise.all(
                    aApproverMails.map(Mail =>
                        Promise.all([
                            this._read("/ModelMasterSet", { Mail }),
                            this._read("/RegionMasterSet", { Mail })
                        ])
                    )
                );

                // 4. Combine the results
                const aModels = aResults.flatMap(([aModelData]) => aModelData);
                const aRegions = aResults.flatMap(([, aRegionData]) => aRegionData);

                // 5. Apply your existing filtering logic
                const aFilteredModels = this._filterValidToday(
                    aModels,
                    "ModelCode",
                    ["EngineType", "CcWatt"]
                );

                const aFilteredRegions = this._filterValidToday(
                    aRegions,
                    "Region",
                    ["Spras"]
                );

                oVM.setProperty("/models", aFilteredModels);
                oVM.setProperty("/regions", aFilteredRegions);
                oVM.setProperty("/approvers", aApprovers);
                oVM.setProperty("/_allTableData", []);

                oVM.setProperty(
                    "/filteredModels",
                    aFilteredModels.filter(m => m.Status === "APPROVED")
                );

                // console.log("Logged-in ASM Email:", sMail);

            } catch (error) {
                console.error("Error loading master data:", error);
            }
        },


        _filterValidToday: function (aRecords, sPrimaryKey, aExtraKeys, oEffectiveDate) {

            console.log("_filterValidToday | primaryKey:", sPrimaryKey,
                "| extraKeys:", aExtraKeys, "| records in:", aRecords.length);


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

                    //Step 3: REMOVE future dates
                    .filter(x => x.fromDate <= today);

                //If no valid past/today records → skip
                if (!aWithDates.length) {
                    return;
                }

                // ── Step 4: Sort descending ──
                aWithDates.sort((a, b) => b.fromDate - a.fromDate);

                console.log(`[${sGroupKey}] Valid FromDates:`,
                    aWithDates.map(x => x.fromDate.toISOString().split("T")[0]),
                    "→ picked:", aWithDates[0].fromDate.toISOString().split("T")[0]
                );

                // ── Step 5: Take latest valid record ──
                aResult.push(aWithDates[0].record);
            });

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
            // console.log("_read | URL:", sFullUrl);

            const oResponse = await fetch(sFullUrl, {
                headers: { "Accept": "application/json" },
                credentials: "include"
            });

            if (!oResponse.ok) throw new Error(`HTTP ${oResponse.status} for ${sPath}`);

            const oJson = await oResponse.json();
            const aRaw = oJson?.d?.results || oJson?.value || [];
            // console.log(`_read | ${sPath} raw count:`, aRaw.length, aRaw);

            return aRaw;
        },

        _readSubmissionRefs: async function () {
            const sOwnMail = this.getView().getModel("vm").getProperty("/ASMEmail");
            let aMails = [];

            try {
                const aApprovers = await this._read("/ApproverSet");
                aMails = [...new Set(
                    aApprovers.map(a => String(a.Mail || "").trim()).filter(Boolean)
                )];
            } catch (e) {
                console.warn("ApproverSet read failed:", e.message);
            }

            if (sOwnMail && !aMails.includes(sOwnMail)) aMails.push(sOwnMail);

            for (const sMail of aMails) {
                try {
                    const aRows = await this._read("/SubmissionReference", { Mail: sMail });
                    if (aRows && aRows.length) return aRows;
                } catch (e) {
                    console.warn(`SubmissionReference failed for ${sMail}:`, e.message);
                }
            }
            return [];
        },

        //  VALIDATION

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

        //  SEARCH
        onGoPress: async function () {
            if (!this._validateMandatoryFields()) return;

            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
            const sRegion = this.byId("idRegionMCB").getSelectedKey();

            const oVM = this.getView().getModel("vm");
            const sPreviousMto = oVM.getProperty("/selectedMto");

            // console.log("model that we received: ", oVM);


            if (sPreviousMto && sPreviousMto !== sMtoMts) {
                // console.log(`Type changed: ${sPreviousMto} → ${sMtoMts} — clearing processed data`);
            }

            this._resetToInitialState();

            const oView = this.getView();
            const sMail = oVM.getProperty("/ASMEmail");

            oVM.setProperty("/selectedMto", sMtoMts);
            oView.setBusy(true);

            try {

                if (sMtoMts === "MTS") {
                    await this._goMTS(sRegion, sMail);
                } else if (sMtoMts === "MTO") {
                    await this._goMTO(sRegion, sMtoMts, sMail);
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

                    //new code - 11/10f

                    // this._readSubmissionRefs()
                ]);

                // ── Filter models with effective date ──────────────────────────────
                let aFilteredModels = this._filterValidToday(
                    aModels, "ModelCode", ["EngineType", "CcWatt"], sEffectiveDate || null
                );

                // ── Fallback: always try ModelInvalidSet if no models found ────────
                if (!aFilteredModels.length) {
                    // console.log("No models in main set — trying ModelInvalidSet");
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
                    // console.log("No regions in main set — trying RegionInvalidSet");
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
                        // console.log("Breakup found:", oBreakup);
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

                    if (bShowBreakup) {
                        aTableData.push({
                            // ── Identity ──────────────────────────────────────────────
                            Model: oModel.ModelCode,
                            ModelCode: oModel.ModelCode,
                            Description: oModel.Description || "",
                            Region: oRegion.Region,
                            Ort01: oRegion.Ort01,
                            rowStatus: sRowStatus,

                            // ── Core ──────────────────────────────────────────────────
                            Basis: oBreakup.Basis || oRegion.BasisRto,
                            InputExShowroom: this.formatIndian(oBreakup.InputExShowroom || ""),
                            InputNsp: this.formatIndian(oBreakup.InputNsp || ""),
                            _rawInputNsp: String(oBreakup.InputNsp || "").replace(/,/g, ""),
                            ActualExShowroom: oBreakup.ActualExShowroom || "",
                            // MTSExshowroom: oBreakup.MTSExshowroom || "",
                            MTSExshowroom: oBreakup.MTSExshowroom || oBreakup.InputExShowroom || "",
                            OnRoad: oBreakup.OnRoad || "",
                            MTOOnRoad: (() => {
                                const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                                return s(oBreakup.Rto) + s(oBreakup.RtoWithBill) + s(oBreakup.ActualExShowroom) + s(oBreakup.TotalInsurance);
                            })(),

                            // ── Dealer ────────────────────────────────────────────────
                            // draft entity: "DealerMargin" → UI: "DealerMarginPerc" + "ActualDealerMargin"
                            DealerMarginPerc: oBreakup.DealerMargin || "",
                            ActualDealerMargin: oBreakup.DealerMargin || "",
                            ActualNsp: oBreakup.ActualNsp || "",
                            // draft entity: "IncrementalNsp" → UI: "IncrementalNSP"
                            IncrementalNSP: Math.abs(oBreakup.IncrementalNsp) || "0",
                            MtoNsp: oBreakup.MtoNsp || "",
                            Helmet: oBreakup.Helmet || "",
                            Transportation: oBreakup.Transportation || "",
                            DealerCost: oBreakup.DealerCost || "",
                            OtherExpenses: oBreakup.OtherExpenses || "",
                            BikeMargin: oBreakup.BikeMargin || "",
                            IncrementDlr: String(parseFloat(Math.abs(oBreakup.IncrementDlr)) || 0),
                            Incremental2: String(parseFloat(Math.abs(oBreakup.IncrementDlr)) || 0),
                            HelmetMargin: oBreakup.HelmetMargin || "",
                            TotalDealerMargin: oBreakup.TotalDealerMargin || "",

                            // ── Pricing ───────────────────────────────────────────────
                            Ndp: oBreakup.Ndp || "",
                            Basic: oBreakup.Basic || "",
                            // draft entity: "GstPerc" → UI: "GSTPerc"
                            GSTPerc: oBreakup.GstPerc ? String(parseFloat(oBreakup.GstPerc)) : "",
                            Gst: oBreakup.Gst || "",

                            // ── RTO ───────────────────────────────────────────────────
                            RtoPerc: oBreakup.RtoPerc || "",
                            Rto: oBreakup.Rto || "",
                            RtoWithBill: oBreakup.RtoWithBill || "",

                            // ── Insurance ─────────────────────────────────────────────
                            insuranceperc: oBreakup.insuranceperc || "0",
                            Insurance: oBreakup.insurance ?? oBreakup.Insurance ?? "",
                            TpaPa: oBreakup.TPA_PA ?? oBreakup.TpaPa ?? "",
                            ActualGst: oBreakup.GST_afterTPA ?? oBreakup.ActualGst ?? "",
                            TotalInsurance: oBreakup.TotalInsurance || "",
                            InsuranceLe350: oBreakup.InsuranceLe350 || "0",
                            InsuranceGt350: oBreakup.InsuranceGt350 || "0",

                            // ── MTO extras ────────────────────────────────────────────
                            // draft entity: "ReferenceMtsModel" → UI: "ReferMtsModel"
                            ReferMtsModel: oBreakup.ReferenceMtsModel || oBreakup.ReferModel || "",
                            // ── In bShowBreakup block, update these mappings ──

                            // SAP: GstAftBasic → UI: Gst (rupee amount)
                            Gst: oBreakup.GstAftBasic || oBreakup.Gst || "",

                            // SAP: InsurancePerc → UI: insuranceperc
                            insuranceperc: oBreakup.InsurancePerc || oBreakup.insuranceperc || "0",

                            // SAP: InsuranceGst → UI: ActualGst
                            ActualGst: oBreakup.InsuranceGst ?? oBreakup.ActualGst ?? "",

                            // SAP: DealerMargPerc → UI: DealerMarginPerc
                            DealerMarginPerc: oBreakup.DealerMargPerc || oBreakup.DealerMargin || "",

                            // SAP: MtsExshwroom → UI: MTSExshowroom
                            MTSExshowroom: oBreakup.MtsExshwroom || oBreakup.MTSExshowroom || oBreakup.InputExShowroom || "",

                            // SAP: MtsOnRoad → UI: MTSOnRoad
                            MTSOnRoad: oBreakup.MtsOnRoad || oBreakup.MTSOnRoad || "",

                            // SAP: MtoExShwroom → UI: MTO_Exshowroom / ActualExShowroom (MTO)
                            MTO_Exshowroom: oBreakup.MtoExShwroom || "",

                            // SAP: MtoOnRoad → UI: MTOOnRoad
                            MTOOnRoad: oBreakup.MtoOnRoad || (() => {
                                const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                                return s(oBreakup.Rto) + s(oBreakup.RtoWithBill)
                                    + s(oBreakup.ActualExShowroom) + s(oBreakup.TotalInsurance);
                            })(),

                            // SAP: MtoNsp → UI: MtoNsp
                            MtoNsp: oBreakup.MtoNsp || "",

                            // SAP: MiyExshowroom → UI: MIYExShowroomTotal
                            MIYExShowroomTotal: parseFloat(oBreakup.MiyExshowroom || 0),

                            // SAP: MiyOnroad → UI: MIYOnRoadTotal
                            MIYOnRoadTotal: parseFloat(oBreakup.MiyOnroad || 0),

                            // SAP: MtoExShwAftGma → UI: MTOExshowroomafterGMA
                            MTOExshowroomafterGMA: oBreakup.MtoExShwAftGma || oBreakup.ExpExshowroom || "",

                            // SAP: ExpOnroad → UI: ExpectedOnRoad  (unchanged)
                            ExpectedOnRoad: oBreakup.ExpOnroad || "",

                            // ── Reference ─────────────────────────────────────────────
                            ExceptionRef: oBreakup.ExceptionRef || "E",
                            ReferenceNum: oBreakup.ReferenceNum || "",
                            Diff: oBreakup.Diff || "0",

                            // ── State flags ───────────────────────────────────────────
                            isChanged: false,
                            isCalculated: true,
                            InputExShowroomEnabled: true,
                            InputNspEnabled: true,
                            _origInputExShowroom: String(oBreakup.InputExShowroom ?? ""),
                            _origInputNsp: String(oBreakup.InputNsp ?? "")
                        });

                        // console.log(aTableData);


                    } else {
                        // ── NEW row — no breakup exists or reference not approved ──
                        aTableData.push({
                            Model: oModel.ModelCode,
                            ModelCode: oModel.ModelCode,
                            Description: oModel.Description || "",
                            Region: oRegion.Region,
                            Ort01: oRegion.Ort01,
                            Basis: oRegion.BasisRto,
                            rowStatus: "NEW",

                            InputExShowroom: "",
                            InputNsp: "",
                            _rawInputNsp: "",

                            isChanged: false,
                            isCalculated: false,
                            InputExShowroomEnabled: true,
                            InputNspEnabled: true,
                            _origInputExShowroom: "",
                            _origInputNsp: ""
                        });
                    }
                });
            });

            this.getView().getModel("vm").setProperty("/_allTableData", aTableData);
        },

        _goMTO: async function (sRegion, sMtoMts, sMail) {
            const oVM = this.getView().getModel("vm");

            // ── Get SELECTED models (not all MTO models) ──
            const oModelMCB = this.byId("idModelMCB");
            const aSelectedKeys = oModelMCB ? oModelMCB.getSelectedKeys() : [];

            const aAllModels = oVM.getProperty("/models") || [];
            const aAllMTOModels = aAllModels
                .filter(m => m.OrdType === "MTO")
                .map(m => String(m.ModelCode).trim());

            const oDescMap = {};
            aAllModels.forEach(m => {
                oDescMap[String(m.ModelCode).trim()] = m.Description || "";
            });

            // If user selected specific models, use those; otherwise use all MTO models
            const aMTOModels = aSelectedKeys.length > 0
                ? aSelectedKeys.filter(k => aAllMTOModels.includes(k))
                : aAllMTOModels;

            // ── Step 2: Fetch all breakups ───────────────────────────────
            let aBreakups = [];
            try {
                aBreakups = await this._read("/ModelPriceBreakupSet", { Mail: sMail });
            } catch (e) {
                console.warn("Breakup fetch failed:", e.message);
            }

            // ── Step 3: Draft rows ───────────────────────────────────────
            const aDraftBreakups = aBreakups.filter(b =>
                String(b.ReferenceNum || "").trim() === ""
            );

            // ── Step 4: Draft models for selected region ─────────────────
            const aDraftModelsForRegion = aDraftBreakups
                .filter(b => String(b.Region).trim() === String(sRegion).trim())
                .map(b => String(b.Model).trim());

            // ── Step 5: Find missing models ──────────────────────────────
            const aMissingModels = aMTOModels.filter(m =>
                !aDraftModelsForRegion.includes(m)
            );


            let aTableData = [];

            // ── Step 6: Call backend ONLY for missing models ─────────────
            if (aMissingModels.length > 0) {
                // console.log("Missing models → calling backend");

                const oODataModel = this.getOwnerComponent().getModel();
                const oAction = oODataModel.bindContext("/goProcessing(...)");

                oAction.setParameter("regionCode", sRegion);
                oAction.setParameter("MTOStatus", sMtoMts);
                oAction.setParameter("Mail", sMail);
                oAction.setParameter("ModelCodes", aMissingModels);

                await oAction.execute();

                const oResult = oAction.getBoundContext().getObject();

                let aResultsRaw = Array.isArray(oResult?.value)
                    ? oResult.value
                    : Array.isArray(oResult)
                        ? oResult
                        : [oResult];


                aTableData = aResultsRaw.map(oRow => {
                    const { MiyBreakup, ...oCleanRow } = oRow;

                    //changed done


                    const sExShowroom = oRow.ActualExShowroom ? String(oRow.ActualExShowroom) : "";
                    const sNsp = oRow.ActualNsp ? String(oRow.ActualNsp) : "";

                    const sBikeMargin = oRow.BikeMargin ?? oRow.BikeMarigin ?? "";
                    const sDealerMargin = oRow.ActualDealerMargin ?? oRow.DealerMarigin ?? "";
                    const sIncrementDlr = String(Math.abs(parseFloat(oRow.IncrementDlr ?? oRow.Incremental2 ?? 0) || 0));

                    // MTO: ActualDealerMargin = BikeMargin + IncrementDlr (markup)
                    const dealerMarginDisplay = String(
                        (parseFloat(sBikeMargin) || 0) + (parseFloat(sIncrementDlr) || 0)
                    );
                    const incremental2 = String(parseFloat(Math.abs(sIncrementDlr)) || 0);

                    // console.log(oRow);


                    return {
                        ...oCleanRow,

                        Model: oRow.Model || oRow.ModelCode,
                        ModelCode: oRow.Model || oRow.ModelCode,
                        // Description: oDescMap[String(oRow.Model || oRow.ModelCode).trim()] || "",
                        Description: oRow.Description || oRow.ModelName || oDescMap[String(oRow.Model || oRow.ModelCode).trim()] || "",

                        Region: oRow.Region,

                        Region: oRow.Region,

                        //chagnes done
                        Ort01: this._getRegionName(oRow.Region),

                        isChanged: false,
                        isCalculated: true,
                        isReadOnly: false,
                        rowStatus: "NEW",

                        // ── Input fields ──────────────────────────────────
                        InputExShowroom: sExShowroom,
                        InputNsp: sNsp,
                        InputExShowroomEnabled: true,
                        InputNspEnabled: true,
                        _origInputExShowroom: sExShowroom,
                        _origInputNsp: sNsp,

                        // ── Core price fields — backend name → UI name ───
                        Basis: oRow.Basis || oRow.BasisRto || "",
                        GSTPerc: oRow.Gst,               // Gst = the % rate from backend
                        Gst: oRow.GSTAfterbasic,         // GSTAfterbasic = rupee amount
                        ActualExShowroom: oRow.ActualExShowroom ?? oRow.ex_showroomAfterGST ?? "",
                        MTSExshowroom: Number(oRow.MTSExshowroom) ?? "",

                        // ── Dealer fields ────────────────────────────────
                        IncrementalNSP: Math.abs(oRow.IncrementalNsp) ?? Math.abs(oRow.IncrementalNSP) ?? "0",
                        IncrementDlr: String(Math.abs(sIncrementDlr)),
                        Incremental2: incremental2,
                        ActualDealerMargin: dealerMarginDisplay,
                        BikeMargin: sBikeMargin,

                        //changed done
                        MiyBreakup: MiyBreakup || [],

                        // MiyBreakup: this._partsFromBreakup(oBreakup),


                        // ── MTO extra fields ─────────────────────────────
                        MtoNsp: oRow.MTO_NSP ?? oRow.MtoNsp ?? null,
                        ReferMtsModel: oRow.ReferModel ?? oRow.ReferenceMtsModel ?? "",
                        MIYExShowroomTotal: oRow.MiyExShowroomTotal ?? 0,
                        MIYOnRoadTotal: oRow.MiyOnRoadTotal ?? 0,
                        // MTOExshowroomafterGMA: oRow.ActualExShowroom ?? "",
                        MTOExshowroomafterGMA: oRow.MTOExshowroomafterGMA ?? "",

                        ExpectedOnRoad: oRow.ExpectedOnRoad ?? "",
                        MTOOnRoad: (() => {
                            const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                            return s(oRow.Rto) + s(oRow.RtoWithBill) + s(oRow.ActualExShowroom) + s(oRow.TotalInsurance);
                        })(),



                    };
                });
            }

            // ── Step 7: Merge ALL drafts

            aDraftBreakups.forEach(oBreakup => {
                const sModel = String(oBreakup.Model).trim();
                const sRegionDraft = String(oBreakup.Region).trim();

                const iIdx = aTableData.findIndex(row =>
                    String(row.ModelCode || row.Model).trim() === sModel &&
                    String(row.Region).trim() === sRegionDraft
                );

                const oDraftRow = {
                    Model: sModel,
                    ModelCode: sModel,
                    Description: oDescMap[sModel] || "",
                    Region: sRegionDraft,
                    Region: sRegionDraft,
                    //chagnes done
                    Ort01: this._getRegionName(sRegionDraft),
                    rowStatus: "DRAFT",
                    isCalculated: true,
                    isChanged: false,

                    // ── Core ──
                    Basis: oBreakup.Basis || "",
                    InputExShowroom: this.formatIndian(oBreakup.InputExShowroom || ""),
                    InputNsp: this.formatIndian(oBreakup.InputNsp || ""),
                    _rawInputNsp: String(oBreakup.InputNsp || "").replace(/,/g, ""),
                    ActualExShowroom: oBreakup.ActualExShowroom || "",
                    // MTSExshowroom: oBreakup.MTSExshowroom || "",
                    MTSExshowroom: oBreakup.MTSExshowroom || oBreakup.InputExShowroom || "",
                    OnRoad: oBreakup.OnRoad || "",
                    MTOOnRoad: (() => {
                        const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                        return s(oBreakup.Rto) + s(oBreakup.RtoWithBill) + s(oBreakup.ActualExShowroom) + s(oBreakup.TotalInsurance);
                    })(),

                    // ── Dealer ──
                    // draft: "DealerMargin" → UI: "DealerMarginPerc" + "ActualDealerMargin"
                    DealerMarginPerc: (
                        (Number(oBreakup.DealerMargin) / Number(oBreakup.Ndp)) * 100
                    ).toFixed(2) || 0,
                    ActualDealerMargin: oBreakup.DealerMargin || "",
                    ActualNsp: oBreakup.ActualNsp || "",
                    // draft: "IncrementalNsp" → UI: "IncrementalNSP"
                    IncrementalNSP: Math.abs(oBreakup.IncrementalNsp) || "0",
                    MtoNsp: oBreakup.MtoNsp || "",
                    Helmet: oBreakup.Helmet || "",
                    Transportation: oBreakup.Transportation || "",
                    DealerCost: oBreakup.DealerCost || "",
                    OtherExpenses: oBreakup.OtherExpenses || "",
                    BikeMargin: oBreakup.BikeMargin || "",
                    IncrementDlr: String(parseFloat(Math.abs(oBreakup.IncrementDlr)) || 0),
                    Incremental2: String(parseFloat(Math.abs(oBreakup.IncrementDlr)) || 0),
                    HelmetMargin: oBreakup.HelmetMargin || "",
                    TotalDealerMargin: oBreakup.TotalDealerMargin || "",

                    MTSExshowroom: oBreakup.MTSExshowroom || oBreakup.InputExShowroom || "",
                    MTSOnRoad: oBreakup.MTSOnRoad ?? oBreakup.MTSOnRoad,
                   

                    // ── Pricing ──
                    Ndp: oBreakup.Ndp || "",
                    Basic: oBreakup.Basic || "",
                    // draft: "GstPerc" → UI: "GSTPerc"
                    GSTPerc: oBreakup.GstPerc ? String(parseFloat(oBreakup.GstPerc)) : "",
                    Gst: oBreakup.Gst || "",

                    // ── RTO ──
                    RtoPerc: oBreakup.RtoPerc || "",
                    Rto: oBreakup.Rto || "",
                    RtoWithBill: oBreakup.RtoWithBill || "",

                    // ── Insurance ──
                    insuranceperc: oBreakup.insuranceperc || "0",
                    Insurance: oBreakup.Insurance || "",
                    TpaPa: oBreakup.TpaPa || "",
                    ActualGst: oBreakup.ActualGst || "",
                    TotalInsurance: oBreakup.TotalInsurance || "",
                    InsuranceLe350: oBreakup.InsuranceLe350 || "0",
                    InsuranceGt350: oBreakup.InsuranceGt350 || "0",

                    // ── MTO extras ──
                    ReferMtsModel: oBreakup.ReferenceMtsModel || oBreakup.ReferModel || "",
                    Gst: oBreakup.GstAftBasic || oBreakup.Gst || "",
                    insuranceperc: oBreakup.InsurancePerc || oBreakup.insuranceperc || "0",
                    ActualGst: oBreakup.InsuranceGst ?? oBreakup.ActualGst ?? "",
                    DealerMarginPerc: oBreakup.DealerMargPerc || oBreakup.DealerMargin || "",
                    MTSExshowroom: oBreakup.MtsExshwroom || oBreakup.MTSExshowroom || oBreakup.InputExShowroom || "",
                    MTSOnRoad: oBreakup.MtsOnRoad || oBreakup.MTSOnRoad || "",
                    MTOOnRoad: oBreakup.MtoOnRoad || (() => {
                        const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                        return s(oBreakup.Rto) + s(oBreakup.RtoWithBill)
                            + s(oBreakup.ActualExShowroom) + s(oBreakup.TotalInsurance);
                    })(),
                    MtoNsp: oBreakup.MtoNsp || "",
                    MIYExShowroomTotal: parseFloat(oBreakup.MiyExshowroom || 0),
                    MIYOnRoadTotal: parseFloat(oBreakup.MiyOnroad || 0),
                    MTOExshowroomafterGMA: oBreakup.MtoExShwAftGma || oBreakup.ExpExshowroom || "",
                    ExpectedOnRoad: oBreakup.ExpOnroad || "",

                    MiyBreakup: this._partsFromBreakup(oBreakup),

                    // ── Reference ──
                    ExceptionRef: oBreakup.ExceptionRef || "E",
                    ReferenceNum: oBreakup.ReferenceNum || "",

                    // ── Input state ──
                    InputExShowroomEnabled: true,
                    InputNspEnabled: true,
                    _origInputExShowroom: String(oBreakup.InputExShowroom ?? ""),
                    _origInputNsp: String(oBreakup.InputNsp ?? "")
                };

                if (iIdx < 0) {
                    aTableData.push(oDraftRow);
                } else {
                    aTableData[iIdx] = oDraftRow;
                }
            });
            // ── Step 8: Remove duplicates ────────────────────────────────
            const aFinalData = Object.values(
                aTableData.reduce((acc, o) => {
                    const key = (o.ModelCode || o.Model) + "|" + o.Region;
                    acc[key] = o;
                    return acc;
                }, {})
            );

            // ── Step 9: Bind to UI ───────────────────────────────────────
            oVM.setProperty("/tableData", aFinalData);
            oVM.setProperty("/_allProcessedTableData", JSON.parse(JSON.stringify(aFinalData)));
            this._buildProcessedFilters();

            // console.log("Final rows:", aFinalData.length);
        },

        _goProcessing: async function (sRegion, sMtoMts, sMail) {
            const oVM = this.getView().getModel("vm");
            const oODataModel = this.getOwnerComponent().getModel();
            const oAction = oODataModel.bindContext("/goProcessing(...)");

            const oModelMCB = this.byId("idModelMCB");
            const aModelKeys = oModelMCB ? oModelMCB.getSelectedKeys() : [];

            // ── Read status and effective date ──
            const sStatus = this.byId("idStatus").getSelectedKey();  // "ACTIVE", "IN-ACTIVE", "IN-STOCK"
            const sEffectiveDate = oVM.getProperty("/valueDP2");

            oAction.setParameter("regionCode", sRegion);
            oAction.setParameter("MTOStatus", sMtoMts);
            oAction.setParameter("Mail", sMail);
            oAction.setParameter("ModelCodes", aModelKeys);
            oAction.setParameter("StatusFilter", sStatus || "ACTIVE");
            oAction.setParameter("EffectiveDate", sEffectiveDate || "");

            await oAction.execute();

            const oResult = oAction.getBoundContext().getObject();

            let aResultsRaw = [];

            // ── Normalize response ───────────────────────────────
            if (Array.isArray(oResult)) {
                aResultsRaw = oResult;
            } else if (Array.isArray(oResult?.value)) {
                aResultsRaw = oResult.value;
            } else if (oResult && typeof oResult === "object") {
                aResultsRaw = [oResult];
            }

            // console.log("FULL goProcessing result:", aResultsRaw);

            const aResults = Object.values(
                aResultsRaw.reduce((acc, o) => {
                    const key = (o.Model || o.ModelCode) + "|" + o.Region;

                    // keep last record (or change logic if needed)
                    acc[key] = o;

                    return acc;
                }, {})
            );

            // console.log("After dedupe:", aResults.length);


            const aTableData = aResults.map(oRow => {

                const { MIYBreakup, ...oCleanRow } = oRow;

                const sExShowroom = oRow.ActualExShowroom || String(oRow.ActualExShowroom) || String(oRow.ex_showroomAfterGST) || "";
                const sNsp = oRow.ActualNsp ? String(oRow.ActualNsp) : "";

                const sBikeMargin = oRow.BikeMargin ?? oRow.BikeMarigin ?? "";
                const sDealerMargin = oRow.ActualDealerMargin ?? oRow.DealerMarigin ?? "";
                const sIncrementDlr = Math.abs(oRow.IncrementDlr) ?? Math.abs(oRow.Incremental2) ?? "0";

                const dealerMarginDisplay = sMtoMts === "MTO"
                    ? String((parseFloat(sBikeMargin) || 0) + (parseFloat(Math.abs(sIncrementDlr)) || 0))
                    : sDealerMargin;

                const incremental2 = sMtoMts === "MTO"
                    ? String(Math.abs(parseFloat(Math.abs(sIncrementDlr)) || 0))
                    : String(Math.abs((parseFloat(sBikeMargin) || 0) - (parseFloat(sDealerMargin) || 0)));

                // REPLACE the return object inside aResults.map(oRow => { ... }) in _goProcessing:

                return {
                    Model: oRow.Model || oRow.ModelCode || "",
                    ModelCode: oRow.Model || oRow.ModelCode || "",
                    Region: oRow.Region || "",
                    Description: oRow.Description || oRow.ModelName || this._getModelDescription(oRow.Model || oRow.ModelCode),
                    //chagnes done
                    Ort01: this._getRegionName(oRow.Region || ""),
                    Basis: oRow.Basis || oRow.BasisRto || "",
                    MtoMts: oRow.MtoMts || sMtoMts || "",

                    rowStatus: "NEW",
                    isChanged: false,
                    isCalculated: true,
                    isReadOnly: false,

                    // ── Core ─────────────────────────────────────────────────────
                    InputExShowroom: oRow.ex_showroomAfterGST ?? oRow.ActualExShowroom ?? "",
                    InputNsp: oRow.InputNSP ?? oRow.ActualNsp ?? "",
                    InputExShowroomEnabled: true,
                    InputNspEnabled: true,
                    _origInputExShowroom: oRow.ex_showroomAfterGST ?? oRow.ActualExShowroom ?? "",
                    _origInputNsp: oRow.InputNSP ?? oRow.ActualNsp ?? "",
                    ActualExShowroom: oRow.ex_showroomAfterGST ?? oRow.ActualExShowroom ?? "",
                    OnRoad: oRow.OnRoadPrice ?? oRow.OnRoad ?? "",
                    MTOOnRoad: oRow.OnRoadPrice ?? oRow.OnRoad ?? "",

                    // ── Dealer ────────────────────────────────────────────────────
                    DealerMarginPerc: oRow.DealerMarginPerc ?? oRow.DealerMarigin ?? "",
                    ActualNsp: oRow.ActualNsp ?? "",
                    IncrementalNSP: Math.abs(parseFloat(oRow.IncrementalNSP ?? oRow.IncrementalNsp ?? 0)) || 0,
                    Helmet: oRow.Helmet ?? "",
                    Transportation: oRow.Transportation ?? "",
                    DealerCost: oRow.DealerCost ?? "",
                    OtherExpenses: oRow.OtherExpenses ?? "",
                    BikeMargin: oRow.BikeMargin ?? oRow.BikeMarigin ?? "",
                    IncrementDlr: String(Math.abs(parseFloat(oRow.IncrementDlr ?? 0) || 0)),
                    Incremental2: String(Math.abs(parseFloat(oRow.IncrementDlr ?? 0) || 0)),
                    ActualDealerMargin: oRow.ActualDealerMargin ?? oRow.DealerMarigin ?? "",
                    HelmetMargin: oRow.HelmetMarigin ?? oRow.HelmetMargin ?? "",
                    TotalDealerMargin: oRow.totalDealerMarigin ?? oRow.TotalDealerMargin ?? "",

                    // ── Pricing ───────────────────────────────────────────────────
                    Ndp: oRow.NDP ?? oRow.Ndp ?? "",
                    Basic: oRow.Basic ?? "",
                    GSTPerc: oRow.GSTPerc ?? oRow.GstPerc ?? "",
                    Gst: oRow.GSTAfterbasic ?? oRow.Gst ?? "",

                    // ── RTO ───────────────────────────────────────────────────────
                    RtoPerc: oRow.RTO_percentage ?? oRow.RtoPerc ?? "",
                    Rto: oRow.RTO ?? oRow.Rto ?? "",
                    RtoWithBill: oRow.RTO_bill ?? oRow.RtoWithBill ?? "",

                    // ── Insurance ─────────────────────────────────────────────────
                    insuranceperc: oRow.insuranceperc ?? "0",
                    InsuranceLe350: oRow.InsuranceLe350 ?? "0",
                    InsuranceGt350: oRow.InsuranceGt350 ?? "0",
                    Insurance: oRow.insurance ?? oRow.Insurance ?? "",
                    TpaPa: oRow.TPA_PA ?? oRow.TpaPa ?? "",
                    ActualGst: oRow.GST_afterTPA ?? oRow.ActualGst ?? "",
                    TotalInsurance: oRow.TotalInsurance ?? "",

                    // ── GeM-specific ──
                    // DiscountPerc: oRow.DiscountPerc ?? "",
                    // DiscountAmount: oRow.DiscountAmount ?? "",
                    // SubTotal: oRow.SubTotal ?? "",
                    // GemGstPerc: oRow.GemGstPerc ?? "",
                    // HelmetCost: oRow.HelmetCost ?? "",
                    // GemBasic: oRow.GemBasic ?? "",
                    // GemGstAmount: oRow.GemGstAmount ?? "",
                    // FinalGeMPrice: oRow.FinalGeMPrice ?? "",
                    // MtsExShowroom: oRow.MtsExShowroom ?? "",

                    // ── CSD-specific (use != null because 0 is valid) ──
                    // CsdNsp: oRow.CsdNsp != null ? oRow.CsdNsp : "",
                    // BasicPriceWO: oRow.BasicPriceWO != null ? oRow.BasicPriceWO : "",
                    // CsdDisPerc: oRow.CsdDisPerc != null ? oRow.CsdDisPerc : "",
                    // CSD: oRow.CSD != null ? oRow.CSD : "",
                    // PreTaxNetDiscount: oRow.PreTaxNetDiscount != null ? oRow.PreTaxNetDiscount : "",
                    // CsdGstPerc: oRow.CsdGstPerc != null ? oRow.CsdGstPerc : "",
                    // CsdGstAmount: oRow.CsdGstAmount != null ? oRow.CsdGstAmount : "",
                    // CsdExShowroom: oRow.CsdExShowroom != null ? oRow.CsdExShowroom : "",
                    // IncidentalPerc: oRow.IncidentalPerc != null ? oRow.IncidentalPerc : "",
                    // IncidentalCharges: oRow.IncidentalCharges != null ? oRow.IncidentalCharges : "",
                    // FinalCSDPrice: oRow.FinalCSDPrice != null ? oRow.FinalCSDPrice : "",
                    // CsdOnRoad: oRow.CsdOnRoad != null ? oRow.CsdOnRoad : "",


                    // GeM
                    DiscountPerc: oRow.DiscPerc ?? oRow.DiscountPerc ?? "",
                    DiscountAmount: oRow.DiscAmount ?? oRow.DiscountAmount ?? "",
                    SubTotal: oRow.SubTotal ?? "",
                    GemGstPerc: oRow.GemGstPerc ?? "",
                    HelmetCost: oRow.HelmetCost ?? "",
                    GemBasic: oRow.GemBasic ?? "",
                    GemGstAmount: oRow.GemGstAmount ?? "",
                    FinalGeMPrice: oRow.FinalGemPrice ?? oRow.FinalGeMPrice ?? "",
                    MtsExShowroom: oRow.MtsExshwroom ?? oRow.MtsExShowroom ?? "",

                    // CSD
                    CsdNsp: oRow.CsdNsp ?? "",
                    BasicPriceWO: oRow.BasicPriceWo ?? oRow.BasicPriceWO ?? "",
                    CsdDisPerc: oRow.CsdDiscPerc ?? oRow.CsdDisPerc ?? "",
                    CSD: oRow.Csd ?? oRow.CSD ?? "",
                    PreTaxNetDiscount: oRow.PretaxNetDisc ?? oRow.PreTaxNetDiscount ?? "",
                    CsdGstPerc: oRow.CsdGstPerc ?? "",
                    CsdGstAmount: oRow.CsdGstAmount ?? "",
                    CsdExShowroom: oRow.CsdExshwroom ?? oRow.CsdExShowroom ?? "",
                    IncidentalPerc: oRow.IncidentalPerc ?? "",
                    IncidentalCharges: oRow.IncidentalCharges ?? "",
                    FinalCSDPrice: oRow.FinalCsdPrice ?? oRow.FinalCSDPrice ?? "",
                    CsdOnRoad: oRow.CsdOnroad ?? oRow.CsdOnRoad ?? "",

                    // ── MTO extras ────────────────────────────────────────────────
                    MtoNsp: oRow.MTO_NSP ?? oRow.MtoNsp ?? null,
                    ReferMtsModel: oRow.ReferModel ?? oRow.ReferMtsModel ?? "",
                    MIYExShowroomTotal: oRow.MiyExShowroomTotal ?? 0,
                    MIYOnRoadTotal: oRow.MiyOnRoadTotal ?? 0,
                    MTOExshowroomafterGMA: oRow.MTOExshowroomafterGMA ?? "",
                    MTSExshowroom: oRow.MTSExshowroom ?? "",
                    MTSOnRoad: oRow.MTSOnRoad ?? "",
                    ExpectedOnRoad: oRow.ExpectedOnRoad ?? "",
                    ExceptionRef: oRow.ExceptionRef ?? "E",
                    ReferenceNum: oRow.ReferenceNum ?? "",
                    Diff: oRow.Diff ?? "0",
                };
            });

            oVM.setProperty("/tableData", aTableData);


            const aExistingSnap = oVM.getProperty("/_allProcessedTableData") || [];
            const aSnapKeys = new Set(aExistingSnap.map(s => (s.ModelCode || s.Model) + "|" + s.Region));
            const aNewSnap = [...aExistingSnap];
            aTableData.forEach(oRow => {
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

            // Force scroll container to re-measure content width after columns change
            setTimeout(() => {
                const oScroll = this.byId("idvechileTable")?.getParent();
                if (oScroll && oScroll.getDomRef) {
                    const oDom = oScroll.getDomRef();
                    if (oDom) oDom.scrollLeft = oDom.scrollLeft; // trigger reflow
                }
            }, 0);
        },

        //     formatMTSOnRoad: function (sMTOOnRoad, sMIYOnRoadTotal) {
        // const mtsOnRoad = parseFloat(String(MTSOnRoad || "").replace(/,/g, "")) || 0;
        // return this.formatIndian(mtsOnRoad);
        // },

        formatMTOExshowroomafterGMA: function (sMTSExshowroom, sMIYExShowroomTotal) {
            const mtsEx = parseFloat(String(sMTSExshowroom || "").replace(/,/g, "")) || 0;
            const miyEx = parseFloat(String(sMIYExShowroomTotal || "").replace(/,/g, "")) || 0;
            return this.formatIndian(mtsEx + miyEx);
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
            // if (sSelectedMto === "GeM" && oVM.getProperty("/colGrp/GEM")) aActiveGroups.push("GEM");
            if (sSelectedMto === "GEM" && oVM.getProperty("/colGrp/GEM")) aActiveGroups.push("GEM");
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

        onRowValueChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oCtx = oInput.getBindingContext("vm");
            if (!oCtx) return;

            const oVM = this.getView().getModel("vm");
            const sPath = oInput.getBinding("value").getPath();
            const sNewVal = oInput.getValue().trim();
            const oRow = oCtx.getObject();

            const sOtherPath = sPath === "InputExShowroom" ? "InputNsp" : "InputExShowroom";
            const sOtherVal = this._stripCommas(String(oRow[sOtherPath] || ""));

            if (sNewVal !== "" && sOtherVal !== "") {
                oInput.setValueState("Error");
                oInput.setValueStateText(
                    sPath === "InputExShowroom"
                        ? "Ex-Showroom cannot be entered when NSP already has a value. Please clear NSP first."
                        : "NSP cannot be entered when Ex-Showroom already has a value. Please clear Ex-Showroom first."
                );
                oInput.setValue(oRow[sPath] || "");
                return;
            }

            oInput.setValueState("None");

            oVM.setProperty(oCtx.getPath() + "/" + sPath, sNewVal);

            // Lock the other field when one is filled; unlock when cleared
            if (sPath === "InputExShowroom") {
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", true);
            } else {
                oVM.setProperty(oCtx.getPath() + "/InputExShowroomEnabled", !sNewVal);
                oVM.setProperty(oCtx.getPath() + "/InputNspEnabled", true);
            }

            const sExVal = sPath === "InputExShowroom" ? sNewVal : (oRow.InputExShowroom || "").trim();
            const sNspVal = sPath === "InputNsp" ? sNewVal : (oRow.InputNsp || "").trim();
            const bChanged = sExVal !== String(oRow._origInputExShowroom ?? "") ||
                sNspVal !== String(oRow._origInputNsp ?? "");
            oVM.setProperty(oCtx.getPath() + "/isChanged", bChanged);

            // Update Process Calculation button
            this._updateProcessCalcBtn();
        },

        // onTableSelectionChange: function (oEvent) {

        //     const oVM = this.getView().getModel("vm");

        //     const bIsSelectAll = oEvent.getParameter("selectAll") !== undefined;

        //     // console.log(bIsSelectAll);

        //     const bSelectAll = oEvent.getParameter("selectAll");

        //     if (bIsSelectAll) {

        //         // console.log("inside select All");

        //         // ── Select All: must replace full array (no way around it) ──
        //         const aData = oVM.getProperty("/tableData") || [];
        //         const aUpdated = aData.map(oRow => ({ ...oRow, _selected: bSelectAll }));
        //         oVM.setProperty("/tableData", aUpdated);

        //         const oTable = this.byId("idvechileTable");
        //         bSelectAll ? oTable.selectAll() : oTable.removeSelections(true);

        //     } else {

        //         // console.log("single select");

        //         // ── Single row: surgical path update — NO full array replace ──
        //         const oListItem = oEvent.getParameter("listItem");
        //         const bSelected = oEvent.getParameter("selected");

        //         if (oListItem) {
        //             const oCtx = oListItem.getBindingContext("vm");
        //             if (oCtx) {
        //                 // This updates ONLY this one property — zero re-render of other rows
        //                 oVM.setProperty(oCtx.getPath() + "/_selected", bSelected);
        //             }
        //         }
        //     }

        //     this._updateProcessCalcBtn();
        //     this._updateActionButtons();
        // },

        //Changes done in 27/07

        onTableSelectionChange: function (oEvent) {
            const oVM = this.getView().getModel("vm");
            const oTable = this.byId("idvechileTable");

            // Single source of truth: read what the table itself currently has selected,
            // instead of trying to infer it from event parameters.
            const aSelectedItems = oTable.getSelectedItems();
            const aSelectedPaths = new Set(
                aSelectedItems
                    .map(oItem => oItem.getBindingContext("vm"))
                    .filter(Boolean)
                    .map(oCtx => oCtx.getPath())
            );

            const aData = oVM.getProperty("/tableData") || [];
            const aUpdated = aData.map((oRow, i) => ({
                ...oRow,
                _selected: aSelectedPaths.has("/tableData/" + i)
            }));

            oVM.setProperty("/tableData", aUpdated);

            this._updateProcessCalcBtn();
            this._updateActionButtons();
        },
        onTableUpdateFinished: function () {
            // const oTable = this.byId("idvechileTable");

            // const aToSelect = [];
            // const aToDeselect = [];

            // oTable.getItems().forEach(oItem => {
            //     const oCtx = oItem.getBindingContext("vm");
            //     if (!oCtx) return;
            //     const bShouldBeSelected = !!oCtx.getObject()._selected;
            //     if (bShouldBeSelected && !oItem.isSelected()) {
            //         aToSelect.push(oItem);
            //     } else if (!bShouldBeSelected && oItem.isSelected()) {
            //         aToDeselect.push(oItem);
            //     }
            // });

            // aToSelect.forEach(oItem => oItem.setSelected(true));
            // aToDeselect.forEach(oItem => oItem.setSelected(false));
        },
        _updateProcessCalcBtn: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            const bCanCalc = aData.some(r => {
                if (!r._selected) return false;
                const sEx = this._stripCommas(String(r.InputExShowroom || ""));
                const sNsp = this._stripCommas(String(r.InputNsp || ""));
                return (sEx !== "" && sNsp === "") || (sEx === "" && sNsp !== "");
            });

            const oBtn = this.byId("processcalculation");
            if (oBtn) oBtn.setEnabled(bCanCalc);
        },

        // _updateActionButtons: function () {
        //     const oVM = this.getView().getModel("vm");
        //     const aData = oVM.getProperty("/tableData") || [];

        //     let bAnySelected = false;
        //     let bEnableActions = false;

        //     for (const r of aData) {
        //         if (!r._selected) continue;
        //         bAnySelected = true;
        //         if (r.isCalculated === true || r.rowStatus === "DRAFT" || r.rowStatus === "APPROVED") {
        //             bEnableActions = true;
        //         }
        //         if (bAnySelected && bEnableActions) break; // early exit
        //     }

        //     oVM.setProperty("/enableSaveActions", bAnySelected);

        //     const oSaveBtn = this.byId("saveBtn");
        //     const oSubmit = this.byId("submitBtn");
        //     const oApplyBtn = this.byId("applyOtherRegionsBtn");

        //     if (oSaveBtn) oSaveBtn.setEnabled(bEnableActions);
        //     if (oSubmit) oSubmit.setEnabled(bEnableActions);
        //     if (oApplyBtn) oApplyBtn.setEnabled(bEnableActions);
        // },

        //new change

        _updateActionButtons: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const bAllowed = oVM.getProperty("/enableButtons") === true;   // false for APPROVER1/2

            let bAnySelected = false;
            let bEnableActions = false;

            for (const r of aData) {
                if (!r._selected) continue;
                bAnySelected = true;
                if (r.isCalculated === true || r.rowStatus === "DRAFT" || r.rowStatus === "APPROVED") {
                    bEnableActions = true;
                }
                if (bAnySelected && bEnableActions) break;
            }

            // Delete / Clear / Edit: unchanged, not role-restricted
            oVM.setProperty("/enableSaveActions", bAnySelected);

            const oSaveBtn = this.byId("saveBtn");
            const oSubmit = this.byId("submitBtn");
            const oApplyBtn = this.byId("applyOtherRegionsBtn");

            // Save / Submit: restricted for approvers
            if (oSaveBtn) oSaveBtn.setEnabled(bEnableActions && bAllowed);
            if (oSubmit) oSubmit.setEnabled(bEnableActions && bAllowed);

            // Apply to Other Regions: not restricted
            if (oApplyBtn) oApplyBtn.setEnabled(bEnableActions);
        },

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
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            const aSelectedRows = aData.filter(r => r._selected);

            if (!aSelectedRows.length) {
                MessageBox.warning("Please select at least one row.");
                return;
            }

            const aValid = [];
            const aConflict = [];
            const aEmpty = [];

            aSelectedRows.forEach(oRow => {
                const sEx = this._stripCommas(String(oRow.InputExShowroom || ""));
                const sNsp = this._stripCommas(String(oRow.InputNsp || ""));
                if (sEx && sNsp) aConflict.push(`${oRow.Model} / ${oRow.Region}`);
                else if (!sEx && !sNsp) aEmpty.push(`${oRow.Model} / ${oRow.Region}`);
                else aValid.push(oRow);
            });

            if (aConflict.length) {
                MessageBox.error(
                    "Rows with both Ex-Showroom and NSP filled:\n" + aConflict.join("\n")
                );
                return;
            }
            if (!aValid.length) {
                MessageBox.warning("No rows with a value to calculate.");
                return;
            }

            const BATCH = 3;
            const total = aValid.length;
            let done = 0;
            if (!this._oProgressDialog) {
                this._oProgressDialog = new sap.m.Dialog({
                    title: "Process Calculation",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({
                                    id: this.createId("progText"),
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
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ]
                });
                this.getView().addDependent(this._oProgressDialog);
            }

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
                let aTableData = JSON.parse(JSON.stringify(oVM.getProperty("/tableData") || []));
                const aFailed = [];

                // ── Group by region, then batch ──────────────────────────
                const mByRegion = aValid.reduce((acc, oRow) => {
                    const r = oRow.Region;
                    if (!acc[r]) acc[r] = [];
                    acc[r].push({
                        ModelCode: oRow.ModelCode || oRow.Model,
                        nspValue: oRow.InputExShowroom
                            ? ""
                            : this._stripCommas(oRow.InputNsp),
                        exshowroomPrice: oRow.InputExShowroom
                            ? this._stripCommas(oRow.InputExShowroom)
                            : ""
                    });
                    return acc;
                }, {});

                for (const sRegion of Object.keys(mByRegion)) {
                    const aRegionRows = mByRegion[sRegion];

                    for (let i = 0; i < aRegionRows.length; i += BATCH) {
                        const aBatch = aRegionRows.slice(i, i + BATCH);

                        let aBatchResults = [];
                        try {
                            aBatchResults = await this._callProcessCalculationBatch(aBatch, sRegion);
                        } catch (oErr) {
                            aBatch.forEach(r => aFailed.push({
                                Model: r.ModelCode, Region: sRegion,
                                error: oErr.message || "Batch failed"
                            }));
                            done += aBatch.length;
                            updateProgress(done);
                            continue;
                        }

                        // ── Merge results ────────────────────────────────
                        aBatchResults.forEach(r => {
                            if (r.error) { aFailed.push(r); return; }

                            const sModel = String(r.Model || r.ModelCode || "").trim();
                            const sReg = String(r.Region || "").trim();
                            const iIndex = aTableData.findIndex(row =>
                                String(row.ModelCode || row.Model).trim() === sModel &&
                                String(row.Region).trim() === sReg
                            );
                            if (iIndex < 0) return;

                            const oRow = aTableData[iIndex];

                            aTableData[iIndex] = {
                                ...oRow,
                                isCalculated: true,
                                isChanged: false,
                                //chagnes done
                                Ort01: oRow.Ort01 || this._getRegionName(oRow.Region),

                                // ── Input ──
                                InputExShowroom: r.InputExShowroom
                                    ? this.formatIndian(r.InputExShowroom)
                                    : oRow.InputExShowroom,
                                InputNsp: r.InputNsp != null
                                    ? this.formatIndian(r.InputNsp)
                                    : (r.InputNSP != null ? this.formatIndian(r.InputNSP) : oRow.InputNsp),
                                _rawInputNsp: r.InputNsp != null
                                    ? String(r.InputNsp).replace(/,/g, "")
                                    : (r.InputNSP != null ? String(r.InputNSP).replace(/,/g, "") : oRow._rawInputNsp),

                                // ── Dealer ──
                                DealerMarginPerc: r.DealerMarginPerc ?? oRow.DealerMarginPerc,
                                ActualNsp: r.ActualNsp ?? oRow.ActualNsp,
                                IncrementalNSP: Math.abs(parseFloat(
                                    r.IncrementalNSP ?? r.IncrementalNsp ?? oRow.IncrementalNSP
                                ) || 0),
                                Helmet: r.Helmet ?? oRow.Helmet,
                                Transportation: r.Transportation ?? oRow.Transportation,
                                DealerCost: r.DealerCost ?? oRow.DealerCost,
                                OtherExpenses: r.OtherExpenses ?? oRow.OtherExpenses,

                                // FIX: BikeMargin is 'BikeMargin' in API response
                                BikeMargin: r.BikeMargin ?? r.DealerMarigin ?? oRow.BikeMargin,
                                IncrementDlr: String(Math.abs(parseFloat(
                                    r.IncrementDlr ?? oRow.IncrementDlr ?? 0
                                ) || 0)),
                                Incremental2: String(Math.abs(parseFloat(
                                    r.IncrementDlr ?? oRow.IncrementDlr ?? 0
                                ) || 0)),

                                // FIX: ActualDealerMargin = DealerMarigin from API
                                ActualDealerMargin: r.ActualDealerMargin ?? r.DealerMarigin ?? oRow.ActualDealerMargin,

                                // FIX: HelmetMargin = HelmetMarigin from API
                                HelmetMargin: r.HelmetMarigin ?? r.HelmetMargin ?? oRow.HelmetMargin,

                                // FIX: TotalDealerMargin = totalDealerMarigin from API
                                TotalDealerMargin: r.totalDealerMarigin ?? r.TotalDealerMargin ?? oRow.TotalDealerMargin,

                                // ── Pricing ──
                                // FIX: Ndp = NDP from API
                                Ndp: r.NDP ?? r.Ndp ?? oRow.Ndp,
                                Basic: r.Basic ?? oRow.Basic,
                                GSTPerc: r.GSTPerc ?? oRow.GSTPerc,

                                // FIX: Gst (rupee amount) = GSTAfterbasic from API
                                Gst: r.GSTAfterbasic ?? r.Gst ?? oRow.Gst,

                                // FIX: ActualExShowroom = ex_showroomAfterGST from API
                                ActualExShowroom: r.ex_showroomAfterGST ?? r.ActualExShowroom ?? oRow.ActualExShowroom,
                                ExceptionRef: r.ExceptionRef ?? oRow.ExceptionRef,
                                Diff: r.Diff ?? oRow.Diff,
                                ReferenceNum: r.ReferenceNum ?? oRow.ReferenceNum,

                                // ── RTO ──
                                RtoPerc: r.RTO_percentage ?? r.RtoPerc ?? oRow.RtoPerc,
                                Rto: r.RTO ?? r.Rto ?? oRow.Rto,
                                RtoWithBill: r.RTO_bill ?? r.RtoWithBill ?? oRow.RtoWithBill,

                                // ── Insurance ──
                                insuranceperc: r.insuranceperc ?? oRow.insuranceperc,
                                InsuranceLe350: r.InsuranceLe350 ?? oRow.InsuranceLe350,
                                InsuranceGt350: r.InsuranceGt350 ?? oRow.InsuranceGt350,

                                // FIX: API sends lowercase 'insurance'
                                Insurance: r.insurance ?? r.Insurance ?? oRow.Insurance,

                                // FIX: API sends 'TPA_PA'
                                TpaPa: r.TPA_PA ?? r.TpaPa ?? oRow.TpaPa,

                                // FIX: API sends 'GST_afterTPA'
                                ActualGst: r.GST_afterTPA ?? r.ActualGst ?? oRow.ActualGst,

                                TotalInsurance: r.TotalInsurance ?? oRow.TotalInsurance,

                                // ── On Road ──
                                OnRoad: r.OnRoadPrice ?? r.OnRoad ?? oRow.OnRoad,
                                MTOOnRoad: (() => {
                                    const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                                    return s(r.RTO ?? r.Rto ?? oRow.Rto)
                                        + s(r.RTO_bill ?? r.RtoWithBill ?? oRow.RtoWithBill)
                                        + s(r.ex_showroomAfterGST ?? r.ActualExShowroom ?? oRow.ActualExShowroom)
                                        + s(r.TotalInsurance ?? oRow.TotalInsurance);
                                })(),

                                // ── MTO specific ──
                                ReferMtsModel: r.ReferModel ?? oRow.ReferMtsModel,
                                MtoNsp: r.MTO_NSP ?? oRow.MtoNsp,
                                // MTSExshowroom: r.MTSExshowroom ?? oRow.MTSExshowroom,
                                MIYExShowroomTotal: r.MiyExShowroomTotal ?? oRow.MIYExShowroomTotal ?? 0,
                                MIYOnRoadTotal: r.MiyOnRoadTotal ?? oRow.MIYOnRoadTotal ?? 0,
                                MTOExshowroomafterGMA: r.MTOExshowroomafterGMA ?? oRow.MTOExshowroomafterGMA,
                                ExpectedOnRoad: r.ExpectedOnRoad ?? oRow.ExpectedOnRoad,

                                MTSExshowroom: r.MTSExshowroom ?? oRow.MTSExshowroom,
                                MTSOnRoad: r.MTSOnRoad ?? oRow.MTSOnRoad,
                                // MTSOnRoad: (() => {
                                //     const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                                //     return s(r.MTSExshowroom ?? oRow.MTSExshowroom) +
                                //         s(r.RTO ?? r.Rto ?? oRow.Rto) +
                                //         s(r.RTO_bill ?? r.RtoWithBill ?? oRow.RtoWithBill) +
                                //         s(r.TotalInsurance ?? oRow.TotalInsurance);
                                // })(),

                                // ── Preserve ──
                                Basis: r.Basis ?? oRow.Basis,
                                _origInputExShowroom: oRow._origInputExShowroom,
                                _origInputNsp: oRow._origInputNsp,
                                _selected: oRow._selected || false
                            };
                        });

                        done += aBatch.length;
                        updateProgress(done);
                        oVM.setProperty("/tableData", aTableData);
                    }
                }

                const aSnap = JSON.parse(
                    JSON.stringify(oVM.getProperty("/_allProcessedTableData") || [])
                );
                aTableData.forEach(oRow => {
                    if (!oRow.isCalculated) return;
                    const iIdx = aSnap.findIndex(
                        s => s.ModelCode === oRow.ModelCode && s.Region === oRow.Region
                    );
                    iIdx >= 0
                        ? (aSnap[iIdx] = JSON.parse(JSON.stringify(oRow)))
                        : aSnap.push(JSON.parse(JSON.stringify(oRow)));
                });
                oVM.setProperty("/_allProcessedTableData", aSnap);
                this._buildProcessedFilters();
                this._updateActionButtons();
                this._oProgressDialog.close();

                if (aFailed.length) {
                    MessageBox.warning(
                        `Completed with ${aFailed.length} failure(s):\n` +
                        aFailed.slice(0, 10)
                            .map(r => `• ${r.Model} / ${r.Region}: ${r.error}`)
                            .join("\n") +
                        (aFailed.length > 10 ? `\n…and ${aFailed.length - 10} more` : ""),
                        { title: "Partial Completion" }
                    );
                } else {
                    MessageBox.success(
                        `Process Calculation completed for ${total} row(s).`
                    );
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

            // Lazily initialise the applied-regions tracker
            if (!this._oAppliedRegions) {
                this._oAppliedRegions = new Set();
            }

            // ── Collect regions that already have draft/approved data ──
            const aAllProcessedData = oVM.getProperty("/_allProcessedTableData") || [];
            const aDraftOrApprovedRegions = new Set(
                aAllProcessedData
                    .filter(oRow =>
                        oRow.rowStatus === "DRAFT" ||
                        oRow.rowStatus === "APPROVED"
                    )
                    .map(oRow => oRow.Region)
            );

            // De-duplicate by Region key, exclude the source region
            const mMap = {};
            aRegions.forEach(o => {
                if (o.Region !== sSelected) {
                    mMap[o.Region] = {
                        Region: o.Region,
                        Ort01: o.Ort01,
                        // Disable if: already applied in this session OR has draft/approved data
                        _enabled: !this._oAppliedRegions.has(o.Region) &&
                            !aDraftOrApprovedRegions.has(o.Region)
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
        // onRegionSelectionChange: function (oEvent) {
        //     const oMCB = oEvent.getSource();
        //     const aSelectedKeys = oMCB.getSelectedKeys();
        //     const MAX = 5;

        //     // Show / hide the limit warning strip
        //     const oStrip = this.byId("regionLimitStrip");

        //     if (aSelectedKeys.length > MAX) {
        //         // Drop the item that just pushed it over the limit
        //         // (it is always the last one added — the changedItem from the event)
        //         const oChangedItem = oEvent.getParameter("changedItem");
        //         if (oChangedItem) {
        //             const aFixed = aSelectedKeys.filter(k => k !== oChangedItem.getKey());
        //             oMCB.setSelectedKeys(aFixed);
        //         } else {
        //             // Fallback: trim to first MAX
        //             oMCB.setSelectedKeys(aSelectedKeys.slice(0, MAX));
        //         }

        //         if (oStrip) oStrip.setVisible(true);
        //     } else {
        //         if (oStrip) oStrip.setVisible(aSelectedKeys.length === MAX);
        //     }
        // },

        onRegionSelectionChange: function (oEvent) {
            // No cap — just hide the strip always
            const oStrip = this.byId("regionLimitStrip");
            if (oStrip) oStrip.setVisible(false);
        },


        // ══════════════════════════════════════════════════════════════════════════════
        //  onConfirmApplyOtherRegions
        //  Same chunked logic as before, but:
        //  On full success the processed region codes are added to
        //    this._oAppliedRegions so they appear disabled next time.
        // ══════════════════════════════════════════════════════════════════════════════

        //         onConfirmApplyOtherRegions: async function () {
        //     this._oApplyOtherRegionsDialog.setBusy(true);

        //     try {
        //         const aRegionCodes = this.byId("otherRegionsMCB").getSelectedKeys();
        //         if (!aRegionCodes.length) {
        //             MessageToast.show("Please select at least one region");
        //             return;
        //         }

        //         if (aRegionCodes.length > 5) {
        //             MessageToast.show("Please select a maximum of 5 regions at a time.");
        //             return;
        //         }

        //         const aItems = this._prepareApplyPayload();
        //         if (!aItems.length) {
        //             MessageToast.show("No data available");
        //             return;
        //         }

        //                  const REGION_CHUNK = 3;
        //                  const ITEM_CHUNK = 100;

        //         // ── Build all chunk combinations upfront so we know the total ──
        //         const aRegionChunks = [];
        //         for (let i = 0; i < aRegionCodes.length; i += REGION_CHUNK) {
        //             aRegionChunks.push(aRegionCodes.slice(i, i + REGION_CHUNK));
        //         }

        //         const aItemChunks = [];
        //         for (let i = 0; i < aItems.length; i += ITEM_CHUNK) {
        //             aItemChunks.push(aItems.slice(i, i + ITEM_CHUNK));
        //         }

        //         // Total calls = region-chunks × item-chunks
        //         // Each call processes (items-in-chunk × regions-in-chunk) rows
        //         const totalCalls = aRegionChunks.length * aItemChunks.length;
        //         let   doneCalls  = 0;

        //         // Estimate total model-region pairs for display
        //         const totalPairs = aRegionCodes.length * aItems.length;
        //         let   donePairs  = 0;

        //         // ── Create progress dialog once ──────────────────────────────
        //         if (!this._oApplyProgressDialog) {
        //             this._oApplyProgressDialog = new sap.m.Dialog({
        //                 title: "Applying to Other Regions",
        //                 content: [
        //                     new sap.m.VBox({
        //                         items: [
        //                             new sap.m.Text({
        //                                 id: this.createId("applyProgText"),
        //                                 text: "Starting…",
        //                                 wrapping: true
        //                             }).addStyleClass("sapUiSmallMarginBottom"),
        //                             new sap.m.ProgressIndicator({
        //                                 id: this.createId("applyProgBar"),
        //                                 percentValue: 0,
        //                                 displayValue: "0%",
        //                                 state: "Information",
        //                                 width: "100%"
        //                             })
        //                         ]
        //                     }).addStyleClass("sapUiSmallMargin")
        //                 ]
        //             });
        //             this.getView().addDependent(this._oApplyProgressDialog);
        //         }

        //         // ── Reset and open progress dialog; close the apply dialog ───
        //         this.byId("applyProgBar").setPercentValue(0);
        //         this.byId("applyProgBar").setDisplayValue("0%");
        //         this.byId("applyProgBar").setState("Information");
        //         this.byId("applyProgText").setText(`0 of ${totalPairs} row(s) applying…`);
        //         this._oApplyOtherRegionsDialog.close();    // close selection dialog
        //         this._oApplyProgressDialog.open();          // open progress dialog

        //         const fnUpdateProgress = (iDonePairs) => {
        //             const iPct = Math.round((iDonePairs / totalPairs) * 100);
        //             this.byId("applyProgBar").setPercentValue(iPct);
        //             this.byId("applyProgBar").setDisplayValue(iPct + "%");
        //             this.byId("applyProgText").setText(
        //                 `${iDonePairs} of ${totalPairs} row(s) applying…`
        //             );
        //             if (iPct === 100) {
        //                 this.byId("applyProgBar").setState("Success");
        //             }
        //         };

        //         // ── Execute all chunks ───────────────────────────────────────
        //         const aAllResults = [];

        //         for (let r = 0; r < aRegionChunks.length; r++) {
        //             const aRegionChunk = aRegionChunks[r];

        //             for (let m = 0; m < aItemChunks.length; m++) {
        //                 const aItemChunk = aItemChunks[m];

        //                 try {
        //                     const aChunkResults = await this._callAddToOtherRegion({
        //                         items: aItemChunk,
        //                         regionCodes: aRegionChunk
        //                     });
        //                     aAllResults.push(...aChunkResults);
        //                     await new Promise(res => setTimeout(res, 500));
        //                 } catch (oErr) {
        //                     // Record failures per model-region pair in this chunk
        //                     aItemChunk.forEach(oItem => {
        //                         aRegionChunk.forEach(sReg => {
        //                             aAllResults.push({
        //                                 ModelCode: oItem.ModelCode,
        //                                 regionCode: sReg,
        //                                 success: false,
        //                                 error: oErr.message || "Chunk failed"
        //                             });
        //                         });
        //                     });
        //                 }

        //                 // Update progress: pairs processed = items × regions in this chunk
        //                 donePairs += aItemChunk.length * aRegionChunk.length;
        //                 fnUpdateProgress(Math.min(donePairs, totalPairs));

        //                 // Small breathing room between calls
        //                 await new Promise(res => setTimeout(res, 500));
        //             }
        //         }

        //         this._oApplyProgressDialog.close();

        //         // ── Process results ──────────────────────────────────────────
        //         const aSucceeded = aAllResults.filter(r =>
        //             r.success === true || (!r.error && r.MtoMts)
        //         );
        //         const aFailed  = aAllResults.filter(r =>
        //             r.success === false && !r.error?.includes("Skipped")
        //         );
        //         const aSkipped = aAllResults.filter(r =>
        //             r.error?.includes("Skipped")
        //         );

        //         if (aSucceeded.length) {
        //             this._mergeOtherRegionResults(aSucceeded);
        //         }

        //         // ── Mark successfully-applied regions ────────────────────────
        //         if (!this._oAppliedRegions) {
        //             this._oAppliedRegions = new Set();
        //         }

        //         const aFailedRegions = new Set(
        //             aFailed.map(r => r.regionCode || r.Region).filter(Boolean)
        //         );

        //         aRegionCodes.forEach(sCode => {
        //             if (!aFailedRegions.has(sCode)) {
        //                 this._oAppliedRegions.add(sCode);
        //             }
        //         });

        //         // ── Refresh region list & clear selections ───────────────────
        //         this._prepareOtherRegions();

        //         const oMCB = this.byId("otherRegionsMCB");
        //         if (oMCB) oMCB.setSelectedKeys([]);

        //         const oStrip = this.byId("regionLimitStrip");
        //         if (oStrip) oStrip.setVisible(false);

        //         // ── Show summary ─────────────────────────────────────────────
        //         this._showSummaryDialog(aSucceeded, aFailed, aSkipped);

        //         // Re-open apply dialog only if there were failures/skips
        //         if (aFailed.length || aSkipped.length) {
        //             this._oApplyOtherRegionsDialog.open();
        //         }

        //     } catch (e) {
        //         if (this._oApplyProgressDialog) {
        //             this._oApplyProgressDialog.close();
        //         }
        //         MessageBox.error(e.message || "Failed to apply to other regions");
        //     } finally {
        //         this._oApplyOtherRegionsDialog.setBusy(false);
        //     }
        // },

        onConfirmApplyOtherRegions: async function () {
            this._oApplyOtherRegionsDialog.setBusy(true);

            try {
                const aRegionCodes = this.byId("otherRegionsMCB").getSelectedKeys();
                if (!aRegionCodes.length) {
                    MessageToast.show("Please select at least one region");
                    return;
                }

                // Should never exceed 5 (UI already prevents it, but be safe)
                // if (aRegionCodes.length > 5) {
                //     MessageToast.show("Please select a maximum of 5 regions at a time.");
                //     return;
                // }

                const aItems = this._prepareApplyPayload();
                if (!aItems.length) {
                    MessageToast.show("No data available");
                    return;
                }

                const REGION_CHUNK = 3;
                const ITEM_CHUNK = 500;

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
                            items: aItemChunks[m],
                            regionCodes: aRegionChunks[r]
                        });
                        aAllResults.push(...aChunkResults);

                        await new Promise(res => setTimeout(res, 1000));
                    }
                }

                const aSucceeded = aAllResults.filter(r => r.success === true || (!r.error && r.MtoMts));
                const aFailed = aAllResults.filter(r => r.success === false && !r.error?.includes("Skipped"));
                const aSkipped = aAllResults.filter(r => r.error?.includes("Skipped"));

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

        // ══════════════════════════════════════════════════════════════════════
        //  GROWING TABLE HELPER
        //  Call after every setProperty("/tableData", ...) to reset the
        //  visible window back to the first 200 rows.
        // ══════════════════════════════════════════════════════════════════════

        //changed done

        formatGmaPartsCount: function (aBreakup) {
            return Array.isArray(aBreakup) ? aBreakup.length + " part(s)" : "0 parts";
        },

        onViewGmaBreakup: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("vm");
            if (!oCtx) return;
            const oRow = oCtx.getObject();
            const aBreakup = oRow.MiyBreakup || [];

            if (!aBreakup.length) {
                MessageToast.show("No GMA component breakup available for this row (recalculate to refresh it).");
                return;
            }

            if (!this._oGmaBreakupDialog) {
                this._oGmaBreakupDialog = new sap.m.Dialog({
                    contentWidth: "600px",
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({ id: this.createId("gmaTotalsText"), text: "" })
                                    .addStyleClass("sapUiSmallMarginBottom sapUiSmallMarginBegin"),
                                new sap.m.Table({
                                    growing: true,
                                    columns: [
                                        new sap.m.Column({ header: new sap.m.Text({ text: "Part Code" }) }),
                                        new sap.m.Column({ header: new sap.m.Text({ text: "Part Name" }) }),
                                        new sap.m.Column({ header: new sap.m.Text({ text: "Type" }) }),
                                        new sap.m.Column({ hAlign: "End", header: new sap.m.Text({ text: "Part Value" }) })
                                    ],
                                    items: {
                                        path: "gma>/parts",
                                        template: new sap.m.ColumnListItem({
                                            cells: [
                                                new sap.m.Text({ text: "{gma>PartCode}" }),
                                                new sap.m.Text({ text: "{gma>Description}" }),
                                                new sap.m.ObjectStatus({
                                                    text: "{gma>ExShowOnRoad}",
                                                    state: "{= ${gma>ExShowOnRoad} === 'EX SHOWROOM' ? 'Success' : 'Warning' }"
                                                }),
                                                new sap.m.Text({
                                                    text: { path: "gma>MiyCost", formatter: this.formatIndian.bind(this) },
                                                    textAlign: "End"
                                                })
                                            ]
                                        })
                                    }
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Close",
                        press: function () { this._oGmaBreakupDialog.close(); }.bind(this)
                    })
                });
                this.getView().addDependent(this._oGmaBreakupDialog);
            }

            this._oGmaBreakupDialog.setTitle(`GMA Component Breakup — ${oRow.Model} / ${oRow.Region}`);
            this._oGmaBreakupDialog.setModel(new sap.ui.model.json.JSONModel({ parts: aBreakup }), "gma");

            const sExTotal = this.formatIndian(oRow.MIYExShowroomTotal || 0);
            const sOnRoadTotal = this.formatIndian(oRow.MIYOnRoadTotal || 0);
            sap.ui.core.Fragment.byId
                ? null
                : this._oGmaBreakupDialog.getContent()[0].getItems()[0]
                    .setText(`Ex-Showroom components total: ₹${sExTotal}   |   On-Road components total: ₹${sOnRoadTotal}`);

            this._oGmaBreakupDialog.open();
        },

        //changed done
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
            // const aData = oVM.getProperty("/tableData") || [];

            //new change
            const aData = [...(oVM.getProperty("/tableData") || [])];

            aSucceeded.forEach(r => {
                const bIsMTO = !!r.MtoMts;
                const sModelCode = r.ModelCode || r.Model;
                const sRegionCode = r.regionCode || r.Region;

                const iExisting = aData.findIndex(
                    row => row.ModelCode === sModelCode && row.Region === sRegionCode
                );

                // const oNewRow = {
                //     Model: sModelCode,
                //     ModelCode: sModelCode,
                //     Region: sRegionCode,
                //     Description: r.Description || r.ModelName || this._getModelDescription(sModelCode),

                //     MtoMts: r.MtoMts || "",
                //     Basis: r.Basis || r.BasisRto || "",
                //     //chagnes done
                //     Ort01: this._getRegionName(sRegionCode),

                //     //changed done
                //     MiyBreakup: r.MiyBreakup || [],

                //     ActualExShowroom: bIsMTO ? (r.ActualExShowroom || "") : (r.ex_showroomAfterGST || ""),
                //     InputExShowroom: this.formatIndian(bIsMTO ? (r.ActualExShowroom || "") : (r.InputExShowroom || r.ex_showroomAfterGST || "")),
                //     // InputNsp: this.formatIndian(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")),
                //     // Add this after the InputNsp line in oNewRow:
                //     InputNsp: this.formatIndian(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")),
                //     _rawInputNsp: String(bIsMTO ? (r.ActualNsp || "") : (r.InputNSP || r.CalculatedNSP || "")).replace(/,/g, ""),
                //     OnRoad: bIsMTO ? (r.OnRoad || 0) : (r.OnRoadPrice || 0),

                //     DealerMarginPerc: r.DealerMarginPerc || "",
                //     ActualNsp: bIsMTO ? (r.ActualNsp || "") : (r.CalculatedNSP || ""),
                //     IncrementalNSP: Math.abs(r.IncrementalNsp) || Math.abs(r.IncrementalNSP) || "",
                //     Helmet: r.Helmet || "",
                //     Transportation: r.Transportation || "",
                //     DealerCost: r.DealerCost || "",
                //     OtherExpenses: r.OtherExpenses || "",

                //     // BikeMargin: bIsMTO ? (r.BikeMargin || "") : (r.BikeMarigin || ""),
                //     BikeMargin: bIsMTO ? (r.BikeMargin ?? "") : (r.BikeMarigin ?? ""),
                //     ActualDealerMargin: bIsMTO ? (r.ActualDealerMargin || "") : (r.DealerMarigin || ""),
                //     Incremental2: String(Math.abs(
                //         (parseFloat(bIsMTO ? r.BikeMargin : r.BikeMarigin) || 0) -
                //         (parseFloat(bIsMTO ? r.ActualDealerMargin : r.DealerMarigin) || 0)
                //     )),
                //     // HelmetMargin: bIsMTO ? (r.HelmetMargin || "") : (r.HelmetMarigin || ""),
                //     HelmetMargin: bIsMTO ? (r.HelmetMargin ?? "") : (r.HelmetMarigin ?? ""),
                //     TotalDealerMargin: bIsMTO ? (r.TotalDealerMargin || "") : (r.totalDealerMarigin || ""),

                //     Ndp: r.Ndp || r.NDP || "",
                //     Basic: r.Basic || "",
                //     GSTPerc: r.GstPerc || r.GSTPerc || "",
                //     Gst: r.GSTAfterbasic || r.Gst || "",
                //     RtoPerc: r.RtoPerc || r.RTO_percentage || "",
                //     Rto: r.Rto || r.RTO || "",
                //     RtoWithBill: r.RtoWithBill || String(r.RTO_bill) || "",
                //     insuranceperc: r.insuranceperc || "0",
                //     Insurance: r.Insurance || r.insurance || "",
                //     TpaPa: r.TpaPa || r.TPA_PA || "",
                //     ActualGst: r.ActualGst || r.GST_afterTPA || "",
                //     TotalInsurance: r.TotalInsurance || "",
                //     ExceptionRef: r.ExceptionRef || "E",
                //     ReferenceNum: r.ReferenceNum || "",
                //     ReferMtsModel: r.ReferModel || r.ReferMtsModel || "",

                //     MtoNsp: r.MTO_NSP || "",
                //     MTSExshowroom: r.MTSExshowroom || "",
                //     MTOExshowroomafterGMA: r.MTOExshowroomafterGMA || "",
                //     // MTOOnRoad: r.OnRoad ||r.MTOOnRoad || "",
                //     MTOOnRoad: (() => {
                //         const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                //         return s(r.Rto) + s(r.RtoWithBill) + s(r.ActualExShowroom) + s(r.TotalInsurance);
                //     })(),
                //     // MTSOnRoad: r.MTSOnRoad ?? oRow.MTSOnRoad,
                //     MTSOnRoad: r.MTSOnRoad ?? "",


                //     // MTSOnRoad: (() => {
                //     //     const s = v => parseFloat(String(v || "").replace(/,/g, "")) || 0;
                //     //     const mtsEx = s(r.MTSExshowroom);
                //     //     const rto = s(r.Rto || r.RTO);
                //     //     const rtoWithBill = s(r.RtoWithBill || r.RTO_bill);
                //     //     const totalIns = s(r.TotalInsurance);
                //     //     return mtsEx + rto + rtoWithBill + totalIns;
                //     // })(),

                //     MIYExShowroomTotal: r.MiyExShowroomTotal || 0,
                //     MIYOnRoadTotal: r.MiyOnRoadTotal || 0,

                //     IncrementDlr: Math.abs(r.IncrementDlr) || "0",
                //     ExpectedOnRoad: bIsMTO ? (r.ExpectedOnRoad || "") : (r.OnRoadPrice || ""),
                //     MTSOnRoad: r.MTSOnRoad || r.MTSExshowroom || "",

                //     rowStatus: "NEW",
                //     isCalculated: true,
                //     isChanged: false,
                //     InputExShowroomEnabled: false,
                //     InputNspEnabled: false,
                //     _origInputExShowroom: "",
                //     _origInputNsp: "",

                //     // ADD these inside oNewRow in _mergeOtherRegionResults:
                //     DiscountPerc: r.DiscountPerc ?? "",
                //     DiscountAmount: r.DiscountAmount ?? "",
                //     SubTotal: r.SubTotal ?? "",
                //     GstPerc: r.GstPerc ?? "",
                //     GstAmount: r.GstAmount ?? "",
                //     CessPerc: r.CessPerc ?? "",
                //     CessAmount: r.CessAmount ?? "",
                //     FinalGeMPrice: r.FinalGeMPrice ?? "",

                //     CsdDisPerc: r.CsdDisPerc ?? "",
                //     CSD: r.CSD ?? "",
                //     PreTaxNetDiscount: r.PreTaxNetDiscount ?? "",
                //     CsdGstPerc: r.CsdGstPerc ?? "",
                //     CsdGstAmount: r.CsdGstAmount ?? "",
                //     CsdExShowroom: r.CsdExShowroom ?? "",
                //     IncidentalCharges: r.IncidentalCharges ?? "",
                //     FinalCSDPrice: r.FinalCSDPrice ?? "",


                // };

                const num = v => parseFloat(String(v ?? "").replace(/,/g, "")) || 0;

                const sExShow = bIsMTO
                    ? (r.ActualExShowroom ?? "")
                    : (r.ex_showroomAfterGST ?? "");
                const sNspVal = bIsMTO
                    ? (r.ActualNsp ?? "")
                    : (r.InputNSP ?? r.CalculatedNSP ?? "");

                const oNewRow = {
                    Model: sModelCode,
                    ModelCode: sModelCode,
                    Region: sRegionCode,
                    Description: r.Description || r.ModelName || this._getModelDescription(sModelCode),
                    Ort01: r.Ort01 || r.RegionName || this._getRegionName(sRegionCode),

                    MtoMts: r.MtoMts || "",
                    Basis: r.Basis || r.BasisRto || "",
                    MiyBreakup: r.MiyBreakup || [],

                    // ── Core ──
                    ActualExShowroom: sExShow,
                    InputExShowroom: this.formatIndian(bIsMTO ? sExShow : (r.InputExShowroom ?? sExShow)),
                    InputNsp: this.formatIndian(sNspVal),
                    _rawInputNsp: String(sNspVal).replace(/,/g, ""),
                    OnRoad: bIsMTO ? (r.OnRoad ?? 0) : (r.OnRoadPrice ?? 0),

                    // ── Dealer ──
                    DealerMarginPerc: r.DealerMarginPerc ?? "",
                    ActualNsp: bIsMTO ? (r.ActualNsp ?? "") : (r.CalculatedNSP ?? ""),
                    IncrementalNSP: Math.abs(parseFloat(r.IncrementalNsp ?? r.IncrementalNSP ?? 0)) || 0,
                    Helmet: r.Helmet ?? "",
                    Transportation: r.Transportation ?? "",
                    DealerCost: r.DealerCost ?? "",
                    OtherExpenses: r.OtherExpenses ?? "",

                    BikeMargin: bIsMTO ? (r.BikeMargin ?? "") : (r.BikeMarigin ?? r.BikeMargin ?? ""),
                    ActualDealerMargin: bIsMTO ? (r.ActualDealerMargin ?? "") : (r.DealerMarigin ?? ""),
                    Incremental2: String(Math.abs(
                        (parseFloat(bIsMTO ? r.BikeMargin : (r.BikeMarigin ?? r.BikeMargin)) || 0) -
                        (parseFloat(bIsMTO ? r.ActualDealerMargin : r.DealerMarigin) || 0)
                    )),
                    HelmetMargin: bIsMTO ? (r.HelmetMargin ?? "") : (r.HelmetMarigin ?? ""),
                    TotalDealerMargin: bIsMTO ? (r.TotalDealerMargin ?? "") : (r.totalDealerMarigin ?? ""),

                    // ── Pricing ──
                    Ndp: r.Ndp ?? r.NDP ?? "",
                    Basic: r.Basic ?? "",
                    GSTPerc: r.GstPerc ?? r.GSTPerc ?? "",
                    Gst: r.GSTAfterbasic ?? r.Gst ?? "",

                    // ── RTO ──
                    RtoPerc: r.RtoPerc ?? r.RTO_percentage ?? "",
                    Rto: r.Rto ?? r.RTO ?? "",
                    RtoWithBill: r.RtoWithBill ?? r.RTO_bill ?? "",

                    // ── Insurance ──
                    insuranceperc: r.insuranceperc ?? "0",
                    Insurance: r.Insurance ?? r.insurance ?? "",
                    TpaPa: r.TpaPa ?? r.TPA_PA ?? "",
                    ActualGst: r.ActualGst ?? r.GST_afterTPA ?? "",
                    TotalInsurance: r.TotalInsurance ?? "",

                    ExceptionRef: r.ExceptionRef || "E",
                    ReferenceNum: r.ReferenceNum || "",
                    ReferMtsModel: r.ReferModel || r.ReferMtsModel || "",

                    // ── MTO ──
                    MtoNsp: r.MTO_NSP ?? "",
                    MTSExshowroom: r.MTSExshowroom ?? "",
                    MTOExshowroomafterGMA: r.MTOExshowroomafterGMA ?? "",
                    MTOOnRoad:
                        num(r.Rto ?? r.RTO) +
                        num(r.RtoWithBill ?? r.RTO_bill) +
                        num(sExShow) +
                        num(r.TotalInsurance),
                    MTSOnRoad: r.MTSOnRoad ?? "",
                    MIYExShowroomTotal: r.MiyExShowroomTotal ?? 0,
                    MIYOnRoadTotal: r.MiyOnRoadTotal ?? 0,
                    IncrementDlr: Math.abs(parseFloat(r.IncrementDlr ?? 0)) || "0",
                    ExpectedOnRoad: bIsMTO ? (r.ExpectedOnRoad ?? "") : (r.OnRoadPrice ?? ""),

                    // ── State ──
                    rowStatus: "NEW",
                    isCalculated: true,
                    isChanged: false,
                    InputExShowroomEnabled: false,
                    InputNspEnabled: false,
                    _origInputExShowroom: "",
                    _origInputNsp: "",

                    // ── GeM ──
                    DiscountPerc: r.DiscountPerc ?? "",
                    DiscountAmount: r.DiscountAmount ?? "",
                    SubTotal: r.SubTotal ?? "",
                    GstPerc: r.GstPerc ?? "",
                    GstAmount: r.GstAmount ?? "",
                    CessPerc: r.CessPerc ?? "",
                    CessAmount: r.CessAmount ?? "",
                    FinalGeMPrice: r.FinalGeMPrice ?? "",

                    // ── CSD ──
                    CsdDisPerc: r.CsdDisPerc ?? "",
                    CSD: r.CSD ?? "",
                    PreTaxNetDiscount: r.PreTaxNetDiscount ?? "",
                    CsdGstPerc: r.CsdGstPerc ?? "",
                    CsdGstAmount: r.CsdGstAmount ?? "",
                    CsdExShowroom: r.CsdExShowroom ?? "",
                    IncidentalCharges: r.IncidentalCharges ?? "",
                    FinalCSDPrice: r.FinalCSDPrice ?? ""
                };

                if (iExisting >= 0) {
                    aData[iExisting] = oNewRow;
                } else {
                    aData.push(oNewRow);
                }
            });

            oVM.setProperty("/tableData", [...aData]);

            //new change 

            oVM.setProperty("/tableCount", aData.length);
            oVM.refresh(true);   // force-update bindings that use the formatter

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

            // Rebuild filter dropdowns to include the newly merged regions/models
            this._buildProcessedFilters();
        },
        _showSummaryDialog: function (aSucceeded, aFailed, aSkipped) {
            const INITIAL_SHOW = 4;

            // MTO results use Model/Region, others use ModelCode/regionCode
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

        // _callAddToOtherRegion: async function (oPayload) {
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oVM = this.getView().getModel("vm");
        //     const oAction = oModel.bindContext("/addToOtherRegion(...)");
        //     oAction.setParameter("Mail", oVM.getProperty("/ASMEmail"));
        //     oAction.setParameter("MTOStatus", this.byId("idMtoMtsMCB").getSelectedKey());
        //     oAction.setParameter("items", oPayload.items);
        //     oAction.setParameter("regionCodes", oPayload.regionCodes);
        //     oAction.setParameter("StatusFilter", this.byId("idStatus").getSelectedKey() || "ACTIVE");
        //     oAction.setParameter("EffectiveDate", oVM.getProperty("/valueDP2") || "");
        //     await oAction.execute();
        //     const oContext = oAction.getBoundContext();
        //     const oResult = oContext.getObject();
        //     if (Array.isArray(oResult)) return oResult;
        //     if (Array.isArray(oResult?.value)) return oResult.value;
        //     const aValues = oModel.getObject(oContext.getPath() + "/value");
        //     if (Array.isArray(aValues)) return aValues;
        //     return [];
        // },

        _callAddToOtherRegion: async function (oPayload) {
            const oModel = this.getOwnerComponent().getModel();
            const oVM = this.getView().getModel("vm");

            return new Promise(async (resolve, reject) => {
                try {
                    const oAction = oModel.bindContext("/addToOtherRegion(...)");

                    oAction.setParameter("Mail", oVM.getProperty("/ASMEmail"));
                    oAction.setParameter("MTOStatus", this.byId("idMtoMtsMCB").getSelectedKey());
                    oAction.setParameter("items", oPayload.items);
                    oAction.setParameter("regionCodes", oPayload.regionCodes);
                    oAction.setParameter("StatusFilter", this.byId("idStatus").getSelectedKey() || "ACTIVE");
                    oAction.setParameter("EffectiveDate", oVM.getProperty("/valueDP2") || "");

                    // execute() returns a promise — await it properly
                    await oAction.execute().catch((oErr) => {
                        // OData V4 errors come here
                        const sMsg = oErr?.message
                            || oErr?.error?.message
                            || "Action execution failed";
                        reject(new Error(sMsg));
                    });

                    const oContext = oAction.getBoundContext();
                    if (!oContext) {
                        reject(new Error("No bound context returned"));
                        return;
                    }

                    const oResult = oContext.getObject();

                    if (Array.isArray(oResult)) { resolve(oResult); return; }
                    if (Array.isArray(oResult?.value)) { resolve(oResult.value); return; }

                    const aValues = oModel.getObject(oContext.getPath() + "/value");
                    if (Array.isArray(aValues)) { resolve(aValues); return; }

                    // Don't silently return [] — reject so caller catch fires
                    reject(new Error("Unexpected response format from addToOtherRegion"));

                } catch (e) {
                    reject(e);
                }
            });
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

            // Always read from the accumulated snapshot — NOT from /tableData
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

        //         _buildSaveItems: function (sSaveInd, aRows) {
        //             const aData = Array.isArray(aRows) ? aRows : this.getRowsToSave();
        //             const email = this.getView().getModel("vm").getProperty("/ASMEmail");
        //             const ASMName = this.getView().getModel("vm").getProperty("/ASMName");
        //             const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
        //             const strip = (v) => String(v === null || v === undefined ? "" : v).replace(/,/g, "").trim();

        //             return aData.map(o => {
        //                 const sActualNsp = strip(o.ActualNsp ?? "");
        //                 const sInputNsp = strip(o._rawInputNsp || o.InputNsp || "");
        //                 const sGstAftBasic = strip(o.Gst ?? "");          // rupee GST amount
        //                 const sGstPerc = strip(o.GSTPerc ?? o.GstPerc ?? 0);
        //                 const sMtoNsp = strip(o.MtoNsp ?? o.MTO_NSP ?? "");
        //                 const sMiyExshowroom = strip(o.MIYExShowroomTotal ?? 0);
        //                 const sMiyOnroad = strip(o.MIYOnRoadTotal ?? 0);
        //                 const sMtsExshwroom = strip(o.MTSExshowroom ?? 0);
        //                 const sMtsOnRoad = strip(o.MTSOnRoad ?? 0);
        //                 const sMtoExShwroom = strip(o.MTO_Exshowroom ?? o.ActualExShowroom ?? 0);
        //                 const sMtoOnRoad = strip(o.MTOOnRoad ?? o.OnRoad ?? 0);
        //                 const sMtoExShwAftGma = strip(o.MTOExshowroomafterGMA ?? 0);
        //                 const sExpExshowroom = strip(o.MTOExshowroomafterGMA ?? 0);
        //                 const sExpOnroad = strip(o.ExpectedOnRoad ?? 0);
        //                 const sReferMtsModel = o.ReferMtsModel || o.ReferModel || "";
        //                 const sActualExShowroom = strip(o.ActualExShowroom ?? o.InputExShowroom ?? "");
        //                 const sInputExShowroom = sMtoMts === "MTO"
        //                     ? strip(o.MTSExshowroom ?? o.InputExShowroom ?? "")
        //                     : strip(o.InputExShowroom ?? "");
        //                 const sIncrementalNsp = strip(Math.abs(o.IncrementalNSP ?? o.IncrementalNsp ?? "0"));
        //                 const sReferenceNum = sSaveInd === "X" ? strip(o.ReferenceNum ?? "") : "";

        //                 const oPayload = {
        //                     Mail: email,
        //                     AsmName: ASMName,
        //                     Model: o.Model || o.ModelCode || "",
        //                     OperationNo: 0,
        //                     SaveInd: sSaveInd,
        //                     Region: o.Region || "",
        //                     MtoMts: sMtoMts,
        //                     Basis: o.Basis || "",
        //                     ReferenceNum: sReferenceNum,
        //                     ExceptionRef: o.ExceptionRef || "E",

        //                     //new change 

        //                     ModelName: o.Description || this._getModelDescription(o.Model || o.ModelCode),
        //                     RegionName: o.Ort01 || this._getRegionName(o.Region),
        //                     // MiyBreakup: (o.MiyBreakup || []).slice(0, 20).map(p => ({
        //                     //     PartCode: p.PartCode, Description: p.Description, ExShowOnRoad: p.ExShowOnRoad,
        //                     //     MiyCost: Number(p.MiyCost) || 0, MiyMarkup: Number(p.MiyMarkup) || 0,
        //                     //     PartPrice: Number(p.PartPrice) || 0
        //                     // })),

        //                     ...(sMtoMts.toUpperCase() === "MTO" && {
        //     MiyBreakup: (o.MiyBreakup || []).slice(0, 20).map(p => ({
        //         PartCode: p.PartCode,
        //         Description: p.Description,
        //         ExShowOnRoad: p.ExShowOnRoad,
        //         MiyCost: Number(p.MiyCost) || 0,
        //         MiyMarkup: Number(p.MiyMarkup) || 0,
        //         PartPrice: Number(p.PartPrice) || 0
        //     }))
        // }),

        //                     // ── SAP field names ───────────────────────────────────────────
        //                     GstPerc: this.uiDec(sGstPerc, 3),
        //                     DealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
        //                     DealerMargPerc: String(this.uiDec(strip(o.DealerMarginPerc ?? 0))),  // ← SAP field
        //                     InputNsp: String(this.uiDec(sInputNsp)),
        //                     IncrementalNsp: String(this.uiDec(Math.abs(parseFloat(sIncrementalNsp) || 0))),
        //                     ActualNsp: String(this.uiDec(sActualNsp)),
        //                     Helmet: this.uiInt(strip(o.Helmet)),
        //                     Transportation: this.uiInt(strip(o.Transportation)),
        //                     DealerCost: this.uiInt(strip(o.DealerCost)),
        //                     OtherExpenses: this.uiInt(strip(o.OtherExpenses)),
        //                     BikeMargin: this.uiInt(strip(o.BikeMargin)),
        //                     IncrementDlr: this.uiDec(Math.abs(strip(o.Incremental2 ?? o.IncrementDlr ?? "0"))),
        //                     ActualDealerMargin: String(this.uiDec(strip(o.ActualDealerMargin))),
        //                     HelmetMargin: this.uiInt(strip(o.HelmetMargin)),
        //                     TotalDealerMargin: this.uiInt(strip(o.TotalDealerMargin)),
        //                     Ndp: this.uiInt(strip(o.Ndp)),
        //                     Basic: this.uiInt(strip(o.Basic)),
        //                     Gst: this.uiInt(sGstAftBasic),
        //                     GstAftBasic: this.uiInt(sGstAftBasic),           // ← SAP field (same value)
        //                     InputExShowroom: this.uiInt(sInputExShowroom),
        //                     ActualExShowroom: this.uiInt(sActualExShowroom),
        //                     RtoPerc: String(this.uiDec(strip(o.RtoPerc))),
        //                     Rto: this.uiInt(strip(o.Rto)),
        //                     RtoWithBill: this.uiInt(strip(o.RtoWithBill)),
        //                     InsuranceLe350: String(this.uiDec(strip(o.InsuranceLe350 ?? 0))),
        //                     InsuranceGt350: String(this.uiDec(strip(o.InsuranceGt350 ?? 0))),
        //                     InsurancePerc: String(this.uiDec(strip(o.insuranceperc ?? 0))),      // ← SAP field
        //                     Insurance: this.uiInt(strip(o.Insurance)),
        //                     TpaPa: this.uiInt(strip(o.TpaPa)),
        //                     InsuranceGst: this.uiInt(strip(o.ActualGst)),                        // ← SAP field
        //                     ActualGst: this.uiInt(strip(o.ActualGst)),
        //                     TotalInsurance: this.uiInt(strip(o.TotalInsurance)),
        //                     OnRoad: this.uiInt(strip(o.OnRoad || o.MTOOnRoad || 0)),
        //                     Diff: this.uiInt(strip(o.Diff ?? 0)),

        //                     // ── MTO fields ─────────────────────────────────────────────────
        //                     ReferenceMtsModel: sMtoMts === "MTO" ? sReferMtsModel : "",
        //                     MtoNsp: sMtoMts === "MTO" ? String(this.uiDec(sMtoNsp)) : "0",      // ← SAP: MtoNsp
        //                     MiyExshowroom: sMtoMts === "MTO" ? this.uiInt(sMiyExshowroom) : 0,  // ← SAP: MiyExshowroom
        //                     MiyOnroad: sMtoMts === "MTO" ? this.uiInt(sMiyOnroad) : 0,          // ← SAP: MiyOnroad
        //                     MtsExshwroom: sMtoMts === "MTO" ? this.uiInt(sMtsExshwroom) : 0,    // ← SAP: MtsExshwroom
        //                     MtsOnRoad: sMtoMts === "MTO" ? this.uiInt(sMtsOnRoad) : 0,          // ← SAP: MtsOnRoad
        //                     MtoExShwroom: sMtoMts === "MTO" ? this.uiInt(sMtoExShwroom) : 0,    // ← SAP: MtoExShwroom
        //                     MtoOnRoad: sMtoMts === "MTO" ? this.uiInt(sMtoOnRoad) : 0,          // ← SAP: MtoOnRoad
        //                     MtoExShwAftGma: sMtoMts === "MTO" ? this.uiInt(sMtoExShwAftGma) : 0,// ← SAP: MtoExShwAftGma
        //                     ExpExshowroom: sMtoMts === "MTO" ? this.uiInt(sExpExshowroom) : 0,
        //                     ExpOnroad: sMtoMts === "MTO" ? this.uiInt(sExpOnroad) : 0,
        //                 };

        //                 // GeM fields
        //                 if (sMtoMts === "GeM" || sMtoMts === "GEM") {
        //                     oPayload.DiscPerc = o.DiscountPerc ?? "";
        //                     oPayload.DiscAmount = o.DiscountAmount ?? "";
        //                     oPayload.SubTotal = o.SubTotal ?? "";
        //                     oPayload.GemGstAmount = o.GemGstAmount ?? "";
        //                     oPayload.CessPerc = o.CessPerc ?? "";
        //                     oPayload.CessAmount = o.CessAmount ?? "";
        //                     oPayload.FinalGeMPrice = o.FinalGeMPrice ?? "";
        //                 }

        //                 // CSD fields
        //                 if (sMtoMts === "CSD") {
        //                     oPayload.CsdDisPerc = o.CsdDisPerc ?? "";
        //                     oPayload.CSD = o.CSD ?? "";
        //                     oPayload.PreTaxNetDiscount = o.PreTaxNetDiscount ?? "";
        //                     oPayload.CsdGstPerc = o.CsdGstPerc ?? "";
        //                     oPayload.CsdGstAmount = o.CsdGstAmount ?? "";
        //                     oPayload.CsdExShowroom = o.CsdExShowroom ?? "";
        //                     oPayload.IncidentalCharges = o.IncidentalCharges ?? "";
        //                     oPayload.FinalCSDPrice = o.FinalCSDPrice ?? "";
        //                 }

        //                 // ── New SAP fields (additive; existing GeM/CSD blocks above are untouched) ──
        //                 if (sMtoMts === "GeM" || sMtoMts === "GEM") {
        //                     oPayload.GemGstPerc = o.GemGstPerc ?? "";
        //                     oPayload.GemGstAmount = o.GemGstAmount ?? "";
        //                     oPayload.HelmetCost = o.HelmetCost ?? "";
        //                     oPayload.GemBasic = o.GemBasic ?? "";
        //                     oPayload.MtsExshwroom = this.uiInt(strip(o.MtsExShowroom ?? o.MTSExshowroom ?? 0));
        //                 }
        //                 if (sMtoMts === "CSD") {
        //                     oPayload.CsdNsp = o.CsdNsp ?? "";
        //                     oPayload.BasicPriceWO = o.BasicPriceWO ?? "";   // backend alias -> BasicPriceWo
        //                     oPayload.IncidentalPerc = o.IncidentalPerc ?? "";
        //                     oPayload.CsdOnRoad = o.CsdOnRoad ?? "";   // backend alias -> CsdOnroad
        //                 }

        //                 return oPayload;
        //             });
        //         },

        _buildSaveItems: function (sSaveInd, aRows) {
            const aData = Array.isArray(aRows) ? aRows : this.getRowsToSave();
            const oVM = this.getView().getModel("vm");
            const email = oVM.getProperty("/ASMEmail");
            const ASMName = oVM.getProperty("/ASMName");
            const sMtoMts = this.byId("idMtoMtsMCB").getSelectedKey();
            const sType = String(sMtoMts || "").toUpperCase();
            const strip = (v) => String(v === null || v === undefined ? "" : v).replace(/,/g, "").trim();
            const dec = (v, s) => this.uiDec(strip(v), s);          // default scale 3
            const int = (v) => this.uiInt(strip(v));
            const abs = (v) => Math.abs(parseFloat(strip(v)) || 0);
            const pick = (...a) => a.find(x => x !== undefined && x !== null && x !== "");

            return aData.map(o => {
                const sModel = o.Model || o.ModelCode || "";
                const sGstAmt = pick(o.Gst, "");

                const oPayload = {
                    // ── keys / header ──
                    Mail: email,
                    AsmName: ASMName,
                    Model: sModel,
                    ModelName: o.Description || this._getModelDescription(sModel),
                    Region: o.Region || "",
                    RegionName: o.Ort01 || this._getRegionName(o.Region),
                    OperationNo: 0,
                    SaveInd: sSaveInd,
                    MtoMts: sMtoMts,
                    Basis: o.Basis || "",
                    ReferenceNum: sSaveInd === "X" ? strip(o.ReferenceNum) : "",
                    ExceptionRef: o.ExceptionRef || "E",

                    // ── dealer ──
                    DealerMargPerc: dec(o.DealerMarginPerc),
                    DealerMargin: dec(o.ActualDealerMargin),
                    InputNsp: dec(o._rawInputNsp || o.InputNsp),
                    IncrementalNsp: dec(abs(o.IncrementalNSP ?? o.IncrementalNsp)),
                    ActualNsp: dec(o.ActualNsp),
                    Helmet: int(o.Helmet),
                    Transportation: int(o.Transportation),
                    DealerCost: int(o.DealerCost),
                    OtherExpenses: int(o.OtherExpenses),
                    BikeMargin: int(o.BikeMargin),
                    IncrementDlr: dec(abs(o.Incremental2 ?? o.IncrementDlr)),
                    ActualDealerMargin: dec(o.ActualDealerMargin),
                    HelmetMargin: int(o.HelmetMargin),
                    TotalDealerMargin: int(o.TotalDealerMargin),

                    // ── pricing ──
                    Ndp: int(o.Ndp),
                    Basic: int(o.Basic),
                    GstPerc: dec(o.GSTPerc ?? o.GstPerc),
                    Gst: int(sGstAmt),
                    GstAftBasic: int(sGstAmt),
                    InputExShowroom: int(sType === "MTO" ? (o.MTSExshowroom ?? o.InputExShowroom) : o.InputExShowroom),
                    ActualExShowroom: int(o.ActualExShowroom ?? o.InputExShowroom),

                    // ── RTO ──
                    RtoPerc: dec(o.RtoPerc),
                    Rto: int(o.Rto),
                    RtoWithBill: int(o.RtoWithBill),

                    // ── insurance (Le350 / Gt350 / Insurance / TotalInsurance are scale 6) ──
                    InsuranceLe350: dec(o.InsuranceLe350, 6),
                    InsuranceGt350: dec(o.InsuranceGt350, 6),
                    InsurancePerc: dec(o.insuranceperc),
                    Insurance: int(o.Insurance),
                    TpaPa: int(o.TpaPa),
                    InsuranceGst: int(o.ActualGst),
                    ActualGst: int(o.ActualGst),
                    TotalInsurance: int(o.TotalInsurance),

                    OnRoad: int(o.OnRoad || o.MTOOnRoad),
                    Diff: int(o.Diff ?? 0)
                };

                // ── MTO ──
                if (sType === "MTO") {
                    Object.assign(oPayload, {
                        ReferenceMtsModel: o.ReferMtsModel || o.ReferModel || "",
                        MtoNsp: dec(o.MtoNsp ?? o.MTO_NSP),
                        MtsExshwroom: int(o.MTSExshowroom) || int(o.MtsExshwroom) || int(o.MTSExshowroom),
                        MtsOnRoad: int(o.MTSOnRoad),
                        MtoExShwroom: int(o.MTO_Exshowroom ?? o.ActualExShowroom),
                        MtoOnRoad: int(o.MTOOnRoad ?? o.OnRoad),
                        MtoExShwAftGma: int(o.MTOExshowroomafterGMA),
                        MiyExshowroom: int(o.MIYExShowroomTotal),
                        MiyOnroad: int(o.MIYOnRoadTotal),
                        ExpExshowroom: int(o.MTOExshowroomafterGMA),
                        ExpOnroad: int(o.ExpectedOnRoad),
                        MiyBreakup: (o.MiyBreakup || []).slice(0, 20).map(p => ({
                            PartCode: p.PartCode,
                            Description: p.Description,
                            ExShowOnRoad: p.ExShowOnRoad,
                            MiyCost: Number(p.MiyCost) || 0,
                            MiyMarkup: Number(p.MiyMarkup) || 0,
                            PartPrice: Number(p.PartPrice) || 0
                        }))
                    });
                }

                // ── GeM ──
                if (sType === "GEM") {
                    Object.assign(oPayload, {
                        MtsExshwroom: int(o.MtsExShowroom ?? o.MTSExshowroom),
                        DiscPerc: dec(o.DiscountPerc ?? o.DiscPerc),
                        DiscAmount: dec(o.DiscountAmount ?? o.DiscAmount),
                        SubTotal: dec(o.SubTotal),
                        GemGstPerc: dec(o.GemGstPerc),
                        GemGstAmount: dec(o.GemGstAmount ?? o.GstAmount),
                        HelmetCost: dec(o.HelmetCost),
                        GemBasic: dec(o.GemBasic),
                        FinalGemPrice: dec(o.FinalGeMPrice ?? o.FinalGemPrice)
                    });
                }

                // ── CSD ──
                if (sType === "CSD") {
                    Object.assign(oPayload, {
                        CsdNsp: dec(o.CsdNsp),
                        BasicPriceWo: dec(o.BasicPriceWO ?? o.BasicPriceWo),
                        CsdDiscPerc: dec(o.CsdDisPerc ?? o.CsdDiscPerc),
                        Csd: dec(o.CSD ?? o.Csd),
                        PretaxNetDisc: dec(o.PreTaxNetDiscount ?? o.PretaxNetDisc),
                        CsdGstPerc: dec(o.CsdGstPerc),
                        CsdGstAmount: dec(o.CsdGstAmount),
                        CsdExshwroom: dec(o.CsdExShowroom ?? o.CsdExshwroom),
                        IncidentalPerc: dec(o.IncidentalPerc),
                        IncidentalCharges: dec(o.IncidentalCharges),
                        FinalCsdPrice: dec(o.FinalCSDPrice ?? o.FinalCsdPrice),
                        CsdOnroad: dec(o.CsdOnRoad ?? o.CsdOnroad)
                    });
                }

                return oPayload;
            });
        },

        _partsFromBreakup: function (b) {
            const a = [];
            for (let i = 1; i <= 20; i++) {
                const sCode = String(b["Part" + i] || "").trim();
                if (!sCode) continue;
                a.push({
                    PartCode: sCode, Description: "", ExShowOnRoad: "",
                    MiyCost: 0, MiyMarkup: 0,
                    PartPrice: Number(b["Part" + i + "Price"]) || 0
                });
            }
            return a;
        },

        _prepareSavePayload: function () {
            const aRows = this._getRowsForSaveOrSubmit();
            return this._buildSaveItems("", aRows);
        },

        _prepareSavePayloadForSubmit: function () {
            const aRows = this._getRowsForSaveOrSubmit();
            return this._buildSaveItems("X", aRows);
        },
        _getRowsForSaveOrSubmit: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];

            const aSelected = aData.filter(r => r._selected && r.isCalculated === true);

            // If rows are selected → save only those
            // If nothing selected → fall back to ALL processed rows
            return aSelected.length > 0 ? aSelected : this._getAllProcessedRows();
        },

        // onSave: function () {
        //     const aItems = this._prepareSavePayload();
        //     if (!aItems.length) {
        //         MessageToast.show("No processed rows to save");
        //         return;
        //     }

        //     MessageBox.confirm(
        //         "Do you want to save all processed pricing data? This will save every calculated row.",
        //         {
        //             title: "Confirm Save",
        //             onClose: async (sAction) => {
        //                 if (sAction !== MessageBox.Action.OK) return;

        //                 this._openBusyDialog("Saving", "Saving price breakup for " + aItems.length + " row(s)…");
        //                 try {
        //                     const oAction = this.getOwnerComponent().getModel().bindContext("/saveToModelPriceBreakUp(...)");
        //                     oAction.setParameter("items", aItems);
        //                     await oAction.execute();
        //                     this._closeBusyDialog();
        //                     MessageBox.success("Price breakup saved successfully!\n" + aItems.length + " row(s) saved.", {
        //                         title: "Save Successful",
        //                         actions: [MessageBox.Action.OK],
        //                         emphasizedAction: MessageBox.Action.OK,
        //                         onClose: () => this._resetToFullInitialState()
        //                     });
        //                 } catch (e) {
        //                     this._closeBusyDialog();
        //                     MessageBox.error(e.message || "Failed to save.", { title: "Save Error" });
        //                     console.error(e);
        //                 }
        //             }
        //         }
        //     );
        // },

        // onSubmit: function () {
        //     const aItems = this._prepareSavePayloadForSubmit();
        //     if (!aItems.length) {
        //         MessageToast.show("No processed rows to submit");
        //         return;
        //     }

        //     MessageBox.confirm(
        //         "Do you want to submit all processed pricing data? This will submit every calculated row.",
        //         {
        //             title: "Confirm Submit",
        //             onClose: async (sAction) => {
        //                 if (sAction !== MessageBox.Action.OK) return;

        //                 this._openBusyDialog("Submit", "Submitting price breakup for " + aItems.length + " row(s)…");
        //                 try {
        //                     const oAction = this.getOwnerComponent().getModel().bindContext("/saveToModelPriceBreakUp(...)");
        //                     oAction.setParameter("items", aItems);
        //                     await oAction.execute();
        //                     this._closeBusyDialog();
        //                     MessageBox.success("Price breakup submitted successfully!\n" + aItems.length + " row(s) submitted.", {
        //                         title: "Submit Successful",
        //                         actions: [MessageBox.Action.OK],
        //                         emphasizedAction: MessageBox.Action.OK,
        //                         onClose: () => this._resetToFullInitialState()
        //                     });
        //                 } catch (e) {
        //                     this._closeBusyDialog();
        //                     MessageBox.error(e.message || "Failed to submit.", { title: "Submit Error" });
        //                     console.error(e);
        //                 }
        //             }
        //         }
        //     );
        // },

        onSave: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const bHasSelection = aData.some(r => r._selected);
            const aItems = this._prepareSavePayload();

            if (!aItems.length) {
                MessageToast.show("No processed rows to save");
                return;
            }

            const sScope = bHasSelection
                ? `${aItems.length} selected row(s)`
                : `all ${aItems.length} processed row(s)`;

            MessageBox.confirm(`Do you want to save ${sScope}?`, {
                title: "Confirm Save",
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;
                    await this._executeSaveInChunks(aItems, "Save");
                }
            });
        },


        //Old
        // onSubmit: function () {
        //     const oVM = this.getView().getModel("vm");
        //     const aData = oVM.getProperty("/tableData") || [];
        //     const bHasSelection = aData.some(r => r._selected);
        //     const aItems = this._prepareSavePayloadForSubmit();

        //     if (!aItems.length) {
        //         MessageToast.show("No processed rows to submit");
        //         return;
        //     }

        //     const sScope = bHasSelection
        //         ? `${aItems.length} selected row(s)`
        //         : `all ${aItems.length} processed row(s)`;

        //     MessageBox.confirm(`Do you want to submit ${sScope}?`, {
        //         title: "Confirm Submit",
        //         onClose: async (sAction) => {
        //             if (sAction !== MessageBox.Action.OK) return;
        //             await this._executeSaveInChunks(aItems, "Submit");
        //         }
        //     });
        // },

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

                        try {
                            // STEP 1: Fetch reference number ONCE
                            const sReferenceNum = await this._fetchReferenceNumber();

                            if (!sReferenceNum) {
                                MessageBox.error("Could not retrieve a valid Reference Number. Please try again.", {
                                    title: "Reference Number Error"
                                });
                                return;
                            }

                            // console.log("[Submit] Using Reference Number:", sReferenceNum);

                            // STEP 2: Stamp SAME reference number on ALL items before chunking
                            aItems.forEach(oItem => {
                                oItem.ReferenceNum = sReferenceNum;
                            });

                            // STEP 3: Submit all chunks — each chunk already carries the reference number
                            // await this._executeSaveInChunks(aItems, "Submit");
                            await this._executeSaveInChunks(aItems, "Submit", sReferenceNum);

                        } catch (oError) {
                            MessageBox.error(
                                `Submission failed: ${oError.message || "Unknown error"}`,
                                { title: "Submit Error" }
                            );
                            console.error("onSubmit error:", oError);
                        }
                    }
                }
            );
        },

        _fetchReferenceNumber: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const sServiceUrl = oModel.getServiceUrl().replace(/\/$/, "");
            const sFullUrl = sServiceUrl + "/ReferenceNumSet";

            // console.log("[ReferenceNum] Fetching from:", sFullUrl);

            const oResponse = await fetch(sFullUrl, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            });

            if (!oResponse.ok) {
                let sMessage = `HTTP ${oResponse.status}`;
                try {
                    const oErr = await oResponse.json();
                    sMessage = oErr?.error?.message?.value
                        || oErr?.error?.message
                        || sMessage;
                } catch (e) { /* ignore parse error */ }
                throw new Error(`Failed to fetch reference number: ${sMessage}`);
            }

            const oJson = await oResponse.json();
            // console.log("[ReferenceNum] Raw response:", oJson);

            // Normalize — handle both OData V2 (d.results / d) and V4 (value / direct)
            let sReferenceNum = "";

            if (oJson?.d?.results?.[0]?.Reference) {
                sReferenceNum = oJson.d.results[0].Reference;
            } else if (oJson?.d?.Reference) {
                sReferenceNum = oJson.d.Reference;
            } else if (Array.isArray(oJson?.value) && oJson.value[0]?.Reference) {
                sReferenceNum = oJson.value[0].Reference;
            } else if (oJson?.Reference) {
                sReferenceNum = oJson.Reference;
            }

            if (!sReferenceNum) {
                throw new Error("Reference number not found in ReferenceNumSet response");
            }

            // console.log("[ReferenceNum] Retrieved:", sReferenceNum);
            return sReferenceNum;
        },

        _clearAllSelections: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            aData.forEach((oRow, i) => {
                oVM.setProperty("/tableData/" + i + "/_selected", false);
            });
            const oTable = this.byId("idvechileTable");
            if (oTable) oTable.removeSelections(true);
            oVM.setProperty("/enableSaveActions", false);
        },

        _executeSaveInChunks: async function (aItems, sMode, sReferenceNum) {
            const CHUNK_SIZE = 10000;
            const total = aItems.length;
            const sLabel = sMode === "Submit" ? "Submitting" : "Saving";
            const sTitle = sMode === "Submit" ? "Submitting Data" : "Saving Data";

            // ── Create progress dialog once, reuse afterwards ────────────────
            if (!this._oSaveProgressDialog) {
                this._oSaveProgressDialog = new sap.m.Dialog({
                    title: sTitle,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({
                                    id: this.createId("saveProgText"),
                                    text: "Saving in progress....",
                                    wrapping: true
                                }).addStyleClass("sapUiSmallMarginBottom"),
                                new sap.m.ProgressIndicator({
                                    id: this.createId("saveProgBar"),
                                    percentValue: 0,
                                    displayValue: "0%",
                                    state: "Information",
                                    width: "100%"
                                })
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ]
                });
                this.getView().addDependent(this._oSaveProgressDialog);
            }

            // ── Reset dialog for this run ────────────────────────────────────
            this._oSaveProgressDialog.setTitle(sTitle);
            this.byId("saveProgBar").setPercentValue(0);
            this.byId("saveProgBar").setDisplayValue("0%");
            this.byId("saveProgBar").setState("Information");
            this.byId("saveProgText").setText(`0 of ${total} row(s) ${sLabel.toLowerCase()}…`);
            this._oSaveProgressDialog.open();

            const fnUpdateProgress = (iDone) => {
                const iPct = Math.round((iDone / total) * 100);
                this.byId("saveProgBar").setPercentValue(iPct);
                this.byId("saveProgBar").setDisplayValue(iPct + "%");
                this.byId("saveProgText").setText(`${iDone} of ${total} row(s) ${sLabel.toLowerCase()}…`);
                if (iPct === 100) {
                    this.byId("saveProgBar").setState("Success");
                }
            };

            // ── Build chunks of 500 ──────────────────────────────────────────
            const aChunks = [];
            for (let i = 0; i < aItems.length; i += CHUNK_SIZE) {
                aChunks.push(aItems.slice(i, i + CHUNK_SIZE));
            }

            const aFailed = [];
            let iDone = 0;

            try {


                for (let i = 0; i < aChunks.length; i++) {
                    const aChunk = aChunks[i];

                    try {
                        const oAction = this.getOwnerComponent().getModel()
                            .bindContext("/saveToModelPriceBreakUp(...)");
                        oAction.setParameter("items", aChunk);
                        await oAction.execute();
                    } catch (oErr) {
                        // Record which rows failed but continue with remaining chunks
                        aChunk.forEach(o => aFailed.push({
                            Model: o.Model,
                            Region: o.Region,
                            error: oErr.message || "Failed"
                        }));
                    }

                    iDone += aChunk.length;
                    fnUpdateProgress(iDone);
                }

                this._oSaveProgressDialog.close();

                // if (aFailed.length) {
                //     // Partial failure — report but don't reset the form
                //     MessageBox.warning(
                //         `${sMode} completed with ${aFailed.length} failure(s):\n` +
                //         aFailed.slice(0, 10)
                //             .map(r => `• ${r.Model} / ${r.Region}: ${r.error}`)
                //             .join("\n") +
                //         (aFailed.length > 10
                //             ? `\n…and ${aFailed.length - 10} more`
                //             : ""),
                //         { title: `${sMode} — Partial Failure` }
                //     );
                // } else {
                //     // Full success
                //     MessageBox.success(
                //         `Price breakup ${sMode.toLowerCase()}ted successfully!\n${total} row(s) processed.`,
                //         {
                //             title: `${sMode} Successful`,
                //             actions: [MessageBox.Action.OK],
                //             emphasizedAction: MessageBox.Action.OK,
                //             onClose: () => this._resetToFullInitialState()
                //         }
                //     );
                // }

                if (aFailed.length) {
                    const sRefLine = (sMode === "Submit" && sReferenceNum)
                        ? `Reference Number: ${sReferenceNum}\n\n`
                        : "";

                    MessageBox.warning(
                        sRefLine +
                        `${sMode} completed with ${aFailed.length} failure(s):\n` +
                        aFailed.slice(0, 10)
                            .map(r => `• ${r.Model} / ${r.Region}: ${r.error}`)
                            .join("\n") +
                        (aFailed.length > 10 ? `\n…and ${aFailed.length - 10} more` : ""),
                        { title: `${sMode} — Partial Failure` }
                    );
                } else {
                    let sMessage;
                    let sTitle;

                    if (sMode === "Submit") {
                        // Submitted → reference number exists
                        sTitle = "Submit Successful";
                        sMessage =
                            `Price breakup submitted successfully!\n\n` +
                            `Reference Number: ${sReferenceNum}\n` +
                            `${total} row(s) processed.`;
                    } else {
                        // Saved → no reference number, so it is a Draft
                        sTitle = "Saved as Draft";
                        sMessage =
                            `Price breakup saved as Draft.\n` +
                            `(No reference number is generated until it is submitted.)\n\n` +
                            `${total} row(s) processed.`;
                    }

                    MessageBox.success(sMessage, {
                        title: sTitle,
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: () => this._resetToFullInitialState()
                    });
                }

            } catch (e) {
                this._oSaveProgressDialog.close();
                MessageBox.error(e.message || `Failed to ${sMode.toLowerCase()}.`, {
                    title: `${sMode} Error`
                });
                console.error(e);
            }
        },

        // ══════════════════════════════════════════════════════════════════════
        //  RESET
        // ══════════════════════════════════════════════════════════════════════
        _resetToInitialState: function () {
            const oVM = this.getView().getModel("vm");

            //27/07 - clear checkbox selection

            // ── Clear actual table selection state (checkboxes) ──
            const oTable = this.byId("idvechileTable");
            if (oTable) {
                oTable.removeSelections(true);
            }
            // ── Clear _selected flags in the model ──


            oVM.setProperty("/tableData", []);
            oVM.setProperty("/_allTableData", []);

            // ── ADD: Clear processed snapshot and filters ─────────────────
            oVM.setProperty("/_allProcessedTableData", []);
            oVM.setProperty("/processedRegions", []);
            oVM.setProperty("/processedModels", []);
            oVM.setProperty("/showProcessedFilters", false);

            // ── ADD: Clear processed filter dropdown selections ──────────
            const oProcessedRegionFilter = this.byId("idProcessedRegionFilter");
            const oProcessedModelFilter = this.byId("idProcessedModelFilter");
            if (oProcessedRegionFilter) oProcessedRegionFilter.setSelectedKeys([]);
            if (oProcessedModelFilter) oProcessedModelFilter.setSelectedKeys([]);

            // ── ADD: Reset applied regions tracker ───────────────────────
            if (this._oAppliedRegions) {
                this._oAppliedRegions.clear();
            }

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

            // ── ADD: Clear processed snapshot and filters ─────────────────
            oVM.setProperty("/_allProcessedTableData", []);
            oVM.setProperty("/processedRegions", []);
            oVM.setProperty("/processedModels", []);
            oVM.setProperty("/showProcessedFilters", false);

            const oProcessedRegionFilter = this.byId("idProcessedRegionFilter");
            const oProcessedModelFilter = this.byId("idProcessedModelFilter");
            if (oProcessedRegionFilter) oProcessedRegionFilter.setSelectedKeys([]);
            if (oProcessedModelFilter) oProcessedModelFilter.setSelectedKeys([]);

            if (this._oAppliedRegions) {
                this._oAppliedRegions.clear();
            }

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
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const aSelected = aData.filter(r => r._selected);

            if (!aSelected.length) {
                MessageToast.show("Please select at least one row");
                return;
            }

            MessageBox.confirm("Are you sure you want to delete " + aSelected.length + " row(s)?", {
                title: "Confirm Delete",
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    const aRemaining = aData.filter(r => !r._selected);
                    oVM.setProperty("/tableData", aRemaining);
                    oTable.removeSelections(true);
                    oVM.setProperty("/enableSaveActions", false);
                    this._updateProcessCalcBtn();
                    MessageToast.show(aSelected.length + " row(s) deleted");
                }
            });
        },

        onClear: function () {
            const oTable = this.byId("idvechileTable");
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const aSelected = aData.filter(r => r._selected);

            if (!aSelected.length) {
                MessageToast.show("Please select at least one row");
                return;
            }

            MessageBox.confirm(
                "Are you sure you want to clear all data from " + aSelected.length + " selected row(s)?\nThis will reset all calculated fields.",
                {
                    title: "Confirm Clear",
                    onClose: (sAction) => {
                        if (sAction !== MessageBox.Action.OK) return;

                        const aUpdated = aData.map(oRow => {
                            if (!oRow._selected) return oRow;
                            return {
                                Model: oRow.Model,
                                ModelCode: oRow.ModelCode,
                                Region: oRow.Region,
                                Ort01: oRow.Ort01,
                                Basis: oRow.Basis,
                                rowStatus: "NEW",
                                _selected: false,
                                InputExShowroom: "",
                                InputNsp: "",
                                _rawInputNsp: "",
                                _origInputExShowroom: "",
                                _origInputNsp: "",
                                InputExShowroomEnabled: true,
                                InputNspEnabled: true,
                                isChanged: false,
                                isCalculated: false,
                                isReadOnly: false,
                                DealerMarginPerc: "", ActualNsp: "", IncrementalNSP: "",
                                Helmet: "", Transportation: "", DealerCost: "",
                                OtherExpenses: "", BikeMargin: "", ActualDealerMargin: "",
                                HelmetMargin: "", TotalDealerMargin: "",
                                IncrementDlr: "0", Incremental2: "0",
                                Ndp: "", Basic: "", GSTPerc: "", Gst: "",
                                ActualExShowroom: "", MTSExshowroom: "", OnRoad: "",
                                RtoPerc: "", Rto: "", RtoWithBill: "",
                                insuranceperc: "0", Insurance: "", TpaPa: "",
                                ActualGst: "", TotalInsurance: "", ExpectedOnRoad: "",
                                DiscountPerc: "", DiscountAmount: "", SubTotal: "",
                                GstPerc: "", GstAmount: "", CessPerc: "",
                                CessAmount: "", FinalGeMPrice: "",
                                CsdDisPerc: "", CSD: "", PreTaxNetDiscount: "",
                                CsdGstPerc: "", CsdGstAmount: "", CsdExShowroom: "",
                                // IncidentalCharges: "", FinalCSDPrice: "",CsdOnroad: "",
                                IncidentalCharges: "", FinalCSDPrice: "", CsdOnRoad: "",
                                CsdNsp: "", BasicPriceWO: "", IncidentalPerc: "",
                                ReferMtsModel: "", MtoNsp: "", MTOOnRoad: "",
                                MTOExshowroomafterGMA: "", MIYExShowroomTotal: 0,
                                MIYOnRoadTotal: 0, ExceptionRef: "E",
                                ReferenceNum: "", CalculatedNSP: ""
                            };
                        });

                        oVM.setProperty("/tableData", aUpdated);
                        oTable.removeSelections(true);
                        oVM.setProperty("/enableSaveActions", false);
                        oVM.setProperty("/enableEditActions", false);
                        this._updateProcessCalcBtn();
                        this._updateActionButtons();

                        // ── Remove cleared rows from snapshot ──
                        const aClearedKeys = new Set(
                            aSelected.map(r => (r.ModelCode || r.Model) + "|" + r.Region)
                        );
                        const aSnap = (oVM.getProperty("/_allProcessedTableData") || [])
                            .filter(s => !aClearedKeys.has((s.ModelCode || s.Model) + "|" + s.Region));
                        oVM.setProperty("/_allProcessedTableData", aSnap);
                        this._buildProcessedFilters();

                        MessageToast.show(aSelected.length + " row(s) cleared");
                    }
                }
            );
        },

        onEdit: function () {
            const oTable = this.byId("idvechileTable");
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const aSelected = aData.filter(r => r._selected);

            if (!aSelected.length) {
                MessageToast.show("Please select at least one row");
                return;
            }

            const aUpdated = aData.map(oRow => {
                if (!oRow._selected) return oRow;
                return {
                    ...oRow,
                    InputExShowroomEnabled: true,
                    InputNspEnabled: true,
                    isCalculated: false,
                    isChanged: true,
                    _selected: false
                };
            });

            oVM.setProperty("/tableData", aUpdated);
            oTable.removeSelections(true);
            oVM.setProperty("/enableSaveActions", false);
            this._updateProcessCalcBtn();
            MessageToast.show(aSelected.length + " row(s) ready to edit");
        },

        // ══════════════════════════════════════════F════════════════════════════
        //  FIXED: onExcelDownloadAll
        //  Field order matches EXACTLY the column/cell order in the XML view
        // ══════════════════════════════════════════════════════════════════════

        onExcelDownloadAll: function () {
            const oView = this.getView();
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const sMtoMts = oVM.getProperty("/selectedMto");

            this._aExportData = aData;

            const mGroupOrder = {
                "Core": "1", "Dealer": "2", "Pricing": "3", "RTO": "4",
                "Insurance": "5", "GeM": "6", "CSD": "7", "MTO": "8"
            };

            // ── CORE ──────────────────────────────────────────────────────────────────
            const aCoreFields = [
                { key: "Model", label: "Model", group: "Core", selected: true },
                { key: "Region", label: "Region Code", group: "Core", selected: true },
                { key: "Basis", label: "Basis / RTO", group: "Core", selected: true },
                { key: "InputExShowroom", label: "Ex-Showroom", group: "Core", selected: true },
                { key: "InputNsp", label: "NSP Input", group: "Core", selected: true }
            ];

            // ── DEALER ────────────────────────────────────────────────────────────────
            // Matches XML column order exactly:
            // DealerMarginPerc, ActualNsp, IncrementalNSP, [MtoNsp-MTO only],
            // Helmet, Transportation, DealerCost, OtherExpenses,
            // BikeMargin, IncrementDlr, ActualDealerMargin, HelmetMargin, TotalDealerMargin
            const aDealerFields = sMtoMts === "MTO"
                ? [
                    { key: "DealerMarginPerc", label: "Dealer Margin %", group: "Dealer", selected: true },
                    { key: "ActualNsp", label: "MTS NSP", group: "Dealer", selected: true },
                    { key: "IncrementalNSP", label: "Incremental NSP", group: "Dealer", selected: true },
                    { key: "Helmet", label: "Helmet", group: "Dealer", selected: true },
                    { key: "Transportation", label: "Transportation", group: "Dealer", selected: true },
                    { key: "DealerCost", label: "Dealer Cost", group: "Dealer", selected: true },
                    { key: "OtherExpenses", label: "Other Expenses", group: "Dealer", selected: true },
                    { key: "BikeMargin", label: "Bike Margin", group: "Dealer", selected: true },
                    { key: "IncrementDlr", label: "Incremental (DLR)", group: "Dealer", selected: true },
                    { key: "ActualDealerMargin", label: "Dealer Margin", group: "Dealer", selected: true },
                    { key: "HelmetMargin", label: "Helmet Margin", group: "Dealer", selected: true },
                    { key: "TotalDealerMargin", label: "Total Dealer Margin", group: "Dealer", selected: true }
                ]
                : [
                    { key: "DealerMarginPerc", label: "Dealer Margin %", group: "Dealer", selected: false },
                    { key: "ActualNsp", label: "MTS NSP", group: "Dealer", selected: false },
                    { key: "IncrementalNSP", label: "Incremental NSP", group: "Dealer", selected: false },
                    { key: "Helmet", label: "Helmet", group: "Dealer", selected: false },
                    { key: "Transportation", label: "Transportation", group: "Dealer", selected: false },
                    { key: "DealerCost", label: "Dealer Cost", group: "Dealer", selected: false },
                    { key: "OtherExpenses", label: "Other Expenses", group: "Dealer", selected: false },
                    { key: "BikeMargin", label: "Bike Margin", group: "Dealer", selected: false },
                    { key: "IncrementDlr", label: "Incremental (DLR)", group: "Dealer", selected: false },
                    { key: "ActualDealerMargin", label: "Dealer Margin", group: "Dealer", selected: false },
                    { key: "HelmetMargin", label: "Helmet Margin", group: "Dealer", selected: false },
                    { key: "TotalDealerMargin", label: "Total Dealer Margin", group: "Dealer", selected: false }
                ];

            // ── PRICING ───────────────────────────────────────────────────────────────
            // XML columns: NDP, Basic, GST%, GST, Ex-Showroom (ActualExShowroom),
            //              + MTO Ex-showroom (ActualExShowroom again via MTO col), On Road (DEALER-visible)
            const aPricingFields = sMtoMts === "MTO"
                ? [
                    { key: "Ndp", label: "NDP", group: "Pricing", selected: true },
                    { key: "Basic", label: "Basic", group: "Pricing", selected: true },
                    { key: "GSTPerc", label: "GST %", group: "Pricing", selected: true },
                    { key: "Gst", label: "GST", group: "Pricing", selected: true },
                    { key: "ActualExShowroom", label: "Ex-Showroom", group: "Pricing", selected: true },
                    { key: "OnRoad", label: "Final OnRoad", group: "Pricing", selected: true }
                ]
                : [
                    { key: "Ndp", label: "NDP", group: "Pricing", selected: false },
                    { key: "Basic", label: "Basic", group: "Pricing", selected: false },
                    { key: "GSTPerc", label: "GST %", group: "Pricing", selected: false },
                    { key: "Gst", label: "GST", group: "Pricing", selected: false },
                    { key: "ActualExShowroom", label: "Ex-Showroom", group: "Pricing", selected: false },
                    { key: "OnRoad", label: "Final OnRoad", group: "Pricing", selected: false }
                ];

            // ── RTO ───────────────────────────────────────────────────────────────────
            // XML columns: RtoPerc, Rto, RtoWithBill
            const aRtoFields = [
                { key: "RtoPerc", label: "RTO %", group: "RTO", selected: sMtoMts === "MTO" },
                { key: "Rto", label: "RTO", group: "RTO", selected: sMtoMts === "MTO" },
                { key: "RtoWithBill", label: "RTO (With Bill)", group: "RTO", selected: sMtoMts === "MTO" }
            ];

            // ── INSURANCE ─────────────────────────────────────────────────────────────
            // XML columns: insuranceperc, Insurance, TpaPa, ActualGst, TotalInsurance
            const aInsuranceFields = [
                { key: "insuranceperc", label: "Insurance %", group: "Insurance", selected: sMtoMts === "MTO" },
                { key: "Insurance", label: "Insurance", group: "Insurance", selected: sMtoMts === "MTO" },
                { key: "TpaPa", label: "TPA + PA", group: "Insurance", selected: sMtoMts === "MTO" },
                { key: "ActualGst", label: "GST", group: "Insurance", selected: sMtoMts === "MTO" },
                { key: "TotalInsurance", label: "Total Insurance", group: "Insurance", selected: sMtoMts === "MTO" }
            ];

            // ── GeM ───────────────────────────────────────────────────────────────────
            const aGemFields = [
                { key: "DiscountPerc", label: "Discount %", group: "GeM", selected: true },
                { key: "DiscountAmount", label: "Discount Amt", group: "GeM", selected: true },
                { key: "SubTotal", label: "Sub Total", group: "GeM", selected: true },
                { key: "GemGstPerc", label: "GST %", group: "GeM", selected: true },
                { key: "HelmetCost", label: "Helmet Cost", group: "GeM", selected: true },
                { key: "GemBasic", label: "GeM Basic", group: "GeM", selected: true },
                { key: "GemGstAmount", label: "GST Amount", group: "GeM", selected: true },
                { key: "FinalGeMPrice", label: "Final GeM Price", group: "GeM", selected: true }
            ];

            // ── CSD ───────────────────────────────────────────────────────────────────
            const aCsdFields = [
                { key: "CsdDisPerc", label: "CSD Disc %", group: "CSD", selected: false },
                { key: "CSD", label: "CSD Discount", group: "CSD", selected: false },
                { key: "PreTaxNetDiscount", label: "Pre-Tax Net", group: "CSD", selected: false },
                { key: "CsdGstPerc", label: "CSD GST %", group: "CSD", selected: false },
                { key: "CsdGstAmount", label: "CSD GST Amt", group: "CSD", selected: false },
                { key: "CsdExShowroom", label: "CSD Ex-Showroom", group: "CSD", selected: false },
                { key: "IncidentalCharges", label: "Incidental Chg", group: "CSD", selected: false },
                { key: "FinalCSDPrice", label: "Final CSD Price", group: "CSD", selected: false },
                // { key: "CsdOnroad", label: "CSD On-Road", group: "CSD", selected: false }
                { key: "CsdOnRoad", label: "CSD On-Road", group: "CSD", selected: true }
            ];

            // ── MTO EXTRA ─────────────────────────────────────────────────────────────
            // Matches XML MTO column order exactly:
            // ReferMtsModel, MTSExshowroom, MIYExShowroomTotal, MTOExshowroomafterGMA,
            // MTOOnRoad, MIYOnRoadTotal, ExpectedOnRoad
            // Plus MtoNsp from the Dealer section (rendered via MTO column in XML)
            const aMtoFields = sMtoMts === "MTO"
                ? [
                    { key: "MtoNsp", label: "MTO NSP", group: "MTO", selected: true },
                    { key: "ReferMtsModel", label: "Refer MTS Model", group: "MTO", selected: true },
                    { key: "MTSExshowroom", label: "MTS Exshowroom", group: "MTO", selected: true },
                    { key: "MIYExShowroomTotal", label: "MIY Exshowroom", group: "MTO", selected: true },
                    { key: "MTOExshowroomafterGMA", label: "MTO Exshowroom (L1)", group: "MTO", selected: true },
                    { key: "MTOOnRoad", label: "MTO On-Road", group: "MTO", selected: true },
                    { key: "MTSOnRoad", label: "MTO Onroad (L1)", group: "MTO", selected: true },  // ← NEW
                    { key: "MIYOnRoadTotal", label: "GMA (OnRoad)", group: "MTO", selected: true },
                    { key: "ExpectedOnRoad", label: "Expected Onroad", group: "MTO", selected: true }
                ]
                : [];

            // ── Assemble ──────────────────────────────────────────────────────────────
            let aAllFields = [
                ...aCoreFields,
                ...aDealerFields,
                ...aPricingFields,
                ...aRtoFields,
                ...aInsuranceFields
            ];

            if (sMtoMts === "GEM") aAllFields = [...aAllFields, ...aGemFields];
            if (sMtoMts === "CSD") aAllFields = [...aAllFields, ...aCsdFields];
            if (sMtoMts === "MTO") aAllFields = [...aAllFields, ...aMtoFields];

            // ── Filter: only show fields that have at least one non-empty/non-zero value ──
            const aFilteredFields = aAllFields.filter(oField => {
                if (oField.group === "Core") return true;
                // Always include group-specific fields when that mode is active
                if (oField.group === "MTO" && sMtoMts === "MTO") return true;
                // if (oField.group === "GeM" && sMtoMts === "GeM") return true;
                if (oField.group === "GeM" && sMtoMts === "GEM") return true;
                if (oField.group === "CSD" && sMtoMts === "CSD") return true;
                // For other groups (Dealer, Pricing, RTO, Insurance), check if any row has data
                return aData.some(oRow => {
                    const v = oRow[oField.key];
                    return v !== undefined && v !== null &&
                        String(v).trim() !== "" && String(v).trim() !== "0";
                });
            });

            // ── Rebuild picker dialog fresh each time ─────────────────────────────────
            if (this._oFieldPickerDialog) {
                this._oFieldPickerDialog.destroy();
                this._oFieldPickerDialog = null;
            }

            this._oFieldPickerDialog = new sap.m.Dialog({
                title: "Select Fields to Export" + (sMtoMts ? " — " + sMtoMts : ""),
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
                                        "group", false,
                                        function (oCtx) {
                                            const g = oCtx.getProperty("group");
                                            return { key: mGroupOrder[g] || g, text: g };
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
            this._oFieldPickerDialog.setModel(
                new sap.ui.model.json.JSONModel({ fields: aFilteredFields }),
                "dlg"
            );
            this._oFieldPickerDialog.open();
        },

        // ── _exportToExcel — columns in the order the user selected them ──────
        _exportToExcel: function (aData, aSelectedFields) {
            const EdmType = sap.ui.export.EdmType;

            const aNumericKeys = new Set([
                "InputExShowroom", "InputNsp", "ActualExShowroom", "ActualNsp",
                "MTSExshowroom", "MtoNsp", "MTSOnRoad", "Helmet", "Transportation", "DealerCost",
                "OtherExpenses", "BikeMargin", "ActualDealerMargin", "HelmetMargin",
                "TotalDealerMargin", "IncrementalNSP", "IncrementDlr",
                "Ndp", "Basic", "Gst", "GSTPerc", "KeralaGst",
                "Rto", "RtoWithBill", "InsuranceLe350", "InsuranceGt350",
                "Insurance", "TpaPa", "ActualGst", "TotalInsurance",
                "OnRoad", "MIYExShowroomTotal", "MTOExshowroomafterGMA",
                "MIYOnRoadTotal", "ExpectedOnRoad", "MTOOnRoad",
                "DealerMarginPerc", "RtoPerc", "insuranceperc",
                // "DiscountPerc", "DiscountAmount", "SubTotal", "GstPerc", "GstAmount",
                // "CessPerc", "CessAmount", "FinalGeMPrice",

                "DiscountPerc", "DiscountAmount", "SubTotal", "GstPerc", "GstAmount",
                "CessPerc", "CessAmount", "FinalGeMPrice",
                "GemGstPerc", "GemGstAmount", "HelmetCost", "GemBasic",

                "CSD", "PreTaxNetDiscount", "CsdGstPerc", "CsdGstAmount",
                // "CsdExShowroom", "IncidentalCharges", "FinalCSDPrice","CsdOnroad"
                "CsdExShowroom", "IncidentalCharges", "FinalCSDPrice", "CsdOnRoad",
                "CsdNsp", "BasicPriceWO", "IncidentalPerc"
            ]);

            // // console.log("MTSOnRoad sample:", aResults[0]?.MTSOnRoad);


            // ── Handle duplicate keys ─────────────────────────────────────────────────
            const aColumns = [];
            const mKeySeen = {};

            aSelectedFields.forEach(oField => {
                const sBase = oField.key;
                mKeySeen[sBase] = (mKeySeen[sBase] || 0) + 1;
                const sExportKey = mKeySeen[sBase] > 1
                    ? sBase + "__" + mKeySeen[sBase]
                    : sBase;

                aColumns.push({
                    label: oField.label,
                    property: sExportKey,
                    type: aNumericKeys.has(sBase) ? EdmType.Number : EdmType.String,
                    scale: aNumericKeys.has(sBase) ? 2 : undefined
                });

                oField._exportKey = sExportKey;
            });

            // ── Build clean data rows ─────────────────────────────────────────────────
            const aCleanData = aData.map(oRow => {
                const oClean = {};

                aSelectedFields.forEach(oField => {
                    const sSource = oField.key;
                    const sDest = oField._exportKey;
                    let val = oRow[sSource];

                    // if (sSource === "MTSOnRoad") {
                    //     const mtoOnRoad = parseFloat(String(oRow.MTOOnRoad || "").replace(/,/g, "")) || 0;
                    //     const miyOnRoad = parseFloat(String(oRow.MIYOnRoadTotal || "").replace(/,/g, "")) || 0;
                    //     val = mtoOnRoad - miyOnRoad;
                    // }

                    if (sSource === "MTOExshowroomafterGMA") {
                        const mtsExshowroom = parseFloat(String(oRow.MTSExshowroom || "").replace(/,/g, "")) || 0;
                        const miyExShowroomTotal = parseFloat(String(oRow.MIYExShowroomTotal || "").replace(/,/g, "")) || 0;
                        val = mtsExshowroom + miyExShowroomTotal;
                    }
                    // Special case: InputNsp — use raw numeric value if stored
                    if (sSource === "InputNsp") {
                        const rawNsp = oRow._rawInputNsp;
                        if (rawNsp !== undefined && rawNsp !== null && String(rawNsp).trim() !== "") {
                            val = parseFloat(String(rawNsp).replace(/,/g, "")) || "";
                        }
                    }

                    if (aNumericKeys.has(sSource)) {
                        if (val !== undefined && val !== null && String(val).trim() !== "") {
                            const n = Number(String(val).replace(/,/g, ""));
                            oClean[sDest] = isNaN(n) ? "" : n;
                        } else {
                            oClean[sDest] = "";
                        }
                    } else {
                        oClean[sDest] = val !== undefined && val !== null ? String(val) : "";
                    }
                });

                return oClean;
            });

            const now = new Date();
            const uniqueId = now.getFullYear() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0') + "_" +
                now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0') +
                now.getSeconds().toString().padStart(2, '0');

            const oSettings = {
                workbook: { columns: aColumns },
                dataSource: aCleanData,
                fileName: aData.length === 0
                    ? `VehiclePricing_Template_${uniqueId}.xlsx`
                    : `VehiclePricing_Export_${uniqueId}.xlsx`
            };

            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },

        //chagnes done

        _getRegionName: function (sRegionCode) {
            const oVM = this.getView().getModel("vm");
            const aRegions = oVM.getProperty("/regions") || [];
            const oRegion = aRegions.find(r => String(r.Region).trim() === String(sRegionCode).trim());
            return oRegion ? oRegion.Ort01 : "";
        },
    });
});