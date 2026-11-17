sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet"
    ],
    function (BaseController, Spreadsheet) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.regionmaster", {

            // onInit: async function () {
            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

            //     const oModel = this.getView().getModel();

            //     let sAsmName = "Anad Kumar";
            //     let sASMMail = "siva.durairaj@laderatechnology.com"
            //     //let sASMMail = "anandkumar.n@laderatechnology.com"

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


            //     const oTable = this.byId("regionTables");


            //     oTable.bindRows({
            //         path: "/RegionMasterSet",
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

    const oTable = this.byId("regionTables");

    oTable.bindRows({
        path: "/RegionMasterSet",
        filters: [this._getMailFilter()],
        events: {
                        dataReceived: function (oEvent) {

                            const oData = oEvent.getParameter("data");
                            const aData = (oData && oData.results) ? oData.results : [];

                            if (!aData.length) return;

                            // ✅ Tag index BEFORE deep clone
                            aData.forEach(function (o, i) {
                                o._snapshotIndex = i;
                            });

                            // ✅ Deep clone preserves _snapshotIndex in _allData
                            this._allData = JSON.parse(JSON.stringify(aData));

                            this._buildFilterDropdowns(aData);

                        }.bind(this)
                    }


                });


                var oView = this.getView();

                var oPopover = this.byId("excelPopover");

                if (oPopover) {
                    oView.addDependent(oPopover);
                }

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


            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                // 🔥 Build dropdowns
                this._buildFilterDropdowns(aData);
            },

            _buildFilterDropdowns: function (aData) {

                const aModels = [];
                const seenModel = {};

                aData.forEach(function (oRow) {
                    if (oRow.Region && !seenModel[oRow.Region]) {
                        seenModel[oRow.Region] = true;
                        aModels.push({
                            Region: oRow.Region,
                            Display: oRow.Region
                        });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ Models: aModels }),
                    "filter"
                );
            },


            onApplyFilter: function () {

                const aRegions = this.byId("filterModelCode").getSelectedKeys();

                let aFiltered = this._allData ? JSON.parse(JSON.stringify(this._allData)) : [];

                if (aRegions.length) {
                    aFiltered = aFiltered.filter(o => aRegions.includes(o.Region));
                }

                // ✅ FIX: correctly parse OData /Date(ms)/ format
                aFiltered.forEach(function (oRow) {
                    if (oRow.FromDate) {
                        var vDate = oRow.FromDate;
                        var oDate;

                        if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                            var iMs = parseInt(vDate.replace("/Date(", "").replace(")/", ""), 10);
                            oDate = new Date(iMs);
                        } else {
                            oDate = new Date(vDate);
                        }

                        if (!isNaN(oDate.getTime())) {
                            oRow.FromDate = oDate;
                        }
                    }
                });

                this._isFiltered = true;

                const oTable = this.byId("regionTables");
                oTable.setModel(new sap.ui.model.json.JSONModel(aFiltered));
                oTable.bindRows("/");
            },
            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("regionTables");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/RegionMasterSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("regionTables");
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
                    "January", "February", "March", "April",
                    "May", "June", "July", "August",
                    "September", "October", "November", "December"
                ];

                return oDate.getDate() + " " +
                    aMonths[oDate.getMonth()] + " " +
                    oDate.getFullYear();
            },
            onDateChange: function (oEvent) {
                const oPicker = oEvent.getSource();
                const sValue = oPicker.getValue();

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

                const oTable = this.byId("regionTables");
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

                // Delete all selected transient rows
                aSelectedRows.forEach(function (oContext) {

                    if (oContext.isTransient()) {
                        oContext.delete();
                    }

                });

                sap.m.MessageToast.show(
                    aSelectedRows.length + " row(s) removed successfully"
                );
            },

            onCreateMasterRow: function () {

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                console.log(oMail);

                console.log("HI");

                var oTable = this.byId("regionTables");
                var oBinding = oTable.getBinding("rows");

                const oDate = new Date();
                oDate.setHours(12, 0, 0, 0);

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                oBinding.create({

                    Region: "",
                    EngineType: "EV",
                    OperationNo: 0,
                    FromDate: oDate,
                    Ort01: "",
                    Spras: "EN",
                    Mail: oMail,
                    BasisRto: "EXSHOWROOM",
                    Status: "SUBMITTED",
                   
                });

            },




            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("regionTables");
                var oView = this.getView();
                var that = this;

                var bHasError = false;
                var iPendingOperations = 0;
                var aKeyFields = ["Region"];

                // function toODataDate(vDate) {
                //     if (!vDate) return vDate;
                //     if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

                //     var y, m, d;

                //     if (vDate instanceof Date) {
                //         y = vDate.getUTCFullYear();
                //         m = vDate.getUTCMonth();
                //         d = vDate.getUTCDate();
                //     } else if (typeof vDate === "string") {
                //         var aParts = vDate.substring(0, 10).split("-");
                //         y = parseInt(aParts[0], 10);
                //         m = parseInt(aParts[1], 10) - 1;
                //         d = parseInt(aParts[2], 10);
                //     } else {
                //         return vDate;
                //     }

                //     var iUtcMs    = Date.UTC(y, m, d);
                //     var iOffsetMs = -19800000;
                //     return "/Date(" + (iUtcMs + iOffsetMs) + ")/";
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
                        // "YYYY-MM-DD" from onDateChange getValue()
                        var aParts = vDate.substring(0, 10).split("-");
                        // ✅ Local date constructor — no UTC shift
                        oDate = new Date(
                            parseInt(aParts[0], 10),
                            parseInt(aParts[1], 10) - 1,
                            parseInt(aParts[2], 10)
                        );
                    } else {
                        return vDate;
                    }

                    // ✅ Use LOCAL date parts + Date.UTC — avoids IST -5:30 shift
                    // ❌ Removed: var iOffsetMs = -19800000  ← this was the root cause
                    var iMs = Date.UTC(
                        oDate.getFullYear(),
                        oDate.getMonth(),
                        oDate.getDate()
                    );

                    return "/Date(" + iMs + ")/";
                }

                function toDateStr(v) {
                    if (!v) return "";
                    if (typeof v === "string" && v.indexOf("/Date(") === 0) {
                        var ms = parseInt(v.replace("/Date(", "").replace(")/", ""), 10);
                        return new Date(ms).toISOString().substring(0, 10);
                    }
                    if (v instanceof Date) {
                        return v.toISOString().substring(0, 10);
                    }
                    return String(v).substring(0, 10);
                }

                function hasKeyFieldChanged(oFilteredRow, oOriginalRow) {
                    return aKeyFields.some(function (k) {
                        return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                    });
                }

                function buildDeletePath(oOriginalRow) {
                    return oModel.createKey("/RegionMasterSet", {
                        FromDate: oOriginalRow.FromDate,
                        Region: oOriginalRow.Region,
                        Spras: oOriginalRow.Spras
                    });
                }

                function buildCreatePayload(oRow, oOriginalRow) {
                    var oData = Object.assign({}, oRow);
                    delete oData.__metadata;
                    delete oData._snapshotIndex;
                    oData.Status = "SUBMITTED";
                    oData.FromDate = toODataDate(oRow.FromDate);
                    oData.Spras = oOriginalRow.Spras;
                    return oData;
                }

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
                            that.byId("regionTables").getBinding("rows").refresh();
                        }
                    }
                }

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

                // ─── FILTERED FLOW ───────────────────────────────────────────────────
                if (this._isFiltered) {

                    var oTableModel = oTable.getModel();
                    var aFilteredData = oTableModel.getProperty("/") || [];
                    var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

                    var aIgnoreKeys = ["__metadata", "Status", "_snapshotIndex"];
                    var aChangedRows = [];
                    var aNewRows = [];  // ✅ collect brand-new rows

                    aFilteredData.forEach(function (oFilteredRow) {

                        var oOriginalRow;
                        if (oFilteredRow.Status === "REJECTED") {
                            oOriginalRow = aOriginalSnapshot.find(function (o) {
                                return o._snapshotIndex === oFilteredRow._snapshotIndex;
                            });
                        } else {
                            oOriginalRow = aOriginalSnapshot.find(function (o) {
                                return o.Region === oFilteredRow.Region;
                            });
                        }

                        // ✅ No snapshot match = brand-new row → POST it
                        if (!oOriginalRow) {
                            if (oFilteredRow.Region) {
                                aNewRows.push(oFilteredRow);
                            }
                            return;
                        }

                        var bChanged = false;

                        var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                            return aIgnoreKeys.indexOf(k) === -1;
                        });

                        bChanged = aKeys.some(function (k) {
                            if (k === "FromDate") {
                                return toDateStr(oFilteredRow[k]) !== toDateStr(oOriginalRow[k]);
                            }
                            return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                        });

                        console.log(
                            "Row → Region:", oFilteredRow.Region,
                            "| Status:", oFilteredRow.Status,
                            "| Changed:", bChanged
                        );

                        if (bChanged) {
                            aChangedRows.push({
                                oRow: oFilteredRow,
                                oOriginalRow: oOriginalRow
                            });
                        }
                    });

                    // ✅ check both arrays
                    if (aChangedRows.length === 0 && aNewRows.length === 0) {
                        sap.m.MessageToast.show("No changes to save");
                        return;
                    }

                    var aDeleteCreate = [];
                    var aPutRows = [];

                    aChangedRows.forEach(function (oItem) {
                        if (oItem.oRow.Status === "REJECTED" &&
                            oItem.oOriginalRow &&
                            hasKeyFieldChanged(oItem.oRow, oItem.oOriginalRow)) {
                            aDeleteCreate.push(oItem);
                        } else {
                            aPutRows.push(oItem);
                        }
                    });

                    // ✅ include new rows in operation count
                    iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2) + aNewRows.length;

                    oView.setBusy(true);

                    // ✅ POST brand-new rows
                    aNewRows.forEach(function (oRow) {
                        var oData = Object.assign({}, oRow);
                        delete oData.__metadata;
                        delete oData._snapshotIndex;
                        oData.Status = "SUBMITTED";
                        oData.FromDate = toODataDate(oData.FromDate);

                        console.log("CREATE (new row) payload:", oData);

                        oModel.create("/RegionMasterSet", oData, {
                            success: function () {
                                console.log("CREATE success");
                                onOperationDone(true);
                            },
                            error: function (oError) {
                                handleError(oError, "/RegionMasterSet", true);
                            }
                        });
                    });

                    // PUT for normal changed rows
                    aPutRows.forEach(function (oItem) {

                        var sPath = oModel.createKey("/RegionMasterSet", {
                            FromDate: oItem.oOriginalRow ? oItem.oOriginalRow.FromDate : oItem.oRow.FromDate,
                            Region: oItem.oRow.Region,
                            Spras: oItem.oOriginalRow ? oItem.oOriginalRow.Spras : "EN"
                        });

                        var oData = Object.assign({}, oItem.oRow);
                        delete oData.__metadata;
                        delete oData._snapshotIndex;
                        oData.Status = "SUBMITTED";
                        oData.FromDate = toODataDate(oItem.oRow.FromDate);
                        oData.Spras = oItem.oOriginalRow ? oItem.oOriginalRow.Spras : oData.Spras;

                        console.log("PUT path:", sPath, "| Data:", oData);

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

                    // DELETE then CREATE for key-changed REJECTED rows
                    aDeleteCreate.forEach(function (oItem) {

                        var sDeletePath = buildDeletePath(oItem.oOriginalRow);
                        var oCreateData = buildCreatePayload(oItem.oRow, oItem.oOriginalRow);

                        console.log("DELETE path:", sDeletePath);
                        console.log("CREATE payload:", oCreateData);

                        oModel.remove(sDeletePath, {
                            success: function () {
                                console.log("DELETE success:", sDeletePath);
                                onOperationDone(true);

                                oModel.create("/RegionMasterSet", oCreateData, {
                                    success: function () {
                                        console.log("CREATE success");
                                        onOperationDone(true);
                                    },
                                    error: function (oError) {
                                        handleError(oError, "/RegionMasterSet", true);
                                    }
                                });
                            },
                            error: function (oError) {
                                handleError(oError, sDeletePath, true);
                                onOperationDone(true);
                            }
                        });
                    });

                    return;
                }

                // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────
                var aContexts = oTable.getBinding("rows").getContexts();

                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                var mPending = oModel.getPendingChanges();
                var bHasChanges = false;

                aContexts.forEach(function (oContext) {

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
                    var oData = oContext.getObject();

                    // CREATE → POST
                    if (oContext.isTransient()) {
                        var sODataDate = toODataDate(oData.FromDate);
                        oModel.setProperty(sPath + "/Status", "SUBMITTED");
                        oModel.setProperty(sPath + "/FromDate", sODataDate);
                        console.log("Transient FromDate sending:", sODataDate);
                        iPendingOperations++;
                        bHasChanges = true;
                        return;
                    }

                    // REJECTED + key field changed → DELETE + CREATE
                    if (oData.Status === "REJECTED" && mPending[sKey]) {

                        var oPending = mPending[sKey];
                        var bKeyChanged = aKeyFields.some(function (k) {
                            return oPending[k] !== undefined;
                        });

                        if (bKeyChanged) {

                            var oNewData = Object.assign({}, oData, oPending);
                            var oCreateData = Object.assign({}, oNewData);
                            delete oCreateData.__metadata;
                            delete oCreateData._snapshotIndex;
                            oCreateData.Status = "SUBMITTED";
                            oCreateData.FromDate = toODataDate(oPending.FromDate || oData.FromDate);
                            oCreateData.Spras = oData.Spras;

                            oModel.resetChanges([sPath]);

                            iPendingOperations += 2;
                            bHasChanges = true;

                            oModel.remove(sPath, {
                                success: function () {
                                    console.log("DELETE success:", sPath);
                                    onOperationDone(false);

                                    oModel.create("/RegionMasterSet", oCreateData, {
                                        success: function () {
                                            console.log("CREATE success");
                                            onOperationDone(false);
                                        },
                                        error: function (oError) {
                                            handleError(oError, "/RegionMasterSet", false);
                                        }
                                    });
                                },
                                error: function (oError) {
                                    handleError(oError, sPath, false);
                                    onOperationDone(false);
                                }
                            });

                            return;
                        }
                    }

                    // Normal UPDATE → PUT
                    if (mPending[sKey]) {
                        var oMerged = Object.assign({}, oData, mPending[sKey]);
                        oModel.resetChanges([sPath]);
                        oMerged.FromDate = toODataDate(mPending[sKey].FromDate || oData.FromDate);
                        oMerged.Status = "SUBMITTED";
                        oModel.update(sPath, oMerged, { merge: false });
                        iPendingOperations++;
                        bHasChanges = true;
                    }
                });

                if (!bHasChanges) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                oView.setBusy(true);

                function extractErrorMessage(oEvent) {
                    try {
                        var oResponse = oEvent.getParameter("response");
                        if (oResponse && oResponse.responseText) {
                            var oBody = JSON.parse(oResponse.responseText);
                            if (oBody.error && oBody.error.message && oBody.error.message.value) {
                                return oBody.error.message.value;
                            }
                        }
                    } catch (e) { }
                    return "An error occurred while saving. Please try again.";
                }

                function onRequestDone(oEvent) {
                    var sMethod = oEvent.getParameter("method");
                    if (sMethod !== "POST" && sMethod !== "PUT") return;

                    var bSuccess = oEvent.getParameter("success");
                    if (!bSuccess) {
                        bHasError = true;
                        sap.m.MessageBox.error(extractErrorMessage(oEvent));
                    }

                    iPendingOperations--;

                    if (iPendingOperations === 0) {
                        oModel.detachEvent("requestCompleted", onRequestDone);
                        oView.setBusy(false);
                        that.byId("regionTables").getBinding("rows").refresh();
                        if (!bHasError) {
                            sap.m.MessageToast.show("Saved successfully");
                        }
                    }
                }

                oModel.attachEvent("requestCompleted", onRequestDone);
                oModel.submitChanges();
            },





            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");
                if (oSheet) oSheet.openBy(oEvent.getSource());
            },

            onExcelDownloadAll: function () {

                const oTable = this.byId("regionTables");
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
                    { key: "Region", label: "Region" },
                    { key: "Ort01", label: "Description" },
                    { key: "Spras", label: "Language" },
                    { key: "BasisRto", label: "Basis for RTO" },
                    { key: "EngineType", label: "Engine Type" },
                    { key: "FromDate", label: "Effective Date" }
                ];

                this._exportToExcel(aData, aAllFields);
            },

            // ── _exportToExcel — columns in the order the user selected them ──────
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
                        ? "RegionMaster_Template.xlsx"
                        : "RegionMaster_Export.xlsx"
                };
                const oSheet = new sap.ui.export.Spreadsheet(oSettings);
                oSheet.build().finally(() => oSheet.destroy());
            },


            onExcelPress: function () {
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

                const oPopover = this.byId("excelPopover");
                if (oPopover) oPopover.close();
            },



            _handleExcelFile: function (oFile) {
                if (!oFile) return;

                const sExt = oFile.name.split(".").pop().toLowerCase();
                if (!["xlsx", "xls", "csv"].includes(sExt)) {
                    sap.m.MessageToast.show("Please upload a valid Excel or CSV file");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const oModel = this.getView().getModel();
                const oTable = this.byId("regionTables");
                const oBinding = oTable.getBinding("rows");

                const oReader = new FileReader();

                oReader.onload = (e) => {
                    try {
                        let aData = [];

                        // ================= CSV =================
                        if (sExt === "csv") {
                            const sText = e.target.result;
                            const aLines = sText.split(/\r?\n/).filter(l => l.trim());
                            if (!aLines.length) {
                                sap.m.MessageToast.show("File is empty");
                                return;
                            }

                            const aHeaders = aLines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
                            aData = aLines.slice(1).map(sLine => {
                                const aVals = sLine.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
                                const oRow = {};
                                aHeaders.forEach((h, i) => { oRow[h] = aVals[i] ?? ""; });
                                return oRow;
                            });

                        } else {
                            // ================= EXCEL =================
                            const XLSX = window.XLSX;
                            if (!XLSX) {
                                sap.m.MessageBox.error("XLSX library not available.");
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
                            sap.m.MessageToast.show("No data rows found in the file");
                            return;
                        }

                        const oMail = oVm.getProperty("/ASMEmail");
                        let iCreated = 0;

                        aData.forEach(oRow => {

                            // ===== EXISTING FIELDS =====
                            const sRegion = oRow["Region"] || oRow["REGION"] || "";
                            const sOrt01 = oRow["Description"] || oRow["DESCRIPTION"] || oRow["Ort01"] || "";
                            const sSpras = oRow["Language"] || oRow["LANGUAGE"] || oRow["Spras"] || "EN";
                            const sBasisRto = oRow["Basis for RTO"] || oRow["Basis for RTO"] || oRow["Basis"] || "";

                            // ===== NEW FIELD: EngineType =====
                            const sEngineType =
                                oRow["Engine Type"] ||
                                oRow["ENGINETYPE"] ||
                                oRow["EngineType"] ||
                                "EV";

                            // ===== NEW FIELD: FromDate =====
                            let oFromDate = new Date();

                            const sDateVal = oRow["Effective Date"] || oRow["FromDate"];

                            if (sDateVal) {
                                const date = new Date(sDateVal);

                                if (!isNaN(date)) {
                                    date.setHours(12, 0, 0, 0); // ✅ avoid timezone issue
                                    oFromDate = date;
                                } else {
                                    console.warn("Invalid date:", sDateVal);
                                    oFromDate = new Date();
                                }
                            }

                            // Skip invalid rows
                            if (!sRegion) return;

                            // ===== CREATE ENTRY =====
                            oBinding.create({
                                Region: sRegion,
                                EngineType: sEngineType,   // ✅ added
                                OperationNo: 0,
                                FromDate: oFromDate,     // ✅ added
                                Ort01: sOrt01,
                                Spras: sSpras,
                                Mail: oMail,
                                BasisRto: sBasisRto,
                                Status: "SUBMITTED",
                               
                            });

                            iCreated++;
                        });

                        sap.m.MessageToast.show(iCreated + " row(s) loaded from " + oFile.name);

                    } catch (ex) {
                        console.error("Excel parse error:", ex);
                        sap.m.MessageBox.error("Failed to parse the file: " + (ex.message || "Unknown error"));
                    }
                };

                if (sExt === "csv") {
                    oReader.readAsText(oFile);
                } else {
                    oReader.readAsArrayBuffer(oFile);
                }
            },
            onExcelDownload: function () {
                this.byId("fieldSelectDialog").open();
            },

            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },


            onDownloadSelectedFields: function () {

                var oTable = this.byId("regionTables");
                var oBinding = oTable.getBinding("rows");

                var aContexts = oBinding.getContexts();

                // ✅ Format data (add date formatting)
                var aData = aContexts.map(function (oContext) {

                    var o = Object.assign({}, oContext.getObject());

                    // 🔥 Format FromDate → dd/MM/yyyy
                    if (o.FromDate) {
                        var date = new Date(o.FromDate);

                        if (!isNaN(date)) {
                            o.FromDate =
                                String(date.getDate()).padStart(2, '0') + "/" +
                                String(date.getMonth() + 1).padStart(2, '0') + "/" +
                                date.getFullYear();
                        }
                    }

                    return o;
                });

                var oList = this.byId("fieldList");
                var aSelectedItems = oList.getSelectedItems();

                if (aSelectedItems.length === 0) {
                    sap.m.MessageToast.show("Select at least one field");
                    return;
                }

                var aColumns = [];

                // ✅ UPDATED propertyMap
                var propertyMap = {
                    "Region": "Region",
                    "Engine Type": "EngineType",     // ✅ NEW
                    "Description": "Ort01",
                    "Effective Date": "FromDate",    // ✅ NEW
                    "Language": "Spras",
                    "Basis for RTO": "BasisRto"
                };

                aSelectedItems.forEach(function (item) {

                    var sTitle = item.getTitle();

                    if (propertyMap[sTitle]) { // ✅ safety check
                        aColumns.push({
                            label: sTitle,
                            property: propertyMap[sTitle]
                        });
                    }

                });

                var oSettings = {
                    workbook: {
                        columns: aColumns
                    },
                    dataSource: aData,
                    fileName: "RegionMaster.xlsx"
                };

                var oSheet = new Spreadsheet(oSettings);

                oSheet.build().finally(function () {
                    oSheet.destroy();
                });

                this.byId("fieldSelectDialog").close();
            },
            onSort: function (oEvent) {
                var oColumn = oEvent.getParameter("column");
                var sSortOrder = oEvent.getParameter("sortOrder");
                var sProperty = oColumn.getSortProperty();
                var oTable = this.byId("regionTables");
                var bDescending = (sSortOrder === "Descending");
                var that = this;   // ✅ ADD THIS

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                // ✅ REPLACE the existing aData map with this:
                var aData = aContexts.map(function (ctx) {
                    var o = Object.assign({}, ctx.getObject());
                    if (that._allData && o._snapshotIndex === undefined) {
                        var oSnap = that._allData.find(function (s) {
                            return s.Region === o.Region;
                        });
                        if (oSnap) o._snapshotIndex = oSnap._snapshotIndex;
                    }
                    return o;
                });

                // rest of onSort stays exactly the same...
                aData.sort(function (a, b) {
                    var sA = String(a[sProperty] || "").toLowerCase();
                    var sB = String(b[sProperty] || "").toLowerCase();
                    return bDescending
                        ? (sA > sB ? -1 : sA < sB ? 1 : 0)
                        : (sA < sB ? -1 : sA > sB ? 1 : 0);
                });

                var oJSONModel = new sap.ui.model.json.JSONModel(aData);
                oTable.setModel(oJSONModel);
                oTable.bindRows("/");

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);

                this._isFiltered = true;
            },
            // onSort: function (oEvent) {

            //     var oColumn    = oEvent.getParameter("column");
            //     var sSortOrder = oEvent.getParameter("sortOrder");
            //     var sProperty  = oColumn.getSortProperty();
            //     var oTable     = this.byId("regionTables");

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
            // }


        });
    }
);

