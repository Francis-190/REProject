sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/routing/History",
        "sap/ui/export/Spreadsheet"
    ],
    function (BaseController, History, Spreadsheet) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.Gmacomponenthistory", {
            onInit: async function () {

                const oVM = new sap.ui.model.json.JSONModel({});
                this.getView().setModel(oVM, "viewModel");

                let sAsmName = "Anad Kumar";
                let sASMMail = "siva.durairaj@laderatechnology.com"


                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sAsmName = oUserInfo.getFullName();
                    sASMMail = oUserInfo.getEmail();
                }
                sAsmName = sAsmName.toUpperCase();

                oVM.setProperty("/ASMEmail", sASMMail);


                const oTable = this.byId("gmaTable");


                oTable.bindRows({
                    path: "/GMAComponentsInvalidSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail",
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: sASMMail
                        })
                    ],
                  events: {
                    dataReceived: function (oEvent) {

                        // ✅ Existing logic — unchanged
                        var oModel = this.getView().getModel();
                        var aData = oModel.getProperty("/GMAComponentsInvalidSet");

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

                this._getPartCode(sASMMail)

            },

                        onRowsUpdated: function () {
                this._applyRowColors();
            },

_applyRowColors: function () {
    var oTable = this.byId("gmaTable");
    if (!oTable) return;

    var oToday = new Date();
    oToday.setHours(0, 0, 0, 0);

    oTable.getRows().forEach(function (oRow) {
        var oDomRef = oRow.getDomRef();
        if (!oDomRef) return;

        oDomRef.classList.remove("regionRowGreen", "regionRowRed");

        var oContext = oRow.getBindingContext();
        if (!oContext) return;

        var sFromDate = oContext.getProperty("FromDate");
        if (!sFromDate) return;

        var oDate;
        if (typeof sFromDate === "string" && sFromDate.indexOf("/Date(") !== -1) {
            var iTimestamp = parseInt(sFromDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
            oDate = new Date(iTimestamp);
        } else if (sFromDate instanceof Date) {
            oDate = new Date(sFromDate.getTime());
        } else {
            oDate = new Date(sFromDate);
        }

        if (isNaN(oDate.getTime())) return;

        oDate.setHours(0, 0, 0, 0);
        oDomRef.classList.add(oDate >= oToday ? "regionRowGreen" : "regionRowRed");

    }.bind(this));
},

formatRowHighlight: function (sFromDate) {
    if (!sFromDate) return "None";

    var oDate;

    if (typeof sFromDate === "string" && sFromDate.indexOf("/Date(") !== -1) {
        var iTimestamp = parseInt(sFromDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
        oDate = new Date(iTimestamp);
    } else if (sFromDate instanceof Date) {
        oDate = new Date(sFromDate.getTime());
    } else {
        oDate = new Date(sFromDate);
    }

    if (isNaN(oDate.getTime())) return "None";

    var oToday = new Date();
    oToday.setHours(0, 0, 0, 0);
    oDate.setHours(0, 0, 0, 0);

    return oDate >= oToday ? "Success" : "Error";
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

            // onApplyFilter: function () {

            //     const aModels = this.byId("filterModelCode").getSelectedKeys();

            //     let aFiltered = this._allData || [];

            //     if (aModels.length) {
            //         aFiltered = aFiltered.filter(o => aModels.includes(o.Models));
            //     }

            //     this._isFiltered = true;

            //     const oTable = this.byId("gmaTable");
            //     oTable.setModel(new sap.ui.model.json.JSONModel(aFiltered));
            //     oTable.bindRows("/");
            // },


            onApplyFilter: function () {

                const aModels = this.byId("filterModelCode").getSelectedKeys();

                let aFiltered = this._allData || [];

                if (aModels.length) {
                    aFiltered = aFiltered.filter(o => aModels.includes(o.Models));
                }

                this._isFiltered = true;

                const oTable = this.byId("gmaTable");

                // ✅ Deep clone — prevents edits from mutating _allData
                oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
                oTable.bindRows("/");
            },
            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("gmaTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/GMAComponentsInvalidSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail",
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: this.getView().getModel("viewModel").getProperty("/ASMEmail")
                        })
                    ]
                });
            },

            formatParts: function() {
  var parts = Array.prototype.slice.call(arguments);
  return parts
    .filter(function(p) { return p && p.trim() !== ""; })
    .join(", ");
},

            // _getPartCode: function (sASMMail) {

            //     console.log("inside partset", sASMMail);

            //     const oModel = this.getOwnerComponent().getModel();
            //     const oVM = this.getView().getModel("viewModel");

            //     if (!oModel) {
            //         console.error("OData V2 model not found");
            //         return;
            //     }

            //     oModel.read("/PartsSet", {
            //         filters: [
            //             new sap.ui.model.Filter(
            //                 "Mail",
            //                 sap.ui.model.FilterOperator.EQ,
            //                 sASMMail
            //             )
            //         ],
            //         success: function (oData) {
            //             console.log("PartsSet response:", oData.results);
            //             oVM.setProperty("/PartsSet", oData.results);
            //         },
            //         error: function (oError) {
            //             console.error("PartsSet failed", oError);
            //             sap.m.MessageBox.error("Failed to load Parts");
            //         }
            //     });
            // },

          _clearDraftRows: function () {

    const oModel = this.getView().getModel();

    // ✅ This removes ALL pending + transient changes
    if (oModel.hasPendingChanges()) {
        oModel.resetChanges();
    }

},

onNavBack: function () {

    this._clearDraftRows();

     const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("History", {}, true);
},
   



            onCreateMasterRow: function () {
                console.log("HI");

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("gmaTable");
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
                if (!vDate) return "";
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
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

            
onSubmit: function () {

    const oModel = this.getView().getModel();
    const oTable = this.byId("gmaTable");
    const oView  = this.getView();
    const that   = this;

    const oVm   = this.getView().getModel("viewModel");
    const oMail = oVm.getProperty("/ASMEmail");

    var bHasError          = false;
    var iPendingOperations = 0;

    // ✅ Key field that triggers DELETE + CREATE when changed
    var aKeyFields = ["Models"];

    // ─── HELPER: DELETE old key + CREATE with new key ─────────────────────────
    function doDeleteCreate(sDeletePath, oCreateData, bIsFiltered) {
        console.log("DELETE path:", sDeletePath);
        console.log("CREATE payload:", oCreateData);

        oModel.remove(sDeletePath, {
            success: function () {
                console.log("DELETE success:", sDeletePath);
                onOperationDone(bIsFiltered);

                oModel.create("/GMAComponentsInvalidSet", oCreateData, {
                    success: function () {
                        console.log("CREATE success after DELETE");
                        onOperationDone(bIsFiltered);
                    },
                    error: function (oError) {
                        handleError(oError, "/GMAComponentsInvalidSet", bIsFiltered);
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
                oTable.getBinding("rows").refresh();
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
        } catch (e) {}

        sap.m.MessageBox.error(sMessage);
        onOperationDone(bIsFiltered);
    }

    // ─── FILTERED FLOW ────────────────────────────────────────────────────────
    if (this._isFiltered) {

        var oTableModel       = oTable.getModel();
        var aFilteredData     = oTableModel.getProperty("/") || [];
        var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

        var aIgnoreKeys  = ["__metadata", "Status", "FromDate", "_snapshotIndex"];
        var aChangedRows = [];

        aFilteredData.forEach(function (oFilteredRow) {

            // ✅ Find original by _snapshotIndex (stable even if Models key changed)
            var oOriginalRow = aOriginalSnapshot.find(function (o) {
                return o._snapshotIndex === oFilteredRow._snapshotIndex;
            });

            // ✅ Fallback: match by Models for rows without _snapshotIndex
            if (!oOriginalRow) {
                oOriginalRow = aOriginalSnapshot.find(function (o) {
                    return o.Models === oFilteredRow.Models;
                });
            }

            var bChanged = false;

            if (oOriginalRow) {
                var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                    return aIgnoreKeys.indexOf(k) === -1 && !k.includes("Price");
                });
                bChanged = aKeys.some(function (k) {
                    return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
                });
            }

            console.log(
                "Row → Models:", oFilteredRow.Models,
                "| SnapshotIndex:", oFilteredRow._snapshotIndex,
                "| Changed:", bChanged
            );

            if (bChanged) {
                aChangedRows.push({
                    oRow:         oFilteredRow,
                    oOriginalRow: oOriginalRow
                });
            }
        });

        if (aChangedRows.length === 0) {
            sap.m.MessageToast.show("No changes to save");
            return;
        }

        // ✅ Split into DELETE+CREATE (key changed) vs normal PUT
        var aDeleteCreate = [];
        var aPutRows      = [];

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

        // ── Normal PUT rows (no key change) — UNCHANGED ───────────────────────
        aPutRows.forEach(function (oItem) {

            var oRow         = oItem.oRow;
            var oOriginalRow = oItem.oOriginalRow;

            // ✅ Build path using ORIGINAL Models key
            var sPath = oModel.createKey("/GMAComponentsInvalidSet", {
                FromDate: oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
                Models:   oOriginalRow ? oOriginalRow.Models   : oRow.Models
            });

            var oPayload = Object.assign({}, oRow);
            delete oPayload.__metadata;
            delete oPayload._snapshotIndex;

            Object.keys(oPayload).forEach(function (key) {
                if (key.includes("Price")) delete oPayload[key];
            });

            oPayload.Status = "SUBMITTED";
            oPayload.Mail   = oMail;

            if (oOriginalRow && oOriginalRow.FromDate) {
                oPayload.FromDate = oOriginalRow.FromDate;
            }

            console.log("Updating path:", sPath, "| Payload:", oPayload);

            oModel.update(sPath, oPayload, {
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

        // ── DELETE + CREATE rows (Models key changed) ─────────────────────────
        aDeleteCreate.forEach(function (oItem) {

            var oRow         = oItem.oRow;
            var oOriginalRow = oItem.oOriginalRow;

            // ✅ DELETE uses ORIGINAL Models + FromDate (old key)
            var sDeletePath = oModel.createKey("/GMAComponentsInvalidSet", {
                FromDate: oOriginalRow.FromDate,
                Models:   oOriginalRow.Models
            });

            // ✅ CREATE uses NEW row data (new Models key)
            var oCreateData = Object.assign({}, oRow);
            delete oCreateData.__metadata;
            delete oCreateData._snapshotIndex;

            Object.keys(oCreateData).forEach(function (key) {
                if (key.includes("Price")) delete oCreateData[key];
            });

            oCreateData.Status   = "SUBMITTED";
            oCreateData.Mail     = oMail;
            oCreateData.FromDate = oOriginalRow.FromDate;

            doDeleteCreate(sDeletePath, oCreateData, true);
        });

        return;
    }

    // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
    sap.ui.getCore().applyChanges();

    const aContexts = oTable.getBinding("rows").getContexts();

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    // ✅ FIX 1: Build snapshot lookup by OData path for key field comparison
    // because OData V2 getPendingChanges() never contains key field changes
    var mSnapshotByPath = {};
    if (that._allData) {
        that._allData.forEach(function (oSnapRow) {
            var sSnapPath = oModel.createKey("/GMAComponentsInvalidSet", {
                FromDate: oSnapRow.FromDate,
                Models:   oSnapRow.Models
            });
            mSnapshotByPath[sSnapPath.substring(1)] = oSnapRow;
        });
    }

    // ✅ Separate transient and non-transient contexts
    var aTransientContexts    = [];
    var aNonTransientContexts = [];

    aContexts.forEach(function (oContext) {
        if (oContext.isTransient()) {
            aTransientContexts.push(oContext);
        } else {
            aNonTransientContexts.push(oContext);
        }
    });

    var mPending    = oModel.getPendingChanges();
    var bHasUpdates = false;

    // ✅ FIX 2: Handle transient CREATE rows explicitly with POST
    // These must NOT go through submitChanges() which would send PUT
    aTransientContexts.forEach(function (oContext) {

        const oData = oContext.getObject();

        var oPayload = Object.assign({}, oData);

        Object.keys(oPayload).forEach(function (key) {
            if (key.includes("Price")) delete oPayload[key];
        });

        oPayload.Status = "SUBMITTED";
        oPayload.Mail   = oMail;
        delete oPayload.__metadata;
        delete oPayload._snapshotIndex;

        console.log("CREATE (transient) payload:", oPayload);

        // ✅ Delete transient context BEFORE create
        // so row is removed from table immediately
        oContext.delete();

        iPendingOperations++;

        oModel.create("/GMAComponentsInvalidSet", oPayload, {
            success: function () {
                console.log("CREATE success (transient)");
                onOperationDone(false);
            },
            error: function (oError) {
                handleError(oError, "/GMAComponentsInvalidSet", false);
            }
        });
    });

    // ✅ Handle existing rows — key change = DELETE+CREATE, else MERGE via submitChanges
    aNonTransientContexts.forEach(function (oContext) {

        const sPath = oContext.getPath();
        const sKey  = sPath.substring(1);
        const oData = oContext.getObject();

        var oPayload = Object.assign({}, oData);

        Object.keys(oPayload).forEach(function (key) {
            if (key.includes("Price")) delete oPayload[key];
        });

        if (mPending[sKey]) {

            var oPending = mPending[sKey];

            // ✅ FIX 1: Compare merged current+pending vs SNAPSHOT
            // OData V2 never puts key fields in getPendingChanges()
            var oSnapRow    = mSnapshotByPath[sKey];
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

                Object.keys(oCreateData).forEach(function (key) {
                    if (key.includes("Price")) delete oCreateData[key];
                });

                oCreateData.Status   = "SUBMITTED";
                oCreateData.Mail     = oMail;
                oCreateData.FromDate = oSnapRow.FromDate;

                // ✅ DELETE path built from SNAPSHOT original keys
                var sDeletePath = oModel.createKey("/GMAComponentsInvalidSet", {
                    FromDate: oSnapRow.FromDate,
                    Models:   oSnapRow.Models
                });

                oModel.resetChanges([sPath]);

                console.log("DELETE+CREATE → DELETE path:", sDeletePath);
                console.log("DELETE+CREATE → CREATE payload:", oCreateData);

                iPendingOperations += 2;

                doDeleteCreate(sDeletePath, oCreateData, false);

                return;
            }

            // ── Normal UPDATE → MERGE via submitChanges — UNCHANGED ───────────
            oPayload.Status = "SUBMITTED";
            delete oPayload.__metadata;

            oModel.resetChanges([sPath]);
            oModel.update(sPath, oPayload, { method: "PUT" });
            iPendingOperations++;
            bHasUpdates = true;
        }
    });

    if (iPendingOperations === 0) {
        oView.setBusy(false);
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    // ✅ FIX 3: setBusy AFTER all operations counted
    oView.setBusy(true);

    // ✅ Only attach requestCompleted and submitChanges if there are MERGE/UPDATE rows
    if (bHasUpdates) {

        function extractErrorMessage(oEvent) {
            try {
                var oResponse = oEvent.getParameter("response");
                if (oResponse && oResponse.responseText) {
                    var oBody = JSON.parse(oResponse.responseText);
                    if (oBody.error && oBody.error.message && oBody.error.message.value) {
                        return oBody.error.message.value;
                    }
                }
            } catch (e) {}
            return "An error occurred while saving. Please try again.";
        }

        function onRequestDone(oEvent) {
            var sMethod = oEvent.getParameter("method");
            if (sMethod !== "POST" && sMethod !== "MERGE") return;

            var bSuccess = oEvent.getParameter("success");
            if (!bSuccess) {
                bHasError = true;
                sap.m.MessageBox.error(extractErrorMessage(oEvent));
            }

            iPendingOperations--;

            if (iPendingOperations === 0) {
                oModel.detachEvent("requestCompleted", onRequestDone);
                oView.setBusy(false);

                if (!bHasError) {
                    sap.m.MessageToast.show("Saved successfully");
                    oTable.getBinding("rows").refresh();
                }
            }
        }

        oModel.attachEvent("requestCompleted", onRequestDone);
        oModel.submitChanges();
    }
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

            _insertIntoTable: function (aExcelData) {

                const oTable = this.byId("gmaTable"); // ✅ FIXED
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

                    oBinding.create({
                        Models: oRow["Model"] || "",
                        Description: oRow["Description"] || "",
                        MtsMto: oRow["MTS/MTO"] || "MTS",
                        ReferMtsModel: oRow["Reference Model"] || "",
                        FromDate: oRow["Effective Date"] ? new Date(oRow["Effective Date"]) : new Date(),

                        Part1: oRow["Part1"] || "",
                        Part2: oRow["Part2"] || "",
                        Part3: oRow["Part3"] || "",
                        Part4: oRow["Part4"] || "",
                        Part5: oRow["Part5"] || "",
                        Part6: oRow["Part6"] || "",
                        Part7: oRow["Part7"] || "",
                        Part8: oRow["Part8"] || "",
                        Part9: oRow["Part9"] || "",
                        Part10: oRow["Part10"] || "",

                        Part11: oRow["Part11"] || "",
                        Part12: oRow["Part12"] || "",
                        Part13: oRow["Part13"] || "",
                        Part14: oRow["Part14"] || "",
                        Part15: oRow["Part15"] || "",

                        Part16: oRow["Part16"] || "",
                        Part17: oRow["Part17"] || "",
                        Part18: oRow["Part18"] || "",
                        Part19: oRow["Part19"] || "",
                        Part20: oRow["Part20"] || "",

                        Status: "SUBMITTED"
                    });

                });
                sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
            },

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

                const oTable = this.byId("gmaTable"); // ✅ correct table
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

                // const EdmType = sap.ui.require("sap/ui/export/library").EdmType;

                const oSettings = {
                    workbook: {
                        columns: aFields.map(f => ({
                            label: f.label,
                            property: f.key,

                        }))
                    },
                    dataSource: aData,
                    fileName: "GMAComponent_Export.xlsx"
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

                const oTable = this.byId("gmaTable");
                const oBinding = oTable.getBinding("rows");

                const iLength = oBinding.getLength();
                const aData = oBinding.getContexts(0, iLength).map(c => c.getObject());

                this._exportToExcel(aData, aSelectedFields);

                this.byId("fieldSelectDialog").close();
            },

            onCancelDownload: function () {
                this.byId("fieldSelectDialog").close();
            },

            _exportToExcel: function (aData, aFields) {

                const EdmType = sap.ui.require("sap/ui/export/library").EdmType;

                const oSettings = {
                    workbook: {
                        columns: aFields.map(f => ({
                            label: f.label,
                            property: f.key,
                            type: EdmType.String
                        }))
                    },
                    dataSource: aData,
                    fileName: "GMAComponent_Export.xlsx"
                };

                const oSheet = new sap.ui.export.Spreadsheet(oSettings);
                oSheet.build().finally(() => oSheet.destroy());
            },

            onSort: function (oEvent) {

    var oColumn    = oEvent.getParameter("column");
    var sSortOrder = oEvent.getParameter("sortOrder");
    var sProperty  = oColumn.getSortProperty();
    var oTable     = this.byId("gmaTable");

    var bDescending = (sSortOrder === "Descending");

    // ✅ Get current data from OData binding
    var oBinding = oTable.getBinding("rows");
    var aContexts = oBinding.getContexts(0, oBinding.getLength());

    var aData = aContexts.map(ctx => ctx.getObject());

    // ✅ SORT MANUALLY
    aData.sort(function (a, b) {
        var sA = String(a[sProperty] || "").toLowerCase();
        var sB = String(b[sProperty] || "").toLowerCase();

        return bDescending
            ? (sA > sB ? -1 : sA < sB ? 1 : 0)
            : (sA < sB ? -1 : sA > sB ? 1 : 0);
    });

    // ✅ Put sorted data into JSONModel
    var oJSONModel = new sap.ui.model.json.JSONModel(aData);
    oTable.setModel(oJSONModel);
    oTable.bindRows("/");

    // ✅ Update UI state
    oTable.getColumns().forEach(function (col) {
        col.setSorted(false);
    });

    oColumn.setSorted(true);
    oColumn.setSortOrder(sSortOrder);
},

        });
    });

