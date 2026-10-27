import { supabase } from "./supabase.js";

/* =========================================================
   GRADE HUB 2.0 — ADMIN DASHBOARD
   Uses the existing Supabase client in js/supabase.js
========================================================= */

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let activePage = "Dashboard";

let students = [];
let classes = [];
let subjects = [];
let combinations = [];
let gradingSystems = [];
let exams = [];
let profiles = [];

let messageTimer = null;

/* =========================================================
   GENERAL HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showMessage(message, type = "success") {
    const box = $("message");

    if (!box) return;

    clearTimeout(messageTimer);

    box.textContent = message;
    box.className = `message show ${type}`;

    messageTimer = setTimeout(() => {
        box.classList.remove("show");
    }, 6000);
}

function showError(error, fallback = "Something went wrong.") {
    console.error(error);

    const message = error?.message || fallback;
    showMessage(message, "error");
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString();
}

function formatNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString()
        : "0";
}

function emptyRow(columns, text = "No records found.") {
    return `
        <tr>
            <td colspan="${columns}" class="empty">
                ${escapeHTML(text)}
            </td>
        </tr>
    `;
}

function setLoadingScreen(visible) {
    $("loadingScreen")?.classList.toggle("hidden", !visible);
}

function showDashboard() {
    $("dashboard")?.classList.remove("hidden");
    $("accessDenied")?.classList.add("hidden");
    setLoadingScreen(false);
}

function denyAccess(reason) {
    $("dashboard")?.classList.add("hidden");
    $("accessDenied")?.classList.remove("hidden");
    setLoadingScreen(false);

    $("accessDeniedText").textContent = reason;
}

function redirectToLogin() {
    window.location.href = "../index.html";
}

function optionList(items, selectedValue = "") {
    return items.map((item) => `
        <option
            value="${escapeHTML(item.id)}"
            ${String(item.id) === String(selectedValue) ? "selected" : ""}
        >
            ${escapeHTML(item.name)}
        </option>
    `).join("");
}

function className(classId) {
    return classes.find((item) => item.id === classId)?.name || "Unassigned";
}

function subjectName(subjectId) {
    return subjects.find((item) => item.id === subjectId)?.name || "Unknown subject";
}

function studentName(student) {
    const profile = profiles.find(
        (item) => item.id === student.profile_id
    );

    return profile?.full_name || "Unnamed student";
}

function profileName(profileId) {
    return profiles.find((item) => item.id === profileId)?.full_name
        || "Unknown user";
}

function createModulePage(id, title, content) {
    let page = $(id);

    if (!page) {
        page = document.createElement("section");
        page.id = id;
        page.className = "module-content hidden";
        $("moduleArea").appendChild(page);
    }

    page.innerHTML = content;

    return page;
}

function setButtonLoading(button, loading, loadingText = "Saving...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || "Save";
    }
}

/* =========================================================
   AUTHENTICATION AND ACCOUNT ACCESS
========================================================= */

async function checkAccount() {
    setLoadingScreen(true);

    try {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
            redirectToLogin();
            return false;
        }

        currentUser = session.user;

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, role, is_active")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            denyAccess("Your account profile was not found.");
            return false;
        }

        if (profile.is_active !== true) {
            denyAccess("Your account is inactive. Contact Super Admin.");
            return false;
        }

        if (!["admin", "super_admin"].includes(profile.role)) {
            denyAccess("This page is available only to administrators.");
            return false;
        }

        currentProfile = profile;

        showDashboard();

        $("welcomeText").textContent =
            `Welcome, ${profile.full_name || "Administrator"} (${profile.role.replace("_", " ")}).`;

        return true;
    } catch (error) {
        showError(error, "Could not verify your administrator account.");
        denyAccess(
            "Account verification failed. Check your connection and Supabase permissions, then try again."
        );

        return false;
    }
}

/* =========================================================
   LOAD BASE DATA
========================================================= */

async function loadBaseData() {
    showMessage("Loading dashboard data...", "success");

    try {
        const [
            studentsResult,
            classesResult,
            subjectsResult,
            combinationsResult,
            gradingResult,
            examsResult,
            profilesResult
        ] = await Promise.all([
            supabase
                .from("students")
                .select("id, profile_id, admission_number, registration_status, class_id, created_at")
                .order("created_at", { ascending: false }),

            supabase
                .from("classes")
                .select("id, name, grade_level, academic_year, capacity, is_active")
                .order("name"),

            supabase
                .from("subjects")
                .select("id, name, subject_code, description, is_active")
                .order("name"),

            supabase
                .from("subject_combinations")
                .select("id, name, description, is_active")
                .order("name"),

            supabase
                .from("grading_systems")
                .select("id, name, version, description, is_active, created_at")
                .order("created_at", { ascending: false }),

            supabase
                .from("exams")
                .select("id, name, academic_year, term, class_id, grading_system_id, status, starts_on, ends_on")
                .order("created_at", { ascending: false }),

            supabase
                .from("profiles")
                .select("id, full_name, role, is_active")
                .order("full_name")
        ]);

        const results = [
            studentsResult,
            classesResult,
            subjectsResult,
            combinationsResult,
            gradingResult,
            examsResult,
            profilesResult
        ];

        const failedResult = results.find((result) => result.error);

        if (failedResult) {
            throw failedResult.error;
        }

        students = studentsResult.data || [];
        classes = classesResult.data || [];
        subjects = subjectsResult.data || [];
        combinations = combinationsResult.data || [];
        gradingSystems = gradingResult.data || [];
        exams = examsResult.data || [];
        profiles = profilesResult.data || [];

        updateStatistics();
        populateClassFilter();
        renderStudents();

        showMessage("Dashboard data loaded.", "success");

        return true;
    } catch (error) {
        showError(
            error,
            "Could not load dashboard data. Check your Supabase table permissions."
        );

        return false;
    }
}

function updateStatistics() {
    $("totalStudents").textContent = formatNumber(students.length);
    $("totalClasses").textContent = formatNumber(
        classes.filter((item) => item.is_active !== false).length
    );

    $("assignedStudents").textContent = formatNumber(
        students.filter((student) => student.class_id).length
    );
}

/* =========================================================
   PAGE NAVIGATION
========================================================= */

function setPage(name) {
    activePage = name;

    $("pageTitle").textContent = name;

    $("overviewSection").classList.toggle(
        "hidden",
        name !== "Dashboard"
    );

    const showStudentPanel = [
        "Student Management",
        "Class Assignment"
    ].includes(name);

    $("studentPanel").classList.toggle(
        "hidden",
        !showStudentPanel
    );

    document.querySelectorAll(".module-content").forEach((page) => {
        page.classList.add("hidden");
    });

    document.querySelectorAll(".nav-item").forEach((button) => {
        button.classList.remove("active");
    });

    const navMap = {
        "Dashboard": "dashboardNav",
        "Student Management": "studentsNav",
        "Class Assignment": "classesNav",
        "Class Teachers": "teachersNav",
        "Subjects": "subjectsNav",
        "Subject Combinations": "combinationsNav",
        "Grading Systems": "gradingNav",
        "Exams & Results": "resultsNav",
        "Merit Lists": "meritNav",
        "Reports": "reportsNav",
        "Documents & Newsletters": "documentsNav",
        "Announcements": "announcementsNav"
    };

    const navId = navMap[name];

    if (navId) {
        $(navId)?.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   STUDENT MANAGEMENT AND CLASS ASSIGNMENT
========================================================= */

function populateClassFilter() {
    const filter = $("classFilter");

    if (!filter) return;

    const oldValue = filter.value;

    filter.innerHTML = `
        <option value="">All classes</option>
        ${optionList(classes.filter((item) => item.is_active !== false))}
    `;

    if (classes.some((item) => item.id === oldValue)) {
        filter.value = oldValue;
    }
}

function renderStudents() {
    const tbody = $("studentsTableBody");

    if (!tbody) return;

    const search = ($("searchInput")?.value || "")
        .trim()
        .toLowerCase();

    const selectedClass = $("classFilter")?.value || "";

    const filteredStudents = students.filter((student) => {
        const name = studentName(student).toLowerCase();
        const admission = String(student.admission_number || "").toLowerCase();

        const matchesSearch =
            !search ||
            name.includes(search) ||
            admission.includes(search);

        const matchesClass =
            !selectedClass ||
            student.class_id === selectedClass;

        return matchesSearch && matchesClass;
    });

    if (!filteredStudents.length) {
        tbody.innerHTML = emptyRow(5, "No matching students found.");
        return;
    }

    tbody.innerHTML = filteredStudents.map((student) => `
        <tr>
            <td>${escapeHTML(studentName(student))}</td>
            <td>${escapeHTML(student.admission_number || "—")}</td>
            <td>${escapeHTML(student.registration_status || "—")}</td>
            <td>
                <select id="class-${escapeHTML(student.id)}">
                    <option value="">Unassigned</option>
                    ${optionList(classes, student.class_id || "")}
                </select>
            </td>
            <td>
                <button
                    class="button small"
                    data-assign-student="${escapeHTML(student.id)}"
                >
                    Save
                </button>
            </td>
        </tr>
    `).join("");

    tbody.querySelectorAll("[data-assign-student]").forEach((button) => {
        button.addEventListener("click", async () => {
            const studentId = button.dataset.assignStudent;
            const select = $(`class-${studentId}`);

            await saveStudentClass(
                studentId,
                select?.value || null,
                button
            );
        });
    });
}

async function saveStudentClass(studentId, classId, button) {
    setButtonLoading(button, true, "Saving...");

    try {
        const student = students.find((item) => item.id === studentId);

        if (!student) {
            throw new Error("Student not found.");
        }

        const oldClassId = student.class_id || null;

        if (oldClassId === classId) {
            showMessage("No class change was made.", "success");
            return;
        }

        /*
         * Update the current student assignment.
         * RLS must allow this administrator to update students.class_id.
         */
        const { error: updateError } = await supabase
            .from("students")
            .update({ class_id: classId })
            .eq("id", studentId);

        if (updateError) throw updateError;

        /*
         * Record assignment history when a class is selected.
         * This history insert may require an appropriate RLS policy.
         */
        if (classId) {
            const { error: historyError } = await supabase
                .from("student_class_assignments")
                .insert({
                    student_id: studentId,
                    class_id: classId,
                    assigned_at: new Date().toISOString(),
                    ended_at: null
                });

            if (historyError) {
                showMessage(
                    "The student's class was updated, but assignment history could not be saved: " +
                    historyError.message,
                    "error"
                );

                await loadBaseData();
                return;
            }
        }

        showMessage("Student class updated.", "success");

        await loadBaseData();
    } catch (error) {
        showError(error, "Could not update the student's class.");
    } finally {
        setButtonLoading(button, false);
    }
}

/* =========================================================
   SUBJECTS — VIEW SUBJECTS CREATED BY SUPER ADMIN
========================================================= */

async function renderSubjectsPage() {
    setPage("Subjects");

    const page = createModulePage(
        "page-Subjects",
        "Subjects",
        `
            <div class="section-heading">
                <h2>Available Subjects</h2>
                <button id="refreshSubjects" class="button secondary">
                    Refresh
                </button>
            </div>

            <p class="muted">
                Subjects configured in Grade Hub are listed below.
            </p>

            <div class="toolbar">
                <input id="subjectSearch" type="search" placeholder="Search subjects">
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Subject Name</th>
                            <th>Subject Code</th>
                            <th>Description</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="subjectsTableBody">
                        ${emptyRow(4, "Loading subjects...")}
                    </tbody>
                </table>
            </div>
        `
    );

    const tbody = page.querySelector("#subjectsTableBody");

    async function loadSubjects() {
        tbody.innerHTML = emptyRow(4, "Loading subjects...");

        try {
            const { data, error } = await supabase
                .from("subjects")
                .select("id, name, subject_code, description, is_active")
                .order("name");

            if (error) throw error;

            subjects = data || [];

            const search = (
                page.querySelector("#subjectSearch").value || ""
            ).trim().toLowerCase();

            const filtered = subjects.filter((subject) => {
                return [
                    subject.name,
                    subject.subject_code,
                    subject.description
                ].some((value) =>
                    String(value || "").toLowerCase().includes(search)
                );
            });

            if (!filtered.length) {
                tbody.innerHTML = emptyRow(
                    4,
                    "No subjects found. They may not have been created yet, or your account may not have permission to view them."
                );
                return;
            }

            tbody.innerHTML = filtered.map((subject) => `
                <tr>
                    <td>${escapeHTML(subject.name)}</td>
                    <td>${escapeHTML(subject.subject_code || "—")}</td>
                    <td>${escapeHTML(subject.description || "—")}</td>
                    <td>${subject.is_active ? "Active" : "Inactive"}</td>
                </tr>
            `).join("");
        } catch (error) {
            tbody.innerHTML = emptyRow(
                4,
                "Could not load subjects: " + (error.message || "Unknown error")
            );

            console.error(error);
        }
    }

    page.querySelector("#subjectSearch").addEventListener("input", () => {
        const searchEvent = new Event("subjects-search");
        page.dispatchEvent(searchEvent);
    });

    page.addEventListener("subjects-search", () => {
        const search = page.querySelector("#subjectSearch").value
            .trim()
            .toLowerCase();

        const filtered = subjects.filter((subject) =>
            [
                subject.name,
                subject.subject_code,
                subject.description
            ].some((value) =>
                String(value || "").toLowerCase().includes(search)
            )
        );

        tbody.innerHTML = filtered.length
            ? filtered.map((subject) => `
                <tr>
                    <td>${escapeHTML(subject.name)}</td>
                    <td>${escapeHTML(subject.subject_code || "—")}</td>
                    <td>${escapeHTML(subject.description || "—")}</td>
                    <td>${subject.is_active ? "Active" : "Inactive"}</td>
                </tr>
            `).join("")
            : emptyRow(4, "No matching subjects found.");
    });

    page.querySelector("#refreshSubjects").addEventListener(
        "click",
        loadSubjects
    );

    await loadSubjects();
}

/* =========================================================
   CLASS TEACHERS
========================================================= */

async function renderTeacherPage() {
    setPage("Class Teachers");

    const page = createModulePage(
        "page-ClassTeachers",
        "Class Teachers",
        `
            <div class="form-panel">
                <h2>Assign a Class Teacher</h2>

                <form id="teacherAssignmentForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="teacherClass">Class</label>
                            <select id="teacherClass" required>
                                <option value="">Choose class</option>
                                ${optionList(classes.filter((item) => item.is_active !== false))}
                            </select>
                        </div>

                        <div class="field">
                            <label for="teacherProfile">Teacher</label>
                            <select id="teacherProfile" required>
                                <option value="">Choose teacher</option>
                                ${optionList(
                                    profiles
                                        .filter((profile) =>
                                            profile.role === "class_teacher" &&
                                            profile.is_active
                                        )
                                        .map((profile) => ({
                                            id: profile.id,
                                            name: profile.full_name || profile.id
                                        }))
                                )}
                            </select>
                        </div>
                    </div>

                    <button class="button" type="submit">
                        Assign Teacher
                    </button>
                </form>
            </div>

            <h2>Current and Previous Assignments</h2>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Class</th>
                            <th>Teacher</th>
                            <th>Assigned At</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="teacherAssignmentsBody">
                        ${emptyRow(5, "Loading assignments...")}
                    </tbody>
                </table>
            </div>
        `
    );

    page.querySelector("#teacherAssignmentForm")
        .addEventListener("submit", async (event) => {
            event.preventDefault();

            const classId = page.querySelector("#teacherClass").value;
            const teacherId = page.querySelector("#teacherProfile").value;

            if (!classId || !teacherId) return;

            try {
                const { error: endError } = await supabase
                    .from("class_teacher_assignments")
                    .update({ ended_at: new Date().toISOString() })
                    .eq("class_id", classId)
                    .is("ended_at", null);

                if (endError) throw endError;

                const { error: insertError } = await supabase
                    .from("class_teacher_assignments")
                    .insert({
                        class_id: classId,
                        teacher_id: teacherId,
                        assigned_at: new Date().toISOString(),
                        ended_at: null
                    });

                if (insertError) throw insertError;

                showMessage("Class teacher assigned.", "success");

                await loadTeacherAssignments(page);
            } catch (error) {
                showError(error, "Could not assign the class teacher.");
            }
        });

    await loadTeacherAssignments(page);
}

async function loadTeacherAssignments(page) {
    const tbody = page.querySelector("#teacherAssignmentsBody");

    tbody.innerHTML = emptyRow(5, "Loading assignments...");

    try {
        const { data, error } = await supabase
            .from("class_teacher_assignments")
            .select("id, class_id, teacher_id, assigned_at, ended_at")
            .order("assigned_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            tbody.innerHTML = emptyRow(5, "No teacher assignments found.");
            return;
        }

        tbody.innerHTML = data.map((assignment) => `
            <tr>
                <td>${escapeHTML(className(assignment.class_id))}</td>
                <td>${escapeHTML(profileName(assignment.teacher_id))}</td>
                <td>${escapeHTML(formatDate(assignment.assigned_at))}</td>
                <td>${assignment.ended_at ? "Ended" : "Active"}</td>
                <td>
                    ${
                        assignment.ended_at
                            ? "—"
                            : `<button class="button danger small"
                                data-end-assignment="${escapeHTML(assignment.id)}">
                                End Assignment
                               </button>`
                    }
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll("[data-end-assignment]").forEach((button) => {
            button.addEventListener("click", async () => {
                if (!confirm("End this teacher assignment?")) return;

                try {
                    const { error: updateError } = await supabase
                        .from("class_teacher_assignments")
                        .update({ ended_at: new Date().toISOString() })
                        .eq("id", button.dataset.endAssignment);

                    if (updateError) throw updateError;

                    showMessage("Teacher assignment ended.", "success");

                    await loadTeacherAssignments(page);
                } catch (error) {
                    showError(error, "Could not end the assignment.");
                }
            });
        });
    } catch (error) {
        tbody.innerHTML = emptyRow(
            5,
            "Could not load teacher assignments: " + (error.message || "")
        );
    }
}

/* =========================================================
   SUBJECT COMBINATIONS
========================================================= */

async function renderCombinationsPage() {
    setPage("Subject Combinations");

    const page = createModulePage(
        "page-SubjectCombinations",
        "Subject Combinations",
        `
            <div class="section-heading">
                <h2>Combinations Created by Super Admin</h2>
                <button id="refreshCombinations" class="button secondary">
                    Refresh
                </button>
            </div>

            <p class="muted">
                This page displays combinations and their subjects.
            </p>

            <div id="combinationList">
                <p class="muted">Loading combinations...</p>
            </div>
        `
    );

    page.querySelector("#refreshCombinations").addEventListener(
        "click",
        () => loadCombinationList(page)
    );

    await loadCombinationList(page);
}

async function loadCombinationList(page) {
    const container = page.querySelector("#combinationList");

    container.innerHTML = "<p>Loading combinations...</p>";

    try {
        const { data: combinationData, error: combinationError } =
            await supabase
                .from("subject_combinations")
                .select("id, name, description, is_active")
                .order("name");

        if (combinationError) throw combinationError;

        combinations = combinationData || [];

        const { data: links, error: linksError } = await supabase
            .from("combination_subjects")
            .select("combination_id, subject_id");

        if (linksError) throw linksError;

        if (!combinations.length) {
            container.innerHTML = `
                <p class="empty">
                    No combinations found. Check whether Super Admin has created any.
                </p>
            `;
            return;
        }

        container.innerHTML = combinations.map((combination) => {
            const linkedSubjects = (links || [])
                .filter((link) => link.combination_id === combination.id)
                .map((link) => subjectName(link.subject_id));

            return `
                <div class="panel" style="margin-bottom:14px">
                    <div class="section-heading">
                        <h2>${escapeHTML(combination.name)}</h2>
                        <span class="muted">
                            ${combination.is_active ? "Active" : "Inactive"}
                        </span>
                    </div>

                    <p>${escapeHTML(combination.description || "No description.")}</p>

                    <strong>Subjects:</strong>

                    <p>
                        ${
                            linkedSubjects.length
                                ? linkedSubjects.map(escapeHTML).join(", ")
                                : "No subjects linked to this combination."
                        }
                    </p>
                </div>
            `;
        }).join("");
    } catch (error) {
        container.innerHTML = `
            <p class="message show error">
                Could not load combinations: ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* =========================================================
   GRADING SYSTEMS
========================================================= */

async function renderGradingPage() {
    setPage("Grading Systems");

    const page = createModulePage(
        "page-GradingSystems",
        "Grading Systems",
        `
            <div class="form-panel">
                <h2>Create Grading System</h2>

                <form id="gradingForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="gradingName">System Name</label>
                            <input id="gradingName" required>
                        </div>

                        <div class="field">
                            <label for="gradingVersion">Version</label>
                            <input id="gradingVersion" value="1" required>
                        </div>

                        <div class="field full-width">
                            <label for="gradingDescription">Description</label>
                            <textarea id="gradingDescription"></textarea>
                        </div>
                    </div>

                    <button class="button" type="submit">
                        Create System
                    </button>
                </form>
            </div>

            <div class="form-panel">
                <h2>Add Grade Band</h2>

                <form id="gradeBandForm">
                    <div class="form-grid">
                        <div class="field full-width">
                            <label for="bandSystem">Grading System</label>
                            <select id="bandSystem" required>
                                <option value="">Choose system</option>
                                ${optionList(gradingSystems)}
                            </select>
                        </div>

                        <div class="field">
                            <label for="bandName">Grade Name</label>
                            <input id="bandName" placeholder="A, B, 1, etc." required>
                        </div>

                        <div class="field">
                            <label for="bandPoints">Grade Points (optional)</label>
                            <input id="bandPoints" type="number" step="0.01">
                        </div>

                        <div class="field">
                            <label for="bandMin">Minimum Score</label>
                            <input id="bandMin" type="number" min="0" max="100" required>
                        </div>

                        <div class="field">
                            <label for="bandMax">Maximum Score</label>
                            <input id="bandMax" type="number" min="0" max="100" required>
                        </div>
                    </div>

                    <button class="button" type="submit">
                        Add Grade Band
                    </button>
                </form>
            </div>

            <h2>Existing Grading Systems</h2>

            <div id="gradingList">
                <p class="muted">Loading grading systems...</p>
            </div>
        `
    );

    page.querySelector("#gradingForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const name = page.querySelector("#gradingName").value.trim();
            const version = page.querySelector("#gradingVersion").value.trim();
            const description = page.querySelector("#gradingDescription").value.trim();

            try {
                const { error } = await supabase
                    .from("grading_systems")
                    .insert({
                        name,
                        version,
                        description: description || null,
                        is_active: false,
                        created_by: currentUser.id
                    });

                if (error) throw error;

                showMessage("Grading system created.", "success");

                await loadBaseData();
                await renderGradingPage();
            } catch (error) {
                showError(error, "Could not create grading system.");
            }
        }
    );

    page.querySelector("#gradeBandForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const systemId = page.querySelector("#bandSystem").value;
            const gradeName = page.querySelector("#bandName").value.trim();
            const min = Number(page.querySelector("#bandMin").value);
            const max = Number(page.querySelector("#bandMax").value);
            const pointsValue = page.querySelector("#bandPoints").value;

            if (!systemId) {
                showMessage("Choose a grading system.", "error");
                return;
            }

            if (min > max) {
                showMessage(
                    "Minimum score cannot be greater than maximum score.",
                    "error"
                );
                return;
            }

            const gradeBand = {
                grading_system_id: systemId,
                grade_name: gradeName,
                minimum_score: min,
                maximum_score: max,
                grade_points: pointsValue === ""
                    ? null
                    : Number(pointsValue)
            };

            try {
                const { error } = await supabase
                    .from("grade_bands")
                    .insert(gradeBand);

                if (error) throw error;

                showMessage("Grade band added.", "success");

                page.querySelector("#gradeBandForm").reset();
                await loadGradingList(page);
            } catch (error) {
                showError(error, "Could not add grade band.");
            }
        }
    );

    await loadGradingList(page);
}

async function loadGradingList(page) {
    const container = page.querySelector("#gradingList");

    container.innerHTML = "<p>Loading grading systems...</p>";

    try {
        const { data: systems, error: systemsError } = await supabase
            .from("grading_systems")
            .select("id, name, version, description, is_active")
            .order("created_at", { ascending: false });

        if (systemsError) throw systemsError;

        gradingSystems = systems || [];

        const { data: bands, error: bandsError } = await supabase
            .from("grade_bands")
            .select("id, grading_system_id, grade_name, minimum_score, maximum_score, grade_points")
            .order("minimum_score", { ascending: false });

        if (bandsError) throw bandsError;

        if (!gradingSystems.length) {
            container.innerHTML = `<p class="empty">No grading systems found.</p>`;
            return;
        }

        container.innerHTML = gradingSystems.map((system) => {
            const systemBands = (bands || []).filter(
                (band) => band.grading_system_id === system.id
            );

            return `
                <div class="panel" style="margin-bottom:15px">
                    <div class="section-heading">
                        <h2>
                            ${escapeHTML(system.name)}
                            <small class="muted">v${escapeHTML(system.version)}</small>
                        </h2>
                        <span>${system.is_active ? "Active" : "Inactive"}</span>
                    </div>

                    <p>${escapeHTML(system.description || "No description.")}</p>

                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Grade</th>
                                    <th>Minimum</th>
                                    <th>Maximum</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${
                                    systemBands.length
                                        ? systemBands.map((band) => `
                                            <tr>
                                                <td>${escapeHTML(band.grade_name)}</td>
                                                <td>${escapeHTML(band.minimum_score)}</td>
                                                <td>${escapeHTML(band.maximum_score)}</td>
                                                <td>${escapeHTML(band.grade_points ?? "—")}</td>
                                            </tr>
                                        `).join("")
                                        : emptyRow(4, "No grade bands added.")
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join("");
    } catch (error) {
        container.innerHTML = `
            <p class="message show error">
                Could not load grading systems: ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* =========================================================
   EXAMS AND RESULTS
========================================================= */

async function renderExamsPage() {
    setPage("Exams & Results");

    const page = createModulePage(
        "page-ExamsResults",
        "Exams & Results",
        `
            <div class="form-panel">
                <h2>Create Exam</h2>

                <form id="examForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="examName">Exam Name</label>
                            <input id="examName" required>
                        </div>

                        <div class="field">
                            <label for="examYear">Academic Year</label>
                            <input id="examYear" type="number" value="${new Date().getFullYear()}" required>
                        </div>

                        <div class="field">
                            <label for="examTerm">Term</label>
                            <input id="examTerm" placeholder="Term 1">
                        </div>

                        <div class="field">
                            <label for="examClass">Class (optional)</label>
                            <select id="examClass">
                                <option value="">All classes</option>
                                ${optionList(classes)}
                            </select>
                        </div>

                        <div class="field">
                            <label for="examGrading">Grading System</label>
                            <select id="examGrading" required>
                                <option value="">Choose system</option>
                                ${optionList(gradingSystems)}
                            </select>
                        </div>

                        <div class="field">
                            <label for="examStatus">Status</label>
                            <select id="examStatus">
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div class="field">
                            <label for="examStart">Start Date</label>
                            <input id="examStart" type="date">
                        </div>

                        <div class="field">
                            <label for="examEnd">End Date</label>
                            <input id="examEnd" type="date">
                        </div>
                    </div>

                    <button class="button" type="submit">Create Exam</button>
                </form>
            </div>

            <div class="form-panel">
                <h2>Enter Student Results</h2>

                <form id="resultForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="resultExam">Exam</label>
                            <select id="resultExam" required>
                                <option value="">Choose exam</option>
                                ${optionList(exams)}
                            </select>
                        </div>

                        <div class="field">
                            <label for="resultStudent">Student</label>
                            <select id="resultStudent" required>
                                <option value="">Choose student</option>
                                ${optionList(
                                    students.map((student) => ({
                                        id: student.id,
                                        name: `${studentName(student)}${student.admission_number ? " — " + student.admission_number : ""}`
                                    }))
                                )}
                            </select>
                        </div>

                        <div class="field">
                            <label for="resultSubject">Subject</label>
                            <select id="resultSubject" required>
                                <option value="">Choose subject</option>
                                ${optionList(subjects.filter((subject) => subject.is_active !== false))}
                            </select>
                        </div>

                        <div class="field">
                            <label for="resultMarks">Marks Obtained</label>
                            <input id="resultMarks" type="number" min="0" step="0.01" required>
                        </div>

                        <div class="field">
                            <label for="resultTotalMarks">Total Marks</label>
                            <input id="resultTotalMarks" type="number" min="0.01" step="0.01" value="100" required>
                        </div>

                        <div class="field full-width">
                            <label for="resultRemarks">Remarks (optional)</label>
                            <textarea id="resultRemarks"></textarea>
                        </div>
                    </div>

                    <button class="button" type="submit">Save Result</button>
                </form>
            </div>

            <h2>Existing Exams</h2>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Exam</th>
                            <th>Year</th>
                            <th>Term</th>
                            <th>Class</th>
                            <th>Status</th>
                            <th>Start Date</th>
                        </tr>
                    </thead>
                    <tbody id="examsTableBody">
                        ${emptyRow(6, "Loading exams...")}
                    </tbody>
                </table>
            </div>
        `
    );

    page.querySelector("#examForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const name = page.querySelector("#examName").value.trim();
            const academicYear = Number(page.querySelector("#examYear").value);
            const term = page.querySelector("#examTerm").value.trim();
            const classId = page.querySelector("#examClass").value || null;
            const gradingSystemId = page.querySelector("#examGrading").value;
            const status = page.querySelector("#examStatus").value;
            const startsOn = page.querySelector("#examStart").value || null;
            const endsOn = page.querySelector("#examEnd").value || null;

            if (!gradingSystemId) {
                showMessage("Choose a grading system.", "error");
                return;
            }

            if (startsOn && endsOn && startsOn > endsOn) {
                showMessage("End date cannot be earlier than start date.", "error");
                return;
            }

            try {
                const { error } = await supabase
                    .from("exams")
                    .insert({
                        name,
                        academic_year: academicYear,
                        term: term || null,
                        class_id: classId,
                        grading_system_id: gradingSystemId,
                        status,
                        starts_on: startsOn,
                        ends_on: endsOn,
                        created_by: currentUser.id
                    });

                if (error) throw error;

                showMessage("Exam created.", "success");

                await loadBaseData();
                await renderExamsPage();
            } catch (error) {
                showError(error, "Could not create exam.");
            }
        }
    );

    page.querySelector("#resultForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const examId = page.querySelector("#resultExam").value;
            const studentId = page.querySelector("#resultStudent").value;
            const subjectId = page.querySelector("#resultSubject").value;
            const marks = Number(page.querySelector("#resultMarks").value);
            const totalMarks = Number(page.querySelector("#resultTotalMarks").value);
            const remarks = page.querySelector("#resultRemarks").value.trim();

            if (!examId || !studentId || !subjectId) {
                showMessage("Choose an exam, student, and subject.", "error");
                return;
            }

            if (
                !Number.isFinite(marks) ||
                !Number.isFinite(totalMarks) ||
                totalMarks <= 0 ||
                marks < 0 ||
                marks > totalMarks
            ) {
                showMessage(
                    "Marks must be between zero and the total marks.",
                    "error"
                );
                return;
            }

            try {
                /*
                 * Do not use upsert here. It requires a unique constraint
                 * on exam_id + student_id + subject_id.
                 *
                 * Instead, find the existing result and update it,
                 * or insert a new row.
                 */
                const { data: existing, error: findError } = await supabase
                    .from("exam_results")
                    .select("id")
                    .eq("exam_id", examId)
                    .eq("student_id", studentId)
                    .eq("subject_id", subjectId)
                    .limit(1);

                if (findError) throw findError;

                const payload = {
                    exam_id: examId,
                    student_id: studentId,
                    subject_id: subjectId,
                    marks,
                    total_marks: totalMarks,
                    remarks: remarks || null,
                    entered_by: currentUser.id,
                    updated_at: new Date().toISOString()
                };

                if (existing?.length) {
                    const { error: updateError } = await supabase
                        .from("exam_results")
                        .update(payload)
                        .eq("id", existing[0].id);

                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from("exam_results")
                        .insert(payload);

                    if (insertError) throw insertError;
                }

                showMessage("Result saved.", "success");

                page.querySelector("#resultForm").reset();
                page.querySelector("#resultTotalMarks").value = "100";
            } catch (error) {
                showError(
                    error,
                    "Could not save result. Check the exam_results columns and RLS policies."
                );
            }
        }
    );

    await loadExamsList(page);
}

async function loadExamsList(page) {
    const tbody = page.querySelector("#examsTableBody");

    try {
        const { data, error } = await supabase
            .from("exams")
            .select("id, name, academic_year, term, class_id, status, starts_on")
            .order("created_at", { ascending: false });

        if (error) throw error;

        exams = data || [];

        if (!exams.length) {
            tbody.innerHTML = emptyRow(6, "No exams created yet.");
            return;
        }

        tbody.innerHTML = exams.map((exam) => `
            <tr>
                <td>${escapeHTML(exam.name)}</td>
                <td>${escapeHTML(exam.academic_year)}</td>
                <td>${escapeHTML(exam.term || "—")}</td>
                <td>${escapeHTML(exam.class_id ? className(exam.class_id) : "All classes")}</td>
                <td>${escapeHTML(exam.status || "—")}</td>
                <td>${escapeHTML(formatDate(exam.starts_on))}</td>
            </tr>
        `).join("");
    } catch (error) {
        tbody.innerHTML = emptyRow(
            6,
            "Could not load exams: " + (error.message || "")
        );
    }
}

/* =========================================================
   MERIT LISTS
========================================================= */

async function renderMeritPage() {
    setPage("Merit Lists");

    const page = createModulePage(
        "page-MeritLists",
        "Merit Lists",
        `
            <h2>Generate Merit List</h2>

            <div class="toolbar">
                <select id="meritExam">
                    <option value="">Choose exam</option>
                    ${optionList(exams)}
                </select>

                <select id="meritClass">
                    <option value="">All classes</option>
                    ${optionList(classes)}
                </select>
            </div>

            <button id="generateMerit" class="button">
                Generate Merit List
            </button>

            <div id="meritOutput" style="margin-top:20px"></div>
        `
    );

    page.querySelector("#generateMerit").addEventListener(
        "click",
        () => generateMeritList(page)
    );
}

async function generateMeritList(page) {
    const examId = page.querySelector("#meritExam").value;
    const classId = page.querySelector("#meritClass").value;
    const output = page.querySelector("#meritOutput");

    if (!examId) {
        showMessage("Choose an exam first.", "error");
        return;
    }

    output.innerHTML = "<p>Generating merit list...</p>";

    try {
        let query = supabase
            .from("exam_results")
            .select("id, exam_id, student_id, subject_id, marks, total_marks, percentage")
            .eq("exam_id", examId);

        const { data, error } = await query;

        if (error) throw error;

        let resultRows = data || [];

        if (!resultRows.length) {
            output.innerHTML = `<p class="empty">No results found for this exam.</p>`;
            return;
        }

        const studentIds = [...new Set(resultRows.map((row) => row.student_id))];

        let studentQuery = supabase
            .from("students")
            .select("id, profile_id, admission_number, class_id")
            .in("id", studentIds);

        if (classId) {
            studentQuery = studentQuery.eq("class_id", classId);
        }

        const { data: studentData, error: studentError } = await studentQuery;

        if (studentError) throw studentError;

        const eligibleStudents = studentData || [];
        const eligibleIds = new Set(eligibleStudents.map((student) => student.id));

        resultRows = resultRows.filter((row) =>
            eligibleIds.has(row.student_id)
        );

        const totals = new Map();

        for (const row of resultRows) {
            const totalMarks = Number(row.total_marks ?? 100);
            const marks = Number(row.marks ?? 0);

            const percentage = totalMarks > 0
                ? (marks / totalMarks) * 100
                : 0;

            const existing = totals.get(row.student_id) || {
                studentId: row.student_id,
                marks: 0,
                possibleMarks: 0,
                subjects: 0
            };

            existing.marks += marks;
            existing.possibleMarks += totalMarks;
            existing.subjects += 1;

            totals.set(row.student_id, existing);
        }

        const rankings = [...totals.values()]
            .map((item) => {
                const student = eligibleStudents.find(
                    (entry) => entry.id === item.studentId
                );

                const percentage = item.possibleMarks > 0
                    ? (item.marks / item.possibleMarks) * 100
                    : 0;

                return {
                    ...item,
                    student,
                    percentage
                };
            })
            .sort((a, b) => b.percentage - a.percentage);

        if (!rankings.length) {
            output.innerHTML = `
                <p class="empty">
                    No results were found for students in the selected class.
                </p>
            `;
            return;
        }

        output.innerHTML = `
            <div class="section-heading">
                <h2>Merit List</h2>
                <button id="exportMerit" class="button secondary">
                    Export CSV
                </button>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Student</th>
                            <th>Admission Number</th>
                            <th>Class</th>
                            <th>Subjects</th>
                            <th>Total Marks</th>
                            <th>Average %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rankings.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${escapeHTML(studentName(item.student))}</td>
                                <td>${escapeHTML(item.student?.admission_number || "—")}</td>
                                <td>${escapeHTML(className(item.student?.class_id))}</td>
                                <td>${item.subjects}</td>
                                <td>${item.marks.toFixed(2)} / ${item.possibleMarks.toFixed(2)}</td>
                                <td>${item.percentage.toFixed(2)}%</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;

        page.querySelector("#exportMerit").addEventListener("click", () => {
            exportCSV(
                "grade-hub-merit-list.csv",
                [
                    ["Rank", "Student", "Admission Number", "Class", "Subjects", "Marks", "Possible Marks", "Percentage"],
                    ...rankings.map((item, index) => [
                        index + 1,
                        studentName(item.student),
                        item.student?.admission_number || "",
                        className(item.student?.class_id),
                        item.subjects,
                        item.marks.toFixed(2),
                        item.possibleMarks.toFixed(2),
                        item.percentage.toFixed(2)
                    ])
                ]
            );
        });
    } catch (error) {
        output.innerHTML = `
            <p class="message show error">
                Could not generate merit list: ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* =========================================================
   REPORTS
========================================================= */

async function renderReportsPage() {
    setPage("Reports");

    const page = createModulePage(
        "page-Reports",
        "Reports",
        `
            <h2>Exam Results Report</h2>

            <p class="muted">
                View and export results for an exam. Results are shown only
                if your account has permission to read them.
            </p>

            <div class="toolbar">
                <select id="reportExam">
                    <option value="">Choose exam</option>
                    ${optionList(exams)}
                </select>

                <select id="reportClass">
                    <option value="">All classes</option>
                    ${optionList(classes)}
                </select>
            </div>

            <div class="toolbar">
                <button id="loadReport" class="button">
                    Load Report
                </button>

                <button id="exportReport" class="button secondary" disabled>
                    Export CSV
                </button>
            </div>

            <div id="reportSummary"></div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Admission Number</th>
                            <th>Class</th>
                            <th>Subject</th>
                            <th>Marks</th>
                            <th>Total Marks</th>
                            <th>Percentage</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody id="reportTableBody">
                        ${emptyRow(8, "Choose an exam and load the report.")}
                    </tbody>
                </table>
            </div>
        `
    );

    let reportCSVRows = [];

    page.querySelector("#loadReport").addEventListener("click", async () => {
        const examId = page.querySelector("#reportExam").value;
        const classId = page.querySelector("#reportClass").value;

        if (!examId) {
            showMessage("Choose an exam first.", "error");
            return;
        }

        const tbody = page.querySelector("#reportTableBody");
        const summary = page.querySelector("#reportSummary");
        const exportButton = page.querySelector("#exportReport");

        tbody.innerHTML = emptyRow(8, "Loading report...");
        summary.innerHTML = "";
        exportButton.disabled = true;
        reportCSVRows = [];

        try {
            const { data: results, error: resultsError } = await supabase
                .from("exam_results")
                .select("id, exam_id, student_id, subject_id, marks, total_marks, percentage, remarks")
                .eq("exam_id", examId);

            if (resultsError) throw resultsError;

            if (!results?.length) {
                tbody.innerHTML = emptyRow(8, "No results found for this exam.");
                return;
            }

            const studentIds = [...new Set(results.map((row) => row.student_id))];

            const { data: studentData, error: studentError } = await supabase
                .from("students")
                .select("id, profile_id, admission_number, class_id")
                .in("id", studentIds);

            if (studentError) throw studentError;

            const studentMap = new Map(
                (studentData || []).map((student) => [student.id, student])
            );

            let filteredResults = results.filter((result) => {
                const student = studentMap.get(result.student_id);

                return student && (
                    !classId || student.class_id === classId
                );
            });

            filteredResults.sort((a, b) => {
                const studentA = studentMap.get(a.student_id);
                const studentB = studentMap.get(b.student_id);

                return studentName(studentA).localeCompare(studentName(studentB));
            });

            const summaryStats = {
                count: filteredResults.length,
                marks: 0,
                total: 0
            };

            reportCSVRows = [
                [
                    "Student",
                    "Admission Number",
                    "Class",
                    "Subject",
                    "Marks",
                    "Total Marks",
                    "Percentage",
                    "Remarks"
                ]
            ];

            for (const result of filteredResults) {
                const student = studentMap.get(result.student_id);
                const marks = Number(result.marks ?? 0);
                const total = Number(result.total_marks ?? 100);

                const percentage = total > 0
                    ? (marks / total) * 100
                    : 0;

                summaryStats.marks += marks;
                summaryStats.total += total;

                reportCSVRows.push([
                    studentName(student),
                    student?.admission_number || "",
                    className(student?.class_id),
                    subjectName(result.subject_id),
                    marks,
                    total,
                    percentage.toFixed(2),
                    result.remarks || ""
                ]);
            }

            if (!filteredResults.length) {
                tbody.innerHTML = emptyRow(
                    8,
                    "No results match the selected class."
                );
                return;
            }

            tbody.innerHTML = filteredResults.map((result) => {
                const student = studentMap.get(result.student_id);
                const marks = Number(result.marks ?? 0);
                const total = Number(result.total_marks ?? 100);
                const percentage = total > 0 ? marks / total * 100 : 0;

                return `
                    <tr>
                        <td>${escapeHTML(studentName(student))}</td>
                        <td>${escapeHTML(student?.admission_number || "—")}</td>
                        <td>${escapeHTML(className(student?.class_id))}</td>
                        <td>${escapeHTML(subjectName(result.subject_id))}</td>
                        <td>${marks.toFixed(2)}</td>
                        <td>${total.toFixed(2)}</td>
                        <td>${percentage.toFixed(2)}%</td>
                        <td>${escapeHTML(result.remarks || "—")}</td>
                    </tr>
                `;
            }).join("");

            const overallPercentage = summaryStats.total > 0
                ? summaryStats.marks / summaryStats.total * 100
                : 0;

            summary.innerHTML = `
                <div class="stats">
                    <div class="stat-card">
                        <p>Result Records</p>
                        <h2>${summaryStats.count}</h2>
                    </div>
                    <div class="stat-card">
                        <p>Marks Obtained</p>
                        <h2>${summaryStats.marks.toFixed(2)}</h2>
                    </div>
                    <div class="stat-card">
                        <p>Overall Percentage</p>
                        <h2>${overallPercentage.toFixed(2)}%</h2>
                    </div>
                </div>
            `;

            exportButton.disabled = false;
        } catch (error) {
            tbody.innerHTML = emptyRow(
                8,
                "Could not load report: " + (error.message || "Unknown error")
            );

            console.error(error);
        }
    });

    page.querySelector("#exportReport").addEventListener("click", () => {
        if (reportCSVRows.length < 2) {
            showMessage("Load a report before exporting.", "error");
            return;
        }

        exportCSV("grade-hub-results-report.csv", reportCSVRows);
    });
}

function exportCSV(filename, rows) {
    const csv = rows.map((row) => row.map((value) => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

/* =========================================================
   DOCUMENTS AND NEWSLETTERS
========================================================= */

async function renderDocumentsPage() {
    setPage("Documents & Newsletters");

    const page = createModulePage(
        "page-DocumentsNewsletters",
        "Documents & Newsletters",
        `
            <div class="form-panel">
                <h2>Upload a Document</h2>

                <form id="documentForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="documentTitle">Title</label>
                            <input id="documentTitle" required>
                        </div>

                        <div class="field">
                            <label for="documentType">Document Type</label>
                            <select id="documentType">
                                <option value="newsletter">Newsletter</option>
                                <option value="document">Document</option>
                                <option value="notice">Notice</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div class="field full-width">
                            <label for="documentDescription">Description</label>
                            <textarea id="documentDescription"></textarea>
                        </div>

                        <div class="field full-width">
                            <label for="documentFile">File</label>
                            <input id="documentFile" type="file" required>
                        </div>

                        <div class="field">
                            <label>
                                <input id="documentPublished" type="checkbox" style="width:auto">
                                Publish document
                            </label>
                        </div>
                    </div>

                    <button class="button" type="submit">Upload Document</button>
                </form>

                <p class="muted">
                    The Supabase Storage bucket must be named
                    <strong>grade-hub-documents</strong>, and Storage policies
                    must allow the permitted uploads and reads.
                </p>
            </div>

            <h2>Uploaded Documents</h2>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Published</th>
                            <th>Date</th>
                            <th>File</th>
                        </tr>
                    </thead>
                    <tbody id="documentsTableBody">
                        ${emptyRow(6, "Loading documents...")}
                    </tbody>
                </table>
            </div>
        `
    );

    page.querySelector("#documentForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const title = page.querySelector("#documentTitle").value.trim();
            const type = page.querySelector("#documentType").value;
            const description = page.querySelector("#documentDescription").value.trim();
            const file = page.querySelector("#documentFile").files[0];
            const published = page.querySelector("#documentPublished").checked;

            if (!file) {
                showMessage("Choose a file to upload.", "error");
                return;
            }

            try {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `${currentUser.id}/${Date.now()}-${safeName}`;

                const { error: uploadError } = await supabase.storage
                    .from("grade-hub-documents")
                    .upload(path, file, { upsert: false });

                if (uploadError) throw uploadError;

                const { error: insertError } = await supabase
                    .from("documents")
                    .insert({
                        title,
                        description: description || null,
                        storage_path: path,
                        document_type: type,
                        is_published: published,
                        uploaded_by: currentUser.id
                    });

                if (insertError) {
                    /*
                     * Try to remove the uploaded object if the database insert fails.
                     */
                    await supabase.storage
                        .from("grade-hub-documents")
                        .remove([path]);

                    throw insertError;
                }

                showMessage("Document uploaded.", "success");

                page.querySelector("#documentForm").reset();

                await loadDocuments(page);
            } catch (error) {
                showError(error, "Could not upload document.");
            }
        }
    );

    await loadDocuments(page);
}

async function loadDocuments(page) {
    const tbody = page.querySelector("#documentsTableBody");

    tbody.innerHTML = emptyRow(6, "Loading documents...");

    try {
        const { data, error } = await supabase
            .from("documents")
            .select("id, title, description, storage_path, document_type, is_published, created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            tbody.innerHTML = emptyRow(6, "No documents found.");
            return;
        }

        tbody.innerHTML = data.map((document) => `
            <tr>
                <td>${escapeHTML(document.title)}</td>
                <td>${escapeHTML(document.document_type || "—")}</td>
                <td>${escapeHTML(document.description || "—")}</td>
                <td>${document.is_published ? "Yes" : "No"}</td>
                <td>${escapeHTML(formatDate(document.created_at))}</td>
                <td>
                    <button class="button small" data-open-document="${escapeHTML(document.id)}">
                        Open
                    </button>
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll("[data-open-document]").forEach((button) => {
            button.addEventListener("click", async () => {
                const document = data.find(
                    (item) => item.id === button.dataset.openDocument
                );

                if (!document) return;

                try {
                    const { data: signed, error: signedError } = await supabase.storage
                        .from("grade-hub-documents")
                        .createSignedUrl(document.storage_path, 60);

                    if (signedError) throw signedError;

                    window.open(signed.signedUrl, "_blank", "noopener");
                } catch (error) {
                    showError(error, "Could not open the document.");
                }
            });
        });
    } catch (error) {
        tbody.innerHTML = emptyRow(
            6,
            "Could not load documents: " + (error.message || "")
        );
    }
}

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

async function renderAnnouncementsPage() {
    setPage("Announcements");

    const page = createModulePage(
        "page-Announcements",
        "Announcements",
        `
            <div class="form-panel">
                <h2>Create Announcement</h2>

                <form id="announcementForm">
                    <div class="form-grid">
                        <div class="field">
                            <label for="announcementTitle">Title</label>
                            <input id="announcementTitle" required>
                        </div>

                        <div class="field">
                            <label for="announcementAudience">Audience</label>
                            <select id="announcementAudience">
                                <option value="all">Everyone</option>
                                <option value="students">Students</option>
                                <option value="teachers">Teachers</option>
                                <option value="parents">Parents</option>
                            </select>
                        </div>

                        <div class="field full-width">
                            <label for="announcementContent">Content</label>
                            <textarea id="announcementContent" required></textarea>
                        </div>

                        <div class="field">
                            <label>
                                <input id="announcementPublished" type="checkbox" style="width:auto">
                                Publish immediately
                            </label>
                        </div>
                    </div>

                    <button class="button" type="submit">Save Announcement</button>
                </form>
            </div>

            <h2>Saved Announcements</h2>

            <div id="announcementsList">
                <p class="muted">Loading announcements...</p>
            </div>
        `
    );

    page.querySelector("#announcementForm").addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const title = page.querySelector("#announcementTitle").value.trim();
            const content = page.querySelector("#announcementContent").value.trim();
            const audience = page.querySelector("#announcementAudience").value;
            const published = page.querySelector("#announcementPublished").checked;

            try {
                const { error } = await supabase
                    .from("announcements")
                    .insert({
                        title,
                        content,
                        audience,
                        is_published: published,
                        published_at: published ? new Date().toISOString() : null,
                        created_by: currentUser.id
                    });

                if (error) throw error;

                showMessage("Announcement saved.", "success");

                page.querySelector("#announcementForm").reset();

                await loadAnnouncements(page);
            } catch (error) {
                showError(error, "Could not save announcement.");
            }
        }
    );

    await loadAnnouncements(page);
}

async function loadAnnouncements(page) {
    const container = page.querySelector("#announcementsList");

    container.innerHTML = "<p>Loading announcements...</p>";

    try {
        const { data, error } = await supabase
            .from("announcements")
            .select("id, title, content, audience, is_published, published_at, created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = `<p class="empty">No announcements found.</p>`;
            return;
        }

        container.innerHTML = data.map((announcement) => `
            <div class="panel" style="margin-bottom:14px">
                <div class="section-heading">
                    <h2>${escapeHTML(announcement.title)}</h2>
                    <span>${announcement.is_published ? "Published" : "Draft"}</span>
                </div>

                <p>${escapeHTML(announcement.content).replace(/\n/g, "<br>")}</p>

                <p class="muted">
                    Audience: ${escapeHTML(announcement.audience || "all")}
                    · Created: ${escapeHTML(formatDate(announcement.created_at))}
                </p>

                <button
                    class="button small secondary"
                    data-toggle-announcement="${escapeHTML(announcement.id)}"
                    data-published="${announcement.is_published}"
                >
                    ${announcement.is_published ? "Unpublish" : "Publish"}
                </button>
            </div>
        `).join("");

        container.querySelectorAll("[data-toggle-announcement]").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.dataset.toggleAnnouncement;
                const currentlyPublished = button.dataset.published === "true";
                const nextPublished = !currentlyPublished;

                try {
                    const { error: updateError } = await supabase
                        .from("announcements")
                        .update({
                            is_published: nextPublished,
                            published_at: nextPublished
                                ? new Date().toISOString()
                                : null
                        })
                        .eq("id", id);

                    if (updateError) throw updateError;

                    showMessage(
                        nextPublished ? "Announcement published." : "Announcement unpublished.",
                        "success"
                    );

                    await loadAnnouncements(page);
                } catch (error) {
                    showError(error, "Could not update announcement.");
                }
            });
        });
    } catch (error) {
        container.innerHTML = `
            <p class="message show error">
                Could not load announcements: ${escapeHTML(error.message)}
            </p>
        `;
    }
}

/* =========================================================
   NAVIGATION EVENT HANDLERS
========================================================= */

function wireNavigation() {
    $("dashboardNav").addEventListener("click", () => {
        setPage("Dashboard");
    });

    $("studentsNav").addEventListener("click", () => {
        setPage("Student Management");
    });

    $("classesNav").addEventListener("click", () => {
        setPage("Class Assignment");
    });

    $("teachersNav").addEventListener("click", renderTeacherPage);
    $("subjectsNav").addEventListener("click", renderSubjectsPage);
    $("combinationsNav").addEventListener("click", renderCombinationsPage);
    $("gradingNav").addEventListener("click", renderGradingPage);
    $("resultsNav").addEventListener("click", renderExamsPage);
    $("meritNav").addEventListener("click", renderMeritPage);
    $("reportsNav").addEventListener("click", renderReportsPage);
    $("documentsNav").addEventListener("click", renderDocumentsPage);
    $("announcementsNav").addEventListener("click", renderAnnouncementsPage);

    $("searchInput").addEventListener("input", renderStudents);
    $("classFilter").addEventListener("change", renderStudents);

    $("refreshButton").addEventListener("click", async () => {
        const success = await loadBaseData();

        if (!success) return;

        /*
         * Refresh the current module after the base data is reloaded.
         */
        switch (activePage) {
            case "Subjects":
                await renderSubjectsPage();
                break;

            case "Class Teachers":
                await renderTeacherPage();
                break;

            case "Subject Combinations":
                await renderCombinationsPage();
                break;

            case "Grading Systems":
                await renderGradingPage();
                break;

            case "Exams & Results":
                await renderExamsPage();
                break;

            case "Merit Lists":
                await renderMeritPage();
                break;

            case "Reports":
                await renderReportsPage();
                break;

            case "Documents & Newsletters":
                await renderDocumentsPage();
                break;

            case "Announcements":
                await renderAnnouncementsPage();
                break;

            default:
                setPage(activePage);
        }
    });

    $("signOutButton").addEventListener("click", async () => {
        try {
            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            redirectToLogin();
        } catch (error) {
            showError(error, "Could not sign out.");
        }
    });

    $("returnButton").addEventListener("click", redirectToLogin);
}

/* =========================================================
   START APPLICATION
========================================================= */

async function init() {
    wireNavigation();

    const allowed = await checkAccount();

    if (!allowed) return;

    const loaded = await loadBaseData();

    if (loaded) {
        setPage("Dashboard");
    }
}

init();
