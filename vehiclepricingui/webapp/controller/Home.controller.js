sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("vehiclepricingui.controller.Home", {

        onInit: function () {

        },

        onPricingTilePress: function () {
            this.getOwnerComponent().getRouter().navTo("vechilepricingmain");
        },

        onApprovalTilePress: function () {

            this.getOwnerComponent().getRouter().navTo("approverList");
        }
    });
});