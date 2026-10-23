
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const SECTION_TITLES = {
  overview: "Overview",
  staff: "Staff Accounts",
  classes: "Classes",
  subjects: "Subjects",
  exams: "Exams & Results",
  documents: "Newsletters",
};

function message(id, text, type = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = text;
  element.className = "message";

  if (type) element.classList.add(type);
}

function setCount(id, value) {
  const element = $(id);
  if (element) {
    element.textContent = value === null ? "Unavailable" : String(value);
  }
}

function showSection(name) {
  if (!Object.prototype.hasOwnProperty.call(SECTION_TITLES, name)) return;

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === `section-${name}`);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });

  const title = $("pageTitle");
  if (title) title.textContent = SECTION_TITLES[name];

  $("sidebar")?.classList.remove("open");
}

async function verifySuperAdmin() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    window.location.replace("../index.html");
    return false;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "super_admin" || profile.is_active !== true) {
    console.error("Profile verification failed:", error?.message || "Not an active Super Admin.");
    await supabase.auth.signOut();
    window.location.replace("../index.html");
    return false;
  }

  const welcome = $("welcomeText");
  if (welcome) {
    welcome.textContent = `Signed in as ${profile.full_name || user.email}`;
  }

  return true;
}

async function countRecords(table, filters = []) {
  let query = supabase.from(table).select("*", {
    count: "exact",
    head: true,
  });

  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Failed to count ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
}

async function loadOverview() {
  message("overviewMessage", "Loading overview...");

  const results = await Promise.all([
    countRecords("profiles", [["role", "student"]]),
    countRecords("profiles", [["role", "admin"], ["is_active", true]]),
    countRecords("profiles", [["role", "class_teacher"], ["is_active", true]]),
    countRecords("classes"),
  ]);

  setCount("totalStudents", results[0]);
  setCount("totalAdmins", results[1]);
  setCount("totalTeachers", results[2]);
  setCount("totalClasses", results[3]);

  const failed = results.some((result) => result === null);

  message(
    "overviewMessage",
    failed
      ? "Some totals could not load. Check your Supabase RLS policies and database connection."
      : "Overview updated.",
    failed ? "error" : "success"
  );
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.appendChild(cell);
}

async function loadStaff() {
  const tbody = $("staffTableBody");

  if (!tbody) {
    console.error('Missing HTML element: "staffTableBody".');
    message("staffMessage", "The staff table is missing from the HTML.", "error");
    return;
  }

  tbody.replaceChildren();
  message("staffMessage", "Loading staff...");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "class_teacher"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Staff query failed:", error.message);

    const row = document.createElement("tr");
    addCell(row, "Unable to load staff. Check database policies.");
    tbody.appendChild(row);

    message("staffMessage", error.message, "error");
    return;
  }

  if (!data || data.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No staff accounts found.";
    row.appendChild(cell);
    tbody.appendChild(row);

    message("staffMessage", "No staff accounts found.");
    return;
  }

  for (const person of data) {
    const row = document.createElement("tr");

    addCell(row, person.full_name || "Unnamed staff");
    addCell(row, person.role === "admin" ? "Administrator" : "Class Teacher");

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = person.is_active ? "status" : "status inactive";
    badge.textContent = person.is_active ? "Active" : "Inactive";

    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    tbody.appendChild(row);
  }

  message("staffMessage", `${data.length} staff account(s) loaded.`);
}

async function createStaff(event) {
  event.preventDefault();

  const form = $("createStaffForm");
  const button = $("createStaffButton");
  const nameInput = $("staffName");
  const emailInput = $("staffEmail");
  const roleInput = $("staffRole");
  const passwordInput = $("staffPassword");

  if (!form || !button || !nameInput || !emailInput || !roleInput || !passwordInput) {
    console.error("One or more staff form elements are missing.");
    message("createStaffMessage", "The staff form is incomplete. Check superadmin.html.", "error");
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const role = roleInput.value;
  const password = passwordInput.value;

  message("createStaffMessage", "");

  if (!name || !email || !role || !password) {
    message("createStaffMessage", "Complete all fields.", "error");
    return;
  }

  if (password.length < 12 || password.length > 72) {
    message("createStaffMessage", "The temporary password must be 12–72 characters.", "error");
    return;
  }

  if (!["admin", "class_teacher"].includes(role)) {
    message("createStaffMessage", "Select a valid staff role.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Creating account...";

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error("Your session has expired. Sign in again.");
    }

    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: { name, email, role, password },
    });

    if (error) {
      console.error("create-staff request failed:", error.message);
      throw new Error(data?.error || error.message || "Account creation failed.");
    }

    if (!data?.success || !data?.staff) {
      throw new Error(data?.error || "The server did not confirm account creation.");
    }

    message(
      "createStaffMessage",
      `Created ${data.staff.full_name} as ${data.staff.role}.`,
      "success"
    );

    form.reset();

    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    console.error("Staff creation error:", error);

    message(
      "createStaffMessage",
      error instanceof Error ? error.message : "An unexpected error occurred.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Create Account";
  }
}

async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    message("overviewMessage", error.message, "error");
    return;
  }

  window.location.replace("../index.html");
}

function initializeNavigation() {
  // All event listeners below use optional chaining or querySelectorAll.
  // Missing optional controls will not crash dashboard initialization.

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;
      if (section) showSection(section);
    });
  });

  $("mobileMenuButton")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });

  $("refreshOverviewButton")?.addEventListener("click", () => {
    loadOverview().catch((error) => {
      console.error("Overview refresh failed:", error);
      message("overviewMessage", "Could not refresh the overview.", "error");
    });
  });

  $("refreshStaffButton")?.addEventListener("click", () => {
    loadStaff().catch((error) => {
      console.error("Staff refresh failed:", error);
      message("staffMessage", "Could not refresh staff.", "error");
    });
  });

  $("createStaffForm")?.addEventListener("submit", createStaff);
  $("signOutButton")?.addEventListener("click", signOut);
}

async function initializeDashboard() {
  initializeNavigation();

  const authorized = await verifySuperAdmin();
  if (!authorized) return;

  await Promise.all([loadOverview(), loadStaff()]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);
  message(
    "overviewMessage",
    "Dashboard initialization failed. Open the browser console for details.",
    "error"
  );
});
