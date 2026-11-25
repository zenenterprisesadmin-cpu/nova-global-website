/**
 * NOVA GLOBAL ENTERPRISES - PUBLIC WEBSITE API
 * Google Sheets + GitHub Pages (static HTML/CSS/JS)
 *
 * Bind this script to the NOVA B2B DATABASE spreadsheet.
 * Public actions: listProducts, listCategories, submitEnquiry
 * No API secret is exposed to the website.
 */

const SHEETS = {
  Products: ["id","sku","name","category","short_description","description","specifications","image_url","datasheet_url","unit","status","created_at","updated_at"],
  Categories: ["id","name","description","status"],
  Customers: ["id","name","company","email","phone","address","created_at"],
  Enquiries: ["id","enquiry_no","customer_id","message","status","created_at"],
  EnquiryItems: ["id","enquiry_id","product_id","product_name","sku","unit","quantity","notes"],
  Settings: ["key","value"],
  AdminUsers: ["username","password_hash","status"]
};

function initializeNOVA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    else {
      const first = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0];
      if (first.every(v => v === "")) sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    }
    sh.setFrozenRows(1);
  });
  return "NOVA database initialized.";
}

function doGet(e) {
  // Simple health check only. Data is returned through POST actions.
  return json_({success:true, message:"NOVA API is running."});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    let result;
    switch (action) {
      case "listProducts":
        result = {success:true, products:listProducts_()};
        break;
      case "listCategories":
        result = {success:true, categories:listCategories_()};
        break;
      case "submitEnquiry":
        result = submitEnquiry_(body);
        break;
      default:
        result = {success:false, message:"Action not allowed."};
    }
    return json_(result);
  } catch (err) {
    return json_({success:false, message:String(err && err.message ? err.message : err)});
  }
}

function listProducts_() {
  const rows = readObjects_("Products");
  return rows.filter(r => String(r.status || "Active").toLowerCase() === "active")
    .map(r => ({
      id:String(r.id || ""),
      sku:String(r.sku || ""),
      name:String(r.name || ""),
      category:String(r.category || ""),
      short_description:String(r.short_description || ""),
      description:String(r.description || ""),
      specifications:String(r.specifications || ""),
      image_url:String(r.image_url || ""),
      datasheet_url:String(r.datasheet_url || ""),
      unit:String(r.unit || "")
    }));
}

function listCategories_() {
  const names = {};
  readObjects_("Categories").forEach(r => {
    if (r.name && String(r.status || "Active").toLowerCase() === "active") names[String(r.name)] = true;
  });
  listProducts_().forEach(p => { if (p.category) names[p.category] = true; });
  return Object.keys(names).sort().map(name => ({name:name}));
}

function submitEnquiry_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const customer = body.customer || {};
    const name = clean_(customer.name,100);
    const email = clean_(customer.email,150);
    const phone = clean_(customer.phone,30);
    const company = clean_(customer.company,120);
    const address = clean_(customer.address,500);
    const message = clean_(body.message,3000);
    const items = Array.isArray(body.items) ? body.items.slice(0,50) : [];
    if (!name || !email || !phone) throw new Error("Name, email and phone are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!items.length) throw new Error("Add at least one product to your enquiry.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const customerId = "CUS-" + Utilities.getUuid().slice(0,8).toUpperCase();
    const enquiryId = "ENQ-" + Utilities.getUuid().slice(0,8).toUpperCase();
    const enquiryNo = "NOVA-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + "-" + Math.floor(1000 + Math.random()*9000);
    const now = new Date();

    ss.getSheetByName("Customers").appendRow([customerId,name,company,email,phone,address,now]);
    ss.getSheetByName("Enquiries").appendRow([enquiryId,enquiryNo,customerId,message,"New",now]);

    const itemSheet = ss.getSheetByName("EnquiryItems");
    const productIndex = {};
    listProducts_().forEach(p => productIndex[String(p.id)] = p);
    const rows = items.map(item => {
      const pid = clean_(item.product_id,100);
      const p = productIndex[pid];
      const qty = Math.max(1, Math.min(1000000, parseInt(item.quantity,10) || 1));
      return ["ITM-" + Utilities.getUuid().slice(0,8).toUpperCase(), enquiryId,
        pid, clean_(p ? p.name : item.product_name,200), clean_(p ? p.sku : item.sku,100),
        clean_(p ? p.unit : item.unit,40), qty, ""];
    });
    if (rows.length) itemSheet.getRange(itemSheet.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
    return {success:true, enquiry_no:enquiryNo, message:"Enquiry submitted."};
  } finally {
    lock.releaseLock();
  }
}

function readObjects_(sheetName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  return values.filter(row => row.some(v => v !== "")).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
}
function clean_(value,max) {
  return String(value == null ? "" : value).replace(/[<>]/g,"").trim().slice(0,max);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
