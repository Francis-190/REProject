sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/routing/History"
    ],
    function (Controller, History) {
        "use strict";

        return Controller.extend("editmasterdata.controller.History", {

            onInit: function () {
            },

            onNavBack: function () {
                console.log("Back");

                const oHistory = History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Home", {}, true); 
                }
            },

            onHistoryModelMaster: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("MasterdataHistory", {}, true); 
            },
            onHistoryPricingComponent: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Pricingcomponenthistory", {}, true); 
            },
            onHistoryRegionMaster: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("RegionmasterHistory", {}, true); 
            },
            onHistoryPartcodeMaster: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Partcodehistory", {}, true); 
            },
            onHistoryGMAComponent: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Gmacomponenthistory", {}, true); 
            },
            onHistoryRTOExpense: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Rtoexpensehistory", {}, true); 
            },
            onHistoryRTOMaster: function(){

                console.log("hello");
                

                const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("Rtomasterhistory", {}, true); 
            },

            onUserPress: function (oEvent) {

    var oButton = oEvent.getSource();
 
    if (!this._oUserPopover) {

        this._oUserPopover = new sap.m.ResponsivePopover({
            placement: sap.m.PlacementType.Bottom,
            showHeader: false,
            contentWidth: "280px",
            content: [
                new sap.m.VBox({
                    width: "100%",
                    items: [
                        new sap.m.Title({
                            text: "Welcome User!!",
                            level: "H5"
                        }).addStyleClass("sapUiSmallMarginTop sapUiSmallMarginBegin"),

                        new sap.m.Text({
                            text: "{user>/email}"
                        }).addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginBottom"),

                        ]
                })
            ]
        });

        this.getView().addDependent(this._oUserPopover);
    }

    if (this._oUserPopover.isOpen()) {
        this._oUserPopover.close();
    } else {
        this._oUserPopover.openBy(oButton);
    }
}


        });
    }
);