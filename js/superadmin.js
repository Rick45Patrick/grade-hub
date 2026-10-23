
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

let subjects = [];
let combinations = [];
let classes = [];
let teachers = [];
let staff = [];

const busy = new Set();

function message(id, text, type = "success") {
  const element = $(id);

  if (!element) {
    if (type === "error") console.error(text);
    return;
  }

  element.textContent = text;
  element.classList.remove("success", "error");
  element.classList.add(type);
  element.style.display = "block";
}

function clearMessage(id) {
  const element = $(id);

  if (element) {
    element.textContent = "";
    element.style.display = "none";
  }
}

function busyButton(id, loading, text = "Please wait...") {
  const button = $(id);
  if (!button) return;

  if (loading) {
    if (!button.dataset.oldText) {
      button.dataset.oldText = button.textContent;
    }

    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;

    if (button.dataset.oldText) {
      button.textContent = button.dataset.oldText;
    }
  }
}

function errorText(error) {
  console.error(error);
  return error?.message || String(error || "Unknown error");
}

/* AUTHORIZATION */

async function currentSuperAdmin() {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  if (!auth.user) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) throw error;

  if (
    !profile ||
    profile.role !== "super_admin" ||
    profile.is_active !== true
  ) {
    throw new Error(
      "Access denied. An active Super Admin account is required."
    );
  }

  const welcome = $("welcomeText");

  if (welcome) {
    welcome.textContent =
      `Signed in as ${profile.full_name || auth.user.email || "Super Admin"}`;
  }

  return { user: auth.user, profile };
}

/* NAVIGATION */

function initNavigation() {
  const sections = [
    ...document.querySelectorAll(".section[id^='section-']")
  ];

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = $("section-" + button.dataset.section);

      if (!target) return;

      sections.forEach((section) => {
        section.classList.toggle("active", section === target);
      });

      document.querySelectorAll("[data-section]").forEach((nav) => {
        nav.classList.toggle("active", nav === button);
      });

      const title = $("pageTitle");

      if (title) {
        title.textContent = button.textContent.trim();
      }

      $("sidebar")?.classList.remove("open");
    });
  });

  $("mobileMenuButton")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });

  $("signOutButton")?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      message("overviewMessage", error.message, "error");
      return;
    }

    window.location.href = "../index.html";
  });

  $("refreshOverviewButton")?.addEventListener("click", () => {
    loadOverview().catch((error) => {
      message("overviewMessage", errorText(error), "error");
    });
  });
}

/* OVERVIEW */

async function count(table, filters = []) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { count: total, error } = await query;

  if (error) throw error;

  return total ?? 0;
}

async function loadOverview() {
  clearMessage("overviewMessage");

  const items = [
    ["totalStudents", () => count("students")],
    [
      "totalAdmins",
      () => count("profiles", [
        ["role", "admin"],
        ["is_active", true]
      ])
    ],
    [
      "totalTeachers",
      () => count("profiles", [
        ["role", "class_teacher"],
        ["is_active", true]
      ])
    ],
    [
      "totalClasses",
      () => count("classes", [["is_active", true]])
    ]
  ];

  const results = await Promise.allSettled(
    items.map((item) => item[1]())
  );

  const failures = [];

  results.forEach((result, index) => {
    const element = $(items[index][0]);

    if (element) {
      element.textContent =
        result.status === "fulfilled" ? result.value : "—";
    }

    if (result.status === "rejected") {
      failures.push(
        `${items[index][0]}: ${errorText(result.reason)}`
      );
    }
  });

  if (failures.length) {
    message("overviewMessage", failures.join(" | "), "error");
  } else {
    message("overviewMessage", "Overview refreshed.");
  }
}

/* SUBJECTS */

function selectedIds(containerId) {
  return [
    ...($(containerId)?.querySelectorAll(
      'input[type="checkbox"]:checked'
    ) || [])
  ].map((checkbox) => checkbox.value);
}

function renderSubjectChoices(containerId, checked = []) {
  const container = $(containerId);

  if (!container) return;

  const activeSubjects = subjects.filter(
    (subject) => subject.is_active
  );

  if (!activeSubjects.length) {
    container.innerHTML =
      '<p class="muted">No active subjects. Add or activate subjects first.</p>';
    return;
  }

  container.innerHTML = activeSubjects.map((subject) => `
    <label class="check-item">
      <input
        type="checkbox"
        value="${esc(subject.id)}"
        ${checked.includes(subject.id) ? "checked" : ""}
      >
      <span>
        ${esc(subject.name)}
        ${subject.subject_code
          ? ` (${esc(subject.subject_code)})`
          : ""}
      </span>
    </label>
  `).join("");
}

function renderSubjects() {
  const body = $("subjectsTableBody");

  if (body) {
    body.innerHTML = subjects.length
      ? subjects.map((subject) => `
          <tr>
            <td>${esc(subject.name)}</td>
            <td>${esc(subject.subject_code || "—")}</td>
            <td>${esc(subject.description || "—")}</td>
            <td>
              <span class="status ${subject.is_active ? "" : "inactive"}">
                ${subject.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td>
              <button
                class="button secondary"
                type="button"
                data-subject-toggle="${esc(subject.id)}"
                data-active="${!subject.is_active}"
              >
                ${subject.is_active ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="5">No subjects yet. Add your first subject above.</td></tr>';
  }

  const oldSelection = selectedIds("editCombinationSubjectChoices");

  renderSubjectChoices("combinationSubjectChoices");
  renderSubjectChoices("editCombinationSubjectChoices", oldSelection);
}

async function loadSubjects() {
  const body = $("subjectsTableBody");

  if (body) {
    body.innerHTML =
      '<tr><td colspan="5">Loading subjects...</td></tr>';
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, subject_code, description, is_active, created_at")
    .order("name");

  if (error) {
    if (body) {
      body.innerHTML =
        '<tr><td colspan="5">Could not load subjects.</td></tr>';
    }

    throw error;
  }

  subjects = data || [];

  renderSubjects();
  clearMessage("subjectsMessage");
}

async function addSubject(event) {
  event.preventDefault();

  if (busy.has("subject")) return;

  const name = $("subjectName")?.value.trim() || "";
  const subjectCode =
    $("subjectCode")?.value.trim().toUpperCase() || "";
  const description =
    $("subjectDescription")?.value.trim() || "";

  if (!name) {
    return message(
      "createSubjectMessage",
      "Enter a subject name.",
      "error"
    );
  }

  busy.add("subject");
  busyButton("createSubjectButton", true, "Adding...");
  clearMessage("createSubjectMessage");

  try {
    await currentSuperAdmin();

    const { error } = await supabase.from("subjects").insert({
      name,
      subject_code: subjectCode || null,
      description: description || null,
      is_active: true
    });

    if (error) throw error;

    $("createSubjectForm")?.reset();

    await loadSubjects();

    message("createSubjectMessage", "Subject added successfully.");
  } catch (error) {
    message(
      "createSubjectMessage",
      `Could not add subject: ${errorText(error)}`,
      "error"
    );
  } finally {
    busy.delete("subject");
    busyButton("createSubjectButton", false);
  }
}

async function toggleSubject(id, active) {
  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("subjects")
      .update({ is_active: active })
      .eq("id", id);

    if (error) throw error;

    await loadSubjects();

    message(
      "subjectsMessage",
      `Subject ${active ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    message(
      "subjectsMessage",
      `Could not update subject: ${errorText(error)}`,
      "error"
    );
  }
}

/* SUBJECT COMBINATIONS */

async function loadCombinations() {
  const body = $("combinationsTableBody");

  const { data, error } = await supabase
    .from("subject_combinations")
    .select("id, name, description, is_active, created_at")
    .order("name");

  if (error) {
    if (body) {
      body.innerHTML =
        '<tr><td colspan="4">Could not load combinations.</td></tr>';
    }

    throw error;
  }

  combinations = data || [];

  if (combinations.length) {
    const { data: links, error: linkError } = await supabase
      .from("combination_subjects")
      .select("combination_id, subject_id")
      .in(
        "combination_id",
        combinations.map((combination) => combination.id)
      );

    if (linkError) throw linkError;

    const subjectMap = new Map();

    (links || []).forEach((link) => {
      if (!subjectMap.has(link.combination_id)) {
        subjectMap.set(link.combination_id, []);
      }

      subjectMap.get(link.combination_id).push(link.subject_id);
    });

    combinations = combinations.map((combination) => ({
      ...combination,
      subject_ids: subjectMap.get(combination.id) || []
    }));
  }

  if (body) {
    body.innerHTML = combinations.length
      ? combinations.map((combination) => {
          const names = (combination.subject_ids || [])
            .map((id) => subjects.find((subject) => subject.id === id)?.name)
            .filter(Boolean)
            .join(", ");

          return `
            <tr>
              <td>${esc(combination.name)}</td>
              <td>${esc(names || "No subjects linked")}</td>
              <td>
                <span class="status ${combination.is_active ? "" : "inactive"}">
                  ${combination.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td>
                <button
                  class="button secondary"
                  type="button"
                  data-combo-edit="${esc(combination.id)}"
                >Edit</button>

                <button
                  class="button secondary"
                  type="button"
                  data-combo-active="${esc(combination.id)}"
                  data-active="${!combination.is_active}"
                >
                  ${combination.is_active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="4">No combinations created yet.</td></tr>';
  }

  clearMessage("combinationsMessage");
}

async function addCombination(event) {
  event.preventDefault();

  if (busy.has("combination")) return;

  const name = $("combinationName")?.value.trim() || "";
  const description =
    $("combinationDescription")?.value.trim() || "";
  const ids = selectedIds("combinationSubjectChoices");
  const active = $("combinationActive")?.checked === true;

  if (!name) {
    return message(
      "createCombinationMessage",
      "Enter a combination name.",
      "error"
    );
  }

  if (!ids.length) {
    return message(
      "createCombinationMessage",
      "Select at least one subject.",
      "error"
    );
  }

  busy.add("combination");
  busyButton("createCombinationButton", true, "Creating...");

  let newId = null;

  try {
    const { user } = await currentSuperAdmin();

    const { data, error } = await supabase
      .from("subject_combinations")
      .insert({
        name,
        description: description || null,
        is_active: active,
        created_by: user.id
      })
      .select("id")
      .single();

    if (error) throw error;

    newId = data.id;

    const { error: linksError } = await supabase
      .from("combination_subjects")
      .insert(
        ids.map((subject_id) => ({
          combination_id: newId,
          subject_id
        }))
      );

    if (linksError) {
      await supabase
        .from("subject_combinations")
        .delete()
        .eq("id", newId);

      throw linksError;
    }

    $("createCombinationForm")?.reset();

    await loadCombinations();

    message(
      "createCombinationMessage",
      "Combination created successfully."
    );
  } catch (error) {
    message(
      "createCombinationMessage",
      `Could not create combination: ${errorText(error)}`,
      "error"
    );
  } finally {
    busy.delete("combination");
    busyButton("createCombinationButton", false);
  }
}

async function toggleCombination(id, active) {
  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("subject_combinations")
      .update({ is_active: active })
      .eq("id", id);

    if (error) throw error;

    await loadCombinations();

    message(
      "combinationsMessage",
      `Combination ${active ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    message(
      "combinationsMessage",
      `Could not update combination: ${errorText(error)}`,
      "error"
    );
  }
}

function editCombination(id) {
  const combination = combinations.find((item) => item.id === id);

  if (!combination) return;

  $("editCombinationPanel").hidden = false;
  $("editCombinationId").value = combination.id;
  $("editCombinationName").value = combination.name;
  $("editCombinationDescription").value =
    combination.description || "";
  $("editCombinationActive").checked = !!combination.is_active;

  renderSubjectChoices(
    "editCombinationSubjectChoices",
    combination.subject_ids || []
  );

  $("editCombinationPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveCombination(event) {
  event.preventDefault();

  const id = $("editCombinationId").value;
  const name = $("editCombinationName").value.trim();
  const description =
    $("editCombinationDescription").value.trim();
  const active = $("editCombinationActive").checked;
  const ids = selectedIds("editCombinationSubjectChoices");

  if (!name || !ids.length) {
    return message(
      "editCombinationMessage",
      "Enter a name and select at least one subject.",
      "error"
    );
  }

  busyButton("saveCombinationButton", true, "Saving...");

  try {
    await currentSuperAdmin();

    const { error: updateError } = await supabase
      .from("subject_combinations")
      .update({
        name,
        description: description || null,
        is_active: active
      })
      .eq("id", id);

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
      .from("combination_subjects")
      .delete()
      .eq("combination_id", id);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from("combination_subjects")
      .insert(
        ids.map((subject_id) => ({
          combination_id: id,
          subject_id
        }))
      );

    if (insertError) throw insertError;

    await loadCombinations();

    $("editCombinationPanel").hidden = true;

    message(
      "editCombinationMessage",
      "Combination updated."
    );
  } catch (error) {
    message(
      "editCombinationMessage",
      `Could not save combination: ${errorText(error)}`,
      "error"
    );
  } finally {
    busyButton("saveCombinationButton", false);
  }
}

/* TEACHERS */

async function loadTeachers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "class_teacher")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;

  teachers = data || [];

  const select = $("assignmentTeacher");

  if (select) {
    select.innerHTML =
      '<option value="">Select a teacher</option>' +
      teachers.map((teacher) => `
        <option value="${esc(teacher.id)}">
          ${esc(teacher.full_name || "Unnamed teacher")}
        </option>
      `).join("");
  }
}

/* CLASSES */

async function loadClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, grade_level, academic_year, capacity, is_active")
    .order("name");

  if (error) throw error;

  classes = data || [];

  let assignments = [];

  if (classes.length) {
    const { data: rows, error: assignmentError } = await supabase
      .from("class_teacher_assignments")
      .select("class_id, teacher_id")
      .is("ended_at", null)
      .in("class_id", classes.map((item) => item.id));

    if (assignmentError) {
      console.warn(
        "Could not load teacher assignments:",
        assignmentError.message
      );
    } else {
      assignments = rows || [];
    }
  }

  const teacherIds = [
    ...new Set(assignments.map((item) => item.teacher_id))
  ];

  let teacherNames = new Map();

  if (teacherIds.length) {
    const { data: rows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);

    if (!profileError) {
      teacherNames = new Map(
        (rows || []).map((profile) => [
          profile.id,
          profile.full_name
        ])
      );
    }
  }

  const assignedTeachers = new Map(
    assignments.map((item) => [
      item.class_id,
      teacherNames.get(item.teacher_id) || "Assigned teacher"
    ])
  );

  const body = $("classesTableBody");

  if (body) {
    body.innerHTML = classes.length
      ? classes.map((item) => `
          <tr>
            <td>${esc(item.name)}</td>
            <td>${esc(item.grade_level)}</td>
            <td>${esc(item.academic_year)}</td>
            <td>${esc(item.capacity ?? "—")}</td>
            <td>${esc(assignedTeachers.get(item.id) || "Unassigned")}</td>
            <td>
              <span class="status ${item.is_active ? "" : "inactive"}">
                ${item.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td>
              <button
                class="button secondary"
                type="button"
                data-class-toggle="${esc(item.id)}"
                data-active="${!item.is_active}"
              >
                ${item.is_active ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="7">No classes created yet.</td></tr>';
  }

  const select = $("assignmentClass");

  if (select) {
    select.innerHTML =
      '<option value="">Select a class</option>' +
      classes
        .filter((item) => item.is_active)
        .map((item) => `
          <option value="${esc(item.id)}">
            ${esc(item.name)} — ${esc(item.grade_level)}
          </option>
        `).join("");
  }

  clearMessage("classesMessage");
}

async function addClass(event) {
  event.preventDefault();

  if (busy.has("class")) return;

  const name = $("className").value.trim();
  const grade_level = $("classGrade").value.trim();
  const academic_year = $("classYear").value.trim();
  const capacity = Number($("classCapacity").value);

  if (
    !name ||
    !grade_level ||
    !academic_year ||
    !Number.isInteger(capacity) ||
    capacity < 1
  ) {
    return message(
      "createClassMessage",
      "Enter valid class details and a positive capacity.",
      "error"
    );
  }

  busy.add("class");
  busyButton("createClassButton", true, "Creating...");

  try {
    await currentSuperAdmin();

    const { error } = await supabase.from("classes").insert({
      name,
      grade_level,
      academic_year,
      capacity
    });

    if (error) throw error;

    $("createClassForm").reset();

    await loadClasses();
    await loadOverview();

    message(
      "createClassMessage",
      "Class created successfully."
    );
  } catch (error) {
    message(
      "createClassMessage",
      `Could not create class: ${errorText(error)}`,
      "error"
    );
  } finally {
    busy.delete("class");
    busyButton("createClassButton", false);
  }
}

async function assignTeacher(event) {
  event.preventDefault();

  const p_class_id = $("assignmentClass").value;
  const p_teacher_id = $("assignmentTeacher").value;

  if (!p_class_id || !p_teacher_id) {
    return message(
      "assignTeacherMessage",
      "Select both a class and a teacher.",
      "error"
    );
  }

  busyButton("assignTeacherButton", true, "Assigning...");

  try {
    await currentSuperAdmin();

    const { error } = await supabase.rpc(
      "assign_class_teacher",
      { p_class_id, p_teacher_id }
    );

    if (error) throw error;

    await loadClasses();

    message(
      "assignTeacherMessage",
      "Teacher assigned successfully."
    );
  } catch (error) {
    message(
      "assignTeacherMessage",
      `Could not assign teacher: ${errorText(error)}`,
      "error"
    );
  } finally {
    busyButton("assignTeacherButton", false);
  }
}

async function toggleClass(id, active) {
  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("classes")
      .update({ is_active: active })
      .eq("id", id);

    if (error) throw error;

    await loadClasses();
    await loadOverview();

    message(
      "classesMessage",
      `Class ${active ? "activated" : "deactivated"}.`
    );
  } catch (error) {
    message(
      "classesMessage",
      `Could not update class: ${errorText(error)}`,
      "error"
    );
  }
}

/* STAFF MANAGEMENT */

async function loadStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .in("role", ["admin", "class_teacher"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  staff = data || [];

  const body = $("staffTableBody");

  if (body) {
    body.innerHTML = staff.length
      ? staff.map((person) => `
          <tr>
            <td>${esc(person.full_name || "—")}</td>
            <td>
              ${esc(
                person.role === "admin"
                  ? "Administrator"
                  : "Class Teacher"
              )}
            </td>
            <td>
              <span class="status ${person.is_active ? "" : "inactive"}">
                ${person.is_active ? "Active" : "Inactive"}
              </span>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="3">No staff accounts found.</td></tr>';
  }

  clearMessage("staffMessage");
}

async function createStaff(event) {
  event.preventDefault();

  if (busy.has("staff")) return;

  const full_name = $("staffName").value.trim();
  const email = $("staffEmail").value.trim();
  const role = $("staffRole").value;
  const password = $("staffPassword").value;

  if (
    !full_name ||
    !email ||
    !password ||
    !["admin", "class_teacher"].includes(role)
  ) {
    return message(
      "createStaffMessage",
      "Complete all fields and select a valid role.",
      "error"
    );
  }

  if (password.length < 12) {
    return message(
      "createStaffMessage",
      "Use a temporary password of at least 12 characters.",
      "error"
    );
  }

  busy.add("staff");
  busyButton("createStaffButton", true, "Creating...");

  try {
    await currentSuperAdmin();

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const token = sessionData.session?.access_token;

    if (!token) {
      throw new Error("Your session expired. Sign in again.");
    }

    const { data, error } = await supabase.functions.invoke(
      "create-staff",
      {
        body: { full_name, email, role, password },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    $("createStaffForm").reset();

    await loadStaff();
    await loadOverview();

    message(
      "createStaffMessage",
      "Staff account created successfully."
    );
  } catch (error) {
    message(
      "createStaffMessage",
      `Could not create staff account: ${errorText(error)}`,
      "error"
    );
  } finally {
    busy.delete("staff");
    busyButton("createStaffButton", false);
  }
}

/* EVENT LISTENERS */

function bindEvents() {
  $("createSubjectForm")?.addEventListener("submit", addSubject);

  $("refreshSubjectsButton")?.addEventListener("click", () => {
    loadSubjects().catch((error) => {
      message("subjectsMessage", errorText(error), "error");
    });
  });

  $("subjectsTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-subject-toggle]");

    if (button) {
      toggleSubject(
        button.dataset.subjectToggle,
        button.dataset.active === "true"
      );
    }
  });

  $("createCombinationForm")?.addEventListener(
    "submit",
    addCombination
  );

  $("editCombinationForm")?.addEventListener(
    "submit",
    saveCombination
  );

  $("cancelEditCombinationButton")?.addEventListener("click", () => {
    $("editCombinationPanel").hidden = true;
  });

  $("refreshCombinationsButton")?.addEventListener(
    "click",
    async () => {
      try {
        await loadCombinations();
      } catch (error) {
        message(
          "combinationsMessage",
          errorText(error),
          "error"
        );
      }
    }
  );

  $("combinationsTableBody")?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-combo-edit]");

    if (editButton) {
      editCombination(editButton.dataset.comboEdit);
      return;
    }

    const toggleButton = event.target.closest("[data-combo-active]");

    if (toggleButton) {
      toggleCombination(
        toggleButton.dataset.comboActive,
        toggleButton.dataset.active === "true"
      );
    }
  });

  $("createClassForm")?.addEventListener("submit", addClass);

  $("assignTeacherForm")?.addEventListener(
    "submit",
    assignTeacher
  );

  $("refreshClassesButton")?.addEventListener("click", async () => {
    try {
      await Promise.all([loadClasses(), loadTeachers()]);
    } catch (error) {
      message("classesMessage", errorText(error), "error");
    }
  });

  $("classesTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-class-toggle]");

    if (button) {
      toggleClass(
        button.dataset.classToggle,
        button.dataset.active === "true"
      );
    }
  });

  $("createStaffForm")?.addEventListener("submit", createStaff);

  $("refreshStaffButton")?.addEventListener("click", () => {
    loadStaff().catch((error) => {
      message("staffMessage", errorText(error), "error");
    });
  });
}

/* INITIALIZATION */

async function initialize() {
  initNavigation();
  bindEvents();

  try {
    await currentSuperAdmin();
  } catch (error) {
    console.error("Dashboard authorization failed:", error);

    const welcome = $("welcomeText");

    if (welcome) {
      welcome.textContent = errorText(error);
    }

    message("overviewMessage", errorText(error), "error");
    return;
  }

  const results = await Promise.allSettled([
    loadOverview(),
    loadSubjects(),
    loadClasses(),
    loadTeachers(),
    loadStaff()
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Dashboard startup task ${index + 1} failed:`,
        result.reason
      );
    }
  });

  try {
    await loadCombinations();
  } catch (error) {
    message(
      "combinationsMessage",
      `Could not load combinations: ${errorText(error)}`,
      "error"
    );
  }

  // Reload subjects first so combination names render correctly.
  try {
    await loadSubjects();
    await loadCombinations();
  } catch (error) {
    console.error(
      "Final subject/combination refresh failed:",
      error
    );
  }
}

document.addEventListener("DOMContentLoaded", initialize);
