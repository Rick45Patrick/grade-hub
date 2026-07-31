// ==========================================
// GRADE HUB - STUDENT DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const profileBox =
    document.getElementById("studentProfile");

const resultTable =
    document.getElementById("resultTable");

const averageMarks =
    document.getElementById("averageMarks");

const overallGrade =
    document.getElementById("overallGrade");

const subjectCount =
    document.getElementById("subjectCount");

const logoutButton =
    document.getElementById("logout");


// ==========================================
// PAGE MESSAGE
// ==========================================

function showProfileMessage(message) {

    if (profileBox) {
        profileBox.textContent = message;
    }

}


// ==========================================
// GET CURRENT USER
// ==========================================

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


// ==========================================
// CHECK STUDENT ROLE
// ==========================================

async function checkStudentRole(userId) {

    const {
        data: roles,
        error
    } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", userId);


    if (error) {

        console.error(
            "Role error:",
            error
        );

        return null;
    }


    /*
     * Find an approved student role.
     *
     * Some existing accounts may have more
     * than one role, so we don't use .single().
     */

    const studentRole =
        (roles || []).find(
            role =>
                role.role === "student" &&
                role.approved !== false
        );


    return studentRole || null;
}


// ==========================================
// LOAD STUDENT PROFILE
// ==========================================

async function loadStudentProfile(userId) {

    const {
        data: profile,
        error: profileError
    } =
        await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                username,
                email
            `)
            .eq("id", userId)
            .maybeSingle();


    if (profileError) {

        console.error(
            "Profile error:",
            profileError
        );

        throw profileError;
    }


    const {
        data: student,
        error: studentError
    } =
        await supabase
            .from("students")
            .select(`
                id,
                admission_number,
                class,
                optional_subjects
            `)
            .eq("user_id", userId)
            .maybeSingle();


    if (studentError) {

        console.error(
            "Student error:",
            studentError
        );

        throw studentError;
    }


    if (!profile) {

        throw new Error(
            "Your profile could not be found."
        );
    }


    if (!student) {

        throw new Error(
            "Your student record could not be found."
        );
    }


    const subjects =
        Array.isArray(student.optional_subjects)
            ? student.optional_subjects
            : [];


    profileBox.innerHTML = `

        <div class="profile-details">

            <p>
                <strong>Name:</strong>
                ${escapeHTML(profile.full_name || "-")}
            </p>

            <p>
                <strong>Username:</strong>
                ${escapeHTML(profile.username || "-")}
            </p>

            <p>
                <strong>Email:</strong>
                ${escapeHTML(profile.email || "-")}
            </p>

            <p>
                <strong>Admission:</strong>
                ${escapeHTML(student.admission_number || "-")}
            </p>

            <p>
                <strong>Class:</strong>
                ${escapeHTML(student.class || "-")}
            </p>

            <p>
                <strong>Optional Subjects:</strong>
                ${
                    subjects.length
                        ? subjects.map(escapeHTML).join(", ")
                        : "None"
                }
            </p>

        </div>

    `;


    subjectCount.textContent =
        subjects.length;


    return {
        profile,
        student
    };
}


// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults(userId) {

    /*
     * Results are connected through student_id.
     */

    const {
        data: student,
        error: studentError
    } =
        await supabase
            .from("students")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();


    if (studentError) {

        console.error(
            "Student lookup error:",
            studentError
        );

        return;
    }


    if (!student) {

        resultTable.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    Student record not found.
                </td>
            </tr>
        `;

        return;
    }


    /*
     * Try loading the results.
     *
     * The query assumes the results table contains:
     * student_id
     * subject
     * marks
     */

    const {
        data: results,
        error: resultError
    } =
        await supabase
            .from("results")
            .select(`
                id,
                subject,
                marks
            `)
            .eq("student_id", student.id)
            .order("subject");


    if (resultError) {

        console.error(
            "Results error:",
            resultError
        );


        resultTable.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    No results available yet.
                </td>
            </tr>
        `;


        averageMarks.textContent =
            "0%";

        overallGrade.textContent =
            "-";

        return;
    }


    if (!results || results.length === 0) {

        resultTable.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    No results have been uploaded yet.
                </td>
            </tr>
        `;


        averageMarks.textContent =
            "0%";

        overallGrade.textContent =
            "-";

        return;
    }


    // ======================================
    // DISPLAY RESULTS
    // ======================================

    resultTable.innerHTML = "";


    const marksArray = [];


    results.forEach(result => {

        const marks =
            Number(result.marks);


        if (!Number.isNaN(marks)) {

            marksArray.push(marks);

        }


        const grade =
            getGrade(marks);


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(result.subject || "-")}
            </td>

            <td>
                ${Number.isNaN(marks) ? "-" : marks}
            </td>

            <td>
                ${grade}
            </td>

        `;


        resultTable.appendChild(row);

    });


    // ======================================
    // AVERAGE
    // ======================================

    if (marksArray.length === 0) {

        averageMarks.textContent =
            "0%";

        overallGrade.textContent =
            "-";

        return;
    }


    const total =
        marksArray.reduce(
            (sum, mark) => sum + mark,
            0
        );


    const average =
        total / marksArray.length;


    averageMarks.textContent =
        `${average.toFixed(1)}%`;


    overallGrade.textContent =
        getGrade(average);


    // ======================================
    // GRAPH
    // ======================================

    createPerformanceChart(results);

}


// ==========================================
// GRADE CALCULATION
// ==========================================

function getGrade(marks) {

    const score = Number(marks);


    if (Number.isNaN(score)) {
        return "-";
    }


    /*
     * Basic percentage grading.
     *
     * We can replace this with the exact
     * CBC grading system you want later.
     */

    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";

    return "E";
}


// ==========================================
// PERFORMANCE GRAPH
// ==========================================

let performanceChart = null;


function createPerformanceChart(results) {

    const canvas =
        document.getElementById(
            "performanceChart"
        );


    if (!canvas) {
        return;
    }


    const labels =
        results.map(
            result => result.subject
        );


    const values =
        results.map(
            result => Number(result.marks) || 0
        );


    if (performanceChart) {

        performanceChart.destroy();

    }


    performanceChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label:
                                "Subject Performance",

                            data:
                                values,

                            tension:
                                0.3,

                            fill:
                                false,

                            borderWidth:
                                2,

                            pointRadius:
                                5
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        true,

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            max:
                                100,

                            title: {

                                display:
                                    true,

                                text:
                                    "Marks (%)"

                            }

                        }

                    },

                    plugins: {

                        legend: {

                            display:
                                true

                        }

                    }

                }

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
// SECURITY / AUTH INITIALIZATION
// ==========================================

async function initializeStudentDashboard() {

    try {

        const user =
            await getCurrentUser();


        if (!user) {

            window.location.replace(
                "index.html"
            );

            return;
        }


        const role =
            await checkStudentRole(
                user.id
            );


        if (!role) {

            console.error(
                "No approved student role found."
            );


            await supabase.auth.signOut();


            window.location.replace(
                "index.html"
            );

            return;
        }


        // Load profile
        await loadStudentProfile(
            user.id
        );


        // Load results
        await loadResults(
            user.id
        );

    }

    catch (error) {

        console.error(
            "Dashboard initialization error:",
            error
        );


        showProfileMessage(
            "Unable to load your account information."
        );

    }

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

initializeStudentDashboard();

