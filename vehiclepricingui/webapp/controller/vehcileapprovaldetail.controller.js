sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/DatePicker",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/TextArea",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/base/security/encodeXML"

], function (Controller, JSONModel, MessageBox, DatePicker, Dialog, Button, TextArea, VBox, Text, MessageToast, Filter, FilterOperator, Fragment, encodeXML) {
    "use strict";
    const EXPORT_COLUMNS = [
        { label: "Model", field: "Model", type: "string" },
        { label: "Model Name", field: "ModelName", type: "string" }, 
        { label: "Region", field: "Region", type: "string" },
        { label: "Region Name", field: "RegionName", type: "string" },
        { label: "Basis", field: "Basis", type: "string" },
        { label: "MTO/MTS", field: "MtoMts", type: "string" },
        { label: "Input Ex-Showroom", field: "InputExShowroom", type: "number" },
        { label: "Input NSP", field: "InputNsp", type: "number" },
        { label: "Incremental NSP", field: "IncrementalNsp", type: "number" },
        { label: "Actual NSP", field: "ActualNsp", type: "number" },
        { label: "Dealer Margin %", field: "DealerMargin", type: "number" },
        { label: "Increment Dlr Margin", field: "IncrementDlr", type: "number" },
        { label: "Actual Dlr Margin", field: "ActualDealerMargin", type: "number" },
        { label: "Total Dlr Margin", field: "TotalDealerMargin", type: "number" },
        { label: "Helmet", field: "Helmet", type: "number" },
        { label: "Transportation", field: "Transportation", type: "number" },
        { label: "Dealer Cost", field: "DealerCost", type: "number" },
        { label: "Other Expenses", field: "OtherExpenses", type: "number" },
        { label: "Bike Margin", field: "BikeMargin", type: "number" },
        { label: "NDP", field: "Ndp", type: "number" },
        { label: "Basic", field: "Basic", type: "number" },
        { label: "GST (Rs)", field: "Gst", type: "number" },
        { label: "RTO %", field: "RtoPerc", type: "number" },
        { label: "RTO", field: "Rto", type: "number" },
        { label: "RTO (With Bill)", field: "RtoWithBill", type: "number" },
        { label: "Insurance", field: "Insurance", type: "number" },
        { label: "TPA + PA", field: "TpaPa", type: "number" },
        { label: "Total Insurance", field: "TotalInsurance", type: "number" },
        { label: "On Road Price", field: "OnRoad", type: "number" },
        { label: "Reference No", field: "ReferenceNum", type: "string" },
        { label: "Status", field: "Status", type: "string" },
        { label: "Submitted By", field: "CreatedBy", type: "string" },
        { label: "Submitted On", field: "CreatedOn", type: "string" },
        { label: "Status Changed By", field: "StatChangedBy", type: "string" },
        { label: "Status Changed On", field: "StatChangedOn", type: "string" },
        { label: "Comments", field: "Comments", type: "string" },
        // ── MTO fields ──────────────────────────────────────────────────────────
        { label: "MTO NSP", field: "MtoNsp", type: "number" },
        { label: "Refer MTS Model", field: "ReferenceMtsModel", type: "string" },
        { label: "MTS Ex-Showroom", field: "MtsExshwroom", type: "number" },
        { label: "MIY Ex-Showroom", field: "MiyExshowroom", type: "number" },
        { label: "MTO Ex-Showroom", field: "MtoExShwroom", type: "number" },
        { label: "Expected Ex-Showroom", field: "ExpExshowroom", type: "number" },
        { label: "MTO On-Road", field: "MtoOnRoad", type: "number" },
        { label: "MTS On-Road (L1)", field: "MtsOnRoad", type: "number" },
        { label: "MIY On-Road", field: "MiyOnroad", type: "number" },
        { label: "Expected On-Road", field: "ExpOnroad", type: "number" },
        // { label: "Expected On-Road", field: "ExpOnroad", type: "number" },
        // ── CSD fields ──
        { label: "CSD NSP", field: "CsdNsp", type: "number" },
        { label: "Basic Price (W/O)", field: "BasicPriceWo", type: "number" },
        { label: "CSD Disc %", field: "CsdDiscPerc", type: "number" },
        { label: "CSD Discount", field: "Csd", type: "number" },
        { label: "Pre-Tax Net Disc", field: "PretaxNetDisc", type: "number" },
        { label: "CSD GST %", field: "CsdGstPerc", type: "number" },
        { label: "CSD GST Amount", field: "CsdGstAmount", type: "number" },
        { label: "CSD Ex-Showroom", field: "CsdExshwroom", type: "number" },
        { label: "Incidental %", field: "IncidentalPerc", type: "number" },
        { label: "Incidental Charges", field: "IncidentalCharges", type: "number" },
        { label: "Final CSD Price", field: "FinalCsdPrice", type: "number" },
        { label: "CSD On-Road", field: "CsdOnroad", type: "number" },
        // ── GeM fields ──
        { label: "GeM Disc %", field: "DiscPerc", type: "number" },
        { label: "GeM Disc Amount", field: "DiscAmount", type: "number" },
        { label: "Sub Total", field: "SubTotal", type: "number" },
        { label: "GeM GST %", field: "GemGstPerc", type: "number" },
        { label: "Helmet Cost", field: "HelmetCost", type: "number" },
        { label: "GeM Basic", field: "GemBasic", type: "number" },
        { label: "GeM GST Amount", field: "GemGstAmount", type: "number" },
        { label: "Final GeM Price", field: "FinalGemPrice", type: "number" }
    ];

    // MTO-only export columns
    const MTO_ONLY = [
        "MtoNsp", "ReferenceMtsModel", "MtsExshwroom", "MiyExshowroom", "MtoExShwroom",
        "ExpExshowroom", "MtoOnRoad", "MtsOnRoad", "MiyOnroad", "ExpOnroad"
    ];

    const CSD_ONLY = [
        "CsdNsp", "BasicPriceWo", "CsdDiscPerc", "Csd", "PretaxNetDisc", "CsdGstPerc",
        "CsdGstAmount", "CsdExshwroom", "IncidentalPerc", "IncidentalCharges",
        "FinalCsdPrice", "CsdOnroad"
    ];

    const GEM_ONLY = [
        "DiscPerc", "DiscAmount", "SubTotal", "GemGstPerc", "HelmetCost",
        "GemBasic", "GemGstAmount", "FinalGemPrice"
    ];

    // Standard export columns
    const STANDARD = [
        "InputExShowroom", "InputNsp", "IncrementalNsp", "ActualNsp", "DealerMargin",
        "IncrementDlr", "ActualDealerMargin", "TotalDealerMargin", "Helmet", "Transportation",
        "DealerCost", "OtherExpenses", "BikeMargin", "Ndp", "Basic", "Gst", "RtoPerc", "Rto",
        "RtoWithBill", "Insurance", "TpaPa", "TotalInsurance", "OnRoad"
    ];

    return Controller.extend("vehiclepricingui.controller.vehcileapprovaldetail", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("vehcileapprovaldetail")
                .attachPatternMatched(this._onRouteMatched, this);

                                    var oToday = new Date();
    oToday.setHours(0, 0, 0, 0);

    this.getView().setModel(new sap.ui.model.json.JSONModel({
        minDate: oToday
    }), "view");
        },

        // ── Route matched: read from component model, fall back to fetch ──
_onRouteMatched: function (oEvent) {
    const sRef = oEvent.getParameter("arguments").ref;

    if (!sRef) {
        MessageBox.error("Invalid Reference ID");
        return;
    }

    const oComponent = this.getOwnerComponent();
    const oApprovalModel = oComponent.getModel("approval");

    if (!oApprovalModel) {
        this._loadFallback(sRef);
        return;
    }

    const oData = oApprovalModel.getData();

    if (oData.reference !== sRef) {
        this._loadFallback(sRef);
        return;
    }

    const oVM = new JSONModel({
        reference: sRef,
        tableData: oData.tableData || [],
        mail: oData.mail || "",
        userMail: "",
        userName: "",
        submissionStatus: oData.submissionStatus || "",
        createdBy: oData.createdBy || "",
        createdOn: oData.createdOn || null,
        statChangedBy: oData.statChangedBy || "",
        statChangedOn: oData.statChangedOn || null,
        comments: oData.comments || "",

        forceViewOnly: !!oData.readOnly,

        role: "",
        isL1Approver: false,
        isL2Approver: false,
        isSubmitter: false,
        viewOnly: true,          // safe default until the role is known
        canAct: false,
        pendingSAPUpdate: false,
        updateToSap: !!oData.updateToSap,
        revert: !!oData.revert,
        canUpdateSap: false,
        canRevert: false,

        //new change

        canUpdateSap: false,
canRevert: false,
canCheckStatus: false,
postSent: false
    });

    const oView = this.getView();
    oView.setModel(oVM, "vm");
    this._applyTableMode(oVM);

    // spinner until the role (ApproverSet) is resolved
    oView.setBusyIndicatorDelay(0);
    oView.setBusy(true);

    this._loadApproverRole(oVM, oData.approvers)
        .catch(e => {
            console.error("Role load failed:", e);
            MessageBox.error("Could not load approver details. Please go back and try again.");
        })
        .finally(() => oView.setBusy(false));
},

        // Logged-in user's mail (shell, then Component, then local fallback)
        _getUserMail: async function () {
            const oComp = this.getOwnerComponent();
            if (typeof oComp.getUser === "function") {
                return (await oComp.getUser()).mail;
            }
            let sMail = "";
            try {
                if (sap.ushell && sap.ushell.Container) {
                    const oInfo = await Promise.race([
                        sap.ushell.Container.getServiceAsync("UserInfo"),
                        new Promise((_, rej) => setTimeout(() => rej(new Error("UserInfo timeout")), 5000))
                    ]);
                    sMail = oInfo.getEmail() || "";
                }
            } catch (e) { console.warn("Shell user info failed:", e); }
            return sMail || "francisajay.ds@laderatechnology.com"; // local testing only
        },

        // Retry once after 1s, because the first call after a refresh can return 502
        _retry: async function (fn) {
            try {
                return await fn();
            } catch (e) {
                console.warn("First attempt failed, retrying:", e);
                await new Promise(r => setTimeout(r, 1000));
                return await fn();
            }
        },

        // _loadApproverRole: async function (oVM) {
        //     const sMail = await this._getUserMail();
        //     oVM.setProperty("/userMail", sMail);

        //     let sRole = "SUBMITTER";
        //     try {
        //         sRole = await this._retry(() => this._fetchMyRole(sMail));
        //     } catch (e) {
        //         console.warn("Could not load approver role:", e);
        //     }

        //     oVM.setProperty("/role", sRole);
        //     this._applyRoleState(oVM);

        //     console.log("Role state:", {
        //         role: sRole,
        //         status: oVM.getProperty("/submissionStatus"),
        //         forceViewOnly: oVM.getProperty("/forceViewOnly"),
        //         canAct: oVM.getProperty("/canAct"),
        //         isSubmitter: oVM.getProperty("/isSubmitter")
        //     });
        // },

_loadApproverRole: async function (oVM, aCached) {
    const sMail = await this._getUserMail();
    oVM.setProperty("/userMail", sMail);

    // use the list already loaded by the list page; fetch only as a fallback
    let aApprovers = Array.isArray(aCached) ? aCached : [];
    if (!aApprovers.length) {
        try {
            aApprovers = await this._retry(() => this._fetchApprovers());
        } catch (e) {
            console.warn("Could not load approver role:", e);
        }
    }

    const roleOf = m => {
        const o = aApprovers.find(a => (a.Mail || "").toLowerCase() === String(m || "").toLowerCase());
        return String(o?.Role || "").trim().toUpperCase();
    };

    oVM.setProperty("/role", roleOf(sMail) || "SUBMITTER");
    oVM.setProperty("/lastActorRole", roleOf(oVM.getProperty("/statChangedBy")));
    this._applyRoleState(oVM);

    console.log("Role state:", {
        role: oVM.getProperty("/role"),
        status: oVM.getProperty("/submissionStatus"),
        lastActorRole: oVM.getProperty("/lastActorRole"),
        canAct: oVM.getProperty("/canAct")
    });
},

_fetchApprovers: async function () {
    const sBase = this.getOwnerComponent().getModel().getServiceUrl().replace(/\/$/, "");
    const oAbort = new AbortController();
    const iTimer = setTimeout(() => oAbort.abort(), 15000);
    try {
        const r = await fetch(`${sBase}/ApproverSet`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
            cache: "no-store",
            signal: oAbort.signal
        });
        if (!r.ok) { throw new Error(`ApproverSet: HTTP ${r.status}`); }
        const oJson = await r.json();
        return Array.isArray(oJson.value) ? oJson.value : [];
    } finally {
        clearTimeout(iTimer);
    }
},
        // Reads ApproverSet fresh (no cache) and returns APPROVER1 | APPROVER2 | SUBMITTER
        // _fetchMyRole: async function (sMail) {
        //     const sBase = this.getOwnerComponent().getModel().getServiceUrl().replace(/\/$/, "");
        //     const r = await fetch(`${sBase}/ApproverSet`, {
        //         method: "GET",
        //         headers: { "Accept": "application/json" },
        //         credentials: "include",
        //         cache: "no-store"
        //     });
        //     if (!r.ok) { throw new Error(`ApproverSet: HTTP ${r.status}`); }

        //     const oJson = await r.json();
        //     const aApprovers = Array.isArray(oJson.value) ? oJson.value : [];
        //     const oMe = aApprovers.find(a => (a.Mail || "").toLowerCase() === String(sMail).toLowerCase());
        //     return String(oMe?.Role || "SUBMITTER").trim().toUpperCase();
        // },

//         _fetchApprovers: async function () {
//     const sBase = this.getOwnerComponent().getModel().getServiceUrl().replace(/\/$/, "");
//     const r = await fetch(`${sBase}/ApproverSet`, {
//         method: "GET",
//         headers: { "Accept": "application/json" },
//         credentials: "include",
//         cache: "no-store"
//     });
//     if (!r.ok) { throw new Error(`ApproverSet: HTTP ${r.status}`); }
//     const oJson = await r.json();
//     return Array.isArray(oJson.value) ? oJson.value : [];
// },

        // _applyRoleState: function (oVM) {
        //     const sRole = oVM.getProperty("/role") || "";
        //     const sStatus = String(oVM.getProperty("/submissionStatus") || "").toUpperCase();
        //     const sUser = String(oVM.getProperty("/userMail") || "").toLowerCase();
        //     const sCreator = String(oVM.getProperty("/createdBy") || "").toLowerCase();

        //     const bForce = !!oVM.getProperty("/forceViewOnly");

        //     const bL1 = sRole === "APPROVER1";
        //     const bL2 = sRole === "APPROVER2";

        //     const bSubmitter = !!sUser && sUser === sCreator;

        //     const bL1Pending = ![ "APPROVED", "REJECTED"].includes(sStatus);
        //     const bL2Pending = sStatus === "APPROVED";

        //     oVM.setProperty("/isL1Approver", bL1);
        //     oVM.setProperty("/isL2Approver", bL2);
        //     oVM.setProperty("/isSubmitter", bSubmitter);
        //     oVM.setProperty("/viewOnly", bForce || bSubmitter || !(bL1 || bL2));
        //     oVM.setProperty("/canAct",
        //         !bForce && !bSubmitter && ((bL1 && bL1Pending) || (bL2 && bL2Pending)));

        //     // oVM.setProperty("/pendingSAPUpdate", !bForce && bL2 && sStatus === "APPROVED");
        //     const bFinalApproved = !bForce && bL2 && sStatus === "APPROVED";

        //     oVM.setProperty("/pendingSAPUpdate", bFinalApproved);

        //     // false -> enabled, true -> disabled
        //     oVM.setProperty("/canUpdateSap", bFinalApproved && !oVM.getProperty("/updateToSap"));
        //     oVM.setProperty("/canRevert", bFinalApproved && !oVM.getProperty("/revert"));
        // },

        _applyRoleState: function (oVM) {
    const sRole = oVM.getProperty("/role") || "";
    const sStatus = String(oVM.getProperty("/submissionStatus") || "").toUpperCase();
    const sUser = String(oVM.getProperty("/userMail") || "").toLowerCase();
    const sCreator = String(oVM.getProperty("/createdBy") || "").toLowerCase();
    const sLast = oVM.getProperty("/lastActorRole") || "";

    const bForce = !!oVM.getProperty("/forceViewOnly");
    const bL1 = sRole === "APPROVER1";
    const bL2 = sRole === "APPROVER2";
    const bSubmitter = !!sUser && sUser === sCreator;
    const bBlocked = bForce || bSubmitter;

    const bPending = !["APPROVED", "REJECTED"].includes(sStatus);
    const bApproved = sStatus === "APPROVED";

    // Pending: either approver acts. Approved: only the OTHER approver acts.
    const bCanAct = !bBlocked && (
        (bPending && (bL1 || bL2)) ||
        (bApproved && bL1 && sLast === "APPROVER2") ||
        (bApproved && bL2 && sLast === "APPROVER1")
    );

    oVM.setProperty("/isL1Approver", bL1);
    oVM.setProperty("/isL2Approver", bL2);
    oVM.setProperty("/isSubmitter", bSubmitter);
    oVM.setProperty("/canAct", bCanAct);
    oVM.setProperty("/viewOnly", !bCanAct);

    // Update to SAP / Revert: Approver 2, after Approver 2 has approved
    const bSap = !bBlocked && bL2 && bApproved && sLast === "APPROVER2";
    oVM.setProperty("/pendingSAPUpdate", bSap);
    oVM.setProperty("/canUpdateSap", bSap && !oVM.getProperty("/updateToSap"));
    oVM.setProperty("/canRevert", bSap && !oVM.getProperty("/revert"));


    //new change

    // Check Status: same user as Update to SAP, but only once the update has been done/sent
oVM.setProperty("/canCheckStatus",
    bSap && (!!oVM.getProperty("/updateToSap") || !!oVM.getProperty("/postSent")));

},

        // _applyTableMode: function (oVM) {
        //     const aData = oVM.getProperty("/tableData") || [];
        //     const isMto = r => String(r.MtoMts || "").trim().toUpperCase() === "MTO";

        //     oVM.setProperty("/showMto", aData.some(isMto));
        //     oVM.setProperty("/showStandard", aData.length === 0 || aData.some(r => !isMto(r)));

        //     const aVisible = [];
        //     for (let i = 1; i <= 20; i++) {
        //         const bHasName = aData.some(r => String(r["Part" + i] || "").trim() !== "");
        //         const bHasPrice = aData.some(r => parseFloat(r["Part" + i + "Price"]) > 0);
        //         aVisible.push(bHasName || bHasPrice);
        //     }
        //     oVM.setProperty("/partVisible", aVisible);
        // },

        _rowType: function (r) {
            const sMm = String(r.MtoMts || "").trim().toUpperCase();
            const sBasis = String(r.Basis || "").trim().toUpperCase();
            if (sMm === "CSD" || sBasis === "CSD") return "CSD";
            if (sMm === "GEM" || sBasis === "GEM") return "GEM";
            if (sMm === "MTO") return "MTO";
            return "MTS";
        },

        _applyTableMode: function (oVM) {
            const aData = oVM.getProperty("/tableData") || [];
            const aTypes = aData.map(r => this._rowType(r));

            aData.forEach((r, i) => { r._isMto = aTypes[i] === "MTO"; });
            oVM.refresh(true);

            const bMto = aTypes.includes("MTO");
            const bCsd = aTypes.includes("CSD");
            const bGem = aTypes.includes("GEM");

            oVM.setProperty("/showMto", bMto);
            oVM.setProperty("/showCsd", bCsd);
            oVM.setProperty("/showGem", bGem);
            oVM.setProperty("/showMtsExShowroom", bMto || bGem);   // shared column
            oVM.setProperty("/showStandard", true);

            const aVisible = [];
            for (let i = 1; i <= 20; i++) {
                const bHasName = aData.some(r => String(r["Part" + i] || "").trim() !== "");
                const bHasPrice = aData.some(r => parseFloat(r["Part" + i + "Price"]) > 0);
                aVisible.push(bHasName || bHasPrice);
            }
            oVM.setProperty("/partVisible", aVisible);
        },

        _parseODataDate: function (sValue) {
            if (!sValue) return null;
            const oMatch = String(sValue).match(/\/Date\((\d+)(\+\d+)?\)\//);
            if (oMatch) return new Date(parseInt(oMatch[1]));
            const d = new Date(sValue);
            return isNaN(d.getTime()) ? null : d;
        },

        // ── Fallback fetch (direct URL navigation / bookmark / refresh) ───
        _loadFallback: async function (sRef) {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();

            const oVM = new JSONModel({
                reference: sRef,
                tableData: [],
                mail: "",
                userMail: "",
                userName: "",
                submissionStatus: "",
                createdBy: "",
                createdOn: null,
                statChangedBy: "",
                statChangedOn: null,
                comments: "",

                forceViewOnly: false,

                role: "",
                isL1Approver: false,
                isL2Approver: false,
                isSubmitter: false,
                viewOnly: false,
                canAct: false,
                pendingSAPUpdate: false,
                isRejected: false,
                isL1Approved: false,
                isL2Approved: false,
                isPending: false,
                updateToSap: false,
                revert: false,
                canUpdateSap: false,
                canRevert: false,
                
                //new change

                canUpdateSap: false,
canRevert: false,
canCheckStatus: false,
postSent: false
            });
            oView.setModel(oVM, "vm");
            oView.setBusy(true);

            try {
                const sBase = oModel.getServiceUrl().replace(/\/$/, "");
                const sUserMail = await this._getUserMail();

                // 1. Breakup rows: same action the list page uses
                const aBreakups = await this._retry(async () => {
                    const rToken = await fetch(sBase, {
                        method: "HEAD",
                        headers: { "X-CSRF-Token": "Fetch" },
                        credentials: "include"
                    });
                    const sCsrf = rToken.headers.get("X-CSRF-Token") || "";

                    const rAction = await fetch(`${sBase}/getApprovalDetailedData`, {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "X-CSRF-Token": sCsrf
                        },
                        credentials: "include",
                        body: JSON.stringify({ refId: sRef })
                    });
                    if (!rAction.ok) {
                        throw new Error(`getApprovalDetailedData: HTTP ${rAction.status}`);
                    }
                    const oJson = await rAction.json();
                    return Array.isArray(oJson.value) ? oJson.value : [];
                });

                // 2. Submission row: by reference only (the record may belong to another user),
                //    prefer the row that matches the logged-in user's mail
                const oSubmission = await this._retry(async () => {
                    const aCtx = await oModel.bindList(
                        "/SubmissionReferenceSet", undefined, undefined,
                        [new Filter("ReferenceNum", FilterOperator.EQ, sRef)]
                    ).requestContexts(0, 5000);

                    const aRows = aCtx.map(c => c.getObject());
                    const sNorm = String(sRef).trim();
                    const aMatch = aRows.filter(r => String(r.ReferenceNum || "").trim() === sNorm);

                    return aMatch.find(r => String(r.Mail || "").toLowerCase() === sUserMail.toLowerCase())
                        || aMatch[0]
                        || null;
                });

                console.log("Fallback submission:", sUserMail, oSubmission);

                const aMerged = aBreakups.map(r => ({
                    ...r,
                    Status: oSubmission?.Status || r.Status || "",
                    CreatedBy: oSubmission?.CreatedBy || r.CreatedBy || "",
                    CreatedOn: oSubmission?.CreatedOn || r.CreatedOn || null,
                    StatChangedBy: oSubmission?.StatChangedBy || "",
                    StatChangedOn: oSubmission?.StatChangedOn || null,
                    Comments: oSubmission?.Comments || "",
                    ReferenceNum: r.ReferenceNum || sRef
                }));

                // 3. Set all data first, then compute the role state
                oVM.setProperty("/tableData", aMerged);
                this._applyTableMode(oVM);
                oVM.setProperty("/mail", oSubmission?.Mail || sUserMail);
                oVM.setProperty("/submissionStatus", String(oSubmission?.Status || "").toUpperCase());
                oVM.setProperty("/createdBy", oSubmission?.CreatedBy || "");
                oVM.setProperty("/createdOn", this._parseODataDate(oSubmission?.CreatedOn));
                oVM.setProperty("/statChangedBy", oSubmission?.StatChangedBy || "");
                oVM.setProperty("/statChangedOn", this._parseODataDate(oSubmission?.StatChangedOn));
                oVM.setProperty("/comments", oSubmission?.Comments || "");

                // NEW: flags that drive Update to SAP / Revert
                oVM.setProperty("/updateToSap", !!oSubmission?.UpdateToSap);
                oVM.setProperty("/revert", !!oSubmission?.Revert);

                oVM.setProperty("/forceViewOnly",
                    String(oSubmission?.Mail || "").toLowerCase() !== sUserMail.toLowerCase());

                await this._loadApproverRole(oVM);

                if (!aMerged.length) {
                    MessageBox.warning("No pricing data found for Reference: " + sRef);
                }

            } catch (e) {
                MessageBox.error("Failed to load price breakup: " + (e.message || "Unknown error"));
                console.error(e);
            } finally {
                oView.setBusy(false);
            }
        },

        // ── Formatters ────────────────────────────────────────────────────
        formatAmount: function (sValue) {
            if (sValue === null || sValue === undefined || sValue === "") return "0.00";
            const n = parseFloat(sValue);
            return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
        },

        formatPercent: function (sValue) {
            if (sValue === null || sValue === undefined || sValue === "") return "0.00";
            const n = parseFloat(sValue);
            return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
        },

        formatDate: function (sValue) {
            if (!sValue) return "—";
            try {
                const oMatch = String(sValue).match(/\/Date\((\d+)\)\//);
                const oDate = oMatch
                    ? new Date(parseInt(oMatch[1]))
                    : new Date(sValue);
                if (isNaN(oDate.getTime())) return "—";
                return oDate.toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric"
                });
            } catch (e) { return "—"; }
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "APPROVED": return "Success";
                case "L1_APPROVED": return "Information";
                case "REJECTED": return "Error";
                case "SUBMITTED": return "Warning";
                default: return "None";
            }
        },

        // ── Excel Export ──────────────────────────────────────────────────
        onExportExcel: function () {
            const oVM = this.getView().getModel("vm");
            const aData = oVM.getProperty("/tableData") || [];
            const sRef = oVM.getProperty("/reference") || "export";

            if (!aData.length) {
                MessageToast.show("No data available to export");
                return;
            }

            MessageBox.confirm("Do you want to download the price breakup as Excel?", {
                title: "Download Excel",
                icon: MessageBox.Icon.QUESTION,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._triggerExcelDownload(aData, sRef);
                    }
                }
            });
        },

        _triggerExcelDownload: function (aData, sRef) {
            const oView = this.getView();
            oView.setBusy(true);

            const _doExport = () => {
                try {
                    const XLSX = window.XLSX;
                    if (!XLSX) throw new Error("SheetJS library not available");

                    // const oVM = this.getView().getModel("vm");
                    // const bMto = oVM.getProperty("/showMto");
                    // const bStd = oVM.getProperty("/showStandard");
                    // const aPartVis = oVM.getProperty("/partVisible");

                    // // Part columns based on visibility
                    // const aPartCols = [];
                    // for (let i = 1; i <= 20; i++) {
                    //     if (aPartVis && aPartVis[i - 1]) {
                    //         aPartCols.push({ label: "Part " + i, field: "Part" + i, type: "string" });
                    //         aPartCols.push({ label: "Part " + i + " Price", field: "Part" + i + "Price", type: "number" });
                    //     }
                    // }

                    // const EXPORT = EXPORT_COLUMNS
                    //     .filter(c => {
                    //         if (MTO_ONLY.includes(c.field)) return bMto;
                    //         if (STANDARD.includes(c.field)) return bStd || bMto;
                    //         return true;
                    //     })
                    //     .concat(aPartCols);

                    const oVM = this.getView().getModel("vm");
                    const bMto = oVM.getProperty("/showMto");
                    const bCsd = oVM.getProperty("/showCsd");
                    const bGem = oVM.getProperty("/showGem");
                    const aPartVis = oVM.getProperty("/partVisible");

                    const fmtDate = (v) => {
                        const d = this._parseODataDate(v);
                        return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
                    };

                    const aExportData = aData.map(r => ({
                        ...r,
                        Status: oVM.getProperty("/submissionStatus") || r.submissionStatus || "",
                        CreatedBy: oVM.getProperty("/createdBy") || r.createdBy || "",
                        CreatedOn: fmtDate(oVM.getProperty("/createdOn") || r.createdOn),
                        StatChangedBy: oVM.getProperty("/statChangedBy") || r.statChangedBy || "",
                        StatChangedOn: fmtDate(oVM.getProperty("/statChangedOn") || r.statChangedOn),
                        Comments: oVM.getProperty("/comments") || r.comments || ""
                    }));

                    // Part columns based on visibility
                    const aPartCols = [];
                    for (let i = 1; i <= 20; i++) {
                        if (aPartVis && aPartVis[i - 1]) {
                            aPartCols.push({ label: "Part " + i, field: "Part" + i, type: "string" });
                            aPartCols.push({ label: "Part " + i + " Price", field: "Part" + i + "Price", type: "number" });
                        }
                    }

                    const EXPORT = EXPORT_COLUMNS
                        .filter(c => {
                            if (c.field === "MtsExshwroom") return bMto || bGem;
                            if (MTO_ONLY.includes(c.field)) return bMto;
                            if (CSD_ONLY.includes(c.field)) return bCsd;
                            if (GEM_ONLY.includes(c.field)) return bGem;
                            return true;
                        })
                        .concat(aPartCols);

                    const aHeaders = EXPORT.map(c => c.label);
                    // const aRows = aData.map(oRow =>
                    const aRows = aExportData.map(oRow =>
                        EXPORT.map(col => {
                            const raw = oRow[col.field];
                            if (col.type === "number") {
                                const n = parseFloat(raw);
                                return isNaN(n) ? 0 : n;
                            }
                            return (raw === null || raw === undefined) ? "" : String(raw);
                        })
                    );

                    const ws = XLSX.utils.aoa_to_sheet([aHeaders, ...aRows]);
                    ws["!cols"] = EXPORT.map(col =>
                        col.type === "number"
                            ? { wch: 18 }
                            : { wch: Math.max(col.label.length + 4, 14) }
                    );
                    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Price Breakup");

                    const sFileName = `PriceBreakup_${sRef}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    XLSX.writeFile(wb, sFileName);

                    MessageToast.show("Downloaded: " + sFileName);

                } catch (e) {
                    console.error("Export failed:", e);
                    MessageBox.error("Failed to export Excel: " + e.message);
                } finally {
                    oView.setBusy(false);
                }
            };

            if (window.XLSX) {
                _doExport();
            } else {
                const oScript = document.createElement("script");
                oScript.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
                oScript.onload = () => _doExport();
                oScript.onerror = () => {
                    oView.setBusy(false);
                    MessageBox.error("Failed to load Excel library.");
                };
                document.head.appendChild(oScript);
            }
        },

        // ── Submit decision ───────────────────────────────────────────────
        _submitDecision: async function (sRef, sStatus, sComments, sEffectiveDate) {
            const oView = this.getView();
            const oVM = oView.getModel("vm");

            // Guard: view-only records can never be changed
            if (oVM.getProperty("/forceViewOnly") || !oVM.getProperty("/canAct")) {
                MessageBox.error("You are not allowed to change this record.");
                return false;
            }

            oView.setBusy(true);

            try {
                const sMail = oVM.getProperty("/mail") || oVM.getProperty("/userMail") || "";
                const sUserMail = oVM.getProperty("/userMail") || oVM.getProperty("/userName") || "";

                if (!sMail) {
                    MessageBox.error("Mail not found");
                    return false;
                }

                const sServiceUrl = this.getOwnerComponent()
                    .getModel()
                    .getServiceUrl()
                    .replace(/\/$/, "");

                const sBoundary = "batch_" + Date.now();
                const sChangesetBoundary = "changeset_" + Date.now();
                const sEntityUrl = `SubmissionReferenceSet(ReferenceNum='${encodeURIComponent(sRef)}',Mail='${sMail}')`;

                const sDecisionDate = sEffectiveDate || new Date().toISOString();

                const oBody = {
                    ReferenceNum: sRef,
                    Mail: sMail,
                    Status: sStatus,
                    Comments: sComments || "",
                    CreatedBy: oVM.getProperty("/createdBy") || "",
                    CreatedOn: oVM.getProperty("/createdOn") || null,
                    StatChangedOn: sDecisionDate,
                    StatChangedBy: sUserMail,
                    UpdateToSap: !!oVM.getProperty("/updateToSap"),
                    Revert: !!oVM.getProperty("/revert")
                };

                const sBatchBody = [
                    `--${sBoundary}`,
                    `Content-Type: multipart/mixed; boundary=${sChangesetBoundary}`,
                    ``,
                    `--${sChangesetBoundary}`,
                    `Content-Type: application/http`,
                    `Content-Transfer-Encoding: binary`,
                    ``,
                    `PUT ${sEntityUrl} HTTP/1.1`,
                    `Content-Type: application/json`,
                    `Accept: application/json`,
                    ``,
                    JSON.stringify(oBody),
                    ``,
                    `--${sChangesetBoundary}--`,
                    ``,
                    `--${sBoundary}--`
                ].join("\r\n");

                const oResponse = await fetch(`${sServiceUrl}/$batch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": `multipart/mixed; boundary=${sBoundary}`,
                        "Accept": "multipart/mixed"
                    },
                    credentials: "include",
                    body: sBatchBody
                });

                if (!oResponse.ok) {
                    const sErr = await oResponse.text().catch(() => "");
                    throw new Error(`Batch failed: HTTP ${oResponse.status} — ${sErr}`);
                }

                const sResponseText = await oResponse.text();
                if (sResponseText.includes("HTTP/1.1 4") || sResponseText.includes("HTTP/1.1 5")) {
                    const sInnerError = sResponseText.match(/"message"\s*:\s*"([^"]+)"/)?.[1] || "Unknown error";
                    throw new Error(sInnerError);
                }

                MessageToast.show(
                    sStatus === "REJECTED" ? "Rejected successfully" : "Approved successfully"
                );

                // Reflect the new status on this page
                // oVM.setProperty("/submissionStatus", sStatus);
                // oVM.setProperty("/statChangedBy", sUserMail);
                // oVM.setProperty("/statChangedOn", new Date(sDecisionDate));
                // oVM.setProperty("/comments", sComments || "");
                // this._applyRoleState(oVM);

                // // L2 final approval: stay here so "Update to SAP" is enabled now.
                // // Everything else (L1 approve, any reject): back to the list.
                // if (sStatus !== "APPROVED") {
                //     const oApprovalModel = this.getOwnerComponent().getModel("approval");
                //     if (oApprovalModel) oApprovalModel.setData({});
                //     this.getOwnerComponent().getRouter().navTo("vehcileapproval");
                // }

                oVM.setProperty("/submissionStatus", sStatus);
oVM.setProperty("/statChangedBy", sUserMail);
oVM.setProperty("/statChangedOn", new Date(sDecisionDate));
oVM.setProperty("/comments", sComments || "");
oVM.setProperty("/lastActorRole", oVM.getProperty("/role"));   // new
this._applyRoleState(oVM);

// Stay only when Approver 2 approves (Update to SAP is on this page); otherwise go back
if (!(sStatus === "APPROVED" && oVM.getProperty("/isL2Approver"))) {
    const oApprovalModel = this.getOwnerComponent().getModel("approval");
    if (oApprovalModel) oApprovalModel.setData({});
    this.getOwnerComponent().getRouter().navTo("vehcileapproval");
}
return true;

                // return true;

            } catch (e) {
                console.error(e);
                MessageBox.error("Failed to update status: " + (e.message || "Unknown error"));
                return false;
            } finally {
                oView.setBusy(false);
            }
        },

        // ── Approve handler ───────────────────────────────────────────────
        // onApprove: function () {
        //     const oVM = this.getView().getModel("vm");
        //     const sRef = oVM.getProperty("/reference");

        //     const oDatePicker = new DatePicker({
        //         width: "100%", placeholder: "Select Effective Date",
        //         valueFormat: "yyyy-MM-dd", displayFormat: "dd MMM yyyy",
        //         minDate: new Date()
        //     });

        //     const oDialog = new Dialog({
        //         title: "Select Effective Date", type: "Message", contentWidth: "400px",
        //         content: [new VBox({
        //             items: [
        //                 new Text({ text: "Please select the effective date for approval:" }),
        //                 oDatePicker
        //             ]
        //         })],
        //         beginButton: new Button({
        //             text: "Approve", type: "Accept", icon: "sap-icon://accept",
        //             press: async () => {
        //                 const oDate = oDatePicker.getDateValue();
        //                 if (!oDate) {
        //                     MessageToast.show("Please select an effective date");
        //                     return;
        //                 }
        //                 oDialog.close();

        //                 // L1 -> intermediate status, L2 -> final approval
        //                 const sNewStatus = oVM.getProperty("/isL2Approver") ? "APPROVED" : "APPROVED";
        //                 await this._submitDecision(sRef, sNewStatus, "", oDate.toISOString());
        //             }
        //         }),
        //         endButton: new Button({ text: "Cancel", icon: "sap-icon://decline", press: () => oDialog.close() }),
        //         afterClose: () => oDialog.destroy()
        //     });
        //     oDialog.open();
        // },

        // ── Approve handler ───────────────────────────────────────────────
onApprove: async function () {
    const oVM = this.getView().getModel("vm");
    const sRef = oVM.getProperty("/reference");

    // No date picker: StatChangedOn falls back to "now" inside _submitDecision
    await this._submitDecision(sRef, "APPROVED", "");
},

        // ── Reject handler ────────────────────────────────────────────────
        onReject: function () {
            const sRef = this.getView().getModel("vm").getProperty("/reference");
            const oTextArea = new TextArea({
                placeholder: "Enter rejection comments (mandatory)",
                width: "100%", growing: true, rows: 4
            });

            const oDialog = new Dialog({
                title: "Reject Reason", type: "Message", contentWidth: "400px",
                content: [new VBox({
                    items: [
                        new Text({ text: "Please provide a reason for rejection:" }),
                        oTextArea
                    ]
                })],
                beginButton: new Button({
                    text: "Reject", type: "Reject", icon: "sap-icon://decline",
                    press: () => {
                        const sComment = oTextArea.getValue().trim();
                        if (!sComment) { MessageToast.show("Comments are mandatory for rejection"); return; }
                        oDialog.close();
                        this._submitDecision(sRef, "REJECTED", sComment);
                    }
                }),
                endButton: new Button({ text: "Cancel", press: () => oDialog.close() }),
                afterClose: () => oDialog.destroy()
            });
            oDialog.open();
        },

        onNavBack: function () {
            // Clear component model so list page reloads fresh
            const oApprovalModel = this.getOwnerComponent().getModel("approval");
            if (oApprovalModel) oApprovalModel.setData({});
            this.getOwnerComponent().getRouter().navTo("vehcileapproval");
        },

        // ── Which date fields apply to this reference ─────────────────────
        // _getPostType: function (oVM) {
        //     const aData = oVM.getProperty("/tableData") || [];
        //     const has = (field, val) =>
        //         aData.some(r => String(r[field] || "").trim().toUpperCase() === val);

        //     if (has("Basis", "CSD")) return "CSD";
        //     if (has("Basis", "GEM")) return "GEM";
        //     return "MTOMTS";
        // },

        _getPostType: function (oVM) {
    const aTypes = (oVM.getProperty("/tableData") || []).map(r => this._rowType(r));

    if (aTypes.includes("CSD")) return "CSD";
    if (aTypes.includes("GEM")) return "GEM";
    return "MTOMTS";   // MTO / MTS
},

        // ── Open the dialog (call this from onUpdateToSap) ────────────────
        onUpdateToSAP: async function () {
            const oVM = this.getView().getModel("vm");
            const sType = this._getPostType(oVM);

            this._oPostModel = new JSONModel({
                type: sType,
                showMtoMts: sType === "MTOMTS",
                showCsd: sType === "CSD",
                showGem: sType === "GEM",
                StockTransferDate: "", DealerBillingDate: "", CustomerBillingDate: "",
                CsdDate: "", GemDate: "",
                UpdatedByName: oVM.getProperty("/userName") || oVM.getProperty("/userMail"),
                errStock: "None", errDealer: "None", errCustomer: "None",
                errCsd: "None", errGem: "None"
            });

            if (!this._oPostDialog) {
                this._oPostDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "vehiclepricingui.view.fragments.PostPriceDialog",
                    controller: this
                });
                this.getView().addDependent(this._oPostDialog);
            }
            this._oPostDialog.setModel(this._oPostModel, "pp");
            this._oPostDialog.open();
        },

        onPostPriceCancel: function () {
            this._oPostDialog.close();
        },

 onPostPriceConfirm: async function () {
    const oPP = this._oPostModel;
    const oVM = this.getView().getModel("vm");

    const aRules = {
        MTOMTS: [["StockTransferDate", "errStock"], ["DealerBillingDate", "errDealer"], ["CustomerBillingDate", "errCustomer"]],
        CSD: [["CsdDate", "errCsd"]],
        GEM: [["GemDate", "errGem"]]
    }[oPP.getProperty("/type")];

    // today, 00:00 local
    const oMin = new Date();
    oMin.setHours(0, 0, 0, 0);

    let bValid = true;
    let bPast = false;
    aRules.forEach(([sField, sErr]) => {
        const sVal = oPP.getProperty("/" + sField);
        let bBad = !sVal;

        if (sVal) {
            const [y, m, d] = sVal.split("-").map(Number);
            if (new Date(y, m - 1, d) < oMin) { bBad = true; bPast = true; }
        }

        oPP.setProperty("/" + sErr, bBad ? "Error" : "None");
        if (bBad) bValid = false;
    });

    if (!bValid) {
        MessageToast.show(bPast
            ? "Past dates are not allowed"
            : "Please fill all the required dates");
        return;
    }

    // UpdatedOn / UpdatedBy are set in the backend.
    const toIso = s => new Date(s + "T00:00:00Z").toISOString();
    const oBody = { ReferenceNum: oVM.getProperty("/reference") };
    aRules.forEach(([sField]) => { oBody[sField] = toIso(oPP.getProperty("/" + sField)); });

    this._oPostDialog.close();
    await this._postPrice(oBody);
},

// Plain POST helper: no OData model involved, so no read-back GET
_postJson: async function (sEntitySet, oBody) {
    const sBase = this.getOwnerComponent().getModel().getServiceUrl().replace(/\/$/, "");
    const oResponse = await fetch(`${sBase}/${sEntitySet}`, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(oBody)
    });

    const sText = await oResponse.text();
    let oJson = {};
    try { oJson = sText ? JSON.parse(sText) : {}; } catch (e) { /* non-JSON body */ }

    if (!oResponse.ok) {
        throw new Error(
            oJson?.error?.message?.value || oJson?.error?.message || `HTTP ${oResponse.status}`
        );
    }
    return oJson;
},

// Reusable status call (action parameter is refId)
// _getPostPriceStatus: async function (sRef) {
//     const oJson = await this._postJson("getPostPriceStatus", { refId: sRef });
//     return Array.isArray(oJson.value) ? oJson.value : [];
// },

_getPostPriceStatus: async function (sRef) {
    const oJson = await this._postJson("getPostPriceStatus", { refId: sRef });
    console.log("getPostPriceStatus RAW response:", JSON.stringify(oJson, null, 2));

    const aRows = Array.isArray(oJson.value) ? oJson.value : [];
    console.log("getPostPriceStatus rows:", aRows.length);
    console.table(aRows);   // shows each row's fields (UpdateStatus, Message, Model, Region, ...)
    return aRows;
},

onCheckStatus: async function () {
    const oView = this.getView();
    const oVM = oView.getModel("vm");
    const sRef = oVM.getProperty("/reference");

    if (!sRef) { MessageToast.show("Reference number not found"); return; }

    oView.setBusy(true);
    try {
        const aRows = await this._retry(() => this._getPostPriceStatus(sRef));
        this._showPostResult(aRows, oVM);
    } catch (e) {
        console.error("Check status failed:", e);
        MessageBox.error("Failed to check status: " + (e.message || "Unknown error"));
    } finally {
        oView.setBusy(false);
    }
},

_postPrice: async function (oBody) {
    const oView = this.getView();
    const oVM = oView.getModel("vm");
    oView.setBusy(true);

    try {
        // Step 1: post the dates
        try {
            await this._postJson("PostPriceSet", oBody);

            //new change
                oVM.setProperty("/postSent", true);
    this._applyRoleState(oVM);      // shows Check Status
        } catch (e) {
            console.error("PostPriceSet failed:", e);
            MessageBox.error("Failed to update to SAP: " + (e.message || "Unknown error"));
            return;
        }

        // Step 2: status check
        try {
            const aRows = await this._getPostPriceStatus(oBody.ReferenceNum);
            this._showPostResult(aRows, oVM);
        } catch (e) {
            console.error("getPostPriceStatus failed:", e);
            MessageBox.warning(
                "The price update request was sent, but the status check failed: " +
                (e.message || "Unknown error")
            );
        }
    } finally {
        oView.setBusy(false);
    }
},

// _showPostResult: function (aRows, oVM) {
//     if (!aRows.length) {
//         MessageBox.warning("There is an Error in updating the price in SAP. Please contact Admin.");
//         return;
//     }

//     const isOk = r => String(r.UpdateStatus || "").trim().toUpperCase() === "S";
//     const aFailed = aRows.filter(r => !isOk(r));

//     // All successful: single message, no details
//     if (!aFailed.length) {
//         oVM.setProperty("/updateToSap", true);
//         this._applyRoleState(oVM);   // disables Update to SAP / Revert
//         MessageBox.success("Successfully posted the price", { title: "Update to SAP" });
//         return;
//     }

//     // At least one failed: show the detailed list, failed rows first
//     const aSorted = [...aFailed, ...aRows.filter(isOk)];
//     const sDetails = "<ul>" + aSorted.map(r =>
//         `<li><strong>${encodeXML(`${r.Model || ""} / ${r.Region || ""}`)}</strong>: ` +
//         `${isOk(r) ? "✔" : "✖"} ${encodeXML(r.Message || "")}</li>`
//     ).join("") + "</ul>";

//     const fnShow = aFailed.length === aRows.length ? MessageBox.error : MessageBox.warning;
//     fnShow.call(MessageBox,
//         `${aFailed.length} of ${aRows.length} combinations failed. Expand the details to see why.`,
//         { title: "Update to SAP", details: sDetails }
//     );
// },

_showPostResult: function (aRows, oVM) {
    if (!aRows.length) {
        // MessageBox.warning("SAP returned no status for this reference.");
        MessageBox.warning("Price update to SAP is still in progress, please check after sometime...");
        return;
    }

    const isOk = r => String(r.UpdateStatus || "").trim().toUpperCase() === "S";
    const aFailed = aRows.filter(r => !isOk(r));

    // All successful: single message, no details
    if (!aFailed.length) {
        oVM.setProperty("/updateToSap", true);
        this._applyRoleState(oVM);
        MessageBox.success("Successfully posted the price", { title: "Update to SAP" });
        return;
    }

    // Group failures by message
    const MAX_PER_GROUP = 20;
    const mGroups = new Map();
    aFailed.forEach(r => {
        const sMsg = String(r.Message || "No message returned").trim();
        if (!mGroups.has(sMsg)) { mGroups.set(sMsg, []); }
        mGroups.get(sMsg).push(`${r.Model || ""} / ${r.Region || ""}`);
    });

    const sDetails = [...mGroups.entries()].map(([sMsg, aItems]) => {
        const aShown = aItems.slice(0, MAX_PER_GROUP);
        const iMore = aItems.length - aShown.length;
        return `<p><strong>${encodeXML(sMsg)}</strong> (${aItems.length})</p><ul>` +
            aShown.map(s => `<li>${encodeXML(s)}</li>`).join("") +
            (iMore > 0 ? `<li><em>...and ${iMore} more</em></li>` : "") +
            `</ul>`;
    }).join("");

    const sDownload = "Download failures";
    const fnShow = aFailed.length === aRows.length ? MessageBox.error : MessageBox.warning;
    fnShow.call(MessageBox,
        `${aFailed.length} of ${aRows.length} combinations failed. Expand the details to see why.`,
        {
            title: "Update to SAP",
            details: sDetails,
            actions: [sDownload, MessageBox.Action.CLOSE],
            emphasizedAction: sDownload,
            onClose: (sAction) => {
                if (sAction === sDownload) { this._downloadFailures(aFailed); }
            }
        }
    );
},

// Full list of failures as Excel
_downloadFailures: function (aFailed) {
    const oView = this.getView();

    const _doExport = () => {
        try {
            const XLSX = window.XLSX;
            if (!XLSX) { throw new Error("SheetJS library not available"); }

            const aHeaders = ["Model", "Region", "Reference No", "Update Status", "Message"];
            const aRows = aFailed.map(r => [
                r.Model || "",
                r.Region || "",
                r.ReferenceNum || "",
                r.UpdateStatus || "",
                r.Message || ""
            ]);

            const ws = XLSX.utils.aoa_to_sheet([aHeaders, ...aRows]);
            ws["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 50 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Failures");

            const sFileName = `PostPriceFailures_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, sFileName);
            MessageToast.show("Downloaded: " + sFileName);
        } catch (e) {
            console.error("Failure export failed:", e);
            MessageBox.error("Failed to export Excel: " + e.message);
        } finally {
            oView.setBusy(false);
        }
    };

    oView.setBusy(true);
    if (window.XLSX) {
        _doExport();
    } else {
        const oScript = document.createElement("script");
        oScript.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        oScript.onload = _doExport;
        oScript.onerror = () => {
            oView.setBusy(false);
            MessageBox.error("Failed to load Excel library.");
        };
        document.head.appendChild(oScript);
    }
},


        // Revert handler
onRevert: function () {
    const oVM = this.getView().getModel("vm");
    const sRef = oVM.getProperty("/reference");

    console.log("Revert Reference Number:", sRef);

    if (!sRef) {
        sap.m.MessageToast.show("Reference number not found");
        return;
    }

    sap.m.MessageBox.confirm(
        "Are you sure you want to revert this submission?",
        {
            title: "Revert Submission",
            icon: sap.m.MessageBox.Icon.WARNING,
            actions: [
                sap.m.MessageBox.Action.YES,
                sap.m.MessageBox.Action.NO
            ],
            emphasizedAction: sap.m.MessageBox.Action.YES,

            onClose: (sAction) => {
                if (sAction === sap.m.MessageBox.Action.YES) {
                    this._revertSubmission(sRef);
                }
            }
        }
    );
},




_revertSubmission: async function (sRef) {
    const oView = this.getView();
    const oComponent = this.getOwnerComponent();
    const oModel = oComponent.getModel();

    oView.setBusy(true);

    try {
        const sServiceUrl = oModel
            .getServiceUrl()
            .replace(/\/+$/, "");

        const sEntityUrl =
            `${sServiceUrl}/SubmissionReferenceRecallSet` +
            `(ReferenceNum='${encodeURIComponent(sRef)}')`;

        console.log("CAPM DELETE URL:", sEntityUrl);

        // Send DELETE directly; do not read the entity first
        const oResponse = await fetch(sEntityUrl, {
            method: "DELETE",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const sResponseText = await oResponse.text();

        console.log("DELETE status:", oResponse.status);
        console.log("DELETE response:", sResponseText);

        if (!oResponse.ok) {
            let sMessage = `HTTP ${oResponse.status}`;

            try {
                const oError = JSON.parse(sResponseText);
                sMessage =
                    oError?.error?.message?.value ||
                    oError?.error?.message ||
                    sMessage;
            } catch (e) {
                if (sResponseText) {
                    sMessage = sResponseText;
                }
            }

            throw new Error(sMessage);
        }

        sap.m.MessageToast.show("Reverted successfully");

        const oApprovalModel = oComponent.getModel("approval");
        if (oApprovalModel) {
            oApprovalModel.setData({});
        }

        oComponent.getRouter().navTo("vehcileapproval");

    } catch (oError) {
        console.error("Revert error:", oError);

        sap.m.MessageBox.error(
            "Failed to revert: " +
            (oError.message || "Unknown error")
        );
    } finally {
        oView.setBusy(false);
    }
}



    });
});