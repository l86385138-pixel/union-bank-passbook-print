import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, setDoc, updateDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBi7YkFM0p3u_3-BrA_VTag_cX0aF1HYZs",
  authDomain: "union-bank-passbook-print.firebaseapp.com",
  projectId: "union-bank-passbook-print",
  storageBucket: "union-bank-passbook-print.firebasestorage.app",
  messagingSenderId: "289761613723",
  appId: "1:289761613723:web:240a9cf2a94d560637b33e",
  measurementId: "G-6EK2CEK9HX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// A second Auth instance creates retailer accounts without signing the admin out.
const retailerApp = initializeApp(firebaseConfig, "retailerCreator");
const retailerAuth = getAuth(retailerApp);
const $ = id => document.getElementById(id);
let user = null;
let role = "";
let records = [];
let retailerRecords = [];

const fields = ["customerName", "accountNumber", "nameTitle", "branchName", "branchPhone", "ifscCode", "branchAddress", "customerId", "guardianName", "relation", "aadhaarMasked", "name2", "name3", "occupation", "address", "openingDate", "issueDate", "modeOperation", "villageAddress", "postOffice", "policeStation", "district", "state", "country", "nomination"];

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginMsg").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (error) {
    $("loginMsg").textContent = "Login failed: " + error.message;
  }
});

$("logout").addEventListener("click", () => signOut(auth));
$("quickLogout").addEventListener("click", () => signOut(auth));

function showPanel(id) {
  ["dashboardPanel", "retailerPanel", "customerPanel", "recordsPanel"].forEach(panelId => {
    const panel = $(panelId);
    if (panel) panel.classList.toggle("hidden", panelId !== id);
  });
  document.querySelectorAll("[data-target]").forEach(button => {
    button.classList.toggle("active", button.dataset.target === id);
  });
}
document.querySelectorAll("[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    showPanel(button.dataset.target);
    const title = {dashboardPanel:"Dashboard",customerPanel:"Passbook Print",recordsPanel:"Customer Records",retailerPanel:"Retailers"}[button.dataset.target] || "Dashboard";
    if ($("portalPageTitle")) $("portalPageTitle").textContent = title;
  });
});
$("quickAddRetailer").addEventListener("click", () => { showPanel("retailerPanel"); if ($("portalPageTitle")) $("portalPageTitle").textContent = "Retailers"; });

onAuthStateChanged(auth, async currentUser => {
  user = currentUser;
  if (!currentUser) {
    $("login").classList.remove("hidden");
    $("app").classList.add("hidden");
    $("logout").classList.add("hidden");
    return;
  }
  try {
    const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (!profileSnap.exists() || !["admin", "retailer"].includes(profileSnap.data().role)) {
      await signOut(auth);
      $("loginMsg").textContent = "Admin/Retailer role सेट नहीं है। Firebase में users/{UID} profile जाँचें।";
      return;
    }
    role = profileSnap.data().role;
    $("app").classList.toggle("retailer-mode", role === "retailer");
    if ($("portalUserLabel")) $("portalUserLabel").textContent = (currentUser.email || "") + " | " + (role === "admin" ? "Admin" : "Retailer");
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("logout").classList.remove("hidden");
    $("userEmail").textContent = currentUser.email || "";
    $("role").textContent = role.toUpperCase();
    if ($("roleStat")) if ($("roleStat")) $("roleStat").textContent = role.toUpperCase();
    $("admin").classList.toggle("hidden", role !== "admin");
    $("sidebar").classList.remove("hidden");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", role !== "admin"));
    $("quickAddRetailer").classList.toggle("hidden", role !== "admin");
    $("retailerPanel").classList.toggle("hidden", role !== "admin");
    $("dashboardMessage").textContent = role === "admin"
      ? "Admin Panel — Retailers और customer records manage करें।"
      : "Retailer Panel — assigned branch के customer details भरें, passbook information print करें और saved records देखें।";
    if ($("portalPageTitle")) $("portalPageTitle").textContent = "Dashboard";
    if ($("statOneLabel")) $("statOneLabel").textContent = role === "admin" ? "Branches" : "Saved Passbook Records";
    if ($("statThreeLabel")) $("statThreeLabel").textContent = role === "admin" ? "Customer Records" : "Recent Records";
    showPanel("dashboardPanel");
    await loadRecords();
    if (role === "admin") await loadRetailers();
    const branchBox = $("assignedBranchInfo");
    const branchMeta = $("assignedBranchMeta");
    if (branchBox) {
      const profile = profileSnap.data();
      const branchDetails = [profile.bankName, profile.branchName && ("Branch: " + profile.branchName), profile.branchCode && ("Branch Code: " + profile.branchCode), profile.ifsc && ("IFSC: " + profile.ifsc), profile.micr && ("MICR: " + profile.micr), profile.branchAddress && ("Address: " + profile.branchAddress)].filter(Boolean);
      branchBox.textContent = role === "retailer" ? (branchDetails.length ? branchDetails.join(" • ") : "आपकी Branch details अभी assign नहीं हैं। Admin से branch assignment करवाएँ।") : "Admin Access — सभी customer records और retailer accounts manage कर सकते हैं।";
      if (branchMeta) branchMeta.textContent = role === "retailer" ? "Passbook Format: " + (profile.passbookFormat || "Not Assigned") : "";
    }
  } catch (error) {
    $("loginMsg").textContent = "Profile/load error: " + error.message;
  }
});

function formData() {
  return Object.fromEntries(fields.map(field => [field, $(field).value.trim()]));
}
function fillForm(record = {}) {
  $("recordId").value = record.id || "";
  fields.forEach(field => { $(field).value = record[field] || ""; });
  $("formMsg").textContent = "";
}
$("new").addEventListener("click", () => fillForm());

$("customerForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!user) return;
  const data = formData();
  $("save").disabled = true;
  try {
    const payload = { ...data, ownerUid: user.uid, updatedAt: serverTimestamp() };
    if ($("recordId").value) {
      await updateDoc(doc(db, "customers", $("recordId").value), payload);
      $("formMsg").textContent = "Record updated.";
    } else {
      payload.createdBy = user.uid;
      payload.createdAt = serverTimestamp();
      const newRecord = await addDoc(collection(db, "customers"), payload);
      $("recordId").value = newRecord.id;
      $("formMsg").textContent = "Record saved.";
    }
    await loadRecords();
  } catch (error) {
    $("formMsg").textContent = "Save failed: " + error.message;
  } finally {
    $("save").disabled = false;
  }
});

async function loadRecords() {
  const recordsQuery = role === "admin"
    ? query(collection(db, "customers"), orderBy("createdAt", "desc"))
    : query(collection(db, "customers"), where("ownerUid", "==", user.uid));
  const snapshot = await getDocs(recordsQuery);
  records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  $("count").textContent = String(records.length);
  if ($("branchCount")) $("branchCount").textContent = String(records.length);
  renderRecords();
}

async function loadRetailers() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    retailerRecords = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.role === "retailer");
    $("retailerCount").textContent = String(retailerRecords.length);
    const body = $("retailers");
    body.replaceChildren();
    if (!retailerRecords.length) {
      body.innerHTML = "<tr><td colspan='4'>No retailers yet</td></tr>";
      return;
    }
    retailerRecords.forEach(retailer => {
      const row = document.createElement("tr");
      [retailer.name || "—", retailer.email || "—", retailer.phone || "—", retailer.role || "retailer"].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      body.append(row);
    });
  } catch (error) {
    $("retailerMsg").textContent = "Retailer list error: " + error.message;
  }
}

$("retailerForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (role !== "admin" || !user) return;
  const button = $("createRetailer");
  button.disabled = true;
  $("retailerMsg").textContent = "Creating retailer...";
  let createdUid = "";
  try {
    const email = $("retailerEmail").value.trim();
    const credential = await createUserWithEmailAndPassword(retailerAuth, email, $("retailerPassword").value);
    createdUid = credential.user.uid;
    await setDoc(doc(db, "users", createdUid), {
      name: $("retailerName").value.trim(),
      email,
      phone: $("retailerPhone").value.trim(),
      role: "retailer",
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    await signOut(retailerAuth);
    $("retailerForm").reset();
    $("retailerMsg").textContent = "Retailer created successfully. Retailer ab apne email aur password se login kar sakta hai.";
    await loadRetailers();
  } catch (error) {
    $("retailerMsg").textContent = "Create failed: " + error.message +
      (createdUid ? " Authentication account bana hai; Firestore profile aur Rules check karein." : "");
  } finally {
    button.disabled = false;
  }
});

function maskAccount(value = "") {
  return value.length < 5 ? "••••" : "•".repeat(Math.min(10, value.length - 4)) + value.slice(-4);
}
function renderRecords() {
  const searchTerm = $("search").value.toLowerCase();
  const body = $("records");
  body.replaceChildren();
  const filtered = records.filter(record =>
    (record.customerName || "").toLowerCase().includes(searchTerm) ||
    (record.accountNumber || "").toLowerCase().includes(searchTerm)
  );
  if (!filtered.length) {
    body.innerHTML = "<tr><td colspan='4'>No records found</td></tr>";
    return;
  }
  filtered.forEach(record => {
    const row = document.createElement("tr");
    [record.customerName || "", maskAccount(record.accountNumber), record.branchName || ""].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const actions = document.createElement("td");
    const openButton = document.createElement("button");
    openButton.className = "mini secondary";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      fillForm(record);
      showPanel("customerPanel");
    });
    actions.append(openButton);
    const printButton = document.createElement("button");
    printButton.className = "mini";
    printButton.textContent = "Print";
    printButton.addEventListener("click", () => {
      fillForm(record);
      showPanel("customerPanel");
      preparePrint();
      printSelected(0);
    });
    actions.append(printButton);
    row.append(actions);
    body.append(row);
  });
}
$("search").addEventListener("input", renderRecords);

function preparePrint() {
  const data = formData();
  const mapping = {
    customerName: ["pName", "pName2"], accountNumber: ["pAccount", "pAccount2"], nameTitle: ["pTitle"],
    branchName: ["pBranch", "pBranch2"], branchPhone: ["pPhone", "pPhone2"], ifscCode: ["pIfsc"], nameTitle: ["pTitle", "pTitle2"],
    branchAddress: ["pBranchAddress", "pBranchAddress2"], customerId: ["pCustomerId", "pCustomerId2"],
    guardianName: ["pGuardian", "pGuardian2"], relation: ["pRelation", "pGuardian2"],
    aadhaarMasked: ["pAadhaar", "pAadhaar2"], name2: ["pNameSecond"], name3: ["pNameThird"],
    occupation: ["pOccupation"], address: ["pAddress"],
    openingDate: ["pDate"], issueDate: ["pIssueDate"], modeOperation: ["pModeOperation"],
    villageAddress: ["pVillage"], postOffice: ["pPostOffice"], policeStation: ["pPoliceStation"],
    district: ["pDistrict"], state: ["pState"], country: ["pCountry", "pCountryTop"], nomination: ["pNomination"]
  };
  Object.entries(mapping).forEach(([field, targets]) => {
    targets.forEach(target => {
      const element = $(target);
      if (element) {
        let value = field === "aadhaarMasked" && data[field] ? "XXXX-XXXX-" + data[field] : (data[field] || "—");
        if (target === "pGuardian2") value = [data.guardianName, data.relation].filter(Boolean).join(" / ") || "—";
        element.textContent = value;
      }
    });
  });
}
function printSelected(page) {
  if (!$("customerName").value.trim() || !$("accountNumber").value.trim()) {
    $("formMsg").textContent = "Customer Name और Account Number भरें।";
    return;
  }
  preparePrint();
  const sheet = $("printSheet");
  sheet.classList.remove("print-only-one", "print-only-two");
  if (page === 1) sheet.classList.add("print-only-one");
  if (page === 2) sheet.classList.add("print-only-two");
  window.print();
  window.setTimeout(() => sheet.classList.remove("print-only-one", "print-only-two"), 500);
}
$("print").addEventListener("click", () => printSelected(1));
$("printPage2").addEventListener("click", () => printSelected(2));
$("printBoth").addEventListener("click", () => printSelected(0));
