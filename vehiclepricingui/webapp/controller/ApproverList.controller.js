sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], (BaseController, JSONModel, MessageBox) => {
  "use strict";

  return BaseController.extend("vehiclepricingui.controller.ApproverList", {

    onInit() {

    },


onL1ApproverPress: function () {
    this._openApproval("APPROVER1");
},

onL2ApproverPress: function () {
    this._openApproval("APPROVER2");
},

_openApproval: function (sLevel) {
    this.getOwnerComponent()._sEntryLevel = sLevel;
    try { window.sessionStorage.setItem("entryLevel", sLevel); } catch (e) { /* ignore */ }
    this.getOwnerComponent().getRouter().navTo("vehcileapproval");
}
    
  });
});