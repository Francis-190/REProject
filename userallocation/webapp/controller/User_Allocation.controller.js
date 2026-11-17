sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("userallocation.controller.User_Allocation", {

        onInit: function () {
            // initialization logic here
        },


        formatMailValueState: function (sMail) {
            if (!sMail) return "None";
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sMail) ? "Success" : "Error";
        },

formatRoleText: function (sRole) {
    switch (sRole) {
        case "APPROVER1":  return "Approver 1";
        case "APPROVER2":  return "Approver 2";
        case "APPROVER":   return "Master Data Approver";
        case "SUBMITTER":  return "Submitter";
        default:           return sRole || "";
    }
},

formatRoleState: function (sRole) {
    switch (sRole) {
        case "APPROVER1":  return "Indication08";
        case "APPROVER2":  return "Indication06";
        case "APPROVER":   return "Indication07";
        case "SUBMITTER":  return "Indication03";
        default:           return "None";
    }
},

formatRoleIcon: function (sRole) {
    switch (sRole) {
        case "APPROVER1":
        case "APPROVER2":  return "sap-icon://approvals";
        case "APPROVER":   return "sap-icon://user-edit";
        case "SUBMITTER":  return "sap-icon://create-form";
        default:           return "";
    }
},

        formatApproverCount: function (aData) {
            if (!aData) return 0;

            return aData.filter(function (r) {
                return r.Role === "APPROVER1" || r.Role === "APPROVER2";
            }).length;
        },

        formatSubmitterCount: function (aData) {
            if (!aData) return 0;

            return aData.filter(function (r) {
                return r.Role === "SUBMITTER";
            }).length;
        },



        // ─── CREATE ROW ───────────────────────────────────────────────

        onCreateMasterRow: function () {
            var oTable = this.byId("UserTables");
            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                MessageToast.show("Table binding not ready");
                return;
            }

            oBinding.create({
                Mail: "",
                Role: "APPROVER"   // match the key, not display text
            });
        },

        // ─── SUBMIT ───────────────────────────────────────────────────

        onSubmit: function () {
            var oModel = this.getView().getModel();
            var oTable = this.byId("UserTables");
            var oView = this.getView();

            var oBinding = oTable.getBinding("rows");
            var aContexts = oBinding ? oBinding.getContexts() : [];

            // ── Validate all rows first ────────────────────────────
            var bValid = true;
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            aContexts.forEach(function (oContext) {
                var sMail = oModel.getProperty(oContext.getPath() + "/Mail");
                if (!sMail || !emailRegex.test(sMail)) {
                    bValid = false;
                }
            });

            if (!bValid) {
                MessageBox.error("Please enter valid email addresses for all rows before submitting.");
                return;
            }

            // ── Check for pending changes ──────────────────────────
            var mPending = oModel.getPendingChanges();

            if (!mPending || Object.keys(mPending).length === 0) {
                MessageToast.show("No changes to save");
                return;
            }

            oView.setBusy(true);

            var iPendingWrites = 0;

            aContexts.forEach(function (oContext) {
                var sPath = oContext.getPath();
                var sKey = sPath.substring(1);

                // ── Handle existing (updated) records ──────────────
                if (!oContext.isTransient() && mPending[sKey]) {
                    var sMail = oModel.getProperty(sPath + "/Mail");
                    var sRole = oModel.getProperty(sPath + "/Role");

                    // Remove entry if mail is empty
                    if (!sMail) {
                        oModel.deleteCreatedEntry(oContext);
                        return;
                    }

                    oModel.update(sPath, { Mail: sMail, Role: sRole }, {
                        merge: false
                    });

                    iPendingWrites++;
                }

                // ── Handle new (transient) records ─────────────────
                if (oContext.isTransient()) {
                    iPendingWrites++;
                }
            });

            if (iPendingWrites === 0) {
                oView.setBusy(false);
                MessageToast.show("No changes to save");
                return;
            }

            // ── Submit batch & handle response ─────────────────────
            oModel.attachEventOnce("batchRequestCompleted", function (oEvent) {
                oView.setBusy(false);

                var aRequests = oEvent.getParameter("requests");
                var bHasError = aRequests && aRequests.some(function (oReq) {
                    return oReq.success === false;
                });

                if (bHasError) {
                    MessageBox.error("Some records failed to save. Please check and retry.");
                } else {
                    MessageToast.show("Saved successfully");
                    oBinding.refresh();
                }
            });

            oModel.submitChanges();
        },

        // ─── SEARCH ───────────────────────────────────────────────────

        onSearchUsers: function (oEvent) {
            var sQuery = (oEvent.getParameter("newValue") || "").trim().toLowerCase();
            var oTable = this.byId("UserTables");
            var oView = this.getView();

            if (!this._aAllApprovers) {
                var oModel = oView.getModel();
                oView.setBusy(true);

                oModel.read("/ApproverSet", {
                    success: function (oData) {
                        oView.setBusy(false);
                        this._aAllApprovers = oData.results;

                        // create JSON model
                        this._oSearchModel = new JSONModel();
                        this._oSearchModel.setSizeLimit(999);
                        this.getView().setModel(this._oSearchModel, "search");

                        // set data then bind
                        this._applySearch(sQuery);
                    }.bind(this),
                    error: function () {
                        oView.setBusy(false);
                        MessageToast.show("Failed to load data for search");
                    }
                });
                return;
            }

            this._applySearch(sQuery);
        },

        _applySearch: function (sQuery) {
            if (!this._oSearchModel || !this._aAllApprovers) return;

            var aAll = this._aAllApprovers;

            var aFiltered = !sQuery
                ? aAll.slice() // copy full list
                : aAll.filter(function (oItem) {
                    var sMail = (oItem.Mail || "").toLowerCase();
                    var sRole = (oItem.Role || "").toLowerCase();
                    return sMail.indexOf(sQuery) !== -1 || sRole.indexOf(sQuery) !== -1;
                });

            // set data into model
            this._oSearchModel.setData({ ApproverSet: aFiltered });

            // bind table rows to search model — key fix: use view model not table model
            var oTable = this.byId("UserTables");
            oTable.setModel(this._oSearchModel, "search");
            oTable.bindRows({
                path: "search>/ApproverSet",
                templateShareable: true
            });

            // update visible row count to match results
            var iVisible = Math.min(aFiltered.length || 1, 10);
            oTable.setVisibleRowCount(iVisible);
        },
        // ─── DELETE ROW ───────────────────────────────────────────────

        onDeleteRow: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oModel = this.getView().getModel();

            if (!oContext) return;

            MessageBox.confirm("Remove this user?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        if (oContext.isTransient()) {
                            oContext.delete();
                        } else {
                            oModel.remove(oContext.getPath(), {
                                success: function () { MessageToast.show("Row deleted"); },
                                error: function () { MessageBox.error("Delete failed"); }
                            });
                        }
                    }
                }
            });
        },

        // ─── REFRESH ──────────────────────────────────────────────────

        onRefresh: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oTable = this.byId("UserTables");
            var oBinding = oTable.getBinding("rows");

            oView.setBusy(true);

            oModel.read("/ApproverSet", {
                success: function (oData) {
                    oView.setBusy(false);
                    MessageToast.show("Data refreshed successfully");

                    // refresh binding so table re-renders with latest data
                    if (oBinding) oBinding.refresh();
                },
                error: function (oError) {
                    oView.setBusy(false);
                    MessageBox.error("Failed to refresh data. Please try again.");
                }
            });
        },
        // ─── CLEAR ALL ────────────────────────────────────────────────

        onClearAll: function () {
            var oModel = this.getView().getModel();
            MessageBox.confirm("This will discard all unsaved changes. Continue?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oModel.resetChanges();
                        MessageToast.show("All changes discarded");
                    }
                }
            });
        },

        // ─── CANCEL ───────────────────────────────────────────────────

        onCancel: function () {
            var oModel = this.getView().getModel();
            if (oModel.hasPendingChanges()) {
                MessageBox.confirm("Discard unsaved changes?", {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            oModel.resetChanges();
                        }
                    }
                });
            }
        },

        // ─── EXPORT ───────────────────────────────────────────────────

        onExport: function () {
            var oTable = this.byId("UserTables");
            var oBinding = oTable.getBinding("rows");
            var aContexts = oBinding ? oBinding.getContexts() : [];
            var oModel = this.getView().getModel();

            if (!aContexts.length) {
                MessageToast.show("No data to export");
                return;
            }

            var aRows = aContexts.map(function (oCtx) {
                return {
                    Mail: oModel.getProperty(oCtx.getPath() + "/Mail"),
                    Role: oModel.getProperty(oCtx.getPath() + "/Role")
                };
            });

            var sCSV = "Mail,Role\n" + aRows.map(function (r) {
                return '"' + r.Mail + '","' + r.Role + '"';
            }).join("\n");

            var oBlob = new Blob([sCSV], { type: "text/csv" });
            var sUrl = URL.createObjectURL(oBlob);
            var oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.download = "UserAllocations.csv";
            oLink.click();
            URL.revokeObjectURL(sUrl);
        }

    });
});