
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const TITLES = {
  overview: "Overview",
  staff: "Staff Accounts",
  classes: "Classes Management",
  subjects: "Subjects",
  exams: "Exams & Results",
  documents: "Newsletters",
};

let cachedClasses = [];
let cachedTeachers = [];
let activeAssignments = [];

function setMessage(id, text, type = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = text;
  element.className = "message";
  if (type) element.classList.add(type);
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = String(value);
}

function showSection(name) {
  if (!Object.prototype.hasOwnProperty.call(TITLES, name)) return;

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === `section-${name}`);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });

  setText("pageTitle", TITLES[name]);
  $("sidebar")?.classList.remove("open");

  if (name === "classes") {
    loadClasses().catch((error) => {
      console.error(error);
      setMessage("classesMessage", "Could not load classes.", "error");
    });
    loadTeachers().catch((error) => {
      console.error(error);
      setMessage("assignTeacherMessage", "Could not load teachers.", "error");
    });
  }
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
    console.error("Super Admin verification failed:", error?.message || "Access denied.");
    await supabase.auth.signOut();
    window.location.replace("../index.html");
    return false;
  }

  setText("welcomeText", `Signed in as ${profile.full_name || user.email}`);
  return true;
}

async function countRecords(table, filters = []) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });

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

  const values = await Promise.all([
    countRecords("profiles", [["role", "student"]]),
    countRecords("profiles", [["role", "admin"], ["is_active", true]]),
    countRecords("profiles", [["role", "class_teacher"], ["is_active", true]]),
    countRecords("classes"),
  ]);

  setText("totalStudents", values[0] ?? "Unavailable");
  setText("totalAdmins", values[1] ?? "Unavailable");
  setText("totalTeachers", values[2] ?? "Unavailable");
  setText("totalClasses", values[3] ?? "Unavailable");

  const failed = values.some((value) => value === null);
  setMessage(
    "overviewMessage",
    failed ? "Some totals could not load. Check RLS policies." : "Overview updated.",
    failed ? "error" : "success"
  );
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.appendChild(cell);
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

async function loadStaff() {
  const tbody = $("staffTableBody");
  if (!tbody) return;

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
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Unable to load staff. Check RLS policies.";
    row.appendChild(cell);
    tbody.appendChild(row);
    setMessage("staffMessage", error.message, "error");
    return;
  }

  if (!data?.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No staff accounts found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    setMessage("staffMessage", "No staff accounts found.");
    return;
  }

  for (const person of data) {
    const row = document.createElement("tr");
    appendCell(row, person.full_name || "Unnamed staff");
    appendCell(row, person.role === "admin" ? "Administrator" : "Class Teacher");

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = person.is_active ? "status" : "status inactive";
    badge.textContent = person.is_active ? "Active" : "Inactive";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    tbody.appendChild(row);
  }

  setMessage("staffMessage", `${data.length} staff account(s) loaded.`);
}

async function createStaff(event) {
  event.preventDefault();

  const form = $("createStaffForm");
  const button = $("createStaffButton");
  const name = $("staffName")?.value.trim();
  const email = $("staffEmail")?.value.trim().toLowerCase();
  const role = $("staffRole")?.value;
  const password = $("staffPassword")?.value;

  if (!form || !button || !name || !email || !role || !password) {
    setMessage("createStaffMessage", "Complete every field.", "error");
    return;
  }

  if (password.length < 12 || password.length > 72) {
    setMessage("createStaffMessage", "Temporary passwords must be 12–72 characters.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Creating account...";
  setMessage("createStaffMessage", "");

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) throw new Error("Your session expired. Sign in again.");

    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: { name, email, role, password },
    });

    if (error) throw new Error(data?.error || error.message);
    if (!data?.success) throw new Error(data?.error || "The account was not confirmed.");

    form.reset();
    setMessage("createStaffMessage", `Created ${data.staff.full_name}.`, "success");
    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    console.error("Staff creation failed:", error);
    setMessage("createStaffMessage", error.message || "Could not create account.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Create Account";
  }
}

async function loadTeachers() {
  const select = $("assignmentTeacher");
  if (!select) return;

  select.replaceChildren();
  addOption(select, "", "Select a teacher");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .eq("role", "class_teacher")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Teacher query failed:", error.message);
    setMessage("assignTeacherMessage", `Could not load teachers: ${error.message}`, "error");
    return;
  }

  cachedTeachers = data || [];

  for (const teacher of cachedTeachers) {
    addOption(select, teacher.id, teacher.full_name || "Unnamed teacher");
  }

  if (!cachedTeachers.length) {
    setMessage("assignTeacherMessage", "Create an active Class Teacher account first.", "error");
  } else {
    setMessage("assignTeacherMessage", `${cachedTeachers.length} active teacher(s) available.`);
  }
}

async function loadClasses() {
  const tbody = $("classesTableBody");
  const classSelect = $("assignmentClass");

  if (tbody) {
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "Loading classes...";
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  setMessage("classesMessage", "Loading classes...");

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, grade_level, academic_year, capacity, is_active")
    .order("academic_year", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Classes query failed:", error.message);
    setMessage("classesMessage", `Could not load classes: ${error.message}`, "error");

    if (tbody) {
      tbody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "Unable to load classes.";
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    return;
  }

  cachedClasses = classes || [];

  const { data: assignments, error: assignmentError } = await supabase
    .from("class_teacher_assignments")
    .select("class_id, teacher_id, assigned_at, ended_at")
    .is("ended_at", null);

  if (assignmentError) {
    console.error("Assignments query failed:", assignmentError.message);
    setMessage("classesMessage", `Could not load teacher assignments: ${assignmentError.message}`, "error");
    return;
  }

  activeAssignments = assignments || [];

  const teacherById = new Map(cachedTeachers.map((teacher) => [teacher.id, teacher.full_name || "Unnamed teacher"]));

  if (classSelect) {
    const previousValue = classSelect.value;
    classSelect.replaceChildren();
    addOption(classSelect, "", "Select a class");

    for (const classroom of cachedClasses) {
      if (classroom.is_active) {
        addOption(
          classSelect,
          classroom.id,
          `${classroom.name} (${classroom.academic_year})`
        );
      }
    }

    if (cachedClasses.some((item) => item.id === previousValue)) {
      classSelect.value = previousValue;
    }
  }

  if (!tbody) return;
  tbody.replaceChildren();

  if (!cachedClasses.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No classes have been created yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    setMessage("classesMessage", "Create your first class using the form above.");
    return;
  }

  for (const classroom of cachedClasses) {
    const row = document.createElement("tr");
    appendCell(row, classroom.name);
    appendCell(row, classroom.grade_level);
    appendCell(row, classroom.academic_year);
    appendCell(row, classroom.capacity);

    const assignment = activeAssignments.find((item) => item.class_id === classroom.id);
    appendCell(
      row,
      assignment
        ? (teacherById.get(assignment.teacher_id) || cachedTeachers.find((t) => t.id === assignment.teacher_id)?.full_name || "Assigned")
        : "Not assigned"
    );

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = classroom.is_active ? "status" : "status inactive";
    badge.textContent = classroom.is_active ? "Active" : "Inactive";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = classroom.is_active ? "button danger" : "button secondary";
    actionButton.textContent = classroom.is_active ? "Deactivate" : "Activate";
    actionButton.addEventListener("click", () => toggleClassStatus(classroom));
    actionCell.appendChild(actionButton);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }

  setMessage("classesMessage", `${cachedClasses.length} class(es) loaded.`);
}

async function createClass(event) {
  event.preventDefault();

  const form = $("createClassForm");
  const button = $("createClassButton");

  const name = $("className")?.value.trim();
  const gradeLevel = $("classGrade")?.value.trim();
  const academicYear = $("classYear")?.value.trim();
  const capacity = Number($("classCapacity")?.value);

  if (!form || !button || !name || !gradeLevel || !academicYear) {
    setMessage("createClassMessage", "Complete every field.", "error");
    return;
  }

  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    setMessage("createClassMessage", "Capacity must be a whole number from 1 to 500.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Creating class...";
  setMessage("createClassMessage", "");

  try {
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name,
        grade_level: gradeLevel,
        academic_year: academicYear,
        capacity,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (error) throw error;

    form.reset();
    $("classCapacity").value = "45";
    setMessage("createClassMessage", `Class "${data.name}" created successfully.`, "success");

    await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) {
    console.error("Class creation failed:", error);
    setMessage(
      "createClassMessage",
      error.message || "Could not create class. Check the database schema and policies.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Create Class";
  }
}

async function assignTeacher(event) {
  event.preventDefault();

  const button = $("assignTeacherButton");
  const classId = $("assignmentClass")?.value;
  const teacherId = $("assignmentTeacher")?.value;

  if (!button || !classId || !teacherId) {
    setMessage("assignTeacherMessage", "Select both a class and a teacher.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Assigning...";
  setMessage("assignTeacherMessage", "");

  try {
    const { error } = await supabase.rpc("assign_class_teacher", {
      p_class_id: classId,
      p_teacher_id: teacherId,
    });

    if (error) throw error;

    const teacherName = cachedTeachers.find((teacher) => teacher.id === teacherId)?.full_name || "Teacher";
    const className = cachedClasses.find((item) => item.id === classId)?.name || "class";

    setMessage("assignTeacherMessage", `${teacherName} assigned to ${className}.`, "success");
    await loadClasses();
  } catch (error) {
    console.error("Teacher assignment failed:", error);
    setMessage(
      "assignTeacherMessage",
      error.message || "Could not assign teacher. Check the SQL function and permissions.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Assign Teacher";
  }
}

async function toggleClassStatus(classroom) {
  const action = classroom.is_active ? "deactivate" : "activate";

  if (!window.confirm(`Are you sure you want to ${action} "${classroom.name}"?`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from("classes")
      .update({ is_active: !classroom.is_active })
      .eq("id", classroom.id);

    if (error) throw error;

    setMessage("classesMessage", `Class "${classroom.name}" ${action}d successfully.`, "success");
    await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) {
    console.error("Class status update failed:", error);
    setMessage("classesMessage", error.message || "Could not update class status.", "error");
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

function initializeNavigation() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.section) showSection(button.dataset.section);
    });
  });

  $("mobileMenuButton")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });

  $("signOutButton")?.addEventListener("click", signOut);

  $("refreshOverviewButton")?.addEventListener("click", () => {
    loadOverview().catch((error) => {
      console.error(error);
      setMessage("overviewMessage", "Could not refresh overview.", "error");
    });
  });

  $("refreshStaffButton")?.addEventListener("click", () => {
    loadStaff().catch((error) => {
      console.error(error);
      setMessage("staffMessage", "Could not refresh staff.", "error");
    });
  });

  $("createStaffForm")?.addEventListener("submit", createStaff);
  $("createClassForm")?.addEventListener("submit", createClass);
  $("assignTeacherForm")?.addEventListener("submit", assignTeacher);

  $("refreshClassesButton")?.addEventListener("click", async () => {
    await Promise.all([loadClasses(), loadTeachers()]);
  });
}

async function initializeDashboard() {
  initializeNavigation();

  const authorized = await verifySuperAdmin();
  if (!authorized) return;

  await Promise.all([
    loadOverview(),
    loadStaff(),
    loadClasses(),
    loadTeachers(),
  ]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);
  setMessage("overviewMessage", "Dashboard initialization failed. Check the browser console.", "error");
});
