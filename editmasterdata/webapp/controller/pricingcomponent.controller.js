sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.pricingcomponent", {

            // onInit: async function () {



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

            //     const oTable = this.byId("masterTable");

            //     oTable.bindRows({
            //         path: "/PricingComponentsSet",
            //         filters: [
            //             new sap.ui.model.Filter("Mail", "EQ", sASMMail)
            //         ],
            //         events: {

            //             dataReceived: function (oEvent) {

            //                 // ✅ Existing logic — unchanged
            //                 var oModel = this.getView().getModel();
            //                 var aData = oModel.getProperty("/PricingComponentsSet");

            //                 if (aData && Array.isArray(aData)) {
            //                     aData.forEach(function (item) {
            //                         // mark existing rows
            //                     });
            //                     oModel.refresh(true);
            //                 }

            //                 // ✅ Snapshot with _snapshotIndex
            //                 const oEventData = oEvent.getParameter("data");
            //                 const aRows = (oEventData && oEventData.results) ? oEventData.results : [];

            //                 if (!aRows.length) return;

            //                 this._allData = aRows.map(function (oRow, i) {
            //                     oRow._snapshotIndex = i;
            //                     return oRow;
            //                 });

            //                 this._buildFilterDropdowns(aRows);

            //             }.bind(this)
            //         }
            //     });

            // },


onInit: async function () {

    const oVM = new sap.ui.model.json.JSONModel({
        readOnly: false
    });
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
    
    // 1. Wait for the role check in Component.js
    const oComp = this.getOwnerComponent();
    await oComp.getRoleReady();

    const oUser = oComp.getModel("user");

    // Logged-in user's email — used for creating rows
    // (ASM email)
    const sASMMail = oUser.getProperty("/email");
    oVM.setProperty("/ASMEmail", sASMMail);

    // 2. Decide whose data to display based on role
    let aViewMails = [];

    if (oUser.getProperty("/isSubmitter")) {

        // Submitter sees only their own data
        aViewMails = [sASMMail];

    } else if (oUser.getProperty("/isApprover")) {

        // Approver sees the maintained submitters' data
        aViewMails =
            oUser.getProperty("/submitterEmails") || [];

        // Approver can view but cannot edit
        oVM.setProperty("/readOnly", true);
    }

    oVM.setProperty("/viewMails", aViewMails);

    // 3. Bind the table using the role-based mail filter
    const oTable = this.byId("masterTable");

    oTable.bindRows({
        path: "/PricingComponentsSet",
        filters: [this._getMailFilter()],
        events: {

            dataReceived: function (oEvent) {

                // Existing logic — unchanged
                var oModel = this.getView().getModel();
                var aData = oModel.getProperty(
                    "/PricingComponentsSet"
                );

                if (aData && Array.isArray(aData)) {
                    aData.forEach(function (item) {
                        // mark existing rows
                    });

                    oModel.refresh(true);
                }

                // Existing snapshot logic — unchanged
                const oEventData = oEvent.getParameter("data");
                const aRows =
                    (oEventData && oEventData.results)
                        ? oEventData.results
                        : [];

                if (!aRows.length) {
                    return;
                }

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

                let aFiltered = this._allData || [];

                if (aRegions.length) {
                    aFiltered = aFiltered.filter(o => aRegions.includes(o.Region));
                }

                this._isFiltered = true;

                const oTable = this.byId("masterTable");

                // ✅ Deep clone — prevents edits from mutating _allData
                oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
                oTable.bindRows("/");
            },
            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("masterTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/PricingComponentsSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            formatDate: function (vDate) {
                if (!vDate) return "";
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },
            formatDateText: function (vDate) {
                if (!vDate) {
                    return "";
                }

                var oDate;

                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    oDate = new Date(parseInt(vDate.match(/\d+/)[0], 10));
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
            _formatDateForExport: function (vDate) {
                if (!vDate) return "";
                // OData /Date(ms)/ format
                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var iMs = parseInt(vDate.replace("/Date(", "").replace(")/", ""), 10);
                    var oD = new Date(iMs);
                    // Return as UTC date to avoid timezone shifts
                    var y = oD.getUTCFullYear();
                    var m = String(oD.getUTCMonth() + 1).padStart(2, "0");
                    var d = String(oD.getUTCDate()).padStart(2, "0");
                    return y + "-" + m + "-" + d;
                }
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },

            // ================= CREATE =================

            onCreateMasterRow: function () {

                const oVm = this.getView().getModel('viewModel');
                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("masterTable");
                var oBinding = oTable.getBinding("rows");

                const oDate = new Date();
                oDate.setHours(12, 0, 0, 0);

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                oBinding.create({
                    OperationNo: 0,
                    Region: "",
                    EngineType: "EV",
                    Mail: oMail,
                   
                    FromDate: oDate,
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
                    Status: "SUBMITTED",
                  
                });
            },

            onNewRowSelect: function (oEvent) {

                const oCheckBox = oEvent.getSource();
                const oContext = oCheckBox.getBindingContext();

                if (!oContext || !oContext.isTransient()) {
                    return;
                }

                oContext.setProperty(
                    "_selectedForDelete",
                    oCheckBox.getSelected()
                );
            },

            onDeleteSelectedRows: function () {

                const oTable = this.byId("masterTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const aContexts = oBinding.getContexts(
                    0,
                    oBinding.getLength()
                );

                // Find ALL selected newly-created rows
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
                    aSelectedRows.length +
                    " row(s) removed successfully"
                );
            },


            onDateChange: function (oEvent) {
                const oPicker = oEvent.getSource();
                const sValue = oPicker.getValue(); // "2026-04-03"

                if (!sValue) return;

                const oContext = oPicker.getBindingContext();
                if (oContext) {
                    console.log("DateChange → path:", oContext.getPath(), "| new value:", sValue);
                    oContext.getModel().setProperty(
                        oContext.getPath() + "/FromDate",
                        sValue
                    );
                    // ✅ Verify it was stored
                    console.log("Stored FromDate:", oContext.getModel().getProperty(oContext.getPath() + "/FromDate"));
                }
            },

            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("masterTable");
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
            //     var oTable = this.byId("masterTable");
            //     var oView  = this.getView();
            //     var that   = this;

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     // ✅ Key field that triggers DELETE + CREATE when changed
            //     var aKeyFields = ["Region"];

            // function toODataDate(vDate) {
            //     if (!vDate) return vDate;
            //     if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

            //     var oDate;

            //     if (vDate instanceof Date) {
            //         oDate = vDate;
            //     } else if (typeof vDate === "string") {
            //         // Handle "YYYY-MM-DD" from DatePicker getValue()
            //         var aParts = vDate.substring(0, 10).split("-");
            //         // ✅ Use LOCAL date constructor — no UTC shift
            //         oDate = new Date(
            //             parseInt(aParts[0], 10),
            //             parseInt(aParts[1], 10) - 1,
            //             parseInt(aParts[2], 10)
            //         );
            //     } else {
            //         return vDate;
            //     }

            //     // ✅ Use LOCAL date parts to avoid IST shift
            //     var iMs = Date.UTC(
            //         oDate.getFullYear(),   // local year
            //         oDate.getMonth(),      // local month
            //         oDate.getDate()        // local date
            //     );

            //     return "/Date(" + iMs + ")/";
            // }

            //     // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/PricingComponentsSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/PricingComponentsSet", bIsFiltered);
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
            //                 that.byId("masterTable").getBinding("rows").refresh();
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

            //         var aIgnoreKeys  = ["__metadata", "Status","_snapshotIndex"];

            //         // ✅ Normalize any date value to "YYYY-MM-DD" string for comparison
            // function normDateStr(v) {
            //     if (!v) return "";
            //     // /Date(ms)/ format
            //     if (typeof v === "string" && v.indexOf("/Date(") === 0) {
            //         var ms = parseInt(v.match(/\d+/)[0], 10);
            //         return new Date(ms).toISOString().substring(0, 10);
            //     }
            //     // Date object
            //     if (v instanceof Date) {
            //         return v.toISOString().substring(0, 10);
            //     }
            //     // Already "YYYY-MM-DD" or similar string
            //     return String(v).substring(0, 10);
            // }
            //         var aChangedRows = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.Region === oFilteredRow.Region;
            //                 });
            //             }

            //             var bChanged = false;

            //             // if (oOriginalRow) {
            //             //     var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //             //         return aIgnoreKeys.indexOf(k) === -1;
            //             //     });
            //             //     bChanged = aKeys.some(function (k) {
            //             //         return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //             //     });
            //             // }

            //             if (oOriginalRow) {
            //     var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //         return aIgnoreKeys.indexOf(k) === -1;
            //     });
            //     bChanged = aKeys.some(function (k) {
            //         if (k === "FromDate") {
            //             // ✅ Normalize both sides to "YYYY-MM-DD" for comparison
            //             return normDateStr(oFilteredRow[k]) !== normDateStr(oOriginalRow[k]);
            //         }
            //         return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //     });
            // }

            //             console.log(
            //                 "Row → Region:", oFilteredRow.Region,
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
            //     var oRow         = oItem.oRow;
            //     var oOriginalRow = oItem.oOriginalRow;

            //     // ✅ Key always uses original /Date(...)/ string from _allData
            //     var sPath = oModel.createKey("/PricingComponentsSet", {
            //         FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //         Region:   oOriginalRow ? oOriginalRow.Region   : oRow.Region
            //     });

            //     var oData = Object.assign({}, oRow);
            //     delete oData.__metadata;
            //     delete oData._snapshotIndex;
            //     oData.Status = "SUBMITTED";


            //     oData.FromDate = toODataDate(oRow.FromDate);

            //     console.log("PUT path:", sPath);
            //     console.log("PUT body FromDate:", oData.FromDate, "| original was:", oOriginalRow ? oOriginalRow.FromDate : "n/a");

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

            //         // ── DELETE + CREATE rows (Region key changed) ─────────────────────────
            //         aDeleteCreate.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sDeletePath = oModel.createKey("/PricingComponentsSet", {
            //                 FromDate: oOriginalRow.FromDate,
            //                 Region:   oOriginalRow.Region
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             oCreateData.Status   = "SUBMITTED";
            //             // ✅ toODataDate applied to FromDate in CREATE payload
            //             oCreateData.FromDate = toODataDate(oOriginalRow.FromDate);

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
            //     var aContexts = oTable.getBinding("rows").getContexts();

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
            //             var sSnapPath = oModel.createKey("/PricingComponentsSet", {
            //                 FromDate: oSnapRow.FromDate,
            //                 Region:   oSnapRow.Region
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
            //             oCreatePayload.Status   = "SUBMITTED";
            //             // ✅ toODataDate applied to FromDate in transient CREATE
            //             oCreatePayload.FromDate = toODataDate(oData.FromDate);

            //             console.log("CREATE (transient) payload:", oCreatePayload);

            //             iPendingOperations++;
            //             bHasChanges = true;

            //             oContext.delete();

            //             oModel.create("/PricingComponentsSet", oCreatePayload, {
            //                 success: function () {
            //                     console.log("CREATE success (transient)");
            //                     onOperationDone(false);
            //                 },
            //                 error: function (oError) {
            //                     handleError(oError, "/PricingComponentsSet", false);
            //                 }
            //             });

            //             return;
            //         }

            //         if (mPending[sKey]) {

            //             var oPending = mPending[sKey];

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
            //                 // ✅ toODataDate applied to FromDate in DELETE+CREATE payload
            //                 oCreateData.FromDate = toODataDate(oSnapRow.FromDate);

            //                 var sDeletePath = oModel.createKey("/PricingComponentsSet", {
            //                     FromDate: oSnapRow.FromDate,
            //                     Region:   oSnapRow.Region
            //                 });

            //                 oModel.resetChanges([sPath]);

            //                 console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //                 console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //                 iPendingOperations += 2;
            //                 bHasChanges = true;

            //                 doDeleteCreate(sDeletePath, oCreateData, false);

            //                 return;
            //             }

            //             // ── Normal UPDATE → PUT (no key change) ───────────────────────────
            //             var oPutData = Object.assign({}, oData);
            //             delete oPutData.__metadata;
            //             delete oPutData._snapshotIndex;
            //             oPutData.Status   = "SUBMITTED";
            //             // ✅ toODataDate applied to FromDate in normal PUT
            //             oPutData.FromDate = toODataDate(oData.FromDate);

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

            //     if (!bHasChanges) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ✅ setBusy AFTER forEach
            //     oView.setBusy(true);
            // },


            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("masterTable");
                var oView = this.getView();
                var that = this;

                var bHasError = false;
                var iPendingOperations = 0;

                var aKeyFields = ["Region"];

                function toODataDate(vDate) {
                    if (!vDate) return vDate;
                    if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return vDate;

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

                    var iMs = Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
                    return "/Date(" + iMs + ")/";
                }

                function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
                    console.log("DELETE path:", sDeletePath);
                    console.log("CREATE payload:", oCreateData);

                    oModel.remove(sDeletePath, {
                        success: function () {
                            console.log("DELETE success:", sDeletePath);
                            onOperationDone(bIsFiltered);

                            oModel.create("/PricingComponentsSet", oCreateData, {
                                success: function () {
                                    console.log("CREATE success after DELETE");
                                    onOperationDone(bIsFiltered);
                                },
                                error: function (oError) {
                                    handleError(oError, "/PricingComponentsSet", bIsFiltered);
                                }
                            });
                        },
                        error: function (oError) {
                            handleError(oError, sDeletePath, bIsFiltered);
                            onOperationDone(bIsFiltered);
                        }
                    });
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
                            that.byId("masterTable").getBinding("rows").refresh();
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

                // ─── FILTERED FLOW — completely unchanged ─────────────────────────────────
                if (this._isFiltered) {

                    var oTableModel = oTable.getModel();
                    var aFilteredData = oTableModel.getProperty("/") || [];
                    var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

                    var aIgnoreKeys = ["__metadata", "Status", "_snapshotIndex"];

                    function normDateStr(v) {
                        if (!v) return "";
                        if (typeof v === "string" && v.indexOf("/Date(") === 0) {
                            var ms = parseInt(v.match(/\d+/)[0], 10);
                            return new Date(ms).toISOString().substring(0, 10);
                        }
                        if (v instanceof Date) return v.toISOString().substring(0, 10);
                        return String(v).substring(0, 10);
                    }

                    var aChangedRows = [];

                    aFilteredData.forEach(function (oFilteredRow) {

                        var oOriginalRow = aOriginalSnapshot.find(function (o) {
                            return o._snapshotIndex === oFilteredRow._snapshotIndex;
                        });

                        if (!oOriginalRow) {
                            oOriginalRow = aOriginalSnapshot.find(function (o) {
                                return o.Region === oFilteredRow.Region;
                            });
                        }

                        var bChanged = false;

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
                            "Row → Region:", oFilteredRow.Region,
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

                    aPutRows.forEach(function (oItem) {
                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        var sPath = oModel.createKey("/PricingComponentsSet", {
                            FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
                            Region: oOriginalRow ? oOriginalRow.Region : oRow.Region
                        });

                        var oData = Object.assign({}, oRow);
                        delete oData.__metadata;
                        delete oData._snapshotIndex;
                        oData.Status = "SUBMITTED";
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

                    aDeleteCreate.forEach(function (oItem) {
                        var oRow = oItem.oRow;
                        var oOriginalRow = oItem.oOriginalRow;

                        var sDeletePath = oModel.createKey("/PricingComponentsSet", {
                            FromDate: oOriginalRow.FromDate,
                            Region: oOriginalRow.Region
                        });

                        var oCreateData = Object.assign({}, oRow);
                        delete oCreateData.__metadata;
                        delete oCreateData._snapshotIndex;
                        oCreateData.Status = "SUBMITTED";
                        oCreateData.FromDate = toODataDate(oOriginalRow.FromDate);

                        doDeleteCreate(sDeletePath, oCreateData, true);
                    });

                    return;
                }

                // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                var mPending = oModel.getPendingChanges();
                var bHasChanges = false;

                var mSnapshotByPath = {};
                if (that._allData) {
                    that._allData.forEach(function (oSnapRow) {
                        var sSnapPath = oModel.createKey("/PricingComponentsSet", {
                            FromDate: oSnapRow.FromDate,
                            Region: oSnapRow.Region
                        });
                        mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
                    });
                }

                // ✅ CHANGED: collect transient rows for chunked batch submit
                var aTransientPayloads = [];

                aContexts.forEach(function (oContext) {

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
                    var oData = oContext.getObject();

                    // ── CREATE → collect into aTransientPayloads ──────────────────────────
                    if (oContext.isTransient()) {

                        var oCreatePayload = Object.assign({}, oData);
                        delete oCreatePayload.__metadata;
                        delete oCreatePayload._snapshotIndex;
                        oCreatePayload.Status = "SUBMITTED";
                        oCreatePayload.FromDate = toODataDate(oCreatePayload.FromDate);

                        console.log("Transient payload collected:", oCreatePayload);

                        aTransientPayloads.push(oCreatePayload);

                        // ✅ Remove transient context so oModel doesn't submit it again
                        oContext.delete();
                        return;
                    }

                    // ── PUT / DELETE+CREATE — completely unchanged ────────────────────────
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
                            oCreateData.FromDate = toODataDate(oSnapRow.FromDate);

                            var sDeletePath = oModel.createKey("/PricingComponentsSet", {
                                FromDate: oSnapRow.FromDate,
                                Region: oSnapRow.Region
                            });

                            oModel.resetChanges([sPath]);

                            console.log("DELETE+CREATE → DELETE path:", sDeletePath);
                            console.log("DELETE+CREATE → CREATE payload:", oCreateData);

                            iPendingOperations += 2;
                            bHasChanges = true;

                            doDeleteCreate(sDeletePath, oCreateData, false);
                            return;
                        }

                        // ── Normal PUT ────────────────────────────────────────────────────
                        var oPutData = Object.assign({}, oData);
                        delete oPutData.__metadata;
                        delete oPutData._snapshotIndex;
                        oPutData.Status = "SUBMITTED";
                        oPutData.FromDate = toODataDate(oData.FromDate);

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

                // ✅ CHANGED: submit all transient rows via ONE chunked batch call
                if (aTransientPayloads.length > 0) {
                    bHasChanges = true;
                    that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 500);
                }

                if (!bHasChanges) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // ✅ setBusy only for PUT/DELETE+CREATE
                // _submitInChunks manages its own busy state
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
                        oView.setBusy(false);
                        sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully.");

                        // ✅ Rebind to OData so saved rows load fresh from backend
                        var oTable = that.byId("masterTable");
                        var oVm = that.getView().getModel("viewModel");
                        var sMail = oVm.getProperty("/ASMEmail");

                        oTable.setModel(that.getView().getModel());
                        oTable.bindRows({
                            path: "/PricingComponentsSet",
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
                        oModel.create("/PricingComponentsSet", oCreateData, {
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

            onCalcChange: function (oEvent) {

                var oSource = oEvent.getSource();
                var oContext = oSource.getBindingContext();
                var oModel = oContext.getModel();

                var sPath = oSource.getBindingInfo("value").binding.getPath();
                var value = Number(oEvent.getParameter("value")) || 0;

                oModel.setProperty(oContext.getPath() + "/" + sPath, String(value));

                this.recalculateRow(oContext);
            },

            recalculateRow: function (oContext) {
                var oModel = oContext.getModel();
                var sRowPath = oContext.getPath();
                var oData = oModel.getProperty(sRowPath);

                var rtoExpense = Number(oData.RtoExpense) || 0;
                var hspr = Number(oData.HsprRate) || 0;
                var plate = Number(oData.NoPlateWrit) || 0;
                var petrolLt500 = Number(oData.PetrolUpto500) || 0;
                var petrolGt500 = Number(oData.PetrolGt500) || 0;
                var buffPdi = Number(oData.BuffPdi) || 0;

                // OtExpLt500 = below 500cc petrol variant
                var less500 = hspr + plate + petrolLt500 + rtoExpense + buffPdi;

                // OtExpGt500 = above 500cc petrol variant
                var greater500 = hspr + plate + petrolGt500 + rtoExpense + buffPdi;

                oModel.setProperty(sRowPath + "/OtExpLt500", String(less500.toFixed(3)));
                oModel.setProperty(sRowPath + "/OtExpGt500", String(greater500.toFixed(3)));
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


            // _insertIntoTable: function (aExcelData) {
            //     const oTable   = this.byId("masterTable");
            //     const oBinding = oTable.getBinding("rows");
            //     if (!oBinding) {
            //         sap.m.MessageToast.show("Table not ready");
            //         return;
            //     }
            //     const oVm   = this.getView().getModel("viewModel");
            //     const sMail = oVm.getProperty("/ASMEmail");

            //     // ✅ Clear filter first so oBinding points to OData binding
            //     if (this._isFiltered) {
            //         this.onClearFilter();
            //     }

            //     // ✅ Clear any existing draft/transient rows before inserting new ones
            //     this._clearDraftRows();

            //     var iCreated = 0;

            //     aExcelData.forEach(function (oRow) {

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

            //         // Guard: fallback to today if date is invalid
            //         if (isNaN(oFromDate.getTime())) {
            //             console.warn("Invalid date, defaulting to today:", oRow["Effective Date"]);
            //             oFromDate = new Date();
            //         }

            //         // ✅ Pin to UTC midnight
            //         oFromDate = new Date(Date.UTC(
            //             oFromDate.getUTCFullYear(),
            //             oFromDate.getUTCMonth(),
            //             oFromDate.getUTCDate()
            //         ));

            //         // ✅ Create transient row directly on OData binding
            //         oBinding.create({
            //             Region:         String(oRow["Region"]                         || ""),
            //             EngineType:     String(oRow["Engine Type"]                    || "EV"),
            //             Mail:           sMail,
            //             FromDate:       oFromDate,
            //             Helmet:         String(oRow["Helmet Cost"]                    || "0.000"),
            //             Transportation: String(oRow["Transportation"]                 || "0.000"),
            //             OtExpGt500:     String(oRow["Other Expenses (+500)"]          || "0.000"),
            //             OtExpLt500:     String(oRow["Other Expenses (-500)"]          || "0.000"),
            //             HelmetMargin:   String(oRow["Helmet Margin"]                  || "0.000"),
            //             InsuranceLe350: String(oRow["Insuranse% Below 350cc"]         || "0.000000"),
            //             InsuranceGt350: String(oRow["Insurance% Above 350cc"]         || "0.000000"),
            //             TpaPaGt350:     String(oRow["TPA-PA Above 350CC"]             || "0.000"),
            //             TpaPaLe350:     String(oRow["TPA-PA Below 350CC"]             || "0.000"),
            //             BuffPdi:        String(oRow["Cleaning and Polishing PDI"]     || "0.000"),
            //             HsprRate:       String(oRow["HSPR Rate"]                      || "0.000"),
            //             NoPlateWrit:    String(oRow["Number Plate Writing"]           || "0.000"),
            //             PetrolUpto500:  String(oRow["Petrol charge Below 500cc"]      || "0.000"),
            //             PetrolGt500:    String(oRow["Petrol charge above 500cc"]      || "0.000"),
            //             RtoExpense:     String(oRow["RTO Expence"]                    || "0.000"),
            //             Status:         "SUBMITTED"
            //         });

            //         iCreated++;

            //     }.bind(this));

            //     // ✅ No pending payloads needed — transient rows handle everything
            //     this._pendingExcelPayloads = null;

            //     sap.m.MessageToast.show(iCreated + " rows loaded. Click Submit to save.");
            // },


            _insertIntoTable: function (aExcelData) {
                const oTable = this.byId("masterTable");
                const oBinding = oTable.getBinding("rows");
                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }
                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                if (this._isFiltered) {
                    this.onClearFilter();
                }

                this._clearDraftRows();

                var iCreated = 0;
                var that = this;

                aExcelData.forEach(function (oRow) {

                    var oFromDate;
                    if (oRow["Effective Date"]) {
                        if (typeof oRow["Effective Date"] === "number") {
                            var excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
                        } else {
                            var sParsed = String(oRow["Effective Date"]).trim();
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

                    if (isNaN(oFromDate.getTime())) {
                        console.warn("Invalid date, defaulting to today:", oRow["Effective Date"]);
                        oFromDate = new Date();
                    }

                    oFromDate = new Date(Date.UTC(
                        oFromDate.getUTCFullYear(),
                        oFromDate.getUTCMonth(),
                        oFromDate.getUTCDate()
                    ));

                    // ✅ Calculate OtExpLt500 and OtExpGt500 directly from Excel values
                    //    so the fields are correct before the row even hits the table
                    var rtoExpense = Number(oRow["RTO Expence"] || 0);
                    var hspr = Number(oRow["HSPR Rate"] || 0);
                    var plate = Number(oRow["Number Plate Writing"] || 0);
                    var petrolLt500 = Number(oRow["Petrol charge Below 500cc"] || 0);
                    var petrolGt500 = Number(oRow["Petrol charge above 500cc"] || 0);
                    var buffPdi = Number(oRow["Cleaning and Polishing PDI"] || 0);

                    var less500 = hspr + plate + petrolLt500 + rtoExpense + buffPdi;
                    var greater500 = hspr + plate + petrolGt500 + rtoExpense + buffPdi;

                    oBinding.create({
                        Region: String(oRow["Region"] || ""),
                        EngineType: String(oRow["Engine Type"] || "EV"),
                        Mail: sMail,
                        FromDate: oFromDate,
                       // Helmet: String(oRow["Helmet Cost"] || "0.000"),
                        Transportation: String(oRow["Transportation"] || "0.000"),

                        // ✅ Use calculated values — not Excel's raw OtExp columns
                        OtExpGt500: String(greater500.toFixed(3)),
                        OtExpLt500: String(less500.toFixed(3)),

                       // HelmetMargin: String(oRow["Helmet Margin"] || "0.000"),
                        InsuranceLe350: String(oRow["Insuranse% Below 350cc"] || "0.000000"),
                        InsuranceGt350: String(oRow["Insurance% Above 350cc"] || "0.000000"),
                        TpaPaGt350: String(oRow["TPA-PA Above 350CC"] || "0.000"),
                        TpaPaLe350: String(oRow["TPA-PA Below 350CC"] || "0.000"),
                        BuffPdi: String(oRow["Cleaning and Polishing PDI"] || "0.000"),
                        HsprRate: String(oRow["HSPR Rate"] || "0.000"),
                        NoPlateWrit: String(oRow["Number Plate Writing"] || "0.000"),
                        PetrolUpto500: String(oRow["Petrol charge Below 500cc"] || "0.000"),
                        PetrolGt500: String(oRow["Petrol charge above 500cc"] || "0.000"),
                        RtoExpense: String(oRow["RTO Expence"] || "0.000"),
                        Status: "SUBMITTED"
                    });

                    iCreated++;

                }.bind(this));

                // ✅ After all rows created — recalculate via binding contexts
                //    This handles cases where OtExp columns exist in Excel but need re-validation
                setTimeout(function () {
                    var aContexts = oBinding.getContexts(0, oBinding.getLength());
                    aContexts.forEach(function (oContext) {
                        if (oContext && oContext.isTransient()) {
                            that.recalculateRow(oContext);
                        }
                    });
                    console.log("Recalculation done for", iCreated, "uploaded rows");
                }, 100);

                this._pendingExcelPayloads = null;

                sap.m.MessageToast.show(iCreated + " rows loaded. Click Submit to save.");
            },

            _getAllFields: function () {
                return [
                    { key: "Region", label: "Region" },
                    { key: "EngineType", label: "Engine Type" },
                  //  { key: "Helmet", label: "Helmet Cost" },
                    { key: "FromDate", label: "Effective Date" },
                    { key: "Transportation", label: "Transportation" },
                    { key: "OtExpGt500", label: "Other Expenses (+500)" },
                    { key: "OtExpLt500", label: "Other Expenses (-500)" },
                   // { key: "HelmetMargin", label: "Helmet Margin" },
                    { key: "InsuranceLe350", label: "Insuranse% Below 350cc" },
                    { key: "InsuranceGt350", label: "Insurance% Above 350cc" },
                    { key: "TpaPaGt350", label: "TPA-PA Above 350CC" },
                    { key: "TpaPaLe350", label: "TPA-PA Below 350CC" },
                    { key: "BuffPdi", label: "Cleaning and Polishing PDI" },
                    { key: "HsprRate", label: "HSPR Rate" },
                    { key: "NoPlateWrit", label: "Number Plate Writing" },
                    { key: "PetrolUpto500", label: "Petrol charge Below 500cc" },
                    { key: "PetrolGt500", label: "Petrol charge above 500cc" },
                    { key: "RtoExpense", label: "RTO Expence" },
                    { key: "Status", label: "Status" }
                ];
            },

            onDownloadAll: function () {

                const oTable = this.byId("masterTable"); // ✅ correct table
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

            _formatDateForExport: function (vDate) {
                if (!vDate) return "";
                // OData /Date(ms)/ format
                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var iMs = parseInt(vDate.replace("/Date(", "").replace(")/", ""), 10);
                    var oD = new Date(iMs);
                    // Return as UTC date to avoid timezone shifts
                    var y = oD.getUTCFullYear();
                    var m = String(oD.getUTCMonth() + 1).padStart(2, "0");
                    var d = String(oD.getUTCDate()).padStart(2, "0");
                    return y + "-" + m + "-" + d;
                }
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },

            _exportToExcel: function (aData, aFields) {

                const EdmType = sap.ui.require("sap/ui/export/library").EdmType;

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
                    dataSource: aProcessedData,   // ✅ use processed data, not raw aData
                    fileName: "PricingComponent_Export.xlsx"
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

                const oTable = this.byId("masterTable");
                const oBinding = oTable.getBinding("rows");

                const iLength = oBinding.getLength();
                const aData = oBinding.getContexts(0, iLength).map(c => c.getObject());

                this._exportToExcel(aData, aSelectedFields);

                this.byId("fieldSelectDialog").close();
            },

            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },



            onSort: function (oEvent) {
                var that = this;
                var oColumn = oEvent.getParameter("column");
                var sSortOrder = oEvent.getParameter("sortOrder");
                var sProperty = oColumn.getSortProperty();
                var oTable = this.byId("masterTable");
                var bDescending = (sSortOrder === "Descending");

                var oBinding = oTable.getBinding("rows");
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                // ✅ Take raw context objects and restore original /Date(...)/ string
                //    from _allData so createKey works correctly in onSubmit
                var aData = aContexts.map(function (ctx) {
                    var o = Object.assign({}, ctx.getObject());

                    if (that._allData && o._snapshotIndex === undefined) {
                        var oSnap = that._allData.find(function (s) {
                            return s.Region === o.Region;
                        });
                        if (oSnap) {
                            o._snapshotIndex = oSnap._snapshotIndex;
                            o.FromDate = oSnap.FromDate; // ✅ restore raw /Date(...)/ string
                        }
                    } else if (that._allData && o._snapshotIndex !== undefined) {
                        // already has index — still restore FromDate from snapshot
                        var oSnap2 = that._allData.find(function (s) {
                            return s._snapshotIndex === o._snapshotIndex;
                        });
                        if (oSnap2) {
                            o.FromDate = oSnap2.FromDate; // ✅ restore raw /Date(...)/ string
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

                // ✅ Convert /Date(...)/ → Date object ONLY for DatePicker display
                //    after the /Date(...)/ string is already saved on the row for createKey
                aData.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                var oJSONModel = new sap.ui.model.json.JSONModel(aData);
                oTable.setModel(oJSONModel);
                oTable.bindRows("/");

                // ✅ Critical — routes onSubmit through the filtered/JSONModel path
                this._isFiltered = true;

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },

        });
    });