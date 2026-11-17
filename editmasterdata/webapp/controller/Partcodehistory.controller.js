sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.Partcodehistory", {
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

                const oTable = this.byId("partMasterHistoryTable");

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
                    path: "/PartsInvalidSet",
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

                        formatDate: function(vDate) {
    if (!vDate) return "";
    if (typeof vDate === "string") return vDate.substring(0, 10);
    if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
    return "";
},

            onRowsUpdated: function () {
                this._applyRowColors();
            },

_applyRowColors: function () {
    var oTable = this.byId("partMasterHistoryTable");
    if (!oTable) return;

    var oToday = new Date();
    oToday.setHours(0, 0, 0, 0);

    oTable.getRows().forEach(function (oRow) {
        var oDomRef = oRow.getDomRef();
        if (!oDomRef) return;

        oDomRef.classList.remove("regionRowGreen", "regionRowRed");

        var oContext = oRow.getBindingContext();
        if (!oContext) return;

        var sFromDate = oContext.getProperty("FromDate");
        if (!sFromDate) return;

        var oDate;
        if (typeof sFromDate === "string" && sFromDate.indexOf("/Date(") !== -1) {
            var iTimestamp = parseInt(sFromDate.replace(/\/Date\((\d+)\)\//, "$1"), 10);
            oDate = new Date(iTimestamp);
        } else if (sFromDate instanceof Date) {
            oDate = new Date(sFromDate.getTime());
        } else {
            oDate = new Date(sFromDate);
        }

        if (isNaN(oDate.getTime())) return;

        oDate.setHours(0, 0, 0, 0);
        oDomRef.classList.add(oDate >= oToday ? "regionRowGreen" : "regionRowRed");

    }.bind(this));
},

formatRowHighlight: function (sFromDate) {
    if (!sFromDate) return "None";

    var oDate;

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

            _clearDraftRows: function () {

                const oModel = this.getView().getModel();
                const oTable = this.byId("partMasterHistoryTable");
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
            _onDataReceived: function (oEvent) {

                const oData = oEvent.getParameter("data");
                const aData = (oData && oData.results) ? oData.results : [];

                if (!aData.length) return;

                // 🔥 Build dropdowns
                this._buildFilterDropdowns(aData);
            },

            _buildFilterDropdowns: function (aData) {

                const aFamily = [];
                const aPartCode = [];

                const seenFamily = {};
                const seenPartCode = {};

                aData.forEach(function (oRow) {

                    if (oRow.Family && !seenFamily[oRow.Family]) {
                        seenFamily[oRow.Family] = true;
                        aFamily.push({ Family: oRow.Family });
                    }

                    if (oRow.PartCode && !seenPartCode[oRow.PartCode]) {
                        seenPartCode[oRow.PartCode] = true;
                        aPartCode.push({ PartCode: oRow.PartCode });
                    }
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        Family: aFamily,
                        PartCode: aPartCode
                    }),
                    "filter"
                );
            },



            onApplyFilter: function () {

                const aFamilies = this.byId("filterModelCode").getSelectedKeys();
                const aPartCodes = this.byId("filterEngineType").getSelectedKeys();

                let aFiltered = this._allData || [];

                if (aFamilies.length) {
                    aFiltered = aFiltered.filter(o => aFamilies.includes(o.Family));
                }

                if (aPartCodes.length) {
                    aFiltered = aFiltered.filter(o => aPartCodes.includes(o.PartCode));
                }

                this._isFiltered = true;

                const oTable = this.byId("partMasterHistoryTable");

                // ✅ Deep clone — prevents edits from mutating _allData
                oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
                oTable.bindRows("/");
            },

            onClearFilter: function () {

                this.byId("filterModelCode").removeAllSelectedItems();
                this.byId("filterEngineType").removeAllSelectedItems();

                this._isFiltered = false;

                const oTable = this.byId("partMasterHistoryTable");

                oTable.setModel(this.getView().getModel());
                oTable.bindRows({
                    path: "/PartsInvalidSet",
                    filters: [
                        new sap.ui.model.Filter("Mail", "EQ",
                            this.getView().getModel("viewModel").getProperty("/ASMEmail"))
                    ]
                });
            },

            onNavBack: function () {

                this._clearDraftRows();
             const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("History", {}, true);
            },


        });
    }
);
