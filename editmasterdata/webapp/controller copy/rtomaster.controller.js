sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.rtomaster", {
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
                //  oVM.setProperty("/AspEmail", oUserInfo.getEmail());

                //  console.log("ASP Logged User:",
                //                     oUserInfo.getId(),
                //                     oUserInfo.getFullName(),
                //                     oUserInfo.getEmail(),
                //                     oUserInfo.getFirstName()
                //                 );

                const oTable = this.byId("RtoMaterTable");

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
                    path: "/RtoMasterSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail", // exact CDS name
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: sASMMail
                        })
                    ]
                });

                //this._bCreateInProgress = false;

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

                   const oVm = this.getView().getModel('viewModel');

    const oMail = oVm.getProperty("/ASMEmail");


                var oTable = this.byId("RtoMaterTable");
                var oBinding = oTable.getBinding("rows");

                //    var sASMMail = this.getView()
                //         .getModel("viewModel")
                //         .getProperty("/ASMEmail");

                oBinding.create({
                    CcMin: "0.000",
                    OperationNo:0,
                    CcMax: "0.000",
                    EngineType:"EV",
                    Mail: oMail,
                    RegionCode: "",
                    Slab: 0,
                    MinRange: "0.000",
                    MaxRange: "0.000",
                    // PriceValue: "0.000",
                    Status: "SUBMITTED"
                });
            },

onSubmit: function () {

    const oVm = this.getView().getModel("viewModel");
    const oMail = oVm.getProperty("/ASMEmail");

    var oModel = this.getView().getModel();
    var oTable = this.byId("RtoMaterTable");
    var aContexts = oTable.getBinding("rows").getContexts();
    var oView = this.getView();

    var mPending = oModel.getPendingChanges();

    var aAllSlabs = [];
    var aUserSlabs = [];
    var bHasError = false;
   // var aDuplicate = null;

    // ================= COLLECT ALL SLABS =================

    // aContexts.forEach(function (oContext) {

    //     var oData = oContext.getObject();
    //     if (!oData) return;

    //     var sSlab = oData.Slab;

    //     if (sSlab !== undefined && sSlab !== null) {
    //         aAllSlabs.push(String(sSlab).trim());
    //     }

    // });

    // // ================= CHECK USER ENTERED SLABS =================

    // Object.keys(mPending).forEach(function (sKey) {

    //     var row = mPending[sKey];

    //     if (!row) return;

    //     if (row.Slab !== undefined && row.Slab !== null) {

    //         var sSlab = String(row.Slab).trim();

    //         // remove first occurrence (existing value)
    //         var index = aAllSlabs.indexOf(sSlab);

    //         if (index !== -1) {
    //             aAllSlabs.splice(index, 1);
    //         }

    //         if (aAllSlabs.includes(sSlab) || aUserSlabs.includes(sSlab)) {
    //             aDuplicate = sSlab;
    //         }

    //         aUserSlabs.push(sSlab);
    //     }

    // });

    // if (aDuplicate !== null) {

    //     sap.m.MessageBox.error(
    //         "Slab '" + aDuplicate + "' cannot be duplicated."
    //     );

    //     return;
    // }

    // ================= CHECK PENDING CHANGES =================

    if (!oModel.hasPendingChanges()) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var bHasChanges = false;
    var iPendingOperations = 0;

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var sKey = sPath.substring(1);
        var oData = oContext.getObject();

        if (oContext.isTransient()) {

            oData.Status = "SUBMITTED";
            oData.Mail = oMail;

            iPendingOperations++;
            bHasChanges = true;

            return;
        }

        if (mPending[sKey]) {

            oModel.resetChanges([sPath]);

            oData.Status = "SUBMITTED";

            oModel.update(sPath, oData, {
                merge: false
            });

            iPendingOperations++;
            bHasChanges = true;
        }

    });

    if (!bHasChanges) {
        sap.m.MessageToast.show("No changes to save");
        return;
    }

    var that = this;
var iTotalOperations = iPendingOperations; 
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

    // 🔥 Unified handler for both success and failure
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
                that.byId("RtoMaterTable").getBinding("rows").refresh();
            } else {
                // Refresh anyway to reset state, or optionally skip
                that.byId("RtoMaterTable").getBinding("rows").refresh();
            }
        }
    }

    oModel.attachEvent("requestCompleted", onRequestDone);
    oModel.submitChanges();
}

//     oModel.attachEvent("requestCompleted", function onRequestDone(oEvent) {

//         var sMethod = oEvent.getParameter("method");

//         if (sMethod === "POST" || sMethod === "PUT") {

//             iPendingOperations--;

//             if (iPendingOperations === 0) {

//                 oModel.detachEvent("requestCompleted", onRequestDone);

//                 oView.setBusy(false);

//                 sap.m.MessageToast.show("Saved successfully");

//                 that.byId("RtoMaterTable")
//                     .getBinding("rows")
//                     .refresh();
//             }
//         }

//     });

//     oModel.submitChanges();
// }


      });
    }
  );
  