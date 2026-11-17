const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { getDestination } = require('@sap-cloud-sdk/connectivity');


function buildBatchBody(dataArray) {
  const batchBoundary = `batch_${Date.now()}`;
  const changeSetBoundary = `changeset_${Date.now()}`;

  let body = '';

  body += `--${batchBoundary}\r\n`;
  body += `Content-Type: multipart/mixed; boundary=${changeSetBoundary}\r\n\r\n`;

  dataArray.forEach((item, index) => {
    const payload = JSON.stringify(item);

    body += `--${changeSetBoundary}\r\n`;
    body += `Content-Type: application/http\r\n`;
    body += `Content-Transfer-Encoding: binary\r\n`;
    body += `Content-ID: ${index + 1}\r\n\r\n`;

    body += `POST RegionMasterSet HTTP/1.1\r\n`;
    body += `Content-Type: application/json\r\n`;
    body += `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n`;
    body += `${payload}\r\n`;
  });

  body += `--${changeSetBoundary}--\r\n`;
  body += `--${batchBoundary}--`;

  return { body, batchBoundary };
}



async function ConnectionBackend(req) {

    const backendconnect = await cds.connect.to("vechilePricing");

    const tx = backendconnect.tx(req);

    if (req.event === 'READ') {
        return tx.run(req.query)
    }

    if (req.event === 'CREATE') {

        const dataArray = Array.isArray(req.data) ? req.data : [req.data];

        const { body, batchBoundary } = buildBatchBody(dataArray);

        try {

            /* const csrfResponse1 = await backendconnect.send({
              method: 'GET',
              path: '/RegionMasterSet',
              headers: {
               'X-CSRF-Token': 'Fetch'
             }
            });
            
            console.log('csrfResponse1',csrfResponse1);
            
            
            // const csrfToken = csrfResponse.headers['x-csrf-token'];
            const cookies1 = csrfResponse1['set-cookie']; */

            const destination = await getDestination({ destinationName: 'SAP_QRE_900' });

            const csrfResponse = await executeHttpRequest(destination, {
                method: 'GET',
                url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/RegionMasterSet',
                headers: {
                    'X-CSRF-Token': 'Fetch'
                }
            });

            const csrfToken = csrfResponse.headers['x-csrf-token'];
            const cookies = csrfResponse.headers['set-cookie'];


            console.log('csrfToken',csrfToken);
            console.log('cookies',cookies);


console.log('================= ODATA $BATCH REQUEST =================');
console.log(`POST /sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/$batch`);
console.log(`Content-Type: multipart/mixed; boundary=${batchBoundary}`);
console.log(`Accept: application/json`);
console.log(`X-CSRF-Token: ${csrfToken}`);
console.log(`Cookie: ${cookies}`);
console.log('----------------------------------------------------------');
console.log(body);
console.log('==========================================================');


            const batchResponse = await backendconnect.send({
              method: 'POST',
              path: '/$batch',
              headers: {
                'Content-Type': `multipart/mixed; boundary=${batchBoundary}`,
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken,
                'Cookie': cookies
              },
              data: body
            });

            /* const batchResponse = await executeHttpRequest(destination, {
                method: 'POST',
                url: '/sap/opu/odata/sap/ZSD_VEH_PRIC_AUTOMATION_SRV/$batch',
                headers: {
                    'Content-Type': `multipart/mixed; boundary=${batchBoundary}`,
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'Cookie': cookies
                },
                data: body
            });
 */

            console.log('Batch success', batchResponse);
            return batchResponse;

        } catch (err) {
            console.error('Batch error:', err.message);
            req.reject(500, err.message);
        }
    }


}

module.exports = {
    ConnectionBackend
}