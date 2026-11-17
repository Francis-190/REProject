sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("editmasterdata.controller.Home", {
        onInit: function() {
        },

            onLiveDataPress: function () {
            this.getOwnerComponent().getRouter().navTo("LiveDataRoute");
        },

        onHistoryDataPress: function () {
          console.log("hello");
          
            this.getOwnerComponent().getRouter().navTo("History");
        },

        onLiveDataPress: function () {
            this.getOwnerComponent().getRouter().navTo("SelectToEditMasterData");
        },

  onApproverDataPress: function () {
            this.getOwnerComponent().getRouter().navTo("AdminSelectToEditMasterData");
        },


      });
    }
  );
  