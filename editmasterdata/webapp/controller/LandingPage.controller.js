sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("editmasterdata.controller.LandingPage", {

        onInit: function () {

            // // Example:
            // // Get actual role from backend / XSUAA
            // this.actualRole = "SUBMITTER";

            // this._setTileAccess();
        },

        // _setTileAccess: function () {

        //     var oSubmitterTile = this.byId("submitterTile");
        //     var oApproverTile = this.byId("approverTile");

        //     if (this.actualRole === "SUBMITTER") {

        //         oSubmitterTile.setEnabled(true);
        //         oApproverTile.setEnabled(false);

        //     } else if (this.actualRole === "APPROVER") {

        //         oSubmitterTile.setEnabled(false);
        //         oApproverTile.setEnabled(true);
        //     }
        // },

        // onSubmitterPress: function () {

        //     this.getOwnerComponent()
        //         .getRouter()
        //         .navTo("Submitter");
        // },

        // onApproverPress: function () {

        //     this.getOwnerComponent()
        //         .getRouter()
        //         .navTo("Approver");
        // }

    });
});