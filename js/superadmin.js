import { supabase } from "./supabase.js";


// ============================================================
// ELEMENTS
// ============================================================

const logoutButton =
    document.getElementById("logoutButton");

const refreshButton =
    document.getElementById("refreshDashboard");

const messageBox =
    document.getElementById("saMessage");


// Statistics
const totalStudents =
    document.getElementById("totalStudents");

const totalAdmins =
    document.getElementById("totalAdmins");

const pendingAdmins =
    document.getElementById("pendingAdmins");


// Admins
const adminRequests =
    document.getElementById("adminRequests");

const approvedAdmins =
    document.getElementById("approvedAdmins");


// Students
const studentTable =
    document.getElementById("studentTable");


// Password management
const passwordUser =
    document.getElementById("passwordUser");

const newPassword =
    document.getElementById("newPassword");

const changePasswordButton =
    document.getElementById(
        "changePasswordButton"
    );


// Subjects
const subjectName =
    document.getElementById("subjectName");

const subjectCode =
    document.getElementById("subjectCode");

const addSubjectButton =
    document.getElementById(
        "addSubjectButton"
    );

const subjectsTable =
    document.getElementById("subjectsTable");


// Combinations
const combinationName =
    document.getElementById(
        "combinationName"
    );

const combinationDescription =
    document.getElementById(
        "combinationDescription"
    );

const addCombinationButton =
    document.getElementById(
        "addCombinationButton"
    );

const combinationsTable =
    document.getElementById(
        "combinationsTable"
    );


// Student combination
const combinationStudent =
    document.getElementById(
        "combinationStudent"
    );

const studentCombination =
    document.getElementById(
        "studentCombination"
    );

const assignCombinationButton =
    document.getElementById(
        "assignCombinationButton"
    );


// Exams
const examName =
    document.getElementById("examName");

const examYear =
    document.getElementById("examYear");

const examTerm =
    document.getElementById("examTerm");

const examDate =
    document.getElementById("examDate");

const examDescription =
    document.getElementById(
        "examDescription"
    );

const createExamButton =
    document.getElementById(
        "createExamButton"
    );

const examsTable =
    document.getElementById("examsTable");


// Results
const resultExam =
    document.getElementById("resultExam");

const resultStudent =
    document.getElementById(
        "resultStudent"
    );

const resultSubject =
    document.getElementById(
        "resultSubject"
    );

const resultScore =
    document.getElementById(
        "resultScore"
    );

const resultMaxScore =
    document.getElementById(
        "resultMaxScore"
    );

const resultComment =
    document.getElementById(
        "resultComment"
    );

const saveResultButton =
    document.getElementById(
        "saveResultButton"
    );

const resultsTable =
    document.getElementById(
        "resultsTable"
    );


// Documents
const documentTitle =
    document.getElementById(
        "documentTitle"
    );

const documentDescription =
    document.getElementById(
        "documentDescription"
    );

const documentCategory =
    document.getElementById(
        "documentCategory"
    );

const documentFile =
    document.getElementById(
        "documentFile"
    );

const uploadDocumentButton =
    document.getElementById(
        "uploadDocumentButton"
    );

const documentsTable =
    document.getElementById(
        "documentsTable"
    );


// Announcements
const announcementTitle =
    document.getElementById(
        "announcementTitle"
    );

const announcementMessage =
    document.getElementById(
        "announcementMessage"
    );

const addAnnouncementButton =
    document.getElementById(
        "addAnnouncementButton"
    );

const announcementsTable =
    document.getElementById(
        "announcementsTable"
    );


// Grading
const gradingTable =
    document.getElementById(
        "gradingTable"
    );

const addGradeButton =
    document.getElementById(
        "addGradeButton"
    );

const resetGradesButton =
    document.getElementById(
        "resetGradesButton"
    );

const saveGradesButton =
    document.getElementById(
        "saveGradesButton"
    );


// ============================================================
// CACHE
// ============================================================

let cachedStudents = [];

let cachedSubjects = [];

let cachedCombinations = [];

let cachedExams = [];

let cachedResults = [];

let cachedDocuments = [];

let cachedAnnouncements = [];


// ============================================================
// DEFAULT GRADING SYSTEM
// ============================================================

const defaultGrades = [
    {
        grade: "A",
        minimum_mark: 80,
        points: 12,
        description: "Excellent"
    },
    {
        grade: "B",
        minimum_mark: 70,
        points: 10,
        description: "Very Good"
    },
    {
        grade: "C",
        minimum_mark: 60,
        points: 8,
        description: "Good"
    },
    {
        grade: "D",
        minimum_mark: 50,
        points: 6,
        description: "Average"
    },
    {
        grade: "E",
        minimum_mark: 0,
        points: 4,
        description: "Below Average"
    }
];

let gradingRows = [];


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
    message,
    type = "success"
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        "sa-message show " +
        type;

    setTimeout(() => {

        messageBox.classList.remove(
            "show"
        );

    }, 4000);

}


// ============================================================
// HTML SAFETY
// ============================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// DATE
// ============================================================

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }

    return date.toLocaleDateString();

}


// ============================================================
// AUTH
// ============================================================

async function getCurrentUser() {

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

    if (error) {

        console.error(
            "Authentication error:",
            error
        );

        return null;

    }

    return data.user || null;

}


// ============================================================
// SUPER ADMIN CHECK
// ============================================================

async function checkSuperAdmin() {

    const user =
        await getCurrentUser();

    if (!user) {

        window.location.href =
            "index.html";

        return null;

    }

    const {
        data,
        error
    } =
        await supabase
            .from("user_roles")
            .select(
                "role, approved"
            )
            .eq(
                "user_id",
                user.id
            );

    if (error) {

        console.error(
            "Role verification error:",
            error
        );

        showMessage(
            "Unable to verify your account.",
            "error"
        );

        return null;

    }

    const isSuperAdmin =
        (data || []).some(
            row =>
                row.role ===
                "super_admin" &&
                row.approved === true
        );

    if (!isSuperAdmin) {

        showMessage(
            "You are not an approved Super Admin.",
            "error"
        );

        setTimeout(() => {

            window.location.href =
                "index.html";

        }, 1500);

        return null;

    }

    return user;

}


// ============================================================
// ADMIN REQUESTS
// ============================================================

async function loadAdminRequests() {

    if (!adminRequests) {
        return;
    }

    adminRequests.innerHTML = `
        <tr>
            <td colspan="6" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("admin_requests")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(error);

        adminRequests.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    Failed to load administrator requests.
                </td>
            </tr>
        `;

        return;

    }

    const requests =
        data || [];

    const pending =
        requests.filter(
            request =>
                request.status ===
                "pending"
        );

    if (pendingAdmins) {

        pendingAdmins.textContent =
            pending.length;

    }

    if (!requests.length) {

        adminRequests.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    No administrator requests.
                </td>
            </tr>
        `;

        return;

    }

    adminRequests.innerHTML =
        requests.map(
            request => {

                let actions = "—";

                if (
                    request.status ===
                    "pending"
                ) {

                    actions = `
                        <button
                            class="sa-btn approve"
                            data-action="approve"
                            data-id="${escapeHTML(request.id)}">
                            Approve
                        </button>

                        <button
                            class="sa-btn reject"
                            data-action="reject"
                            data-id="${escapeHTML(request.id)}">
                            Reject
                        </button>
                    `;

                }

                const statusClass =
                    request.status ===
                    "approved"
                        ? "approved"
                        : request.status ===
                          "pending"
                            ? "pending"
                            : "danger";

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                request.full_name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                request.username ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                request.email ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                request.created_at
                            )}
                        </td>

                        <td>
                            <span
                                class="sa-status ${statusClass}">
                                ${escapeHTML(
                                    request.status ||
                                    "Unknown"
                                )}
                            </span>
                        </td>

                        <td>
                            ${actions}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// APPROVE ADMIN
// ============================================================

async function approveAdmin(
    requestId
) {

    const confirmed =
        window.confirm(
            "Approve this administrator request?"
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } =
        await supabase.rpc(
            "approve_admin_request",
            {
                request_id:
                    requestId
            }
        );

    if (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Approval failed.",
            "error"
        );

        return;

    }

    showMessage(
        "Administrator approved successfully."
    );

    await loadAdminRequests();

    await loadApprovedAdmins();

    await loadPasswordAccounts();

}


// ============================================================
// REJECT ADMIN
// ============================================================

async function rejectAdmin(
    requestId
) {

    const confirmed =
        window.confirm(
            "Reject this administrator request?"
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from("admin_requests")
            .update({
                status:
                    "rejected"
            })
            .eq(
                "id",
                requestId
            );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        "Administrator request rejected."
    );

    await loadAdminRequests();

}


// ============================================================
// ADMIN REQUEST BUTTONS
// ============================================================

if (adminRequests) {

    adminRequests.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "button[data-action]"
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            const id =
                button.dataset.id;

            button.disabled =
                true;

            if (
                action ===
                "approve"
            ) {

                await approveAdmin(id);

            }

            if (
                action ===
                "reject"
            ) {

                await rejectAdmin(id);

            }

            button.disabled =
                false;

        }
    );

}


// ============================================================
// APPROVED ADMINISTRATORS
// ============================================================

async function loadApprovedAdmins() {

    if (!approvedAdmins) {
        return;
    }

    approvedAdmins.innerHTML = `
        <tr>
            <td colspan="4" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("user_roles")
            .select(
                "user_id, role, approved"
            )
            .eq(
                "role",
                "admin"
            )
            .eq(
                "approved",
                true
            );

    if (error) {

        console.error(error);

        approvedAdmins.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Failed to load administrators.
                </td>
            </tr>
        `;

        return;

    }

    const admins =
        data || [];

    if (totalAdmins) {

        totalAdmins.textContent =
            admins.length;

    }

    if (!admins.length) {

        approvedAdmins.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    No approved administrators.
                </td>
            </tr>
        `;

        return;

    }

    const userIds =
        admins.map(
            admin =>
                admin.user_id
        );

    const {
        data: profiles,
        error: profileError
    } =
        await supabase
            .from("profiles")
            .select(
                "id, full_name, username, email"
            )
            .in(
                "id",
                userIds
            );

    if (profileError) {

        console.error(
            profileError
        );

        return;

    }

    const profileMap = {};

    (profiles || []).forEach(
        profile => {

            profileMap[
                profile.id
            ] = profile;

        }
    );

    approvedAdmins.innerHTML =
        admins.map(
            admin => {

                const profile =
                    profileMap[
                        admin.user_id
                    ] || {};

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                profile.full_name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                profile.username ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                profile.email ||
                                "—"
                            )}
                        </td>

                        <td>
                            <span
                                class="sa-status approved">
                                Approved
                            </span>
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// STUDENTS
// ============================================================

async function loadStudents() {

    if (!studentTable) {
        return;
    }

    studentTable.innerHTML = `
        <tr>
            <td colspan="5" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("students")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Student error:",
            error
        );

        studentTable.innerHTML = `
            <tr>
                <td colspan="5" class="sa-empty">
                    Failed to load students.
                </td>
            </tr>
        `;

        return;

    }

    cachedStudents =
        data || [];

    if (totalStudents) {

        totalStudents.textContent =
            cachedStudents.length;

    }

    await attachStudentProfiles();

    renderStudents();

    renderStudentSelects();

    await loadPasswordAccounts();

}


async function attachStudentProfiles() {

    const ids =
        cachedStudents
            .map(
                student =>
                    student.user_id
            )
            .filter(Boolean);

    if (!ids.length) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("profiles")
            .select(
                "id, full_name, username, email"
            )
            .in(
                "id",
                ids
            );

    if (error) {

        console.error(
            "Profile error:",
            error
        );

        return;

    }

    const profileMap = {};

    (data || []).forEach(
        profile => {

            profileMap[
                profile.id
            ] = profile;

        }
    );

    cachedStudents =
        cachedStudents.map(
            student => {

                const profile =
                    profileMap[
                        student.user_id
                    ] || {};

                return {
                    ...student,

                    full_name:
                        profile.full_name ||
                        student.full_name ||
                        "",

                    username:
                        profile.username ||
                        student.username ||
                        "",

                    email:
                        profile.email ||
                        student.email ||
                        ""
                };

            }
        );

}


function renderStudents() {

    if (!studentTable) {
        return;
    }

    if (!cachedStudents.length) {

        studentTable.innerHTML = `
            <tr>
                <td colspan="5" class="sa-empty">
                    No students found.
                </td>
            </tr>
        `;

        return;

    }

    studentTable.innerHTML =
        cachedStudents.map(
            student => {

                let optionalSubjects =
                    student.optional_subjects;

                if (
                    Array.isArray(
                        optionalSubjects
                    )
                ) {

                    optionalSubjects =
                        optionalSubjects.join(
                            ", "
                        );

                }

                if (
                    !optionalSubjects
                ) {

                    optionalSubjects =
                        "—";

                }

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                student.admission_number ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.full_name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.class ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                optionalSubjects
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.username ||
                                "—"
                            )}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// STUDENT SELECTS
// ============================================================

function renderStudentSelects() {

    const selects = [
        combinationStudent,
        resultStudent
    ];

    selects.forEach(
        select => {

            if (!select) {
                return;
            }

            select.innerHTML = `
                <option value="">
                    Select student
                </option>
            `;

            cachedStudents.forEach(
                student => {

                    select.innerHTML += `
                        <option
                            value="${escapeHTML(
                                student.id
                            )}">

                            ${escapeHTML(
                                student.full_name ||
                                student.admission_number ||
                                student.username ||
                                "Student"
                            )}

                        </option>
                    `;

                }
            );

        }
    );

}


// ============================================================
// PASSWORD ACCOUNT SELECT
// ============================================================

async function loadPasswordAccounts() {

    if (!passwordUser) {
        return;
    }

    passwordUser.innerHTML = `
        <option value="">
            Select account
        </option>
    `;

    cachedStudents.forEach(
        student => {

            passwordUser.innerHTML += `
                <option
                    value="${escapeHTML(
                        student.user_id ||
                        student.id
                    )}">

                    Student:
                    ${escapeHTML(
                        student.full_name ||
                        student.username ||
                        student.email ||
                        student.admission_number ||
                        "Student"
                    )}

                </option>
            `;

        }
    );

    const {
        data,
        error
    } =
        await supabase
            .from("user_roles")
            .select(
                "user_id, role, approved"
            )
            .eq(
                "role",
                "admin"
            )
            .eq(
                "approved",
                true
            );

    if (error) {

        console.error(
            "Password admin accounts:",
            error
        );

        return;

    }

    const adminIds =
        (data || []).map(
            row =>
                row.user_id
        );

    if (!adminIds.length) {
        return;
    }

    const {
        data: profiles,
        error: profileError
    } =
        await supabase
            .from("profiles")
            .select(
                "id, full_name, username, email"
            )
            .in(
                "id",
                adminIds
            );

    if (profileError) {

        console.error(
            profileError
        );

        return;

    }

    (profiles || []).forEach(
        profile => {

            passwordUser.innerHTML += `
                <option
                    value="${escapeHTML(
                        profile.id
                    )}">

                    Administrator:
                    ${escapeHTML(
                        profile.full_name ||
                        profile.username ||
                        profile.email ||
                        "Administrator"
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// PASSWORD CHANGE
// ============================================================

if (changePasswordButton) {

    changePasswordButton.addEventListener(
        "click",
        async () => {

            const userId =
                passwordUser.value;

            const password =
                newPassword.value.trim();

            if (!userId) {

                showMessage(
                    "Select an account.",
                    "warning"
                );

                return;

            }

            if (password.length < 6) {

                showMessage(
                    "Password must contain at least 6 characters.",
                    "warning"
                );

                return;

            }

            /*
             * Supabase Auth passwords cannot safely be changed
             * for another user from the browser using the anon key.
             *
             * This requires a protected server-side function
             * or an RPC that you create specifically for the
             * Super Admin.
             */

            showMessage(
                "Password changing needs a protected Supabase server function. The browser cannot safely change another user's Auth password.",
                "error"
            );

        }
    );

}


// ============================================================
// SUBJECTS
// ============================================================

async function loadSubjects() {

    if (!subjectsTable) {
        return;
    }

    subjectsTable.innerHTML = `
        <tr>
            <td colspan="4" class="sa-empty">
                Loading subjects...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("subjects")
            .select("*")
            .order(
                "name",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "Subjects error:",
            error
        );

        subjectsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Failed to load subjects.
                </td>
            </tr>
        `;

        return;

    }

    cachedSubjects =
        data || [];

    renderSubjects();

    renderResultSubjectSelect();

}


function renderSubjects() {

    if (!subjectsTable) {
        return;
    }

    if (!cachedSubjects.length) {

        subjectsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    No subjects yet.
                </td>
            </tr>
        `;

        return;

    }

    subjectsTable.innerHTML =
        cachedSubjects.map(
            subject => {

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                subject.code ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                subject.name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                subject.created_at
                            )}
                        </td>

                        <td>

                            <button
                                class="small-button danger"
                                data-delete-subject="${escapeHTML(
                                    subject.id
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// ADD SUBJECT
// ============================================================

if (addSubjectButton) {

    addSubjectButton.addEventListener(
        "click",
        async () => {

            const name =
                subjectName.value.trim();

            const code =
                subjectCode.value
                    .trim()
                    .toUpperCase();

            if (!name || !code) {

                showMessage(
                    "Enter the subject name and code.",
                    "warning"
                );

                return;

            }

            addSubjectButton.disabled =
                true;

            const {
                error
            } =
                await supabase
                    .from("subjects")
                    .insert({
                        name,
                        code
                    });

            addSubjectButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            subjectName.value =
                "";

            subjectCode.value =
                "";

            showMessage(
                "Subject added successfully."
            );

            await loadSubjects();

        }
    );

}


// ============================================================
// DELETE SUBJECT
// ============================================================

if (subjectsTable) {

    subjectsTable.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-delete-subject]"
                );

            if (!button) {
                return;
            }

            const id =
                button.dataset.deleteSubject;

            const confirmed =
                window.confirm(
                    "Delete this subject?"
                );

            if (!confirmed) {
                return;
            }

            const {
                error
            } =
                await supabase
                    .from("subjects")
                    .delete()
                    .eq(
                        "id",
                        id
                    );

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            showMessage(
                "Subject deleted."
            );

            await loadSubjects();

            await loadCombinations();

        }
    );

}


// ============================================================
// COMBINATIONS
// ============================================================

async function loadCombinations() {

    if (!combinationsTable) {
        return;
    }

    combinationsTable.innerHTML = `
        <tr>
            <td colspan="4" class="sa-empty">
                Loading combinations...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from(
                "subject_combinations"
            )
            .select(`
                id,
                name,
                description,
                created_at,
                combination_subjects (
                    subject_id,
                    subjects (
                        id,
                        name,
                        code
                    )
                )
            `)
            .order(
                "name",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "Combination error:",
            error
        );

        combinationsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Failed to load combinations.
                </td>
            </tr>
        `;

        return;

    }

    cachedCombinations =
        data || [];

    renderCombinations();

    renderCombinationSelect();

}


function renderCombinations() {

    if (!combinationsTable) {
        return;
    }

    if (!cachedCombinations.length) {

        combinationsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    No combinations created yet.
                </td>
            </tr>
        `;

        return;

    }

    combinationsTable.innerHTML =
        cachedCombinations.map(
            combination => {

                const subjects =
                    (
                        combination
                            .combination_subjects ||
                        []
                    )
                    .map(
                        row =>
                            row.subjects
                    )
                    .filter(Boolean);

                const subjectText =
                    subjects.length
                        ? subjects
                            .map(
                                subject =>
                                    `${escapeHTML(
                                        subject.code
                                    )} - ${escapeHTML(
                                        subject.name
                                    )}`
                            )
                            .join(", ")
                        : "No subjects assigned";

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                combination.name
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                combination.description ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${subjectText}
                        </td>

                        <td>

                            <button
                                class="small-button danger"
                                data-delete-combination="${escapeHTML(
                                    combination.id
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


function renderCombinationSelect() {

    if (!studentCombination) {
        return;
    }

    studentCombination.innerHTML = `
        <option value="">
            Select combination
        </option>
    `;

    cachedCombinations.forEach(
        combination => {

            studentCombination.innerHTML += `
                <option
                    value="${escapeHTML(
                        combination.id
                    )}">

                    ${escapeHTML(
                        combination.name
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// CREATE COMBINATION
// ============================================================

if (addCombinationButton) {

    addCombinationButton.addEventListener(
        "click",
        async () => {

            const name =
                combinationName.value.trim();

            const description =
                combinationDescription.value.trim();

            if (!name) {

                showMessage(
                    "Enter a combination name.",
                    "warning"
                );

                return;

            }

            addCombinationButton.disabled =
                true;

            /*
             * The current HTML does not contain subject
             * checkboxes for a new combination.
             *
             * Therefore this creates the combination first.
             * Subjects can be attached later through the
             * combination_subjects table or an improved UI.
             */

            const {
                error
            } =
                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .insert({
                        name,
                        description
                    });

            addCombinationButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            combinationName.value =
                "";

            combinationDescription.value =
                "";

            showMessage(
                "Combination created successfully."
            );

            await loadCombinations();

        }
    );

}


// ============================================================
// DELETE COMBINATION
// ============================================================

if (combinationsTable) {

    combinationsTable.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-delete-combination]"
                );

            if (!button) {
                return;
            }

            const id =
                button.dataset.deleteCombination;

            const confirmed =
                window.confirm(
                    "Delete this combination?"
                );

            if (!confirmed) {
                return;
            }

            const {
                error
            } =
                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    );

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            showMessage(
                "Combination deleted."
            );

            await loadCombinations();

        }
    );

}


// ============================================================
// ASSIGN STUDENT COMBINATION
// ============================================================

if (assignCombinationButton) {

    assignCombinationButton.addEventListener(
        "click",
        async () => {

            const studentId =
                combinationStudent.value;

            const combinationId =
                studentCombination.value;

            if (
                !studentId ||
                !combinationId
            ) {

                showMessage(
                    "Select a student and combination.",
                    "warning"
                );

                return;

            }

            assignCombinationButton.disabled =
                true;

            const {
                error
            } =
                await supabase.rpc(
                    "assign_student_combination",
                    {
                        target_student_id:
                            studentId,

                        target_combination_id:
                            combinationId
                    }
                );

            assignCombinationButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            combinationStudent.value =
                "";

            studentCombination.value =
                "";

            showMessage(
                "Student combination updated."
            );

        }
    );

}


// ============================================================
// EXAMS
// ============================================================

async function loadExams() {

    if (!examsTable) {
        return;
    }

    examsTable.innerHTML = `
        <tr>
            <td colspan="6" class="sa-empty">
                Loading exams...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("exams")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Exam error:",
            error
        );

        examsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    Failed to load exams.
                </td>
            </tr>
        `;

        return;

    }

    cachedExams =
        data || [];

    renderExams();

    renderExamSelect();

}


function renderExams() {

    if (!examsTable) {
        return;
    }

    if (!cachedExams.length) {

        examsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    No exams created.
                </td>
            </tr>
        `;

        return;

    }

    examsTable.innerHTML =
        cachedExams.map(
            exam => {

                const published =
                    exam.published ??
                    exam.is_published ??
                    false;

                const latest =
                    exam.is_latest ??
                    false;

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                exam.name
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                exam.term ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                exam.exam_date ||
                                "—"
                            )}
                        </td>

                        <td>

                            <span
                                class="sa-status ${
                                    published
                                        ? "approved"
                                        : "pending"
                                }">

                                ${
                                    published
                                        ? "Published"
                                        : "Draft"
                                }

                            </span>

                        </td>

                        <td>

                            ${
                                latest
                                    ? `
                                        <span class="latest-badge">
                                            Latest
                                        </span>
                                    `
                                    : "—"
                            }

                        </td>

                        <td>

                            ${
                                !published
                                    ? `
                                        <button
                                            class="small-button success"
                                            data-publish-exam="${escapeHTML(
                                                exam.id
                                            )}">

                                            Publish

                                        </button>
                                    `
                                    : `
                                        <button
                                            class="small-button"
                                            data-unpublish-exam="${escapeHTML(
                                                exam.id
                                            )}">

                                            Unpublish

                                        </button>
                                    `
                            }

                            ${
                                !latest
                                    ? `
                                        <button
                                            class="small-button"
                                            data-latest-exam="${escapeHTML(
                                                exam.id
                                            )}">

                                            Make Latest

                                        </button>
                                    `
                                    : ""
                            }

                            <button
                                class="small-button danger"
                                data-delete-exam="${escapeHTML(
                                    exam.id
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


function renderExamSelect() {

    if (!resultExam) {
        return;
    }

    resultExam.innerHTML = `
        <option value="">
            Select exam
        </option>
    `;

    cachedExams.forEach(
        exam => {

            resultExam.innerHTML += `
                <option
                    value="${escapeHTML(
                        exam.id
                    )}">

                    ${escapeHTML(
                        exam.name
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// CREATE EXAM
// ============================================================

if (createExamButton) {

    createExamButton.addEventListener(
        "click",
        async () => {

            const name =
                examName.value.trim();

            const academicYear =
                Number(
                    examYear.value
                );

            const term =
                examTerm.value.trim();

            const date =
                examDate.value ||
                null;

            const description =
                examDescription.value.trim();

            if (!name) {

                showMessage(
                    "Enter an exam name.",
                    "warning"
                );

                return;

            }

            if (
                examYear.value &&
                (
                    Number.isNaN(
                        academicYear
                    ) ||
                    academicYear < 2000
                )
            ) {

                showMessage(
                    "Enter a valid academic year.",
                    "warning"
                );

                return;

            }

            createExamButton.disabled =
                true;

            const {
                error
            } =
                await supabase
                    .from("exams")
                    .insert({
                        name,

                        academic_year:
                            examYear.value
                                ? academicYear
                                : null,

                        term,

                        exam_date:
                            date,

                        description
                    });

            createExamButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            examName.value =
                "";

            examYear.value =
                "";

            examTerm.value =
                "";

            examDate.value =
                "";

            examDescription.value =
                "";

            showMessage(
                "Exam created successfully."
            );

            await loadExams();

        }
    );

}


// ============================================================
// EXAM ACTIONS
// ============================================================

if (examsTable) {

    examsTable.addEventListener(
        "click",
        async event => {

            const publishButton =
                event.target.closest(
                    "[data-publish-exam]"
                );

            if (publishButton) {

                await updateExamPublished(
                    publishButton.dataset
                        .publishExam,
                    true
                );

                return;

            }

            const unpublishButton =
                event.target.closest(
                    "[data-unpublish-exam]"
                );

            if (unpublishButton) {

                await updateExamPublished(
                    unpublishButton.dataset
                        .unpublishExam,
                    false
                );

                return;

            }

            const latestButton =
                event.target.closest(
                    "[data-latest-exam]"
                );

            if (latestButton) {

                await setLatestExam(
                    latestButton.dataset
                        .latestExam
                );

                return;

            }

            const deleteButton =
                event.target.closest(
                    "[data-delete-exam]"
                );

            if (deleteButton) {

                await deleteExam(
                    deleteButton.dataset
                        .deleteExam
                );

            }

        }
    );

}


// ============================================================
// PUBLISH / UNPUBLISH EXAM
// ============================================================

async function updateExamPublished(
    examId,
    published
) {

    const {
        error
    } =
        await supabase
            .from("exams")
            .update({
                published
            })
            .eq(
                "id",
                examId
            );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        published
            ? "Exam published."
            : "Exam unpublished."
    );

    await loadExams();

}


// ============================================================
// SET LATEST EXAM
// ============================================================

async function setLatestExam(
    examId
) {

    const {
        error
    } =
        await supabase.rpc(
            "set_latest_exam",
            {
                target_exam_id:
                    examId
            }
        );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        "Latest exam updated."
    );

    await loadExams();

}


// ============================================================
// DELETE EXAM
// ============================================================

async function deleteExam(
    examId
) {

    const confirmed =
        window.confirm(
            "Delete this exam and its results?"
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from("exams")
            .delete()
            .eq(
                "id",
                examId
            );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        "Exam deleted."
    );

    await loadExams();

    await loadResults();

}


// ============================================================
// RESULT SUBJECT SELECT
// ============================================================

function renderResultSubjectSelect() {

    if (!resultSubject) {
        return;
    }

    resultSubject.innerHTML = `
        <option value="">
            Select subject
        </option>
    `;

    cachedSubjects.forEach(
        subject => {

            resultSubject.innerHTML += `
                <option
                    value="${escapeHTML(
                        subject.id
                    )}">

                    ${escapeHTML(
                        subject.code
                    )}
                    -
                    ${escapeHTML(
                        subject.name
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// SAVE RESULT
// ============================================================

if (saveResultButton) {

    saveResultButton.addEventListener(
        "click",
        async () => {

            const examId =
                resultExam.value;

            const studentId =
                resultStudent.value;

            const subjectId =
                resultSubject.value;

            const score =
                Number(
                    resultScore.value
                );

            const maxScore =
                Number(
                    resultMaxScore.value
                );

            const comment =
                resultComment.value.trim();

            if (
                !examId ||
                !studentId ||
                !subjectId
            ) {

                showMessage(
                    "Select an exam, student and subject.",
                    "warning"
                );

                return;

            }

            if (
                Number.isNaN(score) ||
                Number.isNaN(maxScore) ||
                maxScore <= 0 ||
                score < 0 ||
                score > maxScore
            ) {

                showMessage(
                    "Enter a valid score.",
                    "warning"
                );

                return;

            }

            saveResultButton.disabled =
                true;

            const {
                error
            } =
                await supabase
                    .from(
                        "exam_results"
                    )
                    .upsert(
                        {
                            exam_id:
                                examId,

                            student_id:
                                studentId,

                            subject_id:
                                subjectId,

                            score,

                            max_score:
                                maxScore,

                            teacher_comment:
                                comment
                        },
                        {
                            onConflict:
                                "exam_id,student_id,subject_id"
                        }
                    );

            saveResultButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            resultScore.value =
                "";

            resultComment.value =
                "";

            resultMaxScore.value =
                "100";

            showMessage(
                "Result saved successfully."
            );

            await loadResults();

        }
    );

}


// ============================================================
// LOAD RESULTS
// ============================================================

async function loadResults() {

    if (!resultsTable) {
        return;
    }

    resultsTable.innerHTML = `
        <tr>
            <td colspan="6" class="sa-empty">
                Loading results...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from(
                "exam_results"
            )
            .select(`
                id,
                exam_id,
                student_id,
                subject_id,
                score,
                max_score,
                teacher_comment,
                exams (
                    id,
                    name
                ),
                students (
                    id,
                    full_name,
                    admission_number
                ),
                subjects (
                    id,
                    name,
                    code
                )
            `)
            .order(
                "id",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Results error:",
            error
        );

        resultsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    Failed to load results.
                </td>
            </tr>
        `;

        return;

    }

    cachedResults =
        data || [];

    renderResults();

}


function renderResults() {

    if (!resultsTable) {
        return;
    }

    if (!cachedResults.length) {

        resultsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    No results entered yet.
                </td>
            </tr>
        `;

        return;

    }

    resultsTable.innerHTML =
        cachedResults.map(
            result => {

                const percentage =
                    result.max_score > 0
                        ? (
                            result.score /
                            result.max_score
                        ) * 100
                        : 0;

                const grade =
                    getGradeFromPercentage(
                        percentage
                    );

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                result.exams?.name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                result.students?.full_name ||
                                result.students?.admission_number ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                result.subjects?.code ||
                                result.subjects?.name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                result.score
                            )}
                            /
                            ${escapeHTML(
                                result.max_score
                            )}
                        </td>

                        <td>
                            <strong>
                                ${escapeHTML(
                                    grade
                                )}
                            </strong>
                        </td>

                        <td>

                            <button
                                class="small-button danger"
                                data-delete-result="${escapeHTML(
                                    result.id
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


function getGradeFromPercentage(
    percentage
) {

    const sorted =
        [...gradingRows]
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.minimum_mark
                    ) -
                    Number(
                        a.minimum_mark
                    )
            );

    for (
        const row of sorted
    ) {

        if (
            percentage >=
            Number(
                row.minimum_mark
            )
        ) {

            return row.grade;

        }

    }

    return "—";

}


// ============================================================
// DELETE RESULT
// ============================================================

if (resultsTable) {

    resultsTable.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-delete-result]"
                );

            if (!button) {
                return;
            }

            const id =
                button.dataset.deleteResult;

            const confirmed =
                window.confirm(
                    "Delete this result?"
                );

            if (!confirmed) {
                return;
            }

            const {
                error
            } =
                await supabase
                    .from(
                        "exam_results"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    );

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            showMessage(
                "Result deleted."
            );

            await loadResults();

        }
    );

}


// ============================================================
// DOCUMENTS
// ============================================================

async function loadDocuments() {

    if (!documentsTable) {
        return;
    }

    documentsTable.innerHTML = `
        <tr>
            <td colspan="6" class="sa-empty">
                Loading documents...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from("documents")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Documents error:",
            error
        );

        documentsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    Failed to load documents.
                </td>
            </tr>
        `;

        return;

    }

    cachedDocuments =
        data || [];

    renderDocuments();

}


function renderDocuments() {

    if (!documentsTable) {
        return;
    }

    if (!cachedDocuments.length) {

        documentsTable.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    No documents uploaded.
                </td>
            </tr>
        `;

        return;

    }

    documentsTable.innerHTML =
        cachedDocuments.map(
            document => {

                const publicUrl =
                    document.storage_path
                        ? supabase.storage
                            .from(
                                "grade-hub-documents"
                            )
                            .getPublicUrl(
                                document.storage_path
                            )
                            .data.publicUrl
                        : null;

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                document.title ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                document.category ||
                                "—"
                            )}
                        </td>

                        <td>

                            ${
                                publicUrl
                                    ? `
                                        <a
                                            href="${escapeHTML(
                                                publicUrl
                                            )}"
                                            target="_blank"
                                            rel="noopener noreferrer">

                                            ${escapeHTML(
                                                document.file_name ||
                                                "Open file"
                                            )}

                                        </a>
                                    `
                                    : "—"
                            }

                        </td>

                        <td>
                            ${formatDate(
                                document.created_at
                            )}
                        </td>

                        <td>

                            <span
                                class="sa-status ${
                                    document.published
                                        ? "approved"
                                        : "pending"
                                }">

                                ${
                                    document.published
                                        ? "Published"
                                        : "Hidden"
                                }

                            </span>

                        </td>

                        <td>

                            <button
                                class="small-button"
                                data-toggle-document="${escapeHTML(
                                    document.id
                                )}"
                                data-current-status="${document.published}">

                                ${
                                    document.published
                                        ? "Hide"
                                        : "Publish"
                                }

                            </button>

                            <button
                                class="small-button danger"
                                data-delete-document="${escapeHTML(
                                    document.id
                                )}"
                                data-storage-path="${escapeHTML(
                                    document.storage_path ||
                                    ""
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// UPLOAD DOCUMENT
// ============================================================

if (uploadDocumentButton) {

    uploadDocumentButton.addEventListener(
        "click",
        async () => {

            const title =
                documentTitle.value.trim();

            const description =
                documentDescription.value.trim();

            const category =
                documentCategory.value;

            const file =
                documentFile.files[0];

            if (!title) {

                showMessage(
                    "Enter a document title.",
                    "warning"
                );

                return;

            }

            if (!file) {

                showMessage(
                    "Choose a file first.",
                    "warning"
                );

                return;

            }

            const safeName =
                file.name.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

            const storagePath =
                Date.now() +
                "_" +
                safeName;

            uploadDocumentButton.disabled =
                true;

            const {
                error: uploadError
            } =
                await supabase
                    .storage
                    .from(
                        "grade-hub-documents"
                    )
                    .upload(
                        storagePath,
                        file
                    );

            if (uploadError) {

                uploadDocumentButton.disabled =
                    false;

                console.error(
                    uploadError
                );

                showMessage(
                    uploadError.message,
                    "error"
                );

                return;

            }

            const {
                error: databaseError
            } =
                await supabase
                    .from("documents")
                    .insert({
                        title,

                        description,

                        category,

                        file_name:
                            file.name,

                        storage_path:
                            storagePath,

                        file_type:
                            file.type,

                        file_size:
                            file.size,

                        published:
                            true
                    });

            uploadDocumentButton.disabled =
                false;

            if (databaseError) {

                console.error(
                    databaseError
                );

                await supabase
                    .storage
                    .from(
                        "grade-hub-documents"
                    )
                    .remove([
                        storagePath
                    ]);

                showMessage(
                    databaseError.message,
                    "error"
                );

                return;

            }

            documentTitle.value =
                "";

            documentDescription.value =
                "";

            documentFile.value =
                "";

            showMessage(
                "Document uploaded successfully."
            );

            await loadDocuments();

        }
    );

}


// ============================================================
// DOCUMENT BUTTONS
// ============================================================

if (documentsTable) {

    documentsTable.addEventListener(
        "click",
        async event => {

            const toggleButton =
                event.target.closest(
                    "[data-toggle-document]"
                );

            if (toggleButton) {

                await toggleDocument(
                    toggleButton.dataset
                        .toggleDocument,

                    toggleButton.dataset
                        .currentStatus ===
                    "true"
                );

                return;

            }

            const deleteButton =
                event.target.closest(
                    "[data-delete-document]"
                );

            if (deleteButton) {

                await deleteDocument(
                    deleteButton.dataset
                        .deleteDocument,

                    deleteButton.dataset
                        .storagePath
                );

            }

        }
    );

}


// ============================================================
// TOGGLE DOCUMENT
// ============================================================

async function toggleDocument(
    id,
    currentStatus
) {

    const {
        error
    } =
        await supabase
            .from("documents")
            .update({
                published:
                    !currentStatus
            })
            .eq(
                "id",
                id
            );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        currentStatus
            ? "Document hidden."
            : "Document published."
    );

    await loadDocuments();

}


// ============================================================
// DELETE DOCUMENT
// ============================================================

async function deleteDocument(
    id,
    storagePath
) {

    const confirmed =
        window.confirm(
            "Delete this document?"
        );

    if (!confirmed) {
        return;
    }

    if (storagePath) {

        const {
            error
        } =
            await supabase
                .storage
                .from(
                    "grade-hub-documents"
                )
                .remove([
                    storagePath
                ]);

        if (error) {

            console.warn(
                "Storage deletion:",
                error
            );

        }

    }

    const {
        error
    } =
        await supabase
            .from("documents")
            .delete()
            .eq(
                "id",
                id
            );

    if (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

        return;

    }

    showMessage(
        "Document deleted."
    );

    await loadDocuments();

}


// ============================================================
// ANNOUNCEMENTS
// ============================================================

async function loadAnnouncements() {

    if (!announcementsTable) {
        return;
    }

    announcementsTable.innerHTML = `
        <tr>
            <td colspan="4" class="sa-empty">
                Loading announcements...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } =
        await supabase
            .from(
                "announcements"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Announcement error:",
            error
        );

        announcementsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Failed to load announcements.
                </td>
            </tr>
        `;

        return;

    }

    cachedAnnouncements =
        data || [];

    renderAnnouncements();

}


function renderAnnouncements() {

    if (!announcementsTable) {
        return;
    }

    if (!cachedAnnouncements.length) {

        announcementsTable.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    No announcements yet.
                </td>
            </tr>
        `;

        return;

    }

    announcementsTable.innerHTML =
        cachedAnnouncements.map(
            announcement => {

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                announcement.title
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                announcement.message
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                announcement.created_at
                            )}
                        </td>

                        <td>

                            <button
                                class="small-button danger"
                                data-delete-announcement="${escapeHTML(
                                    announcement.id
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// ADD ANNOUNCEMENT
// ============================================================

if (addAnnouncementButton) {

    addAnnouncementButton.addEventListener(
        "click",
        async () => {

            const title =
                announcementTitle.value.trim();

            const message =
                announcementMessage.value.trim();

            if (!title || !message) {

                showMessage(
                    "Enter an announcement title and message.",
                    "warning"
                );

                return;

            }

            addAnnouncementButton.disabled =
                true;

            const {
                error
            } =
                await supabase
                    .from(
                        "announcements"
                    )
                    .insert({
                        title,

                        message,

                        published:
                            true
                    });

            addAnnouncementButton.disabled =
                false;

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            announcementTitle.value =
                "";

            announcementMessage.value =
                "";

            showMessage(
                "Announcement published."
            );

            await loadAnnouncements();

        }
    );

}


// ============================================================
// DELETE ANNOUNCEMENT
// ============================================================

if (announcementsTable) {

    announcementsTable.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-delete-announcement]"
                );

            if (!button) {
                return;
            }

            const id =
                button.dataset
                    .deleteAnnouncement;

            const confirmed =
                window.confirm(
                    "Delete this announcement?"
                );

            if (!confirmed) {
                return;
            }

            const {
                error
            } =
                await supabase
                    .from(
                        "announcements"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    );

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            showMessage(
                "Announcement deleted."
            );

            await loadAnnouncements();

        }
    );

}


// ============================================================
// GRADING SYSTEM
// ============================================================

async function loadGradingSystem() {

    if (!gradingTable) {
        return;
    }

    /*
     * Try to load the grading configuration from
     * the grading_system table.
     */

    const {
        data,
        error
    } =
        await supabase
            .from(
                "grading_system"
            )
            .select("*")
            .order(
                "minimum_mark",
                {
                    ascending: false
                }
            );

    if (error) {

        console.warn(
            "Grading table could not be loaded:",
            error
        );

        gradingRows =
            defaultGrades.map(
                row => ({
                    ...row
                })
            );

        renderGradingSystem();

        return;

    }

    gradingRows =
        data && data.length
            ? data
            : defaultGrades.map(
                row => ({
                    ...row
                })
            );

    renderGradingSystem();

}


function renderGradingSystem() {

    if (!gradingTable) {
        return;
    }

    gradingTable.innerHTML =
        gradingRows.map(
            (row, index) => {

                return `
                    <tr>

                        <td>

                            <input
                                class="grading-input"
                                data-grade-field="grade"
                                data-index="${index}"
                                value="${escapeHTML(
                                    row.grade ||
                                    ""
                                )}">

                        </td>

                        <td>

                            <input
                                class="grading-input grade-number"
                                type="number"
                                min="0"
                                max="100"
                                data-grade-field="minimum_mark"
                                data-index="${index}"
                                value="${escapeHTML(
                                    row.minimum_mark ??
                                    0
                                )}">

                        </td>

                        <td>

                            <input
                                class="grading-input grade-points"
                                type="number"
                                min="0"
                                step="0.01"
                                data-grade-field="points"
                                data-index="${index}"
                                value="${escapeHTML(
                                    row.points ??
                                    0
                                )}">

                        </td>

                        <td>

                            <input
                                class="grading-input"
                                data-grade-field="description"
                                data-index="${index}"
                                value="${escapeHTML(
                                    row.description ||
                                    ""
                                )}">

                        </td>

                        <td>

                            <button
                                class="small-button danger"
                                data-delete-grade="${index}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// GRADING INPUT CHANGES
// ============================================================

if (gradingTable) {

    gradingTable.addEventListener(
        "input",
        event => {

            const input =
                event.target.closest(
                    "[data-grade-field]"
                );

            if (!input) {
                return;
            }

            const index =
                Number(
                    input.dataset.index
                );

            const field =
                input.dataset.gradeField;

            if (
                !gradingRows[index]
            ) {
                return;
            }

            if (
                field ===
                "minimum_mark" ||
                field ===
                "points"
            ) {

                gradingRows[index][field] =
                    Number(
                        input.value
                    );

            }
            else {

                gradingRows[index][field] =
                    input.value;

            }

        }
    );

}


// ============================================================
// DELETE GRADE
// ============================================================

if (gradingTable) {

    gradingTable.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-delete-grade]"
                );

            if (!button) {
                return;
            }

            const index =
                Number(
                    button.dataset.deleteGrade
                );

            gradingRows.splice(
                index,
                1
            );

            renderGradingSystem();

        }
    );

}


// ============================================================
// ADD GRADE
// ============================================================

if (addGradeButton) {

    addGradeButton.addEventListener(
        "click",
        () => {

            gradingRows.push({
                grade: "",
                minimum_mark: 0,
                points: 0,
                description: ""
            });

            renderGradingSystem();

        }
    );

}


// ============================================================
// RESET GRADES
// ============================================================

if (resetGradesButton) {

    resetGradesButton.addEventListener(
        "click",
        () => {

            const confirmed =
                window.confirm(
                    "Reset the grading system to the default values?"
                );

            if (!confirmed) {
                return;
            }

            gradingRows =
                defaultGrades.map(
                    row => ({
                        ...row
                    })
                );

            renderGradingSystem();

        }
    );

}


// ============================================================
// SAVE GRADES
// ============================================================

if (saveGradesButton) {

    saveGradesButton.addEventListener(
        "click",
        async () => {

            if (!gradingRows.length) {

                showMessage(
                    "Add at least one grade.",
                    "warning"
                );

                return;

            }

            const valid =
                gradingRows.every(
                    row =>
                        row.grade &&
                        Number(
                            row.minimum_mark
                        ) >= 0 &&
                        Number(
                            row.points
                        ) >= 0
                );

            if (!valid) {

                showMessage(
                    "Check all grading values before saving.",
                    "warning"
                );

                return;

            }

            saveGradesButton.disabled =
                true;

            /*
             * Replace the existing grading configuration.
             */

            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "grading_system"
                    )
                    .delete()
                    .neq(
                        "id",
                        "00000000-0000-0000-0000-000000000000"
                    );

            if (deleteError) {

                saveGradesButton.disabled =
                    false;

                console.error(
                    deleteError
                );

                showMessage(
                    deleteError.message,
                    "error"
                );

                return;

            }

            const rows =
                gradingRows.map(
                    row => ({
                        grade:
                            row.grade,

                        minimum_mark:
                            Number(
                                row.minimum_mark
                            ),

                        points:
                            Number(
                                row.points
                            ),

                        description:
                            row.description ||
                            ""
                    })
                );

            const {
                error: insertError
            } =
                await supabase
                    .from(
                        "grading_system"
                    )
                    .insert(rows);

            saveGradesButton.disabled =
                false;

            if (insertError) {

                console.error(
                    insertError
                );

                showMessage(
                    insertError.message,
                    "error"
                );

                return;

            }

            showMessage(
                "Grading system saved successfully."
            );

            await loadGradingSystem();

        }
    );

}


// ============================================================
// LOGOUT
// ============================================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            const confirmed =
                window.confirm(
                    "Are you sure you want to sign out?"
                );

            if (!confirmed) {
                return;
            }

            logoutButton.disabled =
                true;

            logoutButton.textContent =
                "Signing out...";

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Sign out";

                return;

            }

            window.location.href =
                "index.html";

        }
    );

}


// ============================================================
// REFRESH
// ============================================================

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;

            refreshButton.textContent =
                "Refreshing...";

            await loadDashboard();

            refreshButton.disabled =
                false;

            refreshButton.textContent =
                "Refresh";

        }
    );

}


// ============================================================
// DASHBOARD LOAD
// ============================================================

async function loadDashboard() {

    const user =
        await checkSuperAdmin();

    if (!user) {
        return;
    }

    try {

        await Promise.all([

            loadAdminRequests(),

            loadApprovedAdmins(),

            loadStudents(),

            loadSubjects(),

            loadCombinations(),

            loadExams(),

            loadResults(),

            loadDocuments(),

            loadAnnouncements(),

            loadGradingSystem()

        ]);

    }
    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        showMessage(
            error.message ||
            "Dashboard loading failed.",
            "error"
        );

    }

}


// ============================================================
// START
// ============================================================

loadDashboard();
