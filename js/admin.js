import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Replace these with your own Supabase project credentials.
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let students = [];
let classes = [];
let profilesById = new Map();
let classesById = new Map();

function showMessage(message, type = "info") {
    const box = $("message");
    box.textContent = message;
    box.className = `status ${type}`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function showAccessDenied(message) {
    $("loadingScreen").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("accessDenied").classList.remove("hidden");
    $("accessDeniedText").textContent = message;
}

async function checkAccount() {
    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        showAccessDenied("Sign in with your Grade Hub account before opening the Admin Dashboard.");
        return false;
    }

    currentUser = sessionData.session.user;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", currentUser.id)
        .single();

    if (error || !profile) {
        showAccessDenied(
            "Your account profile could not be loaded. Check your profiles table permissions."
        );
        return false;
    }

    if (
        !profile.is_active ||
        !["admin", "super_admin"].includes(String(profile.role))
    ) {
        showAccessDenied("This page is only available to active administrators.");
        return false;
    }

    $("welcomeText").textContent =
        `Signed in as ${profile.full_name || currentUser.email} · ${profile.role.replace("_", " ")}`;

    $("loadingScreen").classList.add("hidden");
    $("accessDenied").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    return true;
}

async function loadClasses() {
    const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, academic_year, capacity, is_active")
        .eq("is_active", true)
        .order("grade_level")
        .order("name");

    if (error) {
        throw new Error(`Could not load classes: ${error.message}`);
    }

    classes = data || [];
    classesById = new Map(classes.map((item) => [item.id, item]));

    const classFilter = $("classFilter");
    classFilter.innerHTML = `
        <option value="">All classes</option>
        <option value="unassigned">Not assigned</option>
        ${classes.map((item) => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.name)}
            </option>
        `).join("")}
    `;
}

async function loadStudents() {
    const { data, error } = await supabase
        .from("students")
        .select(
            "id, profile_id, admission_number, registration_status, class_id"
        )
        .order("admission_number");

    if (error) {
        throw new Error(`Could not load students: ${error.message}`);
    }

    students = data || [];

    const profileIds = [
        ...new Set(students.map((student) => student.profile_id).filter(Boolean))
    ];

    profilesById = new Map();

    if (profileIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, is_active")
            .in("id", profileIds);

        if (profilesError) {
            throw new Error(
                `Students loaded, but student names could not be read: ${profilesError.message}`
            );
        }

        profilesById = new Map(
            (profiles || []).map((profile) => [profile.id, profile])
        );
    }

    updateStatistics();
    renderStudents();
}

function updateStatistics() {
    $("totalStudents").textContent = students.length;
    $("totalClasses").textContent = classes.length;
    $("assignedStudents").textContent =
        students.filter((student) => student.class_id).length;
}

function renderStudents() {
    const search = $("searchInput").value.trim().toLowerCase();
    const selectedClass = $("classFilter").value;

    const filteredStudents = students.filter((student) => {
        const profile = profilesById.get(student.profile_id);
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

    const tbody = $("studentsTableBody");

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    No students match your search.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredStudents.map((student) => {
        const profile = profilesById.get(student.profile_id);
        const studentName = profile?.full_name || "Name unavailable";
        const currentClass = classesById.get(student.class_id);
        const currentClassName = currentClass
            ? currentClass.name
            : "Not assigned";

        return `
            <tr data-student-id="${escapeHTML(student.id)}">
                <td>${escapeHTML(studentName)}</td>
                <td>${escapeHTML(student.admission_number || "—")}</td>
                <td>${escapeHTML(student.registration_status || "—")}</td>
                <td>${escapeHTML(currentClassName)}</td>
                <td>
                    <select class="class-select" aria-label="Choose class for ${escapeHTML(studentName)}">
                        <option value="">Not assigned</option>
                        ${classes.map((item) => `
                            <option
                                value="${escapeHTML(item.id)}"
                                ${student.class_id === item.id ? "selected" : ""}
                            >
                                ${escapeHTML(item.name)}
                            </option>
                        `).join("")}
                    </select>
                </td>
                <td>
                    <button class="button save-class-button" type="button">
                        Save
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

async function saveStudentClass(studentId, newClassId, button) {
    const student = students.find((item) => item.id === studentId);

    if (!student) {
        showMessage("Student record was not found. Refresh and try again.", "error");
        return;
    }

    if ((student.class_id || "") === newClassId) {
        showMessage("This student is already assigned to that class.", "info");
        return;
    }

    if (newClassId && !classesById.has(newClassId)) {
        showMessage("Choose a valid active class.", "error");
        return;
    }

    const confirmed = window.confirm(
        newClassId
            ? `Assign or move this student to ${classesById.get(newClassId).name}?`
            : "Remove this student's current class assignment?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Saving...";

    const { error } = await supabase
        .from("students")
        .update({ class_id: newClassId || null })
        .eq("id", studentId);

    button.disabled = false;
    button.textContent = "Save";

    if (error) {
        showMessage(
            `Class assignment failed: ${error.message}. Check the students UPDATE policy and your account permissions.`,
            "error"
        );
        return;
    }

    showMessage("Student class assignment updated.", "success");

    try {
        await loadStudents();
    } catch (loadError) {
        showMessage(loadError.message, "error");
    }
}

async function refreshDashboard() {
    $("refreshButton").disabled = true;
    $("refreshButton").textContent = "Refreshing...";

    try {
        await loadClasses();
        await loadStudents();
        showMessage("Dashboard data refreshed.", "success");
    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        $("refreshButton").disabled = false;
        $("refreshButton").textContent = "Refresh Data";
    }
}

$("studentsTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest(".save-class-button");
    if (!button) return;

    const row = button.closest("tr");
    const studentId = row.dataset.studentId;
    const newClassId = row.querySelector(".class-select").value;

    await saveStudentClass(studentId, newClassId, button);
});

$("searchInput").addEventListener("input", renderStudents);
$("classFilter").addEventListener("change", renderStudents);
$("refreshButton").addEventListener("click", refreshDashboard);

$("signOutButton").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        showMessage(`Sign out failed: ${error.message}`, "error");
        return;
    }

    window.location.href = "./index.html";
});

$("returnButton").addEventListener("click", () => {
    window.location.href = "./index.html";
});

// These sections are navigation placeholders for the next build stages.
[
    ["classesNav", "Class Assignment"],
    ["teachersNav", "Class Teacher Management"],
    ["combinationsNav", "Subject Combinations"],
    ["resultsNav", "Exams and Results"],
    ["meritNav", "Merit Lists"]
].forEach(([id, label]) => {
    $(id).addEventListener("click", () => {
        showMessage(
            `${label} will be connected in the next stage. Student class assignment is available now.`,
            "info"
        );
    });
});

async function startDashboard() {
    try {
        const allowed = await checkAccount();
        if (!allowed) return;

        await loadClasses();
        await loadStudents();
    } catch (error) {
        showMessage(error.message, "error");
    }
}

startDashboard();
