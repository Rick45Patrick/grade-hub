import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;

let students = [];
let classes = [];
let profiles = [];
let subjects = [];
let combinations = [];
let gradingSystems = [];
let exams = [];

let activePage = "Dashboard";

const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

function showMessage(message, type = "info") {
    const box = $("message");
    if (!box) return;

    box.textContent = message;
    box.className = `status ${type}`;
}

function option(value, label, selected = false) {
    return `<option value="${escapeHTML(value)}" ${selected ? "selected" : ""}>
        ${escapeHTML(label)}
    </option>`;
}

function makeSelect(id, label, items, valueKey = "id", labelKey = "name") {
    return `
        <label>
            ${escapeHTML(label)}
            <select id="${escapeHTML(id)}" required>
                <option value="">Choose ${escapeHTML(label.toLowerCase())}</option>
                ${items.map(item => option(item[valueKey], item[labelKey])).join("")}
            </select>
        </label>
    `;
}

function button(text, id, className = "button") {
    return `<button type="button" id="${id}" class="${className}">
        ${escapeHTML(text)}
    </button>`;
}

function panel(title, content, id = "") {
    return `
        <section class="panel module-panel" ${id ? `id="${id}"` : ""}>
            <div class="panel-heading">
                <h2>${escapeHTML(title)}</h2>
            </div>
            ${content}
        </section>
    `;
}

function inputField(id, label, type = "text", required = true, extra = "") {
    return `
        <label>
            ${escapeHTML(label)}
            <input
                id="${escapeHTML(id)}"
                type="${escapeHTML(type)}"
                ${required ? "required" : ""}
                ${extra}
            >
        </label>
    `;
}

function formStyles() {
    return `
        <style>
            .module-panel label {
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 13px;
                color: #46546a;
            }

            .module-form {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                gap: 14px;
                align-items: end;
                margin-bottom: 20px;
            }

            .module-form button {
                min-height: 40px;
            }

            .module-form textarea,
            .module-form select,
            .module-form input {
                width: 100%;
                min-width: 0;
            }

            .module-form textarea {
                min-height: 85px;
                padding: 10px;
                border: 1px solid #ccd6e4;
                border-radius: 7px;
                font: inherit;
            }

            .module-table {
                width: 100%;
                border-collapse: collapse;
            }

            .module-table th,
            .module-table td {
                padding: 11px;
                border-bottom: 1px solid #edf0f5;
                text-align: left;
                font-size: 13px;
            }

            .module-table th {
                background: #f8fafd;
            }

            .module-panel .wide {
                grid-column: 1 / -1;
            }

            .module-panel .notice {
                padding: 12px;
                background: #eaf3ff;
                border-radius: 8px;
                margin-bottom: 16px;
                font-size: 13px;
            }

            @media(max-width: 600px) {
                .module-form {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    `;
}

function installModuleArea() {
    const main = document.querySelector("#dashboard main");

    if (!$("moduleArea")) {
        const area = document.createElement("div");
        area.id = "moduleArea";
        main.appendChild(area);
    }

    if (!$("documentsNav")) {
        const nav = document.createElement("button");
        nav.type = "button";
        nav.id = "documentsNav";
        nav.className = "nav-item";
        nav.textContent = "Documents & Newsletters";

        const merit = $("meritNav");
        merit?.parentElement?.insertBefore(nav, merit.nextSibling);
    }

    $("moduleArea").innerHTML = formStyles();
}

function setPage(name) {
    activePage = name;

    $("pageTitle").textContent = name;

    $("studentPanel").classList.toggle("hidden", name !== "Class Assignment");

    document.querySelectorAll(".module-content").forEach(element => {
        element.classList.add("hidden");
    });

    const current = $(`page-${name.replace(/[^a-zA-Z0-9]/g, "")}`);
    if (current) current.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    const navMap = {
        "Dashboard": null,
        "Class Assignment": "classesNav",
        "Class Teachers": "teachersNav",
        "Subject Combinations": "combinationsNav",
        "Exams & Results": "resultsNav",
        "Merit Lists": "meritNav",
        "Documents & Newsletters": "documentsNav",
        "Grading Systems": null
    };

    const navId = navMap[name];
    if (navId) $(navId)?.classList.add("active");

    $("studentPanel").classList.toggle("hidden", name !== "Class Assignment");

    document.querySelector(".stats").classList.toggle(
        "hidden",
        name !== "Dashboard"
    );

    if (name === "Dashboard") {
        $("studentPanel").classList.add("hidden");
    }
}

function createPage(name, content) {
    const id = `page-${name.replace(/[^a-zA-Z0-9]/g, "")}`;
    let element = $(id);

    if (!element) {
        element = document.createElement("div");
        element.id = id;
        element.className = "module-content hidden";
        $("moduleArea").appendChild(element);
    }

    element.innerHTML = content;
    return element;
}

async function checkAccount() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        showAccessDenied("Sign in with your Grade Hub account.");
        return false;
    }

    currentUser = data.session.user;

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", currentUser.id)
        .single();

    if (profileError || !profile) {
        showAccessDenied("Your account profile could not be loaded.");
        return false;
    }

    if (
        !profile.is_active ||
        !["admin", "super_admin"].includes(profile.role)
    ) {
        showAccessDenied("An active administrator account is required.");
        return false;
    }

    currentProfile = profile;

    $("welcomeText").textContent =
        `Signed in as ${profile.full_name || currentUser.email} · ${profile.role.replace("_", " ")}`;

    $("loadingScreen").classList.add("hidden");
    $("accessDenied").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    return true;
}

function showAccessDenied(message) {
    $("loadingScreen").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("accessDenied").classList.remove("hidden");
    $("accessDeniedText").textContent = message;
}

async function loadBaseData() {
    const [
        classesResult,
        studentsResult,
        subjectsResult,
        combinationsResult,
        gradingResult,
        examsResult,
        profilesResult
    ] = await Promise.all([
        supabase.from("classes")
            .select("id, name, grade_level, academic_year, is_active")
            .eq("is_active", true)
            .order("name"),

        supabase.from("students")
            .select("id, profile_id, admission_number, registration_status, class_id")
            .order("admission_number"),

        supabase.from("subjects")
            .select("id, name, subject_code, is_active")
            .eq("is_active", true)
            .order("name"),

        supabase.from("subject_combinations")
            .select("id, name, description, is_active")
            .eq("is_active", true)
            .order("name"),

        supabase.from("grading_systems")
            .select("id, name, version, is_active")
            .order("name"),

        supabase.from("exams")
            .select("id, name, academic_year, term, class_id, grading_system_id, status")
            .order("created_at", { ascending: false }),

        supabase.from("profiles")
            .select("id, full_name, role, is_active")
            .eq("is_active", true)
            .order("full_name")
    ]);

    for (const result of [
        classesResult,
        studentsResult,
        subjectsResult,
        combinationsResult,
        gradingResult,
        examsResult,
        profilesResult
    ]) {
        if (result.error) {
            throw new Error(result.error.message);
        }
    }

    classes = classesResult.data || [];
    students = studentsResult.data || [];
    subjects = subjectsResult.data || [];
    combinations = combinationsResult.data || [];
    gradingSystems = gradingResult.data || [];
    exams = examsResult.data || [];
    profiles = profilesResult.data || [];

    updateStatistics();
    renderStudents();
}

function updateStatistics() {
    $("totalStudents").textContent = students.length;
    $("totalClasses").textContent = classes.length;

    $("assignedStudents").textContent =
        students.filter(student => student.class_id).length;
}

function renderStudents() {
    const search = $("searchInput").value.trim().toLowerCase();
    const selectedClass = $("classFilter").value;

    const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
    const classMap = new Map(classes.map(item => [item.id, item]));

    $("classFilter").innerHTML = `
        <option value="">All classes</option>
        <option value="unassigned">Not assigned</option>
        ${classes.map(item => option(item.id, item.name, selectedClass === item.id)).join("")}
    `;

    // Preserve the unassigned filter after rebuilding options.
    if (selectedClass === "unassigned") {
        $("classFilter").value = "unassigned";
    }

    const filtered = students.filter(student => {
        const profile = profileMap.get(student.profile_id);
        const name = profile?.full_name || "";
        const admission = student.admission_number || "";

        const matchesSearch =
            name.toLowerCase().includes(search) ||
            admission.toLowerCase().includes(search);

        const matchesClass =
            !selectedClass ||
            (selectedClass === "unassigned" && !student.class_id) ||
            student.class_id === selectedClass;

        return matchesSearch && matchesClass;
    });

    $("studentsTableBody").innerHTML = filtered.length
        ? filtered.map(student => {
            const profile = profileMap.get(student.profile_id);
            const currentClass = classMap.get(student.class_id);

            return `
                <tr data-student-id="${escapeHTML(student.id)}">
                    <td>${escapeHTML(profile?.full_name || "Name unavailable")}</td>
                    <td>${escapeHTML(student.admission_number || "—")}</td>
                    <td>${escapeHTML(student.registration_status || "—")}</td>
                    <td>${escapeHTML(currentClass?.name || "Not assigned")}</td>
                    <td>
                        <select class="class-select">
                            <option value="">Not assigned</option>
                            ${classes.map(item => option(
                                item.id,
                                item.name,
                                item.id === student.class_id
                            )).join("")}
                        </select>
                    </td>
                    <td>
                        <button type="button" class="button save-class-button">Save</button>
                    </td>
                </tr>
            `;
        }).join("")
        : `<tr><td colspan="6" class="empty">No matching students.</td></tr>`;
}

async function saveStudentClass(studentId, newClassId, buttonElement) {
    const student = students.find(item => item.id === studentId);
    if (!student) return showMessage("Student not found.", "error");

    if ((student.class_id || "") === newClassId) {
        return showMessage("No class change was made.", "info");
    }

    if (newClassId && !classes.some(item => item.id === newClassId)) {
        return showMessage("Choose a valid active class.", "error");
    }

    const confirmed = confirm(
        newClassId
            ? `Move this student to ${classes.find(item => item.id === newClassId).name}?`
            : "Remove this student's current class?"
    );

    if (!confirmed) return;

    buttonElement.disabled = true;

    try {
        // Record the end of the current assignment, if one exists.
        const { error: historyError } = await supabase
            .from("student_class_assignments")
            .update({ ended_at: new Date().toISOString() })
            .eq("student_id", studentId)
            .is("ended_at", null);

        if (historyError) throw historyError;

        if (newClassId) {
            const { error: insertHistoryError } = await supabase
                .from("student_class_assignments")
                .insert({
                    student_id: studentId,
                    class_id: newClassId
                });

            if (insertHistoryError) throw insertHistoryError;
        }

        const { error: studentError } = await supabase
            .from("students")
            .update({ class_id: newClassId || null })
            .eq("id", studentId);

        if (studentError) throw studentError;

        showMessage("Class assignment updated.", "success");
        await loadBaseData();
    } catch (error) {
        showMessage(`Could not update class: ${error.message}`, "error");
    } finally {
        buttonElement.disabled = false;
    }
}

function renderTeacherPage() {
    const teachers = profiles.filter(profile => profile.role === "class_teacher");

    createPage("Class Teachers", panel("Assign Class Teachers", `
        <form id="teacherForm" class="module-form">
            ${makeSelect("teacherClass", "Class", classes)}
            ${makeSelect("teacherProfile", "Class Teacher", teachers, "id", "full_name")}
            <button class="button" type="submit">Assign Teacher</button>
        </form>
        <div id="teacherAssignments">Loading assignments...</div>
    `));

    $("teacherForm").addEventListener("submit", async event => {
        event.preventDefault();

        const classId = $("teacherClass").value;
        const teacherId = $("teacherProfile").value;

        try {
            const { error } = await supabase
                .from("class_teacher_assignments")
                .insert({ class_id: classId, teacher_id: teacherId });

            if (error) throw error;

            showMessage("Class teacher assigned.", "success");
            await loadTeacherAssignments();
        } catch (error) {
            showMessage(`Assignment failed: ${error.message}`, "error");
        }
    });

    loadTeacherAssignments();
}

async function loadTeacherAssignments() {
    const { data, error } = await supabase
        .from("class_teacher_assignments")
        .select("id, class_id, teacher_id, assigned_at, ended_at")
        .is("ended_at", null)
        .order("assigned_at", { ascending: false });

    if (error) {
        $("teacherAssignments").textContent = error.message;
        return;
    }

    const classMap = new Map(classes.map(item => [item.id, item]));
    const profileMap = new Map(profiles.map(item => [item.id, item]));

    $("teacherAssignments").innerHTML = `
        <div class="table-wrap">
            <table class="module-table">
                <thead><tr><th>Class</th><th>Teacher</th><th>Action</th></tr></thead>
                <tbody>
                    ${(data || []).map(item => `
                        <tr>
                            <td>${escapeHTML(classMap.get(item.class_id)?.name || "Unknown")}</td>
                            <td>${escapeHTML(profileMap.get(item.teacher_id)?.full_name || "Unknown")}</td>
                            <td><button class="button danger end-teacher" data-id="${escapeHTML(item.id)}">End Assignment</button></td>
                        </tr>
                    `).join("") || `<tr><td colspan="3">No active assignments.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll(".end-teacher").forEach(buttonElement => {
        buttonElement.addEventListener("click", async () => {
            const { error: updateError } = await supabase
                .from("class_teacher_assignments")
                .update({ ended_at: new Date().toISOString() })
                .eq("id", buttonElement.dataset.id);

            if (updateError) {
                showMessage(updateError.message, "error");
                return;
            }

            showMessage("Teacher assignment ended.", "success");
            await loadTeacherAssignments();
        });
    });
}

function renderCombinationsPage() {
    createPage("Subject Combinations", panel("Create Subject Combination", `
        <form id="combinationForm" class="module-form">
            ${inputField("combinationName", "Combination Name")}
            <label class="wide">
                Description
                <textarea id="combinationDescription"></textarea>
            </label>
            <label class="wide">
                Subjects (select multiple)
                <select id="combinationSubjects" multiple size="6" required>
                    ${subjects.map(subject => option(
                        subject.id,
                        `${subject.name}${subject.subject_code ? ` (${subject.subject_code})` : ""}`
                    )).join("")}
                </select>
            </label>
            <button class="button" type="submit">Create Combination</button>
        </form>
        <div id="combinationList"></div>
    `));

    $("combinationForm").addEventListener("submit", async event => {
        event.preventDefault();

        const name = $("combinationName").value.trim();
        const description = $("combinationDescription").value.trim();
        const subjectIds = [...$("combinationSubjects").selectedOptions]
            .map(item => item.value);

        if (!subjectIds.length) {
            showMessage("Select at least one subject.", "error");
            return;
        }

        try {
            const { data: combination, error } = await supabase
                .from("subject_combinations")
                .insert({
                    name,
                    description: description || null,
                    created_by: currentUser.id
                })
                .select("id")
                .single();

            if (error) throw error;

            const { error: linksError } = await supabase
                .from("combination_subjects")
                .insert(subjectIds.map(subjectId => ({
                    combination_id: combination.id,
                    subject_id: subjectId
                })));

            if (linksError) throw linksError;

            showMessage("Subject combination created.", "success");
            await loadBaseData();
            renderCombinationsPage();
            setPage("Subject Combinations");
        } catch (error) {
            showMessage(`Could not create combination: ${error.message}`, "error");
        }
    });

    loadCombinationList();
}

async function loadCombinationList() {
    const { data, error } = await supabase
        .from("combination_subjects")
        .select("combination_id, subject_id");

    if (error) {
        $("combinationList").textContent = error.message;
        return;
    }

    const links = data || [];
    const subjectMap = new Map(subjects.map(item => [item.id, item]));

    $("combinationList").innerHTML = `
        <div class="table-wrap">
            <table class="module-table">
                <thead><tr><th>Combination</th><th>Subjects</th></tr></thead>
                <tbody>
                    ${combinations.map(combination => {
                        const linkedSubjects = links
                            .filter(link => link.combination_id === combination.id)
                            .map(link => subjectMap.get(link.subject_id)?.name)
                            .filter(Boolean);

                        return `<tr>
                            <td>${escapeHTML(combination.name)}</td>
                            <td>${escapeHTML(linkedSubjects.join(", ") || "No subjects linked")}</td>
                        </tr>`;
                    }).join("") || `<tr><td colspan="2">No combinations found.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

function renderGradingPage() {
    createPage("Grading Systems", panel("Create Grading System", `
        <form id="gradingForm" class="module-form">
            ${inputField("gradingName", "System Name")}
            ${inputField("gradingVersion", "Version", "number", true, 'min="1" value="1"')}
            <label class="wide">
                Description
                <textarea id="gradingDescription"></textarea>
            </label>
            <button class="button" type="submit">Create System</button>
        </form>
        <div id="gradingList"></div>
    `));

    $("gradingForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const { error } = await supabase
                .from("grading_systems")
                .insert({
                    name: $("gradingName").value.trim(),
                    version: Number($("gradingVersion").value),
                    description: $("gradingDescription").value.trim() || null,
                    created_by: currentUser.id
                });

            if (error) throw error;

            showMessage("Grading system created. Add its grade bands in the next form.", "success");
            await loadBaseData();
            renderGradingPage();
            setPage("Grading Systems");
        } catch (error) {
            showMessage(`Could not create grading system: ${error.message}`, "error");
        }
    });

    $("gradingList").innerHTML = `
        <h3>Existing Grading Systems</h3>
        ${gradingSystems.map(system => `
            <p>${escapeHTML(system.name)} — Version ${escapeHTML(system.version)}
                ${system.is_active ? "(Active)" : "(Inactive)"}
            </p>
        `).join("") || "<p>No grading systems found.</p>"}

        <hr>

        <h3>Add Grade Band</h3>
        <form id="gradeBandForm" class="module-form">
            ${makeSelect("bandSystem", "Grading System", gradingSystems)}
            ${inputField("bandName", "Grade (e.g. EE1)")}
            ${inputField("bandMinimum", "Minimum Score", "number", true, 'min="0" max="100" step="0.01"')}
            ${inputField("bandMaximum", "Maximum Score", "number", true, 'min="0" max="100" step="0.01"')}
            ${inputField("bandPoints", "Grade Points", "number", false, 'min="0" step="0.01"')}
            <button class="button" type="submit">Add Grade Band</button>
        </form>
    `;

    $("gradeBandForm").addEventListener("submit", async event => {
        event.preventDefault();

        const minimum = Number($("bandMinimum").value);
        const maximum = Number($("bandMaximum").value);

        if (minimum > maximum) {
            showMessage("Minimum score cannot exceed maximum score.", "error");
            return;
        }

        try {
            const { error } = await supabase
                .from("grade_bands")
                .insert({
                    grading_system_id: $("bandSystem").value,
                    grade_name: $("bandName").value.trim(),
                    minimum_score: minimum,
                    maximum_score: maximum,
                    grade_points: $("bandPoints").value === ""
                        ? null
                        : Number($("bandPoints").value)
                });

            if (error) throw error;

            showMessage("Grade band added.", "success");
            $("gradeBandForm").reset();
        } catch (error) {
            showMessage(`Could not add grade band: ${error.message}`, "error");
        }
    });
}

function renderExamsPage() {
    createPage("Exams & Results", panel("Create Examination", `
        <form id="examForm" class="module-form">
            ${inputField("examName", "Examination Name")}
            ${inputField("examYear", "Academic Year", "number", true, `min="2000" value="${new Date().getFullYear()}"`)}
            <label>
                Term
                <select id="examTerm">
                    ${option("Term 1", "Term 1")}
                    ${option("Term 2", "Term 2")}
                    ${option("Term 3", "Term 3")}
                </select>
            </label>
            ${makeSelect("examClass", "Class", classes)}
            ${makeSelect("examGrading", "Grading System", gradingSystems)}
            <label>
                Status
                <select id="examStatus">
                    ${option("draft", "Draft", true)}
                    ${option("published", "Published")}
                    ${option("closed", "Closed")}
                </select>
            </label>
            ${inputField("examStart", "Start Date", "date", false)}
            ${inputField("examEnd", "End Date", "date", false)}
            <button class="button" type="submit">Create Examination</button>
        </form>
        <hr>
        <h3>Existing Examinations</h3>
        <div id="examList"></div>
    `));

    $("examForm").addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const { error } = await supabase
                .from("exams")
                .insert({
                    name: $("examName").value.trim(),
                    academic_year: Number($("examYear").value),
                    term: $("examTerm").value || null,
                    class_id: $("examClass").value || null,
                    grading_system_id: $("examGrading").value,
                    status: $("examStatus").value,
                    starts_on: $("examStart").value || null,
                    ends_on: $("examEnd").value || null,
                    created_by: currentUser.id
                });

            if (error) throw error;

            showMessage("Examination created.", "success");
            await loadBaseData();
            renderExamsPage();
            setPage("Exams & Results");
        } catch (error) {
            showMessage(`Could not create examination: ${error.message}`, "error");
        }
    });

    $("examList").innerHTML = `
        <div class="table-wrap">
            <table class="module-table">
                <thead><tr><th>Examination</th><th>Year</th><th>Term</th><th>Status</th></tr></thead>
                <tbody>
                    ${exams.map(exam => `
                        <tr>
                            <td>${escapeHTML(exam.name)}</td>
                            <td>${escapeHTML(exam.academic_year)}</td>
                            <td>${escapeHTML(exam.term || "—")}</td>
                            <td>${escapeHTML(exam.status)}</td>
                        </tr>
                    `).join("") || `<tr><td colspan="4">No examinations created.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;

    renderResultsEntry();
}

function renderResultsEntry() {
    const resultSection = document.createElement("section");
    resultSection.className = "panel";
    resultSection.innerHTML = `
        <h2>Enter Subject Results</h2>
        <p class="muted">
            Enter the student's marks and the maximum possible marks.
            The database calculates the percentage.
        </p>

        <form id="resultForm" class="module-form">
            ${makeSelect("resultExam", "Examination", exams)}
            ${makeSelect("resultStudent", "Student", students.map(student => ({
                id: student.id,
                name: profiles.find(profile => profile.id === student.profile_id)?.full_name
                    || student.admission_number
                    || "Unnamed student"
            })))}
            ${makeSelect("resultSubject", "Subject", subjects)}
            ${inputField("resultMarks", "Marks Earned", "number", true, 'min="0" step="0.01"')}
            ${inputField("resultTotal", "Total Possible Marks", "number", true, 'min="0.01" step="0.01" value="100"')}
            <label>
                Percentage Preview
                <input id="resultPercentagePreview" readonly value="0%">
            </label>
            <label class="wide">
                Remarks
                <textarea id="resultRemarks"></textarea>
            </label>
            <button class="button" type="submit">Save Result</button>
        </form>
    `;

    $("page-ExamsResults").appendChild(resultSection);

    const updatePreview = () => {
        const marks = Number($("resultMarks").value);
        const total = Number($("resultTotal").value);

        const percentage = total > 0 && marks >= 0
            ? (marks / total * 100)
            : 0;

        $("resultPercentagePreview").value =
            `${percentage.toFixed(2)}%`;
    };

    $("resultMarks").addEventListener("input", updatePreview);
    $("resultTotal").addEventListener("input", updatePreview);

    $("resultForm").addEventListener("submit", async event => {
        event.preventDefault();

        const marks = Number($("resultMarks").value);
        const total = Number($("resultTotal").value);
        const examId = $("resultExam").value;
        const studentId = $("resultStudent").value;
        const subjectId = $("resultSubject").value;

        if (!examId || !studentId || !subjectId) {
            showMessage("Choose an examination, student and subject.", "error");
            return;
        }

        if (total <= 0 || marks < 0 || marks > total) {
            showMessage("Marks must be between zero and the total possible marks.", "error");
            return;
        }

        try {
            const { error } = await supabase
                .from("exam_results")
                .upsert({
                    exam_id: examId,
                    student_id: studentId,
                    subject_id: subjectId,
                    marks,
                    total_marks: total,
                    remarks: $("resultRemarks").value.trim() || null,
                    entered_by: currentUser.id
                }, {
                    onConflict: "exam_id,student_id,subject_id"
                });

            if (error) throw error;

            showMessage(
                `Result saved: ${((marks / total) * 100).toFixed(2)}%.`,
                "success"
            );

            $("resultForm").reset();
            $("resultTotal").value = "100";
            updatePreview();
        } catch (error) {
            showMessage(
                `Could not save result: ${error.message}. If the database has no unique constraint for exam, student and subject, the update may require a database constraint.`,
                "error"
            );
        }
    });
}

async function renderMeritPage() {
    createPage("Merit Lists", panel("Merit List", `
        <form id="meritForm" class="module-form">
            ${makeSelect("meritExam", "Examination", exams)}
            <button class="button" type="submit">Generate Merit List</button>
        </form>
        <div id="meritOutput"></div>
    `));

    $("meritForm").addEventListener("submit", async event => {
        event.preventDefault();

        const examId = $("meritExam").value;
        const exam = exams.find(item => item.id === examId);

        if (!exam) {
            showMessage("Choose an examination.", "error");
            return;
        }

        try {
            let query = supabase
                .from("exam_results")
                .select("student_id, subject_id, marks, total_marks, percentage")
                .eq("exam_id", examId);

            const { data, error } = await query;
            if (error) throw error;

            const studentMap = new Map(students.map(item => [item.id, item]));
            const profileMap = new Map(profiles.map(item => [item.id, item]));
            const subjectMap = new Map(subjects.map(item => [item.id, item]));

            const totals = new Map();

            for (const result of data || []) {
                const student = studentMap.get(result.student_id);

                if (exam.class_id && student?.class_id !== exam.class_id) {
                    continue;
                }

                if (!totals.has(result.student_id)) {
                    totals.set(result.student_id, {
                        studentId: result.student_id,
                        totalMarks: 0,
                        totalPossible: 0,
                        subjects: []
                    });
                }

                const entry = totals.get(result.student_id);

                entry.totalMarks += Number(result.marks);
                entry.totalPossible += Number(result.total_marks);

                entry.subjects.push({
                    name: subjectMap.get(result.subject_id)?.name || "Subject",
                    marks: Number(result.marks),
                    total: Number(result.total_marks),
                    percentage: Number(result.percentage)
                });
            }

            const ranked = [...totals.values()]
                .map(entry => ({
                    ...entry,
                    percentage: entry.totalPossible > 0
                        ? entry.totalMarks / entry.totalPossible * 100
                        : 0,
                    name: profileMap.get(
                        studentMap.get(entry.studentId)?.profile_id
                    )?.full_name || "Unknown student",
                    admission: studentMap.get(entry.studentId)?.admission_number || ""
                }))
                .sort((a, b) =>
                    b.percentage - a.percentage ||
                    a.name.localeCompare(b.name)
                );

            let previousPercentage = null;
            let rank = 0;

            ranked.forEach((item, index) => {
                if (item.percentage !== previousPercentage) {
                    rank = index + 1;
                    previousPercentage = item.percentage;
                }
                item.rank = rank;
            });

            $("meritOutput").innerHTML = `
                <h3>${escapeHTML(exam.name)}</h3>
                <div class="table-wrap">
                    <table class="module-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Student</th>
                                <th>Admission No.</th>
                                <th>Total Score</th>
                                <th>Percentage</th>
                                <th>Subject Breakdown</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ranked.map(item => `
                                <tr>
                                    <td>${item.rank}</td>
                                    <td>${escapeHTML(item.name)}</td>
                                    <td>${escapeHTML(item.admission)}</td>
                                    <td>${item.totalMarks} / ${item.totalPossible}</td>
                                    <td>${item.percentage.toFixed(2)}%</td>
                                    <td>${escapeHTML(item.subjects.map(subject =>
                                        `${subject.name}: ${subject.marks}/${subject.total} (${subject.percentage.toFixed(2)}%)`
                                    ).join(" | "))}</td>
                                </tr>
                            `).join("") || `<tr><td colspan="6">No results found for this examination.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            showMessage(`Could not generate merit list: ${error.message}`, "error");
        }
    });
}

function renderDocumentsPage() {
    createPage("Documents & Newsletters", panel("Upload Documents & Newsletters", `
        <p class="notice">
            Files are stored in Supabase Storage. The documents table remembers each
            file's Storage path so the portal can find it again.
            Create a Storage bucket named <strong>grade-hub-documents</strong>
            before uploading.
        </p>

        <form id="documentForm" class="module-form">
            ${inputField("documentTitle", "Document Title")}
            <label>
                Document Type
                <select id="documentType" required>
                    ${option("newsletter", "Newsletter", true)}
                    ${option("announcement", "Announcement attachment")}
                    ${option("report", "Report")}
                    ${option("other", "Other")}
                </select>
            </label>
            <label>
                File
                <input id="documentFile" type="file" required>
            </label>
            <label class="wide">
                Description
                <textarea id="documentDescription"></textarea>
            </label>
            <label>
                Publish to students
                <select id="documentPublished">
                    ${option("false", "Keep unpublished", true)}
                    ${option("true", "Publish")}
                </select>
            </label>
            <button class="button" type="submit">Upload Document</button>
        </form>

        <hr>
        <h3>Uploaded Documents</h3>
        <div id="documentList">Loading documents...</div>
    `));

    $("documentForm").addEventListener("submit", async event => {
        event.preventDefault();

        const file = $("documentFile").files[0];
        if (!file) {
            showMessage("Choose a file first.", "error");
            return;
        }

        const maxSize = 15 * 1024 * 1024;

        if (file.size > maxSize) {
            showMessage("This file exceeds the 15 MB upload limit.", "error");
            return;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${currentUser.id}/${Date.now()}-${safeName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from("grade-hub-documents")
                .upload(storagePath, file, {
                    upsert: false,
                    contentType: file.type || "application/octet-stream"
                });

            if (uploadError) throw uploadError;

            const { error: recordError } = await supabase
                .from("documents")
                .insert({
                    title: $("documentTitle").value.trim(),
                    description: $("documentDescription").value.trim() || null,
                    storage_path: storagePath,
                    document_type: $("documentType").value,
                    is_published: $("documentPublished").value === "true",
                    uploaded_by: currentUser.id
                });

            if (recordError) {
                // Remove the uploaded file if its database record could not be saved.
                await supabase.storage
                    .from("grade-hub-documents")
                    .remove([storagePath]);

                throw recordError;
            }

            showMessage("Document uploaded and its Storage path saved.", "success");
            $("documentForm").reset();
            await loadDocuments();
        } catch (error) {
            showMessage(`Upload failed: ${error.message}`, "error");
        }
    });

    loadDocuments();
}

async function loadDocuments() {
    const { data, error } = await supabase
        .from("documents")
        .select("id, title, description, storage_path, document_type, is_published, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        $("documentList").textContent = error.message;
        return;
    }

    $("documentList").innerHTML = `
        <div class="table-wrap">
            <table class="module-table">
                <thead>
                    <tr><th>Title</th><th>Type</th><th>Published</th><th>Uploaded</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${(data || []).map(document => `
                        <tr>
                            <td>
                                ${escapeHTML(document.title)}
                                <br><small>${escapeHTML(document.storage_path)}</small>
                            </td>
                            <td>${escapeHTML(document.document_type)}</td>
                            <td>${document.is_published ? "Yes" : "No"}</td>
                            <td>${escapeHTML(new Date(document.created_at).toLocaleDateString())}</td>
                            <td>
                                <button class="button get-document-link"
                                    data-path="${escapeHTML(document.storage_path)}">
                                    Open File
                                </button>
                            </td>
                        </tr>
                    `).join("") || `<tr><td colspan="5">No documents uploaded.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll(".get-document-link").forEach(buttonElement => {
        buttonElement.addEventListener("click", async () => {
            const { data: signedData, error: signedError } = await supabase.storage
                .from("grade-hub-documents")
                .createSignedUrl(buttonElement.dataset.path, 300);

            if (signedError) {
                showMessage(`Could not open file: ${signedError.message}`, "error");
                return;
            }

            window.open(signedData.signedUrl, "_blank", "noopener,noreferrer");
        });
    });
}

function wireNavigation() {
    $("studentsNav").addEventListener("click", () => setPage("Class Assignment"));
    $("classesNav").addEventListener("click", () => setPage("Class Assignment"));

    $("teachersNav").addEventListener("click", () => {
        renderTeacherPage();
        setPage("Class Teachers");
    });

    $("combinationsNav").addEventListener("click", () => {
        renderCombinationsPage();
        setPage("Subject Combinations");
    });

    $("resultsNav").addEventListener("click", () => {
        renderExamsPage();
        setPage("Exams & Results");
    });

    $("meritNav").addEventListener("click", () => {
        renderMeritPage();
        setPage("Merit Lists");
    });

    $("documentsNav").addEventListener("click", () => {
        renderDocumentsPage();
        setPage("Documents & Newsletters");
    });

    // Add a grading-system shortcut.
    const gradingButton = document.createElement("button");
    gradingButton.type = "button";
    gradingButton.className = "nav-item";
    gradingButton.textContent = "Grading Systems";
    gradingButton.addEventListener("click", () => {
        renderGradingPage();
        setPage("Grading Systems");
    });

    $("documentsNav").parentElement.insertBefore(
        gradingButton,
        $("documentsNav")
    );

    document.querySelector(".brand").addEventListener("click", () => {
        setPage("Dashboard");
    });

    $("studentsTableBody").addEventListener("click", async event => {
        const saveButton = event.target.closest(".save-class-button");
        if (!saveButton) return;

        const row = saveButton.closest("tr");
        await saveStudentClass(
            row.dataset.studentId,
            row.querySelector(".class-select").value,
            saveButton
        );
    });

    $("searchInput").addEventListener("input", renderStudents);
    $("classFilter").addEventListener("change", renderStudents);

    $("refreshButton").addEventListener("click", async () => {
        try {
            await loadBaseData();
            showMessage("Dashboard refreshed.", "success");

            if (activePage === "Documents & Newsletters") {
                await loadDocuments();
            }
        } catch (error) {
            showMessage(error.message, "error");
        }
    });

    $("signOutButton").addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            showMessage(error.message, "error");
            return;
        }

        window.location.href = "../index.html";
    });

    $("returnButton").addEventListener("click", () => {
        window.location.href = "../index.html";
    });
}

async function startDashboard() {
    try {
        const allowed = await checkAccount();
        if (!allowed) return;

        installModuleArea();
        await loadBaseData();
        wireNavigation();

        $("studentPanel").classList.add("hidden");
        setPage("Dashboard");

        showMessage("Grade Hub Admin Dashboard is ready.", "success");
    } catch (error) {
        showMessage(`Dashboard could not load: ${error.message}`, "error");
    }
}

startDashboard();
