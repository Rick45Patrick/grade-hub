import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

let subjects = [];
let combinations = [];
let classes = [];
let teachers = [];
let staff = [];
let gradingSystems = [];

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

function busyButton(id, isBusy, temporaryText = "Please wait...") {
  const element = $(id);

  if (!element) return;

  if (isBusy) {
    if (!element.dataset.oldText) {
      element.dataset.oldText = element.textContent;
    }

    element.disabled = true;
    element.textContent = temporaryText;
  } else {
    element.disabled = false;

    if (element.dataset.oldText) {
      element.textContent = element.dataset.oldText;
    }
  }
}

function errorText(error) {
  console.error("Grading system save failed:", {
  message: error?.message,
  code: error?.code,
  details: error?.details,
  hint: error?.hint
});
  return error?.message || String(error || "Unknown error");
}

/* =====================================================
   AUTHORIZATION
===================================================== */

async function currentSuperAdmin() {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;

  if (!auth.user) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
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
      `Signed in as ${
        profile.full_name || auth.user.email || "Super Admin"
      }`;
  }

  return {
    user: auth.user,
    profile
  };
}

/* =====================================================
   NAVIGATION
===================================================== */

function initNavigation() {
  const sections = [
    ...document.querySelectorAll(".section[id^='section-']")
  ];

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionName = button.dataset.section;
      const target = $("section-" + sectionName);

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
      alert(`Could not sign out: ${error.message}`);
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

/* =====================================================
   OVERVIEW
===================================================== */

async function countRows(table, filters = []) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { count, error } = await query;

  if (error) throw error;

  return count ?? 0;
}

async function loadOverview() {
  clearMessage("overviewMessage");

  const items = [
    ["totalStudents", () => countRows("students")],
    [
      "totalAdmins",
      () => countRows("profiles", [
        ["role", "admin"],
        ["is_active", true]
      ])
    ],
    [
      "totalTeachers",
      () => countRows("profiles", [
        ["role", "class_teacher"],
        ["is_active", true]
      ])
    ],
    [
      "totalClasses",
      () => countRows("classes", [
        ["is_active", true]
      ])
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

/* =====================================================
   SUBJECTS
===================================================== */

function selectedIds(containerId) {
  return [
    ...(
      $(containerId)?.querySelectorAll(
        'input[type="checkbox"]:checked'
      ) || []
    )
  ].map((input) => input.value);
}

function renderSubjectChoices(containerId, checked = []) {
  const box = $(containerId);

  if (!box) return;

  const activeSubjects = subjects.filter(
    (subject) => subject.is_active
  );

  if (!activeSubjects.length) {
    box.innerHTML =
      '<p class="muted">No active subjects. Add or activate subjects first.</p>';
    return;
  }

  box.innerHTML = activeSubjects.map((subject) => `
    <label class="check-item">
      <input
        type="checkbox"
        value="${esc(subject.id)}"
        ${checked.includes(subject.id) ? "checked" : ""}
      >
      <span>
        ${esc(subject.name)}
        ${
          subject.subject_code
            ? ` (${esc(subject.subject_code)})`
            : ""
        }
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
              <span class="status ${
                subject.is_active ? "" : "inactive"
              }">
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

  const oldEditSelection =
    selectedIds("editCombinationSubjectChoices");

  renderSubjectChoices("combinationSubjectChoices");

  renderSubjectChoices(
    "editCombinationSubjectChoices",
    oldEditSelection
  );
}

async function loadSubjects() {
  const body = $("subjectsTableBody");

  if (body) {
    body.innerHTML =
      '<tr><td colspan="5">Loading subjects...</td></tr>';
  }

  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, subject_code, description, is_active, created_at"
    )
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
    message(
      "createSubjectMessage",
      "Enter a subject name.",
      "error"
    );
    return;
  }

  busy.add("subject");
  busyButton("createSubjectButton", true, "Adding...");
  clearMessage("createSubjectMessage");

  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("subjects")
      .insert({
        name,
        subject_code: subjectCode || null,
        description: description || null,
        is_active: true
      });

    if (error) throw error;

    $("createSubjectForm")?.reset();

    await loadSubjects();

    message(
      "createSubjectMessage",
      "Subject added successfully."
    );
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

/* =====================================================
   SUBJECT COMBINATIONS
===================================================== */

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
        combinations.map((item) => item.id)
      );

    if (linkError) throw linkError;

    const map = new Map();

    (links || []).forEach((link) => {
      if (!map.has(link.combination_id)) {
        map.set(link.combination_id, []);
      }

      map.get(link.combination_id).push(link.subject_id);
    });

    combinations = combinations.map((item) => ({
      ...item,
      subject_ids: map.get(item.id) || []
    }));
  }

  if (body) {
    body.innerHTML = combinations.length
      ? combinations.map((item) => {
          const names = (item.subject_ids || [])
            .map((id) =>
              subjects.find((subject) => subject.id === id)?.name
            )
            .filter(Boolean)
            .join(", ");

          return `
            <tr>
              <td>${esc(item.name)}</td>
              <td>${esc(names || "No subjects linked")}</td>
              <td>
                <span class="status ${
                  item.is_active ? "" : "inactive"
                }">
                  ${item.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td>
                <button
                  class="button secondary"
                  type="button"
                  data-combo-edit="${esc(item.id)}"
                >Edit</button>

                <button
                  class="button secondary"
                  type="button"
                  data-combo-active="${esc(item.id)}"
                  data-active="${!item.is_active}"
                >
                  ${item.is_active ? "Deactivate" : "Activate"}
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
    message(
      "createCombinationMessage",
      "Enter a combination name.",
      "error"
    );
    return;
  }

  if (!ids.length) {
    message(
      "createCombinationMessage",
      "Select at least one subject.",
      "error"
    );
    return;
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

async function editCombination(id) {
  const combination = combinations.find(
    (item) => item.id === id
  );

  if (!combination) return;

  $("editCombinationPanel").hidden = false;
  $("editCombinationId").value = combination.id;
  $("editCombinationName").value = combination.name;
  $("editCombinationDescription").value =
    combination.description || "";
  $("editCombinationActive").checked =
    !!combination.is_active;

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
    message(
      "editCombinationMessage",
      "Enter a name and select at least one subject.",
      "error"
    );
    return;
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

/* =====================================================
   TEACHERS AND CLASSES
===================================================== */

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

async function loadClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, name, grade_level, academic_year, capacity, is_active"
    )
    .order("name");

  if (error) throw error;

  classes = data || [];

  let assignments = [];

  if (classes.length) {
    const { data: rows, error: assignmentError } =
      await supabase
        .from("class_teacher_assignments")
        .select("class_id, teacher_id")
        .is("ended_at", null)
        .in(
          "class_id",
          classes.map((item) => item.id)
        );

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
    const { data: profiles, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

    if (!profileError) {
      teacherNames = new Map(
        (profiles || []).map((profile) => [
          profile.id,
          profile.full_name
        ])
      );
    }
  }

  const assignedTeacherNames = new Map(
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
            <td>${esc(
              assignedTeacherNames.get(item.id) || "Unassigned"
            )}</td>
            <td>
              <span class="status ${
                item.is_active ? "" : "inactive"
              }">
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
    message(
      "createClassMessage",
      "Enter valid class details and a positive capacity.",
      "error"
    );
    return;
  }

  busy.add("class");
  busyButton("createClassButton", true, "Creating...");

  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("classes")
      .insert({
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
    message(
      "assignTeacherMessage",
      "Select both a class and a teacher.",
      "error"
    );
    return;
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

/* =====================================================
   STAFF ACCOUNTS
===================================================== */

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
      ? staff.map((item) => `
          <tr>
            <td>${esc(item.full_name || "—")}</td>
            <td>
              ${esc(
                item.role === "admin"
                  ? "Administrator"
                  : "Class Teacher"
              )}
            </td>
            <td>
              <span class="status ${
                item.is_active ? "" : "inactive"
              }">
                ${item.is_active ? "Active" : "Inactive"}
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
    message(
      "createStaffMessage",
      "Complete all fields and select a valid role.",
      "error"
    );
    return;
  }

  if (password.length < 12) {
    message(
      "createStaffMessage",
      "Use a temporary password of at least 12 characters.",
      "error"
    );
    return;
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
      throw new Error(
        "Your session expired. Sign in again."
      );
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

    if (data?.error) {
      throw new Error(data.error);
    }

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

/* =====================================================
   EXAMS
===================================================== */
async function loadGradingSystemsForExams() {
  const select = $("examGradingSystem");

  if (!select) return;

  const { data, error } = await supabase
    .from("grading_systems")
    .select("id, name, version, is_active")
    .order("name")
    .order("version", { ascending: false });

  if (error) {
    console.warn("Could not load grading systems:", error.message);

    select.innerHTML =
      '<option value="">No grading systems available</option>';

    return;
  }

  select.innerHTML =
    '<option value="">Choose a grading system</option>' +
    (data || []).map((system) => `
      <option value="${esc(system.id)}">
        ${esc(system.name)} — v${esc(system.version)}${
          system.is_active ? " (Active)" : ""
        }
      </option>
    `).join("");
}

async function loadExams() {
  const body = $("examsTableBody");

  if (body) {
    body.innerHTML =
      '<tr><td colspan="6">Loading exams...</td></tr>';
  }

  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, name, academic_year, term, class_id, grading_system_id, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (body) {
      body.innerHTML =
        '<tr><td colspan="6">Could not load exams.</td></tr>';
    }

    throw error;
  }

  const rows = data || [];
  const classMap = new Map(
    classes.map((item) => [item.id, item.name])
  );

  if (body) {
    body.innerHTML = rows.length
      ? rows.map((exam) => {
          const status =
            String(exam.status || "draft").toLowerCase();

          let actions = "";

          if (status === "draft") {
            actions = `
              <button
                class="button secondary"
                type="button"
                data-exam-status="${esc(exam.id)}"
                data-status="published"
              >Publish</button>

              <button
                class="button secondary"
                type="button"
                data-exam-status="${esc(exam.id)}"
                data-status="archived"
              >Archive</button>
            `;
          } else if (status === "published") {
            actions = `
              <button
                class="button secondary"
                type="button"
                data-exam-status="${esc(exam.id)}"
                data-status="archived"
              >Archive</button>
            `;
          } else {
            actions = `
              <button
                class="button secondary"
                type="button"
                data-exam-status="${esc(exam.id)}"
                data-status="draft"
              >Return to Draft</button>
            `;
          }

          return `
            <tr>
              <td>${esc(exam.name)}</td>
              <td>${esc(exam.academic_year)}</td>
              <td>${esc(exam.term)}</td>
              <td>
                ${esc(
                  exam.class_id
                    ? classMap.get(exam.class_id) || "Assigned class"
                    : "All classes"
                )}
              </td>
              <td>
                <span class="status ${
                  status === "published" ? "" : "inactive"
                }">
                  ${esc(
                    status.charAt(0).toUpperCase() + status.slice(1)
                  )}
                </span>
              </td>
              <td>${actions}</td>
            </tr>
          `;
        }).join("")
      : '<tr><td colspan="6">No exams created yet.</td></tr>';
  }

  clearMessage("examsMessage");
}

async function createExam(event) {
  event.preventDefault();

  if (busy.has("exam")) return;

  const name = $("examName")?.value.trim() || "";
  const academic_year =
    $("examAcademicYear")?.value.trim() || "";
  const term = $("examTerm")?.value.trim() || "";
  const class_id = $("examClass")?.value || null;
  const grading_system_id =
    $("examGradingSystem")?.value || "";

  if (!name || !academic_year || !term) {
    message(
      "createExamMessage",
      "Enter the exam name, academic year, and term.",
      "error"
    );
    return;
  }

  if (!grading_system_id) {
    message(
      "createExamMessage",
      "Create or select a grading system before creating an exam.",
      "error"
    );
    return;
  }

  busy.add("exam");
  busyButton("createExamButton", true, "Creating...");

  try {
    const { user } = await currentSuperAdmin();

    const { error } = await supabase
      .from("exams")
      .insert({
        name,
        academic_year,
        term,
        class_id,
        grading_system_id,
        status: "draft",
        created_by: user.id
      });

    if (error) throw error;

    $("createExamForm")?.reset();

    await loadExams();

    message(
      "createExamMessage",
      "Exam created as a draft. It is not published yet."
    );
  } catch (error) {
    message(
      "createExamMessage",
      `Could not create exam: ${errorText(error)}`,
      "error"
    );
  } finally {
    busy.delete("exam");
    busyButton("createExamButton", false);
  }
}

async function updateExamStatus(id, status) {
  if (!["draft", "published", "archived"].includes(status)) {
    return;
  }

  const promptText = status === "published"
    ? "Publish this exam? Confirm that the exam is ready to be visible as published."
    : `Change this exam status to ${status}?`;

  if (!window.confirm(promptText)) return;

  try {
    await currentSuperAdmin();

    const { error } = await supabase
      .from("exams")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    await loadExams();

    message(
      "examsMessage",
      `Exam status changed to ${status}.`
    );
  } catch (error) {
    message(
      "examsMessage",
      `Could not update exam: ${errorText(error)}`,
      "error"
    );
  }
}

/* =====================================================
   CBC GRADING SYSTEM
===================================================== */

const CBC_LEVELS = ["EE1", "EE2", "ME1", "ME2", "AE1", "AE2", "BE1", "BE2"];
function renderGradingRows(bands = []) {
  const body = $("gradingBandsBody");
  if (!body) return;

  const rows = bands.length ? bands : CBC_LEVELS.map((grade_name) => ({
    grade_name, minimum_score: "", maximum_score: "", grade_points: ""
  }));

  body.innerHTML = rows.map((band, index) => `
    <tr>
      <td><input type="text" data-field="grade_name" value="${esc(band.grade_name || "")}" maxlength="30" aria-label="Grade name" required></td>
      <td><input type="number" data-field="minimum_score" value="${band.minimum_score ?? ""}" min="0" max="100" step="0.01" aria-label="Minimum score" required></td>
      <td><input type="number" data-field="maximum_score" value="${band.maximum_score ?? ""}" min="0" max="100" step="0.01" aria-label="Maximum score" required></td>
      <td><input type="number" data-field="grade_points" value="${band.grade_points ?? ""}" min="0" step="0.01" aria-label="Grade points" placeholder="Optional"></td>
      <td><button class="button secondary" type="button" data-delete-grade="${index}">Delete</button></td>
    </tr>
  `).join("");
}

function renderGradingSummary(bands = []) {
  const body = $("gradingSummaryBody");
  if (!body) return;

  body.innerHTML = bands.length
    ? [...bands].sort((a, b) => Number(a.minimum_score) - Number(b.minimum_score)).map((band) => `
        <tr>
          <td><strong>${esc(band.grade_name)}</strong></td>
          <td>${esc(band.minimum_score)}</td>
          <td>${band.grade_points == null ? "—" : esc(band.grade_points)}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="3">No grades to display yet.</td></tr>';
}

function clearGradingForm() {
  if ($("gradingSystemSelect")) $("gradingSystemSelect").value = "";
  if ($("gradingSystemName")) $("gradingSystemName").value = "Grade Hub Standard";
  if ($("gradingDescription")) $("gradingDescription").value = "";
  renderGradingRows([]);
  renderGradingSummary([]);
  clearMessage("gradingMessage");
}

function renderGradingSystemsTable() {
  const body = $("gradingSystemsTableBody");
  if (!body) return;

  body.innerHTML = gradingSystems.length
    ? gradingSystems.map((system) => `
        <tr>
          <td>${esc(system.name)}</td>
          <td>${esc(system.version)}</td>
          <td><span class="status ${system.is_active ? "" : "inactive"}">${system.is_active ? "Active" : "Inactive"}</span></td>
          <td>${esc(system.description || "—")}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="4">No grading systems have been created.</td></tr>';
}

async function loadGradingEditor() {
  const select = $("gradingSystemSelect");
  if (!select) return;

  const { data, error } = await supabase
    .from("grading_systems")
    .select("id, name, version, description, is_active, created_at")
    .order("name")
    .order("version", { ascending: false });
  if (error) throw error;

  gradingSystems = data || [];
  select.innerHTML = '<option value="">Create a new grading system</option>' +
    gradingSystems.map((system) => `
      <option value="${esc(system.id)}">${esc(system.name)} — v${esc(system.version)}${system.is_active ? " (Active)" : ""}</option>
    `).join("");
  renderGradingSystemsTable();

  const activeSystem = gradingSystems.find((system) => system.is_active);
  if (activeSystem) {
    select.value = activeSystem.id;
    await loadSelectedGradingSystem();
  } else {
    clearGradingForm();
  }
}

async function loadSelectedGradingSystem() {
  const id = $("gradingSystemSelect")?.value || "";
  clearMessage("gradingMessage");

  if (!id) {
    if ($("gradingSystemName")) $("gradingSystemName").value = "Grade Hub Standard";
    if ($("gradingDescription")) $("gradingDescription").value = "";
    renderGradingRows([]);
    renderGradingSummary([]);
    return;
  }

  const system = gradingSystems.find((item) => item.id === id);
  if (!system) throw new Error("Selected grading system was not found.");

  const { data: bands, error } = await supabase
    .from("grade_bands")
    .select("grade_name, minimum_score, maximum_score, grade_points")
    .eq("grading_system_id", id);
  if (error) throw error;

  $("gradingSystemName").value = system.name;
  $("gradingDescription").value = system.description || "";
  renderGradingRows(bands || []);
  renderGradingSummary(bands || []);
}

function readGradingBands() {
  const body = $("gradingBandsBody");
  if (!body) throw new Error("The grading table could not be found.");

  const rows = [...body.querySelectorAll("tr")].filter((row) => row.querySelector('[data-field="grade_name"]'));
  if (!rows.length) throw new Error("Add at least one grade row.");

  const bands = rows.map((row) => {
    const get = (field) => row.querySelector(`[data-field="${field}"]`)?.value.trim() ?? "";
    const grade_name = get("grade_name");
    const minText = get("minimum_score");
    const maxText = get("maximum_score");
    const pointsText = get("grade_points");
    const minimum_score = Number(minText);
    const maximum_score = Number(maxText);
    const grade_points = pointsText === "" ? null : Number(pointsText);

    if (!grade_name) throw new Error("Every grade must have a name.");
    if (minText === "" || maxText === "") throw new Error(`Enter both score boundaries for ${grade_name}.`);
    if (!Number.isFinite(minimum_score) || !Number.isFinite(maximum_score) || minimum_score < 0 || maximum_score > 100 || minimum_score >= maximum_score) {
      throw new Error(`Enter a valid score range from 0 to 100 for ${grade_name}.`);
    }
    if (grade_points !== null && (!Number.isFinite(grade_points) || grade_points < 0)) {
      throw new Error(`Points for ${grade_name} must be zero or higher.`);
    }
    return { grade_name, minimum_score, maximum_score, grade_points };
  });

  const names = bands.map((band) => band.grade_name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Each grade name must be unique.");

 const sorted = [...bands].sort(
  (a, b) => a.minimum_score - b.minimum_score
);

for (let i = 1; i < sorted.length; i++) {
  if (sorted[i].minimum_score < sorted[i - 1].maximum_score) {
    throw new Error(
      `Score ranges must not overlap: check ${sorted[i - 1].grade_name} and ${sorted[i].grade_name}.`
    );
  }
}
  return bands;
}

async function saveGradingVersion(event) {
  event.preventDefault();

  if (busy.has("grading")) return;

  busy.add("grading");
  busyButton("saveGradingButton", true, "Saving...");
  clearMessage("gradingMessage");

  try {
    // Verify the current account before saving.
    await currentSuperAdmin();

    const name =
      $("gradingSystemName")?.value.trim() || "";

    const description =
      $("gradingDescription")?.value.trim() || "";

    if (!name) {
      throw new Error("Enter a grading system name.");
    }

    // Validate grade names, score ranges and points.
    const bands = readGradingBands();

    // Confirm the authenticated user and obtain their ID.
    const {
      data: authData,
      error: authError
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    // Calculate the next version for this grading-system name.
    const versions = gradingSystems.filter(
      (system) =>
        system.name.toLowerCase() === name.toLowerCase()
    );

    const nextVersion = versions.length
      ? Math.max(
          ...versions.map(
            (system) => Number(system.version) || 1
          )
        ) + 1
      : 1;

    // Save the system, all its grade bands, and activation
    // through the secure database function.
    const {
      data: newSystemId,
      error: saveError
    } = await supabase.rpc(
      "save_grading_system_with_bands",
      {
        p_name: name,
        p_description: description || null,
        p_version: nextVersion,
        p_bands: bands
      }
    );

    if (saveError) throw saveError;

    if (!newSystemId) {
      throw new Error(
        "The database did not return the new grading-system ID."
      );
    }

    // Refresh the dashboard using the newly saved system.
    await loadGradingEditor();

    const select = $("gradingSystemSelect");

    if (select) {
      select.value = newSystemId;
    }

    await loadSelectedGradingSystem();

    message(
      "gradingMessage",
      `Saved ${name}, version ${nextVersion}. ` +
      "The grade bands were saved and the new system is active. " +
      "Existing exams retain their original grading-system references."
    );

  } catch (error) {
    console.error(
      "Grading-system save failed:",
      error
    );

    message(
      "gradingMessage",
      `Could not save grading system: ${errorText(error)}`,
      "error"
    );

  } finally {
    busy.delete("grading");
    busyButton("saveGradingButton", false);
  }
}
/* =====================================================
   NEWSLETTERS / SCHOOL DOCUMENTS
   Uses Supabase Storage bucket: newsletters
===================================================== */
const NEWSLETTER_BUCKET = "newsletters";
const MAX_NEWSLETTER_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function safeStorageName(name) {
  return String(name || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "document";
}

async function loadNewsletters() {
  const body = $("newslettersTableBody");
  if (!body) return;
  body.innerHTML = '<tr><td colspan="4">Loading documents...</td></tr>';

  const { data, error } = await supabase.storage
    .from(NEWSLETTER_BUCKET)
    .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;

  const files = (data || []).filter((file) => file.name && file.id);
  if (!files.length) {
    body.innerHTML = '<tr><td colspan="4">No newsletters have been uploaded yet.</td></tr>';
    return;
  }

  body.innerHTML = files.map((file) => {
    const nameParts = file.name.split("__");
    const title = nameParts.length > 1 ? nameParts[0].replace(/^\d+_/, "").replace(/-/g, " ") : file.name;
    const size = file.metadata?.size ?? null;
    const date = file.created_at ? new Date(file.created_at).toLocaleString() : "—";
    return `<tr>
      <td class="file-name"><strong>${esc(title)}</strong><br><small>${esc(file.name)}</small></td>
      <td>${formatFileSize(size)}</td>
      <td>${esc(date)}</td>
      <td>
        <button class="button secondary" type="button" data-newsletter-download="${esc(file.name)}">Download</button>
        <button class="button secondary" type="button" data-newsletter-delete="${esc(file.name)}">Delete</button>
      </td>
    </tr>`;
  }).join("");
}

async function uploadNewsletter(event) {
  event.preventDefault();
  if (busy.has("newsletterUpload")) return;

  const title = $("newsletterTitle")?.value.trim() || "";
  const file = $("newsletterFile")?.files?.[0];
  if (!title) {
    message("newslettersMessage", "Enter a document title.", "error");
    return;
  }
  if (!file) {
    message("newslettersMessage", "Choose a file to upload.", "error");
    return;
  }
  if (file.size > MAX_NEWSLETTER_BYTES) {
    message("newslettersMessage", "The file is larger than 20 MB. Choose a smaller file.", "error");
    return;
  }

  busy.add("newsletterUpload");
  busyButton("uploadNewsletterButton", true, "Uploading...");
  clearMessage("newslettersMessage");
  try {
    await currentSuperAdmin();
    const storageName = `${Date.now()}_${safeStorageName(title)}__${safeStorageName(file.name)}`;
    const { error } = await supabase.storage.from(NEWSLETTER_BUCKET).upload(storageName, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });
    if (error) throw error;

    message("newslettersMessage", `Uploaded "${title}" successfully.`);
    $("newsletterUploadForm")?.reset();
    await loadNewsletters();
  } catch (error) {
    message("newslettersMessage", `Upload failed: ${errorText(error)}. Confirm the '${NEWSLETTER_BUCKET}' bucket and its storage policies exist in Supabase.`, "error");
  } finally {
    busy.delete("newsletterUpload");
    busyButton("uploadNewsletterButton", false);
  }
}

async function downloadNewsletter(path) {
  try {
    await currentSuperAdmin();
    const { data, error } = await supabase.storage.from(NEWSLETTER_BUCKET).createSignedUrl(path, 60);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("Could not create a download link.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    message("newslettersMessage", `Download failed: ${errorText(error)}`, "error");
  }
}

async function deleteNewsletter(path) {
  if (!window.confirm(`Delete this newsletter file?\n\n${path}`)) return;
  try {
    await currentSuperAdmin();
    const { error } = await supabase.storage.from(NEWSLETTER_BUCKET).remove([path]);
    if (error) throw error;
    message("newslettersMessage", "Document deleted.");
    await loadNewsletters();
  } catch (error) {
    message("newslettersMessage", `Delete failed: ${errorText(error)}`, "error");
  }
}

/* =====================================================
   EVENT LISTENERS
===================================================== */

function bindEvents() {
  $("createSubjectForm")?.addEventListener(
    "submit",
    addSubject
  );

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

  $("cancelEditCombinationButton")?.addEventListener(
    "click",
    () => {
      $("editCombinationPanel").hidden = true;
    }
  );

  $("refreshCombinationsButton")?.addEventListener(
    "click",
    () => {
      loadCombinations().catch((error) => {
        message(
          "combinationsMessage",
          errorText(error),
          "error"
        );
      });
    }
  );

  $("combinationsTableBody")?.addEventListener(
    "click",
    (event) => {
      const editButton =
        event.target.closest("[data-combo-edit]");

      if (editButton) {
        editCombination(editButton.dataset.comboEdit);
        return;
      }

      const toggleButton =
        event.target.closest("[data-combo-active]");

      if (toggleButton) {
        toggleCombination(
          toggleButton.dataset.comboActive,
          toggleButton.dataset.active === "true"
        );
      }
    }
  );

  $("createClassForm")?.addEventListener(
    "submit",
    addClass
  );

  $("assignTeacherForm")?.addEventListener(
    "submit",
    assignTeacher
  );

  $("refreshClassesButton")?.addEventListener("click", async () => {
    try {
      await Promise.all([
        loadClasses(),
        loadTeachers()
      ]);
    } catch (error) {
      message(
        "classesMessage",
        errorText(error),
        "error"
      );
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

  $("createStaffForm")?.addEventListener(
    "submit",
    createStaff
  );

  $("refreshStaffButton")?.addEventListener("click", () => {
    loadStaff().catch((error) => {
      message("staffMessage", errorText(error), "error");
    });
  });

  $("createExamForm")?.addEventListener(
    "submit",
    createExam
  );

  $("refreshExamsButton")?.addEventListener("click", async () => {
    try {
      await loadClasses();
      await loadGradingSystemsForExams();
      await loadExams();
    } catch (error) {
      message(
        "examsMessage",
        errorText(error),
        "error"
      );
    }
  });

  $("examsTableBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exam-status]");

    if (button) {
      updateExamStatus(
        button.dataset.examStatus,
        button.dataset.status
      );
    }
  });

  $("gradingForm")?.addEventListener(
    "submit",
    saveGradingVersion
  );

  $("gradingSystemSelect")?.addEventListener("change", () => {
    loadSelectedGradingSystem().catch((error) => {
      message("gradingMessage", errorText(error), "error");
    });
  });

  $("resetGradingButton")?.addEventListener(
    "click",
    clearGradingForm
  );

  $("refreshGradingButton")?.addEventListener("click", () => {
    loadGradingEditor().catch((error) => {
      message("gradingMessage", errorText(error), "error");
    });
  });

  $("addGradeRowButton")?.addEventListener("click", () => {
    const body = $("gradingBandsBody");
    if (!body) return;
    const bands = [...body.querySelectorAll("tr")]
      .filter((row) => row.querySelector('[data-field="grade_name"]'))
      .map((row) => ({
        grade_name: row.querySelector('[data-field="grade_name"]')?.value ?? "",
        minimum_score: row.querySelector('[data-field="minimum_score"]')?.value ?? "",
        maximum_score: row.querySelector('[data-field="maximum_score"]')?.value ?? "",
        grade_points: row.querySelector('[data-field="grade_points"]')?.value ?? ""
      }));
    bands.push({ grade_name: "", minimum_score: "", maximum_score: "", grade_points: "" });
    renderGradingRows(bands);
    const inputs = body.querySelectorAll('[data-field="grade_name"]');
    inputs[inputs.length - 1]?.focus();
    clearMessage("gradingMessage");
  });

  $("gradingBandsBody")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-grade]");
    if (!button) return;
    const body = $("gradingBandsBody");
    const rows = [...body.querySelectorAll("tr")]
      .filter((row) => row.querySelector('[data-field="grade_name"]'));
    const index = Number(button.dataset.deleteGrade);
    if (!Number.isInteger(index) || !rows[index]) return;
    if (rows.length === 1) {
      message("gradingMessage", "Keep at least one grade row.", "error");
      return;
    }
    const bands = rows.filter((_, rowIndex) => rowIndex !== index).map((row) => ({
      grade_name: row.querySelector('[data-field="grade_name"]').value,
      minimum_score: row.querySelector('[data-field="minimum_score"]').value,
      maximum_score: row.querySelector('[data-field="maximum_score"]').value,
      grade_points: row.querySelector('[data-field="grade_points"]').value
    }));
    renderGradingRows(bands);
    clearMessage("gradingMessage");
  });

  $("newsletterUploadForm")?.addEventListener("submit", uploadNewsletter);
  $("refreshNewslettersButton")?.addEventListener("click", () => {
    loadNewsletters().catch((error) => message("newslettersMessage", errorText(error), "error"));
  });
  $("newslettersTableBody")?.addEventListener("click", (event) => {
    const downloadButton = event.target.closest("[data-newsletter-download]");
    if (downloadButton) {
      downloadNewsletter(downloadButton.dataset.newsletterDownload);
      return;
    }
    const deleteButton = event.target.closest("[data-newsletter-delete]");
    if (deleteButton) deleteNewsletter(deleteButton.dataset.newsletterDelete);
  });
}

/* =====================================================
   INITIALIZATION
===================================================== */

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

    message(
      "overviewMessage",
      errorText(error),
      "error"
    );

    return;
  }

  const initialTasks = await Promise.allSettled([
    loadOverview(),
    loadSubjects(),
    loadClasses(),
    loadTeachers(),
    loadStaff()
  ]);

  initialTasks.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Dashboard startup task ${index + 1} failed:`,
        result.reason
      );
    }
  });

  try {
    await loadGradingEditor();
  } catch (error) {
    message(
      "gradingMessage",
      `Could not load grading systems: ${errorText(error)}`,
      "error"
    );
  }

  try {
    await loadGradingSystemsForExams();
    await loadExams();
  } catch (error) {
    message(
      "examsMessage",
      `Could not initialize exams: ${errorText(error)}`,
      "error"
    );
  }

  try {
    await loadCombinations();
  } catch (error) {
    message(
      "combinationsMessage",
      `Could not load combinations: ${errorText(error)}`,
      "error"
    );
  }

  try {
    await loadSubjects();
    await loadCombinations();
  } catch (error) {
    console.error(
      "Final subject/combination refresh failed:",
      error
    );
  }

  try {
    await loadNewsletters();
  } catch (error) {
    message("newslettersMessage", `Could not load newsletters: ${errorText(error)}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", initialize);
