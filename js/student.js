// ==========================================
// GRADE HUB - STUDENT DASHBOARD
// CBC GRADING SYSTEM
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// CBC GRADING
// ==========================================

function getCBCGrade(marks) {

    marks = Number(marks);

    if (marks >= 90) return "EE1";
    if (marks >= 80) return "EE2";

    if (marks >= 70) return "ME1";
    if (marks >= 60) return "ME2";

    if (marks >= 50) return "AE1";
    if (marks >= 40) return "AE2";

    if (marks >= 30) return "BE1";

    return "BE2";
}


// ==========================================
// CBC GRADE DESCRIPTION
// ==========================================

function getCBCDescription(grade) {

    switch (grade) {

        case "EE1":
            return "Exceeding Expectations";

        case "EE2":
            return "Exceeding Expectations";

        case "ME1":
            return "Meeting Expectations";

        case "ME2":
            return "Meeting Expectations";

        case "AE1":
            return "Approaching Expectations";

        case "AE2":
            return "Approaching Expectations";

        case "BE1":
            return "Below Expectations";

        case "BE2":
            return "Below Expectations";

        default:
            return "-";
    }
}


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
// CHART
// ==========================================

let performanceChart = null;


// ==========================================
// SHOW MESSAGE
// ==========================================

function showError(message) {

    if (profileBox) {

        profileBox.innerHTML = `
            <div style="
                padding:15px;
                border-radius:10px;
                background:#fef2f2;
                color:#991b1b;
            ">
                ${message}
            </div>
        `;

    }

}


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkLogin() {

    const {
        data,
        error
    } = await supabase.auth.getUser();


    if (error) {

        console.error(error);

        window.location.href = "index.html";

        return null;

    }


    if (!data || !data.user) {

        window.location.href = "index.html";

        return null;

    }


    return data.user;
}


// ==========================================
// LOAD STUDENT
// ==========================================

async function loadStudent() {

    const user = await checkLogin();


    if (!user) {
        return;
    }


    // ======================================
    // GET STUDENT
    // ======================================

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
            optional_subjects,
            profiles(
                full_name,
                username,
                email
            )
        `)

        .eq("user_id", user.id)

        .maybeSingle();


    if (studentError) {

        console.error(
            "Student error:",
            studentError
        );

        showError(
            "Unable to load your student profile."
        );

        return;
    }


    if (!student) {

        showError(
            "No student profile was found for this account."
        );

        return;
    }


    // ======================================
    // PROFILE
    // ======================================

    const profile =
        Array.isArray(student.profiles)
            ? student.profiles[0]
            : student.profiles;


    const fullName =
        profile?.full_name || "Student";


    const username =
        profile?.username || "-";


    const email =
        profile?.email || user.email || "-";


    profileBox.innerHTML = `

        <div style="
            display:grid;
            grid-template-columns:
                repeat(auto-fit,minmax(180px,1fr));
            gap:15px;
        ">

            <div style="
                padding:15px;
                background:#f8fafc;
                border:1px solid #e5e9f2;
                border-radius:12px;
            ">

                <small style="color:#697386;">
                    Full Name
                </small>

                <strong style="
                    display:block;
                    margin-top:5px;
                ">
                    ${fullName}
                </strong>

            </div>


            <div style="
                padding:15px;
                background:#f8fafc;
                border:1px solid #e5e9f2;
                border-radius:12px;
            ">

                <small style="color:#697386;">
                    Admission Number
                </small>

                <strong style="
                    display:block;
                    margin-top:5px;
                ">
                    ${student.admission_number}
                </strong>

            </div>


            <div style="
                padding:15px;
                background:#f8fafc;
                border:1px solid #e5e9f2;
                border-radius:12px;
            ">

                <small style="color:#697386;">
                    Class
                </small>

                <strong style="
                    display:block;
                    margin-top:5px;
                ">
                    ${student.class}
                </strong>

            </div>


            <div style="
                padding:15px;
                background:#f8fafc;
                border:1px solid #e5e9f2;
                border-radius:12px;
            ">

                <small style="color:#697386;">
                    Username
                </small>

                <strong style="
                    display:block;
                    margin-top:5px;
                ">
                    ${username}
                </strong>

            </div>


            <div style="
                padding:15px;
                background:#f8fafc;
                border:1px solid #e5e9f2;
                border-radius:12px;
            ">

                <small style="color:#697386;">
                    Email
                </small>

                <strong style="
                    display:block;
                    margin-top:5px;
                    word-break:break-word;
                ">
                    ${email}
                </strong>

            </div>

        </div>
    `;


    // ======================================
    // LOAD RESULTS
    // ======================================

    await loadResults(student.id);

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
            marks,
            term,
            year
        `)

        .eq(
            "student_id",
            studentId
        )

        .order(
            "year",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Results error:",
            error
        );

        resultTable.innerHTML = `

            <tr>

                <td
                    colspan="3"
                    style="
                        text-align:center;
                        padding:25px;
                        color:#991b1b;
                    "
                >
                    Unable to load results.
                </td>

            </tr>

        `;

        return;
    }


    // ======================================
    // NO RESULTS
    // ======================================

    if (!results || results.length === 0) {

        resultTable.innerHTML = `

            <tr>

                <td
                    colspan="3"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#697386;
                    "
                >
                    No results have been uploaded yet.
                </td>

            </tr>

        `;


        averageMarks.textContent = "0%";

        overallGrade.textContent = "-";

        subjectCount.textContent = "0";


        drawChart([], []);

        return;
    }


    // ======================================
    // CALCULATE AVERAGE
    // ======================================

    let totalMarks = 0;


    results.forEach(result => {

        totalMarks += Number(
            result.marks
        ) || 0;

    });


    const average =
        totalMarks / results.length;


    const roundedAverage =
        Math.round(average * 100) / 100;


    const overallCBC =
        getCBCGrade(average);


    // ======================================
    // UPDATE SUMMARY
    // ======================================

    averageMarks.textContent =
        `${roundedAverage}%`;


    overallGrade.innerHTML = `

        <span style="
            font-weight:800;
        ">
            ${overallCBC}
        </span>

        <small style="
            display:block;
            margin-top:4px;
            font-size:11px;
            color:#697386;
        ">
            ${getCBCDescription(overallCBC)}
        </small>

    `;


    subjectCount.textContent =
        results.length;


    // ======================================
    // RESULTS TABLE
    // ======================================

    resultTable.innerHTML = "";


    results.forEach(result => {

        const marks =
            Number(result.marks) || 0;


        const grade =
            getCBCGrade(marks);


        const description =
            getCBCDescription(grade);


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                <strong>
                    ${result.subject}
                </strong>

                <small style="
                    display:block;
                    color:#697386;
                    margin-top:3px;
                ">
                    ${result.term || ""}
                    ${result.year || ""}
                </small>
            </td>


            <td>
                ${marks}%
            </td>


            <td>

                <span style="
                    display:inline-block;
                    padding:5px 9px;
                    border-radius:999px;
                    background:#eef2ff;
                    color:#3730a3;
                    font-size:12px;
                    font-weight:800;
                ">
                    ${grade}
                </span>

                <small style="
                    display:block;
                    color:#697386;
                    margin-top:4px;
                ">
                    ${description}
                </small>

            </td>

        `;


        resultTable.appendChild(row);

    });


    // ======================================
    // CHART
    // ======================================

    const chartSubjects =
        results.map(
            result => result.subject
        );


    const chartMarks =
        results.map(
            result => Number(result.marks) || 0
        );


    drawChart(
        chartSubjects,
        chartMarks
    );

}


// ==========================================
// DRAW PERFORMANCE CHART
// ==========================================

function drawChart(subjects, marks) {

    const canvas =
        document.getElementById(
            "performanceChart"
        );


    if (!canvas) {
        return;
    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js has not loaded."
        );

        return;

    }


    if (performanceChart) {

        performanceChart.destroy();

    }


    performanceChart =
        new Chart(
            canvas.getContext("2d"),
            {

                type: "line",

                data: {

                    labels: subjects,

                    datasets: [

                        {

                            label:
                                "Marks",

                            data:
                                marks,

                            tension:
                                0.3,

                            borderWidth:
                                3,

                            pointRadius:
                                5,

                            fill:
                                false

                        }

                    ]

                },


                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    scales: {

                        y: {

                            min: 0,

                            max: 100,

                            ticks: {

                                stepSize: 10

                            },

                            title: {

                                display:
                                    true,

                                text:
                                    "Marks (%)"

                            }

                        },

                        x: {

                            title: {

                                display:
                                    true,

                                text:
                                    "Subjects"

                            }

                        }

                    },


                    plugins: {

                        legend: {

                            display:
                                true

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function(
                                        context
                                    ) {

                                        const mark =
                                            context.parsed.y;

                                        const grade =
                                            getCBCGrade(
                                                mark
                                            );

                                        return `
                                            ${mark}%
                                            - ${grade}
                                        `;

                                    }

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
        async function(event) {

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


            window.location.href =
                "index.html";

        }
    );

}


// ==========================================
// AUTH STATE
// ==========================================

supabase.auth.onAuthStateChange(
    (event, session) => {

        if (
            event ===
                "SIGNED_OUT" ||
            !session
        ) {

            window.location.href =
                "index.html";

        }

    }
);


// ==========================================
// START
// ==========================================

loadStudent();
