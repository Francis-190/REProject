sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.AdminPricingComponent", {

            // onInit: async function () {

            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

            //     const oModel = this.getView().getModel();
            //     let sAsmName = "Anad Kumar";
            //     let sASMMail = "anandkumar.n@laderatechnology.com"
            //     //let sASMMail = "siva.durairaj@laderatechnology.com"


            //     if (sap.ushell && sap.ushell.Container) {
            //         const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
            //         sAsmName = oUserInfo.getFullName();
            //         sASMMail = oUserInfo.getEmail();
            //     }
            //     sAsmName = sAsmName.toUpperCase();

            //     oVM.setProperty("/ASMEmail", sASMMail);
            //     //  oVM.setProperty("/AspEmail", oUserInfo.getEmail());

            //     //  console.log("ASP Logged User:",
            //     //                     oUserInfo.getId(),
            //     //                     oUserInfo.getFullName(),
            //     //                     oUserInfo.getEmail(),
            //     //                     oUserInfo.getFirstName()
            //     //                 );

            //     const oTable = this.byId("AdminPricingComponentTable");

            //     // oTable.bindRows({
            //     //     path: "/PricingComponentsSet",
            //     //     filters: [
            //     //         new sap.ui.model.Filter(
            //     //             "sASMMail",
            //     //             sap.ui.model.FilterOperator.EQ,
            //     //             sASMMail
            //     //         )
            //     //     ]
            //     // });

            //     oTable.bindRows({
            //         path: "/PricingComponentsSet",
            //         // filters: [
            //         //     new sap.ui.model.Filter({
            //         //         path: "Mail", // exact CDS name
            //         //         operator: sap.ui.model.FilterOperator.EQ,
            //         //         value1: sASMMail
            //         //     })
            //         // ]

            //         filters: [this._getMailFilter()],
            //     });


            // },


                        onInit: async function () {

    const oVM = new sap.ui.model.json.JSONModel({ readOnly: false });
    this.getView().setModel(oVM, "viewModel");

    // 1. wait for the role check in Component.js
    const oComp = this.getOwnerComponent();
    await oComp.getRoleReady();
    const oUser = oComp.getModel("user");

    // own mail: used ONLY when stamping approve / reject
    oVM.setProperty("/ASMEmail", oUser.getProperty("/email"));

    // 2. decide whose data to show (reference / filter only)
    let aViewMails = [];
    if (oUser.getProperty("/isApprover")) {
        aViewMails = [oUser.getProperty("/email")];
    } else if (oUser.getProperty("/isSubmitter")) {
        aViewMails = oUser.getProperty("/approverEmails") || [];
        oVM.setProperty("/readOnly", true);   // submitter only views approver data
    }
    oVM.setProperty("/viewMails", aViewMails);

    const oTable = this.byId("AdminPricingComponentTable");

    oTable.bindRows({
        path: "/PricingComponentsSet",
        filters: [this._getMailFilter()]
    });
},

_getMailFilter: function () {
    const aMails = this.getView().getModel("viewModel").getProperty("/viewMails") || [];

    // no mails (no role, or none maintained) → match nothing,
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
            

            formatDate: function (vDate) {
                if (!vDate) return "";
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },

            // Excel Download
            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");

                if (oSheet) {
                    oSheet.openBy(oEvent.getSource());
                }
            },
            onExcelDownloadAll: function () {

                const oTable = this.byId("AdminPricingComponentTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("No data available");
                    return;
                }

                const iLength = oBinding.getLength();

                const aContexts =
                    oBinding.getContexts(0, iLength);

                const aData = aContexts.map(function (oContext) {
                    return Object.assign({}, oContext.getObject());
                });

                if (!aData.length) {
                    sap.m.MessageToast.show("No data to download");
                    return;
                }

                // Format Effective Date
                aData.forEach(function (oRow) {

                    if (oRow.FromDate instanceof Date) {

                        oRow.FromDate =
                            oRow.FromDate.toISOString().substring(0, 10);

                    } else if (
                        typeof oRow.FromDate === "string" &&
                        oRow.FromDate.indexOf("/Date(") === 0
                    ) {

                        const iTime = parseInt(
                            oRow.FromDate.match(/\d+/)[0],
                            10
                        );

                        oRow.FromDate =
                            new Date(iTime).toISOString().substring(0, 10);
                    }
                });

                const aAllFields = this._getAllFields();

                this._exportToExcel(
                    aData,
                    aAllFields
                );
            },

            _exportToExcel: function (aData, aSelectedFields) {

                const oSettings = {
                    workbook: {
                        columns: aSelectedFields.map(function (oField) {
                            return {
                                label: oField.label,
                                property: oField.key,
                                type: sap.ui.export.EdmType.String
                            };
                        })
                    },

                    dataSource: aData,

                    fileName: "AdminPricingComponent_Export.xlsx"
                };

                const oSheet = new sap.ui.export.Spreadsheet(oSettings);

                oSheet
                    .build()
                    .finally(function () {
                        oSheet.destroy();
                    });
            },

            onExcelDownload: function () {

                const aAllFields = this._getAllFields();

                const oModel = new sap.ui.model.json.JSONModel({
                    fields: aAllFields
                });

                this.getView().setModel(oModel, "fields");

                this.byId("fieldSelectDialog").open();
            },

            _getAllFields: function () {

                return [
                    {
                        key: "Region",
                        label: "Region"
                    },
                    {
                        key: "EngineType",
                        label: "Engine Type"
                    },
                    
                    {
                        key: "Transportation",
                        label: "Transportation"
                    },
                    {
                        key: "FromDate",
                        label: "Effective Date"
                    },
                    {
                        key: "OtExpGt500",
                        label: "Other Expenses (>500)"
                    },
                    {
                        key: "OtExpLt500",
                        label: "Other Expenses (500)"
                    },
                    
                    {
                        key: "InsuranceLe350",
                        label: "Insurance % Below 350cc"
                    },
                    {
                        key: "InsuranceGt350",
                        label: "Insurance % Above 350cc"
                    },
                    {
                        key: "TpaPaGt350",
                        label: "TPA-PA Above 350CC"
                    },
                    {
                        key: "TpaPaLe350",
                        label: "TPA-PA Below 350CC"
                    },
                    {
                        key: "BuffPdi",
                        label: "Cleaning Polishing PDI"
                    },
                    {
                        key: "HsprRate",
                        label: "HSPR Rate"
                    },
                    {
                        key: "NoPlateWrit",
                        label: "Number Plate Writing"
                    },
                    {
                        key: "PetrolUpto500",
                        label: "Petrol charge 500cc"
                    },
                    {
                        key: "PetrolGt500",
                        label: "Petrol charge above 500cc"
                    }
                ];
            },

            onDownloadSelectedFields: function () {

                const oList = this.byId("fieldList");

                const aSelectedItems = oList.getSelectedItems();

                if (!aSelectedItems.length) {
                    sap.m.MessageToast.show("Select at least one field");
                    return;
                }

                const aSelectedFields = aSelectedItems.map(function (oItem) {

                    const oField =
                        oItem.getBindingContext("fields").getObject();

                    return {
                        key: oField.key,
                        label: oField.label
                    };
                });

                // IMPORTANT:
                // Use AdminPricingComponentTable
                const oTable = this.byId("AdminPricingComponentTable");

                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("No data available");
                    return;
                }

                const iLength = oBinding.getLength();

                const aContexts =
                    oBinding.getContexts(0, iLength);

                const aData = aContexts.map(function (oContext) {
                    return Object.assign({}, oContext.getObject());
                });

                if (!aData.length) {
                    sap.m.MessageToast.show("No data to download");
                    return;
                }

                // Format Effective Date
                aData.forEach(function (oRow) {

                    if (oRow.FromDate instanceof Date) {

                        oRow.FromDate =
                            oRow.FromDate.toISOString().substring(0, 10);

                    } else if (
                        typeof oRow.FromDate === "string" &&
                        oRow.FromDate.indexOf("/Date(") === 0
                    ) {

                        const iTime = parseInt(
                            oRow.FromDate.match(/\d+/)[0],
                            10
                        );

                        oRow.FromDate =
                            new Date(iTime).toISOString().substring(0, 10);
                    }
                });

                this._exportToExcel(
                    aData,
                    aSelectedFields
                );

                this.byId("fieldSelectDialog").close();
            },

            onCancelDownload: function () {

                this.byId("fieldSelectDialog").close();

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

            onApprove: function () {

                const oVm = this.getView().getModel("viewModel");
                const oMail = oVm.getProperty("/ASMEmail");

                var oModel = this.getView().getModel();
                var oTable = this.byId("AdminPricingComponentTable");
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

                        that.byId("AdminPricingComponentTable")
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
            //     var oTable = this.byId("AdminPricingComponentTable");
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

            //                 that.byId("AdminPricingComponentTable")
            //                     .getBinding("rows")
            //                     .refresh();
            //             }
            //         }

            //     });

            //     oModel.submitChanges();
            // }

            _executeBulkReject: function (sComment) {

                var oModel = this.getView().getModel();
                var oTable = this.byId("AdminPricingComponentTable");
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


                    oData.Status = "REJECTED";
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

                            that.byId("AdminPricingComponentTable")
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
