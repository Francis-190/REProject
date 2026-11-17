sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function (BaseController) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.RegionmasterHistory", {

            onInit: async function () {
                const oVM = new sap.ui.model.json.JSONModel({});
                this.getView().setModel(oVM, "viewModel");

                let sAsmName = "Anad Kumar";
                let sASMMail = "siva.durairaj@laderatechnology.com";
                // let sASMMail = "anandkumar.n@laderatechnology.com";

                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sAsmName = oUserInfo.getFullName();
                    sASMMail = oUserInfo.getEmail();
                }

                sAsmName = sAsmName.toUpperCase();
                oVM.setProperty("/ASMEmail", sASMMail);

                const oTable = this.byId("regionTables");

                oTable.bindRows({
                    path: "/RegionInvalidSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ", sASMMail)
                    ],
                    events: {
                        dataReceived: function (oEvent) {
                            const oData = oEvent.getParameter("data");
                            const aData = (oData && oData.results) ? oData.results : [];

                            if (!aData.length) return;

                            aData.forEach(function (o, i) {
                                o._snapshotIndex = i;
                            });

                            this._allData = JSON.parse(JSON.stringify(aData));
                            this._buildFilterDropdowns(aData);

                        }.bind(this)
                    }
                });

                var oPopover = this.byId("excelPopover");
                if (oPopover) {
                    this.getView().addDependent(oPopover);
                }
            },

            onRowsUpdated: function () {
                this._applyRowColors();
            },

            _applyRowColors: function () {
                var oTable = this.byId("regionTables");
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

            formatRowHighlight: function (sFromDate) {
                if (!sFromDate) return "None";

                var oDate = sFromDate instanceof Date
                    ? new Date(sFromDate.getTime())
                    : new Date(sFromDate);

                if (isNaN(oDate.getTime())) return "None";

                var oToday = new Date();
                oToday.setHours(0, 0, 0, 0);
                oDate.setHours(0, 0, 0, 0);

                return oDate >= oToday ? "Success" : "Error";
            },

            formatDate: function (vDate) {
                if (!vDate) return "";
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },

            _buildFilterDropdowns: function (aData) {
                const aModels = [];
                const seenModel = {};

                aData.forEach(function (oRow) {
                    if (oRow.Region && !seenModel[oRow.Region]) {
                        seenModel[oRow.Region] = true;
                        aModels.push({
                            Region: oRow.Region,
                            Display: oRow.Region
                        });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ Models: aModels }),
                    "filter"
                );
            },

            onApplyFilter: function () {
                const aRegions = this.byId("filterModelCode").getSelectedKeys();

                let aFiltered = this._allData
                    ? JSON.parse(JSON.stringify(this._allData))
                    : [];

                if (aRegions.length) {
                    aFiltered = aFiltered.filter(o => aRegions.includes(o.Region));
                }

                aFiltered.forEach(function (oRow) {
                    if (oRow.FromDate) {
                        var oDate = new Date(oRow.FromDate);
                        if (!isNaN(oDate)) {
                            oRow.FromDate = oDate;
                        }
                    }
                });

                this._isFiltered = true;

                const oTable = this.byId("regionTables");
                oTable.setModel(new sap.ui.model.json.JSONModel(aFiltered));
                oTable.bindRows("/");
            },

            onClearFilter: function () {
                this.byId("filterModelCode").removeAllSelectedItems();
                this._isFiltered = false;

                const oTable = this.byId("regionTables");
                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/RegionInvalidSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            _clearDraftRows: function () {
                const oModel = this.getView().getModel();
                if (oModel.hasPendingChanges()) {
                    oModel.resetChanges();
                }
            },

            onNavBack: function () {
                this._clearDraftRows();
                this.getOwnerComponent().getRouter().navTo("History", {}, true);
            }

        });
    }
);