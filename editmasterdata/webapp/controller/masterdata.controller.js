sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/routing/History",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, History, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.masterdata", {

            // onInit: async function () {

            //     console.log("INIT WORKING");

            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

            //     let sASMMail = "siva.durairaj@laderatechnology.com";

            //     var oDatePicker = this.byId("yourDatePickerId");
            //     if (oDatePicker) {
            //         oDatePicker.setMinDate(new Date());
            //     }


            //     if (sap.ushell && sap.ushell.Container) {
            //         const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
            //         sASMMail = oUserInfo.getEmail();
            //     }

            //     oVM.setProperty("/ASMEmail", sASMMail);

            //     const oTable = this.byId("modelTable");

            //     oTable.bindRows({
            //         path: "/ModelMasterSet",
            //         filters: [
            //             new sap.ui.model.Filter("Mail", "EQ", sASMMail)
            //         ],

onInit: async function () {

    const oVM = new sap.ui.model.json.JSONModel({ readOnly: false });
    this.getView().setModel(oVM, "viewModel");

    var oDatePicker = this.byId("yourDatePickerId");
    if (oDatePicker) {
        oDatePicker.setMinDate(new Date());
    }

     var oToday = new Date();
    oToday.setHours(0, 0, 0, 0);

    this.getView().setModel(new sap.ui.model.json.JSONModel({
        minDate: oToday
    }), "view");

    // 1. wait for the role check in Component.js
    const oComp = this.getOwnerComponent();
    await oComp.getRoleReady();
    const oUser = oComp.getModel("user");

    // own mail: used ONLY when creating rows (ASM name)
    oVM.setProperty("/ASMEmail", oUser.getProperty("/email"));

    // 2. decide whose data to show (reference / filter only)
    let aViewMails = [];
    if (oUser.getProperty("/isSubmitter")) {
        aViewMails = [oUser.getProperty("/email")];
    } else if (oUser.getProperty("/isApprover")) {
        aViewMails = oUser.getProperty("/submitterEmails") || [];
        oVM.setProperty("/readOnly", true);   // approver only views submitter data
    }
    oVM.setProperty("/viewMails", aViewMails);

    const oTable = this.byId("modelTable");

    oTable.bindRows({
        path: "/ModelMasterSet",
        filters: [this._getMailFilter()],
        events: {

                        dataReceived: function (oEvent) {

                            // ✅ Existing logic — unchanged
                            var oModel = this.getView().getModel();
                            var aData = oModel.getProperty("/ModelMasterSet");


                            if (aData && Array.isArray(aData)) {
                                aData.forEach(function (item) {
                                    // mark existing rows
                                });
                                oModel.refresh(true);
                            }



                            // ✅ Snapshot with _snapshotIndex
                            const oEventData = oEvent.getParameter("data");
                            const aRows = (oEventData && oEventData.results) ? oEventData.results : [];

                            if (!aRows.length) return;

                            this._allData = aRows.map(function (oRow, i) {
                                oRow._snapshotIndex = i;
                                return oRow;
                            });

                            this._buildFilterDropdowns(aRows);

                        }.bind(this)
                    }
                });
            },

_getMailFilter: function () {
    const aMails = this.getView().getModel("viewModel").getProperty("/viewMails") || [];

    // no mails (no role, or no submitters maintained) → match nothing,
    // otherwise an empty filter would return ALL rows
    if (!aMails.length) {
        return new sap.ui.model.Filter("Mail", "EQ", "__NO_ACCESS__");
    }

    const aFilters = aMails.map(function (sMail) {
        return new sap.ui.model.Filter("Mail", "EQ", sMail);
    });

    return aFilters.length === 1
        ? aFilters[0]
        : new sap.ui.model.Filter({ filters: aFilters, and: false }); // OR
},

            onDeleteSelectedRows: function () {

                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const aContexts = oBinding.getContexts(
                    0,
                    oBinding.getLength()
                );

                // Get ALL selected newly-created rows
                const aSelectedRows = aContexts.filter(function (oContext) {

                    return oContext &&
                        oContext.isTransient() &&
                        oContext.getProperty("_selectedForDelete") === true;

                });

                if (!aSelectedRows.length) {

                    sap.m.MessageToast.show(
                        "Please select at least one newly created row"
                    );

                    return;
                }

                // Delete all selected rows
                aSelectedRows.forEach(function (oContext) {

                    if (oContext.isTransient()) {
                        oContext.delete();
                    }

                });

                sap.m.MessageToast.show(
                    aSelectedRows.length + " row(s) removed successfully"
                );
            },
            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                //Build dropdowns
                this._buildFilterDropdowns(aData);
            },
            _buildFilterDropdowns: function (aData) {

                const aModels = [];
                const aEngineType = [];
                const aCcWatt = [];
                const aModelFam = [];  // ✅ added

                const seenModel = {};
                const seenEngine = {};
                const seenCc = {};
                const seenFam = {};  // ✅ added

                aData.forEach(function (oRow) {

                    if (oRow.ModelCode && !seenModel[oRow.ModelCode]) {
                        seenModel[oRow.ModelCode] = true;
                        aModels.push({
                            ModelCode: oRow.ModelCode,
                            Display: oRow.ModelCode,
                        });
                    }

                    if (oRow.EngineType && !seenEngine[oRow.EngineType]) {
                        seenEngine[oRow.EngineType] = true;
                        aEngineType.push({
                            EngineType: oRow.EngineType  // ✅ fixed key — was "Type", XML binds to {filter>EngineType}
                        });
                    }

                    if (oRow.CcWatt && !seenCc[oRow.CcWatt]) {
                        seenCc[oRow.CcWatt] = true;
                        aCcWatt.push({
                            Ccwatt: oRow.CcWatt
                        });
                    }

                    if (oRow.ModelFam && !seenFam[oRow.ModelFam]) {  // ✅ added
                        seenFam[oRow.ModelFam] = true;
                        aModelFam.push({
                            ModelFam: oRow.ModelFam
                        });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        Models: aModels,
                        EngineType: aEngineType,
                        CcWatt: aCcWatt,
                        ModelFam: aModelFam   // ✅ added
                    }),
                    "filter"
                );
            },

            onApplyFilter: function () {
                const aModelCodes = this.byId("filterModelCode").getSelectedKeys();
                const aEngineTypes = this.byId("filterEngineType").getSelectedKeys();
                const aCcWatt = this.byId("filterCcType").getSelectedKeys();
                const aFamilies = this.byId("filterFamilyType").getSelectedKeys();

                let aFiltered = this._allData ? JSON.parse(JSON.stringify(this._allData)) : [];

                // ✅ Apply filters one by one
                if (aModelCodes.length) {
                    aFiltered = aFiltered.filter(o => aModelCodes.includes(o.ModelCode));
                }

                if (aEngineTypes.length) {
                    aFiltered = aFiltered.filter(o => aEngineTypes.includes(o.EngineType));
                }

                if (aCcWatt.length) {
                    aFiltered = aFiltered.filter(o => aCcWatt.includes(o.CcWatt));
                }

                if (aFamilies.length) {
                    aFiltered = aFiltered.filter(o => aFamilies.includes(o.ModelFam));
                }

                // ✅ Fix Date for DatePicker
                aFiltered.forEach(function (oRow) {
                    if (oRow.FromDate) {
                        const d = new Date(oRow.FromDate);
                        if (!isNaN(d)) {
                            oRow.FromDate = d;
                        }
                    }
                });

                this._isFiltered = true;

                const oTable = this.byId("modelTable");
                oTable.setModel(new sap.ui.model.json.JSONModel(aFiltered));
                oTable.bindRows("/");
            },

            formatDate: function (vDate) {
                if (!vDate) return null;

                if (typeof vDate === "string" && vDate.indexOf("/Date(") >= 0) {
                    try {
                        const time = parseInt(vDate.match(/\d+/)[0], 10);
                        return new Date(time);
                    } catch (e) {
                        return null;
                    }
                }

                // Handle ISO / string dates
                const d = new Date(vDate);
                return isNaN(d.getTime()) ? null : d;
            },

            onDateChange: function (oEvent) {
                // The model typically updates automatically with two-way binding;
                // add validation here if you need it
                const oDP = oEvent.getSource();
                const d = oDP.getDateValue();
                if (!d) {
                    sap.m.MessageToast.show("Please select a valid date");
                }
            },

            // _toODataDate: function (vDate) {
            //     if (!vDate) return null;
            //     // Already OData format — leave it
            //     if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

            //     var oDate = vDate instanceof Date ? vDate : new Date(vDate);

            //     // ✅ Use LOCAL date parts → Date.UTC to avoid IST timezone shift
            //     var iMs = Date.UTC(
            //         oDate.getFullYear(),
            //         oDate.getMonth(),
            //         oDate.getDate()
            //     );

            //     return "/Date(" + iMs + ")/";
            // },

            _toODataDate: function (date) {
                if (!date) return null;

                // ✅ Guard: already an OData /Date(...)/ string → extract ms, re-pin to UTC midnight
                if (typeof date === "string" && date.indexOf("/Date(") === 0) {
                    var ms = parseInt(date.match(/\d+/)[0], 10);
                    var d0 = new Date(ms);
                    return "/Date(" + Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) + ")/";
                }

                var d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return null;

                // ✅ Use UTC constructor — local date parts stay pinned to UTC midnight (no IST shift)
                var utcMs = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
                return "/Date(" + utcMs + ")/";
            },

            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();
                this.byId("filterEngineType").removeAllSelectedItems();
                this.byId("filterCcType").removeAllSelectedItems();
                this.byId("filterFamilyType").removeAllSelectedItems();  // ✅ added

                this._isFiltered = false;

                const oTable = this.byId("modelTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/ModelMasterSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },


            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                const aContexts = oBinding.getContexts();

                aContexts.forEach(function (oCtx) {

                    if (oCtx.isTransient()) {
                        oCtx.delete();
                    }

                });

                if (oModel.hasPendingChanges()) {
                    oModel.resetChanges();
                }

                oBinding.refresh();
            },
            onNavBack: function () {

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                this._clearDraftRows();
                const oHistory = sap.ui.core.routing.History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("RouteSelectToEditMasterData", {}, true);
                }
            },




            onCreateMasterRow: function () {
                console.log("HI");

                const today = new Date();
                const utcMidnight = new Date(Date.UTC(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                ));

                var oTable = this.byId("modelTable");
                // 🔥 If filtered → restore OData first
                if (this._isFiltered) {
                    this.onClearFilter();
                }
                var oBinding = oTable.getBinding("rows");
                const oVm = this.getView().getModel('viewModel');
                const oMail = oVm.getProperty("/ASMEmail");
                const oNewContext = oBinding.create({
                    ModelCode: "",
                    OperationNo: 0,
                    EngineType: "EV",
                    OrdType: "",
                    FromDate: utcMidnight,
                    Mail: oMail,
                    CcWatt: "",
                    Description: "",
                    ModelFam: "",
                    GstPerc: "0.000",
                    DealerMargin: "0.000",
                    DealerMargCalc: "NDP",
                    DealerMargCostImp: "NSP",
                    CsdIndex: "",
                    CsdDisPerc: "0.000",
                    Gem: "0.000",
                    HelmetMargin:"0.000",
                    Helmet:"0.000",
                    ModelStatus: "Active",
                    Status: "SUBMITTED",
                    
                });

                this._newRowContext = oNewContext;
            },

            onNewRowSelect: function (oEvent) {

                const oCheckBox = oEvent.getSource();
                const oContext = oCheckBox.getBindingContext();

                if (!oContext || !oContext.isTransient()) {
                    return;
                }

                const bSelected = oCheckBox.getSelected();

                oContext.setProperty(
                    "_selectedForDelete",
                    bSelected
                );
            },
            formatDateText: function (vDate) {
                if (!vDate) {
                    return "";
                }

                var oDate;

                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var iTime = parseInt(vDate.match(/\d+/)[0], 10);
                    oDate = new Date(iTime);
                } else {
                    oDate = vDate instanceof Date ? vDate : new Date(vDate);
                }

                if (isNaN(oDate.getTime())) {
                    return "";
                }

                var aMonths = [
                    "January", "February", "March", "April",
                    "May", "June", "July", "August",
                    "September", "October", "November", "December"
                ];

                return oDate.getDate() + " " +
                    aMonths[oDate.getMonth()] + " " +
                    oDate.getFullYear();
            },

            // onSubmit: function () {

            //     var oModel = this.getView().getModel();
            //     var oTable = this.byId("modelTable");
            //     var oView  = this.getView();
            //     var that   = this;

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     // ✅ All 3 key fields that trigger DELETE + CREATE when any one changes
            //     var aKeyFields = ["ModelCode", "EngineType", "CcWatt"];

            //     // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/ModelMasterSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/ModelMasterSet", bIsFiltered);
            //                     }
            //                 });
            //             },
            //             error: function (oError) {
            //                 handleError(oError, sDeletePath, bIsFiltered);
            //                 onOperationDone(bIsFiltered);
            //             }
            //         });
            //     }

            //     // ─── HELPER: operation done counter ──────────────────────────────────────
            //     function onOperationDone(bIsFiltered) {
            //         iPendingOperations--;
            //         if (iPendingOperations === 0) {
            //             oView.setBusy(false);
            //             if (!bHasError) {
            //                 sap.m.MessageToast.show("Saved successfully");
            //             }
            //             if (bIsFiltered) {
            //                 that.onClearFilter();
            //             } else {
            //                 // ✅ Refresh table after all operations complete
            //                 that.byId("modelTable").getBinding("rows").refresh();
            //             }
            //         }
            //     }

            //     // ─── HELPER: error handler ────────────────────────────────────────────────
            //     function handleError(oError, sPath, bIsFiltered) {
            //         console.error("Operation failed:", sPath, oError);
            //         bHasError = true;
            //         oView.setBusy(false);

            //         var sMessage = "An error occurred while saving. Please try again.";
            //         try {
            //             var oBody = JSON.parse(oError.responseText);
            //             if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                 sMessage = oBody.error.message.value;
            //             }
            //         } catch (e) {}

            //         sap.m.MessageBox.error(sMessage);
            //         onOperationDone(bIsFiltered);
            //     }

            //     // ─── FILTERED FLOW ────────────────────────────────────────────────────────
            //     if (this._isFiltered) {

            //         var oTableModel       = oTable.getModel();
            //         var aFilteredData     = oTableModel.getProperty("/") || [];
            //         var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

            //         var aIgnoreKeys  = ["__metadata", "Status", "_snapshotIndex"];
            // function normDate(v) {
            //     if (!v) return null;
            //     if (typeof v === "string" && v.indexOf("/Date(") === 0) {
            //         return parseInt(v.match(/\d+/)[0], 10);
            //     }
            //     var d = v instanceof Date ? v : new Date(v);
            //     return isNaN(d.getTime()) ? null : d.getTime();
            // }

            //         var aChangedRows = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.ModelCode  === oFilteredRow.ModelCode  &&
            //                            o.EngineType === oFilteredRow.EngineType &&
            //                            o.CcWatt     === oFilteredRow.CcWatt;
            //                 });
            //             }

            //             var bChanged = false;

            //             if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1;
            //                 });
            //              bChanged = aKeys.some(function (k) {
            //     if (k === "FromDate") {
            //         return normDate(oFilteredRow[k]) !== normDate(oOriginalRow[k]);
            //     }
            //     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            // });
            //             }

            //             console.log(
            //                 "Row → ModelCode:", oFilteredRow.ModelCode,
            //                 "| EngineType:", oFilteredRow.EngineType,
            //                 "| CcWatt:", oFilteredRow.CcWatt,
            //                 "| SnapshotIndex:", oFilteredRow._snapshotIndex,
            //                 "| Changed:", bChanged
            //             );

            //             if (bChanged) {
            //                 aChangedRows.push({
            //                     oRow:         oFilteredRow,
            //                     oOriginalRow: oOriginalRow
            //                 });
            //             }
            //         });

            //         if (aChangedRows.length === 0) {
            //             sap.m.MessageToast.show("No changes to save");
            //             return;
            //         }

            //         var aDeleteCreate = [];
            //         var aPutRows      = [];

            //         aChangedRows.forEach(function (oItem) {
            //             var bKeyChanged = oItem.oOriginalRow && aKeyFields.some(function (k) {
            //                 return String(oItem.oRow[k]) !== String(oItem.oOriginalRow[k]);
            //             });

            //             if (bKeyChanged) {
            //                 aDeleteCreate.push(oItem);
            //             } else {
            //                 aPutRows.push(oItem);
            //             }
            //         });

            //         iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2);

            //         oView.setBusy(true);

            // const toODataDate = (date) => that._toODataDate(date);

            //         // aPutRows.forEach(function (oItem) {

            //         //     var oRow         = oItem.oRow;

            //         //     console.log('Row has been created: ',oRow);

            //         //     var oOriginalRow = oItem.oOriginalRow;
            //         //         var dFromDate = oRow.FromDate ? new Date(oRow.FromDate) : new Date();


            //         //     var sPath = oModel.createKey("/ModelMasterSet", {
            //         //         // FromDate:   oOriginalRow ? oOriginalRow.FromDate   : oRow.FromDate,
            //         //         FromDate: oOriginalRow ? toODataDate(oOriginalRow.FromDate): oRow.FromDate,
            //         //         ModelCode:  oOriginalRow ? oOriginalRow.ModelCode  : oRow.ModelCode,
            //         //         EngineType: oOriginalRow ? oOriginalRow.EngineType : oRow.EngineType,
            //         //         CcWatt:     oOriginalRow ? oOriginalRow.CcWatt     : oRow.CcWatt
            //         //     });

            //         //     var oData = Object.assign({}, oRow);
            //         //     delete oData.__metadata;
            //         //     delete oData._snapshotIndex;
            //         //     oData.Status = "SUBMITTED";
            //         //     oData.FromDate = dFromDate;

            //         //     if (oOriginalRow && oOriginalRow.FromDate) {
            //         //         oData.FromDate = oOriginalRow.FromDate;
            //         //     }

            //         //     console.log("PUT path:", sPath, "| Data:", oData);

            //         //     oModel.update(sPath, oData, {
            //         //         merge: false,
            //         //         success: function () {
            //         //             console.log("PUT success:", sPath);
            //         //             onOperationDone(true);
            //         //         },
            //         //         error: function (oError) {
            //         //             handleError(oError, sPath, true);
            //         //         }
            //         //     });
            //         // });


            // aPutRows.forEach(function (oItem) {
            //     var oRow         = oItem.oRow;
            //     var oOriginalRow = oItem.oOriginalRow;

            //     // ✅ Look up the original snapshot to get the raw /Date(...)/ string
            //     //    (oOriginalRow.FromDate may be a Date object after sort/filter conversion)
            //     //    Same pattern as region master: use _allData snapshot for createKey
            //     var oSnap = that._allData ? that._allData.find(function (s) {
            //         return s._snapshotIndex === oOriginalRow._snapshotIndex ||
            //                (s.ModelCode  === oOriginalRow.ModelCode &&
            //                 s.EngineType === oOriginalRow.EngineType &&
            //                 s.CcWatt     === oOriginalRow.CcWatt);
            //     }) : null;

            //     // ✅ For createKey: use raw /Date(...)/ string from _allData (never a Date object)
            //     var vKeyFromDate = oSnap ? oSnap.FromDate : oOriginalRow.FromDate;

            //     var sPath = oModel.createKey("/ModelMasterSet", {
            //         FromDate:   vKeyFromDate,   // ✅ raw /Date(...)/ string — createKey handles it
            //         ModelCode:  oOriginalRow ? oOriginalRow.ModelCode  : oRow.ModelCode,
            //         EngineType: oOriginalRow ? oOriginalRow.EngineType : oRow.EngineType,
            //         CcWatt:     oOriginalRow ? oOriginalRow.CcWatt     : oRow.CcWatt
            //     });

            //     var oData = Object.assign({}, oRow);
            //     delete oData.__metadata;
            //     delete oData._snapshotIndex;
            //     oData.Status = "SUBMITTED";

            //     // ✅ For the PUT body: convert to OData date format
            //     //    oRow.FromDate is a Date object (from DatePicker/sort conversion)
            //     //    Use toODataDate to serialize it correctly
            //     oData.FromDate = that._toODataDate(oRow.FromDate);

            //     console.log("PUT path:", sPath, "| Body FromDate:", oData.FromDate);

            //     oModel.update(sPath, oData, {
            //         merge: false,
            //         success: function () {
            //             console.log("PUT success:", sPath);
            //             onOperationDone(true);
            //         },
            //         error: function (oError) {
            //             handleError(oError, sPath, true);
            //         }
            //     });
            // });
            //         aDeleteCreate.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sDeletePath = oModel.createKey("/ModelMasterSet", {
            //                 FromDate:   oOriginalRow.FromDate,
            //                 ModelCode:  oOriginalRow.ModelCode,
            //                 EngineType: oOriginalRow.EngineType,
            //                 CcWatt:     oOriginalRow.CcWatt
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.FromDate = oOriginalRow.FromDate;

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
            //     var aContexts = oTable.getBinding("rows").getContexts();

            //     sap.ui.getCore().applyChanges();
            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     var mPending    = oModel.getPendingChanges();
            //     var bHasChanges = false;

            //     // ✅ Build snapshot lookup by OData path for key field comparison
            //     var mSnapshotByPath = {};
            //     if (that._allData) {
            //         that._allData.forEach(function (oSnapRow) {
            //             var sSnapPath = oModel.createKey("/ModelMasterSet", {
            //                 FromDate:   oSnapRow.FromDate,
            //                 ModelCode:  oSnapRow.ModelCode,
            //                 EngineType: oSnapRow.EngineType,
            //                 CcWatt:     oSnapRow.CcWatt
            //             });
            //             mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
            //         });
            //     }



            //     aContexts.forEach(function (oContext) {

            //         var sPath = oContext.getPath();
            //         var sKey  = sPath.substring(1);
            //         var oData = oContext.getObject();

            //         // ── CREATE → POST (transient / new row) ───────────────────────────────
            //         if (oContext.isTransient()) {

            //             var oCreatePayload = Object.assign({}, oData);
            //             delete oCreatePayload.__metadata;
            //             delete oCreatePayload._snapshotIndex;
            //             oCreatePayload.Status = "SUBMITTED";
            //             oCreatePayload.FromDate = that._toODataDate(oCreatePayload.FromDate); 

            //             console.log("CREATE (transient) payload:", oCreatePayload);

            //             // ✅ Count operation BEFORE setBusy so counter is correct
            //             iPendingOperations++;
            //             bHasChanges = true;

            //              oContext.delete();

            //             oModel.create("/ModelMasterSet", oCreatePayload, {
            //                 success: function () {
            //                     console.log("CREATE success (transient)");
            //                     onOperationDone(false);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, "/ModelMasterSet", false);
            //                 }
            //             });

            //             return;
            //         }

            //         if (mPending[sKey]) {

            //             var oPending    = mPending[sKey];
            //             var oSnapRow    = mSnapshotByPath[sKey];
            //             var bKeyChanged = false;

            //             if (oSnapRow) {
            //                 var oMerged = Object.assign({}, oData, oPending);
            //                 bKeyChanged = aKeyFields.some(function (k) {
            //                     return String(oMerged[k]) !== String(oSnapRow[k]);
            //                 });
            //             }

            //             if (bKeyChanged) {

            //                 var oMergedData = Object.assign({}, oData, oPending);
            //                 var oCreateData = Object.assign({}, oMergedData);
            //                 delete oCreateData.__metadata;
            //                 delete oCreateData._snapshotIndex;
            //                 oCreateData.Status   = "SUBMITTED";
            //                 oCreateData.FromDate = oSnapRow.FromDate;

            //                 var sDeletePath = oModel.createKey("/ModelMasterSet", {
            //                     FromDate:   oSnapRow.FromDate,
            //                     ModelCode:  oSnapRow.ModelCode,
            //                     EngineType: oSnapRow.EngineType,
            //                     CcWatt:     oSnapRow.CcWatt
            //                 });

            //                 oModel.resetChanges([sPath]);

            //                 console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //                 console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //                 // ✅ Count 2 operations BEFORE setBusy
            //                 iPendingOperations += 2;
            //                 bHasChanges = true;

            //                 doDeleteCreate(sDeletePath, oCreateData, false);

            //                 return;
            //             }

            //             // ── Normal UPDATE → PUT (no key change) ───────────────────────────
            //             var oPutData = Object.assign({}, oData);
            //             delete oPutData.__metadata;
            //             delete oPutData._snapshotIndex;
            //             oPutData.Status = "SUBMITTED";
            //             oPutData.FromDate = that._toODataDate(oPutData.FromDate);

            //             oModel.resetChanges([sPath]);

            //             console.log("PUT path:", sPath, "| Data:", oPutData);

            //             // ✅ Count operation BEFORE setBusy
            //             iPendingOperations++;
            //             bHasChanges = true;

            //             oModel.update(sPath, oPutData, {
            //                 merge: false,
            //                 success: function () {
            //                     console.log("PUT success:", sPath);
            //                     onOperationDone(false);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, sPath, false);
            //                 }
            //             });
            //         }
            //     });

            //     if (!bHasChanges) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ✅ setBusy AFTER forEach so all iPendingOperations are counted first
            //     // and AFTER all oModel.create/update/remove calls are already fired
            //     oView.setBusy(true);
            // },


            // ─── CHUNK HELPER ────────────────────────────────────────────────────────────

            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("modelTable");
                var oView = this.getView();
                var that = this;

                var bHasError = false;
                var iPendingOperations = 0;

                // ✅ All 3 key fields that trigger DELETE + CREATE when any one changes
                var aKeyFields = ["ModelCode", "EngineType", "CcWatt"];

                // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
                function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
                    console.log("DELETE path:", sDeletePath);
                    console.log("CREATE payload:", oCreateData);

                    oModel.remove(sDeletePath, {
                        success: function () {
                            console.log("DELETE success:", sDeletePath);
                            onOperationDone(bIsFiltered);

                            oModel.create("/ModelMasterSet", oCreateData, {
                                success: function () {
                                    console.log("CREATE success after DELETE");
                                    onOperationDone(bIsFiltered);
                                },
                                error: function (oError) {
                                    handleError(oError, "/ModelMasterSet", bIsFiltered);
                                }
                            });
                        },
                        error: function (oError) {
                            handleError(oError, sDeletePath, bIsFiltered);
                            onOperationDone(bIsFiltered);
                        }
                    });
                }

                // ─── HELPER: operation done counter ──────────────────────────────────────
                function onOperationDone(bIsFiltered) {
                    iPendingOperations--;
                    if (iPendingOperations === 0) {
                        oView.setBusy(false);
                        if (!bHasError) {
                            sap.m.MessageToast.show("Saved successfully");
                        }
                        if (bIsFiltered) {
                            that.onClearFilter();
                        } else {
                            that.byId("modelTable").getBinding("rows").refresh();
                        }
                    }
                }

                // ─── HELPER: error handler ────────────────────────────────────────────────
                function handleError(oError, sPath, bIsFiltered) {
                    console.error("Operation failed:", sPath, oError);
                    bHasError = true;
                    oView.setBusy(false);

                    var sMessage = "An error occurred while saving. Please try again.";
                    try {
                        var oBody = JSON.parse(oError.responseText);
                        if (oBody.error && oBody.error.message && oBody.error.message.value) {
                            sMessage = oBody.error.message.value;
                        }
                    } catch (e) { }

                    sap.m.MessageBox.error(sMessage);
                    onOperationDone(bIsFiltered);
                }

                // ─── FILTERED FLOW ────────────────────────────────────────────────────────
                if (this._isFiltered) {

                    var oTableModel = oTable.getModel();
                    var aFilteredData = oTableModel.getProperty("/") || [];
                    var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

                    var aIgnoreKeys = ["__metadata", "Status", "_snapshotIndex"];

                    function normDate(v) {
                        if (!v) return null;
                        if (typeof v === "string" && v.indexOf("/Date(") === 0) {
                            return parseInt(v.match(/\d+/)[0], 10);
                        }
                        var d = v instanceof Date ? v : new Date(v);
                        return isNaN(d.getTime()) ? null : d.getTime();
                    }

                    var aChangedRows = [];

                    aFilteredData.forEach(function (oFilteredRow) {

                        var oOriginalRow = aOriginalSnapshot.find(function (o) {
                            return o._snapshotIndex === oFilteredRow._snapshotIndex;
                        });

                        if (!oOriginalRow) {
                            oOriginalRow = aOriginalSnapshot.find(function (o) {
                                return o.ModelCode === oFilteredRow.ModelCode &&
                                    o.EngineType === oFilteredRow.EngineType &&
                                    o.CcWatt === oFilteredRow.CcWatt;
                            });
                        }

                        var bChanged = false;

                        if (oOriginalRow) {
                            var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                                return aIgnoreKeys.indexOf(k) === -1;
                            });
                            bChanged = aKeys.some(function (k) {
                                if (k === "FromDate") {
                                    return normDate(oFilteredRow[k]) !== normDate(oOriginalRow[k]);
                                }
                                return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                            });
                        }

                        console.log(
                            "Row → ModelCode:", oFilteredRow.ModelCode,
                            "| EngineType:", oFilteredRow.EngineType,
                            "| CcWatt:", oFilteredRow.CcWatt,
                            "| SnapshotIndex:", oFilteredRow._snapshotIndex,
                            "| Changed:", bChanged
                        );

                        if (bChanged) {
                            aChangedRows.push({
                                oRow: oFilteredRow,
                                oOriginalRow: oOriginalRow
                            });
                        }
                    });

                    if (aChangedRows.length === 0) {
                        sap.m.MessageToast.show("No changes to save");
                        return;
                    }

                    var aDeleteCreate = [];
                    var aPutRows = [];

                    aChangedRows.forEach(function (oItem) {
                        var bKeyChanged = oItem.oOriginalRow && aKeyFields.some(function (k) {
                            return String(oItem.oRow[k]) !== String(oItem.oOriginalRow[k]);
                        });

                        if (bKeyChanged) {
                            aDeleteCreate.push(oItem);
                        } else {
                            aPutRows.push(oItem);
                        }
                    });

                    iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2);

                    oView.setBusy(true);

                    var toODataDate = function (date) { return that._toODataDate(date); };

                    aPutRows.forEach(function (oItem) {
                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        var oSnap = that._allData ? that._allData.find(function (s) {
                            return s._snapshotIndex === oOriginalRow._snapshotIndex ||
                                (s.ModelCode === oOriginalRow.ModelCode &&
                                    s.EngineType === oOriginalRow.EngineType &&
                                    s.CcWatt === oOriginalRow.CcWatt);
                        }) : null;

                        var vKeyFromDate = oSnap ? oSnap.FromDate : oOriginalRow.FromDate;

                        var sPath = oModel.createKey("/ModelMasterSet", {
                            FromDate: vKeyFromDate,
                            ModelCode: oOriginalRow ? oOriginalRow.ModelCode : oRow.ModelCode,
                            EngineType: oOriginalRow ? oOriginalRow.EngineType : oRow.EngineType,
                            CcWatt: oOriginalRow ? oOriginalRow.CcWatt : oRow.CcWatt
                        });

                        var oData = Object.assign({}, oRow);
                        delete oData.__metadata;
                        delete oData._snapshotIndex;
                        oData.Status = "SUBMITTED";
                        oData.FromDate = that._toODataDate(oRow.FromDate);

                        console.log("PUT path:", sPath, "| Body FromDate:", oData.FromDate);

                        oModel.update(sPath, oData, {
                            merge: false,
                            success: function () {
                                console.log("PUT success:", sPath);
                                onOperationDone(true);
                            },
                            error: function (oError) {
                                handleError(oError, sPath, true);
                            }
                        });
                    });

                    aDeleteCreate.forEach(function (oItem) {

                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        var sDeletePath = oModel.createKey("/ModelMasterSet", {
                            FromDate: oOriginalRow.FromDate,
                            ModelCode: oOriginalRow.ModelCode,
                            EngineType: oOriginalRow.EngineType,
                            CcWatt: oOriginalRow.CcWatt
                        });

                        var oCreateData = Object.assign({}, oRow);
                        delete oCreateData.__metadata;
                        delete oCreateData._snapshotIndex;
                        oCreateData.Status = "SUBMITTED";
                        oCreateData.FromDate = oOriginalRow.FromDate;

                        doDeleteCreate(sDeletePath, oCreateData, true);
                    });

                    return;
                }

                // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
                var oBinding = oTable.getBinding("rows");                        // ← NEW
                var aContexts = oBinding.getContexts(0, oBinding.getLength());   // ← CHANGED

                sap.ui.getCore().applyChanges();
                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                var mPending = oModel.getPendingChanges();
                var bHasChanges = false;

                // ✅ Build snapshot lookup by OData path for key field comparison
                var mSnapshotByPath = {};
                if (that._allData) {
                    that._allData.forEach(function (oSnapRow) {
                        var sSnapPath = oModel.createKey("/ModelMasterSet", {
                            FromDate: oSnapRow.FromDate,
                            ModelCode: oSnapRow.ModelCode,
                            EngineType: oSnapRow.EngineType,
                            CcWatt: oSnapRow.CcWatt
                        });
                        mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
                    });
                }

                // ── CHANGE: Collect transient rows separately for chunked submit ──────────
                var aTransientPayloads = [];

                aContexts.forEach(function (oContext) {

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
                    var oData = oContext.getObject();

                    // ── CREATE → collect for chunked POST ────────────────────────────────
                    if (oContext.isTransient()) {

                        var oCreatePayload = Object.assign({}, oData);
                        delete oCreatePayload.__metadata;
                        delete oCreatePayload._snapshotIndex;
                        oCreatePayload.Status = "SUBMITTED";
                        oCreatePayload.FromDate = that._toODataDate(oCreatePayload.FromDate);

                        // console.log("CREATE (transient) payload collected:", oCreatePayload);

                        aTransientPayloads.push(oCreatePayload);
                        oContext.delete(); // ✅ Remove transient context before real create

                        return;
                    }

                    if (mPending[sKey]) {

                        var oPending = mPending[sKey];
                        var oSnapRow = mSnapshotByPath[sKey];
                        var bKeyChanged = false;

                        if (oSnapRow) {
                            var oMerged = Object.assign({}, oData, oPending);
                            bKeyChanged = aKeyFields.some(function (k) {
                                return String(oMerged[k]) !== String(oSnapRow[k]);
                            });
                        }

                        if (bKeyChanged) {

                            var oMergedData = Object.assign({}, oData, oPending);
                            var oCreateData = Object.assign({}, oMergedData);
                            delete oCreateData.__metadata;
                            delete oCreateData._snapshotIndex;
                            oCreateData.Status = "SUBMITTED";
                            oCreateData.FromDate = oSnapRow.FromDate;

                            var sDeletePath = oModel.createKey("/ModelMasterSet", {
                                FromDate: oSnapRow.FromDate,
                                ModelCode: oSnapRow.ModelCode,
                                EngineType: oSnapRow.EngineType,
                                CcWatt: oSnapRow.CcWatt
                            });

                            oModel.resetChanges([sPath]);

                            console.log("DELETE+CREATE → DELETE path:", sDeletePath);
                            console.log("DELETE+CREATE → CREATE payload:", oCreateData);

                            iPendingOperations += 2;
                            bHasChanges = true;

                            doDeleteCreate(sDeletePath, oCreateData, false);

                            return;
                        }

                        // ── Normal UPDATE → PUT (no key change) ───────────────────────────
                        var oPutData = Object.assign({}, oData);
                        delete oPutData.__metadata;
                        delete oPutData._snapshotIndex;
                        oPutData.Status = "SUBMITTED";
                        oPutData.FromDate = that._toODataDate(oPutData.FromDate);

                        oModel.resetChanges([sPath]);

                        console.log("PUT path:", sPath, "| Data:", oPutData);

                        iPendingOperations++;
                        bHasChanges = true;

                        oModel.update(sPath, oPutData, {
                            merge: false,
                            success: function () {
                                console.log("PUT success:", sPath);
                                onOperationDone(false);
                            },
                            error: function (oError) {
                                handleError(oError, sPath, false);
                            }
                        });
                    }
                });

                // ── Submit all collected transient rows in chunks of 100 ─────────────────
                if (aTransientPayloads.length > 0) {
                    bHasChanges = true;
                    that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 1000);
                }

                if (!bHasChanges) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // ✅ setBusy only for non-transient operations (PUT / DELETE+CREATE)
                // _submitInChunks manages its own busy state for transient rows
                if (iPendingOperations > 0) {
                    oView.setBusy(true);
                }
            },
            _chunkArray: function (aArray, iSize) {
                var aChunks = [];
                for (var i = 0; i < aArray.length; i += iSize) {
                    aChunks.push(aArray.slice(i, i + iSize));
                }
                return aChunks;
            },

            // ─── CHUNKED CREATE — submits 100 rows at a time sequentially ────────────────
            // _submitInChunks: function (aAllRows, oBinding, iChunkSize) {
            //     var that        = this;
            //     var aChunks     = this._chunkArray(aAllRows, iChunkSize || 100);
            //     var iTotal      = aAllRows.length;
            //     var iSubmitted  = 0;
            //     var iChunkIndex = 0;
            //     var oView       = this.getView();
            //     var oModel      = this.getView().getModel();

            //     oView.setBusy(true);

            //     function submitNextChunk() {
            //         if (iChunkIndex >= aChunks.length) {
            //             // ✅ All chunks done
            //             oView.setBusy(false);
            //             sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully");
            //             oBinding.refresh();
            //             return;
            //         }

            //         var aChunk        = aChunks[iChunkIndex];
            //         var iPending      = aChunk.length;
            //         var bChunkError   = false;

            //         console.log("Submitting chunk", iChunkIndex + 1, "of", aChunks.length, "→", aChunk.length, "rows");

            //         // ✅ Defer each chunk so UI stays responsive
            //         oModel.setDeferredGroups(["chunkGroup"]);

            //         aChunk.forEach(function (oCreateData) {
            //             oModel.create("/ModelMasterSet", oCreateData, {
            //                 groupId: "chunkGroup"
            //             });
            //         });

            //         oModel.submitChanges({
            //             groupId: "chunkGroup",
            //             success: function () {
            //                 iSubmitted += aChunk.length;
            //                 iChunkIndex++;
            //                 console.log("Chunk", iChunkIndex, "done. Total submitted:", iSubmitted);
            //                 submitNextChunk(); // ✅ Submit next chunk after this one completes
            //             },
            //             error: function (oError) {
            //                 oView.setBusy(false);
            //                 bChunkError = true;
            //                 console.error("Chunk", iChunkIndex + 1, "failed:", oError);

            //                 var sMessage = "Batch failed at chunk " + (iChunkIndex + 1);
            //                 try {
            //                     var oBody = JSON.parse(oError.responseText);
            //                     if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                         sMessage = oBody.error.message.value;
            //                     }
            //                 } catch (e) {}

            //                 sap.m.MessageBox.error(sMessage + ". " + iSubmitted + " rows were already saved.");
            //             }
            //         });
            //     }

            //     submitNextChunk();
            // },

            _submitInChunks: function (aAllRows, oBinding, iChunkSize) {
                var that = this;
                var aChunks = this._chunkArray(aAllRows, iChunkSize || 500);
                var iTotal = aAllRows.length;
                var iSubmitted = 0;
                var iChunkIndex = 0;
                var oView = this.getView();
                var oModel = this.getView().getModel();

                oView.setBusy(true);

                function submitNextChunk() {
                    if (iChunkIndex >= aChunks.length) {
                        // ✅ All chunks done — refresh table and show correct count
                        oView.setBusy(false);
                        sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully.");

                        // ✅ Rebind to OData so saved rows load fresh from backend
                        var oTable = that.byId("modelTable");
                        var oVm = that.getView().getModel("viewModel");
                        var sMail = oVm.getProperty("/ASMEmail");

                        oTable.setModel(that.getView().getModel()); // ✅ restore OData model
                        oTable.bindRows({
                            path: "/ModelMasterSet",
                            filters: [
                                new sap.ui.model.Filter("Mail", "EQ", sMail)
                            ],
                            events: {
                                dataReceived: function (oEvent) {
                                    var oEventData = oEvent.getParameter("data");
                                    var aRows = (oEventData && oEventData.results) ? oEventData.results : [];
                                    if (!aRows.length) return;

                                    that._allData = aRows.map(function (oRow, i) {
                                        oRow._snapshotIndex = i;
                                        return oRow;
                                    });
                                    that._buildFilterDropdowns(aRows);
                                }
                            }
                        });

                        that._isFiltered = false;
                        return;
                    }

                    var aChunk = aChunks[iChunkIndex];
                    var sGroupId = "chunkGroup_" + iChunkIndex;

                    console.log("Submitting chunk", iChunkIndex + 1, "of", aChunks.length, "→", aChunk.length, "rows");

                    var aDeferred = oModel.getDeferredGroups();
                    if (aDeferred.indexOf(sGroupId) === -1) {
                        oModel.setDeferredGroups(aDeferred.concat([sGroupId]));
                    }

                    aChunk.forEach(function (oCreateData) {
                        oModel.create("/ModelMasterSet", oCreateData, {
                            groupId: sGroupId
                        });
                    });

                    oModel.submitChanges({
                        groupId: sGroupId,
                        success: function () {
                            iSubmitted += aChunk.length;
                            iChunkIndex++;
                            console.log("Chunk", iChunkIndex, "done. Total submitted:", iSubmitted);
                            submitNextChunk();
                        },
                        error: function (oError) {
                            oView.setBusy(false);
                            console.error("Chunk", iChunkIndex + 1, "failed:", oError);

                            var sMessage = "Batch failed at chunk " + (iChunkIndex + 1);
                            try {
                                var oBody = JSON.parse(oError.responseText);
                                if (oBody.error && oBody.error.message && oBody.error.message.value) {
                                    sMessage = oBody.error.message.value;
                                }
                            } catch (e) { }

                            sap.m.MessageBox.error(
                                sMessage + ". " + iSubmitted + " of " + iTotal + " rows were already saved."
                            );
                        }
                    });
                }

                submitNextChunk();
            },

            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");
                if (oSheet) oSheet.openBy(oEvent.getSource());
            },

            onExcelDownloadAll: function () {

                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("No data available");
                    return;
                }

                // ✅ Get ALL visible rows (filtered + edited)
                const iLength = oBinding.getLength();

                const aContexts = oBinding.getContexts(0, iLength);

                const aData = aContexts.map(oCtx => oCtx.getObject());

                if (!aData.length) {
                    sap.m.MessageToast.show("No data to download");
                    return;
                }

                // ✅ OPTIONAL: format date before export
                aData.forEach(o => {
                    if (o.FromDate instanceof Date) {
                        o.FromDate = o.FromDate.toISOString().substring(0, 10);
                    }
                });

                // ✅ Use your existing export logic
                const aAllFields = this._getAllFields ? this._getAllFields() : [
                    { key: "ModelCode", label: "Model Code" },
                    { key: "EngineType", label: "Engine Type" },
                    { key: "CcWatt", label: "CC/Watt" },
                    { key: "FromDate", label: "Effective Date" },
                    { key: "OrdType", label: "Model Type" },
                    { key: "Description", label: "Description" },
                    { key: "ModelFam", label: "Model Family" },
                    { key: "GstPerc", label: "GST%" },
                    { key: "DealerMargin", label: "Dealer Margin" },
                    { key: "DealerMargCalc", label: "Dealer Margin Calculation" },
                    { key: "DealerMargCostImp", label: "Dealer Margin Cost Impact" },
                    { key: "CsdIndex", label: "CSD Index Number" },
                   
                        { key: "CsdDisPerc", label: "CSD Discount Rate %" },   // ✅ added
    { key: "Gem", label: "GEM" },                           
                    { key: "Helmet", label: "Helmet Cost" },          // ✅ added
                    { key: "HelmetMargin", label: "Helmet Margin" },
                    { key: "ModelStatus", label: "Model Status" },
                    { key: "Status", label: "Status" }
                ];

                this._exportToExcel(aData, aAllFields);
            },

            _exportToExcel: function (aData, aSelectedFields) {
                const oSettings = {
                    workbook: {
                        columns: aSelectedFields.map(f => ({
                            label: f.label,
                            property: f.key,
                            type: sap.ui.export.EdmType.String
                        }))
                    },
                    dataSource: aData,
                    fileName: aData.length === 0
                        ? "ModelMaster_Template.xlsx"
                        : "ModelMaster_Export.xlsx"
                };
                const oSheet = new sap.ui.export.Spreadsheet(oSettings);
                oSheet.build().finally(() => oSheet.destroy());
            },


            onExcelDownload: function () {

                const aAllFields = this._getAllFields();

                const oModel = new sap.ui.model.json.JSONModel({
                    fields: aAllFields
                });

                this.getView().setModel(oModel, "fields");

                this.byId("fieldSelectDialog").open();
            },

            _getAllFields: function () {
                return [
                    { key: "ModelCode", label: "Model Code" },
                    { key: "EngineType", label: "Engine Type" },
                    { key: "CcWatt", label: "CC/Watt" },
                    { key: "FromDate", label: "Effective Date" },
                    { key: "OrdType", label: "Model Type" },
                    { key: "Description", label: "Description" },
                    { key: "ModelFam", label: "Model Family" },
                    { key: "GstPerc", label: "GST%" },
                    { key: "DealerMargin", label: "Dealer Margin" },
                    { key: "DealerMargCalc", label: "Dealer Margin Calculation" },
                    { key: "DealerMargCostImp", label: "Dealer Margin Cost Impact" },
                    { key: "CsdIndex", label: "CSD Index Number" },
                    { key: "CsdDisPerc", label: "CSD Discount Rate %" },
                    { key: "Gem", label: "GEM" },
                      { key: "Helmet", label: "Helmet Cost" },          // ✅ added
                      { key: "HelmetMargin", label: "Helmet Margin" },
                    { key: "ModelStatus", label: "Model Status" },
                    { key: "Status", label: "Status" }
                ];
            },

            onDownloadSelectedFields: function () {

                const oList = this.byId("fieldList");
                const aSelectedItems = oList.getSelectedItems();

                if (!aSelectedItems.length) {
                    sap.m.MessageToast.show("Select at least one field");
                    return;
                }

                // ✅ Get all fields (source of truth)
                const aAllFields = this._getAllFields();

                // ✅ Map selected UI items → actual fields
                const aSelectedFields = aSelectedItems.map(item => {
                    const oObj = item.getBindingContext("fields").getObject();
                    return {
                        key: oObj.key,
                        label: oObj.label
                    };
                });

                // ✅ Get table data (same as your Download All)
                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("No data available");
                    return;
                }

                const iLength = oBinding.getLength();
                const aContexts = oBinding.getContexts(0, iLength);
                const aData = aContexts.map(oCtx => oCtx.getObject());

                if (!aData.length) {
                    sap.m.MessageToast.show("No data to download");
                    return;
                }

                // ✅ Format date
                aData.forEach(o => {
                    if (o.FromDate instanceof Date) {
                        o.FromDate = o.FromDate.toISOString().substring(0, 10);
                    }
                });

                // ✅ Export
                this._exportToExcel(aData, aSelectedFields);

                // ✅ Close dialog
                this.byId("fieldSelectDialog").close();
            },

            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },

            onUploadPress: function () { this._triggerFileInput(); },
            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");
                if (oSheet) oSheet.openBy(oEvent.getSource());
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

            // _handleExcelFile: function (oFile) {
            //     if (!oFile) return;

            //     const sExt = oFile.name.split(".").pop().toLowerCase();
            //     if (!["xlsx", "xls", "csv"].includes(sExt)) {
            //         sap.m.MessageToast.show("Upload valid Excel/CSV");
            //         return;
            //     }

            //     const oVm = this.getView().getModel("viewModel");
            //     const oTable = this.byId("modelTable");
            //     const oBinding = oTable.getBinding("rows");

            //     const oReader = new FileReader();

            //     oReader.onload = (e) => {
            //         try {
            //             let aData = [];

            //             // ===== CSV =====
            //             if (sExt === "csv") {
            //                 const aLines = e.target.result.split(/\r?\n/).filter(l => l.trim());
            //                 const aHeaders = aLines[0].split(",").map(h => h.trim());

            //                 aData = aLines.slice(1).map(line => {
            //                     const values = line.split(",");
            //                     let obj = {};
            //                     aHeaders.forEach((h, i) => obj[h] = values[i] || "");
            //                     return obj;
            //                 });

            //             } else {
            //                 const XLSX = window.XLSX;
            //                 const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            //                 const sheet = wb.Sheets[wb.SheetNames[0]];

            //                 aData = XLSX.utils.sheet_to_json(sheet, {
            //                     defval: "",
            //                     raw: false
            //                 });
            //             }

            //             let iCreated = 0;

            //             aData.forEach(oRow => {

            //                 const sModelCode = oRow["Model Code"];
            //                 if (!sModelCode) return;

            //                 const sEngineType = oRow["Engine Type"] || "EV";

            //                 // ✅ SAFE DATE
            //                 let oFromDate = new Date();
            //                 const sDateVal = oRow["Effective Date"];

            //                 if (sDateVal) {
            //                     const d = new Date(sDateVal);
            //                     if (!isNaN(d)) {
            //                         oFromDate = new Date(Date.UTC(
            //                             d.getFullYear(),
            //                             d.getMonth(),
            //                             d.getDate()
            //                         ));
            //                     }
            //                 }

            //                 oBinding.create({
            //                     ModelCode: sModelCode,
            //                     EngineType: sEngineType,
            //                     FromDate: oFromDate,
            //                     CcWatt: oRow["CC/Watt"] || "",
            //                     OrdType: oRow["Model Type"] || "MTS",
            //                     Description: oRow["Description"] || "",
            //                     ModelFam: oRow["Model Family"] || "",
            //                     GstPerc: oRow["GST%"] || "0",
            //                     DealerMargin: oRow["Dealer Margin"] || "0",
            //                     Status: "SUBMITTED"
            //                 });

            //                 iCreated++;
            //             });

            //             sap.m.MessageToast.show(iCreated + " rows uploaded");

            //         } catch (err) {
            //             console.error(err);
            //             sap.m.MessageBox.error("Upload failed");
            //         }
            //     };

            //     sExt === "csv"
            //         ? oReader.readAsText(oFile)
            //         : oReader.readAsArrayBuffer(oFile);
            // },


            _handleExcelFile: function (oFile) {
                if (!oFile) return;

                const sExt = oFile.name.split(".").pop().toLowerCase();
                if (!["xlsx", "xls", "csv"].includes(sExt)) {
                    sap.m.MessageToast.show("Upload valid Excel/CSV");
                    return;
                }

                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                const oReader = new FileReader();

                oReader.onload = (e) => {
                    const fnProcess = () => {
                        try {
                            let aData = [];

                            // ===== CSV =====
                            if (sExt === "csv") {
                                const aLines = e.target.result.split(/\r?\n/).filter(l => l.trim());
                                const aHeaders = aLines[0].split(",").map(h => h.trim());

                                aData = aLines.slice(1).map(line => {
                                    const values = line.split(",");
                                    let obj = {};
                                    aHeaders.forEach((h, i) => obj[h] = values[i] || "");
                                    return obj;
                                });

                            } else {
                                const XLSX = window.XLSX;
                                const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                                const sheet = wb.Sheets[wb.SheetNames[0]];
                                aData = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
                            }

                            let iCreated = 0;

                            aData.forEach(oRow => {
                                const sModelCode = oRow["Model Code"];
                                if (!sModelCode) return;

                                const sEngineType = oRow["Engine Type"] || "EV";

                                let oFromDate = new Date();
                                const sDateVal = oRow["Effective Date"];
                                if (sDateVal) {
                                    const d = new Date(sDateVal);
                                    if (!isNaN(d)) {
                                        oFromDate = new Date(Date.UTC(
                                            d.getFullYear(), d.getMonth(), d.getDate()
                                        ));
                                    }
                                }

                                oBinding.create({
                                    ModelCode: sModelCode,
                                    EngineType: sEngineType,
                                    FromDate: oFromDate,
                                    CcWatt: oRow["CC/Watt"] || "",
                                    OrdType: oRow["Model Type"] || "MTS",
                                    Description: oRow["Description"] || "",
                                    ModelFam: oRow["Model Family"] || "",
                                    GstPerc: oRow["GST%"] || "0",
                                    DealerMargCalc: oRow["Dealer Margin Calculation"] || "",
                                    DealerMargCostImp: oRow["Dealer Margin Cost Impact"] || "",
                                    DealerMargin: oRow["Dealer Margin"] || "0",
                                     CsdDisPerc: oRow["CSD Discount Rate %"] || "0",   // ✅ added
    Gem: oRow["GEM"] || "0", 
                                        Helmet: oRow["Helmet Cost"] || "0",            // ✅ added
    HelmetMargin: oRow["Helmet Margin"] || "0", 
                                    CsdIndex: oRow["CSD Index Number"] || "",
                                    Status: "SUBMITTED"
                                });

                                iCreated++;
                            });

                            sap.m.MessageToast.show(iCreated + " rows uploaded");

                        } catch (err) {
                            console.error(err);
                            sap.m.MessageBox.error("Upload failed: " + err.message);
                        }
                    };

                    // ✅ Load XLSX from LOCAL path — works in BTP Work Zone (CSP safe)
                    if (sExt !== "csv" && !window.XLSX) {
                        const sModulePath = sap.ui.require.toUrl("editmasterdata/lib/xlsx.full.min.js");
                        const oScript = document.createElement("script");
                        oScript.src = sModulePath;
                        oScript.onload = fnProcess;
                        oScript.onerror = function () {
                            sap.m.MessageBox.error("Failed to load Excel library.");
                        };
                        document.head.appendChild(oScript);
                    } else {
                        fnProcess();
                    }
                };

                sExt === "csv"
                    ? oReader.readAsText(oFile)
                    : oReader.readAsArrayBuffer(oFile);
            },

            _insertIntoTable: function (aExcelData) {

                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                // 🔥 If filtered → clear filter first
                if (this._isFiltered) {
                    this.onClearFilter();
                }

                aExcelData.forEach(oRow => {

                    oBinding.create({
                        ModelCode: oRow["Model Code"] || "",
                        EngineType: oRow["Engine Type"] || "EV",
                        CcWatt: oRow["CC/Watt"] || "",
                        FromDate: oRow["Effective Date"]
                            ? new Date(oRow["Effective Date"])
                            : new Date(),
                        OrdType: oRow["Model Type"] || "",
                        Description: oRow["Description"] || "",
                        ModelFam: oRow["Model Family"] || "",
                        GstPerc: oRow["GST%"] || "0.000",
                        DealerMargin: oRow["Dealer Margin"] || "0.000",
                        DealerMargCalc: oRow["Dealer Margin Calculation"] || "",
                        DealerMargCostImp: oRow["Dealer Margin Cost Impact"] || "",
                        CsdIndex: oRow["CSD Index Number"] || "",
                        CsdDisPerc: oRow["CSD Discount Rate %"] || "0.000",
                        Gem: oRow["GEM"] || "0.000",
                          Helmet: oRow["Helmet Cost"] || "0.000",            // ✅ added
    HelmetMargin: oRow["Helmet Margin"] || "0.000",
                        ModelStatus: oRow["Model Status"] || "Active",
                        Status: "SUBMITTED",
                        Mail: sMail
                    });

                });

                sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            },

            // _insertIntoTable: function (aExcelData) {

            //     const oTable = this.byId("modelTable");
            //     const oBinding = oTable.getBinding("rows");

            //     if (!oBinding) {
            //         sap.m.MessageToast.show("Table not ready");
            //         return;
            //     }

            //     const oVm = this.getView().getModel("viewModel");
            //     const sMail = oVm.getProperty("/ASMEmail");

            //     // 🔥 If filtered → clear filter first
            //     if (this._isFiltered) {
            //         this.onClearFilter();
            //     }

            //     aExcelData.forEach(oRow => {

            //         oBinding.create({
            //             ModelCode: oRow["Model Code"] || "",
            //             EngineType: oRow["Engine Type"] || "EV",
            //             CcWatt: oRow["CC/Watt"] || "",
            //             FromDate: oRow["Effective Date"]
            //                 ? new Date(oRow["Effective Date"])
            //                 : new Date(),
            //             OrdType: oRow["Model Type"] || "",
            //             Description: oRow["Description"] || "",
            //             ModelFam: oRow["Model Family"] || "",
            //             GstPerc: oRow["GST%"] || "0.000",
            //             DealerMargin: oRow["Dealer Margin"] || "0.000",
            //             DealerMargCalc: oRow["Dealer Margin Calculation"] || "",
            //             DealerMargCostImp: oRow["Dealer Margin Cost Impact"] || "",
            //             CsdIndex: oRow["CSD Index Number"] || "",
            //             CsdDisPerc: oRow["CSD Discount Rate %"] || "0.000",
            //             Gem: oRow["GEM"] || "0.000",
            //             ModelStatus: oRow["Model Status"] || "Active",
            //             Status: "SUBMITTED",
            //             Mail: sMail
            //         });

            //     });

            //     sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            // },

            // _insertIntoTable: function (aExcelData) {

            //     const oTable   = this.byId("gmaComponentTable");
            //     const oBinding = oTable.getBinding("rows");

            //     if (!oBinding) {
            //         sap.m.MessageToast.show("Table not ready");
            //         return;
            //     }

            //     const oVm   = this.getView().getModel("viewModel");
            //     const sMail = oVm.getProperty("/ASMEmail");

            //     if (this._isFiltered) {
            //         this.onClearFilter();
            //     }

            //     this._clearDraftRows();

            //     // ✅ Collect payloads — don't call oBinding.create() here
            //     var aPayloads = [];

            //     aExcelData.forEach(function (oRow) {

            //         // ✅ Date parsing — completely untouched
            //         var oFromDate;
            //         if (oRow["Effective Date"]) {
            //             if (typeof oRow["Effective Date"] === "number") {
            //                 var excelEpoch = new Date(Date.UTC(1899, 11, 30));
            //                 oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
            //             } else {
            //                 var sParsed = String(oRow["Effective Date"]).trim();
            //                 if (/^\d{2}-\d{2}-\d{4}$/.test(sParsed)) {
            //                     var aParts = sParsed.split("-");
            //                     oFromDate = new Date(Date.UTC(
            //                         parseInt(aParts[2], 10),
            //                         parseInt(aParts[1], 10) - 1,
            //                         parseInt(aParts[0], 10)
            //                     ));
            //                 } else {
            //                     oFromDate = new Date(sParsed);
            //                 }
            //             }
            //         } else {
            //             oFromDate = new Date();
            //         }

            //         if (isNaN(oFromDate.getTime())) {
            //             console.warn("Invalid date, defaulting to today:", oRow["Effective Date"]);
            //             oFromDate = new Date();
            //         }

            //         oFromDate = new Date(Date.UTC(
            //             oFromDate.getUTCFullYear(),
            //             oFromDate.getUTCMonth(),
            //             oFromDate.getUTCDate()
            //         ));

            //         // ✅ Push to array instead of oBinding.create()
            //         aPayloads.push({
            //             Models:        oRow["Model"]            || "",
            //             Description:   oRow["Description"]      || "",
            //             MtsMto:        oRow["MTS/MTO"]          || "MTS",
            //             ReferMtsModel: oRow["Reference Model"]  || "",
            //             Mail:          sMail,
            //             FromDate:      oFromDate,
            //             Part1:         oRow["Part1"]  || "",
            //             Part2:         oRow["Part2"]  || "",
            //             Part3:         oRow["Part3"]  || "",
            //             Part4:         oRow["Part4"]  || "",
            //             Part5:         oRow["Part5"]  || "",
            //             Part6:         oRow["Part6"]  || "",
            //             Part7:         oRow["Part7"]  || "",
            //             Part8:         oRow["Part8"]  || "",
            //             Part9:         oRow["Part9"]  || "",
            //             Part10:        oRow["Part10"] || "",
            //             Part11:        oRow["Part11"] || "",
            //             Part12:        oRow["Part12"] || "",
            //             Part13:        oRow["Part13"] || "",
            //             Part14:        oRow["Part14"] || "",
            //             Part15:        oRow["Part15"] || "",
            //             Part16:        oRow["Part16"] || "",
            //             Part17:        oRow["Part17"] || "",
            //             Part18:        oRow["Part18"] || "",
            //             Part19:        oRow["Part19"] || "",
            //             Part20:        oRow["Part20"] || "",
            //             Status:        "SUBMITTED"
            //         });

            //     }.bind(this));

            //     this._pendingExcelPayloads = null;

            //     // ✅ Send all 1000 rows in one batch call
            //     if (aPayloads.length > 0) {
            //         this._submitInChunks(aPayloads, oBinding, 1000);
            //     }
            // },

            onFileChange: function (oEvent) {

                const oFile = oEvent.getParameter("files")[0];
                if (!oFile) return;

                const reader = new FileReader();

                reader.onload = function (e) {

                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: "binary" });

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    const aExcelData = XLSX.utils.sheet_to_json(worksheet);

                    console.log("Excel Data:", aExcelData);

                    this._processExcelData(aExcelData);

                }.bind(this);

                reader.readAsBinaryString(oFile);
            },

            _processExcelData: function (aExcelData) {

                const oTable = this.byId("modelTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                aExcelData.forEach(oRow => {

                    oBinding.create({
                        ModelCode: oRow["Model Code"] || "",
                        EngineType: oRow["Engine Type"] || "EV",
                        CcWatt: oRow["CC/Watt"] || "",
                        FromDate: oRow["Effective Date"] ? new Date(oRow["Effective Date"]) : new Date(),
                        OrdType: oRow["Model Type"] || "",
                        Description: oRow["Description"] || "",
                        ModelFam: oRow["Model Family"] || "",
                        GstPerc: oRow["GST%"] || "0.000",
                        DealerMargin: oRow["Dealer Margin"] || "0.000",
                        DealerMargCalc: oRow["Dealer Margin Calculation"] || "",
                        DealerMargCostImp: oRow["Dealer Margin Cost Impact"] || "",
                        CsdIndex: oRow["CSD Index Number"] || "",
                        CsdDisPerc: oRow["CSD Discount Rate %"] || "0.000",
                        Gem: oRow["GEM"] || "0.000",
                        ModelStatus: oRow["Model Status"] || "Active",
                        Status: "SUBMITTED",
                        Mail: sMail
                    });

                });

                sap.m.MessageToast.show("Upload successful");
            },

            // onSort: function (oEvent) {

            //     var oColumn    = oEvent.getParameter("column");
            //     var sSortOrder = oEvent.getParameter("sortOrder");
            //     var sProperty  = oColumn.getSortProperty();
            //     var oTable     = this.byId("modelTable");

            //     var bDescending = (sSortOrder === "Descending");

            //     // ✅ Get current data from OData binding
            //     var oBinding = oTable.getBinding("rows");
            //     var aContexts = oBinding.getContexts(0, oBinding.getLength());

            //     var aData = aContexts.map(ctx => ctx.getObject());

            //     // ✅ SORT MANUALLY
            //     aData.sort(function (a, b) {
            //         var sA = String(a[sProperty] || "").toLowerCase();
            //         var sB = String(b[sProperty] || "").toLowerCase();

            //         return bDescending
            //             ? (sA > sB ? -1 : sA < sB ? 1 : 0)
            //             : (sA < sB ? -1 : sA > sB ? 1 : 0);
            //     });

            //     // ✅ Put sorted data into JSONModel
            //     var oJSONModel = new sap.ui.model.json.JSONModel(aData);
            //     oTable.setModel(oJSONModel);
            //     oTable.bindRows("/");

            //     // ✅ Update UI state
            //     oTable.getColumns().forEach(function (col) {
            //         col.setSorted(false);
            //     });

            //     oColumn.setSorted(true);
            //     oColumn.setSortOrder(sSortOrder);
            // },

            onSort: function (oEvent) {
                var that = this;
                var oColumn = oEvent.getParameter("column");
                var sSortOrder = oEvent.getParameter("sortOrder");
                var sProperty = oColumn.getSortProperty();
                var oTable = this.byId("modelTable");
                var bDescending = (sSortOrder === "Descending");

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                // ✅ Take raw context objects — preserve FromDate exactly as-is from OData
                // Do NOT JSON.parse/stringify (kills Date objects) and do NOT convert /Date(...)/ strings
                var aData = aContexts.map(function (ctx) {
                    var o = Object.assign({}, ctx.getObject());

                    // ✅ Re-attach _snapshotIndex from _allData if missing (same as region master)
                    if (that._allData && o._snapshotIndex === undefined) {
                        var oSnap = that._allData.find(function (s) {
                            return s.ModelCode === o.ModelCode &&
                                s.EngineType === o.EngineType &&
                                s.CcWatt === o.CcWatt;
                        });
                        if (oSnap) {
                            o._snapshotIndex = oSnap._snapshotIndex;
                            // ✅ Also restore original /Date(...)/ string from snapshot
                            //    so createKey works correctly in onSubmit
                            o.FromDate = oSnap.FromDate;
                        }
                    }
                    return o;
                });

                aData.sort(function (a, b) {
                    var sA = String(a[sProperty] || "").toLowerCase();
                    var sB = String(b[sProperty] || "").toLowerCase();
                    return bDescending
                        ? (sA > sB ? -1 : sA < sB ? 1 : 0)
                        : (sA < sB ? -1 : sA > sB ? 1 : 0);
                });

                // ✅ Now convert FromDate → Date object for DatePicker display only
                //    AFTER we've already saved the /Date(...)/ string back onto the row
                //    The sorted JSONModel rows will have BOTH preserved via _snapshotIndex lookup in onSubmit
                aData.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                var oJSONModel = new sap.ui.model.json.JSONModel(aData);
                oTable.setModel(oJSONModel);
                oTable.bindRows("/");

                this._isFiltered = true;

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },


        });
    }
);
