/**
 * Script to seed sample stock materials directly into Tally Prime.
 * Usage: node src/scripts/seed-tally-materials.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');
const xml2js = require('xml2js');

const TALLY_URL = process.env.TALLY_LIVE_URL || 'http://127.0.0.1:9000';

const SAMPLE_MATERIALS = [
  { name: 'Torque Wrench 1/2 Inch', unit: 'Nos', qty: 15 },
  { name: 'Digital Multimeter', unit: 'Nos', qty: 25 },
  { name: 'Safety Helmet Blue', unit: 'Nos', qty: 120 },
  { name: 'Heavy Duty ESD Gloves', unit: 'Pairs', qty: 300 },
  { name: 'Cordless Drill 18V', unit: 'Nos', qty: 8 },
  { name: 'Industrial Safety Shoes', unit: 'Pairs', qty: 45 },
  { name: 'Screwdriver Set (Precision)', unit: 'Nos', qty: 30 },
  { name: 'M12 Hex Bolt 50mm', unit: 'Nos', qty: 2500 },
  { name: 'Lithium-Ion Battery Pack 12V', unit: 'Nos', qty: 60 },
  { name: 'Teflon Thread Seal Tape', unit: 'Nos', qty: 150 },
  { name: 'High-Performance Thermal Paste', unit: 'Nos', qty: 40 },
  { name: 'Welding Electrode Pack', unit: 'Packs', qty: 35 }
];

// XML Query to find the currently active/open company in Tally Prime
const COMPANY_QUERY_XML = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ActiveCompanies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ActiveCompanies" ISINITIALIZE="Yes">
            <TYPE>Company</TYPE>
            <FETCH>Name</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

const buildTallySeedingXML = (materials, companyName) => {
  const uniqueUnits = [...new Set(materials.map(m => m.unit))];
  
  const unitMessages = uniqueUnits.map(unitName => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT Action="Create">
            <NAME>${unitName}</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
            <ORIGINALNAME>${unitName}</ORIGINALNAME>
            <DECIMALPLACES>0</DECIMALPLACES>
          </UNIT>
        </TALLYMESSAGE>`).join('');

  const groupMessage = `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKGROUP NAME="MMS Materials" Action="Create">
            <NAME>MMS Materials</NAME>
          </STOCKGROUP>
        </TALLYMESSAGE>`;

  const itemMessages = materials.map(item => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${item.name}" Action="Create">
            <NAME>${item.name}</NAME>
            <PARENT>MMS Materials</PARENT>
            <BASEUNITS>${item.unit}</BASEUNITS>
            <OPENINGBALANCE>${item.qty}</OPENINGBALANCE>
          </STOCKITEM>
        </TALLYMESSAGE>`).join('');

  const escapedCompanyName = companyName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `
  <ENVELOPE>
    <HEADER>
      <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
      <IMPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>All Masters</REPORTNAME>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${escapedCompanyName}</SVCURRENTCOMPANY>
          </STATICVARIABLES>
        </REQUESTDESC>
        <REQUESTDATA>
          ${unitMessages}
          ${groupMessage}
          ${itemMessages}
        </REQUESTDATA>
      </IMPORTDATA>
    </BODY>
  </ENVELOPE>`;
};

const getActiveCompanyName = async () => {
  try {
    const response = await axios.post(TALLY_URL, COMPANY_QUERY_XML, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 4000
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    const rawCompanies = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
    if (!rawCompanies) return null;

    const companies = Array.isArray(rawCompanies) ? rawCompanies : [rawCompanies];
    if (companies.length === 0 || !companies[0]) return null;

    const activeCompany = companies[0];
    const name = typeof activeCompany.NAME === 'string' 
      ? activeCompany.NAME 
      : activeCompany.NAME?._ || activeCompany.NAME?.$?.NAME;

    return name ? name.trim() : null;
  } catch (err) {
    console.error(`  ⚠️ Could not auto-detect active company: ${err.message}`);
    return null;
  }
};

const seedTally = async () => {
  if (!TALLY_URL || TALLY_URL.includes('YOUR_COMPANY_TALLY_IP')) {
    console.error('\n❌ ERROR: Please update TALLY_LIVE_URL in your server\'s .env file first!');
    console.error('Example: TALLY_LIVE_URL=http://127.0.0.1:9000\n');
    process.exit(1);
  }

  console.log(`\n🚀 Connecting to Tally Prime at: ${TALLY_URL}`);
  
  const activeCompany = await getActiveCompanyName();
  if (!activeCompany) {
    console.error('\n❌ ERROR: No active company is currently open/loaded in Tally Prime.');
    console.error('👉 Please reopen Tally Prime, select your company database, and try again.\n');
    process.exit(1);
  }

  console.log(`✅ Detected active company: "${activeCompany}"`);
  console.log(`Sending seeding XML payload...\n`);

  try {
    const xmlPayload = buildTallySeedingXML(SAMPLE_MATERIALS, activeCompany);
    const response = await axios.post(TALLY_URL, xmlPayload, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 10000
    });

    console.log('--- Tally Response ---');
    console.log(response.data);
    console.log('----------------------');

    if (response.data.includes('<CREATED>') || response.data.includes('Created') || response.status === 200) {
      console.log('\n📊 Seeding process completed successfully! Check the report above.');
    } else {
      console.log('\n❌ Failed to seed: Unknown response from Tally.');
    }
  } catch (err) {
    console.log(`\n❌ Error communicating with Tally server: ${err.message}`);
  }
};

seedTally();
