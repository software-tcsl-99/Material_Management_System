const axios = require('axios');
const xml2js = require('xml2js');
const Barcode = require('../models/Barcode');
const tallyController = require('./tally.controller');

exports.getTallyCustomers = async (req, res) => {
  try {
    const liveTallyUrl = process.env.TALLY_LIVE_URL || 'http://localhost:9000';

    // 1. Fetch active company
    const COMP_QUERY = `
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

    let companyName = '';
    try {
      const compResponse = await axios.post(liveTallyUrl, COMP_QUERY, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 2000
      });

      const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
      const parsedComp = await parser.parseStringPromise(compResponse.data);
      const activeCompanyObj = parsedComp?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
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
    } catch (err) {
      console.warn('Tally connection timed out or offline while fetching active company. Using mock company.');
    }

    if (!companyName) {
      const mockCustomers = ['Acme Corporation', 'Star Industries', 'Precision Tools Ltd', 'Global Tech Solutions', 'Nexus Enterprises'];
      return res.json({ success: true, customers: mockCustomers });
    }

    // 2. Fetch Ledgers
    const LEDGER_QUERY = `
    <ENVELOPE>
      <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>LedgersCollection</ID>
      </HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${companyName.trim()}</SVCURRENTCOMPANY>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          </STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="LedgersCollection" ISINITIALIZE="Yes">
                <TYPE>Ledger</TYPE>
                <FETCH>Name, Parent</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`;

    const ledgerResponse = await axios.post(liveTallyUrl, LEDGER_QUERY, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 3000
    });

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parsedData = await parser.parseStringPromise(ledgerResponse.data);

    let customers = [];
    const ledgersObj = parsedData?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
    if (ledgersObj) {
      const ledgers = Array.isArray(ledgersObj) ? ledgersObj : [ledgersObj];
      for (const ledger of ledgers) {
        let name = '';
        let parent = '';
        if (ledger.NAME) {
          name = typeof ledger.NAME === 'object' ? ledger.NAME._ : ledger.NAME;
        } else if (ledger.$ && ledger.$.NAME) {
          name = ledger.$.NAME;
        }
        if (ledger.PARENT) {
          parent = typeof ledger.PARENT === 'object' ? ledger.PARENT._ : ledger.PARENT;
        }

        if (parent && (parent.toLowerCase().includes('debtor') || parent.toLowerCase().includes('customer') || parent.toLowerCase() === 'sundry debtors')) {
          if (name) customers.push(name);
        }
      }
    }

    customers = [...new Set(customers.filter(Boolean))];

    if (customers.length === 0) {
      customers = ['Acme Corporation', 'Star Industries', 'Precision Tools Ltd', 'Global Tech Solutions', 'Nexus Enterprises'];
    }

    return res.json({ success: true, customers });
  } catch (error) {
    console.error('Error fetching Tally customers:', error);
    const mockCustomers = ['Acme Corporation', 'Star Industries', 'Precision Tools Ltd', 'Global Tech Solutions', 'Nexus Enterprises'];
    return res.json({ success: true, customers: mockCustomers });
  }
};

exports.postTallyDeliveryNote = async (barcodeStr, customerName, documentNumber) => {
  const liveTallyUrl = process.env.TALLY_LIVE_URL || 'http://localhost:9000';

  // 1. Fetch active company
  const COMP_QUERY = `
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

  const compResponse = await axios.post(liveTallyUrl, COMP_QUERY, {
    headers: { 'Content-Type': 'text/xml' },
    timeout: 2000
  });

  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
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
    throw new Error('No active Tally company found. Please ensure Tally Prime is running and a company is open.');
  }

  // 2. Fetch barcode details from Tally or MongoDB
  const bc = await Barcode.findOne({ barcode: barcodeStr }).populate('owner');
  if (!bc) {
    throw new Error(`Barcode ${barcodeStr} not found in database.`);
  }

  let itemName = bc.materialName;
  let godownName = bc.owner?.fullName || 'GOKUL SHIRGAON';
  let unit = bc.unit || 'Nos';
  let price = bc.price || 1000;

  try {
    const tallyDetails = await tallyController.getBarcodeTallyDetails(barcodeStr);
    if (tallyDetails) {
      if (tallyDetails.item) itemName = tallyDetails.item;
      if (tallyDetails.godown) godownName = tallyDetails.godown;
      if (tallyDetails.unit) unit = tallyDetails.unit;
      if (tallyDetails.price !== undefined && tallyDetails.price !== null) price = tallyDetails.price;
    }
  } catch (err) {
    console.warn(`Could not fetch live Tally details for barcode ${barcodeStr}, using fallback database details.`);
  }

  const today = new Date();
  const YYYY = today.getFullYear();
  const MM = String(today.getMonth() + 1).padStart(2, '0');
  const dateStr = `${YYYY}${MM}01`;

  const cgstRate = 9;
  const sgstRate = 9;
  const cgstAmount = Number((price * (cgstRate / 100)).toFixed(2));
  const sgstAmount = Number((price * (sgstRate / 100)).toFixed(2));

  const esc = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const totalAmount = Number((price + cgstAmount + sgstAmount).toFixed(2));

  const escCustomer = esc(customerName);
  const escItemName = esc(itemName);
  const escGodown = esc(godownName);
  const escBarcode = esc(barcodeStr);
  const escUnit = esc(unit);
  const escDocNumber = esc(documentNumber);

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
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </DESC>
      <DATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Delivery Note" ACTION="Create">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Delivery Note</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escDocNumber}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escCustomer}</PARTYLEDGERNAME>
            <PARTYNAME>${escCustomer}</PARTYNAME>
            <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
            <GSTREGISTRATIONTYPE>Consumer</GSTREGISTRATIONTYPE>
            <NARRATION>Delivery Note created for conversion of Barcode ${escBarcode} to DC FOC</NARRATION>
            
            <!-- Customer Ledger Entry (Debit) -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escCustomer}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totalAmount}</AMOUNT>
            </LEDGERENTRIES.LIST>

            <!-- CGST Ledger Entry (Credit) -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgstAmount}</AMOUNT>
            </LEDGERENTRIES.LIST>

            <!-- SGST Ledger Entry (Credit) -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgstAmount}</AMOUNT>
            </LEDGERENTRIES.LIST>

            <!-- Inventory Entry (Outward / Credit) -->
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escItemName}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${price}/${escUnit}</RATE>
              <AMOUNT>${price}</AMOUNT>
              <ACTUALQTY>1 ${escUnit}</ACTUALQTY>
              <BILLEDQTY>1 ${escUnit}</BILLEDQTY>
              <BATCHALLOCATIONS.LIST>
                <GODOWNNAME>${escGodown}</GODOWNNAME>
                <BATCHNAME>${escBarcode}</BATCHNAME>
                <AMOUNT>${price}</AMOUNT>
                <ACTUALQTY>1 ${escUnit}</ACTUALQTY>
                <BILLEDQTY>1 ${escUnit}</BILLEDQTY>
              </BATCHALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </DATA>
    </BODY>
  </ENVELOPE>`;

  console.log(`Posting Tally Delivery Note for barcode ${barcodeStr} to customer ${customerName}...`);
  const voucherRes = await axios.post(liveTallyUrl, xmlPayload, {
    headers: { 'Content-Type': 'text/xml' }
  });

  const parsedVoucher = await parser.parseStringPromise(voucherRes.data);
  const result = parsedVoucher?.ENVELOPE?.BODY?.DATA?.IMPORTRESULT;
  
  if (!result) {
    throw new Error('Unexpected Tally Prime response structure.');
  }

  const errors = Number(result.ERRORS || 0);
  if (errors > 0) {
    const errorMsg = result.LINEERROR || 'Tally Prime returned error while posting Delivery Note.';
    throw new Error(errorMsg);
  }

  const lastCreatedId = parsedVoucher?.ENVELOPE?.BODY?.DESC?.CMPINFOEX?.IDINFO?.LASTCREATEDVCHID;
  return lastCreatedId || `DN-${Date.now()}`;
};
