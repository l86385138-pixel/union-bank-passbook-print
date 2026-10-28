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

const fields = ["customerName", "accountNumber", "branchName", "branchPhone", "branchAddress", "guardianName", "occupation", "address", "openingDate", "nomination"];

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
  button.addEventListener("click", () => showPanel(button.dataset.target));
});
$("quickAddRetailer").addEventListener("click", () => showPanel("retailerPanel"));

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
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("logout").classList.remove("hidden");
    $("userEmail").textContent = currentUser.email || "";
    $("role").textContent = role.toUpperCase();
    $("roleStat").textContent = role.toUpperCase();
    $("admin").classList.toggle("hidden", role !== "admin");
    $("sidebar").classList.toggle("hidden", role !== "admin");
    $("quickAddRetailer").classList.toggle("hidden", role !== "admin");
    $("retailerPanel").classList.toggle("hidden", role !== "admin");
    $("dashboardMessage").textContent = role === "admin"
      ? "Admin Panel — Retailers और customer records manage करें।"
      : "Retailer Panel — अपने customer records manage करें।";
    showPanel(role === "admin" ? "dashboardPanel" : "customerPanel");
    await loadRecords();
    if (role === "admin") await loadRetailers();
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
      preparePrint();
      window.print();
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
    customerName: "pName", accountNumber: "pAccount", branchName: "pBranch",
    branchPhone: "pPhone", branchAddress: "pBranchAddress", guardianName: "pGuardian",
    occupation: "pOccupation", address: "pAddress", openingDate: "pDate", nomination: "pNomination"
  };
  Object.entries(mapping).forEach(([field, target]) => { $(target).textContent = data[field] || "—"; });
}
$("print").addEventListener("click", () => {
  if (!$("customerName").value.trim() || !$("accountNumber").value.trim()) {
    $("formMsg").textContent = "Customer Name और Account Number भरें।";
    return;
  }
  preparePrint();
  window.print();
});
