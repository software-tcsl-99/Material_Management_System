const axios = require('axios');
const xml2js = require('xml2js');

// XML Query to find the active company in Tally Prime
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

// XML Request to export Stock Item Name, Units, and Closing Balance from Tally Prime for a specific company
const buildLiveStockXML = (companyName) => {
  const escapedCompanyName = companyName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `
  <ENVELOPE>
    <HEADER>
      <VERSION>1</VERSION>
      <TALLYREQUEST>Export</TALLYREQUEST>
      <TYPE>Collection</TYPE>
      <ID>LiveStockItems</ID>
    </HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapedCompanyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="LiveStockItems" ISINITIALIZE="Yes">
              <TYPE>StockItem</TYPE>
              <FETCH>Name, BaseUnits, ClosingBalance</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>`;
};

exports.getLiveInventory = async (req, res) => {
  const { search = '' } = req.query;
  const liveTallyUrl = process.env.TALLY_LIVE_URL;

  if (!liveTallyUrl) {
    return res.json({
      success: false,
      materials: [],
      message: 'TALLY_LIVE_URL environment variable is not configured on the server.',
    });
  }

  try {
    // 1. Check active companies first
    let companyName = null;
    try {
      const compResponse = await axios.post(liveTallyUrl, COMPANY_QUERY_XML, {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 3000 // 3 seconds timeout for active company check
      });

      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(compResponse.data);
      
      const rawCompanies = result?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
      if (rawCompanies) {
        const companies = Array.isArray(rawCompanies) ? rawCompanies : [rawCompanies];
        if (companies.length > 0 && companies[0]) {
          const comp = companies[0];
          companyName = typeof comp.NAME === 'string' 
            ? comp.NAME 
            : comp.NAME?._ || comp.NAME?.$?.NAME;
        }
      }
    } catch (err) {
      console.error('Tally active company query failed:', err.message);
      return res.json({
        success: false,
        materials: [],
        message: 'Tally Prime server is offline or unreachable.'
      });
    }

    if (!companyName) {
      return res.json({
        success: false,
        materials: [],
        message: 'No company is currently open/selected in Tally Prime.'
      });
    }

    // 2. Query stock items for the active company
    const xmlPayload = buildLiveStockXML(companyName.trim());
    const response = await axios.post(liveTallyUrl, xmlPayload, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 5000, // 5 seconds timeout for item fetch
    });

    // Parse Tally's XML response into JSON
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parsedData = await parser.parseStringPromise(response.data);

    const rawItems = parsedData?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || [];
    const stockItems = Array.isArray(rawItems) ? rawItems : [rawItems];

    // Map and sanitize the records
    let materials = stockItems
      .filter((item) => item && (item.NAME || item.$.NAME))
      .map((item) => {
        let name = '';
        if (typeof item.NAME === 'string') {
          name = item.NAME;
        } else if (typeof item.NAME === 'object' && item.NAME._) {
          name = item.NAME._;
        } else if (item.$ && item.$.NAME) {
          name = item.$.NAME;
        }

        let stock = 0;
        if (item.CLOSINGBALANCE) {
          const rawStock =
            typeof item.CLOSINGBALANCE === 'object'
              ? item.CLOSINGBALANCE._
              : item.CLOSINGBALANCE;
          stock = Math.abs(parseFloat(rawStock)) || 0;
        }

        let unit = 'Nos';
        if (item.BASEUNITS) {
          unit = typeof item.BASEUNITS === 'object' ? (item.BASEUNITS._ || 'Nos') : item.BASEUNITS;
        }

        return {
          name: name.trim(),
          unit: unit.trim(),
          stock: stock,
        };
      })
      .filter((item) => item.name.length > 0);

    // Filter items matching the user search keyword (case-insensitive)
    if (search.trim()) {
      const query = search.toLowerCase();
      materials = materials.filter((m) => m.name.toLowerCase().includes(query));
    }

    // Return successfully with the materials
    res.json({ 
      success: true, 
      materials: materials.slice(0, 1000),
      message: `Successfully loaded materials from company: "${companyName.trim()}"`
    });
  } catch (error) {
    console.error('Error fetching live Tally inventory:', error.message);
    res.json({
      success: false,
      materials: [],
      message: 'Failed to retrieve inventory from Tally Prime.',
      error: error.message
    });
  }
};
