// ==========================================
// GRADE HUB - ADMIN DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const studentTable =
    document.getElementById("studentTable");

const studentCount =
    document.getElementById("studentCount");

const searchStudent =
    document.getElementById("searchStudent");

const logoutButton =
    document.getElementById("logout");


// ==========================================
// CHECK ADMIN SESSION
// ==========================================

async function checkAdminAccess() {

    const {
        data: {
            session
        },
        error: sessionError
    } = await supabase.auth.getSession();


    if (sessionError) {

        console.error(
            "Session error:",
            sessionError
        );

        window.location.replace(
            "index.html"
        );

        return false;
    }


    if (!session) {

        console.log(
            "No active session."
        );

        window.location.replace(
            "index.html"
        );

        return false;
    }


    const userId =
        session.user.id;


    console.log(
        "Admin user:",
        userId
    );


    // ======================================
    // GET ROLES
    // ======================================

    const {
        data: roles,
        error: roleError
    } = await supabase
        .from("user_roles")
        .select(`
            role,
            approved
        `)
        .eq(
            "user_id",
            userId
        );


    if (roleError) {

        console.error(
            "Role error:",
            roleError
        );


        /*
         * Do NOT immediately sign the user out.
         *
         * This prevents the dashboard from
         * appearing to log in and immediately
         * log out because of a role query issue.
         */

        showAccessError(
            "Unable to verify your administrator role."
        );

        return false;
    }


    console.log(
        "User roles:",
        roles
    );


    // ======================================
    // FIND APPROVED ADMIN ROLE
    // ======================================

    const adminRole =
        (roles || []).find(
            item =>
                (
                    item.role === "admin" ||
                    item.role === "super_admin"
                ) &&
                item.approved !== false
        );


    if (!adminRole) {

        console.error(
            "No approved admin role found.",
            roles
        );


        showAccessError(
            "This account does not have an approved administrator role."
        );

        return false;
    }


    console.log(
        "Administrator access confirmed:",
        adminRole
    );


    return true;
}


// ==========================================
// ACCESS ERROR
// ==========================================

function showAccessError(message) {

    if (studentTable) {

        studentTable.innerHTML = `
            <tr>
                <td colspan="5"
                    style="
                        text-align:center;
                        padding:25px;
                        color:#991b1b;
                    ">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;

    }

}


// ==========================================
// LOAD STUDENTS
// ==========================================

async function loadStudents() {

    if (!studentTable) {
        return;
    }


    studentTable.innerHTML = `
        <tr>
            <td colspan="5"
                style="
                    text-align:center;
                    padding:25px;
                ">
                Loading students...
            </td>
        </tr>
    `;


    const {
        data: students,
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
            "Student loading error:",
            error
        );


        studentTable.innerHTML = `
            <tr>
                <td colspan="5"
                    style="
                        text-align:center;
                        padding:25px;
                        color:#991b1b;
                    ">
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;

        return;
    }


    console.log(
        "Students:",
        students
    );


    if (!students || students.length === 0) {

        studentTable.innerHTML = `
            <tr>
                <td colspan="5"
                    style="
                        text-align:center;
                        padding:25px;
                    ">
                    No students registered yet.
                </td>
            </tr>
        `;


        if (studentCount) {
            studentCount.textContent = "0";
        }


        return;
    }


    // ======================================
    // LOAD PROFILES
    // ======================================

    const userIds =
        students
            .map(
                student =>
                    student.user_id
            )
            .filter(Boolean);


    let profiles = [];


    if (userIds.length > 0) {

        const {
            data,
            error: profileError
        } = await supabase
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


        if (profileError) {

            console.error(
                "Profile loading error:",
                profileError
            );

        } else {

            profiles =
                data || [];

        }
    }


    const profileMap =
        new Map(
            profiles.map(
                profile => [
                    profile.id,
                    profile
                ]
            )
        );


    // ======================================
    // DISPLAY STUDENTS
    // ======================================

    studentTable.innerHTML = "";


    students.forEach(student => {

        const profile =
            profileMap.get(
                student.user_id
            ) || {};


        const subjects =
            Array.isArray(
                student.optional_subjects
            )
                ? student.optional_subjects
                : [];


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    student.admission_number || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    profile.full_name || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.class || "-"
                )}
            </td>

            <td>
                ${
                    subjects.length
                        ? subjects
                            .map(
                                escapeHTML
                            )
                            .join(", ")
                        : "-"
                }
            </td>

            <td>

                <button
                    class="btn upload-student"
                    data-id="${escapeHTML(
                        student.id
                    )}"
                >
                    Upload
                </button>

                <button
                    class="btn delete-student"
                    data-id="${escapeHTML(
                        student.id
                    )}"
                    style="background:#dc2626"
                >
                    Delete
                </button>

            </td>

        `;


        studentTable.appendChild(row);

    });


    if (studentCount) {

        studentCount.textContent =
            students.length;

    }


    // ======================================
    // UPLOAD BUTTONS
    // ======================================

    document
        .querySelectorAll(
            ".upload-student"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const studentId =
                        button.dataset.id;


                    localStorage.setItem(
                        "selectedStudent",
                        studentId
                    );


                    window.location.href =
                        "upload.html";

                }
            );

        });


    // ======================================
    // DELETE BUTTONS
    // ======================================

    document
        .querySelectorAll(
            ".delete-student"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await deleteStudent(
                        button.dataset.id
                    );

                }
            );

        });

}


// ==========================================
// DELETE STUDENT
// ==========================================

async function deleteStudent(studentId) {

    if (!studentId) {
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this student?"
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabase
        .from("students")
        .delete()
        .eq(
            "id",
            studentId
        );


    if (error) {

        console.error(
            "Delete error:",
            error
        );


        alert(
            "Delete failed: " +
            error.message
        );

        return;
    }


    alert(
        "Student deleted successfully."
    );


    await loadStudents();

}


// ==========================================
// SEARCH
// ==========================================

if (searchStudent) {

    searchStudent.addEventListener(
        "input",
        event => {

            const value =
                event.target.value
                    .trim()
                    .toLowerCase();


            const rows =
                document.querySelectorAll(
                    "#studentTable tr"
                );


            rows.forEach(row => {

                row.style.display =
                    row.textContent
                        .toLowerCase()
                        .includes(value)
                        ? ""
                        : "none";

            });

        }
    );

}


// ==========================================
// LOGOUT
// ==========================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            logoutButton.textContent =
                "Logging out...";


            logoutButton.style.pointerEvents =
                "none";


            const {
                error
            } =
                await supabase.auth.signOut();


            if (error) {

                console.error(
                    "Logout error:",
                    error
                );


                logoutButton.textContent =
                    "Logout";

                logoutButton.style.pointerEvents =
                    "auto";

                return;
            }


            window.location.replace(
                "index.html"
            );

        }
    );

}


// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// START
// ==========================================

async function startAdminDashboard() {

    const allowed =
        await checkAdminAccess();


    if (!allowed) {
        return;
    }


    await loadStudents();

}


startAdminDashboard();
