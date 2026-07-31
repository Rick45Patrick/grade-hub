```javascript
import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    startDashboard();
});


async function startDashboard() {

    setupLogout();

    setupRefresh();

    const {
        data: sessionData,
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
        console.error("SESSION ERROR:", sessionError);
        showMessage(sessionError.message, "error");
        return;
    }

    if (!sessionData.session) {
        window.location.href = "index.html";
        return;
    }

    console.log("Logged in user:", sessionData.session.user);

    await loadAdminRequests();
    await loadStudents();
    await loadApprovedAdmins();
    await loadStatistics();
}


/* =====================================================
   LOGOUT
===================================================== */

function setupLogout() {

    const button =
        document.getElementById("logoutButton");

    if (!button) {
        console.error("logoutButton was not found");
        return;
    }

    button.addEventListener("click", async () => {

        button.disabled = true;
        button.textContent = "Signing out...";

        const { error } =
            await supabase.auth.signOut();

        if (error) {

            console.error("SIGN OUT ERROR:", error);

            showMessage(
                "Sign out failed: " + error.message,
                "error"
            );

            button.disabled = false;
            button.textContent = "↪ Sign Out";

            return;
        }

        window.location.href = "index.html";
    });
}


/* =====================================================
   REFRESH
===================================================== */

function setupRefresh() {

    const button =
        document.getElementById("refreshDashboard");

    if (!button) {
        return;
    }

    button.addEventListener("click", async () => {

        button.disabled = true;
        button.textContent = "↻ Loading...";

        await startDashboard();

        button.disabled = false;
        button.textContent = "↻ Refresh";
    });
}


/* =====================================================
   ADMIN REQUESTS
===================================================== */

async function loadAdminRequests() {

    const table =
        document.getElementById("adminRequests");

    if (!table) {
        console.error("adminRequests table not found");
        return;
    }

    table.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Loading administrator requests...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "ADMIN REQUEST ERROR:",
            error
        );

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Could not load requests.
                    <br>
                    <small>${escapeHTML(error.message)}</small>
                </td>
            </tr>
        `;

        return;
    }


    console.log(
        "ADMIN REQUESTS:",
        data
    );


    if (!data || data.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
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
                    request.full_name || "—"
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.username || "—"
                )}
            </td>

            <td>
                ${escapeHTML(
                    request.email || "—"
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


        table.appendChild(row);
    });


    table
        .querySelectorAll(".approve-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => approveRequest(
                    button.dataset.id,
                    button
                )
            );

        });


    table
        .querySelectorAll(".reject-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => rejectRequest(
                    button.dataset.id,
                    button
                )
            );

        });
}


/* =====================================================
   APPROVE REQUEST
===================================================== */

async function approveRequest(
    requestId,
    button
) {

    if (!confirm(
        "Approve this administrator request?"
    )) {
        return;
    }


    button.disabled = true;
    button.textContent = "Approving...";


    console.log(
        "APPROVING REQUEST:",
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
        "APPROVAL RESPONSE:",
        data
    );

    console.log(
        "APPROVAL ERROR:",
        error
    );


    if (error) {

        showMessage(
            "Approval failed: " +
            error.message,
            "error"
        );

        button.disabled = false;
        button.textContent = "Approve";

        return;
    }


    showMessage(
        data ||
        "Administrator approved successfully.",
        "success"
    );


    await loadAdminRequests();
    await loadApprovedAdmins();
    await loadStatistics();
}


/* =====================================================
   REJECT REQUEST
===================================================== */

async function rejectRequest(
    requestId,
    button
) {

    if (!confirm(
        "Reject this administrator request?"
    )) {
        return;
    }


    button.disabled = true;
    button.textContent = "Rejecting...";


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
            "REJECT ERROR:",
            error
        );

        showMessage(
            "Rejection failed: " +
            error.message,
            "error"
        );

        button.disabled = false;
        button.textContent = "Reject";

        return;
    }


    showMessage(
        data ||
        "Request rejected.",
        "success"
    );


    await loadAdminRequests();
    await loadStatistics();
}


/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

    const table =
        document.getElementById("studentTable");

    if (!table) {
        console.error("studentTable not found");
        return;
    }


    table.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Loading students...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await supabase
        .from("students")
        .select("*")
        .order(
            "admission_number",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "STUDENT ERROR:",
            error
        );

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Could not load students.
                    <br>
                    <small>${escapeHTML(error.message)}</small>
                </td>
            </tr>
        `;

        return;
    }


    console.log(
        "STUDENTS:",
        data
    );


    if (!data || data.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No students registered.
                </td>
            </tr>
        `;

        return;
    }


    const userIds =
        data
            .map(student => student.user_id)
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const {
            data: profileData,
            error: profileError
        } = await supabase
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
                "PROFILE ERROR:",
                profileError
            );

        } else {

            profiles =
                profileData || [];
        }
    }


    const profileMap =
        new Map(
            profiles.map(profile => [
                profile.id,
                profile
            ])
        );


    table.innerHTML = "";


    data.forEach(student => {

        const profile =
            profileMap.get(
                student.user_id
            );


        let subjects = "—";


        if (
            Array.isArray(
                student.optional_subjects
            )
        ) {

            subjects =
                student.optional_subjects.join(
                    ", "
                );

        } else if (
            typeof student.optional_subjects ===
            "string"
        ) {

            subjects =
                student.optional_subjects;
        }


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    student.admission_number ||
                    "—"
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile?.full_name ||
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
                ${escapeHTML(subjects)}
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
                    data-user="${student.user_id || ""}"
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
                () => deleteStudent(
                    button.dataset.id,
                    button.dataset.user,
                    button
                )
            );

        });
}


/* =====================================================
   APPROVED ADMINS
===================================================== */

async function loadApprovedAdmins() {

    const table =
        document.getElementById(
            "approvedAdmins"
        );

    if (!table) {
        return;
    }


    const {
        data,
        error
    } = await supabase
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
            "ADMIN LIST ERROR:",
            error
        );

        table.innerHTML = `
            <tr>
                <td colspan="5">
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
                    colspan="5"
                    class="empty-state"
                >
                    No approved administrators.
                </td>
            </tr>
        `;

        return;
    }


    const ids =
        data.map(
            item => item.user_id
        );


    const {
        data: profiles,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(
            "id, full_name, username, email"
        )
        .in(
            "id",
            ids
        );


    if (profileError) {

        console.error(
            "ADMIN PROFILE ERROR:",
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


    data.forEach(admin => {

        const profile =
            profileMap.get(
                admin.user_id
            );


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    profile?.full_name ||
                    "—"
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
                    class="btn remove-admin-btn"
                    data-id="${admin.user_id}"
                >
                    Remove Access
                </button>
            </td>

        `;


        table.appendChild(row);
    });
}


/* =====================================================
   STATISTICS
===================================================== */

async function loadStatistics() {

    const studentElement =
        document.getElementById(
            "totalStudents"
        );

    const adminElement =
        document.getElementById(
            "totalAdmins"
        );

    const pendingElement =
        document.getElementById(
            "pendingAdmins"
        );


    const students =
        await supabase
            .from("students")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            );


    if (students.error) {

        console.error(
            "STUDENT COUNT ERROR:",
            students.error
        );

    } else if (studentElement) {

        studentElement.textContent =
            students.count || 0;
    }


    const admins =
        await supabase
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


    if (admins.error) {

        console.error(
            "ADMIN COUNT ERROR:",
            admins.error
        );

    } else if (adminElement) {

        adminElement.textContent =
            admins.count || 0;
    }


    const pending =
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


    if (pending.error) {

        console.error(
            "PENDING COUNT ERROR:",
            pending.error
        );

    } else if (pendingElement) {

        pendingElement.textContent =
            pending.count || 0;
    }
}


/* =====================================================
   DELETE STUDENT
===================================================== */

async function deleteStudent(
    studentId,
    userId,
    button
) {

    if (!confirm(
        "Delete this student account?"
    )) {
        return;
    }


    button.disabled = true;
    button.textContent = "Deleting...";


    const {
        data,
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

        console.error(
            "DELETE STUDENT ERROR:",
            error
        );

        showMessage(
            "Delete failed: " +
            error.message,
            "error"
        );

        button.disabled = false;
        button.textContent = "Delete";

        return;
    }


    showMessage(
        data ||
        "Student deleted.",
        "success"
    );


    await loadStudents();
    await loadStatistics();
}


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "superAdminMessage"
        );

    if (!element) {
        console.log(message);
        return;
    }


    element.textContent =
        message;

    element.className =
        "super-admin-message " +
        type;


    setTimeout(() => {

        element.textContent = "";

        element.className =
            "super-admin-message";

    }, 6000);
}


/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(value) {

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


function formatDate(value) {

    if (!value) {
        return "—";
    }

    return new Date(value)
        .toLocaleDateString(
            "en-KE",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
}
```
