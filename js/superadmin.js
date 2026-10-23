
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const TITLES = {
  overview: "Overview",
  staff: "Staff Accounts",
  classes: "Classes Management",
  subjects: "Subjects & Combinations",
  exams: "Exams & Results",
  documents: "Newsletters",
};

let cachedClasses = [];
let cachedTeachers = [];
let cachedSubjects = [];
let cachedCombinations = [];
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

function setButtonBusy(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.appendChild(cell);
  return cell;
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
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
    Promise.all([loadClasses(), loadTeachers()]).catch((error) => {
      console.error("Classes section loading failed:", error);
    });
  }

  if (name === "subjects") {
    Promise.all([loadSubjects(), loadCombinations()]).catch((error) => {
      console.error("Subjects section loading failed:", error);
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

  if (
    error ||
    !profile ||
    profile.role !== "super_admin" ||
    profile.is_active !== true
  ) {
    console.error(
      "Super Admin verification failed:",
      error?.message || "Access denied."
    );

    await supabase.auth.signOut();
    window.location.replace("../index.html");
    return false;
  }

  setText("welcomeText", `Signed in as ${profile.full_name || user.email}`);
  return true;
}

/* OVERVIEW */

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

  const values = await Promise.all([
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

  setText("totalStudents", values[0] ?? "Unavailable");
  setText("totalAdmins", values[1] ?? "Unavailable");
  setText("totalTeachers", values[2] ?? "Unavailable");
  setText("totalClasses", values[3] ?? "Unavailable");

  const failed = values.some((value) => value === null);

  setMessage(
    "overviewMessage",
    failed
      ? "Some totals could not load. Check your database policies."
      : "Overview updated.",
    failed ? "error" : "success"
  );
}

/* STAFF ACCOUNTS */

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
    const cell = addCell(row, error.message);
    cell.colSpan = 3;
    tbody.appendChild(row);

    setMessage("staffMessage", "Could not load staff.", "error");
    return;
  }

  if (!data?.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No staff accounts found.");
    cell.colSpan = 3;
    tbody.appendChild(row);
    setMessage("staffMessage", "No staff accounts found.");
    return;
  }

  for (const person of data) {
    const row = document.createElement("tr");

    addCell(row, person.full_name || "Unnamed staff");
    addCell(
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
    setMessage(
      "createStaffMessage",
      "Temporary passwords must be 12–72 characters.",
      "error"
    );
    return;
  }

  setButtonBusy(button, true, "Creating account...", "Create Account");
  setMessage("createStaffMessage", "");

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error("Your session expired. Sign in again.");
    }

    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: { name, email, role, password },
    });

    if (error) throw new Error(data?.error || error.message);
    if (!data?.success || !data?.staff) {
      throw new Error(data?.error || "The account was not confirmed.");
    }

    form.reset();

    setMessage(
      "createStaffMessage",
      `Created ${data.staff.full_name} successfully.`,
      "success"
    );

    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    console.error("Staff creation failed:", error);
    setMessage(
      "createStaffMessage",
      error.message || "Could not create account.",
      "error"
    );
  } finally {
    setButtonBusy(button, false, "", "Create Account");
  }
}

/* CLASSES */

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
    setMessage("assignTeacherMessage", error.message, "error");
    return;
  }

  cachedTeachers = data || [];

  for (const teacher of cachedTeachers) {
    addOption(
      select,
      teacher.id,
      teacher.full_name || "Unnamed teacher"
    );
  }

  if (!cachedTeachers.length) {
    setMessage(
      "assignTeacherMessage",
      "Create an active Class Teacher account first.",
      "error"
    );
  }
}

async function loadClasses() {
  const tbody = $("classesTableBody");
  const classSelect = $("assignmentClass");

  setMessage("classesMessage", "Loading classes...");

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, grade_level, academic_year, capacity, is_active")
    .order("academic_year", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Classes query failed:", error.message);
    setMessage("classesMessage", error.message, "error");
    return;
  }

  cachedClasses = classes || [];

  const { data: assignments, error: assignmentError } = await supabase
    .from("class_teacher_assignments")
    .select("class_id, teacher_id, ended_at")
    .is("ended_at", null);

  if (assignmentError) {
    console.error("Teacher assignments query failed:", assignmentError.message);
    setMessage("classesMessage", assignmentError.message, "error");
    return;
  }

  activeAssignments = assignments || [];

  if (classSelect) {
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
  }

  if (!tbody) return;
  tbody.replaceChildren();

  if (!cachedClasses.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No classes created yet.");
    cell.colSpan = 7;
    tbody.appendChild(row);
    setMessage("classesMessage", "Create your first class.");
    return;
  }

  for (const classroom of cachedClasses) {
    const row = document.createElement("tr");
    addCell(row, classroom.name);
    addCell(row, classroom.grade_level);
    addCell(row, classroom.academic_year);
    addCell(row, classroom.capacity);

    const assignment = activeAssignments.find(
      (item) => item.class_id === classroom.id
    );

    const teacher = cachedTeachers.find(
      (item) => item.id === assignment?.teacher_id
    );

    addCell(row, teacher?.full_name || (assignment ? "Assigned" : "Not assigned"));

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = classroom.is_active ? "status" : "status inactive";
    badge.textContent = classroom.is_active ? "Active" : "Inactive";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = classroom.is_active ? "button danger" : "button secondary";
    button.textContent = classroom.is_active ? "Deactivate" : "Activate";
    button.addEventListener("click", () => toggleClassStatus(classroom));
    actionCell.appendChild(button);
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
    setMessage(
      "createClassMessage",
      "Capacity must be a whole number from 1 to 500.",
      "error"
    );
    return;
  }

  setButtonBusy(button, true, "Creating class...", "Create Class");

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

    setMessage(
      "createClassMessage",
      `Class "${data.name}" created successfully.`,
      "success"
    );

    await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) {
    console.error("Class creation failed:", error);
    setMessage("createClassMessage", error.message, "error");
  } finally {
    setButtonBusy(button, false, "", "Create Class");
  }
}

async function assignTeacher(event) {
  event.preventDefault();

  const button = $("assignTeacherButton");
  const classId = $("assignmentClass")?.value;
  const teacherId = $("assignmentTeacher")?.value;

  if (!button || !classId || !teacherId) {
    setMessage("assignTeacherMessage", "Select a class and teacher.", "error");
    return;
  }

  setButtonBusy(button, true, "Assigning...", "Assign Teacher");

  try {
    const { error } = await supabase.rpc("assign_class_teacher", {
      p_class_id: classId,
      p_teacher_id: teacherId,
    });

    if (error) throw error;

    setMessage("assignTeacherMessage", "Teacher assigned successfully.", "success");
    await loadClasses();
  } catch (error) {
    console.error("Teacher assignment failed:", error);
    setMessage("assignTeacherMessage", error.message, "error");
  } finally {
    setButtonBusy(button, false, "", "Assign Teacher");
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

    setMessage("classesMessage", `Class status updated.`, "success");
    await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) {
    console.error("Class status update failed:", error);
    setMessage("classesMessage", error.message, "error");
  }
}

/* SUBJECTS */

async function loadSubjects() {
  const tbody = $("subjectsTableBody");
  if (tbody) tbody.replaceChildren();

  setMessage("subjectsMessage", "Loading subjects...");

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code, description, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Subject query failed:", error.message);
    setMessage("subjectsMessage", error.message, "error");

    if (tbody) {
      const row = document.createElement("tr");
      const cell = addCell(row, "Could not load subjects.");
      cell.colSpan = 5;
      tbody.appendChild(row);
    }

    return;
  }

  cachedSubjects = data || [];
  renderSubjectChoices();

  if (!tbody) return;

  if (!cachedSubjects.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No subjects created yet.");
    cell.colSpan = 5;
    tbody.appendChild(row);
    setMessage("subjectsMessage", "Add your first subject.");
    return;
  }

  for (const subject of cachedSubjects) {
    const row = document.createElement("tr");
    addCell(row, subject.name);
    addCell(row, subject.code);
    addCell(row, subject.description || "—");

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = subject.is_active ? "status" : "status inactive";
    badge.textContent = subject.is_active ? "Active" : "Inactive";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = subject.is_active ? "button danger" : "button secondary";
    button.textContent = subject.is_active ? "Deactivate" : "Activate";
    button.addEventListener("click", () => toggleSubjectStatus(subject));
    actionCell.appendChild(button);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }

  setMessage("subjectsMessage", `${cachedSubjects.length} subject(s) loaded.`);
}

function renderSubjectChoices(containerId = "combinationSubjectChoices", selectedIds = []) {
  const container = $(containerId);
  if (!container) return;

  container.replaceChildren();

  const activeSubjects = cachedSubjects.filter((subject) => subject.is_active);

  if (!activeSubjects.length) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Add and activate subjects before creating a combination.";
    container.appendChild(note);
    return;
  }

  for (const subject of activeSubjects) {
    const label = document.createElement("label");
    label.className = "check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = containerId;
    checkbox.value = subject.id;
    checkbox.checked = selectedIds.includes(subject.id);

    const text = document.createElement("span");
    text.textContent = `${subject.name} (${subject.code})`;

    label.append(checkbox, text);
    container.appendChild(label);
  }
}

function getSelectedSubjects(containerId) {
  const container = $(containerId);
  if (!container) return [];

  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);
}

async function createSubject(event) {
  event.preventDefault();

  const form = $("createSubjectForm");
  const button = $("createSubjectButton");

  const name = $("subjectName")?.value.trim();
  const code = $("subjectCode")?.value.trim().toUpperCase();
  const description = $("subjectDescription")?.value.trim() || null;

  if (!form || !button || !name || !code) {
    setMessage("createSubjectMessage", "Enter a subject name and code.", "error");
    return;
  }

  setButtonBusy(button, true, "Adding subject...", "Add Subject");

  try {
    const { error } = await supabase.from("subjects").insert({
      name,
      code,
      description,
      is_active: true,
    });

    if (error) throw error;

    form.reset();
    setMessage("createSubjectMessage", "Subject added successfully.", "success");
    await loadSubjects();
  } catch (error) {
    console.error("Subject creation failed:", error);
    setMessage("createSubjectMessage", error.message, "error");
  } finally {
    setButtonBusy(button, false, "", "Add Subject");
  }
}

async function toggleSubjectStatus(subject) {
  const action = subject.is_active ? "deactivate" : "activate";

  if (!window.confirm(`${action} subject "${subject.name}"?`)) return;

  try {
    const { error } = await supabase
      .from("subjects")
      .update({ is_active: !subject.is_active })
      .eq("id", subject.id);

    if (error) throw error;

    setMessage("subjectsMessage", "Subject status updated.", "success");
    await Promise.all([loadSubjects(), loadCombinations()]);
  } catch (error) {
    console.error("Subject status update failed:", error);
    setMessage("subjectsMessage", error.message, "error");
  }
}

/* SUBJECT COMBINATIONS */

async function loadCombinations() {
  const tbody = $("combinationsTableBody");
  if (tbody) tbody.replaceChildren();

  setMessage("combinationsMessage", "Loading combinations...");

  const { data: combinations, error } = await supabase
    .from("subject_combinations")
    .select("id, name, description, is_active, created_by")
    .order("name", { ascending: true });

  if (error) {
    console.error("Combination query failed:", error.message);
    setMessage("combinationsMessage", error.message, "error");

    if (tbody) {
      const row = document.createElement("tr");
      const cell = addCell(row, "Could not load combinations.");
      cell.colSpan = 4;
      tbody.appendChild(row);
    }

    return;
  }

  const { data: links, error: linksError } = await supabase
    .from("combination_subjects")
    .select("combination_id, subject_id");

  if (linksError) {
    console.error("Combination subjects query failed:", linksError.message);
    setMessage("combinationsMessage", linksError.message, "error");
    return;
  }

  cachedCombinations = (combinations || []).map((combination) => ({
    ...combination,
    subjectIds: (links || [])
      .filter((link) => link.combination_id === combination.id)
      .map((link) => link.subject_id),
  }));

  if (!tbody) return;

  if (!cachedCombinations.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No combinations created yet.");
    cell.colSpan = 4;
    tbody.appendChild(row);
    setMessage("combinationsMessage", "Create your first combination.");
    return;
  }

  for (const combination of cachedCombinations) {
    const row = document.createElement("tr");
    addCell(row, combination.name);

    const subjectNames = combination.subjectIds
      .map((id) => cachedSubjects.find((subject) => subject.id === id)?.name || "Unknown subject");

    addCell(row, subjectNames.length ? subjectNames.join(", ") : "No subjects selected");

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = combination.is_active ? "status" : "status inactive";
    badge.textContent = combination.is_active ? "Active" : "Inactive";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button secondary";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openCombinationEditor(combination));
    actionCell.appendChild(editButton);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = combination.is_active ? "button danger" : "button";
    toggleButton.style.marginLeft = "6px";
    toggleButton.textContent = combination.is_active ? "Deactivate" : "Activate";
    toggleButton.addEventListener("click", () => toggleCombinationStatus(combination));
    actionCell.appendChild(toggleButton);

    row.appendChild(actionCell);
    tbody.appendChild(row);
  }

  setMessage(
    "combinationsMessage",
    `${cachedCombinations.length} combination(s) loaded.`
  );
}

async function createCombination(event) {
  event.preventDefault();

  const form = $("createCombinationForm");
  const button = $("createCombinationButton");

  const name = $("combinationName")?.value.trim();
  const description = $("combinationDescription")?.value.trim() || null;
  const isActive = $("combinationActive")?.checked === true;
  const subjectIds = getSelectedSubjects("combinationSubjectChoices");

  if (!form || !button || !name) {
    setMessage("createCombinationMessage", "Enter a combination name.", "error");
    return;
  }

  if (subjectIds.length === 0) {
    setMessage(
      "createCombinationMessage",
      "Select at least one subject for this combination.",
      "error"
    );
    return;
  }

  setButtonBusy(button, true, "Creating combination...", "Create Combination");

  let createdId = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Your session expired. Sign in again.");
    }

    const { data: combination, error: combinationError } = await supabase
      .from("subject_combinations")
      .insert({
        name,
        description,
        is_active: isActive,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (combinationError) throw combinationError;

    createdId = combination.id;

    const rows = subjectIds.map((subjectId) => ({
      combination_id: createdId,
      subject_id: subjectId,
    }));

    const { error: linkError } = await supabase
      .from("combination_subjects")
      .insert(rows);

    if (linkError) {
      const { error: cleanupError } = await supabase
        .from("subject_combinations")
        .delete()
        .eq("id", createdId);

      if (cleanupError) {
        console.error("Combination cleanup failed:", cleanupError.message);
      }

      throw linkError;
    }

    form.reset();
    setMessage(
      "createCombinationMessage",
      "Subject combination created successfully.",
      "success"
    );

    await loadCombinations();
  } catch (error) {
    console.error("Combination creation failed:", error);
    setMessage("createCombinationMessage", error.message, "error");
  } finally {
    setButtonBusy(button, false, "", "Create Combination");
  }
}

function openCombinationEditor(combination) {
  const panel = $("editCombinationPanel");
  if (!panel) return;

  $("editCombinationId").value = combination.id;
  $("editCombinationName").value = combination.name;
  $("editCombinationDescription").value = combination.description || "";
  $("editCombinationActive").checked = combination.is_active;

  renderSubjectChoices("editCombinationSubjectChoices", combination.subjectIds);

  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  setMessage("editCombinationMessage", "");
}

async function saveCombination(event) {
  event.preventDefault();

  const form = $("editCombinationForm");
  const button = $("saveCombinationButton");

  const id = $("editCombinationId")?.value;
  const name = $("editCombinationName")?.value.trim();
  const description = $("editCombinationDescription")?.value.trim() || null;
  const isActive = $("editCombinationActive")?.checked === true;
  const subjectIds = getSelectedSubjects("editCombinationSubjectChoices");

  if (!form || !button || !id || !name) {
    setMessage("editCombinationMessage", "Enter a combination name.", "error");
    return;
  }

  if (subjectIds.length === 0) {
    setMessage("editCombinationMessage", "Select at least one subject.", "error");
    return;
  }

  setButtonBusy(button, true, "Saving...", "Save Changes");

  try {
    const { error: updateError } = await supabase
      .from("subject_combinations")
      .update({ name, description, is_active: isActive })
      .eq("id", id);

    if (updateError) throw updateError;

    const { error: deleteLinksError } = await supabase
      .from("combination_subjects")
      .delete()
      .eq("combination_id", id);

    if (deleteLinksError) {
      throw new Error(
        `Combination details were updated, but old subject links could not be replaced: ${deleteLinksError.message}`
      );
    }

    const rows = subjectIds.map((subjectId) => ({
      combination_id: id,
      subject_id: subjectId,
    }));

    const { error: insertLinksError } = await supabase
      .from("combination_subjects")
      .insert(rows);

    if (insertLinksError) {
      throw new Error(
        `Combination details were updated, but the new subject links could not be saved: ${insertLinksError.message}`
      );
    }

    $("editCombinationPanel").hidden = true;
    setMessage("combinationsMessage", "Combination updated successfully.", "success");

    await loadCombinations();
  } catch (error) {
    console.error("Combination update failed:", error);
    setMessage("editCombinationMessage", error.message, "error");
  } finally {
    setButtonBusy(button, false, "", "Save Changes");
  }
}

async function toggleCombinationStatus(combination) {
  const action = combination.is_active ? "deactivate" : "activate";

  if (!window.confirm(`${action} combination "${combination.name}"?`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from("subject_combinations")
      .update({ is_active: !combination.is_active })
      .eq("id", combination.id);

    if (error) throw error;

    setMessage("combinationsMessage", "Combination status updated.", "success");
    await loadCombinations();
  } catch (error) {
    console.error("Combination status update failed:", error);
    setMessage("combinationsMessage", error.message, "error");
  }
}

/* SIGN OUT AND INITIALIZATION */

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

  $("refreshOverviewButton")?.addEventListener("click", loadOverview);
  $("refreshStaffButton")?.addEventListener("click", loadStaff);
  $("refreshClassesButton")?.addEventListener("click", () => {
    Promise.all([loadClasses(), loadTeachers()]).catch(console.error);
  });

  $("createStaffForm")?.addEventListener("submit", createStaff);
  $("createClassForm")?.addEventListener("submit", createClass);
  $("assignTeacherForm")?.addEventListener("submit", assignTeacher);

  $("createSubjectForm")?.addEventListener("submit", createSubject);
  $("refreshSubjectsButton")?.addEventListener("click", loadSubjects);
  $("createCombinationForm")?.addEventListener("submit", createCombination);
  $("refreshCombinationsButton")?.addEventListener("click", loadCombinations);
  $("editCombinationForm")?.addEventListener("submit", saveCombination);

  $("cancelEditCombinationButton")?.addEventListener("click", () => {
    $("editCombinationPanel").hidden = true;
    setMessage("editCombinationMessage", "");
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
    loadSubjects(),
    loadCombinations(),
  ]);
}

initializeDashboard().catch((error) => {
  console.error("Dashboard initialization failed:", error);
  setMessage(
    "overviewMessage",
    "Dashboard initialization failed. Check the browser console.",
    "error"
  );
});
