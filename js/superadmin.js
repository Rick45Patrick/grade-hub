```javascript
import { supabase } from "./supabase.js";


/* =========================================================
   SUPER ADMIN
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const authorized = await verifySuperAdmin();

    if (!authorized) {
        return;
    }

    await loadDashboard();

});


/* =========================================================
   VERIFY SUPER ADMIN
========================================================= */

async function verifySuperAdmin() {

    const { data, error } =
        await supabase.auth.getSession();

    if (error || !data.session) {

        window.location.href = "index.html";

        return false;
    }

    const user = data.session.user;

    const {
        data: roles,
        error: roleError
    } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", user.id);

    if (roleError) {

        console.error(roleError);

        showMessage(
            roleError.message,
            "error"
        );

        return false;
    }

    const isSuperAdmin =
        roles?.some(role =>
            role.role === "super_admin" &&
            role.approved === true
        );

    if (!isSuperAdmin) {

        await supabase.auth.signOut();

        window.location.href = "index.html";

        return false;
    }

    return true;
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    await loadAdminRequests();

    await loadApprovedAdmins();

    await loadStudents();

    await loadStatistics();

}


/* =========================================================
   LOAD ADMIN REQUESTS
========================================================= */

async function loadAdminRequests() {

    const table =
        document.getElementById("adminRequests");

    if (!table) {
        return;
    }

    table.innerHTML = `
        <tr>
            <td colspan="6">
                Loading requests...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await supabase
        .from("admin_requests")
        .select(`
            id,
            user_id,
            full_name,
            email,
            username,
            status,
            created_at
        `)
        .eq("status", "pending")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Could not load admin requests:",
            error
        );

        table.innerHTML = `
            <tr>
                <td colspan="6">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        return;
    }


    if (!data || data.length === 0) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="empty-state"
                >
                    No pending administrator requests.
                </td>
            </tr>
        `;

        return;
    }


    table.innerHTML = "";


    data.forEach(request => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    request.full_name
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.username
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.email
                )}
            </td>

            <td>
                ${formatDate(
                    request.created_at
                )}
            </td>

            <td>
                <span class="status pending">
                    Pending
                </span>
            </td>

            <td>

                <button
                    type="button"
                    class="btn approve-btn"
                    data-request-id="${request.id}"
                >
                    Approve
                </button>

                <button
                    type="button"
                    class="btn reject-btn"
                    data-request-id="${request.id}"
                >
                    Reject
                </button>

            </td>

        `;


        table.appendChild(row);

    });


    table
        .querySelectorAll(".approve-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await approveAdmin(
                        button.dataset.requestId,
                        button
                    );

                }
            );

        });


    table
        .querySelectorAll(".reject-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await rejectAdmin(
                        button.dataset.requestId,
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

    if (!requestId) {

        showMessage(
            "Missing administrator request ID.",
            "error"
        );

        return;
    }


    const confirmed =
        window.confirm(
            "Approve this administrator request?"
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Approving...";


    console.log(
        "Approving request:",
        requestId
    );


    const {
        data,
        error
    } = await supabase.rpc(
        "approve_admin_request",
        {
            request_id: requestId
        }
    );


    console.log(
        "Approval result:",
        data
    );

    console.log(
        "Approval error:",
        error
    );


    if (error) {

        console.error(
            "Approval failed:",
            error
        );


        showMessage(
            `Approval failed: ${error.message}`,
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


    /*
       Reload the request list.
       The approved request should disappear
       because its status is no longer pending.
    */

    await loadAdminRequests();

    await loadApprovedAdmins();

    await loadStatistics();

}


/* =========================================================
   REJECT ADMIN
========================================================= */

async function rejectAdmin(
    requestId,
    button
) {

    if (!requestId) {

        showMessage(
            "Missing administrator request ID.",
            "error"
        );

        return;
    }


    const confirmed =
        window.confirm(
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
    } = await supabase.rpc(
        "reject_admin_request",
        {
            request_id: requestId
        }
    );


    if (error) {

        console.error(
            "Rejection failed:",
            error
        );


        showMessage(
            `Rejection failed: ${error.message}`,
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


    await loadAdminRequests();

    await loadStatistics();

}


/* =========================================================
   APPROVED ADMINISTRATORS
========================================================= */

async function loadApprovedAdmins() {

    const table =
        document.getElementById(
            "approvedAdmins"
        );

    if (!table) {
        return;
    }


    const {
        data: roles,
        error: roleError
    } = await supabase
        .from("user_roles")
        .select(
            "user_id, approved"
        )
        .eq("role", "admin")
        .eq("approved", true);


    if (roleError) {

        console.error(
            roleError
        );

        table.innerHTML = `
            <tr>
                <td colspan="5">
                    ${escapeHTML(
                        roleError.message
                    )}
                </td>
            </tr>
        `;

        return;
    }


    if (!roles || roles.length === 0) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-state"
                >
                    No approved administrators.
                </td>
            </tr>
        `;

        return;
    }


    const userIds =
        roles.map(
            role => role.user_id
        );


    const {
        data: profiles,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(
            "id, full_name, username, email"
        )
        .in("id", userIds);


    if (profileError) {

        console.error(
            profileError
        );

        return;
    }


    const profileMap =
        new Map(
            (profiles || []).map(
                profile => [
                    profile.id,
                    profile
                ]
            )
        );


    table.innerHTML = "";


    roles.forEach(role => {

        const profile =
            profileMap.get(
                role.user_id
            );


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    profile?.full_name ||
                    "Unknown"
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile?.username ||
                    "—"
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile?.email ||
                    "—"
                )}
            </td>

            <td>
                <span class="status approved">
                    Approved
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="btn remove-admin-btn"
                    data-user-id="${role.user_id}"
                >
                    Remove Access
                </button>
            </td>

        `;


        table.appendChild(row);

    });


    table
        .querySelectorAll(
            ".remove-admin-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeAdmin(
                        button.dataset.userId,
                        button
                    );

                }
            );

        });

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

    const table =
        document.getElementById(
            "studentTable"
        );

    if (!table) {
        return;
    }


    const {
        data,
        error
    } = await supabase
        .from("students")
        .select(`
            id,
            user_id,
            admission_number,
            class,
            optional_subjects
        `)
        .order(
            "admission_number",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            error
        );

        table.innerHTML = `
            <tr>
                <td colspan="6">
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;

        return;
    }


    if (!data || data.length === 0) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="empty-state"
                >
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
    } = await supabase
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


    table.innerHTML = "";


    data.forEach(student => {

        const profile =
            profileMap.get(
                student.user_id
            );


        const subjects =
            Array.isArray(
                student.optional_subjects
            )
                ? student.optional_subjects.join(
                    ", "
                )
                : "—";


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
                    subjects
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
                    type="button"
                    class="btn delete-student-btn"
                    data-student-id="${student.id}"
                    data-user-id="${student.user_id}"
                >
                    Delete
                </button>
            </td>

        `;


        table.appendChild(row);

    });


    table
        .querySelectorAll(
            ".delete-student-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteStudent(
                        button.dataset.studentId,
                        button.dataset.userId,
                        button
                    );

                }
            );

        });

}


/* =========================================================
   STATISTICS
========================================================= */

async function loadStatistics() {

    const totalStudents =
        document.getElementById(
            "totalStudents"
        );


    const totalAdmins =
        document.getElementById(
            "totalAdmins"
        );


    const pendingAdmins =
        document.getElementById(
            "pendingAdmins"
        );


    if (totalStudents) {

        const {
            count
        } = await supabase
            .from("students")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            );

        totalStudents.textContent =
            count ?? 0;
    }


    if (totalAdmins) {

        const {
            count
        } = await supabase
            .from("user_roles")
            .select(
                "user_id",
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

        totalAdmins.textContent =
            count ?? 0;
    }


    if (pendingAdmins) {

        const {
            count
        } = await supabase
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

        pendingAdmins.textContent =
            count ?? 0;
    }

}


/* =========================================================
   REMOVE ADMIN
========================================================= */

async function removeAdmin(
    userId,
    button
) {

    const confirmed =
        window.confirm(
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
    } = await supabase.rpc(
        "remove_admin_access",
        {
            target_user_id:
                userId
        }
    );


    if (error) {

        showMessage(
            `Unable to remove administrator: ${error.message}`,
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


    await loadApprovedAdmins();

    await loadStatistics();

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
        window.confirm(
            "Delete this student and their account? This action cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Deleting...";


    const {
        error
    } = await supabase.rpc(
        "delete_student_account",
        {
            student_record_id:
                studentId,

            target_user_id:
                userId
        }
    );


    if (error) {

        showMessage(
            `Unable to delete student: ${error.message}`,
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


    await loadStudents();

    await loadStatistics();

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

            refreshButton.textContent =
                "↻ Loading...";

            await loadDashboard();

            refreshButton.disabled =
                false;

            refreshButton.textContent =
                "↻ Refresh";

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

    const element =
        document.getElementById(
            "superAdminMessage"
        );


    if (!element) {

        alert(text);

        return;
    }


    element.textContent =
        text;


    element.className =
        `super-admin-message ${type}`;


    setTimeout(
        () => {

            element.textContent =
                "";

            element.className =
                "super-admin-message";

        },
        6000
    );

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
    date
) {

    if (!date) {
        return "—";
    }


    return new Date(date)
        .toLocaleDateString(
            "en-KE",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

}


/* =========================================================
   HTML ESCAPE
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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
```
