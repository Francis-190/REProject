sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/export/Spreadsheet"
    ],
    function (
        Controller,
        JSONModel,
        Filter,
        FilterOperator,
        MessageToast,
        MessageBox,
        Spreadsheet
    ) {
        "use strict";

        return Controller.extend("editmasterdata.controller.AppendedReport", {

            // ============================================================
            // INIT
            // ============================================================

            onInit: async function () {

                var oVM = new JSONModel({ readOnly: false, loading: false });
                this.getView().setModel(oVM, "viewModel");

                // Slab lookup models: set early so the cell bindings always find them
                this.getView().setModel(new JSONModel({ map: {} }), "slabs");
                this.getView().setModel(new JSONModel({ map: {} }), "rtoMasterSlabs");

                var oDatePicker = this.byId("yourDatePickerId");
                if (oDatePicker) {
                    oDatePicker.setMinDate(new Date());
                }

                var oToday = new Date();
                oToday.setHours(0, 0, 0, 0);

                this.getView().setModel(new JSONModel({
                    minDate: oToday
                }), "view");

                // 1. wait for the role check in Component.js
                var oComp = this.getOwnerComponent();
                await oComp.getRoleReady();
                var oUser = oComp.getModel("user");

                // own mail: used ONLY when creating rows (ASM name)
                oVM.setProperty("/ASMEmail", oUser.getProperty("/email"));

                // 2. decide whose data to show (reference / filter only)
                var aViewMails = [];
                if (oUser.getProperty("/isSubmitter")) {
                    aViewMails = [oUser.getProperty("/email")];
                } else if (oUser.getProperty("/isApprover")) {
                    aViewMails = oUser.getProperty("/submitterEmails") || [];
                    oVM.setProperty("/readOnly", true); // approver only views submitter data
                }
                oVM.setProperty("/viewMails", aViewMails);

                // 3. load slabs + pricing data, bind table only when everything is ready
                this._loadAll();
            },

            // ============================================================
            // MAIL FILTER
            // ============================================================

            _getMailFilter: function () {
                var aMails = this.getView()
                    .getModel("viewModel")
                    .getProperty("/viewMails") || [];

                aMails = aMails
                    .filter(Boolean)
                    .map(function (sMail) {
                        return String(sMail).trim();
                    })
                    .filter(Boolean);

                if (!aMails.length) {
                    return new Filter("Mail", FilterOperator.EQ, "__NO_ACCESS__");
                }

                var aFilters = aMails.map(function (sMail) {
                    return new Filter("Mail", FilterOperator.EQ, sMail);
                });

                return aFilters.length === 1
                    ? aFilters[0]
                    : new Filter({ filters: aFilters, and: false });
            },

            // ============================================================
            // GENERIC PROMISE READ
            // ============================================================

            _readSet: function (sPath, aFilters) {
                var oModel = this.getOwnerComponent().getModel();

                return new Promise(function (resolve, reject) {
                    oModel.read(sPath, {
                        filters: aFilters || [],
                        success: function (oData) {
                            resolve((oData && oData.results) || []);
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            },

            // ============================================================
            // LOAD EVERYTHING, THEN BIND THE TABLE ONCE
            // ============================================================

            _loadAll: function () {
                var oView = this.getView();
                var oVM = oView.getModel("viewModel");
                var oTable = this.byId("AppendedReportTable");
                var that = this;

                if (!oTable) {
                    console.error("AppendedReportTable not found");
                    return;
                }

                var aMails = (oVM.getProperty("/viewMails") || [])
                    .filter(Boolean)
                    .map(function (s) { return String(s).trim(); })
                    .filter(Boolean);

                // token so an older, slower refresh can never overwrite a newer one
                this._iLoadToken = (this._iLoadToken || 0) + 1;
                var iToken = this._iLoadToken;

                // loading ON: busy table + /loading flag (bind buttons' enabled to !${viewModel>/loading})
                oVM.setProperty("/loading", true);
                oTable.setBusy(true);
                oTable.unbindRows();
                oTable.setModel(null); // drop JSON model used by filter / sort
                this._isFiltered = false;

                function loadingOff() {
                    if (iToken === that._iLoadToken) {
                        oTable.setBusy(false);
                        oVM.setProperty("/loading", false);
                    }
                }

                // 1) Rows: ONE request only (no separate $count call).
                //    Resolved when the table's own binding has received its data.
                var pRows = new Promise(function (resolve) {
                    oTable.bindRows({
                        path: "/PricingRegionSet",
                        // filters: [that._getMailFilter()],
                        parameters: {
                            operationMode: "Client", // load all rows in a single GET
                            countMode: "Inline"      // count comes with the data, no GET $count
                        },
                        events: {
                            dataReceived: function (oEvent) {
                                var oData = oEvent.getParameter("data");
                                resolve((oData && oData.results) || []);
                            }
                        }
                    });
                });

                // 2) Slabs: read in parallel with the rows
                var aMailFilter = aMails.length ? [this._getMailFilter()] : null;
                var pExpense = aMailFilter ? this._readSet("/RTOExpenseSet", aMailFilter) : Promise.resolve([]);
                var pMaster = aMailFilter ? this._readSet("/RtoMasterSet", aMailFilter) : Promise.resolve([]);

                // 3) Everything received -> build columns once -> stop loading
                Promise.all([pRows, pExpense, pMaster]).then(function (aResults) {

                    if (iToken !== that._iLoadToken) { return; } // stale response

                    var aPricing = aResults[0];
                    var aExpense = aResults[1];
                    var aMaster = aResults[2];

                    that._allData = aPricing.map(function (oRow, i) {
                        oRow._snapshotIndex = i;
                        return oRow;
                    });
                    that._buildFilterDropdowns(aPricing);

                    var mRegions = {};
                    aPricing.forEach(function (oRow) {
                        var s = String(oRow.Region || "").trim();
                        if (s) { mRegions[s] = true; }
                    });

                    var oExp = that._buildExpenseMap(aExpense, mRegions);
                    var oMst = that._buildMasterMap(aMaster, mRegions);

                    that._aSlabs = oExp.slabs;
                    that._aMasterSlabs = oMst.slabs;

                    oView.getModel("slabs").setProperty("/map", oExp.map);
                    oView.getModel("rtoMasterSlabs").setProperty("/map", oMst.map);

                    that._buildSlabColumns(that._aSlabs);

                    loadingOff();

                }).catch(function (oError) {
                    if (iToken !== that._iLoadToken) { return; }
                    console.error("Load failed:", oError);
                    loadingOff();
                    MessageBox.error("Failed to load data. Please refresh and try again.");
                });
            },

            // Full reload (used after submit and clear filter)
            _loadPricingRegion: function () {
                this._loadAll();
            },

            // ============================================================
            // BUILD SLAB MAPS (pure, no OData calls)
            // ============================================================

            _buildExpenseMap: function (aResults, mRegions) {
                var mMap = {};
                var mSlabs = {};

                aResults.forEach(function (oRow) {
                    var sRegion = String(oRow.RegionCode || "").trim();
                    var sEngine = String(oRow.EngineType || "").trim();
                    var iSlab = Number(oRow.Slab);

                    if (!sRegion || !mRegions[sRegion] || !(iSlab >= 1)) {
                        return;
                    }

                    mSlabs[iSlab] = true;

                    var sKey = sRegion + "|" + sEngine;
                    var iTime = this._toTime(oRow.FromDate);

                    mMap[sKey] = mMap[sKey] || {};
                    var oCurrent = mMap[sKey][iSlab];

                    // keep the latest FromDate per region, engine and slab
                    if (!oCurrent || iTime >= oCurrent.time) {
                        mMap[sKey][iSlab] = { time: iTime, expense: oRow.Expense };
                    }
                }.bind(this));

                return {
                    map: mMap,
                    slabs: Object.keys(mSlabs).map(Number).sort(function (a, b) { return a - b; })
                };
            },

            _buildMasterMap: function (aResults, mRegions) {
                var mMap = {};
                var mSlabs = {};

                aResults.forEach(function (oRow) {
                    var sRegion = String(oRow.RegionCode || oRow.Region || "").trim();
                    var sEngine = String(oRow.EngineType || "").trim();
                    var iSlab = Number(oRow.Slab);

                    if (!sRegion || !mRegions[sRegion] || !(iSlab >= 1)) {
                        return;
                    }

                    // Use RtoPercent when nonzero; otherwise use PriceValue
                    var vPct = oRow.RtoPercent;
                    var vValue =
                        vPct === null || vPct === undefined || vPct === "" || Number(vPct) === 0
                            ? oRow.PriceValue
                            : vPct;

                    if (vValue === null || vValue === undefined || vValue === "") {
                        return;
                    }

                    mSlabs[iSlab] = true;

                    var sKey = sRegion + "|" + sEngine;
                    var iTime = this._toTime(oRow.FromDate);

                    mMap[sKey] = mMap[sKey] || {};
                    var oCurrent = mMap[sKey][iSlab];

                    if (!oCurrent || iTime >= oCurrent.time) {
                        mMap[sKey][iSlab] = { time: iTime, value: vValue };
                    }
                }.bind(this));

                return {
                    map: mMap,
                    slabs: Object.keys(mSlabs).map(Number).sort(function (a, b) { return a - b; })
                };
            },

            // ============================================================
            // SLAB VALUE LOOKUPS
            // ============================================================

            _toTime: function (vDate) {
                if (!vDate) { return 0; }
                if (vDate instanceof Date) { return vDate.getTime(); }
                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    return parseInt(vDate.match(/-?\d+/)[0], 10);
                }
                var iTime = new Date(vDate).getTime();
                return isNaN(iTime) ? 0 : iTime;
            },

            _getSlabValue: function (sRegion, sEngine, mMap, iSlab) {
                if (!mMap || !sRegion) { return ""; }

                sRegion = String(sRegion).trim();
                sEngine = String(sEngine || "").trim();

                // exact match: region + engine type
                var oEntry = mMap[sRegion + "|" + sEngine];

                // fallback: any engine type for that region
                if (!oEntry || !oEntry[iSlab]) {
                    oEntry = null;
                    Object.keys(mMap).some(function (sKey) {
                        if (sKey.indexOf(sRegion + "|") === 0 && mMap[sKey][iSlab]) {
                            oEntry = mMap[sKey];
                            return true;
                        }
                        return false;
                    });
                }

                return oEntry && oEntry[iSlab] ? String(oEntry[iSlab].expense) : "";
            },

            _getMasterSlabValue: function (sRegion, sEngine, mMap, iSlab) {
                if (!mMap || !sRegion) { return ""; }

                sRegion = String(sRegion).trim();
                sEngine = String(sEngine || "").trim();

                var oEntry = mMap[sRegion + "|" + sEngine];

                // fallback: any engine type for that region
                if (!oEntry || !oEntry[iSlab]) {
                    oEntry = null;
                    Object.keys(mMap).some(function (sKey) {
                        if (sKey.indexOf(sRegion + "|") === 0 && mMap[sKey][iSlab]) {
                            oEntry = mMap[sKey];
                            return true;
                        }
                        return false;
                    });
                }

                return oEntry && oEntry[iSlab] ? String(oEntry[iSlab].value) : "";
            },

            formatSlab1: function (r, e, m) { return this._getSlabValue(r, e, m, 1); },
            formatSlab2: function (r, e, m) { return this._getSlabValue(r, e, m, 2); },
            formatSlab3: function (r, e, m) { return this._getSlabValue(r, e, m, 3); },
            formatSlab4: function (r, e, m) { return this._getSlabValue(r, e, m, 4); },

            // ============================================================
            // BUILD SLAB COLUMNS DYNAMICALLY (right after Region column)
            // ============================================================

            _buildSlabColumns: function (aSlabs) {
                var oTable = this.byId("AppendedReportTable");
                var that = this;

                if (!oTable) {
                    return;
                }

                aSlabs = aSlabs || [];
                var aMasterSlabs = this._aMasterSlabs || [];

                // Remove previously generated columns
                (this._aSlabColumns || []).forEach(function (oCol) {
                    oTable.removeColumn(oCol);
                    oCol.destroy();
                });

                (this._aMasterSlabColumns || []).forEach(function (oCol) {
                    oTable.removeColumn(oCol);
                    oCol.destroy();
                });

                this._aSlabColumns = [];
                this._aMasterSlabColumns = [];

                // RTO EXPENSE SLAB COLUMNS
                aSlabs.forEach(function (iSlab, i) {
                    var oCol = new sap.ui.table.Column({
                        width: "110px",
                        hAlign: "Center",
                        headerSpan: i === 0 ? [aSlabs.length, 1] : [1, 1],
                        multiLabels: [
                            new sap.m.Label({
                                text: "RTO Expense Slab",
                                textAlign: "Center",
                                width: "100%"
                            }),
                            new sap.m.Label({
                                text: "Slab " + iSlab,
                                textAlign: "Center",
                                width: "100%"
                            })
                        ],
                        template: new sap.m.Text({
                            text: {
                                parts: [
                                    { path: "Region" },
                                    { path: "EngineType" },
                                    { path: "slabs>/map" }
                                ],
                                formatter: function (sRegion, sEngine, mMap) {
                                    return that._getSlabValue(sRegion, sEngine, mMap, iSlab);
                                }
                            }
                        })
                    });

                    oTable.insertColumn(oCol, 1 + i);
                    that._aSlabColumns.push(oCol);
                });

                // RTO MASTER SLAB COLUMNS
                aMasterSlabs.forEach(function (iSlab, i) {
                    var oCol = new sap.ui.table.Column({
                        width: "110px",
                        hAlign: "Center",
                        headerSpan: i === 0 ? [aMasterSlabs.length, 1] : [1, 1],
                        multiLabels: [
                            new sap.m.Label({
                                text: "RTO Master Slab",
                                textAlign: "Center",
                                width: "100%"
                            }),
                            new sap.m.Label({
                                text: "Slab " + iSlab,
                                textAlign: "Center",
                                width: "100%"
                            })
                        ],
                        template: new sap.m.Text({
                            text: {
                                parts: [
                                    { path: "Region" },
                                    { path: "EngineType" },
                                    { path: "rtoMasterSlabs>/map" }
                                ],
                                formatter: function (sRegion, sEngine, mMap) {
                                    return that._getMasterSlabValue(sRegion, sEngine, mMap, iSlab);
                                }
                            }
                        })
                    });

                    oTable.insertColumn(oCol, 1 + aSlabs.length + i);
                    that._aMasterSlabColumns.push(oCol);
                });
            },

            // ============================================================
            // NAVIGATION
            // ============================================================

            onNavBack: function () {

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                this._clearDraftRows();

                var oHistory = sap.ui.core.routing.History.getInstance();
                var sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    this.getOwnerComponent()
                        .getRouter()
                        .navTo("RouteSelectToEditMasterData", {}, true);
                }
            },

            // ============================================================
            // FILTER DROPDOWNS
            // ============================================================

            _buildFilterDropdowns: function (aData) {

                var aRegions = [];
                var aEngineTypes = [];
                var oSeenRegion = {};
                var oSeenEngine = {};

                aData.forEach(function (oRow) {

                    if (oRow.Region && !oSeenRegion[oRow.Region]) {
                        oSeenRegion[oRow.Region] = true;
                        aRegions.push({
                            Region: oRow.Region,
                            Display: oRow.Region
                        });
                    }

                    if (oRow.EngineType && !oSeenEngine[oRow.EngineType]) {
                        oSeenEngine[oRow.EngineType] = true;
                        aEngineTypes.push({
                            EngineType: oRow.EngineType,
                            Display: oRow.EngineType
                        });
                    }
                });

                this.getView().setModel(
                    new JSONModel({
                        Region: aRegions,
                        EngineType: aEngineTypes
                    }),
                    "filter"
                );
            },

            // ============================================================
            // APPLY FILTER
            // ============================================================

            onApplyFilter: function () {

                var aRegions = this.byId("filterRegion").getSelectedKeys();
                var aEngineTypes = this.byId("filterEngineType").getSelectedKeys();

                var aFiltered = this._allData ? this._allData.slice() : [];

                if (aRegions.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aRegions.includes(oRow.Region);
                    });
                }

                if (aEngineTypes.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aEngineTypes.includes(oRow.EngineType);
                    });
                }

                this._isFiltered = true;

                var aCloned = JSON.parse(JSON.stringify(aFiltered));
                var oTable = this.byId("AppendedReportTable");

                oTable.setModel(new JSONModel(aCloned));
                oTable.bindRows("/");
            },

            // ============================================================
            // CLEAR FILTER
            // ============================================================

            onClearFilter: function () {
                var oRegionFilter = this.byId("filterRegion");
                if (oRegionFilter) {
                    oRegionFilter.removeAllSelectedItems();
                }

                var oEngineFilter = this.byId("filterEngineType");
                if (oEngineFilter) {
                    oEngineFilter.removeAllSelectedItems();
                }

                this._isFiltered = false;

                // Full reload: slabs + rows, table shown only when everything is ready
                this._loadAll();

                MessageToast.show("Filters cleared successfully");
            },

            // ============================================================
            // CREATE NEW ROW
            // ============================================================

            onCreateMasterRow: function () {

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    MessageToast.show("Table not ready");
                    return;
                }

                // Only normal PricingRegionSet fields.
                // RTO Expense Slab and RTO Master Slab are display-only.
                oBinding.create({
                    Region: "",
                    EngineType: "EV",

                    Transportation: "0.000",
                    OtExpGt500: "0.000",
                    OtExpLt500: "0.000",
                    InsuranceLe350: "0.000000",
                    InsuranceGt350: "0.000000",
                    TpaPaGt350: "0.000",
                    TpaPaLe350: "0.000",
                    BuffPdi: "0.000",
                    HsprRate: "0.000",
                    NoPlateWrit: "0.000",
                    PetrolUpto500: "0.000",
                    PetrolGt500: "0.000",
                    RtoExpense: "0.000",

                    Ort01: "",
                    BasisRto: "",

                    _selectedForDelete: false
                });
            },

            // ============================================================
            // SELECT NEW ROW
            // ============================================================

            onNewRowSelect: function (oEvent) {

                var oCheckBox = oEvent.getSource();
                var oContext = oCheckBox.getBindingContext();

                if (!oContext || !oContext.isTransient()) {
                    return;
                }

                oContext.getModel().setProperty(
                    oContext.getPath() + "/_selectedForDelete",
                    oCheckBox.getSelected()
                );
            },

            // ============================================================
            // DELETE SELECTED NEW ROWS
            // ============================================================

            onDeleteSelectedRows: function () {

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    MessageToast.show("Table not ready");
                    return;
                }

                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                var aSelectedRows = aContexts.filter(function (oContext) {
                    return (
                        oContext &&
                        oContext.isTransient() &&
                        oContext.getProperty("_selectedForDelete") === true
                    );
                });

                if (!aSelectedRows.length) {
                    MessageToast.show("Please select at least one newly created row");
                    return;
                }

                aSelectedRows.forEach(function (oContext) {
                    if (oContext.isTransient()) {
                        oContext.delete();
                    }
                });

                MessageToast.show(aSelectedRows.length + " row(s) removed successfully");
            },

            // ============================================================
            // CLEAR DRAFT ROWS
            // ============================================================

            _clearDraftRows: function () {

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    return;
                }

                oBinding.getContexts().forEach(function (oContext) {
                    if (oContext && oContext.isTransient()) {
                        oContext.delete();
                    }
                });

                var oModel = this.getView().getModel();

                if (oModel && oModel.hasPendingChanges()) {
                    oModel.resetChanges();
                }

                oBinding.refresh();
            },

            // ============================================================
            // SUBMIT
            //
            // CREATE   -> POST
            // EXISTING -> PUT
            // ============================================================

            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");
                var oView = this.getView();
                var that = this;

                if (!oBinding) {
                    MessageToast.show("Table not ready");
                    return;
                }

                var aContexts = oBinding.getContexts();
                var mPending = oModel.getPendingChanges();

                var bHasChanges = false;
                var iPendingOperations = 0;
                var bHasError = false;

                function getErrorMessage(oError) {
                    var sMessage = "An error occurred while saving. Please try again.";

                    try {
                        var oBody = JSON.parse(oError.responseText);

                        if (oBody.error && oBody.error.message) {
                            sMessage = oBody.error.message.value || oBody.error.message;
                        }
                    } catch (e) { }

                    return sMessage;
                }

                function operationDone() {
                    iPendingOperations--;

                    if (iPendingOperations <= 0) {
                        oView.setBusy(false);

                        if (!bHasError) {
                            MessageToast.show("Saved successfully");
                        }

                        that._loadAll();
                    }
                }

                function cleanPayload(oData) {
                    var oPayload = Object.assign({}, oData);
                    delete oPayload.__metadata;
                    delete oPayload._snapshotIndex;
                    delete oPayload._selectedForDelete;
                    return oPayload;
                }

                aContexts.forEach(function (oContext) {

                    if (!oContext) {
                        return;
                    }

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
                    var oData = oContext.getObject();

                    // ---------------- NEW ROW ----------------
                    if (oContext.isTransient()) {

                        var oCreatePayload = cleanPayload(oData);
                        this._normalizeNumericFields(oCreatePayload);

                        console.log("CREATE PricingRegion payload:", oCreatePayload);

                        iPendingOperations++;
                        bHasChanges = true;

                        // Remove transient context
                        oContext.delete();

                        oModel.create("/PricingRegionSet", oCreatePayload, {
                            success: function (oResponse) {
                                console.log("CREATE success:", oResponse);
                                operationDone();
                            },
                            error: function (oError) {
                                console.error("CREATE failed:", oError);
                                bHasError = true;
                                MessageBox.error(getErrorMessage(oError));
                                operationDone();
                            }
                        });

                        return;
                    }

                    // ---------------- EXISTING ROW ----------------
                    if (mPending && mPending[sKey]) {

                        var oPutData = cleanPayload(oData);
                        this._normalizeNumericFields(oPutData);

                        console.log("UPDATE PricingRegion path:", sPath);
                        console.log("UPDATE PricingRegion payload:", oPutData);

                        // Clear UI5 pending change
                        oModel.resetChanges([sPath]);

                        iPendingOperations++;
                        bHasChanges = true;

                        oModel.update(sPath, oPutData, {
                            merge: false,
                            success: function (oResponse) {
                                console.log("UPDATE success:", oResponse);
                                operationDone();
                            },
                            error: function (oError) {
                                console.error("UPDATE failed:", oError);
                                bHasError = true;
                                MessageBox.error(getErrorMessage(oError));
                                operationDone();
                            }
                        });
                    }

                }.bind(this));

                if (!bHasChanges) {
                    MessageToast.show("No changes to save");
                    return;
                }

                // setBusy only AFTER all operations are counted
                oView.setBusy(true);
            },

            // ============================================================
            // NORMALIZE NUMBER FIELDS
            // ============================================================

            _normalizeNumericFields: function (oData) {

                var aNumericFields = [
                    "Transportation",
                    "OtExpGt500",
                    "OtExpLt500",
                    "InsuranceLe350",
                    "InsuranceGt350",
                    "TpaPaGt350",
                    "TpaPaLe350",
                    "BuffPdi",
                    "HsprRate",
                    "NoPlateWrit",
                    "PetrolUpto500",
                    "PetrolGt500",
                    "RtoExpense"
                ];

                aNumericFields.forEach(function (sField) {
                    if (
                        oData[sField] === null ||
                        oData[sField] === undefined ||
                        oData[sField] === ""
                    ) {
                        oData[sField] = 0;
                    } else {
                        oData[sField] = Number(oData[sField]);
                    }
                });
            },

            // ============================================================
            // SORT
            // ============================================================

            onSort: function (oEvent) {

                var oColumn = oEvent.getParameter("column");
                var sSortOrder = oEvent.getParameter("sortOrder");
                var sProperty = oColumn.getSortProperty();

                if (!sProperty) {
                    return;
                }

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    return;
                }

                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                var aData = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });

                var bDescending = sSortOrder === "Descending";

                aData.sort(function (a, b) {
                    var sA = String(a[sProperty] || "").toLowerCase();
                    var sB = String(b[sProperty] || "").toLowerCase();

                    if (sA < sB) { return bDescending ? 1 : -1; }
                    if (sA > sB) { return bDescending ? -1 : 1; }
                    return 0;
                });

                oTable.setModel(new JSONModel(aData));
                oTable.bindRows("/");

                oTable.getColumns().forEach(function (oCol) {
                    oCol.setSorted(false);
                });

                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },

            // ============================================================
            // EXCEL UPLOAD
            // ============================================================

            onUploadPress: function () {
                this._triggerFileInput();
            },

            _triggerFileInput: function () {

                if (!this._oFileInput) {

                    this._oFileInput = document.createElement("input");
                    this._oFileInput.type = "file";
                    this._oFileInput.accept = ".xlsx,.xls,.csv";
                    this._oFileInput.style.display = "none";

                    document.body.appendChild(this._oFileInput);

                    this._oFileInput.addEventListener("change", function (oEvent) {

                        var oFile = oEvent.target.files[0];

                        if (oFile) {
                            this._handleExcelFile(oFile);
                        }

                        oEvent.target.value = "";

                    }.bind(this));
                }

                this._oFileInput.click();
            },

            _handleExcelFile: function (oFile) {

                var reader = new FileReader();

                reader.onload = function (e) {

                    try {
                        var data = e.target.result;

                        var workbook = XLSX.read(data, { type: "binary" });
                        var sheetName = workbook.SheetNames[0];
                        var worksheet = workbook.Sheets[sheetName];
                        var aExcelData = XLSX.utils.sheet_to_json(worksheet);

                        console.log("Parsed Excel:", aExcelData);

                        this._insertIntoTable(aExcelData);

                    } catch (err) {
                        console.error("Excel parsing error:", err);
                        MessageBox.error("Unable to read Excel file.");
                    }

                }.bind(this);

                reader.readAsBinaryString(oFile);
            },

            // ============================================================
            // EXCEL -> TABLE
            // ============================================================

            _insertIntoTable: function (aExcelData) {

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    MessageToast.show("Table not ready");
                    return;
                }

                aExcelData.forEach(function (oRow) {

                    oBinding.create({
                        Region: oRow["Region"] || "",
                        EngineType: oRow["Engine Type"] || "EV",

                        Transportation: Number(oRow["Transportation"]) || 0,
                        OtExpGt500: Number(oRow["Other Exp. GT 500"]) || 0,
                        OtExpLt500: Number(oRow["Other Exp. LT 500"]) || 0,
                        InsuranceLe350: Number(oRow["Insurance <= 350"]) || 0,
                        InsuranceGt350: Number(oRow["Insurance > 350"]) || 0,
                        TpaPaGt350: Number(oRow["TPA PA GT 350"]) || 0,
                        TpaPaLe350: Number(oRow["TPA PA LE 350"]) || 0,
                        BuffPdi: Number(oRow["Buffing PDI"]) || 0,
                        HsprRate: Number(oRow["HSPR Rate"]) || 0,
                        NoPlateWrit: Number(oRow["No. Plate Writing"]) || 0,
                        PetrolUpto500: Number(oRow["Petrol Upto 500"]) || 0,
                        PetrolGt500: Number(oRow["Petrol GT 500"]) || 0,
                        RtoExpense: Number(oRow["RTO Expense"]) || 0,

                        Ort01: oRow["City"] || "",
                        BasisRto: oRow["Basis"] || "",

                        _selectedForDelete: false
                    });
                });

                MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            },

            // ============================================================
            // DOWNLOAD MENU
            // ============================================================

            onDownloadMenuPress: function (oEvent) {
                var oSheet = this.byId("downloadActionSheet");

                if (oSheet) {
                    oSheet.openBy(oEvent.getSource());
                }
            },

            // ============================================================
            // EXCEL FIELDS
            // ============================================================

            _getAllFields: function () {
                return [
                    { key: "Region", label: "Region" },

                    // RTO Expense Slab fields immediately after Region
                    ...(this._aSlabs || []).map(function (iSlab) {
                        return {
                            key: "RtoExpenseSlab" + iSlab,
                            label: "RTO Expense Slab - Slab " + iSlab
                        };
                    }),

                    // RTO Master Slab fields immediately after Expense Slabs
                    ...(this._aMasterSlabs || []).map(function (iSlab) {
                        return {
                            key: "RtoMasterSlab" + iSlab,
                            label: "RTO Master Slab - Slab " + iSlab
                        };
                    }),

                    { key: "EngineType", label: "Engine Type" },
                    { key: "Transportation", label: "Transportation" },
                    { key: "OtExpGt500", label: "Other Exp. GT 500" },
                    { key: "OtExpLt500", label: "Other Exp. LT 500" },
                    { key: "InsuranceLe350", label: "Insurance <= 350" },
                    { key: "InsuranceGt350", label: "Insurance > 350" },
                    { key: "TpaPaGt350", label: "TPA PA GT 350" },
                    { key: "TpaPaLe350", label: "TPA PA LE 350" },
                    { key: "BuffPdi", label: "Buffing PDI" },
                    { key: "HsprRate", label: "HSPR Rate" },
                    { key: "NoPlateWrit", label: "No. Plate Writing" },
                    { key: "PetrolUpto500", label: "Petrol Upto 500" },
                    { key: "PetrolGt500", label: "Petrol GT 500" },
                    { key: "RtoExpense", label: "RTO Expense" },
                    { key: "Ort01", label: "City" },
                    { key: "BasisRto", label: "Basis" }
                ];
            },

            // ============================================================
            // DOWNLOAD ALL
            // ============================================================

            onDownloadAll: function () {

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    MessageToast.show("No data available");
                    return;
                }

                var aData = oBinding
                    .getContexts(0, oBinding.getLength())
                    .map(function (oContext) {
                        return oContext.getObject();
                    });

                if (!aData.length) {
                    MessageToast.show("No data to download");
                    return;
                }

                this._exportToExcel(aData, this._getAllFields());
            },

            // ============================================================
            // EXPORT EXCEL
            // ============================================================

            _exportToExcel: function (aData, aFields) {
                var EdmType = sap.ui.require("sap/ui/export/library").EdmType;
                var that = this;

                var oSlabModel = this.getView().getModel("slabs");
                var oMasterSlabModel = this.getView().getModel("rtoMasterSlabs");

                var mExpenseSlabs = oSlabModel ? oSlabModel.getProperty("/map") || {} : {};
                var mMasterSlabs = oMasterSlabModel ? oMasterSlabModel.getProperty("/map") || {} : {};

                var aProcessedData = aData.map(function (oRow) {
                    var oCopy = Object.assign({}, oRow);

                    var sRegion = String(oRow.Region || "").trim();
                    var sEngine = String(oRow.EngineType || "").trim();

                    delete oCopy.__metadata;
                    delete oCopy._snapshotIndex;
                    delete oCopy._selectedForDelete;

                    // RTO Expense Slab values
                    (that._aSlabs || []).forEach(function (iSlab) {
                        oCopy["RtoExpenseSlab" + iSlab] =
                            that._getSlabValue(sRegion, sEngine, mExpenseSlabs, iSlab);
                    });

                    // RTO Master Slab values
                    (that._aMasterSlabs || []).forEach(function (iSlab) {
                        oCopy["RtoMasterSlab" + iSlab] =
                            that._getMasterSlabValue(sRegion, sEngine, mMasterSlabs, iSlab);
                    });

                    return oCopy;
                });

                var oSettings = {
                    workbook: {
                        columns: aFields.map(function (f) {
                            return {
                                label: f.label,
                                property: f.key,
                                type: EdmType.String
                            };
                        })
                    },
                    dataSource: aProcessedData,
                    fileName: "AppendedReport_Export.xlsx"
                };

                var oSheet = new Spreadsheet(oSettings);

                oSheet.build().finally(function () {
                    oSheet.destroy();
                });
            },

            // ============================================================
            // SELECT FIELDS
            // ============================================================

            onExcelDownload: function () {

                this.getView().setModel(
                    new JSONModel({ fields: this._getAllFields() }),
                    "fields"
                );

                this.byId("fieldSelectDialog").open();
            },


            onDownloadSelectedFields: function () {

                var oList = this.byId("fieldList");
                var aSelectedItems = oList.getSelectedItems();

                if (!aSelectedItems.length) {
                    MessageToast.show("Select at least one field");
                    return;
                }

                var aSelectedFields = aSelectedItems.map(function (oItem) {
                    return oItem.getBindingContext("fields").getObject();
                });

                var oTable = this.byId("AppendedReportTable");
                var oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    return;
                }

                var aData = oBinding
                    .getContexts(0, oBinding.getLength())
                    .map(function (oContext) {
                        return oContext.getObject();
                    });

                this._exportToExcel(aData, aSelectedFields);

                this.byId("fieldSelectDialog").close();
            },


            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            }

        });
    }
);