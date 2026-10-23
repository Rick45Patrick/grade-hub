
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
  console.error(error);
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
      classes.filter((item) => item.is_active).map((item) => `
        <option value="${esc(item.id)}">
          ${esc(item.name)} — ${esc(item.grade_level)}
        </option>
      `).join("");
  }

  const examClass = $("examClass");

  if (examClass) {
    examClass.innerHTML =
      '<option value="">All classes</option>' +
      classes.filter((item) => item.is_active).map((item) => `
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

const CBC_LEVELS = [
  "EE1",
  "EE2",
  "ME1",
  "ME2",
  "AE1",
  "AE2",
  "BE1",
  "BE2"
];

/*
  Editable table:
  Level | Minimum Score | Maximum Score | Grade Points

  Display table:
  Grade Name | Minimum Score | Points
*/

function renderGradingRows(bands = []) {
  const body = $("gradingBandsBody");

  if (!body) return;

  body.innerHTML = CBC_LEVELS.map((level) => {
    const band = bands.find(
      (item) => item.grade_name === level
    );

    return `
      <tr>
        <td><strong>${esc(level)}</strong></td>

        <td>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            data-grade="${esc(level)}"
            data-field="minimum_score"
            aria-label="${esc(level)} minimum score"
            value="${band?.minimum_score ?? ""}"
            required
          >
        </td>

        <td>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            data-grade="${esc(level)}"
            data-field="maximum_score"
            aria-label="${esc(level)} maximum score"
            value="${band?.maximum_score ?? ""}"
            required
          >
        </td>

        <td>
          <input
            type="number"
            step="0.01"
            min="0"
            data-grade="${esc(level)}"
            data-field="grade_points"
            aria-label="${esc(level)} grade points"
            value="${band?.grade_points ?? ""}"
            placeholder="Optional"
          >
        </td>
      </tr>
    `;
  }).join("");
}

/*
  THIS IS THE REQUESTED GRADE SYSTEM TABLE.
  It displays only:
  1. Grade Name
  2. Minimum Score
  3. Points

  Values come directly from Supabase.
*/

function renderGradingSummary(bands = []) {
  const body = $("gradingSummaryBody");

  if (!body) return;

  const byLevel = new Map(
    bands.map((band) => [band.grade_name, band])
  );

  body.innerHTML = CBC_LEVELS.map((level) => {
    const band = byLevel.get(level);

    if (!band) {
      return `
        <tr>
          <td><strong>${esc(level)}</strong></td>
          <td>—</td>
          <td>—</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td><strong>${esc(band.grade_name)}</strong></td>
        <td>${esc(band.minimum_score)}</td>
        <td>
          ${
            band.grade_points == null
              ? "—"
              : esc(band.grade_points)
          }
        </td>
      </tr>
    `;
  }).join("");
}

function clearGradingForm() {
  if ($("gradingSystemSelect")) {
    $("gradingSystemSelect").value = "";
  }

  if ($("gradingSystemName")) {
    $("gradingSystemName").value = "Grade Hub Standard";
  }

  if ($("gradingDescription")) {
    $("gradingDescription").value = "";
  }

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
          <td>
            <span class="status ${
              system.is_active ? "" : "inactive"
            }">
              ${system.is_active ? "Active" : "Inactive"}
            </span>
          </td>
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
    .select(
      "id, name, version, description, is_active, created_at"
    )
    .order("name")
    .order("version", { ascending: false });

  if (error) throw error;

  gradingSystems = data || [];

  select.innerHTML =
    '<option value="">Create a new grading system</option>' +
    gradingSystems.map((system) => `
      <option value="${esc(system.id)}">
        ${esc(system.name)} — v${esc(system.version)}${
          system.is_active ? " (Active)" : ""
        }
      </option>
    `).join("");

  renderGradingSystemsTable();

  const activeSystem = gradingSystems.find(
    (system) => system.is_active
  );

  if (activeSystem) {
    select.value = activeSystem.id;
    await loadSelectedGradingSystem();
  } else {
    clearGradingForm();
    renderGradingSystemsTable();
  }
}

async function loadSelectedGradingSystem() {
  const id = $("gradingSystemSelect")?.value || "";

  clearMessage("gradingMessage");

  if (!id) {
    if ($("gradingSystemName")) {
      $("gradingSystemName").value = "Grade Hub Standard";
    }

    if ($("gradingDescription")) {
      $("gradingDescription").value = "";
    }

    renderGradingRows([]);
    renderGradingSummary([]);

    return;
  }

  const system = gradingSystems.find(
    (item) => item.id === id
  );

  if (!system) {
    throw new Error("Selected grading system was not found.");
  }

  const { data: bands, error } = await supabase
    .from("grade_bands")
    .select(
      "grade_name, minimum_score, maximum_score, grade_points"
    )
    .eq("grading_system_id", id);

  if (error) throw error;

  $("gradingSystemName").value = system.name;
  $("gradingDescription").value = system.description || "";

  renderGradingRows(bands || []);
  renderGradingSummary(bands || []);
}

function readGradingBands() {
  const rows = [
    ...$("gradingBandsBody").querySelectorAll("tr")
  ];

  const bands = rows.map((row) => {
    const get = (field) =>
      row.querySelector(`[data-field="${field}"]`).value.trim();

    const level =
      row.querySelector("[data-grade]").dataset.grade;

    const minText = get("minimum_score");
    const maxText = get("maximum_score");
    const pointsText = get("grade_points");

    const minimum_score = Number(minText);
    const maximum_score = Number(maxText);

    const grade_points =
      pointsText === "" ? null : Number(pointsText);

    if (
      minText === "" ||
      maxText === "" ||
      !Number.isFinite(minimum_score) ||
      !Number.isFinite(maximum_score) ||
      minimum_score < 0 ||
      maximum_score > 100 ||
      minimum_score >= maximum_score
    ) {
      throw new Error(
        `Enter a valid 0–100 score range for ${level}.`
      );
    }

    if (
      grade_points !== null &&
      (!Number.isFinite(grade_points) || grade_points < 0)
    ) {
      throw new Error(
        `Grade points for ${level} must be zero or higher.`
      );
    }

    return {
      grade_name: level,
      minimum_score,
      maximum_score,
      grade_points
    };
  });

  const sorted = [...bands].sort(
    (a, b) => a.minimum_score - b.minimum_score
  );

  if (sorted[0].minimum_score !== 0) {
    throw new Error(
      "The lowest score range must start at 0."
    );
  }

  if (sorted[sorted.length - 1].maximum_score !== 100) {
    throw new Error(
      "The highest score range must end at 100."
    );
  }

  for (let index = 1; index < sorted.length; index++) {
    if (
      Math.abs(
        sorted[index].minimum_score -
        sorted[index - 1].maximum_score
      ) > 0.000001
    ) {
      throw new Error(
        `Ranges must meet exactly without gaps or overlaps: check ${
          sorted[index - 1].grade_name
        } and ${sorted[index].grade_name}.`
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

  let newSystemId = null;
  let bandsInserted = false;
  let activated = false;

  try {
    await currentSuperAdmin();

    const name = $("gradingSystemName").value.trim();
    const description =
      $("gradingDescription").value.trim();

    if (!name) {
      throw new Error("Enter a grading system name.");
    }

    const bands = readGradingBands();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

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

    const { data: created, error: createError } =
      await supabase
        .from("grading_systems")
        .insert({
          name,
          version: nextVersion,
          description: description || null,
          is_active: false,
          created_by: authData.user.id
        })
        .select("id")
        .single();

    if (createError) throw createError;

    newSystemId = created.id;

    const { error: bandError } = await supabase
      .from("grade_bands")
      .insert(
        bands.map((band) => ({
          ...band,
          grading_system_id: newSystemId
        }))
      );

    if (bandError) throw bandError;

    bandsInserted = true;

    const oldActiveIds = gradingSystems
      .filter((system) => system.is_active)
      .map((system) => system.id);

    if (oldActiveIds.length) {
      const { error: deactivateError } = await supabase
        .from("grading_systems")
        .update({ is_active: false })
        .in("id", oldActiveIds);

      if (deactivateError) throw deactivateError;
    }

    const { error: activateError } = await supabase
      .from("grading_systems")
      .update({ is_active: true })
      .eq("id", newSystemId);

    if (activateError) throw activateError;

    activated = true;

    message(
      "gradingMessage",
      `Saved ${name}, version ${nextVersion}. Existing exams still reference their original grading system.`
    );

    await loadGradingEditor();

    $("gradingSystemSelect").value = newSystemId;

    await loadSelectedGradingSystem();
  } catch (error) {
    if (newSystemId && !activated) {
      if (bandsInserted) {
        await supabase
          .from("grade_bands")
          .delete()
          .eq("grading_system_id", newSystemId);
      }

      await supabase
        .from("grading_systems")
        .delete()
        .eq("id", newSystemId);
    }

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
}

document.addEventListener("DOMContentLoaded", initialize);
