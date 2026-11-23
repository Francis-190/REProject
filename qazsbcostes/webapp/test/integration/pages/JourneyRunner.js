sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"qazsbcostes/test/integration/pages/ZC_cost_estList.gen",
	"qazsbcostes/test/integration/pages/ZC_cost_estObjectPage.gen"
], function (JourneyRunner, ZC_cost_estListGenerated, ZC_cost_estObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('qazsbcostes') + '/test/flp.html#app-preview',
        pages: {
			onTheZC_cost_estListGenerated: ZC_cost_estListGenerated,
			onTheZC_cost_estObjectPageGenerated: ZC_cost_estObjectPageGenerated
        },
        async: true
    });

    return runner;
});

