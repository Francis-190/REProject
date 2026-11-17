sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
    ],
    function(BaseController, Spreadsheet, library) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.Rtoexpensehistory", {
      
            onInit: async function () {
                const oVM = new sap.ui.model.json.JSONModel({});
                this.getView().setModel(oVM, "viewModel");

                const oModel = this.getView().getModel();

                let sAsmName = "Anad Kumar";
                let sASMMail = "siva.durairaj@laderatechnology.com"


                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sAsmName = oUserInfo.getFullName();
                    sASMMail = oUserInfo.getEmail();
                }
                sAsmName = sAsmName.toUpperCase();

                oVM.setProperty("/ASMEmail", sASMMail);
                //  oVM.setProperty("/AspEmail", oUserInfo.getEmail());

                //  console.log("ASP Logged User:",
                //                     oUserInfo.getId(),
                //                     oUserInfo.getFullName(),
                //                     oUserInfo.getEmail(),
                //                     oUserInfo.getFirstName()
                //                 );

                const oTable = this.byId("RtoExpenceTable");

                // oTable.bindRows({
                //     path: "/PricingComponentsSet",
                //     filters: [
                //         new sap.ui.model.Filter(
                //             "sASMMail",
                //             sap.ui.model.FilterOperator.EQ,
                //             sASMMail
                //         )
                //     ]
                // });

          oTable.bindRows({   
     path: "/RTOExpenseInvalidSet",
        filters: [
            new sap.ui.model.Filter("Mail", "EQ", sASMMail)
        ],
        events: {
            dataReceived: function (oEvent) {

                console.log("DATA RECEIVED ✅");

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                console.log("Dropdown Data:", aData);

                if (!aData.length) return;
                    this._allData = aData;

                this._buildFilterDropdowns(aData);

            }.bind(this)
        }
    });
                //this._bCreateInProgress = false;

            },

               onRowsUpdated: function () {
                this._applyRowColors();
            },
            _applyRowColors: function () {
                var oTable = this.byId("RtoExpenceTable");
                if (!oTable) return;

                var oToday = new Date();
                oToday.setHours(0, 0, 0, 0);

                oTable.getRows().forEach(function (oRow) {
                    var oDomRef = oRow.getDomRef();
                    if (!oDomRef) return;

                    // Always remove both classes first (clean slate)
                    oDomRef.classList.remove("regionRowGreen", "regionRowRed");

                    var oContext = oRow.getBindingContext()
                        || oRow.getBindingContext(undefined);

                    if (!oContext) return;

                    var sFromDate = oContext.getProperty("FromDate");
                    if (!sFromDate) return;

                    var oDate = sFromDate instanceof Date
                        ? new Date(sFromDate.getTime())
                        : new Date(sFromDate);

                    if (isNaN(oDate.getTime())) return;

                    oDate.setHours(0, 0, 0, 0);

                    if (oDate >= oToday) {
                        oDomRef.classList.add("regionRowGreen");
                    } else {
                        oDomRef.classList.add("regionRowRed");
                    }
                });
            },

            formatDate: function(vDate) {
    if (!vDate) return "";
    if (typeof vDate === "string") return vDate.substring(0, 10);
    if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
    return "";
},

formatRowHighlight: function (sFromDate) {
    if (!sFromDate) return "None";

    var oDate;

    // Handle OData /Date(...)/ format
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

    const aRegions   = [];
    const seenRegion = {};

    aData.forEach(function (oRow) {
        if (oRow.RegionCode && !seenRegion[oRow.RegionCode]) {
            seenRegion[oRow.RegionCode] = true;
            aRegions.push({
                RegionCode: oRow.RegionCode,
                Display:    oRow.RegionCode
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

    let aFiltered = this._allData || [];

    if (aRegions.length) {
        aFiltered = aFiltered.filter(o => aRegions.includes(o.RegionCode));
    }

    this._isFiltered = true;

    const oTable = this.byId("RtoExpenceTable");

    // ✅ Deep clone — prevents edits in the table from mutating _allData
    oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
    oTable.bindRows("/");
},

onClearFilter: function () {

    this.byId("filterModelCode").removeAllSelectedItems();

    this._isFiltered = false;

    const oTable = this.byId("RtoExpenceTable");

    oTable.setModel(this.getView().getModel());
    oTable.bindRows({
        path: "/RTOExpenseInvalidSet",
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
            oCtx.delete();   // removes created draft row
        }

    });

    if (oModel.hasPendingChanges()) {
        oModel.resetChanges();
    }

    oBinding.refresh();
},

            onNavBack: function () {

                  this._clearDraftRows();

                 const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("History", {}, true);
            },

            onCreateMasterRow: function () {

                const oVm = this.getView().getModel('viewModel');

    const oMail = oVm.getProperty("/ASMEmail");

    console.log(oMail);

                console.log("HI");

                var oTable = this.byId("RtoExpenceTable");
                var oBinding = oTable.getBinding("rows");
                oBinding.create({
                    
                    RegionCode: "",
                    Slab: 0,
                    EngineType:"EV",
                    MinRange:"0.000",
                    MaxRange: "0.000",
                    Expense:"0.000",
                    Mail:oMail,
                    FromDate:new Date(),
                    Status: "SUBMITTED",
                    });

            },





onSubmit: function () {

    const oVm   = this.getView().getModel("viewModel");
    const oMail = oVm.getProperty("/ASMEmail");

    console.log(oMail);

    var oModel = this.getView().getModel();
    var oTable = this.byId("RtoExpenceTable");
    var oView  = this.getView();
    var that   = this;

    // ─── FILTERED FLOW ───────────────────────────────────────────────────────
  if (this._isFiltered) {

    var oTableModel      = oTable.getModel();
    var aFilteredData    = oTableModel.getProperty("/") || [];
    var aOriginalSnapshot = that._allData ? that._allData.slice() : [];

    var bHasError          = false;
    var iPendingOperations = 0;

    // ── Fields to EXCLUDE from change comparison ──────────────────────
    // Exclude FromDate because it changes format after JSON clone
    // Exclude __metadata, Status (we always set these on submit)
    var aIgnoreKeys = ["__metadata", "Status", "FromDate"];

    // ── Step 1: collect only genuinely changed rows ───────────────────
    var aChangedRows = [];

    aFilteredData.forEach(function (oFilteredRow) {

        var oOriginalRow = aOriginalSnapshot.find(function (o) {
            return o.RegionCode === oFilteredRow.RegionCode &&
                   String(o.Slab) === String(oFilteredRow.Slab);
        });

        var bChanged = false;

        if (oOriginalRow) {
            var aKeys = Object.keys(oFilteredRow).filter(function (k) {
                return aIgnoreKeys.indexOf(k) === -1;
            });
            bChanged = aKeys.some(function (k) {
                return String(oFilteredRow[k]) !== String(oOriginalRow[k]);
            });
        }

        console.log(
            "Row → RegionCode:", oFilteredRow.RegionCode,
            "| Slab:", oFilteredRow.Slab,
            "| Changed:", bChanged
        );

        if (bChanged) {
            aChangedRows.push(oFilteredRow);
        }
    });

    // ── Step 2: nothing changed ───────────────────────────────────────
    if (aChangedRows.length === 0) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    // ── Step 3: fire PUT only for changed rows ────────────────────────
    oView.setBusy(true);
    iPendingOperations = aChangedRows.length;

    aChangedRows.forEach(function (oRow) {

        // ✅ Get FromDate from _allData original row (correct OData format)
        var oOriginalRow = aOriginalSnapshot.find(function (o) {
            return o.RegionCode === oRow.RegionCode &&
                   String(o.Slab) === String(oRow.Slab);
        });

        // ✅ Build key using original FromDate (not the cloned ISO string)
        var sPath = oModel.createKey("/RTOExpenseInvalidSet", {
            FromDate:   oOriginalRow ? oOriginalRow.FromDate : oRow.FromDate,
            RegionCode: oRow.RegionCode,
            Slab:       oRow.Slab
        });

        var oData      = Object.assign({}, oRow);
        delete oData.__metadata;
        oData.Status   = "SUBMITTED";
        oData.Mail     = oMail;

        // ✅ Use original FromDate in the payload too (correct format for OData)
        if (oOriginalRow && oOriginalRow.FromDate) {
            oData.FromDate = oOriginalRow.FromDate;
        }

        console.log("Updating path:", sPath, "| Data:", oData);

        oModel.update(sPath, oData, {
            merge: false,

            success: function () {
                console.log("PUT success:", sPath);
                iPendingOperations--;

                if (iPendingOperations === 0) {
                    oView.setBusy(false);
                    if (!bHasError) {
                        sap.m.MessageToast.show("Saved successfully");
                    }
                    that.onClearFilter();
                }
            },

            error: function (oError) {
                console.error("PUT failed:", sPath, oError);
                bHasError = true;
                iPendingOperations--;
                oView.setBusy(false);

                var sMessage = "An error occurred while saving. Please try again.";
                try {
                    var oBody = JSON.parse(oError.responseText);
                    if (oBody.error && oBody.error.message && oBody.error.message.value) {
                        sMessage = oBody.error.message.value;
                    }
                } catch (e) {}

                sap.m.MessageBox.error(sMessage);
            }
        });
    });

    return;
}

    // ─── NORMAL (UNFILTERED) FLOW ─────────────────────────────────────────────
    var aContexts = oTable.getBinding("rows").getContexts();

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var mPending           = oModel.getPendingChanges();
    var bHasChanges        = false;
    var iPendingOperations = 0;
    var bHasError          = false;

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var sKey  = sPath.substring(1);
        var oData = oContext.getObject();

        // CREATE → POST
        if (oContext.isTransient()) {
            oData.Status = "SUBMITTED";
            oData.Mail   = oMail;
            iPendingOperations++;
            bHasChanges = true;
            return;
        }

        // UPDATE → PUT
        if (mPending[sKey]) {
            oModel.resetChanges([sPath]);
            oData.Status = "SUBMITTED";
            oModel.update(sPath, oData, { merge: false });
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
        } catch (e) {}
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

            // Refresh table regardless of success/error
            that.byId("RtoExpenceTable").getBinding("rows").refresh();

            if (!bHasError) {
                sap.m.MessageToast.show("Saved successfully");
            }
        }
    }

    oModel.attachEvent("requestCompleted", onRequestDone);
    oModel.submitChanges();
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

    oBinding.create({
        RegionCode: oRow["Region"] || "",
        EngineType: oRow["Engine Type"] || "EV",

        Slab: oRow["Slab"] || "0",
        MinRange: oRow["Min Range"] || "0",
        MaxRange: oRow["Max Range"] || "0",
        Expense: oRow["Expense"] || "0",

        FromDate: new Date(),
        Status: "SUBMITTED"
    });


    });

    sap.m.MessageToast.show("Upload successful: " + aExcelData.length + " rows");
},

_getAllFields: function () {
    return [
        { key: "RegionCode", label: "Region" },
        { key: "EngineType", label: "Engine Type" },
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

    // const EdmType = sap.ui.require("sap/ui/export/library").EdmType;

    const oSettings = {
        workbook: {
            columns: aFields.map(f => ({
                label: f.label,
                property: f.key,
                
            }))
        },
        dataSource: aData,
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
        fileName: "RTOExpense_Export.xlsx"
    };

    const oSheet = new sap.ui.export.Spreadsheet(oSettings);
    oSheet.build().finally(() => oSheet.destroy());
}

 
      });
    }
  );
  