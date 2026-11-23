sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"zsbcostes/test/integration/pages/ZC_cost_estList.gen",
	"zsbcostes/test/integration/pages/ZC_cost_estObjectPage.gen"
], function (JourneyRunner, ZC_cost_estListGenerated, ZC_cost_estObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('zsbcostes') + '/test/flp.html#app-preview',
        pages: {
			onTheZC_cost_estListGenerated: ZC_cost_estListGenerated,
			onTheZC_cost_estObjectPageGenerated: ZC_cost_estObjectPageGenerated
        },
        async: true
    });

    return runner;
});

