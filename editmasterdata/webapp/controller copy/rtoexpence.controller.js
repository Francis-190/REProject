sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.rtoexpence", {
      
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
                    path: "/RTOExpenseSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail", // exact CDS name
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: sASMMail
                        })
                    ],
                    events: {
                        dataReceived: this._onDataReceived.bind(this),
                        
                    }
                });

                //this._bCreateInProgress = false;

            },

            
            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                this._allData = aData;

                this.byId("RtoExpenceTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("RtoExpenceTable").bindRows("/");

                this._buildFilterDropdowns(this._allData);
            },



            _buildFilterDropdowns: function (aData) {

                const  aRegionCodes = new Set();

                aData.forEach(function (oRow) {
                    if (oRow.RegionCode) aRegionCodes.add(oRow.RegionCode);
                    
                });

                const aRegionCode = [...aRegionCodes].map(f => ({ RegionCode: f }));
        

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        RegionCode: aRegionCode
                                        }),
                    "filter"
                );
            },



            onApplyFilter: function () {

                const aFamilyCodes = this.byId("filterModelCode").getSelectedKeys();

                const aNewRows = (this._allData || []).filter(function (r) { return r._isNew; });
                let aFiltered = (this._allData || []).filter(function (r) { return !r._isNew; });

                if (aFamilyCodes.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aFamilyCodes.indexOf(oRow.RegionCode) !== -1;
                    });
                }

              



                // New rows always stay on top
                this.byId("RtoExpenceTable").setModel(
                    new sap.ui.model.json.JSONModel(aNewRows.concat(aFiltered))
                );
                this.byId("RtoExpenceTable").bindRows("/");
            },



            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this.byId("RtoExpenceTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData || [])
                );
                this.byId("RtoExpenceTable").bindRows("/");
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
                    Status: "SUBMITTED",
                    });

            },



onSubmit: function () {

    const oVm = this.getView().getModel('viewModel');

    const oMail = oVm.getProperty("/ASMEmail");

    console.log(oMail);

    var oModel = this.getView().getModel();
    var oTable = this.byId("RtoExpenceTable");
    var aContexts = oTable.getBinding("rows").getContexts();
    var oView = this.getView();

   

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var mPending = oModel.getPendingChanges();
    var bHasChanges = false;
    var iPendingOperations = 0;
     var bHasError = false; //  counter

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var sKey  = sPath.substring(1);
        var oData = oContext.getObject();

        // CREATE → POST
        if (oContext.isTransient()) {

            oData.Status = "SUBMITTED";
            iPendingOperations++; // count POST
            bHasChanges = true;
            oData.Mail = oMail;
            return;
        }

        // UPDATE → PUT
        if (mPending[sKey]) {

            oModel.resetChanges([sPath]);

            oData.Status = "SUBMITTED";

            oModel.update(sPath, oData, {
                merge: false
            });

            iPendingOperations++; // count PUT
            bHasChanges = true;
        }

    });

    if (!bHasChanges) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var that = this;

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
                that.byId("RtoExpenceTable").getBinding("rows").refresh();
            } else {
                // Refresh anyway to reset state, or optionally skip
                that.byId("RtoExpenceTable").getBinding("rows").refresh();
            }
        }
    }

    oModel.attachEvent("requestCompleted", onRequestDone);
    oModel.submitChanges();

    //  Listen for request completion
    // oModel.attachEvent("requestCompleted", function onRequestDone(oEvent) {

    //     var sMethod = oEvent.getParameter("method");

    //     // Only track POST & PUT
    //     if (sMethod === "POST" || sMethod === "PUT") {

    //         iPendingOperations--;

    //         if (iPendingOperations === 0) {

    //             // All POST + PUT finished
    //             oModel.detachEvent("requestCompleted", onRequestDone);

    //             oView.setBusy(false);

    //             sap.m.MessageToast.show("Saved successfully");

    //             that.byId("RtoExpenceTable")
    //                 .getBinding("rows")
    //                 .refresh();
    //         }
    //     }
    // });

    // // Trigger submission
    // oModel.submitChanges();
}

 
      });
    }
  );
  