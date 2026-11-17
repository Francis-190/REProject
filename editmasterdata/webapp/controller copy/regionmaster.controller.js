sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet"
    ],
    function (BaseController,Spreadsheet) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.regionmaster", {
          
            onInit: async function () {
                const oVM = new sap.ui.model.json.JSONModel({});
                this.getView().setModel(oVM, "viewModel");

                const oModel = this.getView().getModel();

                let sAsmName = "Anad Kumar";
               let sASMMail = "siva.durairaj@laderatechnology.com"
                //let sASMMail = "anandkumar.n@laderatechnology.com"


                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sAsmName = oUserInfo.getFullName();
                    sASMMail = oUserInfo.getEmail();
                }
                sAsmName = sAsmName.toUpperCase();

                oVM.setProperty("/ASMEmail", sASMMail);
               

                const oTable = this.byId("regionTables");

                
                oTable.bindRows({
                    path: "/RegionMasterSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail", // exact CDS name
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: sASMMail
                        })
                    ],
                    events: {
                        dataReceived: this._onDataReceived.bind(this)
                    }
                });

                var oView = this.getView();

    var oPopover = this.byId("excelPopover");

    if (oPopover) {
        oView.addDependent(oPopover);
    }

                //this._bCreateInProgress = false;

            },

            //             _onDataReceived: function (oEvent) {

            //     const oData = oEvent.getParameter("data");
            //     const aData = (oData && oData.results) ? oData.results : [];

            //     // Master copy — never mutate directly
            //     this._allData = aData;

            //     // Switch table to JSON model for client-side filtering/creation
            //     this.byId("regionTables").setModel(
            //         new sap.ui.model.json.JSONModel(this._allData)
            //     );
            //     this.byId("regionTables").bindRows("/");

            //     // Build filter dropdowns from actual loaded data
            //     this._buildFilterDropdowns(this._allData);
            // },



           _onDataReceived: function (oEvent) {

    const oData = oEvent.getParameter("data");
    const aData = (oData && oData.results) ? oData.results : [];

    // ✅ Add _snapshotIndex to each row for change tracking
    this._allData = aData.map(function (oRow, i) {
        oRow._snapshotIndex = i;
        return oRow;
    });

    this.byId("regionTables").setModel(
        new sap.ui.model.json.JSONModel(this._allData)
    );
    this.byId("regionTables").bindRows("/");

    this._buildFilterDropdowns(this._allData);
},

            _buildFilterDropdowns: function (aData) {

                const aRegion     = [];
                const aEngineType = [];
                const seenModel   = {};
                const seenEngine  = {};

                aData.forEach(function (oRow) {

                    if (oRow.Region && !seenModel[oRow.Region]) {
                        seenModel[oRow.Region] = true;
                        aRegion.push({
                            Region: oRow.Region
                        });
                    }

                    if (oRow.EngineType && !seenEngine[oRow.EngineType]) {
                        seenEngine[oRow.EngineType] = true;
                        aEngineType.push({ Type: oRow.EngineType });
                    }

                    
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        Region:     aRegion,
                        EngineType: aEngineType
                    }),
                    "filter"
                );
            },

            

            onApplyFilter: function () {

                const aModelCodes  = this.byId("filterModelCode").getSelectedKeys();
                const aEngineTypes = this.byId("filterEngineType").getSelectedKeys();

                // Separate new (unsaved) rows — keep them always visible
                const aNewRows     = (this._allData || []).filter(function (r) { return r._isNew; });
                let   aFiltered    = (this._allData || []).filter(function (r) { return !r._isNew; });

                if (aModelCodes.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aModelCodes.indexOf(oRow.Region) !== -1;
                    });
                }

                if (aEngineTypes.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aEngineTypes.indexOf(oRow.EngineType) !== -1;
                    });
                }

                

                // New rows always stay on top
                this.byId("regionTables").setModel(
                    new sap.ui.model.json.JSONModel(aNewRows.concat(aFiltered))
                );
                this.byId("regionTables").bindRows("/");
            },

            /* ══════════════════════════════════════════════
               FILTER — CLEAR  (pure client-side)
            ══════════════════════════════════════════════ */

            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();
                this.byId("filterEngineType").removeAllSelectedItems();

                this.byId("regionTables").setModel(
                    new sap.ui.model.json.JSONModel(this._allData || [])
                );
                this.byId("regionTables").bindRows("/");
            },

            onNavBack: function () {

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

                var oTable = this.byId("regionTables");
                var oBinding = oTable.getBinding("rows");
                const oNewRow = {
                    _isNew: true,
                    
                    Region: "",
                    EngineType:"EV",
                    OperationNo:0,
                    Ort01: "",
                    Spras:"EN",
                    Mail:oMail,
                    BasisRto: "EXSHOWROOM",
                    Status: "SUBMITTED",
                    }

                    this._allData.unshift(oNewRow);

                this.byId("regionTables").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("regionTables").bindRows("/");

            },



// onSubmit: function () {

//     const oVm = this.getView().getModel("viewModel");
//     const oMail = oVm.getProperty("/ASMEmail");

//     const oModel = this.getView().getModel();
//     const oTable = this.byId("regionTables");
//     const aContexts = oTable.getBinding("rows").getContexts();
//     const oView = this.getView();

//     if (!oModel.hasPendingChanges()) {
//         sap.m.MessageToast.show("No changes to save");
//         return;
//     }

//     var mPending = oModel.getPendingChanges();
//     var iPendingOperations = 0;

//     oView.setBusy(true);

//     aContexts.forEach(function (oContext) {

//         var sPath = oContext.getPath();
//         var sKey  = sPath.substring(1);
//         var oData = oContext.getObject();

//         //  REMOVE Price fields directly from binding object
//         Object.keys(oData).forEach(function (key) {
//             if (key.includes("Price")) {
//                 delete oData[key];
//             }
//         });

//         // ================= CREATE =================
//         if (oContext.isTransient()) {

//             oData.Status = "SUBMITTED";
//             oData.Mail = oMail;

//             iPendingOperations++;
//             return;
//         }

//         // ================= UPDATE (FORCE PUT) =================
//         if (mPending[sKey]) {

//             oModel.resetChanges([sPath]);

//             oData.Status = "SUBMITTED";

//             oModel.update(sPath, oData, {
//                 merge: false
//             });

//             iPendingOperations++;
//         }

//     });

//     // 🔥 Helper to extract backend error message
//     function extractErrorMessage(oEvent) {
//         try {
//             var oResponse = oEvent.getParameter("response");
//             if (oResponse && oResponse.responseText) {
//                 var oBody = JSON.parse(oResponse.responseText);
//                 if (oBody.error && oBody.error.message && oBody.error.message.value) {
//                     return oBody.error.message.value;
//                 }
//             }
//         } catch (e) {
//             // JSON parse failed
//         }
//         return "An error occurred while saving. Please try again.";
//     }

//     var bHasError = false;
//     var that = this;

//     // 🔥 requestCompleted instead of submitChanges success/error
//     function onRequestDone(oEvent) {
//         var sMethod = oEvent.getParameter("method");

//         if (sMethod !== "POST" && sMethod !== "PUT") return;

//         var bSuccess = oEvent.getParameter("success");
//         if (!bSuccess) {
//             bHasError = true;
//             var sErrorMsg = extractErrorMessage(oEvent);
//             sap.m.MessageBox.error(sErrorMsg);
//         }

//         iPendingOperations--;

//         if (iPendingOperations === 0) {
//             oModel.detachEvent("requestCompleted", onRequestDone);
//             oView.setBusy(false);

//             if (!bHasError) {
//                 sap.m.MessageToast.show("Saved successfully");
//             }

//             oTable.getBinding("rows").refresh();
//         }
//     }

//     oModel.attachEvent("requestCompleted", onRequestDone);
//     oModel.submitChanges();
// },

onSubmit: function () {

    const oVm    = this.getView().getModel("viewModel");
    const oMail  = oVm.getProperty("/ASMEmail");
    const oModel = this.getView().getModel();
    const oTable = this.byId("regionTables");
    const oView  = this.getView();
    const that   = this;

    var bHasError          = false;
    var iPendingOperations = 0;

    // ─── Key fields for this entity ───────────────────────────────────────────
    var aKeyFields = ["Region", "EngineType"];

    function handleError(oError, sPath) {
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
        onOperationDone();
    }

    function onOperationDone() {
        iPendingOperations--;
        if (iPendingOperations === 0) {
            oView.setBusy(false);
            if (!bHasError) {
                sap.m.MessageToast.show("Saved successfully");
            }
            // ✅ Rebind to OData to refresh from backend
            oTable.bindRows({
                path: "/RegionMasterSet",
                filters: [
                    new sap.ui.model.Filter("Mail", "EQ", oMail)
                ],
                events: {
                    dataReceived: that._onDataReceived.bind(that)
                }
            });
        }
    }

    // ─── Separate new rows from existing rows ─────────────────────────────────
    var aTableModel  = oTable.getModel();
    var aAllRows     = aTableModel.getProperty("/") || [];

    var aNewRows      = aAllRows.filter(function (r) { return r._isNew; });
    var aExistingRows = aAllRows.filter(function (r) { return !r._isNew; });

    // ─── Check for changes in existing rows against _allData snapshot ─────────
    var aIgnoreKeys  = ["__metadata", "Status", "_snapshotIndex", "_isNew"];
    var aChangedRows = [];

    aExistingRows.forEach(function (oRow) {

        var oOriginalRow = (that._allData || []).find(function (o) {
            return o._snapshotIndex === oRow._snapshotIndex;
        });

        if (!oOriginalRow) {
            oOriginalRow = (that._allData || []).find(function (o) {
                return o.Region     === oRow.Region &&
                       o.EngineType === oRow.EngineType;
            });
        }

        var bChanged = false;

        if (oOriginalRow) {
            var aKeys = Object.keys(oRow).filter(function (k) {
                return aIgnoreKeys.indexOf(k) === -1;
            });
            bChanged = aKeys.some(function (k) {
                return String(oRow[k]) !== String(oOriginalRow[k]);
            });
        }

        console.log(
            "Row → Region:", oRow.Region,
            "| EngineType:", oRow.EngineType,
            "| SnapshotIndex:", oRow._snapshotIndex,
            "| Changed:", bChanged
        );

        if (bChanged) {
            aChangedRows.push({
                oRow:         oRow,
                oOriginalRow: oOriginalRow
            });
        }
    });

    var bHasNewRows     = aNewRows.length > 0;
    var bHasChangedRows = aChangedRows.length > 0;

    if (!bHasNewRows && !bHasChangedRows) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    oView.setBusy(true);

    // ─── Submit changed existing rows via PUT ─────────────────────────────────
    aChangedRows.forEach(function (oItem) {

        var oRow         = oItem.oRow;
        var oOriginalRow = oItem.oOriginalRow;

        var sPath = oModel.createKey("/RegionMasterSet", {
            Region:     oOriginalRow.Region,
            EngineType: oOriginalRow.EngineType
        });

        var oPutData = Object.assign({}, oRow);
        delete oPutData.__metadata;
        delete oPutData._snapshotIndex;
        delete oPutData._isNew;

        // Remove any Price fields
        Object.keys(oPutData).forEach(function (key) {
            if (key.includes("Price")) delete oPutData[key];
        });

        oPutData.Status = "SUBMITTED";
        oPutData.Mail   = oMail;

        console.log("PUT path:", sPath, "| Data:", oPutData);

        iPendingOperations++;

        oModel.update(sPath, oPutData, {
            merge: false,
            success: function () {
                console.log("PUT success:", sPath);
                onOperationDone();
            },
            error: function (oError) {
                handleError(oError, sPath);
            }
        });
    });

    // ─── Submit new rows via chunked batch ────────────────────────────────────
    if (bHasNewRows) {

        var aPayloads = aNewRows.map(function (oRow) {

            var oPayload = Object.assign({}, oRow);
            delete oPayload.__metadata;
            delete oPayload._snapshotIndex;
            delete oPayload._isNew;

            // Remove any Price fields
            Object.keys(oPayload).forEach(function (key) {
                if (key.includes("Price")) delete oPayload[key];
            });

            oPayload.Status = "SUBMITTED";
            oPayload.Mail   = oMail;

            return oPayload;
        });

        // ✅ _submitInChunks manages its own busy + refresh
        // so only setBusy for PUT operations above
        if (!bHasChangedRows) {
            oView.setBusy(false); // _submitInChunks will set it again
        }

        that._submitInChunks(aPayloads, 500);
    }
},

_chunkArray: function (aArray, iSize) {
    var aChunks = [];
    for (var i = 0; i < aArray.length; i += iSize) {
        aChunks.push(aArray.slice(i, i + iSize));
    }
    return aChunks;
},

_submitInChunks: function (aAllRows, iChunkSize) {
    var that        = this;
    var aChunks     = this._chunkArray(aAllRows, iChunkSize || 500);
    var iTotal      = aAllRows.length;
    var iSubmitted  = 0;
    var iChunkIndex = 0;
    var oView       = this.getView();
    var oModel      = this.getView().getModel();
    var oVm         = this.getView().getModel("viewModel");
    var sMail       = oVm.getProperty("/ASMEmail");

    oView.setBusy(true);

    function submitNextChunk() {
        if (iChunkIndex >= aChunks.length) {
            oView.setBusy(false);
            sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " rows saved successfully.");

            // ✅ Rebind to OData so saved rows load fresh from backend
            var oTable = that.byId("regionTables");
            oTable.bindRows({
                path: "/RegionMasterSet",
                filters: [
                    new sap.ui.model.Filter("Mail", "EQ", sMail)
                ],
                events: {
                    dataReceived: that._onDataReceived.bind(that)
                }
            });

            return;
        }

        var aChunk   = aChunks[iChunkIndex];
        var sGroupId = "chunkGroup_" + iChunkIndex;

        console.log("Submitting chunk", iChunkIndex + 1, "of", aChunks.length, "→", aChunk.length, "rows");

        var aDeferred = oModel.getDeferredGroups();
        if (aDeferred.indexOf(sGroupId) === -1) {
            oModel.setDeferredGroups(aDeferred.concat([sGroupId]));
        }

        aChunk.forEach(function (oCreateData) {
            oModel.create("/RegionMasterSet", oCreateData, {
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
                } catch (e) {}

                sap.m.MessageBox.error(
                    sMessage + ". " + iSubmitted + " of " + iTotal + " rows were already saved."
                );
            }
        });
    }

    submitNextChunk();
},

onExcelMenuPress: function (oEvent) {

    var oButton = oEvent.getSource();
    var oPopover = this.byId("excelPopover");

    if (!oPopover.isOpen()) {
        oPopover.openBy(oButton);
    } else {
        oPopover.close();
    }
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

// _handleExcelFile: function (oFile) {
//     if (!oFile) return;

//     const sExt = oFile.name.split(".").pop().toLowerCase();
//     if (!["xlsx", "xls", "csv"].includes(sExt)) {
//         sap.m.MessageToast.show("Please upload a valid Excel or CSV file");
//         return;
//     }

//     const oVm    = this.getView().getModel("viewModel");  // ✅ correct model name
//     const oModel = this.getView().getModel();
//     const oTable = this.byId("regionTables");
//     const oBinding = oTable.getBinding("rows");

//     const oReader = new FileReader();

//     oReader.onload = (e) => {
//         try {
//             let aData = [];

//             if (sExt === "csv") {
//                 const sText   = e.target.result;
//                 const aLines  = sText.split(/\r?\n/).filter(l => l.trim());
//                 if (!aLines.length) { sap.m.MessageToast.show("File is empty"); return; }

//                 const aHeaders = aLines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
//                 aData = aLines.slice(1).map(sLine => {
//                     const aVals = sLine.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
//                     const oRow  = {};
//                     aHeaders.forEach((h, i) => { oRow[h] = aVals[i] ?? ""; });
//                     return oRow;
//                 });
//             } else {
//                 const XLSX = window.XLSX;
//                 if (!XLSX) {
//                     sap.m.MessageBox.error("XLSX library not available.");
//                     return;
//                 }
//                 const oWorkbook   = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
//                 const sFirstSheet = oWorkbook.SheetNames[0];
//                 aData = XLSX.utils.sheet_to_json(oWorkbook.Sheets[sFirstSheet], {
//                     defval: "",
//                     raw: false
//                 });
//             }

//             if (!aData.length) {
//                 sap.m.MessageToast.show("No data rows found in the file");
//                 return;
//             }

//             const oMail = oVm.getProperty("/ASMEmail");
//             let iCreated = 0;

//             aData.forEach(oRow => {
//                 const sRegion   = oRow["Region"]        || oRow["REGION"]        || "";
//                 const sOrt01    = oRow["Description"]   || oRow["DESCRIPTION"]   || oRow["Ort01"] || "";
//                 const sSpras    = oRow["Language"]      || oRow["LANGUAGE"]      || oRow["Spras"] || "EN";
//                 const sBasisRto = oRow["Basis for RTO"] || oRow["Basis for RTO"]      || oRow["Basis"] || "";

//                 if (!sRegion) return; // skip empty region rows

//                 oBinding.create({
//                     Region:      sRegion,
//                     OperationNo: 0,
//                     Ort01:       sOrt01,
//                     Spras:       sSpras,
//                     Mail:        oMail,
//                     BasisRto:    sBasisRto,
//                     Status:      "SUBMITTED"
//                 });

//                 iCreated++;
//             });

//             sap.m.MessageToast.show(iCreated + " row(s) loaded from " + oFile.name);

//         } catch (ex) {
//             console.error("Excel parse error:", ex);
//             sap.m.MessageBox.error("Failed to parse the file: " + (ex.message || "Unknown error"));
//         }
//     };

//     if (sExt === "csv") {
//         oReader.readAsText(oFile);
//     } else {
//         oReader.readAsArrayBuffer(oFile);
//     }
// },

_handleExcelFile: function (oFile) {
    if (!oFile) return;

    const sExt = oFile.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(sExt)) {
        sap.m.MessageToast.show("Please upload a valid Excel or CSV file");
        return;
    }

    const oVm  = this.getView().getModel("viewModel");
    const oTable   = this.byId("regionTables");

    const oReader = new FileReader();

    oReader.onload = (e) => {
        try {
            let aData = [];

            if (sExt === "csv") {
                const sText    = e.target.result;
                const aLines   = sText.split(/\r?\n/).filter(l => l.trim());
                if (!aLines.length) { sap.m.MessageToast.show("File is empty"); return; }

                const aHeaders = aLines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
                aData = aLines.slice(1).map(sLine => {
                    const aVals = sLine.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
                    const oRow  = {};
                    aHeaders.forEach((h, i) => { oRow[h] = aVals[i] ?? ""; });
                    return oRow;
                });
            } else {
                const XLSX = window.XLSX;
                if (!XLSX) { sap.m.MessageBox.error("XLSX library not available."); return; }
                const oWorkbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
                aData = XLSX.utils.sheet_to_json(
                    oWorkbook.Sheets[oWorkbook.SheetNames[0]],
                    { defval: "", raw: false }
                );
            }

            if (!aData.length) {
                sap.m.MessageToast.show("No data rows found in the file");
                return;
            }

            const oMail   = oVm.getProperty("/ASMEmail");
            let   iCreated = 0;

            // ✅ Use _allData.unshift — same pattern as onCreateMasterRow
            aData.forEach(oRow => {
                const sRegion   = oRow["Region"]        || oRow["REGION"]        || "";
                const sOrt01    = oRow["Description"]   || oRow["DESCRIPTION"]   || oRow["Ort01"] || "";
                const sSpras    = oRow["Language"]      || oRow["LANGUAGE"]      || oRow["Spras"] || "EN";
                const sBasisRto = oRow["Basis for RTO"] || oRow["Basis"]         || oRow["BasisRto"] || "";
                const sEngine   = oRow["Engine Type"]   || oRow["EngineType"]    || "EV";

                if (!sRegion) return; // skip empty rows

                // ✅ Push as _isNew row into _allData — same as manual create
                this._allData.unshift({
                    _isNew:      true,
                    Region:      sRegion,
                    EngineType:  sEngine,
                    OperationNo: 0,
                    Ort01:       sOrt01,
                    Spras:       sSpras,
                    Mail:        oMail,
                    BasisRto:    sBasisRto,
                    Status:      "SUBMITTED"
                });

                iCreated++;
            });

            // ✅ Refresh table model with updated _allData
            oTable.setModel(new sap.ui.model.json.JSONModel(this._allData));
            oTable.bindRows("/");

            sap.m.MessageToast.show(iCreated + " rows loaded. Click Submit to save.");

        } catch (ex) {
            console.error("Excel parse error:", ex);
            sap.m.MessageBox.error("Failed to parse the file: " + (ex.message || "Unknown error"));
        }
    };

    sExt === "csv" ? oReader.readAsText(oFile) : oReader.readAsArrayBuffer(oFile);
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
    // var aData = oBinding.getModel().getProperty("/RegionMasterSet");

    var aContexts = oBinding.getContexts();

var aData = aContexts.map(function (oContext) {
    return oContext.getObject();
});

    var oList = this.byId("fieldList");
    var aSelectedItems = oList.getSelectedItems();

    if (aSelectedItems.length === 0) {
        sap.m.MessageToast.show("Select at least one field");
        return;
    }

    var aColumns = [];

    var propertyMap = {
        "Region": "Region",
        "Description": "Ort01",
        "Language": "Spras",
        "Basis for RTO": "BasisRto"
    };

    aSelectedItems.forEach(function (item) {

        var sTitle = item.getTitle();

        aColumns.push({
            label: sTitle,
            property: propertyMap[sTitle]
        });

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
}

        });
    }
);
                                                                                                                                                                                                                                                                            
