// ==========================================
// GRADE HUB ADMIN DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const studentTable =
    document.getElementById("studentTable");

const studentCount =
    document.getElementById("studentCount");

const resultCount =
    document.getElementById("resultCount");

const pendingCount =
    document.getElementById("pendingCount");

const searchStudent =
    document.getElementById("searchStudent");

const logoutButton =
    document.getElementById("logout");


// ==========================================
// CHECK ADMIN LOGIN
// ==========================================

async function checkAdmin() {

    try {

        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();


        // --------------------------------------
        // Authentication error
        // --------------------------------------

        if (authError) {

            console.error(
                "Authentication error:",
                authError
            );

            window.location.href =
                "index.html";

            return false;
        }


        // --------------------------------------
        // No logged-in user
        // --------------------------------------

        if (!authData || !authData.user) {

            console.log(
                "No authenticated user."
            );

            window.location.href =
                "index.html";

            return false;
        }


        const user =
            authData.user;


        console.log(
            "Logged in user:",
            user.email
        );


        // --------------------------------------
        // Get role
        // --------------------------------------

        const {
            data: roles,
            error: roleError
        } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);


        if (roleError) {

            console.error(
                "Role lookup error:",
                roleError
            );

            alert(
                "Unable to verify your account role: " +
                roleError.message
            );

            window.location.href =
                "index.html";

            return false;
        }


        // --------------------------------------
        // No role found
        // --------------------------------------

        if (!roles || roles.length === 0) {

            console.error(
                "No role found for:",
                user.id
            );

            alert(
                "No administrator role was found for this account."
            );

            window.location.href =
                "index.html";

            return false;
        }


        // --------------------------------------
        // Find admin role
        // --------------------------------------

        const isAdmin =
            roles.some(
                item =>
                    item.role === "admin"
            );


        const isSuperAdmin =
            roles.some(
                item =>
                    item.role === "super_admin"
            );


        // --------------------------------------
        // Check permission
        // --------------------------------------

        if (!isAdmin && !isSuperAdmin) {

            console.error(
                "User roles:",
                roles
            );

            alert(
                "This account does not have administrator permission."
            );

            window.location.href =
                "index.html";

            return false;
        }


        // --------------------------------------
        // Admin verified
        // --------------------------------------

        console.log(
            "Administrator access confirmed."
        );


        return true;

    }

    catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        window.location.href =
            "index.html";

        return false;
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
            <td colspan="5">
                Loading students...
            </td>
        </tr>
    `;


    try {

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
                optional_subjects,
                profiles(
                    full_name
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "Student loading error:",
                error
            );


            studentTable.innerHTML = `
                <tr>
                    <td colspan="5">
                        Unable to load students.
                    </td>
                </tr>
            `;

            return;
        }


        const studentList =
            students || [];


        // --------------------------------------
        // Student count
        // --------------------------------------

        if (studentCount) {

            studentCount.textContent =
                studentList.length;

        }


        // --------------------------------------
        // No students
        // --------------------------------------

        if (studentList.length === 0) {

            studentTable.innerHTML = `
                <tr>
                    <td colspan="5">
                        No students registered.
                    </td>
                </tr>
            `;

            return;
        }


        // --------------------------------------
        // Build table
        // --------------------------------------

        studentTable.innerHTML = "";


        studentList.forEach(student => {

            const profile =
                student.profiles || {};


            let subjects =
                student.optional_subjects;


            if (Array.isArray(subjects)) {

                subjects =
                    subjects.join(", ");

            }

            else if (!subjects) {

                subjects = "—";

            }


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
                        profile.full_name || "—"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        student.class || "—"
                    )}
                </td>

                <td>
                    ${escapeHTML(subjects)}
                </td>

                <td>

                    <button
                        class="btn upload-btn"
                        data-id="${escapeHTML(
                            student.id
                        )}">
                        Upload
                    </button>

                    <button
                        class="btn delete-btn"
                        data-id="${escapeHTML(
                            student.id
                        )}"
                        style="background:red">
                        Delete
                    </button>

                </td>
            `;


            studentTable.appendChild(row);

        });


        // --------------------------------------
        // Upload buttons
        // --------------------------------------

        document
            .querySelectorAll(".upload-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function() {

                        uploadResults(
                            this.dataset.id
                        );

                    }
                );

            });


        // --------------------------------------
        // Delete buttons
        // --------------------------------------

        document
            .querySelectorAll(".delete-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function() {

                        deleteStudent(
                            this.dataset.id
                        );

                    }
                );

            });

    }

    catch (error) {

        console.error(
            "Unexpected student error:",
            error
        );


        studentTable.innerHTML = `
            <tr>
                <td colspan="5">
                    Error loading students.
                </td>
            </tr>
        `;
    }
}



// ==========================================
// ESCAPE HTML
// ==========================================

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



// ==========================================
// SEARCH STUDENTS
// ==========================================

if (searchStudent) {

    searchStudent.addEventListener(
        "input",
        function(event) {

            const value =
                event.target.value
                    .toLowerCase()
                    .trim();


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
// OPEN UPLOAD PAGE
// ==========================================

function uploadResults(id) {

    localStorage.setItem(
        "selectedStudent",
        id
    );


    window.location.href =
        "upload.html";
}



// ==========================================
// DELETE STUDENT
// ==========================================

async function deleteStudent(id) {

    const confirmed =
        window.confirm(
            "Are you sure you want to delete this student?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabase
            .from("students")
            .delete()
            .eq("id", id);


        if (error) {

            console.error(
                "Delete student error:",
                error
            );

            alert(
                "Unable to delete student: " +
                error.message
            );

            return;
        }


        alert(
            "Student deleted successfully."
        );


        await loadStudents();

    }

    catch (error) {

        console.error(
            "Unexpected delete error:",
            error
        );


        alert(
            "An unexpected error occurred."
        );
    }
}



// ==========================================
// LOGOUT
// ==========================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function(event) {

            event.preventDefault();


            logoutButton.textContent =
                "Logging out...";


            logoutButton.style.pointerEvents =
                "none";


            const {
                error
            } =
                await supabase
                    .auth
                    .signOut();


            if (error) {

                console.error(
                    "Logout error:",
                    error
                );


                alert(
                    "Logout failed: " +
                    error.message
                );


                logoutButton.textContent =
                    "Logout";

                logoutButton.style.pointerEvents =
                    "auto";

                return;
            }


            window.location.href =
                "index.html";

        }
    );
}



// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

async function initializeDashboard() {

    console.log(
        "Initializing Grade Hub Admin Dashboard..."
    );


    const authorized =
        await checkAdmin();


    if (!authorized) {
        return;
    }


    await loadStudents();


    console.log(
        "Admin dashboard loaded successfully."
    );
}


initializeDashboard();
