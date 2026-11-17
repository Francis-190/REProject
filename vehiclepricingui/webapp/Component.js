sap.ui.define([
    "sap/ui/core/UIComponent",
    "vehiclepricingui/model/models",
    "sap/m/MessageBox"
], (UIComponent, models, MessageBox) => {
    "use strict";

    return UIComponent.extend("vehiclepricingui.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
    UIComponent.prototype.init.apply(this, arguments);
    this.setModel(models.createDeviceModel(), "device");

    this.getRouter().initialize();
    this._initialRedirect();
},

_initialRedirect: async function () {
    const oRouter = this.getRouter();
    const oData = await this._checkUserRole();

    if (!oData || !oData.Role) {
        MessageBox.error("Role not maintained for this user. Please contact admin.");
        oRouter.navTo("noAccess", {}, true);
        return;
    }

    // Only go home if the user did not open a specific page
    const sHash = oRouter.getHashChanger().getHash();
    if (!sHash || sHash === "home") {
        oRouter.navTo("home", {}, true);
    }
},

// Pure lookup: no navigation, safe to call from any controller
_checkUserRole: async function () {
    const oModel = this.getModel();

    let sEmail = "francisajay.ds@laderatechnology.com"; // local testing only
    if (sap.ushell && sap.ushell.Container) {
        const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");

        console.log(oUserInfo);
        
        sEmail = oUserInfo.getEmail() || sEmail;
    }

    try {
        const oData = await oModel.bindContext(`/ApproverSet('${sEmail}')`).requestObject();

        if (oData && oData.Role) {
            this.setModel(new sap.ui.model.json.JSONModel({
                role: oData.Role,
                isSubmitter: oData.Role === "SUBMITTER"
            }), "role");
        }
        return oData;
    } catch (oError) {
        console.error(oError);
        return null;
    }
}
    });
});