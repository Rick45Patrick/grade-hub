import { supabase } from "./supabase.js";

const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshDashboard");

const messageBox = document.getElementById("saMessage");

const totalStudents = document.getElementById("totalStudents");
const totalAdmins = document.getElementById("totalAdmins");
const pendingAdmins = document.getElementById("pendingAdmins");

const adminRequests = document.getElementById("adminRequests");
const approvedAdmins = document.getElementById("approvedAdmins");
const studentTable = document.getElementById("studentTable");


/* =========================
   MESSAGE
========================= */

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.className = "sa-message show " + type;
}


/* =========================
   HTML SAFETY
========================= */

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   DATE
========================= */

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString();
}


/* =========================
   SUBJECTS
========================= */

function formatSubjects(subjects) {
    if (!subjects) {
        return "—";
    }

    if (Array.isArray(subjects)) {
        return subjects
            .map(subject => escapeHTML(subject))
            .join(", ");
    }

    return escapeHTML(subjects);
}


/* =========================
   CHECK LOGIN
========================= */

async function checkLogin() {

    const { data, error } =
        await supabase.auth.getUser();

    if (error) {
        console.error("Auth error:", error);
        return null;
    }

    return data.user;
}


/* =========================
   LOAD APPROVED ADMINS
========================= */

async function loadApprovedAdmins() {

    approvedAdmins.innerHTML = `
        <tr>
            <td colspan="4" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

    if (error) {
        console.error("Admin role error:", error);

        approvedAdmins.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Failed to load administrators.
                </td>
            </tr>
        `;

        return;
    }

    if (!data || data.length === 0) {

        totalAdmins.textContent = "0";

        approvedAdmins.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    No approved administrators.
                </td>
            </tr>
        `;

        return;
    }


    /* Get profile IDs */

    const userIds = data.map(row => row.user_id);


    const { data: profiles, error: profileError } =
        await supabase
            .from("profiles")
            .select("id, full_name, username, email")
            .in("id", userIds);


    if (profileError) {
        console.error(
            "Admin profiles error:",
            profileError
        );

        approvedAdmins.innerHTML = `
            <tr>
                <td colspan="4" class="sa-empty">
                    Administrators found, but profiles could not be loaded.
                </td>
            </tr>
        `;

        return;
    }


    const profileMap = {};

    (profiles || []).forEach(profile => {
        profileMap[profile.id] = profile;
    });


    totalAdmins.textContent = data.length;


    approvedAdmins.innerHTML = data.map(row => {

        const profile = profileMap[row.user_id] || {};

        return `
            <tr>
                <td>
                    ${escapeHTML(profile.full_name || "—")}
                </td>

                <td>
                    ${escapeHTML(profile.username || "—")}
                </td>

                <td>
                    ${escapeHTML(profile.email || "—")}
                </td>

                <td>
                    <span class="sa-status approved">
                        Approved
                    </span>
                </td>
            </tr>
        `;

    }).join("");
}


/* =========================
   LOAD ADMIN REQUESTS
========================= */

async function loadAdminRequests() {

    adminRequests.innerHTML = `
        <tr>
            <td colspan="6" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;


    const { data, error } =
        await supabase
            .from("admin_requests")
            .select("*")
            .order("created_at", {
                ascending: false
            });


    if (error) {

        console.error(
            "Admin request error:",
            error
        );

        adminRequests.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    Failed to load requests.
                </td>
            </tr>
        `;

        return;
    }


    const requests = data || [];


    const pending = requests.filter(
        request => request.status === "pending"
    );


    pendingAdmins.textContent =
        pending.length;


    if (requests.length === 0) {

        adminRequests.innerHTML = `
            <tr>
                <td colspan="6" class="sa-empty">
                    No administrator requests.
                </td>
            </tr>
        `;

        return;
    }


    adminRequests.innerHTML = requests.map(request => {

        let actions = "—";


        if (request.status === "pending") {

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
            request.status === "approved"
                ? "approved"
                : "pending";


        return `
            <tr>

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
                    <span class="sa-status ${statusClass}">
                        ${escapeHTML(
                            request.status || "unknown"
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


/* =========================
   LOAD STUDENTS
========================= */

async function loadStudents() {

    studentTable.innerHTML = `
        <tr>
            <td colspan="5" class="sa-empty">
                Loading...
            </td>
        </tr>
    `;


    const { data: students, error } =
        await supabase
            .from("students")
            .select(
                "id, user_id, admission_number, class, optional_subjects, created_at"
            )
            .order("created_at", {
                ascending: false
            });


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


    const studentList =
        students || [];


    totalStudents.textContent =
        studentList.length;


    if (studentList.length === 0) {

        studentTable.innerHTML = `
            <tr>
                <td colspan="5" class="sa-empty">
                    No students registered yet.
                </td>
            </tr>
        `;

        return;
    }


    const userIds =
        studentList
            .map(student => student.user_id)
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const result =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, username, email"
                )
                .in("id", userIds);


        if (result.error) {

            console.error(
                "Student profile error:",
                result.error
            );

        } else {

            profiles =
                result.data || [];

        }
    }


    const profileMap = {};


    profiles.forEach(profile => {

        profileMap[profile.id] =
            profile;

    });


    studentTable.innerHTML =
        studentList.map(student => {

            const profile =
                profileMap[student.user_id] || {};


            return `
                <tr>

                    <td>
                        ${escapeHTML(
                            student.admission_number || "—"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            profile.full_name || "—"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            student.class || "—"
                        )}
                    </td>

                    <td>
                        ${formatSubjects(
                            student.optional_subjects
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            profile.username || "—"
                        )}
                    </td>

                </tr>
            `;

        }).join("");
}


/* =========================
   APPROVE
========================= */

async function approveAdmin(requestId) {

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


        const { data, error } =
            await supabase.rpc(
                "approve_admin_request",
                {
                    request_id: requestId
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

    }

    catch (error) {

        console.error(
            "Approval error:",
            error
        );


        showMessage(
            "Approval failed: " +
            (error.message || "Unknown error"),
            "error"
        );
    }
}


/* =========================
   REJECT
========================= */

async function rejectAdmin(requestId) {

    const confirmed =
        window.confirm(
            "Reject this administrator request?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const { error } =
            await supabase
                .from("admin_requests")
                .update({
                    status: "rejected"
                })
                .eq("id", requestId);


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
            (error.message || "Unknown error"),
            "error"
        );
    }
}


/* =========================
   REQUEST BUTTONS
========================= */

adminRequests.addEventListener(
    "click",
    async function(event) {

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


        if (action === "approve") {

            await approveAdmin(id);

        }


        if (action === "reject") {

            await rejectAdmin(id);

        }


        button.disabled = false;

    }
);


/* =========================
   REFRESH
========================= */

refreshButton.addEventListener(
    "click",
    async function() {

        refreshButton.disabled = true;

        refreshButton.textContent =
            "Refreshing...";


        await loadDashboard();


        refreshButton.disabled = false;

        refreshButton.textContent =
            "Refresh";

    }
);


/* =========================
   SIGN OUT
========================= */

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


        logoutButton.disabled = true;

        logoutButton.textContent =
            "Signing out...";


        const { error } =
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


            logoutButton.disabled = false;

            logoutButton.textContent =
                "Sign out";

            return;
        }


        window.location.href =
            "index.html";
    }
);


/* =========================
   MAIN DASHBOARD
========================= */

async function loadDashboard() {

    try {

        const user =
            await checkLogin();


        if (!user) {

            window.location.href =
                "index.html";

            return;
        }


        await Promise.all([
            loadApprovedAdmins(),
            loadAdminRequests(),
            loadStudents()
        ]);


    }

    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );


        showMessage(
            "Dashboard error: " +
            (error.message || "Unknown error"),
            "error"
        );
    }
}


/* =========================
   START
========================= */

loadDashboard();
