/**
 * NOVA GLOBAL ENTERPRISES - PUBLIC WEBSITE + SECURE ADMIN API
 * Bound to the NOVA B2B DATABASE spreadsheet.
 *
 * Public actions: listProducts, listCategories, submitEnquiry
 * Admin actions: adminLogin, adminDashboard, adminListProducts,
 * adminSaveProduct, adminDeleteProduct, adminListEnquiries,
 * adminUpdateEnquiryStatus, adminListCustomers, adminLogout
 *
 * Admin passwords are salted SHA-256 hashes in AdminUsers.
 * Admin sessions are stored server-side in ScriptCache.
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

const ADMIN_SESSION_SECONDS = 21600; // 6 hours

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NOVA Admin")
    .addItem("Create / Reset Admin Login", "createOrResetNOVAAdmin")
    .addToUi();
}

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

/**
 * Run this from the bound spreadsheet after opening/reloading the sheet:
 * NOVA Admin > Create / Reset Admin Login
 */
function createOrResetNOVAAdmin() {
  const ui = SpreadsheetApp.getUi();
  const userPrompt = ui.prompt("NOVA Admin Setup", "Enter admin username:", ui.ButtonSet.OK_CANCEL);
  if (userPrompt.getSelectedButton() !== ui.Button.OK) return;
  const username = clean_(userPrompt.getResponseText(), 80);
  if (!username) throw new Error("Username is required.");

  const passPrompt = ui.prompt("NOVA Admin Setup", "Enter a strong password (minimum 12 characters):", ui.ButtonSet.OK_CANCEL);
  if (passPrompt.getSelectedButton() !== ui.Button.OK) return;
  const password = String(passPrompt.getResponseText() || "");
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");

  const confirmPrompt = ui.prompt("NOVA Admin Setup", "Re-enter the password:", ui.ButtonSet.OK_CANCEL);
  if (confirmPrompt.getSelectedButton() !== ui.Button.OK) return;
  if (password !== String(confirmPrompt.getResponseText() || "")) throw new Error("Passwords do not match.");

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AdminUsers");
  if (!sh) throw new Error("AdminUsers sheet not found. Run initializeNOVA() first.");
  const salt = Utilities.getUuid();
  const hash = hashPassword_(salt, password);
  const rows = readObjects_("AdminUsers");
  const existing = rows.findIndex(r => String(r.username).toLowerCase() === username.toLowerCase());
  const record = [username, salt + ":" + hash, "Active"];
  if (existing >= 0) sh.getRange(existing + 2, 1, 1, 3).setValues([record]);
  else sh.appendRow(record);
  ui.alert("NOVA Admin", "Admin login created/reset successfully. Keep your password private.", ui.ButtonSet.OK);
}

function doGet() {
  return json_({success:true, message:"NOVA API is running."});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    let result;

    switch (action) {
      // Public website actions
      case "listProducts":
        result = {success:true, products:listProducts_()};
        break;
      case "listCategories":
        result = {success:true, categories:listCategories_()};
        break;
      case "submitEnquiry":
        result = submitEnquiry_(body);
        break;

      // Admin actions
      case "adminLogin":
        result = adminLogin_(body);
        break;
      case "adminDashboard":
        requireAdmin_(body.token);
        result = adminDashboard_();
        break;
      case "adminListProducts":
        requireAdmin_(body.token);
        result = {success:true, products:readObjects_("Products")};
        break;
      case "adminSaveProduct":
        requireAdmin_(body.token);
        result = adminSaveProduct_(body.product || {});
        break;
      case "adminDeleteProduct":
        requireAdmin_(body.token);
        result = adminDeleteProduct_(body.id);
        break;
      case "adminListEnquiries":
        requireAdmin_(body.token);
        result = adminListEnquiries_();
        break;
      case "adminUpdateEnquiryStatus":
        requireAdmin_(body.token);
        result = adminUpdateEnquiryStatus_(body.id, body.status);
        break;
      case "adminListCustomers":
        requireAdmin_(body.token);
        result = {success:true, customers:readObjects_("Customers").reverse()};
        break;
      case "adminLogout":
        result = adminLogout_(body.token);
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
  return readObjects_("Products")
    .filter(r => String(r.status || "Active").toLowerCase() === "active")
    .map(r => ({
      id:String(r.id || ""), sku:String(r.sku || ""), name:String(r.name || ""),
      category:String(r.category || ""), short_description:String(r.short_description || ""),
      description:String(r.description || ""), specifications:String(r.specifications || ""),
      image_url:String(r.image_url || ""), datasheet_url:String(r.datasheet_url || ""),
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

function adminLogin_(body) {
  const username = clean_(body.username,80);
  const password = String(body.password || "");
  if (!username || !password) throw new Error("Enter username and password.");

  const cache = CacheService.getScriptCache();
  const attemptKey = "NOVA_LOGIN_FAIL_" + username.toLowerCase();
  const attempts = Number(cache.get(attemptKey) || 0);
  if (attempts >= 5) throw new Error("Too many login attempts. Try again after 15 minutes.");

  const users = readObjects_("AdminUsers");
  const user = users.find(r => String(r.username).toLowerCase() === username.toLowerCase() &&
    String(r.status || "").toLowerCase() === "active");
  if (!user || !verifyPassword_(String(user.password_hash || ""), password)) {
    cache.put(attemptKey, String(attempts + 1), 900);
    throw new Error("Invalid username or password.");
  }

  cache.remove(attemptKey);
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("NOVA_ADMIN_SESSION_" + token, username, ADMIN_SESSION_SECONDS);
  return {success:true, token:token, username:username, expires_in:ADMIN_SESSION_SECONDS};
}

function requireAdmin_(token) {
  const key = "NOVA_ADMIN_SESSION_" + String(token || "");
  const username = CacheService.getScriptCache().get(key);
  if (!username) throw new Error("Admin session expired. Please log in again.");
  return username;
}

function adminLogout_(token) {
  if (token) CacheService.getScriptCache().remove("NOVA_ADMIN_SESSION_" + String(token));
  return {success:true};
}

function adminDashboard_() {
  const products = readObjects_("Products");
  const enquiries = readObjects_("Enquiries");
  const customers = readObjects_("Customers");
  const activeProducts = products.filter(p => String(p.status || "Active").toLowerCase() === "active").length;
  const newEnquiries = enquiries.filter(e => String(e.status || "").toLowerCase() === "new").length;
  return {
    success:true,
    stats:{total_products:products.length,active_products:activeProducts,total_enquiries:enquiries.length,new_enquiries:newEnquiries,total_customers:customers.length},
    recent_enquiries:enquiries.slice(-8).reverse().map(e => {
      const c = customers.find(x => String(x.id) === String(e.customer_id)) || {};
      return {id:e.id,enquiry_no:e.enquiry_no,status:e.status,created_at:e.created_at,customer_name:c.name || "",company:c.company || ""};
    })
  };
}

function adminSaveProduct_(p) {
  const name = clean_(p.name,200);
  if (!name) throw new Error("Product name is required.");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  const rows = readObjects_("Products");
  const id = clean_(p.id,100) || "NOVA-" + Utilities.getUuid().slice(0,8).toUpperCase();
  const existing = rows.findIndex(r => String(r.id) === id);
  const old = existing >= 0 ? rows[existing] : {};
  const now = new Date();
  const record = [
    id, clean_(p.sku,100), name, clean_(p.category,120),
    clean_(p.short_description,300), clean_(p.description,3000),
    clean_(p.specifications,3000), clean_(p.image_url,1000),
    clean_(p.datasheet_url,1000), clean_(p.unit,40),
    clean_(p.status,30) || "Active", old.created_at || now, now
  ];
  if (existing >= 0) sh.getRange(existing + 2, 1, 1, record.length).setValues([record]);
  else sh.appendRow(record);
  return {success:true,id:id,message:existing >= 0 ? "Product updated." : "Product added."};
}

function adminDeleteProduct_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  const rows = readObjects_("Products");
  const index = rows.findIndex(r => String(r.id) === String(id));
  if (index < 0) throw new Error("Product not found.");
  sh.getRange(index + 2, 11).setValue("Inactive");
  sh.getRange(index + 2, 13).setValue(new Date());
  return {success:true,message:"Product marked as Inactive."};
}

function adminListEnquiries_() {
  const enquiries = readObjects_("Enquiries").reverse();
  const customers = readObjects_("Customers");
  const items = readObjects_("EnquiryItems");
  return {
    success:true,
    enquiries:enquiries.map(e => {
      const c = customers.find(x => String(x.id) === String(e.customer_id)) || {};
      return {
        id:e.id,enquiry_no:e.enquiry_no,customer_id:e.customer_id,message:e.message || "",
        status:e.status || "New",created_at:e.created_at,
        customer:{name:c.name || "",company:c.company || "",email:c.email || "",phone:c.phone || "",address:c.address || ""},
        items:items.filter(i => String(i.enquiry_id) === String(e.id))
      };
    })
  };
}

function adminUpdateEnquiryStatus_(id,status) {
  const allowed = ["New","Processing","Quoted","Completed","Cancelled"];
  const normalized = allowed.find(x => x.toLowerCase() === String(status || "").toLowerCase());
  if (!normalized) throw new Error("Invalid enquiry status.");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Enquiries");
  const rows = readObjects_("Enquiries");
  const index = rows.findIndex(r => String(r.id) === String(id));
  if (index < 0) throw new Error("Enquiry not found.");
  sh.getRange(index + 2, 5).setValue(normalized);
  return {success:true,message:"Enquiry status updated."};
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

function hashPassword_(salt,password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + password, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function verifyPassword_(stored,password) {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  return hashPassword_(parts[0],password) === parts[1];
}

function clean_(value,max) {
  return String(value == null ? "" : value).replace(/[<>]/g,"").trim().slice(0,max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
