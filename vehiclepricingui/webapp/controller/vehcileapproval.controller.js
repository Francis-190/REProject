sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/BusyDialog",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyDialog, Filter, FilterOperator, Sorter) {
    "use strict";

    return Controller.extend("vehiclepricingui.controller.vehcileapproval", {

        /* ─────────────────────────────────────────────────────────────
        LIFECYCLE
        ───────────────────────────────────────────────────────────── */
onInit: function () {
    const oVM = new JSONModel({
        allData: [],
        filteredData: [],
        counts: { ALL: 0, SUBMITTED: 0, L1_APPROVED: 0, APPROVED: 0, REJECTED: 0 },
        ASMEmail: "",
        ASMName: "",

        role: "",            // APPROVER1 | APPROVER2 | SUBMITTER
        roleLoadFailed: false,
        approvers: [],       // full ApproverSet
        entryLevel: "",      // tile pressed: APPROVER1 | APPROVER2
        readOnly: true       // true -> no Approve / Reject on detail
    });
    this.getView().setModel(oVM, "vm");

    // show the spinner immediately (default delay is 1000 ms)
    this.getView().setBusyIndicatorDelay(0);

    this._sActiveKey = "ALL";
    this._bSortDesc = true;
    this._iReq = 0;

    this.getOwnerComponent()
        .getRouter()
        .getRoute("vehcileapproval")
        .attachPatternMatched(this._onRouteMatched, this);
},

_loadUserInfo: async function (oVM) {
    let sMail = "francisajay.ds@laderatechnology.com";
    let sName = "Francis Ajay D S";

    if (sap.ushell && sap.ushell.Container) {
        try {
            const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
            sMail = oUserInfo.getEmail() || sMail;
            sName = oUserInfo.getFullName() || sName;
        } catch (e) {
            console.warn("Could not load user info from shell:", e);
        }
    }

    oVM.setProperty("/ASMEmail", sMail);
    oVM.setProperty("/ASMName", sName);
    this.getOwnerComponent()._sUserEmail = sMail;

    // The data load depends on the role, so wait for it
    await this._loadRole(oVM);
},

_loadRole: async function (oVM) {
    let aApprovers = [];
    let bFailed = false;

    const oAbort = new AbortController();
    const iTimer = setTimeout(() => oAbort.abort(), 30000);   // 30 s safety net

    try {
        const sBase = this.getOwnerComponent().getModel().getServiceUrl().replace(/\/$/, "");
        const r = await fetch(`${sBase}/ApproverSet`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
            cache: "no-store",              // never serve a cached role list
            signal: oAbort.signal
        });
        if (!r.ok) { throw new Error(`ApproverSet: HTTP ${r.status}`); }
        const oJson = await r.json();
        aApprovers = Array.isArray(oJson.value) ? oJson.value : [];
    } catch (e) {
        bFailed = true;
        console.warn("ApproverSet load failed:", e);
    } finally {
        clearTimeout(iTimer);
    }

    const sMail = (oVM.getProperty("/ASMEmail") || "").toLowerCase();
    const oMe = aApprovers.find(a => (a.Mail || "").toLowerCase() === sMail);
    const sRole = String(oMe?.Role || "SUBMITTER").trim().toUpperCase();

    console.log("Role resolved:", sRole);
    oVM.setProperty("/approvers", aApprovers);
    oVM.setProperty("/role", sRole);
    oVM.setProperty("/roleLoadFailed", bFailed);
},

_onRouteMatched: async function () {
    const oView = this.getView();
    const oVM = oView.getModel("vm");
    const iReq = ++this._iReq;   // identifies this call; newer calls supersede it

    // clear stale state so the page doesn't flash "View Only / No references"
    oVM.setProperty("/allData", []);
    oVM.setProperty("/filteredData", []);
    oVM.setProperty("/role", "");
    oVM.setProperty("/roleLoadFailed", false);
    this._updateCounts([], []);

    oView.setBusy(true);
    try {
        // fresh user + fresh role on every entry to the page (waits for ApproverSet)
        await this._loadUserInfo(oVM);
        if (iReq !== this._iReq) { return; }   // a newer call took over

        // role could not be determined: don't load data with a wrong role
        if (oVM.getProperty("/roleLoadFailed")) {
            MessageBox.error("Could not load approver details. Please refresh and try again.");
            return;
        }

        // tile choice: memory first, then sessionStorage (survives browser refresh)
        let sLevel = this.getOwnerComponent()._sEntryLevel;
        if (!sLevel) {
            try { sLevel = window.sessionStorage.getItem("entryLevel") || ""; } catch (e) { sLevel = ""; }
        }

        // nothing stored at all: default to the user's own level
        if (!sLevel) {
            sLevel = oVM.getProperty("/role") === "APPROVER2" ? "APPROVER2" : "APPROVER1";
        }

        this.getOwnerComponent()._sEntryLevel = sLevel;
        oVM.setProperty("/entryLevel", sLevel);

        await this._loadAllData();
    } catch (e) {
        console.error(e);
        MessageBox.error("Failed to load the page.");
    } finally {
        if (iReq === this._iReq) { oView.setBusy(false); }
    }
},


        _loadAllData: async function () {
            const oView = this.getView();
            // oView.setBusy(true);

            try {
                const oComponent = this.getOwnerComponent();
                const oModel = oComponent.getModel();
                const oVM = oView.getModel("vm");

                const sMail = oVM.getProperty("/ASMEmail");
                const sRole = oVM.getProperty("/role");
                const sLevel = oVM.getProperty("/entryLevel");

                if (!sMail) {
                    throw new Error("User email is not available.");
                }

                // Approver on his own tile -> own records with actions, everything else is view only
                const bOwnScreen = sRole === sLevel;
                oVM.setProperty("/readOnly", !bOwnScreen);

                let aFilters = [];
                if (bOwnScreen) {
                    aFilters.push(new Filter("Mail", FilterOperator.EQ, sMail));
                } else {
                    // all users holding the role of the tile that was pressed
                    const aMails = (oVM.getProperty("/approvers") || [])
                        .filter(a => (a.Role || "").toUpperCase() === sLevel)
                        .map(a => a.Mail);

                    if (!aMails.length) {
                        oVM.setProperty("/allData", []);
                        oVM.setProperty("/filteredData", []);
                        this._updateCounts([], []);
                        return;   // finally{} still clears busy
                    }

                    aFilters.push(new Filter({
                        filters: aMails.map(m => new Filter("Mail", FilterOperator.EQ, m)),
                        and: false   // OR
                    }));
                }

                const oBinding = oModel.bindList(
                    "/SubmissionReferenceSet",
                    undefined,
                    undefined,
                    aFilters
                );

                const aContexts = await oBinding.requestContexts(0, 5000);
                const aData = aContexts.map(c => c.getObject());

                oVM.setProperty("/allData", aData);
                oVM.setProperty("/filteredData", aData);
                this._updateCounts(aData, aData);

                // Reset UI state
                const oTabBar = this.byId("idFilterBar");
                if (oTabBar) { oTabBar.setSelectedKey("ALL"); }

                const oSearch = this.byId("searchField");
                if (oSearch) { oSearch.setValue(""); }

                this._sActiveKey = "ALL";

            } catch (e) {
                MessageBox.error("Failed to load submission references.");
                console.error(e);
            } finally {
                // oView.setBusy(false);
            }
        },

        /* ─────────────────────────────────────────────────────────────
        COUNT HELPER  — keeps KPI tiles + tab badges in sync
        ───────────────────────────────────────────────────────────── */
        _updateCounts: function (aAll, aFiltered) {
            const n = (arr, s) => arr.filter(o => o.Status === s).length;
            this.getView().getModel("vm").setProperty("/counts", {
                ALL: aAll.length,
                SUBMITTED: n(aAll, "SUBMITTED"),
                L1_APPROVED: n(aAll, "L1_APPROVED"),
                APPROVED: n(aAll, "APPROVED"),
                REJECTED: n(aAll, "REJECTED")
            });
        },

        /* ─────────────────────────────────────────────────────────────
        FILTER  —  shared by tab bar + KPI tiles
        ───────────────────────────────────────────────────────────── */
        _applyFilter: function (sKey, sSearch) {
            const oVM = this.getView().getModel("vm");
            const aAll = oVM.getProperty("/allData") || [];

            let aResult = sKey === "ALL" ? aAll : aAll.filter(o => o.Status === sKey);

            if (sSearch && sSearch.trim()) {
                const q = sSearch.trim().toLowerCase();
                aResult = aResult.filter(o =>
                    (o.ReferenceNum || "").toLowerCase().includes(q) ||
                    (o.Status || "").toLowerCase().includes(q) ||
                    (o.Comments || "").toLowerCase().includes(q) ||
                    (o.CreatedBy || "").toLowerCase().includes(q) ||
                    (o.StatChangedBy || "").toLowerCase().includes(q)
                );
            }

            oVM.setProperty("/filteredData", aResult);
            this._updateCounts(aAll, aResult);
        },

        onFilterSelect: function (oEvent) {
            this._sActiveKey = oEvent.getParameter("key");
            const sSearch = this.byId("searchField")?.getValue() || "";
            this._applyFilter(this._sActiveKey, sSearch);
        },

        onSearch: function (oEvent) {
            const sSearch = oEvent.getParameter("newValue") || "";
            this._applyFilter(this._sActiveKey, sSearch);
        },

        /* ─────────────────────────────────────────────────────────────
        SORT  —  toggle CreatedOn asc / desc
        ───────────────────────────────────────────────────────────── */
        onSort: function () {
            this._bSortDesc = !this._bSortDesc;
            const oBinding = this.byId("submissionTable").getBinding("items");
            if (oBinding) {
                oBinding.sort(new Sorter("CreatedOn", this._bSortDesc));
            }
            MessageToast.show(this._bSortDesc ? "Sorted: newest first" : "Sorted: oldest first");
        },

        /* ─────────────────────────────────────────────────────────────
        EXPORT  —  RFC-4180 CSV
        ───────────────────────────────────────────────────────────── */
        onExport: function () {
            const aData = this.getView().getModel("vm").getProperty("/filteredData") || [];
            if (!aData.length) { MessageToast.show("No data to export."); return; }

            const aHeaders = ["ReferenceNum", "Status", "Comments",
                "CreatedOn", "CreatedBy", "StatChangedOn", "StatChangedBy"];
            const esc = v => {
                const s = v == null ? "" : String(v);
                return (s.includes(",") || s.includes('"') || s.includes("\n"))
                    ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const csv = [aHeaders.join(","),
            ...aData.map(o => aHeaders.map(k => esc(o[k])).join(","))
            ].join("\r\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
            const link = Object.assign(document.createElement("a"), {
                href: url,
                download: `SubmissionReferences_${new Date().toISOString().slice(0, 10)}.csv`
            });
            link.click();
            URL.revokeObjectURL(url);
            MessageToast.show("Export complete.");
        },

        /* ─────────────────────────────────────────────────────────────
        REFRESH
        ───────────────────────────────────────────────────────────── */
        onRefresh: async function () {
            const oVM = this.getView().getModel("vm");
            await this._loadUserInfo(oVM);
            await this._loadAllData();
            MessageToast.show("Data refreshed.");
        },

        /* ─────────────────────────────────────────────────────────────
        NAV BACK
        ───────────────────────────────────────────────────────────── */
        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("ApproverList");
        },

        onReferencePress: async function (oEvent) {
            const oSrc = oEvent.getSource();
            const oCtx = oSrc.getBindingContext("vm")
                || oSrc.getParent()?.getBindingContext("vm");

            if (!oCtx) {
                MessageToast.show("Unable to get the selected reference.");
                return;
            }

            const oData = oCtx.getObject();
            const sRef = oData?.ReferenceNum;

            if (!sRef) {
                MessageToast.show("Reference ID missing.");
                return;
            }

            // Approve / Reject only when the user is on his own approver tile
            const bReadOnly = this.getView().getModel("vm").getProperty("/readOnly");

            if (!this._oBusyDialog) {
                this._oBusyDialog = new BusyDialog({
                    title: "Loading",
                    text: "Fetching pricing details…"
                });
            }

            this._oBusyDialog.open();

            try {
                const oComponent = this.getOwnerComponent();
                const oModel = oComponent.getModel();
                const sBase = oModel.getServiceUrl().replace(/\/$/, "");

                // Fetch CSRF token for the POST action
                const rToken = await fetch(sBase, {
                    method: "HEAD",
                    headers: { "X-CSRF-Token": "Fetch" },
                    credentials: "include"
                });

                if (!rToken.ok) {
                    throw new Error(`CSRF token request failed: HTTP ${rToken.status}`);
                }

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
                    const sError = await rAction.text();
                    throw new Error(`getApprovalDetailedData failed: HTTP ${rAction.status} ${sError}`);
                }

                const oResult = await rAction.json();

                const aBreakups = Array.isArray(oResult.value)
                    ? oResult.value
                    : Array.isArray(oResult.tableData)
                        ? oResult.tableData
                        : [];

                if (!aBreakups.length) {
                    MessageToast.show(`No pricing details found for ${sRef}.`);
                }

                // Reuse/create the component-level model
                let oApprovalModel = oComponent.getModel("approval");
                if (!oApprovalModel) {
                    oApprovalModel = new JSONModel();
                    oComponent.setModel(oApprovalModel, "approval");
                }

                oApprovalModel.setData({
                    reference: sRef,
                    tableData: aBreakups,
                    submissionStatus: oData.Status || "",
                    createdBy: oData.CreatedBy || "",
                    createdOn: oData.CreatedOn || null,
                    statChangedBy: oData.StatChangedBy || "",
                    statChangedOn: oData.StatChangedOn || null,
                    comments: oData.Comments || "",
                    mail: oData.Mail || "",
                    readOnly: bReadOnly,
                    updateToSap: !!oData.UpdateToSap,   // NEW
                    revert: !!oData.Revert,             // NEW
                });

                console.log(oApprovalModel);
                

                oComponent.getRouter().navTo("vehcileapprovaldetail", { ref: sRef });

            } catch (e) {
                console.error("Failed to load approval details:", e);
                MessageBox.error("Failed to load pricing details: " + (e.message || "Unknown error"));
            } finally {
                this._oBusyDialog.close();
            }
        },

        /* ─────────────────────────────────────────────────────────────
        FORMATTERS
        ───────────────────────────────────────────────────────────── */

        /**
         * Parses any OData date format and returns "DD Mon YYYY" or "—".
         * Handles: /Date(ms)/, ISO strings, native Date objects.
         */
        formatDateSafe: function (vDate) {
            if (!vDate) return "—";

            if (typeof vDate === "string" && vDate.startsWith("/Date(")) {
                const ms = parseInt(vDate.replace(/\/Date\((\d+)[^)]*\)\//, "$1"), 10);
                if (!isNaN(ms)) vDate = new Date(ms);
            }

            const d = vDate instanceof Date ? vDate : new Date(vDate);
            if (isNaN(d.getTime())) return "—";

            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
        },

        formatInitials: function (sValue) {
            if (!sValue || !sValue.trim()) return "?";
            const sName = sValue.includes("@") ? sValue.split("@")[0] : sValue;
            return sName.trim()
                .split(/[\s._\-]+/)
                .filter(Boolean)
                .map(w => w.charAt(0).toUpperCase())
                .slice(0, 2)
                .join("");
        },

        formatDisplayName: function (sValue) {
            if (!sValue || !sValue.trim()) return "";
            return sValue.includes("@") ? sValue.split("@")[0] : sValue;
        }

    });
});