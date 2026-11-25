NOVA GLOBAL ENTERPRISES - ADMIN DASHBOARD INSTALLATION
=====================================================

This package adds a protected Admin Dashboard to the existing GitHub Pages
website and extends the existing Google Apps Script API.

FILES
-----
Code.gs                  Replace the current bound Apps Script Code.gs with this file.
admin.html               Upload to the root of the GitHub repository.
admin.css                Upload to the root of the GitHub repository.
admin.js                 Upload to the root of the GitHub repository.

IMPORTANT: Do not put an admin password or API secret in admin.js.
The dashboard authenticates through Apps Script. Password hashes are stored
in the private Google Sheet AdminUsers tab. Session tokens are stored in
Apps Script CacheService and are kept in browser sessionStorage.

STEP 1 - BACK UP
----------------
Before changing anything, make a copy of your current Apps Script Code.gs.

STEP 2 - UPDATE APPS SCRIPT
---------------------------
1. Open the Google Spreadsheet NOVA B2B DATABASE.
2. Extensions > Apps Script.
3. Replace the existing Code.gs with the Code.gs supplied here.
4. Save.
5. Run initializeNOVA() once only if needed (existing tabs and data are preserved).
6. Return to the spreadsheet and reload it.
7. Use the new menu: NOVA Admin > Create / Reset Admin Login.
8. Enter a username and a strong password (12+ characters). Confirm it.
9. Deploy > Manage deployments > Edit the existing Web App deployment.
10. Select New version, then Deploy. Keep Execute as Me and access as Anyone.
11. Keep using the same /exec URL already configured in app.js and admin.js.

STEP 3 - UPLOAD FRONTEND
-----------------------
Upload admin.html, admin.css, admin.js to the ROOT of the GitHub repository
(the same level as index.html, app.js and style.css). Commit changes.

STEP 4 - OPEN ADMIN
-------------------
https://zenenterprisesadmin-cpu.github.io/nova-global-website/admin.html

Sign in using the username and password created in the NOVA Admin spreadsheet menu.

FEATURES
--------
- Overview cards: total products, active products, total enquiries,
  new enquiries, total customers.
- Product add/edit/deactivate.
- Enquiry review with customer details, requested items and quantities.
- Enquiry status updates: New, Processing, Quoted, Completed, Cancelled.
- Customer list.

SECURITY NOTES
--------------
- Keep the Google Spreadsheet private.
- Do not share admin passwords.
- Do not put passwords or private API keys in GitHub files.
- AdminUsers stores salted SHA-256 password hashes, not plain-text passwords.
- Login has a basic 5-failure / 15-minute username throttle.
- Admin sessions expire after 6 hours or when signed out.
- Use a strong unique password. For production/high traffic, consider a
  dedicated authentication service and stronger rate limiting.
- If a session expires, sign in again.

The existing public website actions (listProducts, listCategories,
submitEnquiry) remain supported.
