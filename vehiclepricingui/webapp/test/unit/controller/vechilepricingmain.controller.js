/*global QUnit*/

sap.ui.define([
	"vehiclepricingui/controller/vechilepricingmain.controller"
], function (Controller) {
	"use strict";

	QUnit.module("vechilepricingmain Controller");

	QUnit.test("I should test the vechilepricingmain controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
