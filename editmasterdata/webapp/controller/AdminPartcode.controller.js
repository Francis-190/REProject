sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library"
    ],
    function (BaseController, Spreadsheet, library) {
        "use strict";

        return BaseController.extend("editmasterdata.controller.AdminPartcode", {
            // onInit: async function () {

            //     const oVM = new sap.ui.model.json.JSONModel({});
            //     this.getView().setModel(oVM, "viewModel");

            //     const oModel = this.getView().getModel();
            //     let sAsmName = "Anad Kumar";
            //     let sASMMail = "anandkumar.n@laderatechnology.com"


            //     if (sap.ushell && sap.ushell.Container) {
            //         const oUserInfo = await sap.ushell.Container.getServiceAsync("UserInfo");
            //         sAsmName = oUserInfo.getFullName();
            //         sASMMail = oUserInfo.getEmail();
            //     }
            //     sAsmName = sAsmName.toUpperCase();

            //     oVM.setProperty("/ASMEmail", sASMMail);
            //     //  oVM.setProperty("/AspEmail", oUserInfo.getEmail());

            //     //  console.log("ASP Logged User:",
            //     //                     oUserInfo.getId(),
            //     //                     oUserInfo.getFullName(),
            //     //                     oUserInfo.getEmail(),
            //     //                     oUserInfo.getFirstName()
            //     //                 );

            //     const oTable = this.byId("AdminpartMasterTable");

            //     // oTable.bindRows({
            //     //     path: "/PricingComponentsSet",
            //     //     filters: [
            //     //         new sap.ui.model.Filter(
            //     //             "sASMMail",
            //     //             sap.ui.model.FilterOperator.EQ,
            //     //             sASMMail
            //     //         )
            //     //     ]
            //     // });

            //     oTable.bindRows({
            //         path: "/PartsSet",
            //         filters: [
            //             new sap.ui.model.Filter({
            //                 path: "Mail", // exact CDS name
            //                 operator: sap.ui.model.FilterOperator.EQ,
            //                 value1: sASMMail
            //             })
            //         ]
            //     });


            // },

                       onInit: async function () {

    const oVM = new sap.ui.model.json.JSONModel({ readOnly: false });
    this.getView().setModel(oVM, "viewModel");

    // 1. wait for the role check in Component.js
    const oComp = this.getOwnerComponent();
    await oComp.getRoleReady();
    const oUser = oComp.getModel("user");

    // own mail: used ONLY when stamping approve / reject
    oVM.setProperty("/ASMEmail", oUser.getProperty("/email"));

    // 2. decide whose data to show (reference / filter only)
    let aViewMails = [];
    if (oUser.getProperty("/isApprover")) {
        aViewMails = [oUser.getProperty("/email")];
    } else if (oUser.getProperty("/isSubmitter")) {
        aViewMails = oUser.getProperty("/approverEmails") || [];
        oVM.setProperty("/readOnly", true);   // submitter only views approver data
    }
    oVM.setProperty("/viewMails", aViewMails);

    const oTable = this.byId("AdminpartMasterTable");

    oTable.bindRows({
        path: "/PartsSet",
        filters: [this._getMailFilter()]
    });
},

_getMailFilter: function () {
    const aMails = this.getView().getModel("viewModel").getProperty("/viewMails") || [];

    // no mails (no role, or none maintained) → match nothing,
    // otherwise an empty filter would return ALL rows
    if (!aMails.length) {
        return new sap.ui.model.Filter("Mail", "EQ", "__NO_ACCESS__");
    }

    const aFilters = aMails.map(function (sMail) {
        return new sap.ui.model.Filter("Mail", "EQ", sMail);
    });

    return aFilters.length === 1
        ? aFilters[0]
        : new sap.ui.model.Filter({ filters: aFilters, and: false }); // OR
},

            formatDate: function (vDate) {
                if (!vDate) return "";
                if (typeof vDate === "string") return vDate.substring(0, 10);
                if (vDate instanceof Date) return vDate.toISOString().substring(0, 10);
                return "";
            },

            // Excel Download
            onDownloadMenuPress: function (oEvent) {
                const oSheet = this.byId("downloadActionSheet");

                if (oSheet) {
                    oSheet.openBy(oEvent.getSource());
                }
            },

            onExcelDownloadAll: function () {

                const oTable = this.byId("AdminpartMasterTable");
                const oBinding = oTable.getBinding("rows");

                if (!oBinding) {
                    sap.m.MessageToast.show("No data available");
                    return;
                }

                const iLength = oBinding.getLength();

                const aContexts =
                    oBinding.getContexts(0, iLength);

                const aData = aContexts.map(function (oContext) {
                    return Object.assign({}, oContext.getObject());
                });

                if (!aData.length) {
                    sap.m.MessageToast.show("No data to download");
                    return;
                }

                // Format Effective Date
                aData.forEach(function (oRow) {

                    if (oRow.FromDate instanceof Date) {

                        oRow.FromDate =
                            oRow.FromDate
                                .toISOString()
                                .substring(0, 10);

                    } else if (
                        typeof oRow.FromDate === "string" &&
                        oRow.FromDate.indexOf("/Date(") === 0
                    ) {

                        const iTime = parseInt(
                            oRow.FromDate.match(/\d+/)[0],
                            10
                        );

                        oRow.FromDate =
                            new Date(iTime)
                                .toISOString()
                                .substring(0, 10);
                    }

                });

                const aAllFields = this._getAllFields();

                this._exportToExcel(
                    aData,
                    aAllFields
                );
            },

            _exportToExcel: function (aData, aSelectedFields) {

                const oSettings = {

                    workbook: {
                        columns: aSelectedFields.map(function (oField) {

                            return {
                                label: oField.label,
                                property: oField.key,
                                type: sap.ui.export.EdmType.String
                            };

                        })
                    },

                    dataSource: aData,

                    fileName: "AdminPartCodeMaster_Export.xlsx"
                };

                const oSheet =
                    new sap.ui.export.Spreadsheet(oSettings);

                oSheet
                    .build()
                    .finally(function () {
                        oSheet.destroy();
                    });
            },

            onExcelDownload: function () {

                const aAllFields = this._getAllFields();

                const oModel = new sap.ui.model.json.JSONModel({
                    fields: aAllFields
                });

                this.getView().setModel(oModel, "fields");

                this.byId("fieldSelectDialog").open();
            },

            _getAllFields: function () {

                return [

                    {
                        key: "Family",
                        label: "Family"
                    },

                    {
                        key: "PartCode",
                        label: "Part Code"
                    },

                    {
                        key: "FromDate",
                        label: "Effective Date"
                    },

                    {
                        key: "PartDescr",
                        label: "Description"
                    },

                    {
                        key: "OeGma",
                        label: "OE/GMA/GMA OE"
                    },

                    {
                        key: "Mrp",
                        label: "MRP"
                    },

                    {
                        key: "MiyCost",
                        label: "MiY Cost"
                    },

                    {
                        key: "MiyMarkup",
                        label: "MiY Markup"
                    },

                    {
                        key: "ExShowOnRoad",
                        label: "Ex showroom / On Road"
                    },

                    {
                        key: "MiyCostPerc",
                        label: "MiY Cost %"
                    },

                    {
                        key: "MiyMarkupPerc",
                        label: "MiY Markup %"
                    }

                ];
            },
            onDownloadSelectedFields: function () {

                const oList = this.byId("fieldList");

                const aSelectedItems =
                    oList.getSelectedItems();

                if (!aSelectedItems.length) {

                    sap.m.MessageToast.show(
                        "Select at least one field"
                    );

                    return;
                }

                const aSelectedFields =
                    aSelectedItems.map(function (oItem) {

                        const oField =
                            oItem
                                .getBindingContext("fields")
                                .getObject();

                        return {
                            key: oField.key,
                            label: oField.label
                        };

                    });


                // IMPORTANT:
                // Use actual Part Code table ID
                const oTable =
                    this.byId("AdminpartMasterTable");

                const oBinding =
                    oTable.getBinding("rows");


                if (!oBinding) {

                    sap.m.MessageToast.show(
                        "No data available"
                    );

                    return;
                }


                const iLength =
                    oBinding.getLength();


                const aContexts =
                    oBinding.getContexts(
                        0,
                        iLength
                    );


                const aData =
                    aContexts.map(function (oContext) {

                        return Object.assign(
                            {},
                            oContext.getObject()
                        );

                    });


                if (!aData.length) {

                    sap.m.MessageToast.show(
                        "No data to download"
                    );

                    return;
                }


                // Format Effective Date
                aData.forEach(function (oRow) {

                    if (oRow.FromDate instanceof Date) {

                        oRow.FromDate =
                            oRow.FromDate
                                .toISOString()
                                .substring(0, 10);

                    } else if (
                        typeof oRow.FromDate === "string" &&
                        oRow.FromDate.indexOf("/Date(") === 0
                    ) {

                        const iTime = parseInt(
                            oRow.FromDate.match(/\d+/)[0],
                            10
                        );

                        oRow.FromDate =
                            new Date(iTime)
                                .toISOString()
                                .substring(0, 10);
                    }

                });


                this._exportToExcel(
                    aData,
                    aSelectedFields
                );


                this.byId(
                    "fieldSelectDialog"
                ).close();
            },
            onCancelDownload: function () {

                this.byId("fieldSelectDialog").close();

            },

            onNavBack: function () {

                const oHistory = sap.ui.core.routing.History.getInstance();
                const sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    const oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("AdminSelectToEditMasterData", {}, true);
                }
            },

            onApprove: function () {

                const oVm = this.getView().getModel("viewModel");
                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("AdminpartMasterTable");
                var oBinding = oTable.getBinding("rows");

                // ✅ Load ALL contexts, not just the visible 100
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                if (!aContexts.length) {
                    sap.m.MessageToast.show("No records found");
                    return;
                }

                this._submitBatchInChunks(aContexts, "APPROVED", null, oMail);
            },

            // ─── REJECT DIALOG ────────────────────────────────────────────────────────
            onReject: function () {

                if (!this._oRejectDialog) {

                    this._oRejectDialog = new sap.m.Dialog({
                        title: "Reject Comment",
                        type: "Message",
                        content: [
                            new sap.m.Label({
                                text: "Enter rejection reason",
                                labelFor: this.createId("rejectComment")
                            }),
                            new sap.m.TextArea(this.createId("rejectComment"), {
                                width: "100%",
                                rows: 4,
                                placeholder: "Enter comment here..."
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            type: "Reject",
                            press: function () {

                                var sComment = this.byId("rejectComment")
                                    .getValue()
                                    .trim();

                                if (!sComment) {
                                    sap.m.MessageToast.show("Please enter comment");
                                    return;
                                }

                                this._oRejectDialog.close();
                                this._executeBulkReject(sComment);

                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function () {
                                this._oRejectDialog.close();
                            }.bind(this)
                        })
                    });
                }

                this.byId("rejectComment").setValue("");
                this._oRejectDialog.open();
            },

            // ─── EXECUTE BULK REJECT ──────────────────────────────────────────────────
            _executeBulkReject: function (sComment) {

                const oVm = this.getView().getModel("viewModel");
                const oMail = oVm.getProperty("/ASMEmail");

                var oTable = this.byId("AdminpartMasterTable");
                var oBinding = oTable.getBinding("rows");

                // ✅ Load ALL contexts, not just the visible 100
                var aContexts = oBinding.getContexts(0, oBinding.getLength());

                if (!aContexts.length) {
                    sap.m.MessageToast.show("No records to reject");
                    return;
                }

                this._submitBatchInChunks(aContexts, "REJECTED", sComment, oMail);
            },

            // ─── CHUNKED BATCH SUBMIT (shared by Approve + Reject) ───────────────────
            _submitBatchInChunks: function (aContexts, sStatus, sComment, sMail) {

                var that = this;
                var oModel = this.getView().getModel();
                var oView = this.getView();
                var oTable = this.byId("AdminpartMasterTable");

                var iChunkSize = 1000;          // ✅ Safe batch size — tune if needed
                var aChunks = [];
                var iTotal = aContexts.length;
                var iSubmitted = 0;
                var iChunkIndex = 0;

                // ── Split contexts into chunks ────────────────────────────────────
                for (var i = 0; i < aContexts.length; i += iChunkSize) {
                    aChunks.push(aContexts.slice(i, i + iChunkSize));
                }

                console.log(
                    "Total contexts:", iTotal,
                    "| Chunks:", aChunks.length,
                    "| ChunkSize:", iChunkSize,
                    "| Status:", sStatus
                );

                oView.setBusy(true);
                oModel.setDeferredGroups(["approveRejectGroup"]);

                function submitNextChunk() {

                    if (iChunkIndex >= aChunks.length) {
                        // ✅ All chunks done
                        oView.setBusy(false);
                        var sLabel = sStatus === "APPROVED" ? "approved" : "rejected";
                        sap.m.MessageToast.show(iSubmitted + " of " + iTotal + " records " + sLabel + " successfully");
                        oTable.getBinding("rows").refresh();
                        return;
                    }

                    var aChunk = aChunks[iChunkIndex];

                    console.log(
                        "Submitting chunk", iChunkIndex + 1,
                        "of", aChunks.length,
                        "→", aChunk.length, "rows"
                    );

                    // ── Queue all PUTs in this chunk into deferred group ──────────
                    aChunk.forEach(function (oContext) {

                        var sPath = oContext.getPath();
                        var oData = Object.assign({}, oContext.getObject());

                        delete oData.__metadata;

                        oData.Status = sStatus;
                        oData.Mail = sMail || oData.Mail;

                        if (sStatus === "REJECTED" && sComment) {
                            oData.Message = sComment;
                        }

                        oModel.update(sPath, oData, {
                            merge: false,
                            groupId: "approveRejectGroup"
                        });
                    });

                    // ── Submit this chunk ─────────────────────────────────────────
                    oModel.submitChanges({
                        groupId: "approveRejectGroup",
                        success: function () {
                            iSubmitted += aChunk.length;
                            iChunkIndex++;
                            console.log("Chunk", iChunkIndex, "done. Total submitted:", iSubmitted);
                            submitNextChunk();     // ✅ Process next chunk sequentially
                        },
                        error: function (oError) {
                            oView.setBusy(false);
                            console.error("Chunk", iChunkIndex + 1, "failed:", oError);

                            var sMessage = "Batch failed at chunk " + (iChunkIndex + 1);
                            try {
                                var oBody = JSON.parse(oError.responseText);
                                if (oBody.error && oBody.error.message && oBody.error.message.value) {
                                    sMessage = oBody.error.message.value;
                                }
                            } catch (e) {
                                if (oError.responseText) {
                                    // Try to extract JSON error from SAP multipart batch response
                                    var sText = oError.responseText;
                                    var iStart = sText.indexOf('{"error"');
                                    if (iStart === -1) iStart = sText.indexOf('{ "error"');
                                    if (iStart !== -1) {
                                        var iEnd = sText.lastIndexOf("}") + 1;
                                        try {
                                            var oInner = JSON.parse(sText.substring(iStart, iEnd));
                                            if (oInner.error && oInner.error.message && oInner.error.message.value) {
                                                sMessage = oInner.error.message.value;
                                            }
                                        } catch (e2) {
                                            sMessage = sText.substring(0, 300);
                                        }
                                    } else {
                                        sMessage = sText.substring(0, 300);
                                    }
                                }
                            }

                            sap.m.MessageBox.error(
                                "Chunk " + (iChunkIndex + 1) + " failed:\n" + sMessage +
                                "\n\n(" + iSubmitted + " of " + iTotal + " rows already saved)"
                            );
                        }
                    });
                }

                submitNextChunk();
            }


        });
    }
);
