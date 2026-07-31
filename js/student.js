import { supabase } from "./supabase.js";

const profileBox = document.getElementById("studentProfile");
const resultTable = document.getElementById("resultTable");
const averageMarks = document.getElementById("averageMarks");
const overallGrade = document.getElementById("overallGrade");
const subjectCount = document.getElementById("subjectCount");
const logoutButton = document.getElementById("logout");


// ==========================================
// AUTHENTICATION
// ==========================================

async function initializeStudent() {

    try {

        const {
            data: {
                session
            }
        } = await supabase.auth.getSession();


        if (!session) {

            window.location.replace("index.html");

            return;
        }


        const user = session.user;


        console.log("Logged in user:", user.id);


        // --------------------------------------
        // Find student record FIRST
        // --------------------------------------

        const {
            data: student,
            error: studentError
        } = await supabase
            .from("students")
            .select(`
                id,
                user_id,
                admission_number,
                class,
                optional_subjects
            `)
            .eq("user_id", user.id)
            .maybeSingle();


        if (studentError) {

            console.error(
                "Student lookup error:",
                studentError
            );

            showError(
                "Unable to load your student account."
            );

            return;
        }


        if (!student) {

            console.error(
                "No student record found for:",
                user.id
            );

            showError(
                "No student record is linked to this account."
            );

            return;
        }


        console.log(
            "Student record:",
            student
        );


        // --------------------------------------
        // Load profile
        // --------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                username,
                email
            `)
            .eq("id", user.id)
            .maybeSingle();


        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );

        }


        // --------------------------------------
        // Display profile
        // --------------------------------------

        displayProfile(
            profile || {},
            student
        );


        // --------------------------------------
        // Load results
        // --------------------------------------

        await loadResults(
            student.id
        );

    }

    catch (error) {

        console.error(
            "Student dashboard error:",
            error
        );

        showError(
            error.message ||
            "Unable to load the student dashboard."
        );
    }
}


// ==========================================
// DISPLAY PROFILE
// ==========================================

function displayProfile(profile, student) {

    const subjects =
        Array.isArray(student.optional_subjects)
            ? student.optional_subjects
            : [];


    profileBox.innerHTML = `

        <div class="profile-grid">

            <div class="profile-item">
                <span>Name</span>
                <strong>
                    ${escapeHTML(
                        profile.full_name || "-"
                    )}
                </strong>
            </div>

            <div class="profile-item">
                <span>Username</span>
                <strong>
                    ${escapeHTML(
                        profile.username || "-"
                    )}
                </strong>
            </div>

            <div class="profile-item">
                <span>Email</span>
                <strong>
                    ${escapeHTML(
                        profile.email || "-"
                    )}
                </strong>
            </div>

            <div class="profile-item">
                <span>Admission Number</span>
                <strong>
                    ${escapeHTML(
                        student.admission_number || "-"
                    )}
                </strong>
            </div>

            <div class="profile-item">
                <span>Class</span>
                <strong>
                    ${escapeHTML(
                        student.class || "-"
                    )}
                </strong>
            </div>

            <div class="profile-item profile-wide">
                <span>Optional Subjects</span>
                <strong>
                    ${
                        subjects.length
                            ? subjects
                                .map(
                                    escapeHTML
                                )
                                .join(", ")
                            : "None selected"
                    }
                </strong>
            </div>

        </div>
    `;


    subjectCount.textContent =
        subjects.length;
}


// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults(studentId) {

    const {
        data: results,
        error
    } = await supabase
        .from("results")
        .select(`
            id,
            subject,
            marks
        `)
        .eq("student_id", studentId)
        .order("subject");


    if (error) {

        console.error(
            "Results error:",
            error
        );


        resultTable.innerHTML = `
            <tr>
                <td colspan="3">
                    No results available yet.
                </td>
            </tr>
        `;

        averageMarks.textContent = "0%";
        overallGrade.textContent = "-";

        return;
    }


    if (!results || results.length === 0) {

        resultTable.innerHTML = `
            <tr>
                <td colspan="3">
                    No results have been uploaded yet.
                </td>
            </tr>
        `;

        averageMarks.textContent = "0%";
        overallGrade.textContent = "-";

        return;
    }


    resultTable.innerHTML = "";


    const marks = [];


    results.forEach(result => {

        const score =
            Number(result.marks);


        if (!Number.isNaN(score)) {

            marks.push(score);
        }


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHTML(
                    result.subject || "-"
                )}
            </td>

            <td>
                ${
                    Number.isNaN(score)
                        ? "-"
                        : score + "%"
                }
            </td>

            <td>
                ${getGrade(score)}
            </td>

        `;


        resultTable.appendChild(row);

    });


    if (marks.length === 0) {

        averageMarks.textContent = "0%";
        overallGrade.textContent = "-";

        return;
    }


    const total =
        marks.reduce(
            (sum, mark) => sum + mark,
            0
        );


    const average =
        total / marks.length;


    averageMarks.textContent =
        average.toFixed(1) + "%";


    overallGrade.textContent =
        getGrade(average);


    createChart(results);
}


// ==========================================
// GRADE
// ==========================================

function getGrade(mark) {

    if (Number.isNaN(mark)) {
        return "-";
    }

    if (mark >= 80) return "A";
    if (mark >= 70) return "B";
    if (mark >= 60) return "C";
    if (mark >= 50) return "D";

    return "E";
}


// ==========================================
// CHART
// ==========================================

let chart = null;


function createChart(results) {

    const canvas =
        document.getElementById(
            "performanceChart"
        );


    if (!canvas || typeof Chart === "undefined") {
        return;
    }


    if (chart) {
        chart.destroy();
    }


    chart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels:
                        results.map(
                            item =>
                                item.subject
                        ),

                    datasets: [

                        {
                            label:
                                "Marks",

                            data:
                                results.map(
                                    item =>
                                        Number(
                                            item.marks
                                        ) || 0
                                ),

                            tension: 0.35,

                            borderWidth: 3,

                            pointRadius: 5,

                            fill: false
                        }

                    ]
                },

                options: {

                    responsive: true,

                    scales: {

                        y: {

                            beginAtZero: true,

                            max: 100,

                            title: {

                                display: true,

                                text: "Marks (%)"
                            }
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

                return;
            }


            window.location.replace(
                "index.html"
            );
        }
    );
}


// ==========================================
// ERROR DISPLAY
// ==========================================

function showError(text) {

    if (profileBox) {

        profileBox.innerHTML = `

            <div class="dashboard-error">
                ${escapeHTML(text)}
            </div>

        `;
    }
}


// ==========================================
// HTML SECURITY
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

initializeStudent();
