sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
],
function (Controller,MessageToast) {
    "use strict";

    return Controller.extend("editmasterdata.controller.AdminSelectToEditMasterData", {
        onInit: function () {

        },
         OnModelMaster: function () {


            var oRouter = sap.ui.core.UIComponent.getRouterFor(this)
            oRouter.navTo("AdminMasterdata");
    // var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);

},

OnpricingComponent : function(){

    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminPricingComponent");

    //     var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);
},
OnregionMaster: function(){

    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminRegionMaster");
},

OnpartcodeMaster: function(){
console.log("Hi")
    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminPartcode");

    // var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);
},

OnGMAComponent: function(){
// console.log("Hi")
    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminGmaComponent");
    // var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);
},

OnRTOExpence: function(){
// console.log("Hi")
    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminRtoExpence");
    // var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);
},

OnRTOMaster: function(){
// console.log("Hi")
    var oRouter= sap.ui.core.UIComponent.getRouterFor(this);
    oRouter.navTo("AdminRtoMaster");

    // var message="Currently The Region Master only A Working One"
    // MessageToast.show(message);
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
});
