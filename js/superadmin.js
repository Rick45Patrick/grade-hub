
import { supabase } from "./supabase.js";

const getElement = (id) => document.getElementById(id);

const SECTION_TITLES = {
  overview: "Overview",
  staff: "Staff Accounts",
  classes: "Classes",
  subjects: "Subjects",
  exams: "Exams & Results",
  documents: "Newsletters",
};

function showMessage(id, message, type = "") {
  const element = getElement(id);
  if (!element) return;

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value;
}

function showSection(name) {
  if (!Object.hasOwn(SECTION_TITLES, name)) return;

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === `section-${name}`);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });

  setText("pageTitle", SECTION_TITLES[name]);

  getElement("sidebar")?.classList.remove("open");
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
    console.error(
      "Super Admin verification failed:",
      profileError?.message || "Account lacks Super Admin access."
    );

    await supabase.auth.signOut();
    window.location.replace("../index.html");
    return false;
  }

  setText(
    "welcomeText",
    `Signed in as ${profile.full_name || user.email}`
  );

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
    console.error(`Count failed for ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
}

async function loadOverview() {
  showMessage("overviewMessage", "Loading overview...");

  const [students, admins, teachers, classes] = await Promise.all([
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

  setText("totalStudents", students === null ? "Unavailable" : students);
  setText("totalAdmins", admins === null ? "Unavailable" : admins);
  setText("totalTeachers", teachers === null ? "Unavailable" : teachers);
  setText("totalClasses", classes === null ? "Unavailable" : classes);

  const failed = [students, admins, teachers, classes].some(
    (value) => value === null
  );

  showMessage(
    "overviewMessage",
    failed
      ? "Some totals could not load. Check your Supabase database policies."
      : "Overview updated.",
    failed ? "error" : "success"
  );
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  row.appendChild(cell);
}

async function loadStaff() {
  const tbody = getElement("staffTableBody");

  if (!tbody) {
    console.error(
      'Missing HTML element "staffTableBody". Check superadmin.html.'
    );
    return;
  }

  tbody.replaceChildren();
  showMessage("staffMessage", "Loading staff...");

  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "class_teacher"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Staff loading failed:", error.message);

    const row = document.createElement("tr");
    appendCell(row, "Unable to load staff. Check your RLS policies.");
    tbody.appendChild(row);

    showMessage("staffMessage", error.message, "error");
    return;
  }

  if (!staff || staff.length === 0) {
    const row = document.createElement("tr");
    appendCell(row, "No staff accounts found.");
    tbody.appendChild(row);

    showMessage("staffMessage", "No staff accounts found.");
    return;
  }

  for (const person of staff) {
    const row = document.createElement("tr");

    appendCell(row, person.full_name || "Unnamed staff");
    appendCell(
      row,
      person.role === "admin" ? "Administrator" : "Class Teacher"
    );

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = person.is_active ? "status" : "status inactive";
    badge.textContent = person.is_active ? "Active" : "Inactive";

    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    tbody.appendChild(row);
  }

  showMessage("staffMessage", `${staff.length} staff account(s) loaded.`);
}

async function createStaff(event) {
  event.preventDefault();

  const form = getElement("createStaffForm");
  const button = getElement("createStaffButton");

  if (!form || !button) {
    console.error("Staff creation form or submit button is missing.");
    return;
  }

  const name = getElement("staffName")?.value.trim();
  const email = getElement("staffEmail")?.value.trim();
  const role = getElement("staffRole")?.value;
  const password = getElement("staffPassword")?.value;

  showMessage("createStaffMessage", "");

  if (!name || !email || !role || !password) {
    showMessage(
      "createStaffMessage",
      "Complete all fields before submitting.",
      "error"
    );
    return;
  }

  if (password.length < 12 || password.length > 72) {
    showMessage(
      "createStaffMessage",
      "The temporary password must be between 12 and 72 characters.",
      "error"
    );
    return;
  }

  if (!["admin", "class_teacher"].includes(role)) {
    showMessage("createStaffMessage", "Choose a valid staff role.", "error");
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
      console.error("Edge Function request failed:", error.message);
      throw new Error(
        data?.error || error.message || "Could not create the account."
      );
    }

    if (!data?.success || !data?.staff) {
      throw new Error(data?.error || "The server did not confirm success.");
    }

    showMessage(
      "createStaffMessage",
      `Created ${data.staff.full_name} as ${data.staff.role}.`,
      "success"
    );

    form.reset();

    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    console.error("Staff account creation failed:", error);

    showMessage(
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
    showMessage("overviewMessage", error.message, "error");
    return;
  }

  window.location.replace("../index.html");
}

function initializeNavigation() {
  // Sidebar navigation
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.section) {
        showSection(button.dataset.section);
      }
    });
  });

  // Mobile menu
  getElement("mobileMenuButton")?.addEventListener("click", () => {
    getElement("sidebar")?.classList.toggle("open");
  });

  // Refresh buttons
  getElement("refreshOverviewButton")?.addEventListener(
    "click",
    loadOverview
  );

  getElement("refreshStaffButton")?.addEventListener(
    "click",
    loadStaff
  );

  // Staff creation
  getElement("createStaffForm")?.addEventListener(
    "submit",
    createStaff
  );

  // Sign out
  getElement("signOutButton")?.addEventListener("click", signOut);
}

async function initializeDashboard() {
  initializeNavigation();

  const authorized = await verifySuperAdmin();
  if (!authorized) return;

  await Promise.all([loadOverview(), loadStaff()]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);

  showMessage(
    "overviewMessage",
    "Dashboard initialization failed. Check the browser console.",
    "error"
  );
});
