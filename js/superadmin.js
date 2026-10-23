
import { supabase } from "./supabase.js";

/* =========================================================
   GRADE HUB — SUPER ADMIN DASHBOARD
   Subjects use subject_code, NOT code.
   ========================================================= */

const $ = (id) => document.getElementById(id);

let cachedSubjects = [];
let cachedClasses = [];
let cachedTeachers = [];
let cachedCombinations = [];
let savingSubject = false;
let savingCombination = false;
let savingClass = false;
let savingStaff = false;

/* -------------------- GENERAL HELPERS -------------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(id, message, type = "success") {
  const element = $(id);
  if (!element) {
    console[type === "error" ? "error" : "log"](message);
    return;
  }

  element.textContent = message;
  element.dataset.type = type;
  element.classList.remove("success", "error");
  element.classList.add(type);
  element.style.display = "block";
}

function clearMessage(id) {
  const element = $(id);
  if (!element) return;
  element.textContent = "";
  element.style.display = "none";
}

function setBusy(button, busy, busyText = "Please wait...") {
  if (!button) return;

  if (busy) {
    button.dataset.originalText ??= button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

function reportError(context, error) {
  console.error(`[Grade Hub] ${context}:`, error);
  return error?.message || "An unexpected error occurred.";
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data?.user) throw new Error("Your session has expired. Sign in again.");

  return data.user;
}

async function verifySuperAdmin() {
  const user = await getCurrentUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (
    !profile ||
    profile.role !== "super_admin" ||
    profile.is_active !== true
  ) {
    throw new Error("Access denied. An active Super Admin account is required.");
  }

  const nameElement = $("adminName");
  if (nameElement) {
    nameElement.textContent = profile.full_name || user.email || "Super Admin";
  }

  const emailElement = $("adminEmail");
  if (emailElement) emailElement.textContent = user.email || "";

  return { user, profile };
}

/* -------------------- NAVIGATION -------------------- */

function initializeNavigation() {
  const navItems = document.querySelectorAll(
    "[data-section], .sidebar-link[data-target], [data-nav-target]"
  );

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      const target =
        item.dataset.section ||
        item.dataset.target ||
        item.dataset.navTarget;

      if (!target) return;

      const section =
        $(target) ||
        $(`${target}Section`) ||
        $(`${target}-section`);

      if (!section) return;

      event.preventDefault();

      document.querySelectorAll(
        ".dashboard-section, .content-section, [data-dashboard-section]"
      ).forEach((candidate) => {
        candidate.hidden = true;
        candidate.classList.remove("active");
      });

      section.hidden = false;
      section.classList.add("active");

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });

  $("logoutButton")?.addEventListener("click", logout);
  $("logoutBtn")?.addEventListener("click", logout);
}

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(`Could not sign out: ${error.message}`);
    return;
  }

  window.location.href = "../index.html";
}

/* -------------------- OVERVIEW -------------------- */

async function countRows(table, filters = []) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  for (const [column, operator, value] of filters) {
    query = query.filter(column, operator, value);
  }

  const { count, error } = await query;
  if (error) throw error;

  return count ?? 0;
}

async function loadOverview() {
  const tasks = [
    ["totalStudents", () => countRows("students")],
    ["totalAdmins", () => countRows("profiles", [["role", "eq", "admin"]])],
    ["totalTeachers", () => countRows("profiles", [["role", "eq", "class_teacher"]])],
    ["totalClasses", () => countRows("classes")]
  ];

  const results = await Promise.allSettled(
    tasks.map(([, load]) => load())
  );

  results.forEach((result, index) => {
    const [elementId] = tasks[index];
    const element = $(elementId);

    if (!element) return;

    element.textContent = result.status === "fulfilled"
      ? String(result.value)
      : "—";

    if (result.status === "rejected") {
      console.error(`Could not load ${elementId}:`, result.reason);
    }
  });
}

/* =========================================================
   SUBJECTS
   Actual database columns:
   id, name, subject_code, description, is_active, created_at
   ========================================================= */

function subjectTableElement() {
  return $("subjectsTableBody") || $("subjectsTable");
}

function renderSubjects() {
  const table = subjectTableElement();
  if (!table) {
    console.warn("Subjects table body was not found in the HTML.");
    return;
  }

  if (cachedSubjects.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5">No subjects found. Add your first subject above.</td>
      </tr>`;
    refreshCombinationChoices();
    return;
  }

  table.innerHTML = cachedSubjects.map((subject) => {
    const active = subject.is_active === true;

    return `
      <tr>
        <td>${escapeHTML(subject.subject_code || "—")}</td>
        <td>${escapeHTML(subject.name)}</td>
        <td>${escapeHTML(subject.description || "—")}</td>
        <td>${active ? "Active" : "Inactive"}</td>
        <td>
          <button
            type="button"
            data-toggle-subject="${escapeHTML(subject.id)}"
            data-next-active="${active ? "false" : "true"}">
            ${active ? "Deactivate" : "Activate"}
          </button>
        </td>
      </tr>`;
  }).join("");

  refreshCombinationChoices();
}

async function loadSubjects() {
  const table = subjectTableElement();

  if (table) {
    table.innerHTML = `
      <tr><td colspan="5">Loading subjects...</td></tr>`;
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, subject_code, description, is_active, created_at")
    .order("name", { ascending: true });

  if (error) {
    if (table) {
      table.innerHTML = `
        <tr><td colspan="5">Could not load subjects.</td></tr>`;
    }

    showMessage(
      "subjectsMessage",
      `Could not load subjects: ${reportError("Loading subjects", error)}`,
      "error"
    );

    throw error;
  }

  cachedSubjects = data || [];
  renderSubjects();
  clearMessage("subjectsMessage");
}

async function addSubject(event) {
  event?.preventDefault();

  if (savingSubject) return;

  const nameInput = $("subjectName");
  const codeInput = $("subjectCode");
  const descriptionInput = $("subjectDescription");
  const button = $("createSubjectButton");

  if (!nameInput) {
    showMessage(
      "createSubjectMessage",
      "The subjectName input is missing from the HTML.",
      "error"
    );
    return;
  }

  const name = nameInput.value.trim();
  const subjectCode = codeInput?.value.trim().toUpperCase() || "";
  const description = descriptionInput?.value.trim() || "";

  if (!name) {
    showMessage("createSubjectMessage", "Enter a subject name.", "error");
    nameInput.focus();
    return;
  }

  savingSubject = true;
  setBusy(button, true, "Adding...");
  clearMessage("createSubjectMessage");

  try {
    await verifySuperAdmin();

    const newSubject = {
      name,
      subject_code: subjectCode || null,
      description: description || null,
      is_active: true
    };

    const { error } = await supabase
      .from("subjects")
      .insert(newSubject);

    if (error) throw error;

    nameInput.value = "";
    if (codeInput) codeInput.value = "";
    if (descriptionInput) descriptionInput.value = "";

    showMessage(
      "createSubjectMessage",
      "Subject added successfully."
    );

    await loadSubjects();
    await loadCombinations();
  } catch (error) {
    showMessage(
      "createSubjectMessage",
      reportError("Adding subject", error),
      "error"
    );
  } finally {
    savingSubject = false;
    setBusy(button, false);
  }
}

async function toggleSubject(id, nextActive) {
  const subject = cachedSubjects.find((item) => item.id === id);
  if (!subject) return;

  try {
    await verifySuperAdmin();

    const { error } = await supabase
      .from("subjects")
      .update({ is_active: nextActive })
      .eq("id", id);

    if (error) throw error;

    await loadSubjects();

    showMessage(
      "subjectsMessage",
      `${subject.name} ${nextActive ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    showMessage(
      "subjectsMessage",
      reportError("Updating subject", error),
      "error"
    );
  }
}

function initializeSubjectEvents() {
  $("createSubjectForm")?.addEventListener("submit", addSubject);

  // Do not add a second click handler to the submit button.
  $("refreshSubjectsButton")?.addEventListener("click", async () => {
    try {
      await loadSubjects();
    } catch {
      // Error message is already shown by loadSubjects().
    }
  });

  const table = subjectTableElement();
  table?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-toggle-subject]");
    if (!button) return;

    await toggleSubject(
      button.dataset.toggleSubject,
      button.dataset.nextActive === "true"
    );
  });
}

/* =========================================================
   SUBJECT COMBINATIONS
   ========================================================= */

function getSelectedSubjectIds(containerId) {
  const container = $(containerId);
  if (!container) return [];

  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => input.value);
}

function renderSubjectChoices(containerId, selectedIds = []) {
  const container = $(containerId);
  if (!container) return;

  const activeSubjects = cachedSubjects.filter(
    (subject) => subject.is_active === true
  );

  if (!activeSubjects.length) {
    container.innerHTML = "<p>No active subjects available. Add or activate subjects first.</p>";
    return;
  }

  container.innerHTML = activeSubjects.map((subject) => `
    <label class="subject-choice">
      <input
        type="checkbox"
        name="${escapeHTML(containerId)}"
        value="${escapeHTML(subject.id)}"
        ${selectedIds.includes(subject.id) ? "checked" : ""}>
      <span>
        ${escapeHTML(subject.name)}
        ${subject.subject_code
          ? ` (${escapeHTML(subject.subject_code)})`
          : ""}
      </span>
    </label>
  `).join("");
}

function refreshCombinationChoices() {
  renderSubjectChoices("combinationSubjectChoices");

  // Preserve selected values when refreshing the edit form.
  const editContainer = $("editCombinationSubjectChoices");
  if (editContainer) {
    const selected = getSelectedSubjectIds("editCombinationSubjectChoices");
    renderSubjectChoices("editCombinationSubjectChoices", selected);
  }
}

async function loadCombinations() {
  const table = $("combinationsTableBody");

  const { data, error } = await supabase
    .from("subject_combinations")
    .select("id, name, description, is_active, created_at")
    .order("name", { ascending: true });

  if (error) {
    if (table) {
      table.innerHTML = `
        <tr><td colspan="4">Could not load combinations.</td></tr>`;
    }

    showMessage(
      "combinationsMessage",
      reportError("Loading combinations", error),
      "error"
    );

    throw error;
  }

  cachedCombinations = data || [];

  if (table) {
    if (!cachedCombinations.length) {
      table.innerHTML = `
        <tr><td colspan="4">No subject combinations created yet.</td></tr>`;
    } else {
      table.innerHTML = cachedCombinations.map((combination) => `
        <tr>
          <td>${escapeHTML(combination.name)}</td>
          <td>${escapeHTML(combination.description || "—")}</td>
          <td>${combination.is_active ? "Active" : "Inactive"}</td>
          <td>
            <button
              type="button"
              data-edit-combination="${escapeHTML(combination.id)}">
              Edit
            </button>
            <button
              type="button"
              data-toggle-combination="${escapeHTML(combination.id)}"
              data-next-active="${combination.is_active ? "false" : "true"}">
              ${combination.is_active ? "Deactivate" : "Activate"}
            </button>
          </td>
        </tr>
      `).join("");
    }
  }

  await loadCombinationSubjectLinks();
  clearMessage("combinationsMessage");
}

async function loadCombinationSubjectLinks() {
  if (!cachedCombinations.length) return;

  const ids = cachedCombinations.map((item) => item.id);

  const { data, error } = await supabase
    .from("combination_subjects")
    .select("combination_id, subject_id")
    .in("combination_id", ids);

  if (error) {
    console.error("Could not load combination subject links:", error);
    return;
  }

  const subjectsByCombination = new Map();

  (data || []).forEach((link) => {
    if (!subjectsByCombination.has(link.combination_id)) {
      subjectsByCombination.set(link.combination_id, []);
    }

    subjectsByCombination.get(link.combination_id).push(link.subject_id);
  });

  cachedCombinations = cachedCombinations.map((combination) => ({
    ...combination,
    subject_ids: subjectsByCombination.get(combination.id) || []
  }));
}

async function addCombination(event) {
  event?.preventDefault();

  if (savingCombination) return;

  const nameInput = $("combinationName");
  const descriptionInput = $("combinationDescription");
  const button = $("createCombinationButton");

  const name = nameInput?.value.trim() || "";
  const description = descriptionInput?.value.trim() || "";
  const subjectIds = getSelectedSubjectIds("combinationSubjectChoices");
  const isActive = $("combinationActive")?.checked === true;

  if (!name) {
    showMessage("createCombinationMessage", "Enter a combination name.", "error");
    return;
  }

  if (!subjectIds.length) {
    showMessage(
      "createCombinationMessage",
      "Select at least one active subject.",
      "error"
    );
    return;
  }

  savingCombination = true;
  setBusy(button, true, "Creating...");
  clearMessage("createCombinationMessage");

  let createdId = null;

  try {
    const { user } = await verifySuperAdmin();

    const { data: combination, error: combinationError } = await supabase
      .from("subject_combinations")
      .insert({
        name,
        description: description || null,
        is_active: isActive,
        created_by: user.id
      })
      .select("id")
      .single();

    if (combinationError) throw combinationError;
    createdId = combination.id;

    const rows = subjectIds.map((subjectId) => ({
      combination_id: createdId,
      subject_id: subjectId
    }));

    const { error: linksError } = await supabase
      .from("combination_subjects")
      .insert(rows);

    if (linksError) {
      // Roll back the parent record if inserting its subject links fails.
      await supabase
        .from("subject_combinations")
        .delete()
        .eq("id", createdId);

      throw linksError;
    }

    if (nameInput) nameInput.value = "";
    if (descriptionInput) descriptionInput.value = "";

    renderSubjectChoices("combinationSubjectChoices");

    showMessage(
      "createCombinationMessage",
      "Subject combination created successfully."
    );

    await loadCombinations();
  } catch (error) {
    showMessage(
      "createCombinationMessage",
      reportError("Creating combination", error),
      "error"
    );
  } finally {
    savingCombination = false;
    setBusy(button, false);
  }
}

async function editCombination(id) {
  const combination = cachedCombinations.find((item) => item.id === id);
  if (!combination) return;

  if ($("editCombinationPanel")) {
    $("editCombinationPanel").hidden = false;
  }

  if ($("editCombinationId")) $("editCombinationId").value = combination.id;
  if ($("editCombinationName")) $("editCombinationName").value = combination.name;
  if ($("editCombinationDescription")) {
    $("editCombinationDescription").value = combination.description || "";
  }
  if ($("editCombinationActive")) {
    $("editCombinationActive").checked = combination.is_active === true;
  }

  renderSubjectChoices(
    "editCombinationSubjectChoices",
    combination.subject_ids || []
  );

  $("editCombinationPanel")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveCombinationEdit(event) {
  event?.preventDefault();

  const id = $("editCombinationId")?.value;
  const name = $("editCombinationName")?.value.trim() || "";
  const description = $("editCombinationDescription")?.value.trim() || "";
  const isActive = $("editCombinationActive")?.checked === true;
  const subjectIds = getSelectedSubjectIds("editCombinationSubjectChoices");
  const button = $("saveCombinationButton");

  if (!id) {
    showMessage("editCombinationMessage", "No combination selected.", "error");
    return;
  }

  if (!name) {
    showMessage("editCombinationMessage", "Enter a combination name.", "error");
    return;
  }

  if (!subjectIds.length) {
    showMessage(
      "editCombinationMessage",
      "Select at least one active subject.",
      "error"
    );
    return;
  }

  setBusy(button, true, "Saving...");
  clearMessage("editCombinationMessage");

  try {
    await verifySuperAdmin();

    // This client-side update is sequential, not transactional.
    const { error: updateError } = await supabase
      .from("subject_combinations")
      .update({
        name,
        description: description || null,
        is_active: isActive
      })
      .eq("id", id);

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
      .from("combination_subjects")
      .delete()
      .eq("combination_id", id);

    if (deleteError) {
      throw new Error(
        `Combination details saved, but old subject links could not be replaced: ${deleteError.message}`
      );
    }

    const links = subjectIds.map((subjectId) => ({
      combination_id: id,
      subject_id: subjectId
    }));

    const { error: insertError } = await supabase
      .from("combination_subjects")
      .insert(links);

    if (insertError) {
      throw new Error(
        `Combination details saved, but new subject links could not be saved: ${insertError.message}`
      );
    }

    showMessage("editCombinationMessage", "Combination updated.");
    await loadCombinations();

    if ($("editCombinationPanel")) {
      $("editCombinationPanel").hidden = true;
    }
  } catch (error) {
    showMessage(
      "editCombinationMessage",
      reportError("Saving combination", error),
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}

async function toggleCombination(id, nextActive) {
  try {
    await verifySuperAdmin();

    const { error } = await supabase
      .from("subject_combinations")
      .update({ is_active: nextActive })
      .eq("id", id);

    if (error) throw error;

    await loadCombinations();

    showMessage(
      "combinationsMessage",
      `Combination ${nextActive ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    showMessage(
      "combinationsMessage",
      reportError("Updating combination", error),
      "error"
    );
  }
}

function initializeCombinationEvents() {
  $("createCombinationForm")?.addEventListener("submit", addCombination);
  $("editCombinationForm")?.addEventListener("submit", saveCombinationEdit);

  $("cancelEditCombinationButton")?.addEventListener("click", () => {
    if ($("editCombinationPanel")) {
      $("editCombinationPanel").hidden = true;
    }
  });

  $("refreshCombinationsButton")?.addEventListener("click", async () => {
    try {
      await loadCombinations();
    } catch {
      // Error message is already shown by loadCombinations().
    }
  });

  $("combinationsTableBody")?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-combination]");
    if (editButton) {
      await editCombination(editButton.dataset.editCombination);
      return;
    }

    const toggleButton = event.target.closest("[data-toggle-combination]");
    if (toggleButton) {
      await toggleCombination(
        toggleButton.dataset.toggleCombination,
        toggleButton.dataset.nextActive === "true"
      );
    }
  });
}

/* =========================================================
   CLASSES AND TEACHER ASSIGNMENTS
   ========================================================= */

async function loadTeachers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "class_teacher")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;

  cachedTeachers = data || [];

  const select = $("assignmentTeacher");
  if (select) {
    select.innerHTML =
      '<option value="">Select a teacher</option>' +
      cachedTeachers.map((teacher) => `
        <option value="${escapeHTML(teacher.id)}">
          ${escapeHTML(teacher.full_name || "Unnamed teacher")}
        </option>
      `).join("");
  }
}

async function loadClasses() {
  const table = $("classesTableBody");

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, grade_level, academic_year, capacity, is_active")
    .order("name");

  if (error) {
    showMessage(
      "classesMessage",
      reportError("Loading classes", error),
      "error"
    );
    throw error;
  }

  cachedClasses = data || [];

  if (table) {
    table.innerHTML = cachedClasses.length
      ? cachedClasses.map((item) => `
          <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.grade_level)}</td>
            <td>${escapeHTML(item.academic_year)}</td>
            <td>${escapeHTML(item.capacity ?? "—")}</td>
            <td>${item.is_active ? "Active" : "Inactive"}</td>
            <td>
              <button
                type="button"
                data-toggle-class="${escapeHTML(item.id)}"
                data-next-active="${item.is_active ? "false" : "true"}">
                ${item.is_active ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="6">No classes created yet.</td></tr>';
  }

  const select = $("assignmentClass");
  if (select) {
    select.innerHTML =
      '<option value="">Select a class</option>' +
      cachedClasses.filter((item) => item.is_active).map((item) => `
        <option value="${escapeHTML(item.id)}">
          ${escapeHTML(item.name)} — ${escapeHTML(item.grade_level)}
        </option>
      `).join("");
  }
}

async function addClass(event) {
  event?.preventDefault();
  if (savingClass) return;

  const name = $("className")?.value.trim() || "";
  const gradeLevel = $("classGrade")?.value.trim() || "";
  const academicYear = $("classYear")?.value.trim() || "";
  const capacityValue = $("classCapacity")?.value.trim() || "";
  const capacity = capacityValue ? Number(capacityValue) : null;
  const button = $("createClassButton");

  if (!name || !gradeLevel || !academicYear) {
    showMessage(
      "createClassMessage",
      "Enter the class name, grade level, and academic year.",
      "error"
    );
    return;
  }

  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity < 1)
  ) {
    showMessage(
      "createClassMessage",
      "Capacity must be a positive whole number.",
      "error"
    );
    return;
  }

  savingClass = true;
  setBusy(button, true, "Creating...");

  try {
    await verifySuperAdmin();

    const { error } = await supabase
      .from("classes")
      .insert({
        name,
        grade_level: gradeLevel,
        academic_year: academicYear,
        capacity
      });

    if (error) throw error;

    $("createClassForm")?.reset();
    showMessage("createClassMessage", "Class created successfully.");
    await loadClasses();
    await loadOverview();
  } catch (error) {
    showMessage(
      "createClassMessage",
      reportError("Creating class", error),
      "error"
    );
  } finally {
    savingClass = false;
    setBusy(button, false);
  }
}

async function assignTeacher(event) {
  event?.preventDefault();

  const classId = $("assignmentClass")?.value;
  const teacherId = $("assignmentTeacher")?.value;
  const button = $("assignTeacherButton");

  if (!classId || !teacherId) {
    showMessage(
      "assignTeacherMessage",
      "Select both a class and a teacher.",
      "error"
    );
    return;
  }

  setBusy(button, true, "Assigning...");

  try {
    await verifySuperAdmin();

    const { error } = await supabase.rpc("assign_class_teacher", {
      p_class_id: classId,
      p_teacher_id: teacherId
    });

    if (error) throw error;

    showMessage("assignTeacherMessage", "Teacher assigned successfully.");
  } catch (error) {
    showMessage(
      "assignTeacherMessage",
      reportError("Assigning teacher", error),
      "error"
    );
  } finally {
    setBusy(button, false);
  }
}

async function toggleClass(id, nextActive) {
  try {
    await verifySuperAdmin();

    const { error } = await supabase
      .from("classes")
      .update({ is_active: nextActive })
      .eq("id", id);

    if (error) throw error;

    await loadClasses();
    await loadOverview();

    showMessage(
      "classesMessage",
      `Class ${nextActive ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    showMessage(
      "classesMessage",
      reportError("Updating class", error),
      "error"
    );
  }
}

function initializeClassEvents() {
  $("createClassForm")?.addEventListener("submit", addClass);
  $("assignTeacherForm")?.addEventListener("submit", assignTeacher);

  $("refreshClassesButton")?.addEventListener("click", async () => {
    try {
      await Promise.all([loadClasses(), loadTeachers()]);
    } catch (error) {
      showMessage("classesMessage", reportError("Refreshing classes", error), "error");
    }
  });

  $("classesTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-toggle-class]");
    if (!button) return;

    await toggleClass(
      button.dataset.toggleClass,
      button.dataset.nextActive === "true"
    );
  });
}

/* =========================================================
   STAFF MANAGEMENT
   ========================================================= */

async function loadStaff() {
  const table = $("staffTableBody");
  if (!table) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .in("role", ["admin", "class_teacher"])
    .order("created_at", { ascending: false });

  if (error) {
    showMessage("staffMessage", reportError("Loading staff", error), "error");
    throw error;
  }

  table.innerHTML = (data || []).length
    ? data.map((staff) => `
        <tr>
          <td>${escapeHTML(staff.full_name || "—")}</td>
          <td>${escapeHTML(staff.role)}</td>
          <td>${staff.is_active ? "Active" : "Inactive"}</td>
          <td>${formatDate(staff.created_at)}</td>
          <td>
            <button
              type="button"
              data-toggle-staff="${escapeHTML(staff.id)}"
              data-next-active="${staff.is_active ? "false" : "true"}">
              ${staff.is_active ? "Deactivate" : "Activate"}
            </button>
          </td>
        </tr>
      `).join("")
    : '<tr><td colspan="5">No staff accounts found.</td></tr>';
}

async function createStaff(event) {
  event?.preventDefault();
  if (savingStaff) return;

  const fullName = $("staffName")?.value.trim() || "";
  const email = $("staffEmail")?.value.trim() || "";
  const role = $("staffRole")?.value || "";
  const password = $("staffPassword")?.value || "";
  const button = $("createStaffButton");

  if (!fullName || !email || !role || !password) {
    showMessage("createStaffMessage", "Complete all staff fields.", "error");
    return;
  }

  if (!["admin", "class_teacher"].includes(role)) {
    showMessage("createStaffMessage", "Choose a valid staff role.", "error");
    return;
  }

  if (password.length < 8) {
    showMessage(
      "createStaffMessage",
      "The temporary password must be at least 8 characters.",
      "error"
    );
    return;
  }

  savingStaff = true;
  setBusy(button, true, "Creating...");

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sign in again before creating staff.");

    const { data, error } = await supabase.functions.invoke("create-staff", {
      body: {
        full_name: fullName,
        email,
        role,
        password
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    $("createStaffForm")?.reset();
    showMessage("createStaffMessage", "Staff account created successfully.");

    await Promise.all([loadStaff(), loadOverview()]);
  } catch (error) {
    showMessage(
      "createStaffMessage",
      reportError("Creating staff account", error),
      "error"
    );
  } finally {
    savingStaff = false;
    setBusy(button, false);
  }
}

async function toggleStaff(id, nextActive) {
  try {
    await verifySuperAdmin();

    const { error } = await supabase.rpc("manage_staff_account", {
      target_user_id: id,
      new_role: null,
      new_is_active: nextActive
    });

    if (error) throw error;

    await Promise.all([loadStaff(), loadOverview()]);
    showMessage("staffMessage", `Staff account ${nextActive ? "activated" : "deactivated"}.`);
  } catch (error) {
    showMessage(
      "staffMessage",
      reportError("Updating staff account", error),
      "error"
    );
  }
}

function initializeStaffEvents() {
  $("createStaffForm")?.addEventListener("submit", createStaff);

  $("refreshStaffButton")?.addEventListener("click", async () => {
    try {
      await loadStaff();
    } catch {
      // Error message is already displayed.
    }
  });

  $("staffTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-toggle-staff]");
    if (!button) return;

    await toggleStaff(
      button.dataset.toggleStaff,
      button.dataset.nextActive === "true"
    );
  });
}

/* -------------------- DOCUMENTS AND EXAMS -------------------- */

function initializePlaceholderSections() {
  const examMessage = $("examsMessage");
  if (examMessage) {
    examMessage.textContent =
      "Exam management has not been connected in this JavaScript version.";
  }

  const documentMessage = $("documentsMessage");
  if (documentMessage) {
    documentMessage.textContent =
      "Document uploads have not been connected in this JavaScript version.";
  }
}

/* -------------------- INITIALIZATION -------------------- */

async function initializeDashboard() {
  initializeNavigation();
  initializeSubjectEvents();
  initializeCombinationEvents();
  initializeClassEvents();
  initializeStaffEvents();
  initializePlaceholderSections();

  try {
    await verifySuperAdmin();
  } catch (error) {
    console.error("Dashboard authorization failed:", error);
    document.body.innerHTML = `
      <main style="max-width:650px;margin:60px auto;padding:24px;font-family:Arial,sans-serif">
        <h1>Grade Hub</h1>
        <p>${escapeHTML(error.message)}</p>
        <a href="../index.html">Return to sign in</a>
      </main>`;
    return;
  }

  const jobs = [
    ["overview", loadOverview],
    ["subjects", loadSubjects],
    ["combinations", loadCombinations],
    ["classes", loadClasses],
    ["teachers", loadTeachers],
    ["staff", loadStaff]
  ];

  const results = await Promise.allSettled(
    jobs.map(([, task]) => task())
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Dashboard section "${jobs[index][0]}" failed:`, result.reason);
    }
  });

  // Ensure subject choices render even if no combinations exist.
  refreshCombinationChoices();
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
