import { supabase } from "./supabase.js";


// ==========================================
// AUTH CHECK
// ==========================================

async function checkAdmin() {

    const {
        data: {
            session
        }
    } = await supabase.auth.getSession();


    if (!session) {

        window.location.replace("index.html");

        return false;
    }


    const user = session.user;


    const {
        data: roles,
        error
    } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", user.id);


    if (error) {

        console.error(
            "Role loading error:",
            error
        );

        return false;
    }


    const allowed =
        (roles || []).some(
            role =>
                (
                    role.role === "admin" ||
                    role.role === "super_admin"
                ) &&
                role.approved !== false
        );


    if (!allowed) {

        window.location.replace("index.html");

        return false;
    }


    return true;
}


// ==========================================
// LOAD STUDENTS
// ==========================================

async function loadStudents() {

    const table =
        document.getElementById("studentTable");


    table.innerHTML = `
        <tr>
            <td colspan="5">
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
        .order("admission_number");


    if (error) {

        console.error(
            "Student loading error:",
            error
        );


        table.innerHTML = `
            <tr>
                <td colspan="5">
                    Unable to load students.
                    <br>
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        return;
    }


    console.log(
        "Students loaded:",
        students
    );


    if (!students || students.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5">
                    No students registered yet.
                </td>
            </tr>
        `;


        document.getElementById(
            "studentCount"
        ).textContent = "0";


        return;
    }


    // ======================================
    // LOAD PROFILES
    // ======================================

    const userIds =
        students
            .map(student => student.user_id)
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
            .in("id", userIds);


        if (profileError) {

            console.error(
                "Profile loading error:",
                profileError
            );

        } else {

            profiles = data || [];
        }
    }


    const profileMap =
        new Map(
            profiles.map(
                profile =>
                    [
                        profile.id,
                        profile
                    ]
            )
        );


    // ======================================
    // DISPLAY
    // ======================================

    table.innerHTML = "";


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
                    class="btn"
                    data-upload="${student.id}"
                >
                    Upload
                </button>

                <button
                    class="btn"
                    data-delete="${student.id}"
                    style="background:#dc2626"
                >
                    Delete
                </button>

            </td>

        `;


        table.appendChild(row);

    });


    document.getElementById(
        "studentCount"
    ).textContent =
        students.length;


    // ======================================
    // BUTTON EVENTS
    // ======================================

    document
        .querySelectorAll(
            "[data-upload]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.upload;


                    localStorage.setItem(
                        "selectedStudent",
                        id
                    );


                    window.location.href =
                        "upload.html";

                }
            );

        });


    document
        .querySelectorAll(
            "[data-delete]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteStudent(
                        button.dataset.delete
                    );

                }
            );

        });

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


    const {
        error
    } = await supabase
        .from("students")
        .delete()
        .eq("id", id);


    if (error) {

        alert(
            "Delete failed: " +
            error.message
        );

        return;
    }


    alert(
        "Student deleted successfully."
    );


    loadStudents();
}


// ==========================================
// SEARCH
// ==========================================

const search =
    document.getElementById(
        "searchStudent"
    );


if (search) {

    search.addEventListener(
        "input",
        event => {

            const value =
                event.target.value
                    .toLowerCase();


            document
                .querySelectorAll(
                    "#studentTable tr"
                )
                .forEach(row => {

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

const logout =
    document.getElementById(
        "logout"
    );


if (logout) {

    logout.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            await supabase.auth.signOut();


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

(async function () {

    const allowed =
        await checkAdmin();


    if (allowed) {

        await loadStudents();

    }

})();
