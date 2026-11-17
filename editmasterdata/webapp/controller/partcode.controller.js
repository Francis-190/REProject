sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.partcode", {
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

            //     const oTable = this.byId("partMasterTable");

            //     oTable.bindRows({
            //         path: "/PartsSet",
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

    const oTable = this.byId("partMasterTable");

    oTable.bindRows({
        path: "/PartsSet",
        filters: [this._getMailFilter()],
        events: {
                        dataReceived: function (oEvent) {

                            // ✅ Existing logic — unchanged
                            var oModel = this.getView().getModel();
                            var aData = oModel.getProperty("/PartsSet");

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



            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                // 🔥 Build dropdowns
                this._buildFilterDropdowns(aData);
            },


            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                // 🔥 Build dropdowns
                this._buildFilterDropdowns(aData);
            },

            _buildFilterDropdowns: function (aData) {

                const aFamily = [];
                const aPartCode = [];

                const seenFamily = {};
                const seenPartCode = {};

                aData.forEach(function (oRow) {

                    if (oRow.Family && !seenFamily[oRow.Family]) {
                        seenFamily[oRow.Family] = true;
                        aFamily.push({ Family: oRow.Family });
                    }

                    if (oRow.PartCode && !seenPartCode[oRow.PartCode]) {
                        seenPartCode[oRow.PartCode] = true;
                        aPartCode.push({ PartCode: oRow.PartCode });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        Family: aFamily,
                        PartCode: aPartCode
                    }),
                    "filter"
                );
            },




            formatDate: function (vDate) {
                if (!vDate) {
                    return "";
                }

                var oDate;

                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var iMs = parseInt(vDate.match(/\d+/)[0], 10);
                    oDate = new Date(iMs);
                } else if (vDate instanceof Date) {
                    oDate = vDate;
                } else {
                    oDate = new Date(vDate);
                }

                if (isNaN(oDate.getTime())) {
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
            onDateChange: function (oEvent) {
                const oPicker = oEvent.getSource();
                const sValue = oPicker.getValue(); // "2026-03-30"

                if (!sValue) return;

                console.log("UI Value:", sValue);

                const oContext = oPicker.getBindingContext();
                if (oContext) {
                    oContext.getModel().setProperty(
                        oContext.getPath() + "/FromDate",
                        sValue
                    );
                }
            },

            onApplyFilter: function () {

                const aFamilies = this.byId("filterModelCode").getSelectedKeys();
                const aPartCodes = this.byId("filterEngineType").getSelectedKeys();

                let aFiltered = this._allData || [];

                if (aFamilies.length) {
                    aFiltered = aFiltered.filter(o => aFamilies.includes(o.Family));
                }

                if (aPartCodes.length) {
                    aFiltered = aFiltered.filter(o => aPartCodes.includes(o.PartCode));
                }

                this._isFiltered = true;

                const oTable = this.byId("partMasterTable");

                // ✅ Deep clone — prevents edits from mutating _allData
                oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
                oTable.bindRows("/");
            },

            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();
                this.byId("filterEngineType").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("partMasterTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/PartsSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            _toODataDate: function (vDate) {

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
                    // "YYYY-MM-DD" from DatePicker
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

            },


            onCreateMasterRow: function () {
                console.log("HI");

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("partMasterTable");
                var oBinding = oTable.getBinding("rows");

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                oBinding.create({
                    OperationNo: 0,
                    Family: "",
                    PartCode: "",
                    Mail: oMail,
                    PartDescr: "",
                    FromDate: new Date(),
                    OeGma: "OE",
                    MiyCost: "0.000",
                    MiyMarkup: "0.000",
                    ExShowOnRoad: "EX SHOWROOM",
                    Mrp: "0.000",
                    MiyCostPerc: "0.000",
                    MiyMarkupPerc: "0.000",
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

                const oTable = this.byId("partMasterTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                // ============================================================
                // FILTERED TABLE
                // JSONModel -> no isTransient()
                // ============================================================
                if (this._isFiltered) {

                    const oTableModel = oTable.getModel();
                    const aData = oTableModel.getProperty("/") || [];

                    const aSelectedRows = aData.filter(function (oRow) {
                        return oRow._selectedForDelete === true;
                    });

                    if (!aSelectedRows.length) {
                        sap.m.MessageToast.show(
                            "Please select at least one newly created row"
                        );
                        return;
                    }

                    // Remove only selected rows from filtered JSON model
                    const aRemainingRows = aData.filter(function (oRow) {
                        return oRow._selectedForDelete !== true;
                    });

                    oTableModel.setData(aRemainingRows);
                    oTableModel.refresh(true);

                    sap.m.MessageToast.show(
                        aSelectedRows.length + " row(s) removed successfully"
                    );

                    return;
                }


                // ============================================================
                // NORMAL TABLE
                // ODataModel -> transient rows
                // ============================================================

                const aContexts = oBinding.getContexts(
                    0,
                    oBinding.getLength()
                );

                const aSelectedRows = aContexts.filter(function (oContext) {

                    return oContext &&
                        typeof oContext.isTransient === "function" &&
                        oContext.isTransient() &&
                        oContext.getProperty("_selectedForDelete") === true;

                });

                if (!aSelectedRows.length) {

                    sap.m.MessageToast.show(
                        "Please select at least one newly created row"
                    );

                    return;
                }

                aSelectedRows.forEach(function (oContext) {

                    if (
                        oContext &&
                        typeof oContext.isTransient === "function" &&
                        oContext.isTransient()
                    ) {
                        oContext.delete();
                    }

                });

                sap.m.MessageToast.show(
                    aSelectedRows.length + " row(s) removed successfully"
                );
            },


            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("partMasterTable");
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


            // onSubmit: function () {

            //     var oModel = this.getView().getModel();
            //     var oTable = this.byId("partMasterTable");
            //     var oView  = this.getView();
            //     var that   = this;

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     var aKeyFields = ["Family", "PartCode"];

            //     function normDateStr(v) {
            //         if (!v) return "";
            //         if (typeof v === "string" && v.indexOf("/Date(") === 0) {
            //             return new Date(parseInt(v.match(/\d+/)[0], 10)).toISOString().substring(0, 10);
            //         }
            //         if (v instanceof Date) return v.toISOString().substring(0, 10);
            //         return String(v).substring(0, 10);
            //     }

            //     function toODataDate(vDate) {
            //         if (!vDate) return vDate;
            //         if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

            //         var oDate;
            //         if (vDate instanceof Date) {
            //             oDate = vDate;
            //         } else if (typeof vDate === "string") {
            //             var aParts = vDate.substring(0, 10).split("-");
            //             oDate = new Date(
            //                 parseInt(aParts[0], 10),
            //                 parseInt(aParts[1], 10) - 1,
            //                 parseInt(aParts[2], 10)
            //             );
            //         } else {
            //             return vDate;
            //         }

            //         var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
            //         return "/Date(" + iMs + ")/";
            //     }

            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/PartsSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/PartsSet", bIsFiltered);
            //                     }
            //                 });
            //             },
            //             error: function (oError) {
            //                 handleError(oError, sDeletePath, bIsFiltered);
            //                 onOperationDone(bIsFiltered);
            //             }
            //         });
            //     }

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
            //                 that.byId("partMasterTable").getBinding("rows").refresh();
            //             }
            //         }
            //     }

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
            //         var aChangedRows = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.Family   === oFilteredRow.Family &&
            //                            o.PartCode === oFilteredRow.PartCode;
            //                 });
            //             }

            //             var bChanged = false;

            //             if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1;
            //                 });
            //                 bChanged = aKeys.some(function (k) {
            //                     if (k === "FromDate") {
            //                         return normDateStr(oFilteredRow[k]) !== normDateStr(oOriginalRow[k]);
            //                     }
            //                     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //                 });
            //             }

            //             console.log(
            //                 "Row → Family:", oFilteredRow.Family,
            //                 "| PartCode:", oFilteredRow.PartCode,
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

            //         aPutRows.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sPath = oModel.createKey("/PartsSet", {
            //                 Family:   oOriginalRow ? oOriginalRow.Family   : oRow.Family,
            //                 FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //                 PartCode: oOriginalRow ? oOriginalRow.PartCode : oRow.PartCode
            //             });

            //             var oData = Object.assign({}, oRow);
            //             delete oData.__metadata;
            //             delete oData._snapshotIndex;
            //             oData.Status   = "SUBMITTED";
            //             oData.FromDate = toODataDate(oRow.FromDate);

            //             console.log("PUT path:", sPath, "| Body FromDate:", oData.FromDate);

            //             oModel.update(sPath, oData, {
            //                 merge: false,
            //                 success: function () {
            //                     console.log("PUT success:", sPath);
            //                     onOperationDone(true);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, sPath, true);
            //                 }
            //             });
            //         });

            //         aDeleteCreate.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sDeletePath = oModel.createKey("/PartsSet", {
            //                 Family:   oOriginalRow.Family,
            //                 FromDate: oOriginalRow.FromDate,
            //                 PartCode: oOriginalRow.PartCode
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.FromDate = toODataDate(oRow.FromDate);

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────

            // // if (this._pendingExcelPayloads && this._pendingExcelPayloads.length > 0) {
            // //     var aExcelPayloads = this._pendingExcelPayloads;
            // //     this._pendingExcelPayloads = null;

            // //    this._clearDraftRows();

            // //     this._submitInChunks(aExcelPayloads, oTable.getBinding("rows"), 500);
            // //     return;
            // // }

            //     var aContexts = oTable.getBinding("rows").getContexts();

            //     var aMissingFields = [];

            //     aContexts.forEach(function (oContext) {
            //         if (oContext.isTransient()) {
            //             var oData = oContext.getObject();
            //             if (!oData.Family || oData.Family.trim() === "") {
            //                 aMissingFields.push("Material Group");
            //             }
            //             if (!oData.PartCode || oData.PartCode.trim() === "") {
            //                 aMissingFields.push("Part Code");
            //             }
            //         }
            //     });

            //     if (aMissingFields.length > 0) {
            //         var aUnique = aMissingFields.filter(function (item, index) {
            //             return aMissingFields.indexOf(item) === index;
            //         });
            //         sap.m.MessageBox.error(
            //             "Please fill in the required fields: " + aUnique.join(", ")
            //         );
            //         return;
            //     }

            //     var oBinding  = oTable.getBinding("rows");
            // var aContexts = oBinding.getContexts(0, oBinding.getLength());

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     var mPending    = oModel.getPendingChanges();
            //     var bHasChanges = false;

            //     var mSnapshotByPath = {};
            //     if (that._allData) {
            //         that._allData.forEach(function (oSnapRow) {
            //             var sSnapPath = oModel.createKey("/PartsSet", {
            //                 Family:   oSnapRow.Family,
            //                 FromDate: oSnapRow.FromDate,
            //                 PartCode: oSnapRow.PartCode
            //             });
            //             mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
            //         });
            //     }

            //     var aTransientPayloads = [];

            //     aContexts.forEach(function (oContext) {

            //         var sPath = oContext.getPath();
            //         var sKey  = sPath.substring(1);
            //         var oData = oContext.getObject();

            //         // ── CREATE → POST ─────────────────────────────────────────────────────
            //         if (oContext.isTransient()) {

            //             var oCreatePayload = Object.assign({}, oData);
            //             delete oCreatePayload.__metadata;
            //             delete oCreatePayload._snapshotIndex;
            //             oCreatePayload.Status   = "SUBMITTED";
            //             oCreatePayload.FromDate = toODataDate(oCreatePayload.FromDate);

            //             console.log("CREATE (transient) payload:", oCreatePayload);

            //             iPendingOperations++;
            //             bHasChanges = true;




            //             oModel.create("/PartsSet", oCreatePayload, {
            //                 success: function () {
            //                     console.log("CREATE success (transient)");
            //                     onOperationDone(false);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, "/PartsSet", false);
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

            //                 var sDeletePath = oModel.createKey("/PartsSet", {
            //                     Family:   oSnapRow.Family,
            //                     FromDate: oSnapRow.FromDate,
            //                     PartCode: oSnapRow.PartCode
            //                 });

            //                 oModel.resetChanges([sPath]);

            //                 console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //                 console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //                 iPendingOperations += 2;
            //                 bHasChanges = true;

            //                 doDeleteCreate(sDeletePath, oCreateData, false);
            //                 return;
            //             }

            //             // ── Normal PUT ────────────────────────────────────────────────────
            //             var oPutData = Object.assign({}, oData);
            //             delete oPutData.__metadata;
            //             delete oPutData._snapshotIndex;
            //             oPutData.Status = "SUBMITTED";
            //             oPutData.FromDate = toODataDate(oPutData.FromDate);

            //             oModel.resetChanges([sPath]);

            //             console.log("PUT path:", sPath, "| Data:", oPutData);

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

            // if (aTransientPayloads.length > 0) {
            //     bHasChanges = true;
            //     that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 500);
            // }

            //     if (!bHasChanges) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            // if (iPendingOperations > 0) {
            //     oView.setBusy(true);
            // }
            // },

            // onSubmit: function () {

            //     var oModel = this.getView().getModel();
            //     var oTable = this.byId("partMasterTable");
            //     var oView  = this.getView();
            //     var that   = this;

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     var aKeyFields = ["Family", "PartCode"];

            //     function normDateStr(v) {
            //         if (!v) return "";
            //         if (typeof v === "string" && v.indexOf("/Date(") === 0) {
            //             return new Date(parseInt(v.match(/\d+/)[0], 10)).toISOString().substring(0, 10);
            //         }
            //         if (v instanceof Date) return v.toISOString().substring(0, 10);
            //         return String(v).substring(0, 10);
            //     }

            //     function toODataDate(vDate) {
            //         if (!vDate) return vDate;
            //         if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

            //         var oDate;
            //         if (vDate instanceof Date) {
            //             oDate = vDate;
            //         } else if (typeof vDate === "string") {
            //             var aParts = vDate.substring(0, 10).split("-");
            //             oDate = new Date(
            //                 parseInt(aParts[0], 10),
            //                 parseInt(aParts[1], 10) - 1,
            //                 parseInt(aParts[2], 10)
            //             );
            //         } else {
            //             return vDate;
            //         }

            //         var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
            //         return "/Date(" + iMs + ")/";
            //     }

            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/PartsSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/PartsSet", bIsFiltered);
            //                     }
            //                 });
            //             },
            //             error: function (oError) {
            //                 handleError(oError, sDeletePath, bIsFiltered);
            //                 onOperationDone(bIsFiltered);
            //             }
            //         });
            //     }

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
            //                 that.byId("partMasterTable").getBinding("rows").refresh();
            //             }
            //         }
            //     }

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
            //         var aChangedRows = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.Family   === oFilteredRow.Family &&
            //                            o.PartCode === oFilteredRow.PartCode;
            //                 });
            //             }

            //             var bChanged = false;

            //             if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1;
            //                 });
            //                 bChanged = aKeys.some(function (k) {
            //                     if (k === "FromDate") {
            //                         return normDateStr(oFilteredRow[k]) !== normDateStr(oOriginalRow[k]);
            //                     }
            //                     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //                 });
            //             }

            //             console.log(
            //                 "Row → Family:", oFilteredRow.Family,
            //                 "| PartCode:", oFilteredRow.PartCode,
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

            //         aPutRows.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sPath = oModel.createKey("/PartsSet", {
            //                 Family:   oOriginalRow ? oOriginalRow.Family   : oRow.Family,
            //                 FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //                 PartCode: oOriginalRow ? oOriginalRow.PartCode : oRow.PartCode
            //             });

            //             var oData = Object.assign({}, oRow);
            //             delete oData.__metadata;
            //             delete oData._snapshotIndex;
            //             oData.Status   = "SUBMITTED";
            //             oData.FromDate = toODataDate(oRow.FromDate);

            //             console.log("PUT path:", sPath, "| Body FromDate:", oData.FromDate);

            //             oModel.update(sPath, oData, {
            //                 merge: false,
            //                 success: function () {
            //                     console.log("PUT success:", sPath);
            //                     onOperationDone(true);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, sPath, true);
            //                 }
            //             });
            //         });

            //         aDeleteCreate.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sDeletePath = oModel.createKey("/PartsSet", {
            //                 Family:   oOriginalRow.Family,
            //                 FromDate: oOriginalRow.FromDate,
            //                 PartCode: oOriginalRow.PartCode
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.FromDate = toODataDate(oRow.FromDate);

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────

            //     var oBinding  = oTable.getBinding("rows");
            //     var aContexts = oBinding.getContexts(0, oBinding.getLength());

            //     // ✅ Validate required fields on transient rows
            //     var aMissingFields = [];
            //     aContexts.forEach(function (oContext) {
            //         if (oContext.isTransient()) {
            //             var oData = oContext.getObject();
            //             if (!oData.Family || oData.Family.trim() === "") {
            //                 aMissingFields.push("Material Group");
            //             }
            //             if (!oData.PartCode || oData.PartCode.trim() === "") {
            //                 aMissingFields.push("Part Code");
            //             }
            //         }
            //     });

            //     if (aMissingFields.length > 0) {
            //         var aUnique = aMissingFields.filter(function (item, index) {
            //             return aMissingFields.indexOf(item) === index;
            //         });
            //         sap.m.MessageBox.error(
            //             "Please fill in the required fields: " + aUnique.join(", ")
            //         );
            //         return;
            //     }

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     var mPending    = oModel.getPendingChanges();
            //     var bHasChanges = false;

            //     var mSnapshotByPath = {};
            //     if (that._allData) {
            //         that._allData.forEach(function (oSnapRow) {
            //             var sSnapPath = oModel.createKey("/PartsSet", {
            //                 Family:   oSnapRow.Family,
            //                 FromDate: oSnapRow.FromDate,
            //                 PartCode: oSnapRow.PartCode
            //             });
            //             mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
            //         });
            //     }

            //     // ✅ CHANGED: collect transient rows, delete context, submit via _submitInChunks
            //     var aTransientPayloads = [];

            //     aContexts.forEach(function (oContext) {

            //         var sPath = oContext.getPath();
            //         var sKey  = sPath.substring(1);
            //         var oData = oContext.getObject();

            //         // ── CREATE → collect into aTransientPayloads ──────────────────────────
            //         if (oContext.isTransient()) {

            //             var oCreatePayload = Object.assign({}, oData);
            //             delete oCreatePayload.__metadata;
            //             delete oCreatePayload._snapshotIndex;
            //             oCreatePayload.Status   = "SUBMITTED";
            //             oCreatePayload.FromDate = toODataDate(oCreatePayload.FromDate);

            //             console.log("Transient payload collected:", oCreatePayload);

            //             aTransientPayloads.push(oCreatePayload);

            //             // ✅ Remove transient context so oModel doesn't submit it again
            //             oContext.delete();
            //             return;
            //         }

            //         // ── EXISTING: PUT / DELETE+CREATE — completely unchanged ──────────────
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

            //                 var sDeletePath = oModel.createKey("/PartsSet", {
            //                     Family:   oSnapRow.Family,
            //                     FromDate: oSnapRow.FromDate,
            //                     PartCode: oSnapRow.PartCode
            //                 });

            //                 oModel.resetChanges([sPath]);

            //                 console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //                 console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //                 iPendingOperations += 2;
            //                 bHasChanges = true;

            //                 doDeleteCreate(sDeletePath, oCreateData, false);
            //                 return;
            //             }

            //             // ── Normal PUT ────────────────────────────────────────────────────
            //             var oPutData = Object.assign({}, oData);
            //             delete oPutData.__metadata;
            //             delete oPutData._snapshotIndex;
            //             oPutData.Status   = "SUBMITTED";
            //             oPutData.FromDate = toODataDate(oPutData.FromDate);

            //             oModel.resetChanges([sPath]);

            //             console.log("PUT path:", sPath, "| Data:", oPutData);

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

            //     // ✅ CHANGED: submit all transient rows via ONE chunked batch call
            //     if (aTransientPayloads.length > 0) {
            //         bHasChanges = true;
            //         that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 500);
            //     }

            //     if (!bHasChanges) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ✅ setBusy only for PUT/DELETE+CREATE operations
            //     // _submitInChunks manages its own busy state
            //     if (iPendingOperations > 0) {
            //         oView.setBusy(true);
            //     }
            // },

            //new 20-04

            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("partMasterTable");
                var oView = this.getView();
                var that = this;

                var oVm = this.getView().getModel("viewModel");
                var sMail = oVm ? oVm.getProperty("/ASMEmail") : "";

                // ── Key fields that trigger DELETE+CREATE instead of PUT ──────────────────
                var aKeyFields = ["Family", "PartCode"];

                // ═════════════════════════════════════════════════════════════════════════
                // HELPERS
                // ═════════════════════════════════════════════════════════════════════════

                function toODataDate(vDate) {
                    if (!vDate) return vDate;
                    if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;
                    var oDate;
                    if (vDate instanceof Date) {
                        oDate = vDate;
                    } else if (typeof vDate === "string") {
                        var p = vDate.substring(0, 10).split("-");
                        oDate = new Date(+p[0], +p[1] - 1, +p[2]);
                    } else {
                        return vDate;
                    }
                    return "/Date(" + Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate()) + ")/";
                }

                function normDate(v) {
                    if (!v) return "";
                    if (typeof v === "string" && v.includes("/Date(")) {
                        var m = v.match(/\/Date\((-?\d+)/);
                        return m ? +m[1] : "";
                    }
                    if (v instanceof Date) return isNaN(v) ? "" : v.getTime();
                    var d = new Date(v);
                    return isNaN(d) ? String(v) : d.getTime();
                }

                // Strip metadata, stamp Status/Mail/FromDate
                function buildPayload(oRaw, vFromDate) {
                    var o = Object.assign({}, oRaw);
                    delete o.__metadata;
                    delete o._snapshotIndex;
                    delete o._selectedForDelete;
                    o.Status = "SUBMITTED";
                    o.FromDate = toODataDate(vFromDate !== undefined ? vFromDate : o.FromDate);
                    if (sMail) o.Mail = sMail;
                    return o;
                }

                // Build the three-field OData key path for PartsSet
                function makeKey(oRow) {
                    return oModel.createKey("/PartsSet", {
                        Family: oRow.Family,
                        FromDate: oRow.FromDate,
                        PartCode: oRow.PartCode
                    });
                }

                // Register a new isolated deferred group and return its id
                function newGroup(sPrefix) {
                    var sId = sPrefix + "_" + Date.now();
                    var aCur = oModel.getDeferredGroups();
                    if (aCur.indexOf(sId) < 0) oModel.setDeferredGroups(aCur.concat([sId]));
                    return sId;
                }

                // Inspect $batch response for row-level HTTP errors
                function batchErrors(oData) {
                    var aErrs = [];
                    ((oData && oData.__batchResponses) || []).forEach(function (r) {
                        if (+r.statusCode >= 400) {
                            try {
                                aErrs.push(JSON.parse(r.body).error.message.value);
                            } catch (e) {
                                aErrs.push("A row failed (HTTP " + r.statusCode + ").");
                            }
                        }
                    });
                    return aErrs;
                }

                // Parse a human-readable message from an OData error response
                function extractErrMsg(oError) {
                    try {
                        var b = JSON.parse(oError.responseText || oError.message || "");
                        if (b.error && b.error.message && b.error.message.value) return b.error.message.value;
                    } catch (e) { /* fallthrough */ }
                    return "An error occurred while saving. Please try again.";
                }

                // ═════════════════════════════════════════════════════════════════════════
                // OPERATION QUEUES  (populated by the two flow branches below)
                // ═════════════════════════════════════════════════════════════════════════

                // Each item:  { payload: {} }
                var aPostRows = [];

                // Each item:  { sPath: "", oPayload: {} }
                var aPutRows = [];

                // Each item:  { sDeletePath: "", oCreatePayload: {} }
                var aDCRows = [];

                // ═════════════════════════════════════════════════════════════════════════
                // BRANCH A — FILTERED FLOW
                // Table is backed by a JSON model.
                // isTransient() does NOT exist on JSON model contexts — never call it here.
                // Compare every visible row against the _allData snapshot.
                // ═════════════════════════════════════════════════════════════════════════

                if (this._isFiltered) {

                    var aFiltered = oTable.getModel().getProperty("/") || [];
                    var aSnap = that._allData ? that._allData.slice() : [];
                    var aIgnore = ["__metadata", "Status", "_snapshotIndex","_selectedForDelete"];

                    aFiltered.forEach(function (oRow) {

                        // ── Match against snapshot ────────────────────────────────────────
                        var oOrig = aSnap.find(function (s) {
                            return s._snapshotIndex === oRow._snapshotIndex;
                        })
                            || aSnap.find(function (s) {
                                return s.Family === oRow.Family &&
                                    s.PartCode === oRow.PartCode;
                            });

                        // ── No original → new row created while filtered → POST ───────────
                        if (!oOrig) {
                            aPostRows.push({ payload: buildPayload(oRow, oRow.FromDate) });
                            return;
                        }

                        // ── Detect whether anything actually changed ──────────────────────
                        var bChanged = Object.keys(oRow)
                            .filter(function (k) { return aIgnore.indexOf(k) < 0; })
                            .some(function (k) {
                                return k === "FromDate"
                                    ? normDate(oRow[k]) !== normDate(oOrig[k])
                                    : String(oRow[k]) !== String(oOrig[k]);
                            });

                        if (!bChanged) return;

                        // ── Key changed → DELETE+CREATE;  else → PUT ─────────────────────
                        var bKeyChanged = aKeyFields.some(function (k) {
                            return k === "FromDate"
                                ? normDate(oRow[k]) !== normDate(oOrig[k])
                                : String(oRow[k]) !== String(oOrig[k]);
                        });

                        if (bKeyChanged) {
                            aDCRows.push({
                                sDeletePath: makeKey(oOrig),
                                oCreatePayload: buildPayload(oRow, oRow.FromDate)
                            });
                        } else {
                            aPutRows.push({
                                sPath: makeKey(oOrig),
                                oPayload: buildPayload(oRow, oRow.FromDate)
                            });
                        }
                    });

                    // ═════════════════════════════════════════════════════════════════════════
                    // BRANCH B — NORMAL (UNFILTERED) FLOW
                    // Table is backed by the OData model — contexts are OData contexts and
                    // DO have isTransient().  This block must never run when _isFiltered=true.
                    // ═════════════════════════════════════════════════════════════════════════

                } else {

                    sap.ui.getCore().applyChanges();

                    // ✅ oBinding / aContexts declared INSIDE the else block only.
                    //    When _isFiltered=true the table is on a JSON model whose contexts
                    //    have no isTransient() — calling it would throw the TypeError.
                    var oBinding = oTable.getBinding("rows");
                    var aContexts = oBinding.getContexts(0, oBinding.getLength());
                    var mPending = oModel.getPendingChanges();

                    // ── Validate required fields on new (transient) rows before any I/O ──
                    //    Also guarded by typeof check as an extra safety net.
                    var aMissing = [];
                    aContexts.forEach(function (oCtx) {
                        if (typeof oCtx.isTransient !== "function" || !oCtx.isTransient()) return;
                        var oData = oCtx.getObject();
                        if (!oData.Family || String(oData.Family).trim() === "") aMissing.push("Material Group");
                        if (!oData.PartCode || String(oData.PartCode).trim() === "") aMissing.push("Part Code");
                    });
                    if (aMissing.length > 0) {
                        var aUnique = aMissing.filter(function (v, i, a) { return a.indexOf(v) === i; });
                        sap.m.MessageBox.error("Please fill in the required fields: " + aUnique.join(", "));
                        return;
                    }

                    // ── Build snapshot path → row lookup for key comparison ───────────────
                    var mSnap = {};
                    (that._allData || []).forEach(function (r) {
                        mSnap[makeKey(r).substring(1)] = r;
                    });

                    aContexts.forEach(function (oCtx) {

                        // ── Transient (new) rows → collect for POST ───────────────────────
                        if (oCtx.isTransient()) {
                            var oData = oCtx.getObject();
                            aPostRows.push({ payload: buildPayload(oData, oData.FromDate) });
                            oCtx.delete();   // remove from binding — prevents model re-submitting it
                            return;
                        }

                        // ── Existing rows: only process rows that ACTUALLY have a change ──
                        var sPath = oCtx.getPath();
                        var sKey = sPath.substring(1);
                        if (!mPending[sKey]) return;   // ✅ untouched row → skip entirely

                        var oData = oCtx.getObject();
                        var oPend = mPending[sKey];
                        var oSnap = mSnap[sKey];
                        var oMerged = Object.assign({}, oData, oPend);

                        // ✅ Remove from the model's default queue immediately.
                        //    This prevents it being swept up by any stray submitChanges()
                        //    call elsewhere in the app (the root cause of the "random extra
                        //    rows" bug — now fully eliminated).
                        oModel.resetChanges([sPath]);

                        // ── Key changed → DELETE+CREATE;  else → PUT ─────────────────────
                        var bKeyChanged = oSnap && aKeyFields.some(function (k) {
                            return k === "FromDate"
                                ? normDate(oMerged[k]) !== normDate(oSnap[k])
                                : String(oMerged[k]) !== String(oSnap[k]);
                        });

                        if (bKeyChanged) {
                            aDCRows.push({
                                sDeletePath: makeKey(oSnap),
                                oCreatePayload: buildPayload(oMerged, oMerged.FromDate)
                            });
                        } else {
                            aPutRows.push({
                                sPath: sPath,
                                oPayload: buildPayload(oMerged, oMerged.FromDate)
                            });
                        }
                    });
                }

                // ═════════════════════════════════════════════════════════════════════════
                // TOTAL OPERATION COUNT
                // POST rows are chunked at 500 → count chunks not individual rows.
                // All PUT rows go in one isolated batch → counts as 1 batch operation.
                // DELETE+CREATE → 2 per row (DELETE then CREATE run sequentially).
                // ═════════════════════════════════════════════════════════════════════════

                var CHUNK_SIZE = 500;
                var aPostChunks = [];
                for (var ci = 0; ci < aPostRows.length; ci += CHUNK_SIZE) {
                    aPostChunks.push(aPostRows.slice(ci, ci + CHUNK_SIZE));
                }

                var iPutBatch = aPutRows.length > 0 ? 1 : 0;
                var iTotalOps = aPostChunks.length + iPutBatch + (aDCRows.length * 2);

                if (iTotalOps === 0) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // ═════════════════════════════════════════════════════════════════════════
                // COMPLETION TRACKING
                // Single shared counter across all operation types.
                // done() is called exactly once per counted operation.
                // fail() surfaces the error then calls done() to keep the counter moving.
                // ═════════════════════════════════════════════════════════════════════════

                var iPending = iTotalOps;
                var bHasError = false;
                var bFiltered = this._isFiltered;   // capture now — async callbacks run later

                oView.setBusy(true);

                function done() {
                    iPending--;
                    console.log("op done, remaining:", iPending);
                    if (iPending > 0) return;

                    // All operations have completed
                    oView.setBusy(false);
                    if (!bHasError) {
                        sap.m.MessageToast.show("Saved successfully");
                        if (bFiltered) {
                            that.onClearFilter();
                        } else {
                            oTable.getBinding("rows").refresh();
                        }
                    }
                }

                function fail(oError, sCtx) {
                    console.error("Save failed [" + sCtx + "]:", oError);
                    bHasError = true;
                    sap.m.MessageBox.error(extractErrMsg(oError));
                    done();   // consume this operation's slot so iPending can still reach 0
                }

                // ═════════════════════════════════════════════════════════════════════════
                // EXECUTE — POST (new rows) in sequential chunks of 500
                // ═════════════════════════════════════════════════════════════════════════

                if (aPostChunks.length > 0) {

                    (function submitChunk(idx) {
                        if (idx >= aPostChunks.length) return;

                        var sGrp = newGroup("postChunk_" + idx);
                        var aChunk = aPostChunks[idx];

                        aChunk.forEach(function (r) {
                            oModel.create("/PartsSet", r.payload, { groupId: sGrp });
                        });

                        oModel.submitChanges({
                            groupId: sGrp,
                            success: function (oData) {
                                var aErrs = batchErrors(oData);
                                if (aErrs.length) {
                                    bHasError = true;
                                    sap.m.MessageBox.error(
                                        aErrs.length + " row(s) failed to create:\n" +
                                        aErrs.slice(0, 5).join("\n")
                                    );
                                }
                                done();
                                submitChunk(idx + 1);   // fire next chunk sequentially
                            },
                            error: function (oError) {
                                fail(oError, "POST chunk " + (idx + 1));
                                // Abort all remaining chunks and release their pending slots
                                // so the busy state clears correctly
                                var iRemaining = aPostChunks.length - idx - 1;
                                iPending -= iRemaining;
                                if (iPending <= 0) oView.setBusy(false);
                            }
                        });

                    }(0));
                }

                // ═════════════════════════════════════════════════════════════════════════
                // EXECUTE — PUT (existing rows, no key change) in one isolated batch
                // ═════════════════════════════════════════════════════════════════════════

                if (aPutRows.length > 0) {

                    var sPutGrp = newGroup("putBatch");

                    aPutRows.forEach(function (r) {
                        // ✅ groupId isolates these rows completely.
                        //    submitChanges below will ONLY fire this group —
                        //    no other pending model changes can be swept in.
                        oModel.update(r.sPath, r.oPayload, { groupId: sPutGrp, merge: false });
                    });

                    oModel.submitChanges({
                        groupId: sPutGrp,
                        success: function (oData) {
                            var aErrs = batchErrors(oData);
                            if (aErrs.length) {
                                bHasError = true;
                                sap.m.MessageBox.error(
                                    aErrs.length + " row(s) failed to update:\n" +
                                    aErrs.slice(0, 5).join("\n")
                                );
                            }
                            done();   // the entire PUT batch counts as exactly 1 operation
                        },
                        error: function (oError) {
                            fail(oError, "PUT batch");
                        }
                    });
                }

                // ═════════════════════════════════════════════════════════════════════════
                // EXECUTE — DELETE + CREATE (key field changed — must run sequentially)
                // Each pair counts as 2 operations: one for DELETE, one for CREATE.
                // If DELETE fails the CREATE is skipped but its slot is still consumed
                // so iPending correctly reaches 0 and the busy state always clears.
                // ═════════════════════════════════════════════════════════════════════════

                aDCRows.forEach(function (op) {

                    oModel.remove(op.sDeletePath, {
                        success: function () {
                            done();   // ← DELETE slot consumed

                            oModel.create("/PartsSet", op.oCreatePayload, {
                                success: function () {
                                    done();   // ← CREATE slot consumed
                                },
                                error: function (oError) {
                                    fail(oError, "CREATE after DELETE [" + op.sDeletePath + "]");
                                    // fail() calls done() — CREATE slot consumed
                                }
                            });
                        },
                        error: function (oError) {
                            fail(oError, "DELETE [" + op.sDeletePath + "]");
                            // DELETE failed → skip CREATE but still consume its slot
                            done();   // ← CREATE slot consumed (skipped)
                        }
                    });
                });

            },

            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");
                if (oSheet) oSheet.openBy(oEvent.getSource());
            },

            _getAllFields: function () {
                return [
                    { key: "Family", label: "Material Group" },
                    { key: "PartCode", label: "Part Code" },
                    { key: "PartDescr", label: "Description" },
                    { key: "OeGma", label: "OE/GMA/GMA OE" },
                    { key: "FromDate", label: "Effective Date" },
                    { key: "Mrp", label: "MRP" },
                    { key: "MiyCost", label: "MIY Cost" },
                    { key: "MiyMarkup", label: "MIY Markup" },
                    { key: "ExShowOnRoad", label: "Ex showroom / On Road" },
                    { key: "MiyCostPerc", label: "MIY Cost %" },
                    { key: "MiyMarkupPerc", label: "MIY Markup %" },
                    { key: "Status", label: "Status" }
                ];
            },

            onExcelDownloadAll: function () {

                const oTable = this.byId("partMasterTable");
                const oBinding = oTable.getBinding("rows");

                const iLength = oBinding.getLength();
                const aData = oBinding.getContexts(0, iLength).map(c => c.getObject());

                this._exportToExcel(aData, this._getAllFields());
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
                const aSelected = oList.getSelectedItems();

                const aFields = aSelected.map(item =>
                    item.getBindingContext("fields").getObject()
                );

                const oTable = this.byId("partMasterTable");
                const oBinding = oTable.getBinding("rows");

                const aData = oBinding.getContexts(0, oBinding.getLength())
                    .map(c => c.getObject());

                this._exportToExcel(aData, aFields);

                this.byId("fieldSelectDialog").close();
            },

            _exportToExcel: function (aData, aSelectedFields) {

                const aProcessedData = aData.map(function (oRow) {

                    const oCopy = Object.assign({}, oRow);

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
                        // ISO or plain string
                        else {
                            oDate = new Date(oCopy.FromDate);
                        }

                        if (oDate && !isNaN(oDate)) {
                            const dd = String(oDate.getDate()).padStart(2, "0");
                            const mm = String(oDate.getMonth() + 1).padStart(2, "0");
                            const yyyy = oDate.getFullYear();
                            oCopy.FromDate = dd + "-" + mm + "-" + yyyy;  // ✅ dd-mm-yyyy
                        }
                    }

                    return oCopy;
                });

                const oSettings = {
                    workbook: {
                        columns: aSelectedFields.map(f => ({
                            label: f.label,
                            property: f.key,
                            type: sap.ui.export.EdmType.String
                        }))
                    },
                    dataSource: aProcessedData,   // ✅ use processed data
                    fileName: aData.length === 0
                        ? "PartCodeMaster_Template.xlsx"
                        : "PartCodeMaster_Export.xlsx"
                };

                const oSheet = new sap.ui.export.Spreadsheet(oSettings);
                oSheet.build().finally(() => oSheet.destroy());
            },

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

                    console.log("Excel Data:", aExcelData);

                    this._insertIntoTable(aExcelData);

                }.bind(this);

                reader.readAsBinaryString(oFile);
            },

            // _insertIntoTable: function (aExcelData) {

            //     const oTable = this.byId("partMasterTable");
            //     const oBinding = oTable.getBinding("rows");

            //     if (!oBinding) {
            //         sap.m.MessageToast.show("Table not ready");
            //         return;
            //     }

            //     const oVm = this.getView().getModel("viewModel");
            //     const sMail = oVm.getProperty("/ASMEmail");

            //     // if (this._isFiltered) {
            //     //     this.onClearFilter();
            //     // }


            //     // ─── FILTERED FLOW ────────────────────────────────────────────────────────
            // if (this._isFiltered) {

            //     var oTableModel       = oTable.getModel();
            //     var aFilteredData     = oTableModel.getProperty("/") || [];
            //     var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

            //     var aIgnoreKeys = ["__metadata", "Status", "_snapshotIndex"];

            //     function normDateStr(v) {
            //         if (!v) return "";
            //         if (typeof v === "string" && v.indexOf("/Date(") === 0) {
            //             return new Date(parseInt(v.match(/\d+/)[0], 10)).toISOString().substring(0, 10);
            //         }
            //         if (v instanceof Date) return v.toISOString().substring(0, 10);
            //         return String(v).substring(0, 10);
            //     }

            //     function toODataDate(vDate) {
            //         if (!vDate) return vDate;
            //         if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

            //         var oDate;
            //         if (vDate instanceof Date) {
            //             oDate = vDate;
            //         } else if (typeof vDate === "string") {
            //             var aParts = vDate.substring(0, 10).split("-");
            //             oDate = new Date(
            //                 parseInt(aParts[0], 10),
            //                 parseInt(aParts[1], 10) - 1,
            //                 parseInt(aParts[2], 10)
            //             );
            //         } else {
            //             return vDate;
            //         }

            //         // ✅ Use LOCAL date parts — avoids IST double-shift
            //         var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
            //         return "/Date(" + iMs + ")/";
            //     }

            //     var aChangedRows = [];

            //     aFilteredData.forEach(function (oFilteredRow) {

            //         var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //             return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //         });

            //         if (!oOriginalRow) {
            //             oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o.Family   === oFilteredRow.Family &&
            //                        o.PartCode === oFilteredRow.PartCode;
            //             });
            //         }

            //         var bChanged = false;

            //         // ✅ FIXED: aKeys declared inside the if block, bChanged uses it correctly
            //     if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1;
            //                 });
            //                 bChanged = aKeys.some(function (k) {
            //                     if (k === "FromDate") {
            //                         return normDateStr(oFilteredRow[k]) !== normDateStr(oOriginalRow[k]);
            //                     }
            //                     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //                 });
            //             }

            //         console.log(
            //             "Row → Family:", oFilteredRow.Family,
            //             "| PartCode:", oFilteredRow.PartCode,
            //             "| SnapshotIndex:", oFilteredRow._snapshotIndex,
            //             "| Changed:", bChanged
            //         );

            //         if (bChanged) {
            //             aChangedRows.push({
            //                 oRow:         oFilteredRow,
            //                 oOriginalRow: oOriginalRow
            //             });
            //         }
            //     });

            //     if (aChangedRows.length === 0) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     var aDeleteCreate = [];
            //     var aPutRows      = [];

            //     aChangedRows.forEach(function (oItem) {
            //         var bKeyChanged = oItem.oOriginalRow && aKeyFields.some(function (k) {
            //             return String(oItem.oRow[k]) !== String(oItem.oOriginalRow[k]);
            //         });

            //         if (bKeyChanged) {
            //             aDeleteCreate.push(oItem);
            //         } else {
            //             aPutRows.push(oItem);
            //         }
            //     });

            //     iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2);

            //     oView.setBusy(true);

            //     aPutRows.forEach(function (oItem) {
            //         var oRow         = oItem.oRow;
            //         var oOriginalRow = oItem.oOriginalRow;

            //         // ✅ Key: raw /Date(...)/ string from _allData
            //         var sPath = oModel.createKey("/PartsSet", {
            //             Family:   oOriginalRow ? oOriginalRow.Family   : oRow.Family,
            //             FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //             PartCode: oOriginalRow ? oOriginalRow.PartCode : oRow.PartCode
            //         });

            //         var oData = Object.assign({}, oRow);
            //         delete oData.__metadata;
            //         delete oData._snapshotIndex;
            //         oData.Status = "SUBMITTED";

            //         // ✅ Body: user's actual date value, properly converted
            //         oData.FromDate = toODataDate(oRow.FromDate);

            //         console.log("PUT path:", sPath, "| Body FromDate:", oData.FromDate);

            //         oModel.update(sPath, oData, {
            //             merge: false,
            //             success: function () {
            //                 console.log("PUT success:", sPath);
            //                 onOperationDone(true);
            //             },
            //             error: function (oError) {
            //                 handleError(oError, sPath, true);
            //             }
            //         });
            //     });

            //     aDeleteCreate.forEach(function (oItem) {
            //         var oRow         = oItem.oRow;
            //         var oOriginalRow = oItem.oOriginalRow;

            //         var sDeletePath = oModel.createKey("/PartsSet", {
            //             Family:   oOriginalRow.Family,
            //             FromDate: oOriginalRow.FromDate,
            //             PartCode: oOriginalRow.PartCode
            //         });

            //         var oCreateData = Object.assign({}, oRow);
            //         delete oCreateData.__metadata;
            //         delete oCreateData._snapshotIndex;
            //         oCreateData.Status   = "SUBMITTED";
            //         oCreateData.FromDate = toODataDate(oRow.FromDate); // ✅ user's new date, not original

            //         doDeleteCreate(sDeletePath, oCreateData, true);
            //     });

            //     return;
            // }
            //     console.log("Excel rows received:", aExcelData);  // ✅ debug

            //     aExcelData.forEach(function (oRow) {

            //         console.log("Processing row:", oRow);  // ✅ debug each row

            //         // ✅ Parse Effective Date from Excel if present
            //         var oFromDate;
            //         if (oRow["Effective Date"]) {
            //             if (typeof oRow["Effective Date"] === "number") {
            //                 // Excel serial number → JS Date
            //                 var excelEpoch = new Date(Date.UTC(1899, 11, 30));
            //                 oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
            //             } else {
            //                 oFromDate = new Date(oRow["Effective Date"]);
            //             }
            //         } else {
            //             oFromDate = new Date();
            //         }
            //         oFromDate.setUTCHours(12, 0, 0, 0); // ✅ noon UTC avoids timezone day-shift

            //         oBinding.create({
            //             Family:        String(oRow["Material Group"]        || ""),
            //             PartCode:      String(oRow["Part Code"]             || ""),
            //             PartDescr:     String(oRow["Description"]           || ""),
            //             OeGma:         String(oRow["OE/GMA/GMA OE"]         || "OE"),
            //             Mrp:           String(oRow["MRP"]                   || "0.000"),
            //             MiyCost:       String(oRow["MIY Cost"]              || "0.000"),
            //             MiyMarkup:     String(oRow["MIY Markup"]            || "0.000"),
            //             ExShowOnRoad:  String(oRow["Ex showroom / On Road"] || "EX SHOWROOM"),
            //             MiyCostPerc:   String(oRow["MIY Cost %"]            || "0.000"),
            //             MiyMarkupPerc: String(oRow["MIY Markup %"]          || "0.000"),
            //             Mail:          sMail,
            //             FromDate:      oFromDate,   // ✅ from Excel or today
            //             Status:        "SUBMITTED"
            //         });

            //     }.bind(this));

            //     sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            // },


            _insertIntoTable: function (aExcelData) {

                const oTable = this.byId("partMasterTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                // ✅ Clear filter first so oBinding points to OData binding, not JSON model
                if (this._isFiltered) {
                    this.onClearFilter();
                }

                // ✅ Clear any existing draft/transient rows before inserting new ones
                this._clearDraftRows();

                console.log("Excel rows received:", aExcelData);

                var iCreated = 0;

                aExcelData.forEach(function (oRow) {

                    console.log("Processing row:", oRow);

                    // ─── Parse Effective Date ─────────────────────────────────────────────
                    var oFromDate;

                    if (oRow["Effective Date"]) {
                        if (typeof oRow["Effective Date"] === "number") {
                            // Excel serial date → JS Date (UTC)
                            var excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
                        } else {
                            var sParsed = String(oRow["Effective Date"]).trim();
                            // Handle dd-mm-yyyy format from Excel
                            if (/^\d{2}-\d{2}-\d{4}$/.test(sParsed)) {
                                var aParts = sParsed.split("-");
                                oFromDate = new Date(Date.UTC(
                                    parseInt(aParts[2], 10),
                                    parseInt(aParts[1], 10) - 1,
                                    parseInt(aParts[0], 10)
                                ));
                            } else {
                                oFromDate = new Date(sParsed);
                            }
                        }
                    } else {
                        oFromDate = new Date();
                    }

                    // Guard: fallback to today if date is invalid
                    if (isNaN(oFromDate.getTime())) {
                        console.warn("Invalid date, defaulting to today:", oRow["Effective Date"]);
                        oFromDate = new Date();
                    }

                    // ✅ Pin to UTC midnight — no timezone shift
                    oFromDate = new Date(Date.UTC(
                        oFromDate.getUTCFullYear(),
                        oFromDate.getUTCMonth(),
                        oFromDate.getUTCDate()
                    ));

                    // ✅ Create transient row directly on OData binding — same as modelmaster
                    oBinding.create({
                        Family: String(oRow["Material Group"] || ""),
                        PartCode: String(oRow["Part Code"] || ""),
                        PartDescr: String(oRow["Description"] || ""),
                        OeGma: String(oRow["OE/GMA/GMA OE"] || "OE"),
                        Mrp: String(oRow["MRP"] || "0.000"),
                        MiyCost: String(oRow["MIY Cost"] || "0.000"),
                        MiyMarkup: String(oRow["MIY Markup"] || "0.000"),
                        // ExShowOnRoad:  String(oRow["Ex showroom / On Road"] || ""),
                        ExShowOnRoad: String(oRow["Ex showroom / On Road"] || "").toUpperCase(),
                        MiyCostPerc: String(oRow["MIY Cost %"] || "0.000"),
                        MiyMarkupPerc: String(oRow["MIY Markup %"] || "0.000"),
                        Mail: sMail,
                        FromDate: oFromDate,   // ✅ JS Date object — OData binding handles conversion
                        Status: "SUBMITTED"
                    });

                    iCreated++;

                }.bind(this));

                // ✅ Clear pending excel payloads — we no longer need chunked submit path
                this._pendingExcelPayloads = null;

                sap.m.MessageToast.show(iCreated + " rows loaded. Click Submit to save.");
            },

            _chunkArray: function (aArray, iSize) {
                var aChunks = [];
                for (var i = 0; i < aArray.length; i += iSize) {
                    aChunks.push(aArray.slice(i, i + iSize));
                }
                return aChunks;
            },


            // _submitInChunks: function (aAllRows, oBinding, iChunkSize) {
            //     var that        = this;
            //     var aChunks     = this._chunkArray(aAllRows, iChunkSize || 500);
            //     var iTotal      = aAllRows.length;
            //     var iSubmitted  = 0;
            //     var iChunkIndex = 0;
            //     var oView       = this.getView();
            //     var oModel      = this.getView().getModel();

            //     oView.setBusy(true);

            //     function submitNextChunk() {
            //         if (iChunkIndex >= aChunks.length) {
            //             oView.setBusy(false);
            //             sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully");
            //             oBinding.refresh();
            //             return;
            //         }

            //         var aChunk = aChunks[iChunkIndex];
            //         console.log("Submitting chunk", iChunkIndex + 1, "of", aChunks.length, "→", aChunk.length, "rows");

            //         // ✅ Unique group per chunk — prevents stale requests leaking
            //         var sGroupId    = "chunkGroup_" + iChunkIndex;
            //         var aDeferred   = oModel.getDeferredGroups();
            //         if (aDeferred.indexOf(sGroupId) === -1) {
            //             oModel.setDeferredGroups(aDeferred.concat([sGroupId]));
            //         }

            //         aChunk.forEach(function (oCreateData) {
            //             oModel.create("/PartsSet", oCreateData, {   // ✅ PartsSet
            //                 groupId: sGroupId
            //             });
            //         });

            //         oModel.submitChanges({
            //             groupId: sGroupId,
            //             success: function () {
            //                 iSubmitted += aChunk.length;
            //                 iChunkIndex++;
            //                 console.log("Chunk", iChunkIndex, "done. Total submitted:", iSubmitted);
            //                 submitNextChunk();
            //             },
            //             error: function (oError) {
            //                 oView.setBusy(false);
            //                 console.error("Chunk", iChunkIndex + 1, "failed:", oError);

            //                 var sMessage = "Batch failed at chunk " + (iChunkIndex + 1);
            //                 try {
            //                     var oBody = JSON.parse(oError.responseText);
            //                     if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                         sMessage = oBody.error.message.value;
            //                     }
            //                 } catch (e) {}

            //                 sap.m.MessageBox.error(
            //                     sMessage + ". " + iSubmitted + " of " + iTotal + " rows were already saved."
            //                 );
            //             }
            //         });
            //     }

            //     submitNextChunk();
            // },


            // onPriceChange: function (oEvent) {
            //     var oInput = oEvent.getSource();
            //     var oContext = oInput.getBindingContext();

            //     if (!oContext) {
            //         return;
            //     }

            //     var oModel = oContext.getModel();
            //     var sPath = oContext.getPath();

            //     // Get values
            //     var fMrp = parseFloat(
            //         oModel.getProperty(sPath + "/Mrp")
            //     ) || 0;

            //     var fMiyCost = parseFloat(
            //         oModel.getProperty(sPath + "/MiyCost")
            //     ) || 0;

            //     var fMiyMarkup = parseFloat(
            //         oModel.getProperty(sPath + "/MiyMarkup")
            //     ) || 0;

            //     var fMiyCostPerc = 0;

            //     if (fMrp > 0) {
            //         fMiyCostPerc = Number(
            //             ((fMiyCost / fMrp) * 100).toFixed(2)
            //         );
            //     }

            //     var fMiyMarkupPerc = 0;

            //     if (fMrp > 0) {
            //         fMiyMarkupPerc = Number(
            //             ((fMiyMarkup / fMrp) * 100).toFixed(2)
            //         );
            //     }

            //     // Set calculated values
            //     oModel.setProperty(
            //         sPath + "/MiyCostPerc",
            //         fMiyCostPerc
            //     );

            //     oModel.setProperty(
            //         sPath + "/MiyMarkupPerc",
            //         fMiyMarkupPerc
            //     );
            // },

            onPriceChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var oContext = oInput.getBindingContext();

    if (!oContext) {
        return;
    }

    var oModel = oContext.getModel();
    var sPath = oContext.getPath();

    // Get values
    var fMrp = parseFloat(oModel.getProperty(sPath + "/Mrp")) || 0;
    var fMiyCost = parseFloat(oModel.getProperty(sPath + "/MiyCost")) || 0;
    var fMiyMarkup = parseFloat(oModel.getProperty(sPath + "/MiyMarkup")) || 0;

    // Calculate as strings (Edm.Decimal expects string values)
    var sMiyCostPerc = fMrp > 0
        ? ((fMiyCost / fMrp) * 100).toFixed(2)
        : "0.00";

    var sMiyMarkupPerc = fMrp > 0
        ? ((fMiyMarkup / fMrp) * 100).toFixed(2)
        : "0.00";

    // Set calculated values
    oModel.setProperty(sPath + "/MiyCostPerc", sMiyCostPerc);
    oModel.setProperty(sPath + "/MiyMarkupPerc", sMiyMarkupPerc);
},

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
                        var oTable = that.byId("partMasterTable");
                        var oVm = that.getView().getModel("viewModel");
                        var sMail = oVm.getProperty("/ASMEmail");

                        oTable.setModel(that.getView().getModel()); // ✅ restore OData model
                        oTable.bindRows({
                            path: "/PartsSet",
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
                        oModel.create("/PartsSet", oCreateData, {
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


            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },


            onSort: function (oEvent) {
                var that = this;
                var oColumn = oEvent.getParameter("column");
                var sSortOrder = oEvent.getParameter("sortOrder");
                var sProperty = oColumn.getSortProperty();
                var oTable = this.byId("partMasterTable");
                var bDescending = (sSortOrder === "Descending");

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                var aData = aContexts.map(function (ctx) {
                    var o = Object.assign({}, ctx.getObject());

                    // ✅ Restore _snapshotIndex and original /Date(...)/ from _allData
                    if (that._allData) {
                        var oSnap;
                        if (o._snapshotIndex !== undefined) {
                            oSnap = that._allData.find(function (s) {
                                return s._snapshotIndex === o._snapshotIndex;
                            });
                        }
                        if (!oSnap) {
                            oSnap = that._allData.find(function (s) {
                                return s.Family === o.Family &&
                                    s.PartCode === o.PartCode;
                            });
                        }
                        if (oSnap) {
                            o._snapshotIndex = oSnap._snapshotIndex;
                            o.FromDate = oSnap.FromDate; // ✅ raw /Date(...)/ string for createKey
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

                // ✅ Convert /Date(...)/ → Date object for DatePicker display ONLY
                //    after /Date(...)/ string is already saved on the row
                aData.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                var oJSONModel = new sap.ui.model.json.JSONModel(aData);
                oTable.setModel(oJSONModel);
                oTable.bindRows("/");

                // ✅ Routes onSubmit through filtered/JSONModel path
                this._isFiltered = true;

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },
        });
    }
);
