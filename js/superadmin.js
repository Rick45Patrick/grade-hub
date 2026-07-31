import { supabase } from "./supabase.js";


/* =========================================================
   SUPER ADMIN DASHBOARD
========================================================= */


const requestTable =
    document.getElementById("adminRequests");


const approvedAdminTable =
    document.getElementById("approvedAdmins");


const studentTable =
    document.getElementById("studentTable");


const message =
    document.getElementById("superAdminMessage");


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const authorized =
            await verifySuperAdmin();

        if (!authorized) {
            return;
        }


        await loadDashboard();

    }
);


/* =========================================================
   VERIFY SUPER ADMIN
========================================================= */

async function verifySuperAdmin() {

    const {
        data: sessionData,
        error: sessionError
    } =
        await supabase.auth.getSession();


    if (
        sessionError ||
        !sessionData.session
    ) {

        window.location.href =
            "index.html";

        return false;
    }


    const user =
        sessionData.session.user;


    const {
        data: roles,
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

        console.error(error);

        showMessage(
            "Unable to verify administrator permissions.",
            "error"
        );

        return false;
    }


    const isSuperAdmin =
        roles?.some(
            item =>
                item.role ===
                    "super_admin" &&
                item.approved === true
        );


    if (!isSuperAdmin) {

        await supabase.auth.signOut();

        window.location.href =
            "index.html";

        return false;
    }


    return true;
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadDashboard() {

    await Promise.all([
        loadAdminRequests(),
        loadApprovedAdmins(),
        loadStudents(),
        loadStatistics()
    ]);

}


/* =========================================================
   ADMIN REQUESTS
========================================================= */

async function loadAdminRequests() {

    if (!requestTable) {
        return;
    }


    const {
        data,
        error
    } =
        await supabase
            .from("admin_requests")
            .select(
                "id, user_id, full_name, email, username, status, created_at"
            )
            .eq(
                "status",
                "pending"
            )
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

        requestTable.innerHTML = `
            <tr>
                <td colspan="6">
                    Unable to load administrator requests.
                </td>
            </tr>
        `;

        return;
    }


    requestTable.innerHTML = "";


    if (
        !data ||
        data.length === 0
    ) {

        requestTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No pending administrator requests.
                </td>
            </tr>
        `;

        return;
    }


    data.forEach(request => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(request.full_name)}
            </td>

            <td>
                ${escapeHTML(request.username)}
            </td>

            <td>
                ${escapeHTML(request.email)}
            </td>

            <td>
                ${formatDate(request.created_at)}
            </td>

            <td>
                <span class="status pending">
                    Pending
                </span>
            </td>

            <td>

                <button
                    class="btn approve-btn"
                    data-id="${request.id}"
                >
                    Approve
                </button>

                <button
                    class="btn reject-btn"
                    data-id="${request.id}"
                >
                    Reject
                </button>

            </td>
        `;


        requestTable.appendChild(row);

    });


    document
        .querySelectorAll(".approve-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    approveAdmin(
                        button.dataset.id,
                        button
                    );

                }
            );

        });


    document
        .querySelectorAll(".reject-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    rejectAdmin(
                        button.dataset.id,
                        button
                    );

                }
            );

        });

}


/* =========================================================
   APPROVE ADMIN
========================================================= */

async function approveAdmin(
    requestId,
    button
) {

    const confirmed =
        confirm(
            "Approve this administrator account?"
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Approving...";


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

        console.error(
            "Approval error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        button.disabled = false;

        button.textContent =
            "Approve";

        return;
    }


    showMessage(
        data ||
        "Administrator approved successfully.",
        "success"
    );


    await loadDashboard();

}


/* =========================================================
   REJECT ADMIN
========================================================= */

async function rejectAdmin(
    requestId,
    button
) {

    const confirmed =
        confirm(
            "Reject this administrator request?"
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Rejecting...";


    const {
        data,
        error
    } =
        await supabase.rpc(
            "reject_admin_request",
            {
                request_id:
                    requestId
            }
        );


    if (error) {

        console.error(
            "Rejection error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        button.disabled = false;

        button.textContent =
            "Reject";

        return;
    }


    showMessage(
        data ||
        "Administrator request rejected.",
        "success"
    );


    await loadDashboard();

}


/* =========================================================
   APPROVED ADMINISTRATORS
========================================================= */

async function loadApprovedAdmins() {

    if (!approvedAdminTable) {
        return;
    }


    const {
        data: roles,
        error: roleError
    } =
        await supabase
            .from("user_roles")
            .select(
                "user_id, approved"
            )
            .eq(
                "role",
                "admin"
            )
            .eq(
                "approved",
                true
            );


    if (roleError) {

        console.error(
            roleError
        );

        return;
    }


    approvedAdminTable.innerHTML = "";


    if (
        !roles ||
        roles.length === 0
    ) {

        approvedAdminTable.innerHTML = `
            <tr>
                <td colspan="5">
                    No approved administrators.
                </td>
            </tr>
        `;

        return;
    }


    const userIds =
        roles.map(
            role =>
                role.user_id
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


    profiles.forEach(profile => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(profile.full_name)}
            </td>

            <td>
                ${escapeHTML(profile.username)}
            </td>

            <td>
                ${escapeHTML(profile.email)}
            </td>

            <td>
                <span class="status approved">
                    Approved
                </span>
            </td>

            <td>

                <button
                    class="btn remove-admin-btn"
                    data-id="${profile.id}"
                >
                    Remove Access
                </button>

            </td>

        `;


        approvedAdminTable.appendChild(row);

    });


    document
        .querySelectorAll(
            ".remove-admin-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeAdmin(
                        button.dataset.id,
                        button
                    );

                }
            );

        });

}


/* =========================================================
   REMOVE ADMIN
========================================================= */

async function removeAdmin(
    userId,
    button
) {

    const confirmed =
        confirm(
            "Remove administrator access from this account?"
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Removing...";


    const {
        error
    } =
        await supabase.rpc(
            "remove_admin_access",
            {
                target_user_id:
                    userId
            }
        );


    if (error) {

        console.error(
            "Remove admin error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        button.disabled = false;

        button.textContent =
            "Remove Access";

        return;
    }


    showMessage(
        "Administrator access removed.",
        "success"
    );


    await loadDashboard();

}


/* =========================================================
   LOAD STUDENTS
========================================================= */

async function loadStudents() {

    if (!studentTable) {
        return;
    }


    const {
        data,
        error
    } =
        await supabase
            .from("students")
            .select(`
                id,
                user_id,
                admission_number,
                class,
                optional_subjects
            `)
            .order(
                "admission_number"
            );


    if (error) {

        console.error(
            "Student error:",
            error
        );

        studentTable.innerHTML = `
            <tr>
                <td colspan="6">
                    Unable to load students.
                </td>
            </tr>
        `;

        return;
    }


    studentTable.innerHTML = "";


    if (
        !data ||
        data.length === 0
    ) {

        studentTable.innerHTML = `
            <tr>
                <td colspan="6">
                    No students registered.
                </td>
            </tr>
        `;

        return;
    }


    const userIds =
        data.map(
            student =>
                student.user_id
        );


    const {
        data: profiles
    } =
        await supabase
            .from("profiles")
            .select(
                "id, full_name, username"
            )
            .in(
                "id",
                userIds
            );


    const profileMap =
        new Map(
            (profiles || []).map(
                profile => [
                    profile.id,
                    profile
                ]
            )
        );


    data.forEach(student => {

        const profile =
            profileMap.get(
                student.user_id
            );


        const optionalSubjects =
            Array.isArray(
                student.optional_subjects
            )
                ? student.optional_subjects.join(
                    ", "
                )
                : "None";


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    student.admission_number
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile?.full_name ||
                    "Unknown"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.class
                )}
            </td>

            <td>
                ${escapeHTML(
                    optionalSubjects
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile?.username ||
                    "—"
                )}
            </td>

            <td>

                <button
                    class="btn delete-student-btn"
                    data-id="${student.id}"
                    data-user="${student.user_id}"
                >
                    Delete
                </button>

            </td>

        `;


        studentTable.appendChild(row);

    });


    document
        .querySelectorAll(
            ".delete-student-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteStudent(
                        button.dataset.id,
                        button.dataset.user,
                        button
                    );

                }
            );

        });

}


/* =========================================================
   DELETE STUDENT
========================================================= */

async function deleteStudent(
    studentId,
    userId,
    button
) {

    const confirmed =
        confirm(
            "Delete this student and their results? This action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Deleting...";


    const {
        error
    } =
        await supabase.rpc(
            "delete_student_account",
            {
                student_record_id:
                    studentId,

                target_user_id:
                    userId
            }
        );


    if (error) {

        console.error(
            "Delete student error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        button.disabled = false;

        button.textContent =
            "Delete";

        return;
    }


    showMessage(
        "Student deleted successfully.",
        "success"
    );


    await loadDashboard();

}


/* =========================================================
   STATISTICS
========================================================= */

async function loadStatistics() {

    const totalStudentsElement =
        document.getElementById(
            "totalStudents"
        );


    const totalAdminsElement =
        document.getElementById(
            "totalAdmins"
        );


    const pendingAdminsElement =
        document.getElementById(
            "pendingAdmins"
        );


    if (
        totalStudentsElement
    ) {

        const {
            count
        } =
            await supabase
                .from("students")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                );


        totalStudentsElement.textContent =
            count ?? 0;
    }


    if (
        totalAdminsElement
    ) {

        const {
            count
        } =
            await supabase
                .from("user_roles")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "role",
                    "admin"
                )
                .eq(
                    "approved",
                    true
                );


        totalAdminsElement.textContent =
            count ?? 0;
    }


    if (
        pendingAdminsElement
    ) {

        const {
            count
        } =
            await supabase
                .from("admin_requests")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "status",
                    "pending"
                );


        pendingAdminsElement.textContent =
            count ?? 0;
    }

}


/* =========================================================
   LOGOUT
========================================================= */

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            await supabase.auth.signOut();

            window.location.href =
                "index.html";

        }
    );

}


/* =========================================================
   REFRESH
========================================================= */

const refreshButton =
    document.getElementById(
        "refreshDashboard"
    );


if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;

            await loadDashboard();

            refreshButton.disabled =
                false;

        }
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    text,
    type = "success"
) {

    if (!message) {

        alert(text);

        return;
    }


    message.textContent =
        text;


    message.className =
        `super-admin-message ${type}`;


    setTimeout(
        () => {

            message.textContent =
                "";

            message.className =
                "super-admin-message";

        },
        5000
    );

}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
    date
) {

    if (!date) {
        return "—";
    }


    return new Date(
        date
    ).toLocaleDateString(
        "en-KE",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   HTML SECURITY
========================================================= */

function escapeHTML(
    value
) {

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
