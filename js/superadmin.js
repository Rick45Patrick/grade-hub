
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const sections = [
  "overview",
  "staff",
  "classes",
  "subjects",
  "exams",
  "documents",
];

let currentUser = null;

function setMessage(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function showSection(sectionName) {
  if (!sections.includes(sectionName)) return;

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });

  $(`section-${sectionName}`)?.classList.add("active");

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.section === sectionName
    );
  });

  const titles = {
    overview: "Super Admin Overview",
    staff: "Staff Accounts",
    classes: "Classes",
    subjects: "Subjects & Combinations",
    exams: "Exams & Results",
    documents: "Newsletters & Documents",
  };

  $("pageTitle").textContent = titles[sectionName];

  $("sidebar").classList.remove("open");
}

async function requireSuperAdmin() {
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

  currentUser = user;

  $("welcomeText").textContent =
    `Signed in as ${profile.full_name || user.email}`;

  return true;
}

async function countRows(table, queryBuilder) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (queryBuilder) {
    query = queryBuilder(query);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Could not count ${table}:`, error.message);
    return null;
  }

  return count ?? 0;
}

async function loadOverview() {
  setMessage($("overviewMessage"), "Loading overview...");

  const [students, admins, teachers, classes] = await Promise.all([
    countRows("profiles", (query) =>
      query.eq("role", "student")
    ),
    countRows("profiles", (query) =>
      query.eq("role", "admin").eq("is_active", true)
    ),
    countRows("profiles", (query) =>
      query.eq("role", "class_teacher").eq("is_active", true)
    ),
    countRows("classes"),
  ]);

  $("totalStudents").textContent =
    students === null ? "Unavailable" : students;

  $("totalAdmins").textContent =
    admins === null ? "Unavailable" : admins;

  $("totalTeachers").textContent =
    teachers === null ? "Unavailable" : teachers;

  $("totalClasses").textContent =
    classes === null ? "Unavailable" : classes;

  const failed = [students, admins, teachers, classes].some(
    (value) => value === null
  );

  setMessage(
    $("overviewMessage"),
    failed
      ? "Some counts could not be loaded. Check your Supabase RLS policies."
      : "Overview updated.",
    failed ? "error" : "success"
  );
}

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text ?? "";
  return cell;
}

async function loadStaff() {
  const tbody = $("staffTableBody");

  tbody.replaceChildren();

  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 4;
  loadingCell.textContent = "Loading staff...";
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  setMessage($("staffMessage"), "");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "class_teacher"])
    .order("full_name", { ascending: true });

  tbody.replaceChildren();

  if (error) {
    console.error("Could not load staff:", error.message);

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "Could not load staff. Check RLS policies.";
    row.appendChild(cell);
    tbody.appendChild(row);

    setMessage(
      $("staffMessage"),
      "Staff list failed to load. Check your profiles SELECT policy.",
      "error"
    );

    return;
  }

  if (!profiles || profiles.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No staff accounts found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  for (const profile of profiles) {
    const row = document.createElement("tr");

    row.appendChild(
      createCell(profile.full_name || "Unnamed staff")
    );

    const roleCell = document.createElement("td");
    const roleSelect = document.createElement("select");

    for (const [value, label] of [
      ["admin", "Administrator"],
      ["class_teacher", "Class Teacher"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      roleSelect.appendChild(option);
    }

    roleSelect.value = profile.role;
    roleCell.appendChild(roleSelect);
    row.appendChild(roleCell);

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");

    statusBadge.className = profile.is_active
      ? "badge"
      : "badge inactive";

    statusBadge.textContent = profile.is_active
      ? "Active"
      : "Inactive";

    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    const saveButton = document.createElement("button");

    saveButton.type = "button";
    saveButton.className = "button";
    saveButton.textContent = "Save";

    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      try {
        const { error: updateError } = await supabase.rpc(
          "manage_staff_account",
          {
            target_user_id: profile.id,
            new_role: roleSelect.value,
            new_is_active: !profile.is_active,
          }
        );

        if (updateError) {
          throw updateError;
        }

        setMessage(
          $("staffMessage"),
          `Updated ${profile.full_name || "staff account"}.`,
          "success"
        );

        await loadStaff();
        await loadOverview();
      } catch (error) {
        console.error("Staff update failed:", error.message);

        setMessage(
          $("staffMessage"),
          error.message || "Could not update staff account.",
          "error"
        );

        saveButton.disabled = false;
        saveButton.textContent = "Save";
      }
    });

    actionsCell.appendChild(saveButton);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  }
}

async function createStaff(event) {
  event.preventDefault();

  const form = $("createStaffForm");
  const button = $("createStaffButton");
  const message = $("createStaffMessage");

  const name = $("staffName").value.trim();
  const email = $("staffEmail").value.trim();
  const role = $("staffRole").value;
  const password = $("staffPassword").value;

  setMessage(message, "");

  if (password.length < 12 || password.length > 72) {
    setMessage(
      message,
      "The temporary password must be between 12 and 72 characters.",
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
        data?.error || error.message || "Could not create staff account."
      );
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "The server did not confirm account creation."
      );
    }

    setMessage(
      message,
      `Created ${data.staff.full_name} as ${data.staff.role}.`,
      "success"
    );

    form.reset();

    await loadStaff();
    await loadOverview();
  } catch (error) {
    console.error("Staff creation failed:", error.message);

    setMessage(
      message,
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
    alert("Could not sign out: " + error.message);
    return;
  }

  window.location.replace("../index.html");
}

function initializeNavigation() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.section);
    });
  });

  $("mobileMenu").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("refreshOverviewButton").addEventListener(
    "click",
    loadOverview
  );

  $("refreshStaffButton").addEventListener(
    "click",
    loadStaff
  );

  $("createStaffForm").addEventListener(
    "submit",
    createStaff
  );

  $("signOutButton").addEventListener("click", signOut);
}

async function initializeDashboard() {
  initializeNavigation();

  const authorized = await requireSuperAdmin();

  if (!authorized) return;

  await Promise.all([
    loadOverview(),
    loadStaff(),
  ]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);
  alert("Dashboard could not initialize. Check the browser console.");
});
