/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "editmasterdata/model/models",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/BusyIndicator"
],
    function (UIComponent, Device, models, MessageBox, JSONModel, Filter, FilterOperator, BusyIndicator) {
        "use strict";

        // Only these two roles are considered. APPROVER1 / APPROVER2 are ignored.
        var ROLE_APPROVER = "APPROVER";
        var ROLE_SUBMITTER = "SUBMITTER";

        return UIComponent.extend("editmasterdata.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // global user model (role + counterpart mails)
                this.setModel(new JSONModel({
                    email: "",
                    role: "",
                    isApprover: false,
                    isSubmitter: false,
                    approverEmails: [],   // filled for SUBMITTER (reference / filter only)
                    submitterEmails: []   // filled for APPROVER  (reference / filter only)
                }), "user");

                this.getRouter().initialize();
                this._checkUserRole();
            },

            /**
             * Controllers call this and await it before reading the "user" model:
             *   await this.getOwnerComponent().getRoleReady();
             * @public
             */
            getRoleReady: function () {
                return this._pRoleReady;
            },

            /**
             * Promise wrapper around ODataModel V2 read.
             * @private
             */
            _readP: function (sPath, mParams) {
                var oModel = this.getModel();
                return new Promise(function (resolve, reject) {
                    oModel.read(sPath, Object.assign({ success: resolve, error: reject }, mParams));
                });
            },

            _checkUserRole: function () {
                this._pRoleReady = this._loadRole();
                return this._pRoleReady;
            },

            _loadRole: async function () {
                var oUser = this.getModel("user");
                var sEmail = "siva.durairaj@laderatechnology.com"; // local testing fallback

                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
                    sEmail = oUserInfo.getEmail();
                }

                oUser.setData({
                    email: sEmail,
                    role: "",
                    isApprover: false,
                    isSubmitter: false,
                    approverEmails: [],
                    submitterEmails: []
                });

                BusyIndicator.show(0);
                try {
                    // 1. Logged-in user's own role
                    var oData = await this._readP("/ApproverSet('" + encodeURIComponent(sEmail) + "')");
                    var sRole = oData && oData.Role ? oData.Role.trim().toUpperCase() : "";

                    if (sRole !== ROLE_APPROVER && sRole !== ROLE_SUBMITTER) {
                        MessageBox.error("Role not maintained for this user. Please contact admin.");
                        return;
                    }

                    oUser.setProperty("/role", sRole);
                    oUser.setProperty("/isApprover", sRole === ROLE_APPROVER);
                    oUser.setProperty("/isSubmitter", sRole === ROLE_SUBMITTER);

                    // 2. Counterpart mails (used ONLY as filters / reference, never as ASM name)
                    // var sCounterRole = sRole === ROLE_SUBMITTER ? ROLE_APPROVER : ROLE_SUBMITTER;
                    // var oRes = await this._readP("/ApproverSet", {
                    //     filters: [new Filter("Role", FilterOperator.EQ, sCounterRole)]
                    // });

                    // var aMails = (oRes.results || [])
                    //     .filter(function (r) { return r.Role === sCounterRole; }) // safety net
                    //     .map(function (r) { return r.Mail; });

                    // oUser.setProperty(
                    //     sRole === ROLE_SUBMITTER ? "/approverEmails" : "/submitterEmails",
                    //     aMails
                    // );

                    // 2. Counterpart mails (used ONLY as filters / reference, never as ASM name)
var sCounterRole = sRole === ROLE_SUBMITTER ? ROLE_APPROVER : ROLE_SUBMITTER;

// no $filter: the backend doesn't support it on Role, so read all and filter here
var oRes = await this._readP("/ApproverSet");

var aMails = (oRes.results || [])
    .filter(function (r) {
        return r.Role && r.Role.trim().toUpperCase() === sCounterRole;
    })
    .map(function (r) { return r.Mail; });

oUser.setProperty(
    sRole === ROLE_SUBMITTER ? "/approverEmails" : "/submitterEmails",
    aMails
);
                } catch (oError) {
                    MessageBox.error("Unable to determine user role. Please try again later.");
                    console.error(oError);
                } finally {
                    BusyIndicator.hide();
                }
            }
        });
    }
);