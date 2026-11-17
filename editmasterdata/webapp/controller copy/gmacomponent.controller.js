sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/routing/History"
    ],
    function (BaseController, History) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.gmacomponent", {
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
                const oTable = this.byId("gmaComponentTable");


                oTable.bindRows({
                    path: "/GMAComponentsSet",
                    filters: [
                        new sap.ui.model.Filter({
                            path: "Mail",
                            operator: sap.ui.model.FilterOperator.EQ,
                            value1: sASMMail
                        })
                    ],

                    events: {
                        dataReceived: this._onDataReceived.bind(this),
                        
                    }
                });

                //this._bCreateInProgress = false;

                this._getPartCode(sASMMail)

            },

            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                // Master copy — never mutate directly
                this._allData = aData;

                // Switch table to JSON model for client-side filtering/creation
                this.byId("gmaComponentTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("gmaComponentTable").bindRows("/");

                // Build filter dropdowns from actual loaded data
                this._buildFilterDropdowns(this._allData);
            },



            _buildFilterDropdowns: function (aData) {

                const ModelsSet = new Set();

                aData.forEach(function (oRow) {
                    if (oRow.Models) ModelsSet.add(oRow.Models);
                    
                });

                const aFamily = [...ModelsSet].map(f => ({ Models: f }));
        

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        ModelsSet: aFamily
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
                        return aFamilyCodes.indexOf(oRow.Models) !== -1;
                    });
                }

              



                // New rows always stay on top
                this.byId("gmaComponentTable").setModel(
                    new sap.ui.model.json.JSONModel(aNewRows.concat(aFiltered))
                );
                this.byId("gmaComponentTable").bindRows("/");
            },



            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();

                this.byId("gmaComponentTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData || [])
                );
                this.byId("gmaComponentTable").bindRows("/");
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
            onNavBack: function () {

                console.log("navclick")

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
                    Models: "",
                    Description: "",
                    Mail: oMail,
                    MtsMto: "",
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



            // showComboForNew: function () {
            //     var oRowContext = this.getBindingContext();

            //     if (!oRowContext) return false;

            //     return oRowContext.isTransient();
            // },

            // isNewRow: function () {
            //     var oCtx = this.getBindingContext();
            //     return oCtx && oCtx.isTransient();
            // },

            // isExistingRow: function () {
            //     var oCtx = this.getBindingContext();
            //     return oCtx && !oCtx.isTransient();
            // },

            onPartChange: function (oEvent) {

                const oComboBox = oEvent.getSource();
                const sPartCode = oComboBox.getSelectedKey();

                if (!sPartCode) {
                    return;
                }


                const oRowCtx = oComboBox.getBindingContext();
                if (!oRowCtx) {
                    return;
                }

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

                console.log(oPart);


                const fMiyCost = Number(oPart.MiyCost || 0);
                console.log(fMiyCost);

                const fMiyMarkup = Number(oPart.MiyMarkup || 0);

                console.log(fMiyMarkup);


                const fFinalPrice = fMiyCost + fMiyMarkup;

                console.log(fFinalPrice);




                const oModel = oRowCtx.getModel();
                const sPath = oRowCtx.getPath();

                // const sPriceField = "part" + iPartNo + "Price";

                const sPriceField = "Part" + iPartNo + "Price";

                console.log(sPriceField);


                oModel.setProperty(sPath + "/" + sPriceField, fFinalPrice);

            },






            // onSubmit: function () {

            //     const oVm = this.getView().getModel("viewModel");
            //     const oMail = oVm.getProperty("/ASMEmail");

            //     const oModel = this.getView().getModel();
            //     const oTable = this.byId("gmaComponentTable");
            //     const aContexts = oTable.getBinding("rows").getContexts();
            //     const oView = this.getView();

            //     // ================= DUPLICATE VALIDATION =================

            //     let aExistingRegions = [];
            //     let aNewRegions = [];

            //     aContexts.forEach(function (oContext) {

            //         const oData = oContext.getObject();

            //         if (!oContext.isTransient() && oData.Region) {
            //             aExistingRegions.push(oData.Region.trim());
            //         }

            //         if (oContext.isTransient() && oData.Region) {
            //             aNewRegions.push(oData.Region.trim());
            //         }
            //     });

            //     for (let i = 0; i < aNewRegions.length; i++) {
            //         if (aExistingRegions.includes(aNewRegions[i])) {
            //             sap.m.MessageBox.error(
            //                 "Region '" + aNewRegions[i] + "' already exists."
            //             );
            //             return;
            //         }
            //     }

            //     const aDuplicateCheck = aNewRegions.filter(function (item, index) {
            //         return aNewRegions.indexOf(item) !== index;
            //     });

            //     if (aDuplicateCheck.length > 0) {
            //         sap.m.MessageBox.error(
            //             "Duplicate Region '" + aDuplicateCheck[0] + "' found in new entries."
            //         );
            //         return;
            //     }

            //     // ========================================================

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     let iPendingOperations = 0;

            //     oView.setBusy(true);

            //     aContexts.forEach(function (oContext) {

            //         const sPath = oContext.getPath();
            //         const oData = oContext.getObject();

            //         // 🔹 Clone object
            //         let oPayload = Object.assign({}, oData);

            //         // 🔹 Remove all PartXPrice fields
            //         Object.keys(oPayload).forEach(function (key) {
            //             if (key.includes("Price")) {
            //                 delete oPayload[key];
            //             }
            //         });

            //         // ================= CREATE =================
            //         if (oContext.isTransient()) {

            //             oPayload.Status = "SUBMITTED";
            //             oPayload.Mail = oMail;

            //             // 🔥 Delete auto transient entry (stops first POST)
            //             oContext.delete();

            //             // 🔥 Manual clean POST
            //             oModel.create("/GMAComponentsSet", oPayload);

            //             iPendingOperations++;
            //         }

            //         // ================= UPDATE =================
            //         else if (oModel.getPendingChanges()[sPath.substring(1)]) {

            //             oPayload.Status = "SUBMITTED";

            //             oModel.update(sPath, oPayload, {
            //                 merge: false
            //             });

            //             iPendingOperations++;
            //         }

            //     });

            //     if (iPendingOperations === 0) {
            //         oView.setBusy(false);
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     oModel.submitChanges({
            //         success: function () {
            //             oView.setBusy(false);
            //             sap.m.MessageToast.show("Saved successfully");
            //             oTable.getBinding("rows").refresh();
            //         },
            //         error: function () {
            //             oView.setBusy(false);
            //             sap.m.MessageBox.error("Error while saving data");
            //         }
            //     });
            // }


            // working one

            // onSubmit: function () {

            //     // 🔥 Ensure latest UI values are written to model
            //     sap.ui.getCore().applyChanges();

            //     const oVm = this.getView().getModel("viewModel");
            //     const oMail = oVm.getProperty("/ASMEmail");

            //     const oModel = this.getView().getModel();
            //     const oTable = this.byId("gmaComponentTable");
            //     const aContexts = oTable.getBinding("rows").getContexts();
            //     const oView = this.getView();

            //     // ========================================================

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     let iPendingOperations = 0;

            //     oView.setBusy(true);

            //     aContexts.forEach(function (oContext) {

            //         const sPath = oContext.getPath();
            //         const oData = oContext.getObject();

            //         // 🔹 Clone object
            //         let oPayload = Object.assign({}, oData);

            //         // 🔹 Remove all PartXPrice fields
            //         Object.keys(oPayload).forEach(function (key) {
            //             if (key.includes("Price")) {
            //                 delete oPayload[key];
            //             }
            //         });

            //         // ================= CREATE =================
            //         if (oContext.isTransient()) {

            //             oPayload.Status = "SUBMITTED";
            //             oPayload.Mail = oMail;

            //             // 🔥 Remove auto transient entry (stops first POST)
            //             oContext.delete();

            //             // 🔥 Manual clean POST
            //             oModel.create("/GMAComponentsSet", oPayload);

            //             iPendingOperations++;
            //         }

            //         // ================= UPDATE (FORCE PUT) =================
            //         else if (oModel.getPendingChanges()[sPath.substring(1)]) {

            //             oPayload.Status = "SUBMITTED";

            //             // 🔥 Remove automatic MERGE pending change
            //             oModel.resetChanges([sPath]);

            //             // 🔥 Force PUT
            //             oModel.update(sPath, oPayload, {
            //                 method: "PUT"
            //             });

            //             iPendingOperations++;
            //         }

            //     });

            //     if (iPendingOperations === 0) {
            //         oView.setBusy(false);
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     oModel.submitChanges({
            //         success: function () {
            //             oView.setBusy(false);
            //             sap.m.MessageToast.show("Saved successfully");
            //             oTable.getBinding("rows").refresh();
            //         },
            //         error: function () {
            //             oView.setBusy(false);
            //             sap.m.MessageBox.error("Error while saving data");
            //         }
            //     });
            // }

            onSubmit: function () {

                // 🔥 Ensure latest UI values are written to model
                sap.ui.getCore().applyChanges();

                const oVm = this.getView().getModel("viewModel");
                const oMail = oVm.getProperty("/ASMEmail");

                const oModel = this.getView().getModel();
                const oTable = this.byId("gmaComponentTable");
                const aContexts = oTable.getBinding("rows").getContexts();
                const oView = this.getView();

                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                let iPendingOperations = 0;

                oView.setBusy(true);

                aContexts.forEach(function (oContext) {

                    const sPath = oContext.getPath();
                    const oData = oContext.getObject();

                    // 🔹 Clone object
                    let oPayload = Object.assign({}, oData);

                    // 🔹 Remove all PartXPrice fields
                    Object.keys(oPayload).forEach(function (key) {
                        if (key.includes("Price")) {
                            delete oPayload[key];
                        }
                    });

                    // ================= CREATE =================
                    if (oContext.isTransient()) {

                        oPayload.Status = "SUBMITTED";
                        oPayload.Mail = oMail;

                        // 🔥 Remove auto transient entry (stops first POST)
                        oContext.delete();

                        // 🔥 Manual clean POST
                        oModel.create("/GMAComponentsSet", oPayload);

                        iPendingOperations++;
                    }

                    // ================= UPDATE (FORCE PUT) =================
                    else if (oModel.getPendingChanges()[sPath.substring(1)]) {

                        oPayload.Status = "SUBMITTED";

                        // 🔥 Remove automatic MERGE pending change
                        oModel.resetChanges([sPath]);

                        // 🔥 Force PUT
                        oModel.update(sPath, oPayload, {
                            method: "PUT"
                        });

                        iPendingOperations++;
                    }

                });

                if (iPendingOperations === 0) {
                    oView.setBusy(false);
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                // 🔥 Helper to extract backend error message
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

                var bHasError = false;

                function onRequestDone(oEvent) {
                    var sMethod = oEvent.getParameter("method");

                    if (sMethod !== "POST" && sMethod !== "PUT") return;

                    var bSuccess = oEvent.getParameter("success");
                    if (!bSuccess) {
                        bHasError = true;
                        var sErrorMsg = extractErrorMessage(oEvent);
                        sap.m.MessageBox.error(sErrorMsg);
                    }

                    iPendingOperations--;

                    if (iPendingOperations === 0) {
                        oModel.detachEvent("requestCompleted", onRequestDone);
                        oView.setBusy(false);

                        if (!bHasError) {
                            sap.m.MessageToast.show("Saved successfully");
                            oTable.getBinding("rows").refresh(); // 🔥 Only refresh on success
                        }
                        // ❌ No refresh on error — keeps transient rows intact
                    }
                }

                oModel.attachEvent("requestCompleted", onRequestDone);
                oModel.submitChanges();
            }

        });
    }
);
