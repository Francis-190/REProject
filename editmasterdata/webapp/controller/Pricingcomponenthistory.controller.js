sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.Pricingcomponenthistory", {
onInit: async function () {

    const oVM = new sap.ui.model.json.JSONModel({});
    this.getView().setModel(oVM, "viewModel");

    let sASMMail = "siva.durairaj@laderatechnology.com";

    if (sap.ushell && sap.ushell.Container) {
        const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
        sASMMail = oUserInfo.getEmail();
    }

    oVM.setProperty("/ASMEmail", sASMMail);

    const oTable = this.byId("masterTable");

     oTable.bindRows({
        path: "/PricingComponentsInvalidSet",
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
    
},

            onRowsUpdated: function () {
                this._applyRowColors();
            },

_applyRowColors: function () {
    var oTable = this.byId("masterTable");
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

            formatDate: function(vDate) {
    if (!vDate) return "";
    if (typeof vDate === "string") return vDate.substring(0, 10);
    if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
    return "";
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

_buildFilterDropdowns: function (aData) {

    const aModels   = [];
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

    let aFiltered = this._allData || [];

    if (aRegions.length) {
        aFiltered = aFiltered.filter(o => aRegions.includes(o.Region));
    }

    this._isFiltered = true;

    const oTable = this.byId("masterTable");

    // ✅ Deep clone — prevents edits from mutating _allData
    oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
    oTable.bindRows("/");
},
onClearFilter: function () {

    this.byId("filterModelCode").removeAllSelectedItems();

    this._isFiltered = false;

    const oTable = this.byId("masterTable");

    oTable.setModel(this.getView().getModel());
    oTable.bindRows({
        path: "/PricingComponentsInvalidSet",
        filters: [
            new sap.ui.model.Filter("Mail", "EQ",
                this.getView().getModel("viewModel").getProperty("/ASMEmail"))
        ]
    });
},

// ================= CREATE =================

onCreateMasterRow: function () {

    const oVm = this.getView().getModel('viewModel');
    const oMail = oVm.getProperty("/ASMEmail");

    var oTable = this.byId("masterTable");
    var oBinding = oTable.getBinding("rows");

    oBinding.create({
        OperationNo: 0,
        Region: "",
        EngineType: "EV",
        Mail: oMail,
        Helmet: "0.000",
         FromDate:new Date(),
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
        RtoExpense:"0.000",
        Status: "SUBMITTED"
    });
},

_clearDraftRows: function () {

    const oModel = this.getView().getModel();
    const oTable = this.byId("masterTable");
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

onNavBack: function () {

    this._clearDraftRows();

    const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("History", {}, true);
},
      });
    }
  );
  