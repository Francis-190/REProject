sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.AdminRtoMaster", {
       onInit: async function () {


                
                const oVM = new sap.ui.model.json.JSONModel({});
                this.getView().setModel(oVM, "viewModel");

                const oModel = this.getView().getModel();
                let sAsmName = "Anad Kumar";
                let sASMMail = "anandkumar.n@laderatechnology.com"


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

              
            },

                 onNavBack: function () {

                const oHistory = sap.ui.core.routing.History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("AdminSelectToEditMasterData", {}, true);
                }
            },

// onApprove: function () {
//     console.log("HI")

//     const oVm = this.getView().getModel('vm');

//     const oMail = oVm.getProperty("/ASMEmail");

//     console.log(oMail);
    

//     var oModel = this.getView().getModel();
//     var oTable = this.byId("regionTables");
//     var aContexts = oTable.getBinding("rows").getContexts();

//     if (!aContexts.length) {
//         sap.m.MessageToast.show("No records found");
//         return;
//     }

//     var bHasChanges = false;

//     aContexts.forEach(function (oContext) {

//         var sPath = oContext.getPath();
//         var oFullData = oContext.getObject(); // full row
//         oFullData.Mail = oMail;

//         // Change status for every row
//         oFullData.Status = "APPROVED";

//         // Force PUT (full entity)
//         oModel.update(sPath, oFullData, {
//             merge: false   // ensures PUT not MERGE
//         });

//         bHasChanges = true;

//     });

//     if (!bHasChanges) {
//         sap.m.MessageToast.show("Nothing to approve");
//         return;
//     }

//     var that = this;

//     oModel.submitChanges({
//         success: function () {

//             sap.m.MessageToast.show("All records Approved");

//             // Refresh table after success
//             that.byId("regionTables")
//                 .getBinding("rows")
//                 .refresh();

//         },
//         error: function (oError) {
//             console.error(oError);
//             sap.m.MessageToast.show("Approval failed");
//         }
//     });

// },

onApprove: function () {

    console.log("Hi clicked")
    const oVm = this.getView().getModel("viewModel");
    const oMail = oVm.getProperty("/ASMEmail");

    var oModel = this.getView().getModel();
    var oTable = this.byId("RtoMaterTable");
    var aContexts = oTable.getBinding("rows").getContexts();

    if (!aContexts.length) {
        sap.m.MessageToast.show("No records found");
        return;
    }

    var that = this;

    this.getView().setBusy(true);

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var oFullData = oContext.getObject();

        oFullData.Mail = oMail;
        oFullData.Status = "APPROVED";

        oModel.update(sPath, oFullData, {
            merge: false   // Force PUT
        });
    });

    oModel.attachEventOnce("batchRequestCompleted", function (oEvent) {

        that.getView().setBusy(false);

        if (oEvent.getParameter("success")) {

            sap.m.MessageToast.show("All records Approved");

            that.byId("RtoMaterTable")
                .getBinding("rows")
                .refresh();

        } else {
            sap.m.MessageToast.show("Approval failed");
        }
    });

    oModel.submitChanges();
},


// onReject: function () {

//     if (!this._oRejectDialog) {

//         this._oRejectDialog = new sap.m.Dialog({
//             title: "Reject Comment",
//             type: "Message",
//             content: [
//                 new sap.m.Label({
//                     text: "Enter rejection reason",
//                     labelFor: "rejectComment"
//                 }),
//                 new sap.m.TextArea("rejectComment", {
//                     width: "100%",
//                     rows: 4,
//                     placeholder: "Enter comment here..."
//                 })
//             ],
//             beginButton: new sap.m.Button({
//                 text: "Submit",
//                 type: "Reject",
//                 press: function () {

//                     var sComment = sap.ui.getCore()
//                         .byId("rejectComment")
//                         .getValue()
//                         .trim();

//                     if (!sComment) {
//                         sap.m.MessageToast.show("Please enter comment");
//                         return;
//                     }

//                     this._oRejectDialog.close();

//                     this._executeBulkReject(sComment);

//                 }.bind(this)
//             }),
//             endButton: new sap.m.Button({
//                 text: "Cancel",
//                 press: function () {
//                     this._oRejectDialog.close();
//                 }.bind(this)
//             })
//         });
//     }

//     sap.ui.getCore().byId("rejectComment").setValue("");
//     this._oRejectDialog.open();
// },


onReject: function () {

    if (!this._oRejectDialog) {

        this._oRejectDialog = new sap.m.Dialog({
            title: "Reject Comment",
            type: "Message",
            content: [
                new sap.m.Label({
                    text: "Enter rejection reason",
                    labelFor: this.createId("rejectComment")
                }),
                new sap.m.TextArea(this.createId("rejectComment"), {
                    width: "100%",
                    rows: 4,
                    placeholder: "Enter comment here..."
                })
            ],
            beginButton: new sap.m.Button({
                text: "Submit",
                type: "Reject",
                press: function () {

                    var sComment = this.byId("rejectComment")
                        .getValue()
                        .trim();

                    if (!sComment) {
                        sap.m.MessageToast.show("Please enter comment");
                        return;
                    }

                    this._oRejectDialog.close();
                    this._executeBulkReject(sComment);

                }.bind(this)
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: function () {
                    this._oRejectDialog.close();
                }.bind(this)
            })
        });
    }

    this.byId("rejectComment").setValue("");
    this._oRejectDialog.open();
},
// _executeBulkReject: function (sComment) {

//     var oModel = this.getView().getModel();
//     var oTable = this.byId("regionTables");
//     var aContexts = oTable.getBinding("rows").getContexts();
//     var oView = this.getView();

//     if (!aContexts.length) {
//         sap.m.MessageToast.show("No records to reject");
//         return;
//     }

//     var iPending = 0;
//     var that = this;

//     oView.setBusy(true);

//     aContexts.forEach(function (oContext) {

//         var sPath = oContext.getPath();
//         var oData = oContext.getObject();

//         // 🔥 Set Reject Values
//         oData.Status  = "REJECTED";
//         oData.Message = sComment;

//         // 🔥 Force PUT (full entity)
//         oModel.update(sPath, oData, {
//             merge: false
//         });

//         iPending++;

//     });

//     // 🔥 Track completion of ALL PUTs
//     oModel.attachEvent("requestCompleted", function onComplete(oEvent) {

//         var sMethod = oEvent.getParameter("method");

//         if (sMethod === "PUT") {

//             iPending--;

//             if (iPending === 0) {

//                 oModel.detachEvent("requestCompleted", onComplete);

//                 oView.setBusy(false);

//                 sap.m.MessageToast.show("All records rejected");

//                 that.byId("RtoMaterTable")
//                     .getBinding("rows")
//                     .refresh();
//             }
//         }

//     });

//     oModel.submitChanges();
// }

_executeBulkReject: function (sComment) {

    var oModel = this.getView().getModel();
    var oTable = this.byId("RtoMaterTable");
    var aContexts = oTable.getBinding("rows").getContexts();
    var oView = this.getView();

        const oVm = this.getView().getModel("viewModel");
    const oMail = oVm.getProperty("/ASMEmail");

    if (!aContexts.length) {
        sap.m.MessageToast.show("No records to reject");
        return;
    }

    var iPending = 0;
    var that = this;

    oView.setBusy(true);

    aContexts.forEach(function (oContext) {

        var sPath = oContext.getPath();
        var oData = oContext.getObject();

               oData.Mail = oMail;

   
        oData.Status  = "REJECTED";
        oData.Message = sComment;

        //  Force PUT (full entity)
        oModel.update(sPath, oData, {
            merge: false
        });

        iPending++;

    });

    //  Track completion of ALL PUTs
    oModel.attachEvent("requestCompleted", function onComplete(oEvent) {

        var sMethod = oEvent.getParameter("method");

        if (sMethod === "PUT") {

            iPending--;

            if (iPending === 0) {

                oModel.detachEvent("requestCompleted", onComplete);

                oView.setBusy(false);

                sap.m.MessageToast.show("All records rejected");

                that.byId("RtoMaterTable")
                    .getBinding("rows")
                    .refresh();
            }
        }

    });

    oModel.submitChanges();
}
      });
    }
  );
  