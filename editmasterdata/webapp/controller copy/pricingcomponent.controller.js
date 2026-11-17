sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.pricingcomponent", {

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

                const oTable = this.byId("masterTable");

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
                    path: "/PricingComponentsSet",
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

                this._allData = aData;

                // Switch table to JSON model for client-side filtering/creation
                this.byId("masterTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("masterTable").bindRows("/");

                // Build filter dropdowns from actual loaded data
                this._buildFilterDropdowns(this._allData);
            },

            _buildFilterDropdowns: function (aData) {

                const aRegion = [];
                const aEngineType = [];
                const aCcWatt = [];
                const seenModel = {};
                const seenEngine = {};
                const seenCc = {};

                aData.forEach(function (oRow) {

                    if (oRow.Region && !seenModel[oRow.Region]) {
                        seenModel[oRow.ModelCode] = true;
                        aRegion.push({
                            Region: oRow.Region
                        });
                    }


                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        Region: aRegion

                    }),
                    "filter"
                );
            },

            onApplyFilter: function () {

                const aRegionCode = this.byId("filterModelCode").getSelectedKeys();


                // Separate new (unsaved) rows — keep them always visible
                const aNewRows = (this._allData || []).filter(function (r) { return r._isNew; });
                let aFiltered = (this._allData || []).filter(function (r) { return !r._isNew; });

                if (aRegionCode.length) {
                    aFiltered = aFiltered.filter(function (oRow) {
                        return aRegionCode.indexOf(oRow.Region) !== -1;
                    });
                }



                this.byId("masterTable").setModel(
                    new sap.ui.model.json.JSONModel(aNewRows.concat(aFiltered))
                );
                this.byId("masterTable").bindRows("/");
            },



            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();


                this.byId("masterTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData || [])
                );
                this.byId("masterTable").bindRows("/");
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


            // onCreateMasterRow: function () {
            //     console.log("HI");

            //     var oTable = this.byId("masterTable");
            //     var oBinding = oTable.getBinding("rows");
            //     oBinding.create({
            //     OperationNo: 0,
            //     Region: "",
            //     EngineType: "",
            //     Mail:"sivasmksiva@gmail.com",
            //     Helmet: 89,
            //     // Transportation: "0",
            //     // OtExpGt500: "0",
            //     // OtExpLt500: "0",
            //     // HelmetMargin: "0",
            //     // InsuranceLe350: "0.000",
            //     // InsuranceGt350: "0.000",
            //     // TpaPaGt350: "0",
            //     // TpaPaLe350: "0",
            //     // BuffPdi: "0",
            //     // HsprRate: "0",
            //     // NoPlateWrit: "0",
            //     // PetrolUpto500: "0",
            //     // PetrolGt500: "0",
            //     Status: "SUBMITTED",

            // });

            // },

            onCreateMasterRow: function () {
                console.log("HI");

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                if (!this._allData) {
                    sap.m.MessageToast.show("Data is still loading, please wait.");
                    return;
                }

                var oTable = this.byId("masterTable");
                var oBinding = oTable.getBinding("rows");

                const oNewRow = {
                    _isNew: true,
                    OperationNo: 0,
                    Region: "",
                    EngineType: "EV",
                    Mail: oMail,
                    Helmet: "0.000",
                    Transportation: "0.000",
                    OtExpGt500: "0.000",
                    OtExpLt500: "0.000",
                    HelmetMargin: "0.000",
                    InsuranceLe350: "0.000000",
                    InsuranceGt350: "0.000000",
                    TpaPaGt350: "0.000",
                    TpaPaLe350: "0.000",
                    BuffPdi: "0.000",
                    HsprRate: "0.000",
                    NoPlateWrit: "0.000",
                    PetrolUpto500: "0.000",
                    PetrolGt500: "0.000",
                    RtoExpense: "0.000",
                    Status: "SUBMITTED"
                };

                this._allData.unshift(oNewRow);

                this.byId("masterTable").setModel(
                    new sap.ui.model.json.JSONModel(this._allData)
                );
                this.byId("masterTable").bindRows("/");
            },
            // onSubmit: function () {
            //     console.log(this.getView().getModel().getPendingChanges());

            //     var oModel = this.getView().getModel();

            //     if (!oModel.hasPendingChanges()) {
            //         sap.m.MessageToast.show("No changes to save");
            //         return;
            //     }

            //     oModel.submitChanges({
            //         success: function () {
            //             sap.m.MessageToast.show("Saved successfully");
            //         },
            //         error: function (oError) {
            //             console.error(oError);
            //             sap.m.MessageToast.show("Error while saving");
            //         }
            //     });
            // }

            onSubmit: function () {

                const oVm = this.getView().getModel('viewModel');

                const oMail = oVm.getProperty("/ASMEmail");

                console.log(oMail);

                var oModel = this.getView().getModel();
                var oTable = this.byId("masterTable");
                var aContexts = oTable.getBinding("rows").getContexts();
                var oView = this.getView();

                // ================= DUPLICATE REGION VALIDATION =================

                // var aExistingRegions = [];
                // var aNewRegions = [];

                // aContexts.forEach(function (oContext) {

                //     var oData = oContext.getObject();

                //     // Existing rows
                //     if (!oContext.isTransient()) {
                //         if (oData.Region) {
                //             aExistingRegions.push(oData.Region.trim());
                //         }
                //     }

                //     // New rows
                //     if (oContext.isTransient()) {
                //         if (oData.Region) {
                //             aNewRegions.push(oData.Region.trim());
                //         }
                //     }
                // });

                // // Duplicate between new & existing
                // for (var i = 0; i < aNewRegions.length; i++) {

                //     if (aExistingRegions.includes(aNewRegions[i])) {

                //         sap.m.MessageBox.error(
                //             "Region '" + aNewRegions[i] + "' already exists. Cannot create duplicate entry."
                //         );

                //         return; // STOP submit
                //     }
                // }

                // // Duplicate inside new rows
                // var aDuplicateCheck = aNewRegions.filter(function (item, index) {
                //     return aNewRegions.indexOf(item) !== index;
                // });

                // if (aDuplicateCheck.length > 0) {

                //     sap.m.MessageBox.error(
                //         "Duplicate Region '" + aDuplicateCheck[0] + "' found in new entries."
                //     );

                //     return; // STOP submit
                // }

                if (!oModel.hasPendingChanges()) {
                    sap.m.MessageToast.show("No changes to save");
                    return;
                }

                var mPending = oModel.getPendingChanges();
                var bHasChanges = false;
                var iPendingOperations = 0;
                var bHasError = false;

                aContexts.forEach(function (oContext) {

                    var sPath = oContext.getPath();
                    var sKey = sPath.substring(1);
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


                        iPendingOperations++; // count PUT
                        bHasChanges = true;

                        oModel.update(sPath, oData, {
                            merge: false
                        });

                    }

                    //         if (mPending[sKey]) {

                    //     oData.Status = "SUBMITTED";

                    //     iPendingOperations++;
                    //     bHasChanges = true;
                    // }

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
                            that.byId("masterTable").getBinding("rows").refresh();
                        } else {
                            // Refresh anyway to reset state, or optionally skip
                            that.byId("masterTable").getBinding("rows").refresh();
                        }
                    }
                }

                oModel.attachEvent("requestCompleted", onRequestDone);
                oModel.submitChanges();

                // 🔥 Listen for request completion
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

                //             that.byId("masterTable")
                //                 .getBinding("rows")
                //                 .refresh();
                //         }
                //     }
                // });

                // // Trigger submission
                // oModel.submitChanges();
            },

            // onCalcChange: function (oEvent) {
            //     var oSource = oEvent.getSource();
            //     var sValue = oEvent.getParameter("value");
            //     var sPath = oSource.getBindingInfo("value").binding.getPath();
            //     var oContext = oSource.getBindingContext();

            //     // oContext.getModel().setProperty(oContext.getPath() + "/" + sPath, Number(sValue) || 0);
            //     oContext.getModel().setProperty(oContext.getPath() + "/" + sPath, sValue);

            //     this.recalculateRow(oContext);
            // },

            onCalcChange: function (oEvent) {

                var oSource = oEvent.getSource();
                var oContext = oSource.getBindingContext();
                var oModel = oContext.getModel();

                var sPath = oSource.getBindingInfo("value").binding.getPath();
                var value = Number(oEvent.getParameter("value")) || 0;

                oModel.setProperty(oContext.getPath() + "/" + sPath, String(value));

                this.recalculateRow(oContext);
            },

            // recalculateRow: function (oContext) {

            //     var oModel = this.getView().getModel();
            //     var oData = oContext.getObject();

            //     // var transportation = Number(oData.Transportation) || 0;
            //     var RTOExepence = Number(oData.RTOExepence) || 0;
            //     var hspr = Number(oData.HsprRate) || 0;
            //     var plate = Number(oData.NoPlateWrit) || 0;
            //     var petrol500 = Number(oData.PetrolUpto500) || 0;
            //     var petrolgt500 = Number(oData.PetrolGt500) || 0;
            //     var rto = Number(oData.BuffPdi) || 0;

            //     var less500 =
            //         // transportation +
            //         hspr +
            //         plate +
            //         petrol500 +
            //         RTOExepence +
            //         rto;



            //     var greater500 =
            //         // transportation +
            //         hspr +
            //         plate +
            //         petrolgt500 +
            //         RTOExepence +
            //         rto;

            //     oModel.setProperty(oContext.getPath() + "/OtExpLt500", String(less500));
            //     oModel.setProperty(oContext.getPath() + "/OtExpGt500", String(greater500));
            // }

            recalculateRow: function (oContext) {
                var oModel = oContext.getModel();
                var sRowPath = oContext.getPath();
                var oData = oModel.getProperty(sRowPath);

                var RtoExpense = Number(oData.RtoExpense) || 0;
                var hspr = Number(oData.HsprRate) || 0;
                var plate = Number(oData.NoPlateWrit) || 0;
                var petrol500 = Number(oData.PetrolUpto500) || 0;
                var petrolgt500 = Number(oData.PetrolGt500) || 0;
                var rto = Number(oData.BuffPdi) || 0;

                var less500 = hspr + plate + petrol500 + RtoExpense + rto;
                var greater500 = hspr + plate + petrolgt500 + RtoExpense + rto;

                // oModel.setProperty(sRowPath + "/OtExpLt500", less500);
                // oModel.setProperty(sRowPath + "/OtExpGt500", greater500);

                oModel.setProperty(sRowPath + "/OtExpLt500", String(less500));
                oModel.setProperty(sRowPath + "/OtExpGt500", String(greater500));
            }

        });
    }
);
