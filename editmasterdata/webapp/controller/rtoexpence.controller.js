sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.rtoexpence", {

            // onInit: async function () {
            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

            //     const oModel = this.getView().getModel();

            //     let sAsmName = "Anad Kumar";
            //     let sASMMail = "siva.durairaj@laderatechnology.com"

            //     var oDatePicker = this.byId("yourDatePickerId");
            //     if (oDatePicker) {
            //         oDatePicker.setMinDate(new Date());
            //     }


            //     if (sap.ushell && sap.ushell.Container) {
            //         const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
            //         sAsmName = oUserInfo.getFullName();
            //         sASMMail = oUserInfo.getEmail();
            //     }
            //     sAsmName = sAsmName.toUpperCase();

            //     oVM.setProperty("/ASMEmail", sASMMail);


            //     const oTable = this.byId("RtoExpenceTable");


            //     oTable.bindRows({
            //         path: "/RTOExpenseSet",
            //         filters: [
            //             new sap.ui.model.Filter("Mail", "EQ", sASMMail)
            //         ],
            //         events: {


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

                const oTable = this.byId("RtoExpenceTable");

                oTable.bindRows({
                    path: "/RTOExpenseSet",
                    filters: [this._getMailFilter()],
                    events: {
                        dataReceived: function (oEvent) {

                            // ✅ Existing logic — unchanged
                            var oModel = this.getView().getModel();
                            var aData = oModel.getProperty("/RTOExpenseSet");

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
                //this._bCreateInProgress = false;

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


            //Delete allData



            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                // 🔥 Build dropdowns
                this._buildFilterDropdowns(aData);
            },

            // onDateChange: function (oEvent) {

            //     const oPicker = oEvent.getSource();
            //     const sValue  = oPicker.getValue(); // "2026-03-30"

            //     if (!sValue) return;

            //     const aParts = sValue.split("-"); // yyyy-mm-dd

            //     if (aParts.length === 3) {
            //         const oDate = new Date(
            //             Number(aParts[0]),
            //             Number(aParts[1]) - 1,
            //             Number(aParts[2])
            //         );

            //         // ✅ VERY IMPORTANT (same as upload)
            //         oDate.setUTCHours(12, 0, 0, 0);

            //         const oContext = oPicker.getBindingContext();

            //         if (oContext) {
            //             oContext.getModel().setProperty(
            //                 oContext.getPath() + "/FromDate",
            //                 oDate   // ✅ STORE AS DATE OBJECT
            //             );
            //         }
            //     }
            // },


            onDateChange: function (oEvent) {
                const oPicker = oEvent.getSource();
                const sValue = oPicker.getValue(); // "2026-04-10"

                if (!sValue) return;

                const aParts = sValue.split("-");
                if (aParts.length !== 3) return;

                // ✅ FIX: Build UTC midnight directly from local date parts
                // Old: new Date(y, m, d) then setUTCHours(12) → inconsistent, caused "select 10 get 9"
                const iMs = Date.UTC(Number(aParts[0]), Number(aParts[1]) - 1, Number(aParts[2]));
                const oDate = new Date(iMs); // April 10 00:00 UTC = April 10 05:30 IST — always correct

                const oContext = oPicker.getBindingContext();
                if (oContext) {
                    oContext.getModel().setProperty(
                        oContext.getPath() + "/FromDate",
                        oDate
                    );
                }
            },

            formatDate: function (vDate) {
                if (!vDate) {
                    return "";
                }

                var oDate;

                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var match = vDate.match(/\/Date\((-?\d+)\)/);
                    oDate = match ? new Date(parseInt(match[1], 10)) : null;
                } else if (vDate instanceof Date) {
                    oDate = vDate;
                } else {
                    oDate = new Date(vDate);
                }

                if (!oDate || isNaN(oDate.getTime())) {
                    return "";
                }

                var aMonths = [
                    "Jan", "Feb", "Mar", "Apr",
                    "May", "Jun", "Jul", "Aug",
                    "Sep", "Oct", "Nov", "Dec"
                ];

                return oDate.getDate() + " " +
                    aMonths[oDate.getMonth()] + " " +
                    oDate.getFullYear();
            },


            _buildFilterDropdowns: function (aData) {

                const aRegions = [];
                const seenRegion = {};

                aData.forEach(function (oRow) {
                    if (oRow.RegionCode && !seenRegion[oRow.RegionCode]) {
                        seenRegion[oRow.RegionCode] = true;
                        aRegions.push({
                            RegionCode: oRow.RegionCode,
                            Display: oRow.RegionCode
                        });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ RegionCode: aRegions }),
                    "filter"
                );
            },


            onApplyFilter: function () {
                const aRegions = this.byId("filterModelCode").getSelectedKeys();

                let aFiltered = this._allData ? this._allData.slice() : [];

                if (aRegions.length) {
                    aFiltered = aFiltered.filter(o => aRegions.includes(o.RegionCode));
                }

                this._isFiltered = true;

                const aCloned = JSON.parse(JSON.stringify(aFiltered));

                // ✅ Convert /Date(...)/ → Date object for DatePicker display
                aCloned.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                const oTable = this.byId("RtoExpenceTable");
                oTable.setModel(new sap.ui.model.json.JSONModel(aCloned));
                oTable.bindRows("/");
            },
            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("RtoExpenceTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/RTOExpenseSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("RtoExpenceTable");
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

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                console.log(oMail);

                console.log("HI");

                var oTable = this.byId("RtoExpenceTable");
                var oBinding = oTable.getBinding("rows");

                if (this._isFiltered) {
                    this.onClearFilter();
                }
                oBinding.create({

                    RegionCode: "",
                    Slab: 0,
                    EngineType: "EV",
                    MinRange: "0.000",
                    MaxRange: "0.000",
                    Expense: "0.000",
                    Mail: oMail,
                    FromDate: new Date(),
                    Status: "SUBMITTED",

                });

            },
            onNewRowSelect: function (oEvent) {

                const oCheckBox = oEvent.getSource();
                const oContext = oCheckBox.getBindingContext();

                if (!oContext || !oContext.isTransient()) {
                    return;
                }

                oContext.getModel().setProperty(
                    oContext.getPath() + "/_selectedForDelete",
                    oCheckBox.getSelected()
                );
            },
            onDeleteSelectedRows: function () {

                const oTable = this.byId("RtoExpenceTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const aContexts = oBinding.getContexts(
                    0,
                    oBinding.getLength()
                );

                // Only newly created rows can be deleted
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

                // Delete all selected new rows
                aSelectedRows.forEach(function (oContext) {

                    if (oContext.isTransient()) {
                        oContext.delete();
                    }

                });

                sap.m.MessageToast.show(
                    aSelectedRows.length +
                    " row(s) removed successfully"
                );
            },




            //29-03
            // onSubmit: function () {

            //     const oVm   = this.getView().getModel("viewModel");
            //     const oMail = oVm.getProperty("/ASMEmail");

            //     console.log(oMail);

            //     var oModel = this.getView().getModel();
            //     var oTable = this.byId("RtoExpenceTable");
            //     var oView  = this.getView();
            //     var that   = this;

            //     // ─── FILTERED FLOW ───────────────────────────────────────────────────────
            //   if (this._isFiltered) {

            //     var oTableModel      = oTable.getModel();
            //     var aFilteredData    = oTableModel.getProperty("/") || [];
            //     var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     // ── Fields to EXCLUDE from change comparison ──────────────────────
            //     // Exclude FromDate because it changes format after JSON clone
            //     // Exclude __metadata, Status (we always set these on submit)
            //     var aIgnoreKeys = ["__metadata", "Status", "FromDate"];

            //     // ── Step 1: collect only genuinely changed rows ───────────────────
            //     var aChangedRows = [];

            //     aFilteredData.forEach(function (oFilteredRow) {

            //         var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //             return o.RegionCode === oFilteredRow.RegionCode &&
            //                    String(o.Slab) === String(oFilteredRow.Slab);
            //         });

            //         var bChanged = false;

            //         if (oOriginalRow) {
            //             var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                 return aIgnoreKeys.indexOf(k) === -1;
            //             });
            //             bChanged = aKeys.some(function (k) {
            //                 return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //             });
            //         }

            //         console.log(
            //             "Row → RegionCode:", oFilteredRow.RegionCode,
            //             "| Slab:", oFilteredRow.Slab,
            //             "| Changed:", bChanged
            //         );

            //         if (bChanged) {
            //             aChangedRows.push(oFilteredRow);
            //         }
            //     });

            //     // ── Step 2: nothing changed ───────────────────────────────────────
            //     if (aChangedRows.length === 0) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ── Step 3: fire PUT only for changed rows ────────────────────────
            //     oView.setBusy(true);
            //     iPendingOperations = aChangedRows.length;

            //     aChangedRows.forEach(function (oRow) {

            //         // ✅ Get FromDate from _allData original row (correct OData format)
            //         var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //             return o.RegionCode === oRow.RegionCode &&
            //                    String(o.Slab) === String(oRow.Slab);
            //         });

            //         // ✅ Build key using original FromDate (not the cloned ISO string)
            //         var sPath = oModel.createKey("/RTOExpenseSet", {
            //             FromDate:   oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //             RegionCode: oRow.RegionCode,
            //             Slab:       oRow.Slab
            //         });

            //         var oData      = Object.assign({}, oRow);
            //         delete oData.__metadata;
            //         oData.Status   = "SUBMITTED";
            //         oData.Mail     = oMail;

            //         // ✅ Use original FromDate in the payload too (correct format for OData)
            //         if (oOriginalRow && oOriginalRow.FromDate) {
            //             oData.FromDate = oOriginalRow.FromDate;
            //         }

            //         console.log("Updating path:", sPath, "| Data:", oData);

            //         oModel.update(sPath, oData, {
            //             merge: false,

            //             success: function () {
            //                 console.log("PUT success:", sPath);
            //                 iPendingOperations--;

            //                 if (iPendingOperations === 0) {
            //                     oView.setBusy(false);
            //                     if (!bHasError) {
            //                         sap.m.MessageToast.show("Saved successfully");
            //                     }
            //                     that.onClearFilter();
            //                 }
            //             },

            //             error: function (oError) {
            //                 console.error("PUT failed:", sPath, oError);
            //                 bHasError = true;
            //                 iPendingOperations--;
            //                 oView.setBusy(false);

            //                 var sMessage = "An error occurred while saving. Please try again.";
            //                 try {
            //                     var oBody = JSON.parse(oError.responseText);
            //                     if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                         sMessage = oBody.error.message.value;
            //                     }
            //                 } catch (e) {}

            //                 sap.m.MessageBox.error(sMessage);
            //             }
            //         });
            //     });

            //     return;
            // }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
            //     var aContexts = oTable.getBinding("rows").getContexts();

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     var mPending           = oModel.getPendingChanges();
            //     var bHasChanges        = false;
            //     var iPendingOperations = 0;
            //     var bHasError          = false;

            //     aContexts.forEach(function (oContext) {

            //         var sPath = oContext.getPath();
            //         var sKey  = sPath.substring(1);
            //         var oData = oContext.getObject();

            //         // CREATE → POST
            //         if (oContext.isTransient()) {
            //             oData.Status = "SUBMITTED";
            //             oData.Mail   = oMail;
            //             iPendingOperations++;
            //             bHasChanges = true;
            //             return;
            //         }

            //         // UPDATE → PUT
            //         if (mPending[sKey]) {
            //             oModel.resetChanges([sPath]);
            //             oData.Status = "SUBMITTED";
            //             oModel.update(sPath, oData, { merge: false });
            //             iPendingOperations++;
            //             bHasChanges = true;
            //         }
            //     });

            //     if (!bHasChanges) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     oView.setBusy(true);

            //     function extractErrorMessage(oEvent) {
            //         try {
            //             var oResponse = oEvent.getParameter("response");
            //             if (oResponse && oResponse.responseText) {
            //                 var oBody = JSON.parse(oResponse.responseText);
            //                 if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                     return oBody.error.message.value;
            //                 }
            //             }
            //         } catch (e) {}
            //         return "An error occurred while saving. Please try again.";
            //     }

            //     function onRequestDone(oEvent) {

            //         var sMethod = oEvent.getParameter("method");
            //         if (sMethod !== "POST" && sMethod !== "PUT") return;

            //         var bSuccess = oEvent.getParameter("success");
            //         if (!bSuccess) {
            //             bHasError = true;
            //             sap.m.MessageBox.error(extractErrorMessage(oEvent));
            //         }

            //         iPendingOperations--;

            //         if (iPendingOperations === 0) {
            //             oModel.detachEvent("requestCompleted", onRequestDone);
            //             oView.setBusy(false);

            //             // Refresh table regardless of success/error
            //             that.byId("RtoExpenceTable").getBinding("rows").refresh();

            //             if (!bHasError) {
            //                 sap.m.MessageToast.show("Saved successfully");
            //             }
            //         }
            //     }

            //     oModel.attachEvent("requestCompleted", onRequestDone);
            //     oModel.submitChanges();
            // },

            //Delete Integrated onsubmit

            onSubmit: function () {

                const oVm = this.getView().getModel("viewModel");
                const oMail = oVm.getProperty("/ASMEmail");

                console.log(oMail);

                var oModel = this.getView().getModel();
                var oTable = this.byId("RtoExpenceTable");
                var oView = this.getView();
                var that = this;

                var bHasError = false;
                var iPendingOperations = 0;

                // ✅ Key fields that trigger DELETE + CREATE when any one changes
                var aKeyFields = ["RegionCode", "Slab"];


                // ── Add these two helpers at top of onSubmit ──────────────────────────────

                // function toODataDate(vDate) {
                //     if (!vDate) return vDate;
                //     if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;
                //     var oDate;
                //     if (vDate instanceof Date) {
                //         oDate = vDate;
                //     } else if (typeof vDate === "string") {
                //         var aParts = vDate.substring(0, 10).split("-");
                //         oDate = new Date(
                //             parseInt(aParts[0], 10),
                //             parseInt(aParts[1], 10) - 1,
                //             parseInt(aParts[2], 10)
                //         );
                //     } else {
                //         return vDate;
                //     }
                //     // ✅ LOCAL date parts — avoids IST double-shift
                //     var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
                //     return "/Date(" + iMs + ")/";
                // }

                function toODataDate(vDate) {
                    if (!vDate) return vDate;

                    // ✅ FIX: Re-pin /Date(...)/ to UTC midnight — don't return as-is
                    if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                        var ms = parseInt(vDate.match(/\d+/)[0], 10);
                        var d0 = new Date(ms);
                        return "/Date(" + Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) + ")/";
                    }

                    var oDate;
                    if (vDate instanceof Date) {
                        oDate = vDate;
                    } else if (typeof vDate === "string") {
                        var aParts = vDate.substring(0, 10).split("-");
                        oDate = new Date(
                            parseInt(aParts[0], 10),
                            parseInt(aParts[1], 10) - 1,
                            parseInt(aParts[2], 10)
                        );
                    } else {
                        return vDate;
                    }

                    // ✅ Local date parts + Date.UTC — no IST shift
                    var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
                    return "/Date(" + iMs + ")/";
                }

                function normDateStr(v) {
                    if (!v) return "";
                    if (typeof v === "string" && v.indexOf("/Date(") === 0) {
                        return new Date(parseInt(v.match(/\d+/)[0], 10)).toISOString().substring(0, 10);
                    }
                    if (v instanceof Date) return v.toISOString().substring(0, 10);
                    return String(v).substring(0, 10);
                }

                // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
                function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
                    console.log("DELETE path:", sDeletePath);
                    console.log("CREATE payload:", oCreateData);

                    oModel.remove(sDeletePath, {
                        success: function () {
                            console.log("DELETE success:", sDeletePath);
                            onOperationDone(bIsFiltered);

                            oModel.create("/RTOExpenseSet", oCreateData, {
                                success: function () {
                                    console.log("CREATE success after DELETE");
                                    onOperationDone(bIsFiltered);
                                },
                                error: function (oError) {
                                    handleError(oError, "/RTOExpenseSet", bIsFiltered);
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
                            that.byId("RtoExpenceTable").getBinding("rows").refresh();
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
                    var aChangedRows = [];

                    aFilteredData.forEach(function (oFilteredRow) {

                        // ✅ Find original by _snapshotIndex (stable even if key fields changed)
                        var oOriginalRow = aOriginalSnapshot.find(function (o) {
                            return o._snapshotIndex === oFilteredRow._snapshotIndex;
                        });

                        // ✅ Fallback: match by RegionCode + Slab for rows without _snapshotIndex
                        if (!oOriginalRow) {
                            oOriginalRow = aOriginalSnapshot.find(function (o) {
                                return o.RegionCode === oFilteredRow.RegionCode &&
                                    String(o.Slab) === String(oFilteredRow.Slab);
                            });
                        }

                        var bChanged = false;

                        // if (oOriginalRow) {
                        //     var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                        //         return aIgnoreKeys.indexOf(k) === -1;
                        //     });
                        //     bChanged = aKeys.some(function (k) {
                        //         return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                        //     });
                        // }

                        if (oOriginalRow) {
                            var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                                return aIgnoreKeys.indexOf(k) === -1;
                            });
                            bChanged = aKeys.some(function (k) {
                                if (k === "FromDate") {
                                    return normDateStr(oFilteredRow[k]) !== normDateStr(oOriginalRow[k]);
                                }
                                return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                            });
                        }

                        console.log(
                            "Row → RegionCode:", oFilteredRow.RegionCode,
                            "| Slab:", oFilteredRow.Slab,
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

                    // ✅ Split into DELETE+CREATE (any key changed) vs normal PUT
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

                    // Each DELETE+CREATE counts as 2 operations
                    iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2);

                    oView.setBusy(true);

                    // ── Normal PUT rows (no key change) ───────────────────────────────────
                    // aPutRows.forEach(function (oItem) {

                    //     var oRow         = oItem.oRow;
                    //     var oOriginalRow = oItem.oOriginalRow;

                    //     // ✅ Build path using ORIGINAL key fields
                    //     var sPath = oModel.createKey("/RTOExpenseSet", {
                    //         FromDate:   oOriginalRow ? oOriginalRow.FromDate   : oRow.FromDate,
                    //         RegionCode: oOriginalRow ? oOriginalRow.RegionCode : oRow.RegionCode,
                    //         Slab:       oOriginalRow ? oOriginalRow.Slab       : oRow.Slab
                    //     });

                    //     var oData = Object.assign({}, oRow);
                    //     delete oData.__metadata;
                    //     delete oData._snapshotIndex;
                    //     oData.Status = "SUBMITTED";
                    //     oData.Mail   = oMail;

                    //     if (oOriginalRow && oOriginalRow.FromDate) {
                    //         oData.FromDate = oOriginalRow.FromDate;
                    //     }

                    //     console.log("PUT path:", sPath, "| Data:", oData);

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

                    aPutRows.forEach(function (oItem) {
                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        // ✅ Key: raw /Date(...)/ string from _allData (restored in onSort)
                        var sPath = oModel.createKey("/RTOExpenseSet", {
                            FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
                            RegionCode: oOriginalRow ? oOriginalRow.RegionCode : oRow.RegionCode,
                            Slab: oOriginalRow ? oOriginalRow.Slab : oRow.Slab
                        });

                        var oData = Object.assign({}, oRow);
                        delete oData.__metadata;
                        delete oData._snapshotIndex;
                        oData.Status = "SUBMITTED";
                        oData.Mail = oMail;

                        // ✅ Body: user's actual date value, not oOriginalRow.FromDate
                        oData.FromDate = toODataDate(oRow.FromDate);

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

                    // ── DELETE + CREATE rows (any key field changed) ──────────────────────
                    aDeleteCreate.forEach(function (oItem) {

                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        // ✅ DELETE uses ORIGINAL key fields
                        var sDeletePath = oModel.createKey("/RTOExpenseSet", {
                            FromDate: oOriginalRow.FromDate,
                            RegionCode: oOriginalRow.RegionCode,
                            Slab: oOriginalRow.Slab
                        });

                        // ✅ CREATE uses NEW row data (new key values)
                        var oCreateData = Object.assign({}, oRow);
                        delete oCreateData.__metadata;
                        delete oCreateData._snapshotIndex;
                        oCreateData.Status = "SUBMITTED";
                        oCreateData.Mail = oMail;
                        oCreateData.FromDate = oOriginalRow.FromDate;

                        doDeleteCreate(sDeletePath, oCreateData, true);
                    });

                    return;
                }

                // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
                var aContexts = oTable.getBinding("rows").getContexts();

                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                var mPending = oModel.getPendingChanges();
                var bHasChanges = false;

                // ✅ FIX 1: Build snapshot lookup by OData path for key field comparison
                // because OData V2 getPendingChanges() never contains key field changes
                var mSnapshotByPath = {};
                if (that._allData) {
                    that._allData.forEach(function (oSnapRow) {
                        var sSnapPath = oModel.createKey("/RTOExpenseSet", {
                            FromDate: oSnapRow.FromDate,
                            RegionCode: oSnapRow.RegionCode,
                            Slab: oSnapRow.Slab
                        });
                        mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
                    });
                }

                aContexts.forEach(function (oContext) {

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
                    var oData = oContext.getObject();

                    // ── CREATE → POST (transient / new row) ───────────────────────────────
                    if (oContext.isTransient()) {



                        var oCreatePayload = Object.assign({}, oData);

                        console.log(oCreatePayload);

                        delete oCreatePayload.__metadata;
                        delete oCreatePayload._snapshotIndex;
                        delete oCreatePayload._selectedForDelete;
                        oCreatePayload.Status = "SUBMITTED";
                        oCreatePayload.Mail = oMail;
                        // oCreatePayload.Slab   = String(oCreatePayload.Slab);

                        oCreatePayload.Slab = Number(oCreatePayload.Slab);

                        oCreatePayload.MaxRange = String(oCreatePayload.MaxRange);
                        oCreatePayload.RegionCode = String(oCreatePayload.RegionCode);
                        oCreatePayload.FromDate = toODataDate(oCreatePayload.FromDate);

                        console.log("CREATE (transient) payload:", oCreatePayload);

                        iPendingOperations++;
                        bHasChanges = true;

                        // ✅ FIX 2: Delete transient context BEFORE create
                        // so row is removed from table immediately
                        oContext.delete();

                        oModel.create("/RTOExpenseSet", oCreatePayload, {
                            success: function () {
                                console.log("CREATE success (transient)");
                                onOperationDone(false);
                            },
                            error: function (oError) {
                                handleError(oError, "/RTOExpenseSet", false);
                            }
                        });

                        return;
                    }

                    if (mPending[sKey]) {

                        var oPending = mPending[sKey];

                        // ✅ FIX 1: Compare merged current+pending values against SNAPSHOT
                        // OData V2 never puts key fields in getPendingChanges()
                        // so detect key changes by comparing against _allData snapshot
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
                            oCreateData.Mail = oMail;
                            oCreateData.FromDate = oSnapRow.FromDate;

                            // ✅ DELETE path built from SNAPSHOT original keys
                            var sDeletePath = oModel.createKey("/RTOExpenseSet", {
                                FromDate: oSnapRow.FromDate,
                                RegionCode: oSnapRow.RegionCode,
                                Slab: oSnapRow.Slab
                            });

                            oModel.resetChanges([sPath]);

                            console.log("DELETE+CREATE → DELETE path:", sDeletePath);
                            console.log("DELETE+CREATE → CREATE payload:", oCreateData);

                            iPendingOperations += 2;
                            bHasChanges = true;

                            doDeleteCreate(sDeletePath, oCreateData, false);

                            return;
                        }

                        // ── Normal UPDATE → PUT (no key change) — UNCHANGED ───────────────
                        var oPutData = Object.assign({}, oData);
                        delete oPutData.__metadata;
                        delete oPutData._snapshotIndex;
                        delete oPutData._selectedForDelete;
                        oPutData.Status = "SUBMITTED";
                        oPutData.Mail = oMail;
                        oPutData.FromDate = toODataDate(oPutData.FromDate);

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

                if (!bHasChanges) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // ✅ FIX 3: setBusy AFTER forEach so all iPendingOperations
                // are counted first before any async callback can fire
                oView.setBusy(true);
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

            _handleExcelFile: function (oFile) {

                const reader = new FileReader();

                reader.onload = function (e) {

                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: "binary" });

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    const aExcelData = XLSX.utils.sheet_to_json(worksheet);

                    console.log("Parsed Excel:", aExcelData);

                    this._insertIntoTable(aExcelData);

                }.bind(this);

                reader.readAsBinaryString(oFile);
            },

            _insertIntoTable: function (aExcelData) {

                const oTable = this.byId("RtoExpenceTable"); // ✅ FIXED
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                // 🔥 If filtered → clear filter
                if (this._isFiltered) {
                    this.onClearFilter();
                }

                aExcelData.forEach(oRow => {

                    var oFromDate;
                    if (oRow["Effective Date"]) {
                        if (typeof oRow["Effective Date"] === "number") {
                            // Excel serial number → JS Date
                            var excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
                        } else {
                            oFromDate = new Date(oRow["Effective Date"]);
                        }
                    } else {
                        oFromDate = new Date();
                    }
                    oFromDate.setUTCHours(12, 0, 0, 0);

                    console.log(oRow);
                    const sSlab =
                        Number(oRow["Slab"]) ??
                        Number(oRow["SLAB"]) ??
                        Number(oRow["slab"]) ??
                        Number(oRow["Slab "]) ??
                        "0";

                    oBinding.create({
                        RegionCode: oRow["Region"] || "",
                        EngineType: oRow["Engine Type"] || "EV",

                        Slab: sSlab,
                        MinRange: oRow["Min Range"] || "0",
                        MaxRange: oRow["Max Range"] || "0",
                        Expense: oRow["Expense"] || "0",

                        FromDate: oFromDate,
                        Status: "SUBMITTED",

                    });


                });

                sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            },

            _getAllFields: function () {
                return [
                    { key: "RegionCode", label: "Region" },
                    { key: "EngineType", label: "Engine Type" },
                    { key: "FromDate", label: "Effective Date" },
                    { key: "Slab", label: "Slab" },
                    { key: "MinRange", label: "Min Range" },
                    { key: "MaxRange", label: "Max Range" },
                    { key: "Expense", label: "Expense" }
                ];
            },

            onDownloadAll: function () {

                const oTable = this.byId("RtoExpenceTable"); // ✅ correct table
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

                const aFields = this._getAllFields();

                this._exportToExcel(aData, aFields);
            },

            _exportToExcel: function (aData, aFields) {

                const EdmType = sap.ui.require("sap/ui/export/library").EdmType;

                const aProcessedData = aData.map(function (oRow) {

                    const oCopy = Object.assign({}, oRow);

                    console.log(oCopy);


                    if (oCopy.FromDate) {

                        let oDate;

                        // OData /Date(ms)/ format
                        if (typeof oCopy.FromDate === "string" && oCopy.FromDate.includes("/Date(")) {
                            const ms = parseInt(oCopy.FromDate.replace(/\D/g, ""));
                            oDate = new Date(ms);
                        }
                        // JS Date object
                        else if (oCopy.FromDate instanceof Date) {
                            oDate = oCopy.FromDate;
                        }
                        // ISO string or any other string
                        else {
                            oDate = new Date(oCopy.FromDate);
                        }

                        if (oDate && !isNaN(oDate)) {
                            const dd = String(oDate.getDate()).padStart(2, "0");
                            const mm = String(oDate.getMonth() + 1).padStart(2, "0");
                            const yyyy = oDate.getFullYear();
                            oCopy.FromDate = dd + "-" + mm + "-" + yyyy;
                        }
                    }

                    console.log(oCopy);


                    return oCopy;
                });

                const oSettings = {
                    workbook: {
                        columns: aFields.map(f => ({
                            label: f.label,
                            property: f.key,
                            type: EdmType.String
                        }))
                    },
                    dataSource: aProcessedData,
                    fileName: "RTOExpense_Export.xlsx"
                };

                const oSheet = new sap.ui.export.Spreadsheet(oSettings);
                oSheet.build().finally(() => oSheet.destroy());
            },

            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");
                if (oSheet) oSheet.openBy(oEvent.getSource());
            },

            onExcelDownload: function () {

                const oModel = new sap.ui.model.json.JSONModel({
                    fields: this._getAllFields()
                });

                this.getView().setModel(oModel, "fields");

                this.byId("fieldSelectDialog").open();
            },

            onDownloadSelectedFields: function () {

                const oList = this.byId("fieldList");
                const aSelectedItems = oList.getSelectedItems();

                if (!aSelectedItems.length) {
                    sap.m.MessageToast.show("Select at least one field");
                    return;
                }

                const aSelectedFields = aSelectedItems.map(item =>
                    item.getBindingContext("fields").getObject()
                );

                const oTable = this.byId("RtoExpenceTable");
                const oBinding = oTable.getBinding("rows");

                const iLength = oBinding.getLength();
                const aData = oBinding.getContexts(0, iLength).map(c => c.getObject());

                this._exportToExcel(aData, aSelectedFields);

                this.byId("fieldSelectDialog").close();
            },

            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },



            // onSort: function (oEvent) {

            //     var oColumn    = oEvent.getParameter("column");
            //     var sSortOrder = oEvent.getParameter("sortOrder");
            //     var sProperty  = oColumn.getSortProperty();
            //     var oTable     = this.byId("RtoExpenceTable");

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
                var oTable = this.byId("RtoExpenceTable");
                var bDescending = (sSortOrder === "Descending");

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());
                var aData = aContexts.map(function (ctx) { return Object.assign({}, ctx.getObject()); });

                // ✅ Restore _snapshotIndex + original /Date(...)/ from _allData
                if (that._allData) {
                    aData = aData.map(function (oRow) {
                        var oSnap;
                        if (oRow._snapshotIndex !== undefined) {
                            oSnap = that._allData.find(function (o) {
                                return o._snapshotIndex === oRow._snapshotIndex;
                            });
                        }
                        if (!oSnap) {
                            oSnap = that._allData.find(function (o) {
                                return o.RegionCode === oRow.RegionCode &&
                                    String(o.Slab) === String(oRow.Slab);
                            });
                        }
                        if (oSnap) {
                            oRow._snapshotIndex = oSnap._snapshotIndex;
                            oRow.FromDate = oSnap.FromDate; // ✅ raw /Date(...)/ for createKey
                        }
                        return oRow;
                    });
                }

                aData.sort(function (a, b) {
                    var sA = String(a[sProperty] || "").toLowerCase();
                    var sB = String(b[sProperty] || "").toLowerCase();
                    return bDescending
                        ? (sA > sB ? -1 : sA < sB ? 1 : 0)
                        : (sA < sB ? -1 : sA > sB ? 1 : 0);
                });

                // ✅ Convert /Date(...)/ → Date object for DatePicker display ONLY
                aData.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                var oJSONModel = new sap.ui.model.json.JSONModel(aData);
                oTable.setModel(oJSONModel);
                oTable.bindRows("/");

                // ✅ Critical — routes onSubmit through filtered/JSONModel path
                this._isFiltered = true;

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },
        });
    }
);
