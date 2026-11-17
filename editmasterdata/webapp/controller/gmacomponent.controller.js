sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/routing/History",
        "sap/ui/export/Spreadsheet"
    ],
    function (BaseController, History, Spreadsheet) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.gmacomponent", {
            // onInit: async function () {

            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

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


            //     const oTable = this.byId("gmaComponentTable");


            //     oTable.bindRows({
            //         path: "/GMAComponentsSet",
            //         filters: [
            //             new sap.ui.model.Filter({
            //                 path: "Mail",
            //                 operator: sap.ui.model.FilterOperator.EQ,
            //                 value1: sASMMail
            //             })
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

                const oTable = this.byId("gmaComponentTable");

                oTable.bindRows({
                    path: "/GMAComponentsSet",
                    filters: [this._getMailFilter()],
                    events: {
                        dataReceived: function (oEvent) {

                            // ✅ Existing logic — unchanged
                            var oModel = this.getView().getModel();
                            var aData = oModel.getProperty("/GMAComponentsSet");

                            if (aData && Array.isArray(aData)) {
                                aData.forEach(function (item) {
                                    // mark existing rows
                                });

                                oModel.refresh(true);
                            }

                            // ✅ New — build filter dropdowns from received data
                            const oEventData = oEvent.getParameter("data");
                            const aRows = (oEventData && oEventData.results) ? oEventData.results : [];

                            if (!aRows.length) return;

                            // ✅ Assign _snapshotIndex to each row — needed for filtered DELETE+CREATE
                            this._allData = aRows.map(function (oRow, i) {
                                oRow._snapshotIndex = i;
                                return oRow;
                            });

                            this._buildFilterDropdowns(aRows);

                        }.bind(this)
                    }
                });

                //Deleted all data 



                //this._bCreateInProgress = false;

                // this._getPartCode(sASMMail)
                const aMails = oVM.getProperty("/viewMails") || [];
                this._getPartCode(aMails);

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
                    if (oRow.Models && !seenModel[oRow.Models]) {
                        seenModel[oRow.Models] = true;
                        aModels.push({ Models: oRow.Models });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ Models: aModels }),
                    "filter"
                );
            },

            onDateChange: function (oEvent) {
                const oDatePicker = oEvent.getSource();
                const oCtx = oDatePicker.getBindingContext();
                if (!oCtx) return;

                const oDate = oDatePicker.getDateValue(); // JS Date object — local time
                if (!oDate) return;

                // ✅ Use LOCAL date parts → Date.UTC to avoid IST shift
                const iMs = Date.UTC(
                    oDate.getFullYear(),   // local year
                    oDate.getMonth(),      // local month
                    oDate.getDate()        // local date
                );
                const sODataDate = "/Date(" + iMs + ")/";

                console.log("DateChange → storing:", sODataDate);
                oCtx.getModel().setProperty(oCtx.getPath() + "/FromDate", sODataDate);
            },




            onApplyFilter: function () {
                const aModels = this.byId("filterModelCode").getSelectedKeys();

                let aFiltered = this._allData ? this._allData.slice() : [];

                if (aModels.length) {
                    aFiltered = aFiltered.filter(o => aModels.includes(o.Models));
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

                const oTable = this.byId("gmaComponentTable");
                const oJSONModel = new sap.ui.model.json.JSONModel({ rows: aCloned });
                oTable.setModel(oJSONModel);
                oTable.bindRows("/rows");
            },

            onClearFilter: function () {
                this.byId("filterModelCode").removeAllSelectedItems();
                this._isFiltered = false;
                const oTable = this.byId("gmaComponentTable");
                oTable.setModel(this.getView().getModel()); // restore OData model
                oTable.bindRows({
                    path: "/GMAComponentsSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail",
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: this.getView().getModel("viewModel").getProperty("/ASMEmail")
                        })
                    ]
                });
            },

            _getPartCode: function (sASMMail) {

                console.log("inside partset", sASMMail);

                const oModel = this.getOwnerComponent().getModel();
                const oVM = this.getView().getModel("viewModel");

                if (!oModel) {
                    console.error("OData V2 model not found");
                    return;
                }

                oModel.read("/PartsSet", {
                    filters: [
                        new sap.ui.model.Filter(
                            "Mail",
                            sap.ui.model.FilterOperator.EQ,
                            sASMMail
                        )
                    ],
                    success: function (oData) {
                        console.log("PartsSet response:", oData.results);
                        oVM.setProperty("/PartsSet", oData.results);
                    },
                    error: function (oError) {
                        console.error("PartsSet failed", oError);
                        sap.m.MessageBox.error("Failed to load Parts");
                    }
                });
            },

            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("gmaComponentTable");
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

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("gmaComponentTable");
                var oBinding = oTable.getBinding("rows");

                oBinding.create({
                    OperationNo: 0,
                    FromDate: new Date(),
                    Models: "",
                    Description: "",
                    Mail: oMail,
                    MtsMto: "MTS",
                    ReferMtsModel: "",
                    Part1: "",
                    Part1Price: "0.000",
                    Part2: "",
                    Part2Price: "0.000",
                    Part3: "",
                    Part3Price: "0.000",
                    Part4: "",
                    Part4Price: "0.000",

                    Part5: "",
                    Part5Price: "0.000",

                    Part6: "",
                    Part6Price: "0.000",

                    Part7: "",
                    Part7Price: "0.000",

                    Part8: "",
                    Part8Price: "0.000",

                    Part9: "",
                    Part9Price: "0.000",

                    Part10: "",
                    Part10Price: "0.000",

                    Part11: "",
                    Part11Price: "0.000",

                    Part12: "",
                    Part12Price: "0.000",

                    Part13: "",
                    Part13Price: "0.000",

                    Part14: "",
                    Part14Price: "0.000",

                    Part15: "",
                    Part15Price: "0.000",

                    Part16: "",
                    Part16Price: "0.000",

                    Part17: "",
                    Part17Price: "0.000",

                    Part18: "",
                    Part18Price: "0.000",

                    Part19: "",
                    Part19Price: "0.000",

                    Part20: "",
                    Part20Price: "0.000",
                    Status: "SUBMITTED",

                });
            },

            formatDate: function (vDate) {
                if (!vDate) {
                    return "";
                }

                var oDate;

                // OData V2: /Date(1779830400000)/
                if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                    var match = vDate.match(/\/Date\((-?\d+)/);

                    if (match) {
                        oDate = new Date(parseInt(match[1], 10));
                    }
                }
                // JS Date
                else if (vDate instanceof Date) {
                    oDate = vDate;
                }
                // String date
                else {
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

                return oDate.getUTCDate() + " " +
                    aMonths[oDate.getUTCMonth()] + " " +
                    oDate.getUTCFullYear();
            },

            onPartChange: function (oEvent) {

                const oComboBox = oEvent.getSource();
                const sPartCode = oComboBox.getSelectedKey();

                if (!sPartCode) return;

                const oRowCtx = oComboBox.getBindingContext();
                if (!oRowCtx) return;

                const iPartNo = oComboBox.data("part");
                if (!iPartNo) {
                    console.error("data-part missing on ComboBox");
                    return;
                }

                const oVM = this.getView().getModel("viewModel");
                const aParts = oVM.getProperty("/PartsSet") || [];

                const oPart = aParts.find(p => p.PartCode === sPartCode);
                if (!oPart) {
                    console.warn("Selected PartCode not found in PartsSet:", sPartCode);
                    return;
                }

                // ✅ ONLY MiyCost
                const fMiyCost = Number(oPart.MiyCost || 0);

                const oModel = oRowCtx.getModel();
                const sPath = oRowCtx.getPath();

                const sPriceField = "Part" + iPartNo + "Price";

                oModel.setProperty(sPath + "/" + sPriceField, fMiyCost);
            },


            // onSubmit: function () {

            //     const oModel = this.getView().getModel();
            //     const oTable = this.byId("gmaComponentTable");
            //     const oView  = this.getView();
            //     const that   = this;

            //     const oVm   = this.getView().getModel("viewModel");
            //     const oMail = oVm.getProperty("/ASMEmail");

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     var aKeyFields = ["Models"];

            //     function toODataDate(vDate) {
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

            //     // ─── HELPER: Normalize date values for comparison ─────────────────────────
            // function normalizeDateVal(v) {
            //     if (!v) return "";

            //     // OData /Date(ms)/ or /Date(ms+0000)/ format
            //     if (typeof v === "string" && v.includes("/Date(")) {
            //         var match = v.match(/\/Date\((-?\d+)/);  // ✅ only capture digits before + or )
            //         return match ? parseInt(match[1], 10) : "";
            //     }

            //     // JS Date object
            //     if (v instanceof Date) {
            //         return isNaN(v) ? "" : v.getTime();
            //     }

            //     // ISO string or "YYYY-MM-DD"
            //     var d = new Date(v);
            //     return isNaN(d) ? String(v) : d.getTime();
            // }

            //     // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/GMAComponentsSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/GMAComponentsSet", bIsFiltered);
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
            //                 oTable.getBinding("rows").refresh();
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
            //         // var aFilteredData     = oTableModel.getProperty("/") || [];
            //         var aFilteredData = oTable.getModel().getProperty("/rows") || [];

            //         var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

            //        var aIgnoreKeys  = ["__metadata", "Status", "_snapshotIndex"];
            //         var aChangedRows = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             // ✅ Find original by _snapshotIndex (stable even if Models key changed)
            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             // ✅ Fallback: match by Models if _snapshotIndex missing
            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.Models === oFilteredRow.Models;
            //                 });
            //             }

            //             var bChanged = false;

            //             if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1 && !k.includes("Price");
            //                 });

            //                 bChanged = aKeys.some(function (k) {

            //     if (k === "FromDate") {
            //         return normalizeDateVal(oFilteredRow[k]) !== normalizeDateVal(oOriginalRow[k]);
            //     }

            //     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            // });
            //             }

            //             console.log(
            //                 "Row → Models:", oFilteredRow.Models,
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

            //         // ✅ Split into DELETE+CREATE (key changed) vs normal PUT
            //         var aDeleteCreate = [];
            //         var aPutRows      = [];

            //         aChangedRows.forEach(function (oItem) {

            //             var bKeyChanged = oItem.oOriginalRow && aKeyFields.some(function (k) {
            //                 var vNew = (k === "FromDate")
            //                     ? normalizeDateVal(oItem.oRow[k])
            //                     : String(oItem.oRow[k]);
            //                 var vOld = (k === "FromDate")
            //                     ? normalizeDateVal(oItem.oOriginalRow[k])
            //                     : String(oItem.oOriginalRow[k]);
            //                 return vNew !== vOld;
            //             });

            //             if (bKeyChanged) {
            //                 aDeleteCreate.push(oItem);
            //             } else {
            //                 aPutRows.push(oItem);
            //             }
            //         });

            //         // Each DELETE+CREATE counts as 2 operations
            //         iPendingOperations = aPutRows.length + (aDeleteCreate.length * 2);

            //         oView.setBusy(true);


            //         aPutRows.forEach(function (oItem) {
            //     var oRow         = oItem.oRow;
            //     var oOriginalRow = oItem.oOriginalRow;

            //     // ✅ Key: raw /Date(...)/ string from _allData (restored in onSort/onApplyFilter)
            //     var sPath = oModel.createKey("/GMAComponentsSet", {
            //         FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //         Models:   oOriginalRow ? oOriginalRow.Models   : oRow.Models
            //     });

            //     var oPayload = Object.assign({}, oRow);
            //     delete oPayload.__metadata;
            //     delete oPayload._snapshotIndex;
            //     Object.keys(oPayload).forEach(function (key) {
            //         if (key.includes("Price")) delete oPayload[key];
            //     });

            //     oPayload.Status = "SUBMITTED";
            //     oPayload.Mail   = oMail;

            //     // ✅ Body: use oRow.FromDate (user's actual value), not oOriginalRow.FromDate
            //     oPayload.FromDate = toODataDate(oRow.FromDate);

            //     console.log("PUT path:", sPath, "| Body FromDate:", oPayload.FromDate);

            //     oModel.update(sPath, oPayload, {
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

            //         // ── DELETE + CREATE rows (key changed) ────────────────────────────────
            //         aDeleteCreate.forEach(function (oItem) {

            //             var oRow         = oItem.oRow;
            //             var oOriginalRow = oItem.oOriginalRow;

            //             var sDeletePath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oOriginalRow.FromDate,
            //                 Models:   oOriginalRow.Models
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;

            //             Object.keys(oCreateData).forEach(function (key) {
            //                 if (key.includes("Price")) delete oCreateData[key];
            //             });

            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.Mail     = oMail;
            //             oCreateData.FromDate = oOriginalRow.FromDate;

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
            //     sap.ui.getCore().applyChanges();

            //    const oRowBinding = oTable.getBinding("rows");
            // const aContexts   = oRowBinding.getContexts(0, oRowBinding.getLength());

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ✅ Build snapshot lookup by OData path for key field comparison
            //     var mSnapshotByPath = {};
            //     if (that._allData) {
            //         that._allData.forEach(function (oSnapRow) {
            //             var sSnapPath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oSnapRow.FromDate,
            //                 Models:   oSnapRow.Models
            //             });
            //             mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
            //         });
            //     }

            //     var aTransientContexts    = [];
            //     var aNonTransientContexts = [];

            //     aContexts.forEach(function (oContext) {
            //         if (oContext.isTransient()) {
            //             aTransientContexts.push(oContext);
            //         } else {
            //             aNonTransientContexts.push(oContext);
            //         }
            //     });

            //     var mPending    = oModel.getPendingChanges();
            //     var bHasUpdates = false;
            //     var aTransientPayloads = [];

            //     // ── Handle new (transient) rows → POST ────────────────────────────────────
            //     // aTransientContexts.forEach(function (oContext) {

            //     //     const oData = oContext.getObject();

            //     //     var oPayload = Object.assign({}, oData);

            //     //     Object.keys(oPayload).forEach(function (key) {
            //     //         if (key.includes("Price")) delete oPayload[key];
            //     //     });

            //     //     oPayload.Status = "SUBMITTED";
            //     //     oPayload.Mail   = oMail;
            //     //     delete oPayload.__metadata;
            //     //     delete oPayload._snapshotIndex;
            //     //     oPayload.FromDate = toODataDate(oPayload.FromDate);

            //     //      console.log("Transient payload collected:", oPayload);
            //     //       aTransientPayloads.push(oPayload);

            //     //     oContext.delete();
            //     //     iPendingOperations++;

            //     //     oModel.create("/GMAComponentsSet", oPayload, {
            //     //         success: function () {
            //     //             console.log("CREATE success (transient)");
            //     //             onOperationDone(false);
            //     //         },
            //     //         error: function (oError) {
            //     //             handleError(oError, "/GMAComponentsSet", false);
            //     //         }
            //     //     });
            //     // });

            //     aTransientContexts.forEach(function (oContext) {
            //     const oData  = oContext.getObject();
            //     var oPayload = Object.assign({}, oData);

            //     Object.keys(oPayload).forEach(function (key) {
            //         if (key.includes("Price")) delete oPayload[key];
            //     });

            //     oPayload.Status   = "SUBMITTED";
            //     oPayload.Mail     = oMail;
            //     oPayload.FromDate = toODataDate(oPayload.FromDate);
            //     delete oPayload.__metadata;
            //     delete oPayload._snapshotIndex;


            //     aTransientPayloads.push(oPayload);
            //     oContext.delete();  // ✅ remove transient from table
            // });

            //     // ── Handle existing rows — key change = DELETE+CREATE, else PUT ───────────
            //     aNonTransientContexts.forEach(function (oContext) {

            //         const sPath = oContext.getPath();
            //         const sKey  = sPath.substring(1);
            //         const oData = oContext.getObject();

            //         var oPayload = Object.assign({}, oData);

            //         Object.keys(oPayload).forEach(function (key) {
            //             if (key.includes("Price")) delete oPayload[key];
            //         });

            //         if (mPending[sKey]) {

            //             var oPending    = mPending[sKey];
            //             var oSnapRow    = mSnapshotByPath[sKey];
            //             var bKeyChanged = false;

            //             if (oSnapRow) {
            //                 var oMerged = Object.assign({}, oData, oPending);
            //                 bKeyChanged = aKeyFields.some(function (k) {
            //                     var vNew = (k === "FromDate")
            //                         ? normalizeDateVal(oMerged[k])
            //                         : String(oMerged[k]);
            //                     var vOld = (k === "FromDate")
            //                         ? normalizeDateVal(oSnapRow[k])
            //                         : String(oSnapRow[k]);
            //                     return vNew !== vOld;
            //                 });
            //             }

            //             if (bKeyChanged) {

            //                 var oMergedData = Object.assign({}, oData, oPending);
            //                 var oCreateData = Object.assign({}, oMergedData);
            //                 delete oCreateData.__metadata;
            //                 delete oCreateData._snapshotIndex;

            //                 Object.keys(oCreateData).forEach(function (key) {
            //                     if (key.includes("Price")) delete oCreateData[key];
            //                 });

            //                 oCreateData.Status   = "SUBMITTED";
            //                 oCreateData.Mail     = oMail;
            //                 oCreateData.FromDate = oSnapRow.FromDate;

            //                 var sDeletePath = oModel.createKey("/GMAComponentsSet", {
            //                     FromDate: oSnapRow.FromDate,
            //                     Models:   oSnapRow.Models
            //                 });

            //                 oModel.resetChanges([sPath]);

            //                 console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //                 console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //                 iPendingOperations += 2;
            //                 doDeleteCreate(sDeletePath, oCreateData, false);

            //                 return;
            //             }

            //             // ── Normal PUT (no key change) ────────────────────────────────────
            //             oPayload.Status = "SUBMITTED";
            //             delete oPayload.__metadata;
            //             delete oPayload._snapshotIndex;

            //             oModel.resetChanges([sPath]);
            //             oModel.update(sPath, oPayload, { method: "PUT" });
            //             iPendingOperations++;
            //             bHasUpdates = true;
            //         }
            //     });

            //     if (aTransientPayloads.length > 0) {
            //     that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 1000);
            // }

            //   if (iPendingOperations === 0 && aTransientPayloads.length === 0) {
            //     oView.setBusy(false);
            //     sap.m.MessageToast.show("No changes to save");
            //     return;
            // }

            //     oView.setBusy(true);

            //     // ✅ Only attach requestCompleted if there are PUT/MERGE rows
            //     if (bHasUpdates) {

            //         function extractErrorMessage(oEvent) {
            //             try {
            //                 var oResponse = oEvent.getParameter("response");
            //                 if (oResponse && oResponse.responseText) {
            //                     var oBody = JSON.parse(oResponse.responseText);
            //                     if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                         return oBody.error.message.value;
            //                     }
            //                 }
            //             } catch (e) {}
            //             return "An error occurred while saving. Please try again.";
            //         }

            //         function onRequestDone(oEvent) {
            //             var sMethod = oEvent.getParameter("method");
            //             if (sMethod !== "POST" && sMethod !== "MERGE") return;

            //             var bSuccess = oEvent.getParameter("success");
            //             if (!bSuccess) {
            //                 bHasError = true;
            //                 sap.m.MessageBox.error(extractErrorMessage(oEvent));
            //             }

            //             iPendingOperations--;

            //             if (iPendingOperations === 0) {
            //                 oModel.detachEvent("requestCompleted", onRequestDone);
            //                 oView.setBusy(false);

            //                 if (!bHasError) {
            //                     sap.m.MessageToast.show("Saved successfully");
            //                     oTable.getBinding("rows").refresh();
            //                 }
            //             }
            //         }

            //         oModel.attachEvent("requestCompleted", onRequestDone);
            //         oModel.submitChanges();
            //     }
            // },


            // onSubmit: function () {

            //     const oModel = this.getView().getModel();
            //     const oTable = this.byId("gmaComponentTable");
            //     const oView  = this.getView();
            //     const that   = this;

            //     const oVm   = this.getView().getModel("viewModel");
            //     const oMail = oVm.getProperty("/ASMEmail");

            //     var bHasError          = false;
            //     var iPendingOperations = 0;

            //     var aKeyFields = ["Models"];

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

            //     function normalizeDateVal(v) {
            //         if (!v) return "";
            //         if (typeof v === "string" && v.includes("/Date(")) {
            //             var match = v.match(/\/Date\((-?\d+)/);
            //             return match ? parseInt(match[1], 10) : "";
            //         }
            //         if (v instanceof Date) {
            //             return isNaN(v) ? "" : v.getTime();
            //         }
            //         var d = new Date(v);
            //         return isNaN(d) ? String(v) : d.getTime();
            //     }

            //     function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
            //         console.log("DELETE path:", sDeletePath);
            //         console.log("CREATE payload:", oCreateData);

            //         oModel.remove(sDeletePath, {
            //             success: function () {
            //                 console.log("DELETE success:", sDeletePath);
            //                 onOperationDone(bIsFiltered);

            //                 oModel.create("/GMAComponentsSet", oCreateData, {
            //                     success: function () {
            //                         console.log("CREATE success after DELETE");
            //                         onOperationDone(bIsFiltered);
            //                     },
            //                     error: function (oError) {
            //                         handleError(oError, "/GMAComponentsSet", bIsFiltered);
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
            //                 oTable.getBinding("rows").refresh();
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

            //         var aFilteredData     = oTable.getModel().getProperty("/rows") || [];
            //         var aOriginalSnapshot = that._allData ? that._allData.slice() : [];
            //         var aIgnoreKeys       = ["__metadata", "Status", "_snapshotIndex"];
            //         var aChangedRows      = [];

            //         aFilteredData.forEach(function (oFilteredRow) {

            //             var oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                 return o._snapshotIndex === oFilteredRow._snapshotIndex;
            //             });

            //             if (!oOriginalRow) {
            //                 oOriginalRow = aOriginalSnapshot.find(function (o) {
            //                     return o.Models === oFilteredRow.Models;
            //                 });
            //             }

            //             var bChanged = false;

            //             if (oOriginalRow) {
            //                 var aKeys = Object.keys(oFilteredRow).filter(function (k) {
            //                     return aIgnoreKeys.indexOf(k) === -1 && !k.includes("Price");
            //                 });

            //                 bChanged = aKeys.some(function (k) {
            //                     if (k === "FromDate") {
            //                         return normalizeDateVal(oFilteredRow[k]) !== normalizeDateVal(oOriginalRow[k]);
            //                     }
            //                     return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            //                 });
            //             }

            //             console.log(
            //                 "Row → Models:", oFilteredRow.Models,
            //                 "| SnapshotIndex:", oFilteredRow._snapshotIndex,
            //                 "| Changed:", bChanged
            //             );

            //             if (bChanged) {
            //                 aChangedRows.push({ oRow: oFilteredRow, oOriginalRow: oOriginalRow });
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
            //                 var vNew = (k === "FromDate") ? normalizeDateVal(oItem.oRow[k])         : String(oItem.oRow[k]);
            //                 var vOld = (k === "FromDate") ? normalizeDateVal(oItem.oOriginalRow[k]) : String(oItem.oOriginalRow[k]);
            //                 return vNew !== vOld;
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

            //             var sPath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            //                 Models:   oOriginalRow ? oOriginalRow.Models   : oRow.Models
            //             });

            //             var oPayload = Object.assign({}, oRow);
            //             delete oPayload.__metadata;
            //             delete oPayload._snapshotIndex;
            //             Object.keys(oPayload).forEach(function (key) {
            //                 if (key.includes("Price")) delete oPayload[key];
            //             });

            //             oPayload.Status   = "SUBMITTED";
            //             oPayload.Mail     = oMail;
            //             oPayload.FromDate = toODataDate(oRow.FromDate);

            //             console.log("PUT path:", sPath, "| Body FromDate:", oPayload.FromDate);

            //             oModel.update(sPath, oPayload, {
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

            //             var sDeletePath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oOriginalRow.FromDate,
            //                 Models:   oOriginalRow.Models
            //             });

            //             var oCreateData = Object.assign({}, oRow);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             Object.keys(oCreateData).forEach(function (key) {
            //                 if (key.includes("Price")) delete oCreateData[key];
            //             });

            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.Mail     = oMail;
            //             oCreateData.FromDate = oOriginalRow.FromDate;

            //             doDeleteCreate(sDeletePath, oCreateData, true);
            //         });

            //         return;
            //     }

            //     // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
            //     sap.ui.getCore().applyChanges();

            //     // ✅ getContexts(0, length) — needed to catch ALL transient rows from Excel upload
            //     const oRowBinding = oTable.getBinding("rows");
            //     const aAllContexts = oRowBinding.getContexts(0, oRowBinding.getLength());

            //     // ✅ mPending is the source of truth — drives which non-transient rows get updated
            //     var mPending = oModel.getPendingChanges();

            //     var aTransientContexts    = [];
            //     var aNonTransientContexts = [];

            //     aAllContexts.forEach(function (oContext) {
            //         if (oContext.isTransient()) {
            //             // ✅ Collect ALL transient (Excel) rows regardless of scroll position
            //             aTransientContexts.push(oContext);
            //         } else {
            //             // ✅ Only include non-transient rows that ACTUALLY have a pending change
            //             //    This prevents stale/unedited rows from firing extra MERGE requests
            //             var sKey = oContext.getPath().substring(1);
            //             if (mPending[sKey]) {
            //                 aNonTransientContexts.push(oContext);
            //             }
            //         }
            //     });

            //     // ✅ Build snapshot lookup for key-field comparison (PUT vs DELETE+CREATE)
            //     var mSnapshotByPath = {};
            //     if (that._allData) {
            //         that._allData.forEach(function (oSnapRow) {
            //             var sSnapPath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oSnapRow.FromDate,
            //                 Models:   oSnapRow.Models
            //             });
            //             mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
            //         });
            //     }

            //     var bHasUpdates        = false;
            //     var aTransientPayloads = [];

            //     // ── Collect transient (Excel upload) rows ─────────────────────────────────
            //     aTransientContexts.forEach(function (oContext) {
            //         const oData  = oContext.getObject();
            //         var oPayload = Object.assign({}, oData);

            //         Object.keys(oPayload).forEach(function (key) {
            //             if (key.includes("Price")) delete oPayload[key];
            //         });

            //         oPayload.Status   = "SUBMITTED";
            //         oPayload.Mail     = oMail;
            //         oPayload.FromDate = toODataDate(oPayload.FromDate);
            //         delete oPayload.__metadata;
            //         delete oPayload._snapshotIndex;

            //         console.log("Transient payload collected:", oPayload);
            //         aTransientPayloads.push(oPayload);
            //         oContext.delete(); // remove transient row from binding
            //     });

            //     // ── Handle existing rows — key change = DELETE+CREATE, else PUT ───────────
            //     aNonTransientContexts.forEach(function (oContext) {

            //         const sPath = oContext.getPath();
            //         const sKey  = sPath.substring(1);
            //         const oData = oContext.getObject();

            //         var oPayload = Object.assign({}, oData);
            //         Object.keys(oPayload).forEach(function (key) {
            //             if (key.includes("Price")) delete oPayload[key];
            //         });

            //         var oPending    = mPending[sKey]; // guaranteed to exist — filtered above
            //         var oSnapRow    = mSnapshotByPath[sKey];
            //         var bKeyChanged = false;

            //         if (oSnapRow) {
            //             var oMerged = Object.assign({}, oData, oPending);
            //             bKeyChanged = aKeyFields.some(function (k) {
            //                 var vNew = (k === "FromDate") ? normalizeDateVal(oMerged[k])   : String(oMerged[k]);
            //                 var vOld = (k === "FromDate") ? normalizeDateVal(oSnapRow[k])  : String(oSnapRow[k]);
            //                 return vNew !== vOld;
            //             });
            //         }

            //         if (bKeyChanged) {
            //             var oMergedData = Object.assign({}, oData, oPending);
            //             var oCreateData = Object.assign({}, oMergedData);
            //             delete oCreateData.__metadata;
            //             delete oCreateData._snapshotIndex;
            //             Object.keys(oCreateData).forEach(function (key) {
            //                 if (key.includes("Price")) delete oCreateData[key];
            //             });

            //             oCreateData.Status   = "SUBMITTED";
            //             oCreateData.Mail     = oMail;
            //             oCreateData.FromDate = oSnapRow.FromDate;

            //             var sDeletePath = oModel.createKey("/GMAComponentsSet", {
            //                 FromDate: oSnapRow.FromDate,
            //                 Models:   oSnapRow.Models
            //             });

            //             oModel.resetChanges([sPath]);
            //             console.log("DELETE+CREATE → DELETE path:", sDeletePath);
            //             console.log("DELETE+CREATE → CREATE payload:", oCreateData);

            //             iPendingOperations += 2;
            //             doDeleteCreate(sDeletePath, oCreateData, false);
            //             return;
            //         }

            //         // ── Normal PUT (no key change) ────────────────────────────────────────
            //         oPayload.Status = "SUBMITTED";
            //         delete oPayload.__metadata;
            //         delete oPayload._snapshotIndex;

            //         oModel.resetChanges([sPath]);
            //         oModel.update(sPath, oPayload, { method: "PUT" });
            //         iPendingOperations++;
            //         bHasUpdates = true;
            //     });

            //     // ── Submit Excel rows via chunked batch ───────────────────────────────────
            //     if (aTransientPayloads.length > 0) {
            //         that._submitInChunks(aTransientPayloads, oTable.getBinding("rows"), 1000);
            //     }

            //     // ✅ FIXED: Guard now checks BOTH counters
            //     //    — iPendingOperations covers PUT/DELETE+CREATE rows
            //     //    — aTransientPayloads.length covers Excel upload rows
            //     //    Only show "No changes" when truly nothing is happening
            //     if (iPendingOperations === 0 && aTransientPayloads.length === 0) {
            //         oView.setBusy(false);
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     // ✅ Only set busy + attach requestCompleted if there are PUT/MERGE rows
            //     //    _submitInChunks manages its own busy state for Excel rows
            //     if (iPendingOperations > 0) {
            //         oView.setBusy(true);
            //     }

            //     if (bHasUpdates) {

            //         function extractErrorMessage(oEvent) {
            //             try {
            //                 var oResponse = oEvent.getParameter("response");
            //                 if (oResponse && oResponse.responseText) {
            //                     var oBody = JSON.parse(oResponse.responseText);
            //                     if (oBody.error && oBody.error.message && oBody.error.message.value) {
            //                         return oBody.error.message.value;
            //                     }
            //                 }
            //             } catch (e) {}
            //             return "An error occurred while saving. Please try again.";
            //         }

            //         function onRequestDone(oEvent) {
            //             var sMethod = oEvent.getParameter("method");
            //             if (sMethod !== "POST" && sMethod !== "MERGE") return;

            //             var bSuccess = oEvent.getParameter("success");
            //             if (!bSuccess) {
            //                 bHasError = true;
            //                 sap.m.MessageBox.error(extractErrorMessage(oEvent));
            //             }

            //             iPendingOperations--;

            //             if (iPendingOperations === 0) {
            //                 oModel.detachEvent("requestCompleted", onRequestDone);
            //                 oView.setBusy(false);

            //                 if (!bHasError) {
            //                     sap.m.MessageToast.show("Saved successfully");
            //                     oTable.getBinding("rows").refresh();
            //                 }
            //             }
            //         }

            //         oModel.attachEvent("requestCompleted", onRequestDone);
            //         oModel.submitChanges();
            //     }
            // },


            //new

            onSubmit: function () {

                var oModel = this.getView().getModel();
                var oTable = this.byId("gmaComponentTable");
                var oView = this.getView();
                var that = this;
                var oVm = this.getView().getModel("viewModel");
                var oMail = oVm.getProperty("/ASMEmail");

                // ── Key fields that trigger DELETE+CREATE instead of PUT ──────────────────
                var aKeyFields = ["Models"];

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

                // Strip metadata + Price fields, stamp Status/Mail, convert FromDate
                function buildPayload(oRaw, vFromDate) {
                    var o = Object.assign({}, oRaw);
                    delete o.__metadata;
                    delete o._snapshotIndex;

                    Object.keys(o).forEach(function (k) { if (k.includes("Price")) delete o[k]; });
                    o.Status = "SUBMITTED";
                    o.Mail = oMail;
                    o.FromDate = toODataDate(vFromDate !== undefined ? vFromDate : o.FromDate);
                    return o;
                }

                // Register a new deferred group and return its id
                function newGroup(sPrefix) {
                    var sId = sPrefix + "_" + Date.now();
                    var aCur = oModel.getDeferredGroups();
                    if (aCur.indexOf(sId) < 0) oModel.setDeferredGroups(aCur.concat([sId]));
                    return sId;
                }

                // Parse batch-level errors out of OData $batch response
                function batchErrors(oData) {
                    var aErrs = [];
                    ((oData && oData.__batchResponses) || []).forEach(function (r) {
                        if (+r.statusCode >= 400) {
                            try {
                                aErrs.push(JSON.parse(r.body).error.message.value);
                            } catch (e) {
                                aErrs.push("A row failed to save (HTTP " + r.statusCode + ").");
                            }
                        }
                    });
                    return aErrs;
                }

                // Parse OData error response body into a human message
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

                // Each item: { payload: {} }
                var aPostRows = [];

                // Each item: { sPath: "", oPayload: {} }
                var aPutRows = [];

                // Each item: { sDeletePath: "", oCreatePayload: {} }
                var aDCRows = [];

                // ═════════════════════════════════════════════════════════════════════════
                // BRANCH A — FILTERED FLOW
                // Table is backed by a JSON model (/rows).  Compare against _allData snapshot.
                // ═════════════════════════════════════════════════════════════════════════

                if (this._isFiltered) {

                    var aFiltered = oTable.getModel().getProperty("/rows") || [];
                    var aSnap = that._allData ? that._allData.slice() : [];
                    var aIgnore = ["__metadata", "Status", "_snapshotIndex"];

                    aFiltered.forEach(function (oRow) {

                        // ── Find original row in snapshot ─────────────────────────────────
                        var oOrig = aSnap.find(function (s) { return s._snapshotIndex === oRow._snapshotIndex; })
                            || aSnap.find(function (s) { return s.Models === oRow.Models; });

                        // ── No original → brand-new row created while filtered → POST ─────
                        if (!oOrig) {
                            aPostRows.push({ payload: buildPayload(oRow, oRow.FromDate) });
                            return;
                        }

                        // ── Check whether anything actually changed ───────────────────────
                        var bChanged = Object.keys(oRow)
                            .filter(function (k) { return aIgnore.indexOf(k) < 0 && !k.includes("Price"); })
                            .some(function (k) {
                                return k === "FromDate"
                                    ? normDate(oRow[k]) !== normDate(oOrig[k])
                                    : String(oRow[k]) !== String(oOrig[k]);
                            });

                        if (!bChanged) return;

                        // ── Changed: key field → DELETE+CREATE;  else → PUT ──────────────
                        var bKeyChanged = aKeyFields.some(function (k) {
                            return k === "FromDate"
                                ? normDate(oRow[k]) !== normDate(oOrig[k])
                                : String(oRow[k]) !== String(oOrig[k]);
                        });

                        if (bKeyChanged) {
                            aDCRows.push({
                                sDeletePath: oModel.createKey("/GMAComponentsSet", { FromDate: oOrig.FromDate, Models: oOrig.Models }),
                                oCreatePayload: buildPayload(oRow, oRow.FromDate)
                            });
                        } else {
                            aPutRows.push({
                                sPath: oModel.createKey("/GMAComponentsSet", { FromDate: oOrig.FromDate, Models: oOrig.Models }),
                                oPayload: buildPayload(oRow, oRow.FromDate)
                            });
                        }
                    });

                    // ═════════════════════════════════════════════════════════════════════════
                    // BRANCH B — NORMAL (UNFILTERED) FLOW
                    // Table is backed by the OData model directly.
                    // Transient contexts  = new rows (manual Create button OR Excel upload).
                    // Non-transient + pending = edited existing rows.
                    // ═════════════════════════════════════════════════════════════════════════

                } else {

                    sap.ui.getCore().applyChanges();

                    var oBinding = oTable.getBinding("rows");
                    var aContexts = oBinding.getContexts(0, oBinding.getLength());
                    var mPending = oModel.getPendingChanges();

                    // Build snapshot path → row lookup for key-field comparison
                    var mSnap = {};
                    (that._allData || []).forEach(function (r) {
                        var sKey = oModel.createKey(
                            "/GMAComponentsSet",
                            { FromDate: r.FromDate, Models: r.Models }
                        ).substring(1);
                        mSnap[sKey] = r;
                    });

                    aContexts.forEach(function (oCtx) {

                        // ── Transient (new) rows → POST ───────────────────────────────────
                        if (oCtx.isTransient()) {
                            var oData = oCtx.getObject();
                            aPostRows.push({ payload: buildPayload(oData, oData.FromDate) });
                            oCtx.delete();   // remove from table binding
                            return;
                        }

                        // ── Existing rows: only process if they have a pending change ─────
                        var sPath = oCtx.getPath();
                        var sKey = sPath.substring(1);
                        if (!mPending[sKey]) return;   // ✅ unchanged row → skip entirely

                        var oData = oCtx.getObject();
                        var oPend = mPending[sKey];
                        var oSnap = mSnap[sKey];
                        var oMerged = Object.assign({}, oData, oPend);

                        // ✅ Remove from the model's default group NOW so it cannot be
                        //    swept up by any future global submitChanges() call
                        oModel.resetChanges([sPath]);

                        // ── Decide PUT vs DELETE+CREATE ───────────────────────────────────
                        var bKeyChanged = oSnap && aKeyFields.some(function (k) {
                            return k === "FromDate"
                                ? normDate(oMerged[k]) !== normDate(oSnap[k])
                                : String(oMerged[k]) !== String(oSnap[k]);
                        });

                        if (bKeyChanged) {
                            aDCRows.push({
                                sDeletePath: oModel.createKey("/GMAComponentsSet", { FromDate: oSnap.FromDate, Models: oSnap.Models }),
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
                // POST rows are chunked (500/batch) → count chunks, not rows.
                // PUT rows go in one batch → count as 1 batch operation total.
                // DELETE+CREATE → 2 per row (sequential: DELETE then CREATE).
                // ═════════════════════════════════════════════════════════════════════════

                var CHUNK_SIZE = 500;
                var aPostChunks = [];
                if (aPostRows.length > 0) {
                    for (var ci = 0; ci < aPostRows.length; ci += CHUNK_SIZE) {
                        aPostChunks.push(aPostRows.slice(ci, ci + CHUNK_SIZE));
                    }
                }

                // PUT batch counts as 1 unit regardless of how many rows it contains.
                var iPutBatch = aPutRows.length > 0 ? 1 : 0;
                var iTotalOps = aPostChunks.length + iPutBatch + (aDCRows.length * 2);

                if (iTotalOps === 0) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // ═════════════════════════════════════════════════════════════════════════
                // COMPLETION TRACKING  — single shared counter for all operation types
                // ═════════════════════════════════════════════════════════════════════════

                var iPending = iTotalOps;
                var bHasError = false;
                var bFiltered = this._isFiltered;   // capture before async callbacks run

                oView.setBusy(true);

                function done() {
                    iPending--;
                    console.log("op done, remaining:", iPending);
                    if (iPending > 0) return;

                    // All operations finished
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
                    done();   // still count this as one operation completing
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
                            oModel.create("/GMAComponentsSet", r.payload, { groupId: sGrp });
                        });

                        oModel.submitChanges({
                            groupId: sGrp,
                            success: function (oData) {
                                // Surface any row-level errors from the batch response
                                var aErrs = batchErrors(oData);
                                if (aErrs.length) {
                                    bHasError = true;
                                    sap.m.MessageBox.error(
                                        aErrs.length + " row(s) failed to create:\n" + aErrs.slice(0, 5).join("\n")
                                    );
                                }
                                done();                  // this chunk is done
                                submitChunk(idx + 1);   // fire next chunk
                            },
                            error: function (oError) {
                                fail(oError, "POST chunk " + (idx + 1));
                                // Abort remaining chunks on hard error
                                // Adjust iPending so we don't wait for chunks that won't run
                                var iRemaining = aPostChunks.length - idx - 1;
                                iPending -= iRemaining;
                                if (iPending <= 0) {
                                    oView.setBusy(false);
                                }
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
                        // ✅ groupId isolates these rows — only this group is submitted below.
                        //    No other pending model changes can be swept in.
                        oModel.update(r.sPath, r.oPayload, { groupId: sPutGrp, merge: false });
                    });

                    oModel.submitChanges({
                        groupId: sPutGrp,
                        success: function (oData) {
                            var aErrs = batchErrors(oData);
                            if (aErrs.length) {
                                bHasError = true;
                                sap.m.MessageBox.error(
                                    aErrs.length + " row(s) failed to update:\n" + aErrs.slice(0, 5).join("\n")
                                );
                            }
                            done();   // entire PUT batch = 1 operation
                        },
                        error: function (oError) {
                            fail(oError, "PUT batch");
                        }
                    });
                }

                // ═════════════════════════════════════════════════════════════════════════
                // EXECUTE — DELETE + CREATE (key field changed — must be sequential)
                // DELETE and CREATE fire as individual requests, each counted separately.
                // ═════════════════════════════════════════════════════════════════════════

                aDCRows.forEach(function (op) {

                    oModel.remove(op.sDeletePath, {
                        success: function () {
                            done();   // ← DELETE counted

                            oModel.create("/GMAComponentsSet", op.oCreatePayload, {
                                success: function () {
                                    done();   // ← CREATE counted
                                },
                                error: function (oError) {
                                    fail(oError, "CREATE after DELETE [" + op.sDeletePath + "]");
                                    // fail() calls done() internally — CREATE slot consumed
                                }
                            });
                        },
                        error: function (oError) {
                            fail(oError, "DELETE [" + op.sDeletePath + "]");
                            // DELETE failed → skip the CREATE but still consume its slot
                            // so iPending reaches 0 and we don't hang the busy state
                            done();   // ← CREATE slot consumed (skipped)
                        }
                    });
                });

            },

            _insertIntoTable: function (aExcelData) {

                const oTable = this.byId("gmaComponentTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const oVm = this.getView().getModel("viewModel");
                const sMail = oVm.getProperty("/ASMEmail");

                // ✅ Clear filter first so oBinding points to OData binding
                if (this._isFiltered) {
                    this.onClearFilter();
                }

                // ✅ Clear any existing draft/transient rows before inserting new ones
                this._clearDraftRows();

                var iCreated = 0;

                aExcelData.forEach(function (oRow) {

                    // ✅ Fixed date parsing — handles serial number, dd-mm-yyyy, and ISO string
                    var oFromDate;

                    if (oRow["Effective Date"]) {
                        if (typeof oRow["Effective Date"] === "number") {
                            // Excel serial number → JS Date (UTC)
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
                                // ISO or other string format
                                oFromDate = new Date(sParsed);
                            }
                        }
                    } else {
                        oFromDate = new Date();
                    }

                    // ✅ Guard: fallback to today if date is invalid — fixes NaN-NaN-NaN
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

                    // ✅ Create transient row directly on OData binding
                    oBinding.create({
                        Models: oRow["Model"] || "",
                        Description: oRow["Description"] || "",
                        MtsMto: oRow["MTS/MTO"] || "MTS",
                        ReferMtsModel: oRow["Reference Model"] || "",
                        Mail: sMail,
                        FromDate: oFromDate,

                        Part1: String(oRow["Part1"] || ""),
                        Part2: String(oRow["Part2"] || ""),
                        Part3: String(oRow["Part3"] || ""),
                        Part4: String(oRow["Part4"] || ""),
                        Part5: String(oRow["Part5"] || ""),
                        Part6: String(oRow["Part6"] || ""),
                        Part7: String(oRow["Part7"] || ""),
                        Part8: String(oRow["Part8"] || ""),
                        Part9: String(oRow["Part9"] || ""),
                        Part10: String(oRow["Part10"] || ""),
                        Part11: String(oRow["Part11"] || ""),
                        Part12: String(oRow["Part12"] || ""),
                        Part13: String(oRow["Part13"] || ""),
                        Part14: String(oRow["Part14"] || ""),
                        Part15: String(oRow["Part15"] || ""),
                        Part16: String(oRow["Part16"] || ""),
                        Part17: String(oRow["Part17"] || ""),
                        Part18: String(oRow["Part18"] || ""),
                        Part19: String(oRow["Part19"] || ""),
                        Part20: String(oRow["Part20"] || ""),

                        Status: "SUBMITTED",
                        _selectedForDelete: false
                    });

                    iCreated++;

                }.bind(this));

                // ✅ No pending payloads needed — transient rows handle everything
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

            _submitInChunks: function (aAllRows, oBinding, iChunkSize) {
                var that = this;
                var aChunks = this._chunkArray(aAllRows, iChunkSize || 500);
                var iTotal = aAllRows.length;
                var iSubmitted = 0;
                var iChunkIndex = 0;
                var oView = this.getView();
                var oModel = this.getView().getModel();
                var oVm = this.getView().getModel("viewModel");
                var sMail = oVm.getProperty("/ASMEmail");

                oView.setBusy(true);

                function submitNextChunk() {
                    if (iChunkIndex >= aChunks.length) {
                        oView.setBusy(false);
                        sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully.");

                        // ✅ Rebind to OData so saved rows load fresh from backend
                        var oTable = that.byId("gmaComponentTable");
                        oTable.setModel(that.getView().getModel());
                        oTable.bindRows({
                            path: "/GMAComponentsSet",
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
                        oModel.create("/GMAComponentsSet", oCreateData, {
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

            //
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

            //     _insertIntoTable: function (aExcelData) {

            //         const oTable = this.byId("gmaComponentTable"); // ✅ FIXED
            //         const oBinding = oTable.getBinding("rows");

            //         if (!oBinding) {
            //             sap.m.MessageToast.show("Table not ready");
            //             return;
            //         }

            //         const oVm = this.getView().getModel("viewModel");
            //         const sMail = oVm.getProperty("/ASMEmail");

            //         // 🔥 If filtered → clear filter
            //         if (this._isFiltered) {
            //             this.onClearFilter();
            //         }

            //         aExcelData.forEach(oRow => {

            //              var oFromDate;
            // if (oRow["Effective Date"]) {
            //     if (typeof oRow["Effective Date"] === "number") {
            //         // Excel serial number → JS Date
            //         var excelEpoch = new Date(Date.UTC(1899, 11, 30));
            //         oFromDate = new Date(excelEpoch.getTime() + oRow["Effective Date"] * 86400000);
            //     } else {
            //         oFromDate = new Date(oRow["Effective Date"]);
            //     }
            // } else {
            //     oFromDate = new Date();
            // }
            // oFromDate.setUTCHours(12, 0, 0, 0); // ✅ noon UTC avoids timezone day-shift

            //             oBinding.create({
            //                 Models: oRow["Model"] || "",
            //                 Description: oRow["Description"] || "",
            //                 MtsMto: oRow["MTS/MTO"] || "MTS",
            //                 ReferMtsModel: oRow["Reference Model"] || "",
            //                 FromDate:      oFromDate,

            //                 Part1: oRow["Part1"] || "",
            //                 Part2: oRow["Part2"] || "",
            //                 Part3: oRow["Part3"] || "",
            //                 Part4: oRow["Part4"] || "",
            //                 Part5: oRow["Part5"] || "",
            //                 Part6: oRow["Part6"] || "",
            //                 Part7: oRow["Part7"] || "",
            //                 Part8: oRow["Part8"] || "",
            //                 Part9: oRow["Part9"] || "",
            //                 Part10: oRow["Part10"] || "",

            //                 Part11: oRow["Part11"] || "",
            //                 Part12: oRow["Part12"] || "",
            //                 Part13: oRow["Part13"] || "",
            //                 Part14: oRow["Part14"] || "",
            //                 Part15: oRow["Part15"] || "",

            //                 Part16: oRow["Part16"] || "",
            //                 Part17: oRow["Part17"] || "",
            //                 Part18: oRow["Part18"] || "",
            //                 Part19: oRow["Part19"] || "",
            //                 Part20: oRow["Part20"] || "",

            //                 Status: "SUBMITTED"
            //             });

            //         });
            //         sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            //     },

            _getAllFields: function () {
                return [
                    { key: "Models", label: "Model" },
                    { key: "Description", label: "Description" },
                    { key: "MtsMto", label: "MTS/MTO" },
                    { key: "ReferMtsModel", label: "Reference Model" },
                    { key: "FromDate", label: "Effective Date" },

                    { key: "Part1", label: "Part1" },
                    { key: "Part1Price", label: "Price1" },
                    { key: "Part2", label: "Part2" },
                    { key: "Part2Price", label: "Price2" },
                    { key: "Part3", label: "Part3" },
                    { key: "Part3Price", label: "Price3" },
                    { key: "Part4", label: "Part4" },
                    { key: "Part4Price", label: "Price4" },
                    { key: "Part5", label: "Part5" },
                    { key: "Part5Price", label: "Price5" },

                    { key: "Part6", label: "Part6" },
                    { key: "Part6Price", label: "Price6" },
                    { key: "Part7", label: "Part7" },
                    { key: "Part7Price", label: "Price7" },
                    { key: "Part8", label: "Part8" },
                    { key: "Part8Price", label: "Price8" },
                    { key: "Part9", label: "Part9" },
                    { key: "Part9Price", label: "Price9" },
                    { key: "Part10", label: "Part10" },
                    { key: "Part10Price", label: "Price10" },

                    { key: "Part11", label: "Part11" },
                    { key: "Part11Price", label: "Price11" },
                    { key: "Part12", label: "Part12" },
                    { key: "Part12Price", label: "Price12" },
                    { key: "Part13", label: "Part13" },
                    { key: "Part13Price", label: "Price13" },
                    { key: "Part14", label: "Part14" },
                    { key: "Part14Price", label: "Price14" },
                    { key: "Part15", label: "Part15" },
                    { key: "Part15Price", label: "Price15" },

                    { key: "Part16", label: "Part16" },
                    { key: "Part16Price", label: "Price16" },
                    { key: "Part17", label: "Part17" },
                    { key: "Part17Price", label: "Price17" },
                    { key: "Part18", label: "Part18" },
                    { key: "Part18Price", label: "Price18" },
                    { key: "Part19", label: "Part19" },
                    { key: "Part19Price", label: "Price19" },
                    { key: "Part20", label: "Part20" },
                    { key: "Part20Price", label: "Price20" }
                ];
            },

            onDownloadAll: function () {

                const oTable = this.byId("gmaComponentTable"); // ✅ correct table
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
                    fileName: "GmaComponent_Export.xlsx"
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

                const oTable = this.byId("gmaComponentTable");
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
                var oTable = this.byId("gmaComponentTable");
                var bDescending = (sSortOrder === "Descending");

                var aData;

                if (this._isFiltered) {
                    var oCurrentModel = oTable.getModel();
                    aData = JSON.parse(JSON.stringify(oCurrentModel.getProperty("/rows") || []));
                } else {
                    var oBinding = oTable.getBinding("rows");
                    var aContexts = oBinding.getContexts(0, oBinding.getLength());
                    aData = aContexts.map(function (ctx) { return Object.assign({}, ctx.getObject()); });
                }

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
                                return o.Models === oRow.Models;
                            });
                        }
                        if (oSnap) {
                            oRow._snapshotIndex = oSnap._snapshotIndex;

                            // ✅ Only restore original FromDate if user has NOT changed it
                            // Compare current row's FromDate ms vs snapshot ms
                            var iRowMs = that.extractMs(oRow.FromDate);
                            var iSnapMs = that.extractMs(oSnap.FromDate);

                            if (iRowMs === iSnapMs) {
                                // Not changed — restore raw /Date(...)/ string for createKey
                                oRow.FromDate = oSnap.FromDate;
                            }
                            // If changed — keep oRow.FromDate as-is (user's /Date(ms)/ from onDateChange)
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

                // ✅ Convert /Date(...)/ → Date object for DatePicker display
                aData.forEach(function (oRow) {
                    if (oRow.FromDate && typeof oRow.FromDate === "string" && oRow.FromDate.indexOf("/Date(") >= 0) {
                        var ms = parseInt(oRow.FromDate.match(/\d+/)[0], 10);
                        oRow.FromDate = new Date(ms);
                    }
                });

                var oJSONModel = new sap.ui.model.json.JSONModel({ rows: aData });
                oTable.setModel(oJSONModel);
                oTable.bindRows("/rows");

                this._isFiltered = true;

                oTable.getColumns().forEach(function (col) { col.setSorted(false); });
                oColumn.setSorted(true);
                oColumn.setSortOrder(sSortOrder);
            },

            extractMs: function (v) {
                if (!v) return 0;
                if (typeof v === "string" && v.indexOf("/Date(") === 0) {
                    var m = v.match(/\/Date\((-?\d+)/);
                    return m ? parseInt(m[1], 10) : 0;
                }
                if (v instanceof Date) return v.getTime();
                var d = new Date(v);
                return isNaN(d) ? 0 : d.getTime();
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

                const oTable = this.byId("gmaComponentTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("Table not ready");
                    return;
                }

                const aContexts = oBinding.getContexts(
                    0,
                    oBinding.getLength()
                );

                // Get all selected NEW rows
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

                // Remove ALL selected new rows
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


        });
    });

