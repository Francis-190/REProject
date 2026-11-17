/*global QUnit*/

sap.ui.define([
	"userallocation/controller/User_Allocation.controller"
], function (Controller) {
	"use strict";

	QUnit.module("User_Allocation Controller");

	QUnit.test("I should test the User_Allocation controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
