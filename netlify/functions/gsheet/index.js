/**
* Google spreadsheet
*
* POST /.netlify/functions/gsheet
*
* @see env-vars
* GOOGLE_SERVICE_ACCOUNT_EMAIL=
* GOOGLE_PRIVATE_KEY=
* GOOGLE_SPREADSHEET_ID_FROM_URL=
*
* from https://github.com/sw-yx/netlify-google-spreadsheet-demo
*/

const { GoogleSpreadsheet } = require('google-spreadsheet');

if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
throw new Error('no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set');
if (!process.env.GOOGLE_PRIVATE_KEY)
throw new Error('no GOOGLE_PRIVATE_KEY env var set');
if (!process.env.GOOGLE_SPREADSHEET_ID_FROM_URL)
throw new Error('no GOOGLE_SPREADSHEET_ID_FROM_URL env var set');

// https://stackoverflow.com/a/54756327
const groupBy = prop => data => {
  return data.reduce((dict, item) => {
      const { [prop]: _, ...rest } = item;
      dict[item[prop]] = [...(dict[item[prop]] || []), rest];
      return dict;
  }, {});
};

exports.handler = async (event, context) => {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID_FROM_URL);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  });
  await doc.loadInfo();

  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '');
  const segments = path.split('/').filter((e) => e);
  let sheet = doc.sheetsByIndex[0];
  if (segments.length === 1 && segments[0] in doc.sheetsByTitle) {
    sheet = doc.sheetsByTitle[segments[0]];
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
      const rows = await sheet.getRows();
      const serializedRows = rows.map(serializeRow);
      // const result = groupBy('section')(serializedRows);
      const result = Object.entries(groupBy('section')(serializedRows))
        .map(([key, value]) => ({ name: key, children: value }));
      return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      };
      default:
      return {
        statusCode: 500,
        body: 'unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE'
      };
    }
  }
  catch (err) {
    console.error('error ocurred in processing ', event);
    console.error(err);
    return {
      statusCode: 500,
      body: err.toString()
    };
  }

  /**
   * utils
   */
  function serializeRow(row) {
    let temp = {};
    sheet.headerValues.map((header) => {
      temp[header] = row[header];
    });
    return temp;
  }
};
