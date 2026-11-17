/*global QUnit*/

sap.ui.define([
	"editmasterdata/controller/SelectToEditMasterData.controller"
], function (Controller) {
	"use strict";

	QUnit.module("SelectToEditMasterData Controller");

	QUnit.test("I should test the SelectToEditMasterData controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
