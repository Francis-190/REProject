sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
         "sap/ui/core/routing/History"
    ],
    function(BaseController,History) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.masterdata", {
        //  onInit: async function () {

        //         const oVM = new sap.ui.model.json.JSONModel({});
        //         this.getView().setModel(oVM, "viewModel");

        //         let sAsmName = "Anad Kumar";
        //         let sASMMail = "siva.durairaj@laderatechnology.com"


        //         if (sap.ushell && sap.ushell.Container) {
        //             const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
        //             sAsmName = oUserInfo.getFullName();
        //             sASMMail = oUserInfo.getEmail();
        //         }
        //         sAsmName = sAsmName.toUpperCase();

        //         oVM.setProperty("/ASMEmail", sASMMail);
        //         //  oVM.setProperty("/AspEmail", oUserInfo.getEmail());

        //         //  console.log("ASP Logged User:",
        //         //                     oUserInfo.getId(),
        //         //                     oUserInfo.getFullName(),
        //         //                     oUserInfo.getEmail(),
        //         //                     oUserInfo.getFirstName()
        //         //                 );

        //         const oTable = this.byId("modelTable");

        //         // oTable.bindRows({
        //         //     path: "/PricingComponentsSet",
        //         //     filters: [
        //         //         new sap.ui.model.Filter(
        //         //             "sASMMail",
        //         //             sap.ui.model.FilterOperator.EQ,
        //         //             sASMMail
        //         //         )
        //         //     ]
        //         // });

        //         oTable.bindRows({
        //             path: "/ModelMasterSet",
        //             filters: [
        //                 new sap.ui.model.Filter({
        //                     path: "Mail", // exact CDS name
        //                     operator: sap.ui.model.FilterOperator.EQ,
        //                     value1: sASMMail
        //                 })
        //             ]
        //         });

        //         //this._bCreateInProgress = false;

        //     },

      
      onInit: async function () {

        console.log("Init check");
    const oVM = new sap.ui.model.json.JSONModel({});
    this.getView().setModel(oVM, "viewModel");

    let sASMMail = "siva.durairaj@laderatechnology.com";

    if (sap.ushell && sap.ushell.Container) {
        const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
        sASMMail = oUserInfo.getEmail();
    }

    oVM.setProperty("/ASMEmail", sASMMail);

    const oTable = this.byId("modelTable");

    // 🔥 Bind table (OData)
    oTable.bindRows({
        path: "/ModelMasterSet",
        filters: [
            new sap.ui.model.Filter("Mail", "EQ", sASMMail)
        ]
    });

    // 🔥 Attach event AFTER binding is ready
    const oBinding = oTable.getBinding("rows");

    if (oBinding) {
        oBinding.attachDataReceived(this._onDataReceived.bind(this));
    }
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
    const aEngineType = [];
    const aCcWatt = [];

    const seenModel = {};
    const seenEngine = {};
    const seenCc = {};

    aData.forEach(function (oRow) {

        if (oRow.ModelCode && !seenModel[oRow.ModelCode]) {
            seenModel[oRow.ModelCode] = true;
            aModels.push({
                ModelCode: oRow.ModelCode,
                Display: oRow.ModelCode + " - " + oRow.Description
            });
        }

        if (oRow.EngineType && !seenEngine[oRow.EngineType]) {
            seenEngine[oRow.EngineType] = true;
            aEngineType.push({
                Type: oRow.EngineType
            });
        }

        if (oRow.CcWatt && !seenCc[oRow.CcWatt]) {
            seenCc[oRow.CcWatt] = true;
            aCcWatt.push({
                Ccwatt: oRow.CcWatt
            });
        }
    });

    this.getView().setModel(
        new sap.ui.model.json.JSONModel({
            Models: aModels,
            EngineType: aEngineType,
            CcWatt: aCcWatt
        }),
        "filter"
    );
},

onApplyFilter: function () {

    const oTable   = this.byId("modelTable");
    const oBinding = oTable.getBinding("rows");

    const aModelCodes  = this.byId("filterModelCode").getSelectedKeys();
    const aEngineTypes = this.byId("filterEngineType").getSelectedKeys();
    const aCcWatts     = this.byId("filterCcType").getSelectedKeys();

    let aFilters = [];

    if (aModelCodes.length) {
        aFilters.push(new sap.ui.model.Filter({
            filters: aModelCodes.map(k =>
                new sap.ui.model.Filter("ModelCode", "EQ", k)
            ),
            and: false
        }));
    }

    if (aEngineTypes.length) {
        aFilters.push(new sap.ui.model.Filter({
            filters: aEngineTypes.map(k =>
                new sap.ui.model.Filter("EngineType", "EQ", k)
            ),
            and: false
        }));
    }

    if (aCcWatts.length) {
        aFilters.push(new sap.ui.model.Filter({
            filters: aCcWatts.map(k =>
                new sap.ui.model.Filter("CcWatt", "EQ", k)
            ),
            and: false
        }));
    }

    oBinding.filter(aFilters);
},

onClearFilter: function () {

    this.byId("filterModelCode").removeAllSelectedItems();
    this.byId("filterEngineType").removeAllSelectedItems();
    this.byId("filterCcType").removeAllSelectedItems();

    const oBinding = this.byId("modelTable").getBinding("rows");
    oBinding.filter([]);
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
                console.log("HI");

                var oTable = this.byId("modelTable");
                var oBinding = oTable.getBinding("rows");
 const oVm = this.getView().getModel('viewModel');
                  const oMail = oVm.getProperty("/ASMEmail");
                oBinding.create({
                    ModelCode: "",
                    OperationNo:0,
                    EngineType: "EV",
                    OrdType:"MTO",
                    Mail: oMail,
                    CcWatt: "",
                    Description: "",
                    ModelFam: "",
                    GstPerc: "0.000",
                    DealerMargin: "0.000",
                    DealerMargCalc: "NSP",
                    DealerMargCostImp: "NSP",
                    CsdIndex:"",
                    CsdDisPerc:"0.000",
                    Gem:"0.000",
                  ModelStatus:"Active",
                    Status: "SUBMITTED"
                });
            },
           onSubmit: function () {

    var oModel = this.getView().getModel();
    var oTable = this.byId("modelTable");
    var aContexts = oTable.getBinding("rows").getContexts();
    var oView = this.getView();


             

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var mPending = oModel.getPendingChanges();
    var bHasChanges = false;
    var iPendingOperations = 0;
    var bHasError = false; //Track if any request faild

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var sKey  = sPath.substring(1);
        var oData = oContext.getObject();

        // CREATE → POST
        if (oContext.isTransient()) {

            oData.Status = "SUBMITTED";
            iPendingOperations++; // count POST
            bHasChanges = true;
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
                that.byId("modelTable").getBinding("rows").refresh();
            } else {
                // Refresh anyway to reset state, or optionally skip
                that.byId("modelTable").getBinding("rows").refresh();
            }
        }
    }

    oModel.attachEvent("requestCompleted", onRequestDone);
    oModel.submitChanges();
}

    // 🔥 Listen for request completion
//     oModel.attachEvent("requestCompleted", function onRequestDone(oEvent) {

//         var sMethod = oEvent.getParameter("method");

//         // Only track POST & PUT
//         if (sMethod === "POST" || sMethod === "PUT") {

//             iPendingOperations--;

//             if (iPendingOperations === 0) {

//                 // All POST + PUT finished
//                 oModel.detachEvent("requestCompleted", onRequestDone);

//                 oView.setBusy(false);

//                 sap.m.MessageToast.show("Saved successfully");

//                 that.byId("modelTable")
//                     .getBinding("rows")
//                     .refresh();
//             }
//         }
//     });

//     // Trigger submission
//     oModel.submitChanges();
// }



      });
    }
  );
  