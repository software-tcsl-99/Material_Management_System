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

// Helper to parse Tally numeric strings (handles commas, currencies/units e.g., "1,200.00 Nos" or "1200.00/Nos")
function parseTallyNumber(str) {
  if (!str) return 0;
  // Trim first, remove commas, then split by slash/whitespace to extract numeric part
  const cleaned = str.toString().trim().replace(/,/g, '').split('/')[0].trim().split(/\s+/)[0];
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// XML Request to export Stock Item Name, Units, Closing Balance, Opening Balance, Opening Rate, and Closing Rate from Tally Prime
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
              <FETCH>Name, BaseUnits, ClosingBalance, OpeningBalance, OpeningRate, ClosingRate, BatchAllocations</FETCH>
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
        name = name.trim();

        // Calculate stock ONLY from Gokul Shirgaon barcodes
        let stock = 0;
        if (item['BATCHALLOCATIONS.LIST']) {
          const rawAllocations = item['BATCHALLOCATIONS.LIST'];
          const allocations = Array.isArray(rawAllocations) ? rawAllocations : [rawAllocations];
          allocations.forEach(alloc => {
            let godownName = '';
            if (alloc.GODOWNNAME) {
              godownName = typeof alloc.GODOWNNAME === 'object' ? alloc.GODOWNNAME._ : alloc.GODOWNNAME;
            }
            if (godownName && godownName.trim().toLowerCase() === 'gokul shirgaon') {
              let qtyStr = '';
              if (alloc.CLOSINGBALANCE) {
                qtyStr = typeof alloc.CLOSINGBALANCE === 'object' ? alloc.CLOSINGBALANCE._ : alloc.CLOSINGBALANCE;
              } else if (alloc.OPENINGBALANCE) {
                qtyStr = typeof alloc.OPENINGBALANCE === 'object' ? alloc.OPENINGBALANCE._ : alloc.OPENINGBALANCE;
              } else if (alloc.ACTUALQTY) {
                qtyStr = typeof alloc.ACTUALQTY === 'object' ? alloc.ACTUALQTY._ : alloc.ACTUALQTY;
              } else if (alloc.BILLEDQTY) {
                qtyStr = typeof alloc.BILLEDQTY === 'object' ? alloc.BILLEDQTY._ : alloc.BILLEDQTY;
              }
              if (qtyStr) {
                stock += Math.abs(parseTallyNumber(qtyStr));
              } else {
                stock += 1;
              }
            }
          });
        }

        // Get unit (fallback if Not Applicable)
        let unit = 'Nos';
        if (item.BASEUNITS) {
          const rawUnit = typeof item.BASEUNITS === 'object' ? (item.BASEUNITS._ || 'Nos') : item.BASEUNITS;
          if (rawUnit && rawUnit.trim() !== '' && rawUnit.trim() !== 'Not Applicable') {
            unit = rawUnit.trim();
          }
        }

        // Get price (ClosingRate fallback to OpeningRate)
        let price = 0;
        let hasClosingRate = false;
        if (item.CLOSINGRATE) {
          const rawClosingRate = typeof item.CLOSINGRATE === 'object' ? item.CLOSINGRATE._ : item.CLOSINGRATE;
          if (rawClosingRate && rawClosingRate.trim() !== '') {
            price = parseTallyNumber(rawClosingRate);
            hasClosingRate = true;
          }
        }
        if (!hasClosingRate && item.OPENINGRATE) {
          const rawOpeningRate = typeof item.OPENINGRATE === 'object' ? item.OPENINGRATE._ : item.OPENINGRATE;
          if (rawOpeningRate && rawOpeningRate.trim() !== '') {
            price = parseTallyNumber(rawOpeningRate);
          }
        }

        // Get group (Parent) and category (clean control characters and Not Applicable)
        let group = (item.PARENT && (typeof item.PARENT === 'object' ? item.PARENT._ : item.PARENT) || '').trim();
        group = group.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (group === 'Not Applicable') {
          group = '';
        }

        let category = (item.CATEGORY && (typeof item.CATEGORY === 'object' ? item.CATEGORY._ : item.CATEGORY) || '').trim();
        category = category.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        if (category === 'Not Applicable') {
          category = '';
        }

        return {
          name: name.trim(),
          unit: unit,
          stock: stock,
          price: price,
          group: group,
          category: category,
        };
      })
      .filter((item) => item.name.length > 0);

    // Filter items matching the user search keyword (case-insensitive) in name, group, or category
    if (search.trim()) {
      const query = search.toLowerCase();
      materials = materials.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.group.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query)
      );
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

exports.createTallyStockJournal = async (transactionId, destinationGodown, materials) => {
  try {
    const liveTallyUrl = process.env.TALLY_LIVE_URL || 'http://localhost:9000';
    if (!liveTallyUrl) return;

    // 1. Fetch active company
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

    const compResponse = await axios.post(liveTallyUrl, COMPANY_QUERY_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 3000
    });

    const parser = new xml2js.Parser({ explicitArray: false });
    const parsedComp = await parser.parseStringPromise(compResponse.data);
    const activeCompanyObj = parsedComp?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
    let companyName = '';
    if (activeCompanyObj) {
      if (typeof activeCompanyObj === 'string') {
        companyName = activeCompanyObj;
      } else if (typeof activeCompanyObj === 'object') {
        if (activeCompanyObj.NAME) {
          companyName = typeof activeCompanyObj.NAME === 'object' ? activeCompanyObj.NAME._ : activeCompanyObj.NAME;
        } else if (activeCompanyObj.$ && activeCompanyObj.$.NAME) {
          companyName = activeCompanyObj.$.NAME;
        }
      }
    }

    if (!companyName) {
      console.warn('No active Tally company found. Skipping Stock Journal creation.');
      return;
    }

    // 2. Format Date (YYYYMMDD) - Always use the 1st day of the month for Tally Educational Mode date compatibility
    const today = new Date();
    const YYYY = today.getFullYear();
    const MM = String(today.getMonth() + 1).padStart(2, '0');
    const dateStr = `${YYYY}${MM}01`;

    // 3. Build XML voucher lines
    let consumptionLines = '';
    let productionLines = '';

    for (const mat of materials) {
      const name = mat.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const qty = mat.quantity;
      const unit = (mat.unit || 'pcs').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const price = mat.price || 0;
      const amount = qty * price;

      // Map barcodes to Batch Allocations
      const matBarcodes = mat.barcodes || [];
      let batchOutLines = '';
      let batchInLines = '';

      if (matBarcodes.length > 0) {
        matBarcodes.forEach(bcObj => {
          const bcStr = typeof bcObj === 'string' ? bcObj : (bcObj.barcode || '');
          if (bcStr) {
            const escapedBc = bcStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            batchOutLines += `
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>${escapedBc}</BATCHNAME>
              <GODOWNNAME>GOKUL SHIRGAON</GODOWNNAME>
              <RATE>${price}</RATE>
              <AMOUNT>${price}</AMOUNT>
              <ACTUALQTY>-1 ${unit}</ACTUALQTY>
              <BILLEDQTY>-1 ${unit}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>`;

            batchInLines += `
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>${escapedBc}</BATCHNAME>
              <GODOWNNAME>${destinationGodown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</GODOWNNAME>
              <RATE>${price}</RATE>
              <AMOUNT>-${price}</AMOUNT>
              <ACTUALQTY>1 ${unit}</ACTUALQTY>
              <BILLEDQTY>1 ${unit}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>`;
          }
        });
      } else {
        // Fallback for requests that do not have barcode items
        batchOutLines = `
        <BATCHALLOCATIONS.LIST>
          <BATCHNAME>Primary Batch</BATCHNAME>
          <GODOWNNAME>GOKUL SHIRGAON</GODOWNNAME>
          <RATE>${price}</RATE>
          <AMOUNT>${amount}</AMOUNT>
          <ACTUALQTY>-${qty} ${unit}</ACTUALQTY>
          <BILLEDQTY>-${qty} ${unit}</BILLEDQTY>
        </BATCHALLOCATIONS.LIST>`;

        batchInLines = `
        <BATCHALLOCATIONS.LIST>
          <BATCHNAME>Primary Batch</BATCHNAME>
          <GODOWNNAME>${destinationGodown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</GODOWNNAME>
          <RATE>${price}</RATE>
          <AMOUNT>-${amount}</AMOUNT>
          <ACTUALQTY>${qty} ${unit}</ACTUALQTY>
          <BILLEDQTY>${qty} ${unit}</BILLEDQTY>
        </BATCHALLOCATIONS.LIST>`;
      }

      // Source/Consumption (Outward)
      consumptionLines += `
      <INVENTORYENTRIESOUT.LIST>
        <STOCKITEMNAME>${name}</STOCKITEMNAME>
        <RATE>${price}</RATE>
        <AMOUNT>${amount}</AMOUNT>
        <ACTUALQTY>-${qty} ${unit}</ACTUALQTY>
        <BILLEDQTY>-${qty} ${unit}</BILLEDQTY>
        ${batchOutLines}
      </INVENTORYENTRIESOUT.LIST>`;

      // Destination/Production (Inward)
      productionLines += `
      <INVENTORYENTRIESIN.LIST>
        <STOCKITEMNAME>${name}</STOCKITEMNAME>
        <RATE>${price}</RATE>
        <AMOUNT>-${amount}</AMOUNT>
        <ACTUALQTY>${qty} ${unit}</ACTUALQTY>
        <BILLEDQTY>${qty} ${unit}</BILLEDQTY>
        ${batchInLines}
      </INVENTORYENTRIESIN.LIST>`;
    }

    const xmlPayload = `
    <ENVELOPE>
      <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Vouchers</ID>
      </HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</SVCURRENTCOMPANY>
          </STATICVARIABLES>
        </DESC>
        <DATA>
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Gokul Shirgaon Godown Transfer" ACTION="Create">
              <DATE>${dateStr}</DATE>
              <VOUCHERTYPENAME>Gokul Shirgaon Godown Transfer</VOUCHERTYPENAME>
              <NARRATION>Material movement dispatch for transaction ${transactionId}</NARRATION>
              ${productionLines}
              ${consumptionLines}
            </VOUCHER>
          </TALLYMESSAGE>
        </DATA>
      </BODY>
    </ENVELOPE>`;

    console.log(`Posting Tally Gokul Shirgaon Godown Transfer for transaction ${transactionId}...`);
    const voucherRes = await axios.post(liveTallyUrl, xmlPayload, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 5000
    });
    console.log('Tally Gokul Shirgaon Godown Transfer response:', voucherRes.data);

    // Wait 500ms for Tally to persist and then query for the auto-generated Voucher Number via Narration
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const queryXml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Collection</TYPE>
          <ID>MatchedVouchers</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVCURRENTCOMPANY>${companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</SVCURRENTCOMPANY>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
              <TDLMESSAGE>
                <COLLECTION NAME="MatchedVouchers" ISINITIALIZE="Yes">
                  <TYPE>Voucher</TYPE>
                  <FETCH>VoucherNumber</FETCH>
                  <FILTER>NarrationFilter</FILTER>
                </COLLECTION>
                <SYSTEM NAME="NarrationFilter" TYPE="Formula">$Narration contains "${transactionId}"</SYSTEM>
              </TDLMESSAGE>
            </TDL>
          </DESC>
        </BODY>
      </ENVELOPE>`;

      const queryRes = await axios.post(liveTallyUrl, queryXml, {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 3000
      });

      const parsedQuery = await parser.parseStringPromise(queryRes.data);
      const rawVoucher = parsedQuery?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
      const vouchers = Array.isArray(rawVoucher) ? rawVoucher : (rawVoucher ? [rawVoucher] : []);
      if (vouchers.length > 0) {
        const vNumObj = vouchers[vouchers.length - 1].VOUCHERNUMBER;
        const vNum = typeof vNumObj === 'string' ? vNumObj : (vNumObj?._ || '');
        if (vNum) {
          console.log(`Extracted Tally voucher number for transaction ${transactionId}: ${vNum}`);
          return vNum;
        }
      }
    } catch (queryErr) {
      console.error(`Failed to query voucher number from Tally for transaction ${transactionId}:`, queryErr.message);
    }
  } catch (err) {
    console.error('Failed to post Gokul Shirgaon Godown Transfer to Tally:', err.message);
  }
};
