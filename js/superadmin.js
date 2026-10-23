
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const sectionNames = [
  "overview",
  "staff",
  "classes",
  "subjects",
  "exams",
  "documents",
];

function setMessage(id, text, type = "") {
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
  if (!sectionNames.includes(name)) return;

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === `section-${name}`);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });

  const titles = {
    overview: "Overview",
    staff: "Staff Accounts",
    classes: "Classes",
    subjects: "Subjects",
    exams: "Exams & Results",
    documents: "Newsletters",
  };

  $("pageTitle").textContent = titles[name];
  $("sidebar").classList.remove("open");
}

async function verifySuperAdmin() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    window.location.replace("../index.html");
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "super_admin" ||
    profile.is_active !== true
  ) {
    await supabase.auth.signOut();
    window.location.replace("../index.html");
    return false;
  }

  $("welcomeText").textContent =
    `Signed in as ${profile.full_name || user.email}`;

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
    console.error(`Could not count ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
}

async function loadOverview() {
  setMessage("overviewMessage", "Loading overview...");

  const results = await Promise.all([
    countRecords("profiles", [["role", "student"]]),
    countRecords("profiles", [
      ["role", "admin"],
      ["is_active", true],
    ]),
    countRecords("profiles", [
      ["role", "class_teacher"],
      ["is_active", true],
    ]),
    countRecords("classes"),
  ]);

  setCount("totalStudents", results[0]);
  setCount("totalAdmins", results[1]);
  setCount("totalTeachers", results[2]);
  setCount("totalClasses", results[3]);

  const failed = results.some((value) => value === null);

  setMessage(
    "overviewMessage",
    failed
      ? "Some counts could not load. Check your database permissions and RLS policies."
      : "Overview updated.",
    failed ? "error" : "success"
  );
}

function addTextCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  row.appendChild(cell);
}

async function loadStaff() {
  const tbody = $("staffTableBody");
  tbody.replaceChildren();

  setMessage("staffMessage", "Loading staff...");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "class_teacher"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Staff query failed:", error.message);

    const row = document.createElement("tr");
    addTextCell(row, "Unable to load staff. Check your RLS policies.");
    tbody.appendChild(row);

    setMessage("staffMessage", "Could not load staff.", "error");
    return;
  }

  if (!data || data.length === 0) {
    const row = document.createElement("tr");
    addTextCell(row, "No staff accounts found.");
    tbody.appendChild(row);
    setMessage("staffMessage", "");
    return;
  }

  for (const staff of data) {
    const row = document.createElement("tr");

    addTextCell(row, staff.full_name || "Unnamed staff");
    addTextCell(
      row,
      staff.role === "admin" ? "Administrator" : "Class Teacher"
    );

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = staff.is_active ? "status" : "status inactive";
    badge.textContent = staff.is_active ? "Active" : "Inactive";

    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    tbody.appendChild(row);
  }

  setMessage("staffMessage", `${data.length} staff account(s) loaded.`);
}

async function createStaff(event) {
  event.preventDefault();

  const button = $("createStaffButton");
  const form = $("createStaffForm");

  const name = $("staffName").value.trim();
  const email = $("staffEmail").value.trim();
  const role = $("staffRole").value;
  const password = $("staffPassword").value;

  setMessage("createStaffMessage", "");

  if (password.length < 12 || password.length > 72) {
    setMessage(
      "createStaffMessage",
      "Use a temporary password between 12 and 72 characters.",
      "error"
    );
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

    const { data, error } = await supabase.functions.invoke(
      "create-staff",
      {
        body: { name, email, role, password },
      }
    );

    if (error) {
      throw new Error(
        data?.error || error.message || "Account creation failed."
      );
    }

    if (!data?.success || !data?.staff) {
      throw new Error(data?.error || "The server did not confirm success.");
    }

    setMessage(
      "createStaffMessage",
      `Created ${data.staff.full_name} as ${data.staff.role}.`,
      "success"
    );

    form.reset();

    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    console.error("Create staff failed:", error);

    setMessage(
      "createStaffMessage",
      error.message || "An unexpected error occurred.",
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
    setMessage("overviewMessage", error.message, "error");
    return;
  }

  window.location.replace("../index.html");
}

function setupNavigation() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.section);
    });
  });

  const mobileMenuButton = $("mobileMenuButton");
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", () => {
      $("sidebar").classList.toggle("open");
    });
  }

  const refreshOverviewButton = $("refreshOverviewButton");
  if (refreshOverviewButton) {
    refreshOverviewButton.addEventListener("click", loadOverview);
  }

  const refreshStaffButton = $("refreshStaffButton");
  if (refreshStaffButton) {
    refreshStaffButton.addEventListener("click", loadStaff);
  }

  const staffForm = $("createStaffForm");
  if (staffForm) {
    staffForm.addEventListener("submit", createStaff);
  }

  const signOutButton = $("signOutButton");
  if (signOutButton) {
    signOutButton.addEventListener("click", signOut);
  }
}

async function initializeDashboard() {
  setupNavigation();

  const authorized = await verifySuperAdmin();
  if (!authorized) return;

  await Promise.all([loadOverview(), loadStaff()]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);
  setMessage(
    "overviewMessage",
    "Dashboard initialization failed. Check the browser console.",
    "error"
  );
});
