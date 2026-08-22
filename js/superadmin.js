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

const totalSubjects =
    document.getElementById("totalSubjects");

const totalExams =
    document.getElementById("totalExams");


// Existing admin system
const adminRequests =
    document.getElementById("adminRequests");

const approvedAdmins =
    document.getElementById("approvedAdmins");

const studentsTable =
    document.getElementById("studentsTable");


// Subjects
const subjectForm =
    document.getElementById("subjectForm");

const subjectName =
    document.getElementById("subjectName");

const subjectCode =
    document.getElementById("subjectCode");

const subjectsTable =
    document.getElementById("subjectsTable");


// Combinations
const combinationForm =
    document.getElementById("combinationForm");

const combinationName =
    document.getElementById("combinationName");

const combinationDescription =
    document.getElementById(
        "combinationDescription"
    );

const combinationSubjects =
    document.getElementById(
        "combinationSubjects"
    );

const combinationsList =
    document.getElementById(
        "combinationsList"
    );


// Student combination
const studentCombinationForm =
    document.getElementById(
        "studentCombinationForm"
    );

const combinationStudent =
    document.getElementById(
        "combinationStudent"
    );

const studentCombination =
    document.getElementById(
        "studentCombination"
    );


// Exams
const examForm =
    document.getElementById("examForm");

const examName =
    document.getElementById("examName");

const examYear =
    document.getElementById("examYear");

const examTerm =
    document.getElementById("examTerm");

const examDate =
    document.getElementById("examDate");

const examsTable =
    document.getElementById("examsTable");


// Results
const resultForm =
    document.getElementById("resultForm");

const resultExam =
    document.getElementById("resultExam");

const resultStudent =
    document.getElementById("resultStudent");

const resultSubject =
    document.getElementById("resultSubject");

const resultScore =
    document.getElementById("resultScore");

const resultMaxScore =
    document.getElementById("resultMaxScore");

const resultComment =
    document.getElementById("resultComment");


// Documents
const documentForm =
    document.getElementById("documentForm");

const documentTitle =
    document.getElementById("documentTitle");

const documentCategory =
    document.getElementById("documentCategory");

const documentDescription =
    document.getElementById(
        "documentDescription"
    );

const documentFile =
    document.getElementById("documentFile");

const documentsTable =
    document.getElementById("documentsTable");


// Announcements
const announcementForm =
    document.getElementById(
        "announcementForm"
    );

const announcementTitle =
    document.getElementById(
        "announcementTitle"
    );

const announcementMessage =
    document.getElementById(
        "announcementMessage"
    );

const announcementsList =
    document.getElementById(
        "announcementsList"
    );


// ============================================================
// CACHE
// ============================================================

let cachedStudents = [];

let cachedSubjects = [];

let cachedCombinations = [];

let cachedExams = [];


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
// AUTHENTICATION
// ============================================================

async function checkLogin() {

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

    if (error) {

        console.error(
            "Auth error:",
            error
        );

        return null;

    }

    if (!data.user) {

        return null;

    }

    return data.user;

}


// ============================================================
// SUPER ADMIN CHECK
// ============================================================

async function checkSuperAdmin() {

    const user =
        await checkLogin();

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
            "Role error:",
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
// LOAD APPROVED ADMINISTRATORS
// ============================================================

async function loadApprovedAdmins() {

    if (!approvedAdmins) {
        return;
    }

    approvedAdmins.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="empty">

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
                <td
                    colspan="4"
                    class="empty">

                    Failed to load administrators.

                </td>
            </tr>
        `;

        return;

    }

    if (!data || data.length === 0) {

        if (totalAdmins) {
            totalAdmins.textContent =
                "0";
        }

        approvedAdmins.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty">

                    No approved administrators.

                </td>
            </tr>
        `;

        return;

    }

    const userIds =
        data.map(
            row =>
                row.user_id
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

    if (totalAdmins) {

        totalAdmins.textContent =
            data.length;

    }

    approvedAdmins.innerHTML =
        data.map(row => {

            const profile =
                profileMap[
                    row.user_id
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
                            class="status published">

                            Approved

                        </span>

                    </td>

                </tr>
            `;

        }).join("");

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
            <td
                colspan="6"
                class="empty">

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
                <td
                    colspan="6"
                    class="empty">

                    Failed to load requests.

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

    const pendingElement =
        document.getElementById(
            "pendingAdmins"
        );

    if (pendingElement) {

        pendingElement.textContent =
            pending.length;

    }

    if (!requests.length) {

        adminRequests.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="empty">

                    No administrator requests.

                </td>
            </tr>
        `;

        return;

    }

    adminRequests.innerHTML =
        requests.map(request => {

            let actions =
                "—";

            if (
                request.status ===
                "pending"
            ) {

                actions = `

                    <button
                        class="secondary-button"
                        data-action="approve"
                        data-id="${escapeHTML(
                            request.id
                        )}">

                        Approve

                    </button>

                    <button
                        class="danger-button"
                        data-action="reject"
                        data-id="${escapeHTML(
                            request.id
                        )}">

                        Reject

                    </button>

                `;

            }

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
                            class="status ${
                                request.status ===
                                "approved"
                                    ? "published"
                                    : "unpublished"
                            }">

                            ${escapeHTML(
                                request.status ||
                                "unknown"
                            )}

                        </span>

                    </td>

                    <td>
                        ${actions}
                    </td>

                </tr>
            `;

        }).join("");

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

    try {

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
            throw error;
        }

        showMessage(
            "Administrator approved successfully."
        );

        await loadAdminRequests();

        await loadApprovedAdmins();

    }
    catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Approval failed.",
            "error"
        );

    }

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

                await approveAdmin(
                    id
                );

            }

            if (
                action ===
                "reject"
            ) {

                await rejectAdmin(
                    id
                );

            }

            button.disabled =
                false;

        }
    );

}


// ============================================================
// LOAD STUDENTS
// ============================================================

async function loadStudents() {

    if (!studentsTable) {
        return;
    }

    studentsTable.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="empty">

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

        studentsTable.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty">

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

    await loadStudentProfiles();

    renderStudentSelects();

    if (!cachedStudents.length) {

        studentsTable.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty">

                    No students found.

                </td>
            </tr>
        `;

        return;

    }

    studentsTable.innerHTML =
        cachedStudents.map(
            student => {

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
                                student.email ||
                                "—"
                            )}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// LOAD STUDENT PROFILES
// ============================================================

async function loadStudentProfiles() {

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
                        "",
                    username:
                        profile.username ||
                        "",
                    email:
                        profile.email ||
                        ""
                };

            }
        );

}


// ============================================================
// STUDENT SELECTS
// ============================================================

function renderStudentSelects() {

    const selects = [
        combinationStudent,
        resultStudent
    ];

    selects.forEach(select => {

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
                        value="${student.id}">

                        ${escapeHTML(
                            student.full_name ||
                            student.admission_number ||
                            student.email ||
                            "Student"
                        )}

                    </option>
                `;

            }
        );

    });

}


// ============================================================
// LOAD SUBJECTS
// ============================================================

async function loadSubjects() {

    const {
        data,
        error
    } =
        await supabase
            .from("subjects")
            .select("*")
            .order("name");

    if (error) {

        console.error(
            "Subjects error:",
            error
        );

        showMessage(
            "Could not load subjects.",
            "error"
        );

        return;

    }

    cachedSubjects =
        data || [];

    if (totalSubjects) {

        totalSubjects.textContent =
            cachedSubjects.length;

    }

    renderSubjects();

    renderSubjectCheckboxes();

    renderResultSubjectSelect();

}


// ============================================================
// DISPLAY SUBJECTS
// ============================================================

function renderSubjects() {

    if (!subjectsTable) {
        return;
    }

    if (!cachedSubjects.length) {

        subjectsTable.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty">

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
                                subject.code
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                subject.name
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                subject.created_at
                            )}
                        </td>

                        <td>

                            <button
                                class="danger-button"
                                data-delete-subject="${subject.id}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// SUBJECT CHECKBOXES
// ============================================================

function renderSubjectCheckboxes() {

    if (!combinationSubjects) {
        return;
    }

    if (!cachedSubjects.length) {

        combinationSubjects.textContent =
            "No subjects available.";

        return;

    }

    combinationSubjects.innerHTML =
        cachedSubjects.map(
            subject => {

                return `
                    <label
                        class="checkbox-item">

                        <input
                            type="checkbox"
                            value="${subject.id}">

                        ${escapeHTML(
                            subject.code
                        )}
                        -
                        ${escapeHTML(
                            subject.name
                        )}

                    </label>
                `;

            }
        ).join("");

}


// ============================================================
// ADD SUBJECT
// ============================================================

if (subjectForm) {

    subjectForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                subjectName.value.trim();

            const code =
                subjectCode.value
                    .trim()
                    .toUpperCase();

            if (!name || !code) {

                showMessage(
                    "Enter subject name and code.",
                    "warning"
                );

                return;

            }

            const {
                error
            } =
                await supabase
                    .from("subjects")
                    .insert({
                        name,
                        code
                    });

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            subjectForm.reset();

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
// CREATE COMBINATION
// ============================================================

if (combinationForm) {

    combinationForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                combinationName.value
                    .trim();

            const description =
                combinationDescription.value
                    .trim();

            const selectedSubjects =
                [
                    ...document.querySelectorAll(
                        "#combinationSubjects input:checked"
                    )
                ].map(
                    input =>
                        input.value
                );

            if (!name) {

                showMessage(
                    "Enter a combination name.",
                    "warning"
                );

                return;

            }

            if (
                selectedSubjects.length ===
                0
            ) {

                showMessage(
                    "Select at least one subject.",
                    "warning"
                );

                return;

            }

            const {
                data: combination,
                error: combinationError
            } =
                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .insert({
                        name,
                        description
                    })
                    .select()
                    .single();

            if (combinationError) {

                console.error(
                    combinationError
                );

                showMessage(
                    combinationError.message,
                    "error"
                );

                return;

            }

            const rows =
                selectedSubjects.map(
                    subjectId => ({
                        combination_id:
                            combination.id,

                        subject_id:
                            subjectId
                    })
                );

            const {
                error:
                    subjectError
            } =
                await supabase
                    .from(
                        "combination_subjects"
                    )
                    .insert(rows);

            if (subjectError) {

                console.error(
                    subjectError
                );

                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .delete()
                    .eq(
                        "id",
                        combination.id
                    );

                showMessage(
                    subjectError.message,
                    "error"
                );

                return;

            }

            combinationForm.reset();

            showMessage(
                "Combination created successfully."
            );

            await loadCombinations();

        }
    );

}


// ============================================================
// LOAD COMBINATIONS
// ============================================================

async function loadCombinations() {

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
            .order("name");

    if (error) {

        console.error(
            "Combination error:",
            error
        );

        showMessage(
            "Could not load combinations.",
            "error"
        );

        return;

    }

    cachedCombinations =
        data || [];

    renderCombinations();

    renderCombinationSelect();

}


// ============================================================
// DISPLAY COMBINATIONS
// ============================================================

function renderCombinations() {

    if (!combinationsList) {
        return;
    }

    if (!cachedCombinations.length) {

        combinationsList.innerHTML = `
            <div class="sa-card">

                <div class="empty">

                    No combinations created yet.

                </div>

            </div>
        `;

        return;

    }

    combinationsList.innerHTML =
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

                return `
                    <div
                        class="combination-card">

                        <h4>
                            ${escapeHTML(
                                combination.name
                            )}
                        </h4>

                        <p>
                            ${escapeHTML(
                                combination.description ||
                                "No description"
                            )}
                        </p>

                        <div
                            class="subject-list">

                            ${
                                subjects.length

                                ?

                                subjects.map(
                                    subject => `
                                        <span
                                            class="subject-tag">

                                            ${escapeHTML(
                                                subject.code
                                            )}
                                            -
                                            ${escapeHTML(
                                                subject.name
                                            )}

                                        </span>
                                    `
                                ).join("")

                                :

                                `
                                    <span>
                                        No subjects
                                    </span>
                                `
                            }

                        </div>

                        <br>

                        <button
                            class="danger-button"
                            data-delete-combination="${combination.id}">

                            Delete

                        </button>

                    </div>
                `;

            }
        ).join("");

}


// ============================================================
// COMBINATION SELECT
// ============================================================

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
                    value="${combination.id}">

                    ${escapeHTML(
                        combination.name
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// DELETE COMBINATION
// ============================================================

if (combinationsList) {

    combinationsList.addEventListener(
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
                button.dataset
                    .deleteCombination;

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

if (studentCombinationForm) {

    studentCombinationForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

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

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            studentCombinationForm.reset();

            showMessage(
                "Student combination updated."
            );

        }
    );

}


// ============================================================
// CREATE EXAM
// ============================================================

if (examForm) {

    examForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                examName.value.trim();

            const academicYear =
                Number(
                    examYear.value
                );

            const term =
                examTerm.value;

            const date =
                examDate.value ||
                null;

            if (!name) {

                showMessage(
                    "Enter an exam name.",
                    "warning"
                );

                return;

            }

            const {
                error
            } =
                await supabase
                    .from("exams")
                    .insert({
                        name,

                        academic_year:
                            academicYear,

                        term,

                        exam_date:
                            date
                    });

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            examForm.reset();

            showMessage(
                "Exam created successfully."
            );

            await loadExams();

        }
    );

}


// ============================================================
// LOAD EXAMS
// ============================================================

async function loadExams() {

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

        showMessage(
            "Could not load exams.",
            "error"
        );

        return;

    }

    cachedExams =
        data || [];

    if (totalExams) {

        totalExams.textContent =
            cachedExams.length;

    }

    renderExams();

    renderExamSelect();

}


// ============================================================
// DISPLAY EXAMS
// ============================================================

function renderExams() {

    if (!examsTable) {
        return;
    }

    if (!cachedExams.length) {

        examsTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty">

                    No exams created.

                </td>
            </tr>
        `;

        return;

    }

    examsTable.innerHTML =
        cachedExams.map(
            exam => {

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

                            ${
                                exam.is_latest

                                ?

                                `
                                    <span
                                        class="status published">

                                        Latest

                                    </span>
                                `

                                :

                                `
                                    <span
                                        class="status unpublished">

                                        Normal

                                    </span>
                                `
                            }

                        </td>

                        <td>

                            ${
                                exam.is_latest

                                ?

                                ""

                                :

                                `
                                    <button
                                        class="primary-button"
                                        data-latest-exam="${exam.id}">

                                        Make Latest

                                    </button>
                                `
                            }

                            <button
                                class="danger-button"
                                data-delete-exam="${exam.id}">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ============================================================
// EXAM SELECT
// ============================================================

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
                    value="${exam.id}">

                    ${escapeHTML(
                        exam.name
                    )}

                </option>
            `;

        }
    );

}


// ============================================================
// EXAM BUTTONS
// ============================================================

if (examsTable) {

    examsTable.addEventListener(
        "click",
        async event => {

            const latestButton =
                event.target.closest(
                    "[data-latest-exam]"
                );

            if (latestButton) {

                const examId =
                    latestButton.dataset
                        .latestExam;

                await setLatestExam(
                    examId
                );

                return;

            }

            const deleteButton =
                event.target.closest(
                    "[data-delete-exam]"
                );

            if (deleteButton) {

                const examId =
                    deleteButton.dataset
                        .deleteExam;

                await deleteExam(
                    examId
                );

            }

        }
    );

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
                    value="${subject.id}">

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

if (resultForm) {

    resultForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

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
                    "Select exam, student and subject.",
                    "warning"
                );

                return;

            }

            if (
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

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            resultForm.reset();

            resultMaxScore.value =
                100;

            showMessage(
                "Result saved successfully."
            );

        }
    );

}


// ============================================================
// UPLOAD DOCUMENT
// ============================================================

if (documentForm) {

    documentForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const title =
                documentTitle.value.trim();

            const category =
                documentCategory.value;

            const description =
                documentDescription.value.trim();

            const file =
                documentFile.files[0];

            if (!file) {

                showMessage(
                    "Choose a file first.",
                    "warning"
                );

                return;

            }

            if (!title) {

                showMessage(
                    "Enter a document title.",
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


            // Upload file
            const {
                error:
                    uploadError
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

                console.error(
                    uploadError
                );

                showMessage(
                    uploadError.message,
                    "error"
                );

                return;

            }


            // Save database record
            const {
                error:
                    databaseError
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

            if (databaseError) {

                console.error(
                    databaseError
                );


                // Remove uploaded file
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

            documentForm.reset();

            showMessage(
                "Document uploaded successfully."
            );

            await loadDocuments();

        }
    );

}


// ============================================================
// LOAD DOCUMENTS
// ============================================================

async function loadDocuments() {

    if (!documentsTable) {
        return;
    }

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
            "Document error:",
            error
        );

        documentsTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty">

                    Failed to load documents.

                </td>
            </tr>
        `;

        return;

    }

    if (!data || !data.length) {

        documentsTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty">

                    No documents uploaded.

                </td>
            </tr>
        `;

        return;

    }

    documentsTable.innerHTML =
        data.map(
            document => {

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                document.title
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                document.category
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                document.created_at
                            )}
                        </td>

                        <td>

                            ${
                                document.published

                                ?

                                `
                                    <span
                                        class="status published">

                                        Published

                                    </span>
                                `

                                :

                                `
                                    <span
                                        class="status unpublished">

                                        Hidden

                                    </span>
                                `
                            }

                        </td>

                        <td>

                            <button
                                class="secondary-button"
                                data-toggle-document="${document.id}"
                                data-current-status="${document.published}">

                                ${
                                    document.published
                                    ? "Hide"
                                    : "Publish"
                                }

                            </button>


                            <button
                                class="danger-button"
                                data-delete-document="${document.id}"
                                data-storage-path="${escapeHTML(
                                    document.storage_path
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


    // Delete storage file
    if (storagePath) {

        const {
            error:
                storageError
        } =
            await supabase
                .storage
                .from(
                    "grade-hub-documents"
                )
                .remove([
                    storagePath
                ]);

        if (storageError) {

            console.warn(
                storageError
            );

        }

    }


    // Delete database record
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
// ADD ANNOUNCEMENT
// ============================================================

if (announcementForm) {

    announcementForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const title =
                announcementTitle.value
                    .trim();

            const message =
                announcementMessage.value
                    .trim();

            if (!title || !message) {

                showMessage(
                    "Enter a title and message.",
                    "warning"
                );

                return;

            }

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

            if (error) {

                console.error(error);

                showMessage(
                    error.message,
                    "error"
                );

                return;

            }

            announcementForm.reset();

            showMessage(
                "Announcement published."
            );

            await loadAnnouncements();

        }
    );

}


// ============================================================
// LOAD ANNOUNCEMENTS
// ============================================================

async function loadAnnouncements() {

    if (!announcementsList) {
        return;
    }

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

        return;

    }

    if (!data || !data.length) {

        announcementsList.innerHTML = `
            <div class="sa-card">

                <div class="empty">

                    No announcements yet.

                </div>

            </div>
        `;

        return;

    }

    announcementsList.innerHTML =
        data.map(
            announcement => {

                return `
                    <div
                        class="sa-card"
                        style="margin-bottom:12px;">

                        <div
                            class="sa-card-body">

                            <h3>

                                ${escapeHTML(
                                    announcement.title
                                )}

                            </h3>

                            <p>

                                ${escapeHTML(
                                    announcement.message
                                )}

                            </p>

                            <small>

                                ${formatDate(
                                    announcement.created_at
                                )}

                            </small>

                            <br>
                            <br>

                            <button
                                class="danger-button"
                                data-delete-announcement="${announcement.id}">

                                Delete

                            </button>

                        </div>

                    </div>
                `;

            }
        ).join("");

}


// ============================================================
// DELETE ANNOUNCEMENT
// ============================================================

if (announcementsList) {

    announcementsList.addEventListener(
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
// DASHBOARD
// ============================================================

async function loadDashboard() {

    const user =
        await checkSuperAdmin();

    if (!user) {
        return;
    }

    try {

        await Promise.all([
            loadApprovedAdmins(),
            loadAdminRequests(),
            loadStudents(),
            loadSubjects(),
            loadCombinations(),
            loadExams(),
            loadDocuments(),
            loadAnnouncements()
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
