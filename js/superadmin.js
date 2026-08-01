import { supabase } from "./supabase.js";


/* ==========================================
   ELEMENTS
========================================== */

const logoutButton =
    document.getElementById("logoutButton");

const refreshButton =
    document.getElementById("refreshDashboard");

const messageBox =
    document.getElementById("saMessage");

const totalStudents =
    document.getElementById("totalStudents");

const totalAdmins =
    document.getElementById("totalAdmins");

const pendingAdmins =
    document.getElementById("pendingAdmins");

const adminRequests =
    document.getElementById("adminRequests");

const approvedAdmins =
    document.getElementById("approvedAdmins");

const studentTable =
    document.getElementById("studentTable");

const gradingTable =
    document.getElementById("gradingTable");

const addGradeButton =
    document.getElementById("addGradeButton");

const resetGradesButton =
    document.getElementById("resetGradesButton");

const saveGradesButton =
    document.getElementById("saveGradesButton");


/*
 * Password management
 */

const passwordUser =
    document.getElementById("passwordUser");

const newPassword =
    document.getElementById("newPassword");

const changePasswordButton =
    document.getElementById(
        "changePasswordButton"
    );


/* ==========================================
   DEFAULT GRADING
========================================== */

const DEFAULT_GRADES = [

    {
        grade: "EE1",
        min_mark: 90,
        points: 8,
        description:
            "Exceeding Expectations"
    },

    {
        grade: "EE2",
        min_mark: 80,
        points: 7,
        description:
            "Exceeding Expectations"
    },

    {
        grade: "ME1",
        min_mark: 70,
        points: 6,
        description:
            "Meeting Expectations"
    },

    {
        grade: "ME2",
        min_mark: 60,
        points: 5,
        description:
            "Meeting Expectations"
    },

    {
        grade: "AE1",
        min_mark: 50,
        points: 4,
        description:
            "Approaching Expectations"
    },

    {
        grade: "AE2",
        min_mark: 40,
        points: 3,
        description:
            "Approaching Expectations"
    },

    {
        grade: "BE1",
        min_mark: 30,
        points: 2,
        description:
            "Below Expectations"
    },

    {
        grade: "BE2",
        min_mark: 0,
        points: 1,
        description:
            "Below Expectations"
    }

];


/* ==========================================
   MESSAGE
========================================== */

function showMessage(
    text,
    type = "success"
) {

    messageBox.textContent =
        text;

    messageBox.className =
        "sa-message show " +
        type;

}


/* ==========================================
   HTML SAFETY
========================================== */

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


/* ==========================================
   DATE
========================================== */

function formatDate(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleDateString();

}


/* ==========================================
   SUBJECTS
========================================== */

function formatSubjects(subjects) {

    if (!subjects) {
        return "—";
    }


    if (Array.isArray(subjects)) {

        return subjects
            .map(
                subject =>
                    escapeHTML(subject)
            )
            .join(", ");

    }


    return escapeHTML(subjects);

}


/* ==========================================
   CHECK LOGIN
========================================== */

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


/* ==========================================
   CHECK SUPER ADMIN
========================================== */

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
            "Role check error:",
            error
        );

        showMessage(
            "Unable to verify your account role.",
            "error"
        );

        return null;

    }


    const superAdmin =
        (data || []).find(
            row =>
                row.role ===
                    "super_admin" &&
                row.approved === true
        );


    if (!superAdmin) {

        showMessage(
            "This account does not have an approved Super Admin role.",
            "error"
        );


        setTimeout(
            () => {

                window.location.href =
                    "index.html";

            },
            1500
        );


        return null;

    }


    return user;

}


/* ==========================================
   LOAD APPROVED ADMINS
========================================== */

async function loadApprovedAdmins() {

    approvedAdmins.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="sa-empty">

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

        console.error(
            "Admin role error:",
            error
        );


        approvedAdmins.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="sa-empty">

                    Failed to load administrators.

                </td>
            </tr>
        `;


        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        totalAdmins.textContent =
            "0";


        approvedAdmins.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="sa-empty">

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
            "Admin profiles error:",
            profileError
        );


        approvedAdmins.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="sa-empty">

                    Administrators found,
                    but profiles could not
                    be loaded.

                </td>
            </tr>
        `;


        return;

    }


    const profileMap = {};


    (profiles || [])
        .forEach(
            profile => {

                profileMap[
                    profile.id
                ] = profile;

            }
        );


    totalAdmins.textContent =
        data.length;


    approvedAdmins.innerHTML =
        data.map(
            row => {

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
                                class="sa-status approved">

                                Approved

                            </span>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


/* ==========================================
   LOAD ADMIN REQUESTS
========================================== */

async function loadAdminRequests() {

    adminRequests.innerHTML = `
        <tr>
            <td
                colspan="6"
                class="sa-empty">

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

        console.error(
            "Admin request error:",
            error
        );


        adminRequests.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="sa-empty">

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


    pendingAdmins.textContent =
        pending.length;


    if (requests.length === 0) {

        adminRequests.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="sa-empty">

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
                            data-id="${escapeHTML(
                                request.id
                            )}">

                            Approve

                        </button>


                        <button
                            class="sa-btn reject"
                            data-action="reject"
                            data-id="${escapeHTML(
                                request.id
                            )}">

                            Reject

                        </button>

                    `;

                }


                const statusClass =
                    request.status ===
                    "approved"
                        ? "approved"
                        : "pending";


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
                                    "unknown"
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


/* ==========================================
   LOAD STUDENTS
========================================== */

async function loadStudents() {

    studentTable.innerHTML = `
        <tr>
            <td
                colspan="5"
                class="sa-empty">

                Loading...

            </td>
        </tr>
    `;


    const {
        data: students,
        error
    } =
        await supabase
            .from("students")
            .select(
                `
                id,
                user_id,
                admission_number,
                class,
                optional_subjects,
                created_at
                `
            )
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
                <td
                    colspan="5"
                    class="sa-empty">

                    Failed to load students.

                </td>
            </tr>
        `;


        return;

    }


    const studentList =
        students || [];


    totalStudents.textContent =
        studentList.length;


    if (
        studentList.length ===
        0
    ) {

        studentTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="sa-empty">

                    No students registered yet.

                </td>
            </tr>
        `;


        return;

    }


    const userIds =
        studentList
            .map(
                student =>
                    student.user_id
            )
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const result =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, username, email"
                )
                .in(
                    "id",
                    userIds
                );


        if (result.error) {

            console.error(
                "Student profile error:",
                result.error
            );

        }
        else {

            profiles =
                result.data || [];

        }

    }


    const profileMap = {};


    profiles.forEach(
        profile => {

            profileMap[
                profile.id
            ] = profile;

        }
    );


    studentTable.innerHTML =
        studentList.map(
            student => {

                const profile =
                    profileMap[
                        student.user_id
                    ] || {};


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
                                profile.full_name ||
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
                            ${formatSubjects(
                                student.optional_subjects
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                profile.username ||
                                "—"
                            )}
                        </td>

                    </tr>

                `;

            }
        ).join("");

}


/* ==========================================
   APPROVE ADMIN
========================================== */

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

        showMessage(
            "Approving administrator..."
        );


        const {
            data,
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


        console.log(
            "Approval result:",
            data
        );


        showMessage(
            "Administrator approved successfully.",
            "success"
        );


        await loadAdminRequests();

        await loadApprovedAdmins();

        await loadPasswordUsers();

    }

    catch (error) {

        console.error(
            "Approval error:",
            error
        );


        showMessage(
            "Approval failed: " +
            (
                error.message ||
                "Unknown error"
            ),
            "error"
        );

    }

}


/* ==========================================
   REJECT ADMIN
========================================== */

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


    try {

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
            throw error;
        }


        showMessage(
            "Administrator request rejected.",
            "success"
        );


        await loadAdminRequests();

    }

    catch (error) {

        console.error(
            "Reject error:",
            error
        );


        showMessage(
            "Rejection failed: " +
            (
                error.message ||
                "Unknown error"
            ),
            "error"
        );

    }

}


/* ==========================================
   ADMIN REQUEST BUTTONS
========================================== */

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


        button.disabled = true;


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


/* ==========================================
   GRADING TABLE
========================================== */

function renderGradingTable(
    grades
) {

    if (
        !grades ||
        grades.length === 0
    ) {

        gradingTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="sa-empty">

                    No grading levels configured.

                </td>
            </tr>
        `;

        return;

    }


    grades.sort(
        (a, b) =>
            Number(b.min_mark) -
            Number(a.min_mark)
    );


    gradingTable.innerHTML =
        grades.map(
            (grade, index) => {

                return `

                    <tr
                        data-row="${index}">

                        <td>

                            <input
                                class="grading-input"
                                data-field="grade"
                                value="${escapeHTML(
                                    grade.grade
                                )}"
                                maxlength="20">

                        </td>


                        <td>

                            <input
                                class="grading-input grade-number"
                                data-field="min_mark"
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value="${Number(
                                    grade.min_mark
                                )}">

                        </td>


                        <td>

                            <input
                                class="grading-input grade-points"
                                data-field="points"
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value="${Number(
                                    grade.points
                                )}">

                        </td>


                        <td>

                            <input
                                class="grading-input"
                                data-field="description"
                                value="${escapeHTML(
                                    grade.description
                                )}">

                        </td>


                        <td>

                            <button
                                type="button"
                                class="sa-btn danger delete-grade"
                                data-id="${escapeHTML(
                                    grade.id || ""
                                )}">

                                Delete

                            </button>

                        </td>

                    </tr>

                `;

            }
        ).join("");

}


/* ==========================================
   LOAD GRADING SYSTEM
========================================== */

async function loadGradingSystem() {

    gradingTable.innerHTML = `
        <tr>
            <td
                colspan="5"
                class="sa-empty">

                Loading grading system...

            </td>
        </tr>
    `;


    const {
        data,
        error
    } =
        await supabase
            .from("grading_system")
            .select(
                "id, grade, min_mark, points, description"
            )
            .order(
                "min_mark",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Grading system error:",
            error
        );


        gradingTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="sa-empty">

                    Failed to load grading system.

                </td>
            </tr>
        `;


        return;

    }


    renderGradingTable(
        data || []
    );

}


/* ==========================================
   ADD GRADE
========================================== */

addGradeButton.addEventListener(
    "click",
    function() {

        const rows =
            Array.from(
                gradingTable.querySelectorAll(
                    "tr[data-row]"
                )
            );


        const newRow =
            document.createElement(
                "tr"
            );


        newRow.dataset.row =
            rows.length;


        newRow.dataset.new =
            "true";


        newRow.innerHTML = `

            <td>

                <input
                    class="grading-input"
                    data-field="grade"
                    value="NEW"
                    maxlength="20">

            </td>


            <td>

                <input
                    class="grading-input grade-number"
                    data-field="min_mark"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value="0">

            </td>


            <td>

                <input
                    class="grading-input grade-points"
                    data-field="points"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value="1">

            </td>


            <td>

                <input
                    class="grading-input"
                    data-field="description"
                    value="New Grade">

            </td>


            <td>

                <button
                    type="button"
                    class="sa-btn danger delete-grade">

                    Delete

                </button>

            </td>

        `;


        gradingTable.appendChild(
            newRow
        );

    }
);


/* ==========================================
   DELETE GRADE
========================================== */

gradingTable.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                ".delete-grade"
            );


        if (!button) {
            return;
        }


        const row =
            button.closest("tr");


        if (!row) {
            return;
        }


        const id =
            button.dataset.id;


        const confirmed =
            window.confirm(
                "Delete this grading level?"
            );


        if (!confirmed) {
            return;
        }


        if (!id) {

            row.remove();

            return;

        }


        button.disabled = true;


        const {
            error
        } =
            await supabase
                .from("grading_system")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (error) {

            console.error(
                "Delete grade error:",
                error
            );


            showMessage(
                "Could not delete grade: " +
                error.message,
                "error"
            );


            button.disabled =
                false;


            return;

        }


        row.remove();


        showMessage(
            "Grading level deleted.",
            "success"
        );

    }
);


/* ==========================================
   READ GRADING TABLE
========================================== */

function readGradingTable() {

    const rows =
        Array.from(
            gradingTable.querySelectorAll(
                "tr[data-row]"
            )
        );


    const grades = [];


    for (
        const row of rows
    ) {

        const gradeInput =
            row.querySelector(
                '[data-field="grade"]'
            );


        const markInput =
            row.querySelector(
                '[data-field="min_mark"]'
            );


        const pointsInput =
            row.querySelector(
                '[data-field="points"]'
            );


        const descriptionInput =
            row.querySelector(
                '[data-field="description"]'
            );


        if (
            !gradeInput ||
            !markInput ||
            !pointsInput ||
            !descriptionInput
        ) {

            continue;

        }


        const grade =
            gradeInput.value.trim();


        const minMark =
            Number(
                markInput.value
            );


        const points =
            Number(
                pointsInput.value
            );


        const description =
            descriptionInput
                .value
                .trim();


        if (!grade) {

            throw new Error(
                "Every grade must have a name."
            );

        }


        if (
            Number.isNaN(minMark) ||
            minMark < 0 ||
            minMark > 100
        ) {

            throw new Error(
                `Invalid minimum mark for ${grade}.`
            );

        }


        if (
            !Number.isInteger(minMark)
        ) {

            throw new Error(
                `Minimum mark for ${grade} must be a whole number.`
            );

        }


        if (
            Number.isNaN(points) ||
            points < 0
        ) {

            throw new Error(
                `Invalid points for ${grade}.`
            );

        }


        if (
            !Number.isInteger(points)
        ) {

            throw new Error(
                `Points for ${grade} must be a whole number.`
            );

        }


        if (!description) {

            throw new Error(
                `Enter a description for ${grade}.`
            );

        }


        grades.push({

            grade,

            min_mark:
                minMark,

            points,

            description

        });

    }


    return grades;

}


/* ==========================================
   SAVE GRADING SYSTEM
========================================== */

saveGradesButton.addEventListener(
    "click",
    async function() {

        try {

            saveGradesButton.disabled =
                true;


            saveGradesButton.textContent =
                "Saving...";


            const grades =
                readGradingTable();


            if (
                grades.length ===
                0
            ) {

                throw new Error(
                    "Add at least one grading level."
                );

            }


            /*
             * Duplicate grade names
             */

            const names =
                grades.map(
                    grade =>
                        grade.grade
                            .toUpperCase()
                );


            const uniqueNames =
                new Set(names);


            if (
                uniqueNames.size !==
                names.length
            ) {

                throw new Error(
                    "Grade names must be unique."
                );

            }


            /*
             * Duplicate minimum marks
             */

            const marks =
                grades.map(
                    grade =>
                        Number(
                            grade.min_mark
                        )
                );


            const uniqueMarks =
                new Set(marks);


            if (
                uniqueMarks.size !==
                marks.length
            ) {

                throw new Error(
                    "Minimum marks must be unique."
                );

            }


            /*
             * Delete existing configuration
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
                        "grade",
                        "__never__"
                    );


            if (deleteError) {
                throw deleteError;
            }


            /*
             * Insert new configuration
             */

            const {
                error: insertError
            } =
                await supabase
                    .from(
                        "grading_system"
                    )
                    .insert(
                        grades
                    );


            if (insertError) {
                throw insertError;
            }


            showMessage(
                "Grading system saved successfully.",
                "success"
            );


            await loadGradingSystem();

        }

        catch (error) {

            console.error(
                "Save grading error:",
                error
            );


            showMessage(
                "Could not save grading system: " +
                (
                    error.message ||
                    "Unknown error"
                ),
                "error"
            );

        }

        finally {

            saveGradesButton.disabled =
                false;


            saveGradesButton.textContent =
                "Save Grading System";

        }

    }
);


/* ==========================================
   RESET DEFAULT GRADING
========================================== */

resetGradesButton.addEventListener(
    "click",
    async function() {

        const confirmed =
            window.confirm(
                "Reset the grading system to the default CBC configuration?"
            );


        if (!confirmed) {
            return;
        }


        try {

            resetGradesButton.disabled =
                true;


            resetGradesButton.textContent =
                "Resetting...";


            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "grading_system"
                    )
                    .delete()
                    .neq(
                        "grade",
                        "__never__"
                    );


            if (deleteError) {
                throw deleteError;
            }


            const {
                error: insertError
            } =
                await supabase
                    .from(
                        "grading_system"
                    )
                    .insert(
                        DEFAULT_GRADES
                    );


            if (insertError) {
                throw insertError;
            }


            showMessage(
                "Default CBC grading restored.",
                "success"
            );


            await loadGradingSystem();

        }

        catch (error) {

            console.error(
                "Reset grading error:",
                error
            );


            showMessage(
                "Could not reset grading system: " +
                (
                    error.message ||
                    "Unknown error"
                ),
                "error"
            );

        }

        finally {

            resetGradesButton.disabled =
                false;


            resetGradesButton.textContent =
                "Reset Defaults";

        }

    }
);


/* ==========================================
   LOAD PASSWORD USERS
========================================== */

async function loadPasswordUsers() {

    passwordUser.innerHTML = `
        <option value="">
            Loading accounts...
        </option>
    `;


    try {

        /*
         * Get students
         */

        const {
            data: students,
            error: studentError
        } =
            await supabase
                .from("students")
                .select(
                    "user_id, admission_number"
                );


        if (studentError) {
            throw studentError;
        }


        /*
         * Get approved administrators
         */

        const {
            data: admins,
            error: adminError
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


        if (adminError) {
            throw adminError;
        }


        const studentList =
            students || [];


        const adminList =
            admins || [];


        /*
         * Get all profile IDs
         */

        const userIds = [

            ...studentList.map(
                student =>
                    student.user_id
            ),

            ...adminList.map(
                admin =>
                    admin.user_id
            )

        ].filter(Boolean);


        const uniqueUserIds =
            [
                ...new Set(
                    userIds
                )
            ];


        let profiles = [];


        if (
            uniqueUserIds.length >
            0
        ) {

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
                        uniqueUserIds
                    );


            if (error) {
                throw error;
            }


            profiles =
                data || [];

        }


        /*
         * Create profile map
         */

        const profileMap = {};


        profiles.forEach(
            profile => {

                profileMap[
                    profile.id
                ] = profile;

            }
        );


        /*
         * Reset dropdown
         */

        passwordUser.innerHTML = `
            <option value="">
                Select account
            </option>
        `;


        /*
         * Students
         */

        studentList.forEach(
            student => {

                if (!student.user_id) {
                    return;
                }


                const profile =
                    profileMap[
                        student.user_id
                    ] || {};


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    student.user_id;


                option.textContent =
                    `Student — ${
                        profile.full_name ||
                        profile.username ||
                        student.admission_number ||
                        "Unknown"
                    }`;


                passwordUser.appendChild(
                    option
                );

            }
        );


        /*
         * Administrators
         */

        adminList.forEach(
            admin => {

                if (!admin.user_id) {
                    return;
                }


                const profile =
                    profileMap[
                        admin.user_id
                    ] || {};


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    admin.user_id;


                option.textContent =
                    `Administrator — ${
                        profile.full_name ||
                        profile.username ||
                        profile.email ||
                        "Unknown"
                    }`;


                passwordUser.appendChild(
                    option
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Password users error:",
            error
        );


        passwordUser.innerHTML = `
            <option value="">
                Failed to load accounts
            </option>
        `;


        showMessage(
            "Could not load password accounts: " +
            (
                error.message ||
                "Unknown error"
            ),
            "error"
        );

    }

}


/* ==========================================
   CHANGE USER PASSWORD
========================================== */

async function changeUserPassword() {

    const userId =
        passwordUser.value;


    const password =
        newPassword.value.trim();


    /*
     * Validate account
     */

    if (!userId) {

        showMessage(
            "Select a student or administrator.",
            "error"
        );

        return;

    }


    /*
     * Validate password
     */

    if (!password) {

        showMessage(
            "Enter a new password.",
            "error"
        );

        return;

    }


    if (
        password.length <
        6
    ) {

        showMessage(
            "The password must contain at least 6 characters.",
            "error"
        );

        return;

    }


    /*
     * Confirm action
     */

    const confirmed =
        window.confirm(
            "Are you sure you want to change this user's password?"
        );


    if (!confirmed) {
        return;
    }


    try {

        changePasswordButton.disabled =
            true;


        changePasswordButton.textContent =
            "Changing...";


        /*
         * Call Supabase Edge Function
         */

        const {
            data,
            error
        } =
            await supabase.functions.invoke(
                "admin-change-password",
                {
                    body: {

                        user_id:
                            userId,

                        new_password:
                            password

                    }
                }
            );


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.error ||
                "Password change failed."
            );

        }


        showMessage(
            "Password changed successfully.",
            "success"
        );


        /*
         * Clear password field
         */

        newPassword.value =
            "";


        passwordUser.value =
            "";

    }

    catch (error) {

        console.error(
            "Password change error:",
            error
        );


        showMessage(
            "Could not change password: " +
            (
                error.message ||
                "Unknown error"
            ),
            "error"
        );

    }

    finally {

        changePasswordButton.disabled =
            false;


        changePasswordButton.textContent =
            "Change Password";

    }

}


/* ==========================================
   PASSWORD BUTTON
========================================== */

changePasswordButton.addEventListener(
    "click",
    changeUserPassword
);


/* ==========================================
   REFRESH
========================================== */

refreshButton.addEventListener(
    "click",
    async function() {

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


/* ==========================================
   LOGOUT
========================================== */

logoutButton.addEventListener(
    "click",
    async function() {

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

            console.error(
                "Sign out error:",
                error
            );


            showMessage(
                "Sign out failed: " +
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


/* ==========================================
   MAIN DASHBOARD
========================================== */

async function loadDashboard() {

    try {

        const user =
            await checkSuperAdmin();


        if (!user) {
            return;
        }


        await Promise.all([

            loadApprovedAdmins(),

            loadAdminRequests(),

            loadStudents(),

            loadGradingSystem(),

            loadPasswordUsers()

        ]);

    }

    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );


        showMessage(
            "Dashboard error: " +
            (
                error.message ||
                "Unknown error"
            ),
            "error"
        );

    }

}


/* ==========================================
   START
========================================== */

loadDashboard();
