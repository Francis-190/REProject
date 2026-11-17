sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.MasterdataHistory", {
  onInit: async function () {

    console.log("INIT WORKING");

    const oVM = new sap.ui.model.json.JSONModel({});
    this.getView().setModel(oVM, "viewModel");

    let sASMMail = "siva.durairaj@laderatechnology.com";

    if (sap.ushell && sap.ushell.Container) {
        const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
        sASMMail = oUserInfo.getEmail();
    }

    oVM.setProperty("/ASMEmail", sASMMail);

    const oTable = this.byId("modelTable");

    oTable.bindRows({
        path: "/ModelInvalidSet",
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

_onDataReceived: function (oEvent) {

    const oData = oEvent.getParameter("data");
    const aData = (oData && oData.results) ? oData.results : [];

    if (!aData.length) return;

    // 🔥 Build dropdowns
    this._buildFilterDropdowns(aData);
},
_buildFilterDropdowns: function (aData) {

    const aModels     = [];
    const aEngineType = [];
    const aCcWatt     = [];
    const aModelFam   = [];  // ✅ added

    const seenModel   = {};
    const seenEngine  = {};
    const seenCc      = {};
    const seenFam     = {};  // ✅ added

    aData.forEach(function (oRow) {

        if (oRow.ModelCode && !seenModel[oRow.ModelCode]) {
            seenModel[oRow.ModelCode] = true;
            aModels.push({
                ModelCode: oRow.ModelCode,
                Display:   oRow.ModelCode,
            });
        }

        if (oRow.EngineType && !seenEngine[oRow.EngineType]) {
            seenEngine[oRow.EngineType] = true;
            aEngineType.push({
                EngineType: oRow.EngineType  // ✅ fixed key — was "Type", XML binds to {filter>EngineType}
            });
        }

        if (oRow.CcWatt && !seenCc[oRow.CcWatt]) {
            seenCc[oRow.CcWatt] = true;
            aCcWatt.push({
                Ccwatt: oRow.CcWatt
            });
        }

        if (oRow.ModelFam && !seenFam[oRow.ModelFam]) {  // ✅ added
            seenFam[oRow.ModelFam] = true;
            aModelFam.push({
                ModelFam: oRow.ModelFam
            });
        }
    });

    this.getView().setModel(
        new sap.ui.model.json.JSONModel({
            Models:     aModels,
            EngineType: aEngineType,
            CcWatt:     aCcWatt,
            ModelFam:   aModelFam   // ✅ added
        }),
        "filter"
    );
},
onApplyFilter: function () {

    const aModelCodes  = this.byId("filterModelCode").getSelectedKeys();
    const aEngineTypes = this.byId("filterEngineType").getSelectedKeys();
    const aCcWatts     = this.byId("filterCcType").getSelectedKeys();
    const aModelFams   = this.byId("filterFamilyType").getSelectedKeys();

    let aFiltered = this._allData || [];

    if (aModelCodes.length) {
        aFiltered = aFiltered.filter(o => aModelCodes.includes(o.ModelCode));
    }

    if (aEngineTypes.length) {
        aFiltered = aFiltered.filter(o => aEngineTypes.includes(o.EngineType));
    }

    if (aCcWatts.length) {
        aFiltered = aFiltered.filter(o => aCcWatts.includes(o.CcWatt));
    }

    if (aModelFams.length) {
        aFiltered = aFiltered.filter(o => aModelFams.includes(o.ModelFam));
    }

    this._isFiltered = true;

    const oTable = this.byId("modelTable");

    // ✅ Deep clone — prevents edits from mutating _allData
    oTable.setModel(new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(aFiltered))));
    oTable.bindRows("/");
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
    var oTable = this.byId("modelTable");
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

onClearFilter: function () {

    this.byId("filterModelCode").removeAllSelectedItems();
    this.byId("filterEngineType").removeAllSelectedItems();
    this.byId("filterCcType").removeAllSelectedItems();
    this.byId("filterFamilyType").removeAllSelectedItems();  // ✅ added

    this._isFiltered = false;

    const oTable = this.byId("modelTable");

    oTable.setModel(this.getView().getModel());
    oTable.bindRows({
        path: "/ModelInvalidSet",
        filters: [
            new sap.ui.model.Filter("Mail", "EQ",
                this.getView().getModel("viewModel").getProperty("/ASMEmail"))
        ]
    });
},
  

_clearDraftRows: function () {

    const oModel = this.getView().getModel();

    // ✅ This removes ALL pending + transient changes
    if (oModel.hasPendingChanges()) {
        oModel.resetChanges();
    }

},

onNavBack: function () {

    this._clearDraftRows();

     const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("History", {}, true);
},
      });
    }
  );
  