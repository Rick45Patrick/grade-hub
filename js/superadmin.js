```javascript
import { supabase } from "./supabase.js";


// ============================================
// START
// ============================================

document.addEventListener("DOMContentLoaded", async () => {

    setupLogout();
    setupRefresh();

    const { data, error } =
        await supabase.auth.getSession();

    if (error) {
        console.error("Session error:", error);
        return;
    }

    if (!data.session) {
        window.location.href = "index.html";
        return;
    }

    console.log("Super Admin logged in:", data.session.user.id);

    loadAdminRequests();
    loadStudents();
    loadStatistics();
});


// ============================================
// LOGOUT
// ============================================

function setupLogout() {

    const button =
        document.getElementById("logoutButton");

    if (!button) {
        console.error("logoutButton not found");
        return;
    }

    button.addEventListener("click", async () => {

        console.log("Signing out...");

        const { error } =
            await supabase.auth.signOut();

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "Logout failed: " +
                error.message
            );

            return;
        }

        window.location.href =
            "index.html";
    });
}


// ============================================
// REFRESH
// ============================================

function setupRefresh() {

    const button =
        document.getElementById(
            "refreshDashboard"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            loadAdminRequests();
            loadStudents();
            loadStatistics();

        }
    );
}


// ============================================
// ADMIN REQUESTS
// ============================================

async function loadAdminRequests() {

    const table =
        document.getElementById(
            "adminRequests"
        );

    if (!table) {

        console.error(
            "adminRequests element not found"
        );

        return;
    }

    table.innerHTML =
        "<tr><td colspan='6'>Loading...</td></tr>";


    const { data, error } =
        await supabase
            .from("admin_requests")
            .select("*")
            .eq("status", "pending")
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

        table.innerHTML =
            `<tr>
                <td colspan="6">
                    Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;

        return;
    }


    console.log(
        "Admin requests:",
        data
    );


    if (!data || data.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="6">
                    No pending administrator requests.
                </td>
            </tr>`;

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
                    class="approve-btn"
                    data-id="${request.id}"
                >
                    Approve
                </button>

                <button
                    class="reject-btn"
                    data-id="${request.id}"
                >
                    Reject
                </button>

            </td>
        `;


        table.appendChild(row);
    });


    document
        .querySelectorAll(".approve-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    approveRequest(
                        button.dataset.id
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

                    rejectRequest(
                        button.dataset.id
                    );

                }
            );

        });
}


// ============================================
// APPROVE
// ============================================

async function approveRequest(requestId) {

    const confirmed =
        confirm(
            "Approve this administrator request?"
        );

    if (!confirmed) {
        return;
    }


    console.log(
        "Approving:",
        requestId
    );


    const { data, error } =
        await supabase.rpc(
            "approve_admin_request",
            {
                request_id: requestId
            }
        );


    console.log(
        "Approval response:",
        data
    );

    console.log(
        "Approval error:",
        error
    );


    if (error) {

        alert(
            "Approval failed:\n\n" +
            error.message
        );

        return;
    }


    alert(
        "Administrator approved successfully."
    );


    await loadAdminRequests();
    await loadStudents();
    await loadStatistics();
}


// ============================================
// REJECT
// ============================================

async function rejectRequest(requestId) {

    const confirmed =
        confirm(
            "Reject this administrator request?"
        );

    if (!confirmed) {
        return;
    }


    const { data, error } =
        await supabase.rpc(
            "reject_admin_request",
            {
                request_id: requestId
            }
        );


    if (error) {

        console.error(
            "Reject error:",
            error
        );

        alert(
            "Rejection failed:\n\n" +
            error.message
        );

        return;
    }


    alert(
        "Request rejected."
    );


    await loadAdminRequests();
    await loadStatistics();
}


// ============================================
// STUDENTS
// ============================================

async function loadStudents() {

    const table =
        document.getElementById(
            "studentTable"
        );

    if (!table) {

        console.error(
            "studentTable not found"
        );

        return;
    }


    table.innerHTML =
        "<tr><td colspan='6'>Loading students...</td></tr>";


    const { data, error } =
        await supabase
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
            "Student error:",
            error
        );

        table.innerHTML =
            `<tr>
                <td colspan="6">
                    Error: ${escapeHTML(error.message)}
                </td>
            </tr>`;

        return;
    }


    console.log(
        "Students:",
        data
    );


    if (!data || data.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="6">
                    No students registered.
                </td>
            </tr>`;

        return;
    }


    table.innerHTML = "";


    const userIds =
        data
            .map(student => student.user_id)
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const result =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, username"
                )
                .in(
                    "id",
                    userIds
                );


        if (result.error) {

            console.error(
                "Profile error:",
                result.error
            );

        } else {

            profiles =
                result.data || [];
        }
    }


    data.forEach(student => {

        const profile =
            profiles.find(
                p =>
                    p.id ===
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
            student.optional_subjects
        ) {

            subjects =
                String(
                    student.optional_subjects
                );
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
                    class="delete-student-btn"
                    data-id="${student.id}"
                >
                    Delete
                </button>
            </td>

        `;


        table.appendChild(row);
    });
}


// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {

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

        totalStudents.textContent =
            students.count || 0;
    }


    if (totalAdmins) {

        totalAdmins.textContent =
            admins.count || 0;
    }


    if (pendingAdmins) {

        pendingAdmins.textContent =
            pending.count || 0;
    }


    if (students.error) {

        console.error(
            "Student count error:",
            students.error
        );

    }


    if (admins.error) {

        console.error(
            "Admin count error:",
            admins.error
        );

    }


    if (pending.error) {

        console.error(
            "Pending count error:",
            pending.error
        );

    }
}


// ============================================
// HELPERS
// ============================================

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
