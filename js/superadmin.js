```javascript
import { supabase } from "./supabase.js";

/*
====================================================
GRADE HUB - SUPER ADMIN
====================================================

Expected HTML IDs:

#logoutButton
#refreshDashboard
#saMessage

#totalStudents
#totalAdmins
#pendingAdmins

#adminRequests
#approvedAdmins
#studentTable

Database tables:

profiles
user_roles
admin_requests
students

RPC:

approve_admin_request(request_id uuid)
====================================================
*/


/* ==================================================
   ELEMENTS
================================================== */

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


/* ==================================================
   MESSAGE
================================================== */

function showMessage(text, type = "success") {

    if (!messageBox) return;

    messageBox.textContent = text;

    messageBox.className =
        "sa-message show " + type;

}


function clearMessage() {

    if (!messageBox) return;

    messageBox.textContent = "";

    messageBox.className =
        "sa-message";

}


/* ==================================================
   HTML ESCAPE
================================================== */

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


/* ==================================================
   DATE FORMAT
================================================== */

function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


/* ==================================================
   SUBJECT FORMAT
================================================== */

function formatSubjects(subjects) {

    if (!subjects) {
        return "—";
    }


    if (Array.isArray(subjects)) {

        if (subjects.length === 0) {
            return "—";
        }

        return subjects
            .map(subject => escapeHTML(subject))
            .join(", ");

    }


    if (typeof subjects === "string") {

        try {

            const parsed =
                JSON.parse(subjects);

            if (Array.isArray(parsed)) {

                return parsed
                    .map(subject => escapeHTML(subject))
                    .join(", ");

            }

        } catch (error) {
            // Not JSON; use the original value.
        }

        return escapeHTML(subjects);

    }


    return escapeHTML(subjects);

}


/* ==================================================
   CHECK CURRENT USER
================================================== */

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getUser();


    if (error) {

        console.error(
            "Authentication error:",
            error
        );

        return null;

    }


    return data?.user || null;

}


/* ==================================================
   VERIFY SUPER ADMIN
================================================== */

async function verifySuperAdmin(user) {

    if (!user) {
        return false;
    }


    /*
       Look for a super_admin role belonging
       to the currently logged-in user.
    */

    const {
        data,
        error
    } =
        await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);


    if (error) {

        console.error(
            "Role check failed:",
            error
        );

        return false;

    }


    const roles =
        data || [];


    return roles.some(
        row =>
            row.role === "super_admin"
    );

}


/* ==================================================
   LOAD DASHBOARD
================================================== */

async function loadDashboard() {

    clearMessage();

    setLoadingState();


    try {

        const user =
            await getCurrentUser();


        if (!user) {

            window.location.href =
                "index.html";

            return;

        }


        /*
         * Verify Super Admin
         */

        const isSuperAdmin =
            await verifySuperAdmin(user);


        if (!isSuperAdmin) {

            showMessage(
                "You do not have Super Admin permission.",
                "error"
            );

            return;

        }


        /*
         * Load all sections
         */

        await Promise.all([
            loadStudents(),
            loadApprovedAdmins(),
            loadAdminRequests()
        ]);


    }

    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );


        showMessage(
            error.message ||
            "Failed to load dashboard.",
            "error"
        );

    }

}


/* ==================================================
   LOADING STATE
================================================== */

function setLoadingState() {

    if (adminRequests) {

        adminRequests.innerHTML =
            `<tr>
                <td colspan="6" class="sa-empty">
                    Loading...
                </td>
            </tr>`;

    }


    if (approvedAdmins) {

        approvedAdmins.innerHTML =
            `<tr>
                <td colspan="4" class="sa-empty">
                    Loading...
                </td>
            </tr>`;

    }


    if (studentTable) {

        studentTable.innerHTML =
            `<tr>
                <td colspan="5" class="sa-empty">
                    Loading...
                </td>
            </tr>`;

    }

}


/* ==================================================
   LOAD APPROVED ADMINS
================================================== */

async function loadApprovedAdmins() {

    const {
        data,
        error
    } =
        await supabase
            .from("user_roles")
            .select(`
                user_id,
                role,
                profiles (
                    full_name,
                    username,
                    email
                )
            `)
            .eq("role", "admin");


    if (error) {

        console.error(
            "Approved admins error:",
            error
        );


        approvedAdmins.innerHTML =
            `<tr>
                <td colspan="4" class="sa-empty">
                    Failed to load administrators.
                </td>
            </tr>`;


        throw error;

    }


    const admins =
        data || [];


    totalAdmins.textContent =
        admins.length;


    if (admins.length === 0) {

        approvedAdmins.innerHTML =
            `<tr>
                <td colspan="4" class="sa-empty">
                    No approved administrators found.
                </td>
            </tr>`;

        return;

    }


    approvedAdmins.innerHTML =
        admins.map(admin => {

            const profile =
                admin.profiles || {};


            return `
                <tr>

                    <td>
                        ${escapeHTML(
                            profile.full_name ||
                            "Unknown"
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
                        <span class="sa-status approved">
                            Approved
                        </span>
                    </td>

                </tr>
            `;

        }).join("");

}


/* ==================================================
   LOAD ADMIN REQUESTS
================================================== */

async function loadAdminRequests() {

    const {
        data,
        error
    } =
        await supabase
            .from("admin_requests")
            .select(`
                id,
                user_id,
                full_name,
                username,
                email,
                status,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Admin requests error:",
            error
        );


        adminRequests.innerHTML =
            `<tr>
                <td colspan="6" class="sa-empty">
                    Failed to load administrator requests.
                </td>
            </tr>`;


        throw error;

    }


    const requests =
        data || [];


    const pending =
        requests.filter(
            request =>
                request.status === "pending"
        );


    pendingAdmins.textContent =
        pending.length;


    if (requests.length === 0) {

        adminRequests.innerHTML =
            `<tr>
                <td colspan="6" class="sa-empty">
                    No administrator requests found.
                </td>
            </tr>`;

        return;

    }


    adminRequests.innerHTML =
        requests.map(request => {

            const isPending =
                request.status === "pending";


            const statusClass =
                request.status === "approved"
                    ? "approved"
                    : "pending";


            let actions = "—";


            if (isPending) {

                actions = `
                    <button
                        class="sa-btn approve"
                        data-action="approve"
                        data-id="${escapeHTML(request.id)}"
                    >
                        Approve
                    </button>

                    <button
                        class="sa-btn reject"
                        data-action="reject"
                        data-id="${escapeHTML(request.id)}"
                    >
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
                        <span class="sa-status ${statusClass}">
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


/* ==================================================
   LOAD STUDENTS
================================================== */

async function loadStudents() {

    /*
     * We load students first.
     * Then separately load profiles.
     *
     * This avoids depending on a foreign-key
     * relationship being correctly exposed
     * by Supabase.
     */

    const {
        data: students,
        error: studentError
    } =
        await supabase
            .from("students")
            .select(`
                id,
                user_id,
                admission_number,
                class,
                optional_subjects,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (studentError) {

        console.error(
            "Students error:",
            studentError
        );


        studentTable.innerHTML =
            `<tr>
                <td colspan="5" class="sa-empty">
                    Failed to load students.
                </td>
            </tr>`;


        throw studentError;

    }


    const studentRows =
        students || [];


    totalStudents.textContent =
        studentRows.length;


    if (studentRows.length === 0) {

        studentTable.innerHTML =
            `<tr>
                <td colspan="5" class="sa-empty">
                    No students registered yet.
                </td>
            </tr>`;

        return;

    }


    /*
     * Collect user IDs
     */

    const userIds =
        studentRows
            .map(student => student.user_id)
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    username,
                    email
                `)
                .in(
                    "id",
                    userIds
                );


        if (error) {

            console.error(
                "Student profiles error:",
                error
            );

        }
        else {

            profiles =
                data || [];

        }

    }


    /*
     * Create profile lookup
     */

    const profileMap =
        new Map();


    profiles.forEach(profile => {

        profileMap.set(
            profile.id,
            profile
        );

    });


    /*
     * Render students
     */

    studentTable.innerHTML =
        studentRows.map(student => {

            const profile =
                profileMap.get(
                    student.user_id
                ) || {};


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

        }).join("");

}


/* ==================================================
   APPROVE ADMIN
================================================== */

async function approveAdmin(requestId) {

    if (!requestId) {

        showMessage(
            "Invalid administrator request.",
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


    try {

        showMessage(
            "Approving administrator...",
            "success"
        );


        /*
         * Call your existing RPC.
         */

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

            throw error;

        }


        console.log(
            "Approval result:",
            data
        );


        showMessage(
            data ||
            "Administrator approved successfully.",
            "success"
        );


        /*
         * Reload both requests and
         * administrator list.
         */

        await Promise.all([
            loadAdminRequests(),
            loadApprovedAdmins()
        ]);

    }

    catch (error) {

        console.error(
            "Approval failed:",
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


/* ==================================================
   REJECT ADMIN
================================================== */

async function rejectAdmin(requestId) {

    if (!requestId) {

        showMessage(
            "Invalid administrator request.",
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


    try {

        const {
            error
        } =
            await supabase
                .from("admin_requests")
                .update({
                    status: "rejected"
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
            "Rejection error:",
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


/* ==================================================
   ADMIN REQUEST BUTTON HANDLER
================================================== */

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


            const requestId =
                button.dataset.id;


            button.disabled = true;


            try {

                if (
                    action === "approve"
                ) {

                    await approveAdmin(
                        requestId
                    );

                }


                if (
                    action === "reject"
                ) {

                    await rejectAdmin(
                        requestId
                    );

                }

            }

            finally {

                button.disabled = false;

            }

        }
    );

}


/* ==================================================
   REFRESH
================================================== */

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;

            refreshButton.textContent =
                "Refreshing...";


            try {

                await loadDashboard();

            }

            finally {

                refreshButton.disabled =
                    false;

                refreshButton.textContent =
                    "Refresh";

            }

        }
    );

}


/* ==================================================
   SIGN OUT
================================================== */

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


            try {

                const {
                    error
                } =
                    await supabase.auth.signOut();


                if (error) {

                    throw error;

                }


                window.location.href =
                    "index.html";

            }

            catch (error) {

                console.error(
                    "Sign out error:",
                    error
                );


                showMessage(
                    "Sign out failed: " +
                    (
                        error.message ||
                        "Unknown error"
                    ),
                    "error"
                );


                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Sign out";

            }

        }
    );

}


/* ==================================================
   INITIAL LOAD
================================================== */

loadDashboard();
```
