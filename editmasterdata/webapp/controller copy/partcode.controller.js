sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.partcode", {
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

                const oTable = this.byId("partMasterTable");

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
                    path: "/PartsSet",
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

                //this._bCreateInProgress = false;

            },

                        _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                // Master copy — never mutate directly
                this._allData = aData;

                // Switch table to JSON model for client-side filtering/creation
                this.byId("partMasterTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("partMasterTable").bindRows("/");

                // Build filter dropdowns from actual loaded data
                this._buildFilterDropdowns(this._allData);
            },

           

_buildFilterDropdowns: function (aData) {

    const familySet = new Set();
    const partSet = new Set();

    aData.forEach(function (oRow) {
        if (oRow.Family) familySet.add(oRow.Family);
        if (oRow.PartCode) partSet.add(oRow.PartCode);
    });

    const aFamily = [...familySet].map(f => ({ Family: f }));
    const aPartCode = [...partSet].map(p => ({ PartCode: p }));

    this.getView().setModel(
        new sap.ui.model.json.JSONModel({
            Family: aFamily,
            PartCode: aPartCode
        }),
        "filter"
    );
},

            

            onApplyFilter: function () {

                const aFamilyCodes  = this.byId("filterModelCode").getSelectedKeys();
                const aPartCode = this.byId("filterEngineType").getSelectedKeys();

                // Separate new (unsaved) rows — keep them always visible
                const aNewRows     = (this._allData || []).filter(function (r) { return r._isNew; });
                let   aFiltered    = (this._allData || []).filter(function (r) { return !r._isNew; });

                if (aFamilyCodes.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aFamilyCodes.indexOf(oRow.Family) !== -1;
                    });
                }

                if (aPartCode.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aPartCode.indexOf(oRow.PartCode) !== -1;
                    });
                }

              

                // New rows always stay on top
                this.byId("partMasterTable").setModel(
                    new sap.ui.model.json.JSONModel(aNewRows.concat(aFiltered))
                );
                this.byId("partMasterTable").bindRows("/");
            },

            

            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();
                this.byId("filterEngineType").removeAllSelectedItems();

                this.byId("partMasterTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData || [])
                );
                this.byId("partMasterTable").bindRows("/");
            },



             onCreateMasterRow: function () {
                console.log("HI");

   const oVm = this.getView().getModel('viewModel');

    const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("partMasterTable");
                var oBinding = oTable.getBinding("rows");

                oBinding.create({
                    OperationNo: 0,
                    Family: "",
                    PartCode: "",
                    Mail: oMail,
                    PartDescr: "",
                    OeGma: "OE",
                    MiyCost:"0.000",
                    MiyMarkup: "0.000",
                    ExShowOnRoad: "EX SHOWROOM",
                    Mrp: "0.000",
                    MiyCostPerc: "0.000",
                    MiyMarkupPerc:"0.000",
                    Status: "SUBMITTED"
                });
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

onSubmit: function () {

    var oModel = this.getView().getModel();
    var oTable = this.byId("partMasterTable");
    var aContexts = oTable.getBinding("rows").getContexts();
    var oView = this.getView();

   




    // ================= REQUIRED FIELD VALIDATION =================  <-- ADD HERE
    var aMissingFields = [];

    aContexts.forEach(function (oContext) {
        if (oContext.isTransient()) {
            var oData = oContext.getObject();
            if (!oData.Family || oData.Family.trim() === "") {
                aMissingFields.push("Material Group");
            }
            if (!oData.PartCode || oData.PartCode.trim() === "") {
                aMissingFields.push("Part Code");
            }
        }
    });

    if (aMissingFields.length > 0) {
        var aUnique = aMissingFields.filter(function (item, index) {
            return aMissingFields.indexOf(item) === index;
        });
        sap.m.MessageBox.error(
            "Please fill in the required fields: " + aUnique.join(", ")
        );
        return;
    }

    //===============//

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }


    

    var mPending = oModel.getPendingChanges();
    var bHasChanges = false;
    var iPendingOperations = 0;
    var bHasError = false; // 🔥 track if any request failed

    aContexts.forEach(function (oContext) {
        var sPath = oContext.getPath();
        var sKey  = sPath.substring(1);
        var oData = oContext.getObject();

        if (oContext.isTransient()) {
            oData.Status = "SUBMITTED";
            iPendingOperations++;
            bHasChanges = true;
            return;
        }

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

    

    var that = this;
    var iTotalOperations = iPendingOperations; // 🔥 store total count separately

    oView.setBusy(true);

    // Helper to extract backend error message
    function extractErrorMessage(oEvent) {
        try {
            var oResponse = oEvent.getParameter("response");
            if (oResponse && oResponse.responseText) {
                var oBody = JSON.parse(oResponse.responseText);
                if (oBody.error && oBody.error.message && oBody.error.message.value) {
                    return oBody.error.message.value;
                }
            }
        } catch (e) {
            // JSON parse failed
        }
        return "An error occurred while saving. Please try again.";
    }

    //  Unified handler for both success and failure
    function onRequestDone(oEvent) {
        var sMethod = oEvent.getParameter("method");

        if (sMethod !== "POST" && sMethod !== "PUT") return;

        // Check if this specific request failed
        var bSuccess = oEvent.getParameter("success");
        if (!bSuccess) {
            bHasError = true;
            var sErrorMsg = extractErrorMessage(oEvent);
            sap.m.MessageBox.error(sErrorMsg); // 🔥 Show backend error message
        }

        iPendingOperations--;

        if (iPendingOperations === 0) {
            oModel.detachEvent("requestCompleted", onRequestDone);
            oView.setBusy(false);

            if (!bHasError) {
                sap.m.MessageToast.show("Saved successfully");
                that.byId("partMasterTable").getBinding("rows").refresh();
            } else {
                // Refresh anyway to reset state, or optionally skip
                that.byId("partMasterTable").getBinding("rows").refresh();
            }
        }
    }

    oModel.attachEvent("requestCompleted", onRequestDone);
    oModel.submitChanges();
}
    });
    }
  );
  