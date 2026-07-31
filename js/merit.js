// ==========================================
// GRADE HUB - MERIT LIST WITH POINTS
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const meritTable =
    document.getElementById("meritTable");

const learnerCount =
    document.getElementById("learnerCount");

const highestAverage =
    document.getElementById("highestAverage");

const topLearner =
    document.getElementById("topLearner");

const search =
    document.getElementById("search");

const classFilter =
    document.getElementById("classFilter");

const termFilter =
    document.getElementById("termFilter");

const yearFilter =
    document.getElementById("yearFilter");

const refreshButton =
    document.getElementById("refreshButton");

const message =
    document.getElementById("message");


let allLearners = [];


// ==========================================
// CBC GRADE
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
// CBC DESCRIPTION
// ==========================================

function getCBCDescription(grade) {

    switch (grade) {

        case "EE1":
        case "EE2":
            return "Exceeding Expectations";

        case "ME1":
        case "ME2":
            return "Meeting Expectations";

        case "AE1":
        case "AE2":
            return "Approaching Expectations";

        case "BE1":
        case "BE2":
            return "Below Expectations";

        default:
            return "-";
    }
}


// ==========================================
// POINTS
// ==========================================

function getPoints(marks) {

    const grade =
        getCBCGrade(marks);


    switch (grade) {

        case "EE1":
            return 8;

        case "EE2":
            return 7;

        case "ME1":
            return 6;

        case "ME2":
            return 5;

        case "AE1":
            return 4;

        case "AE2":
            return 3;

        case "BE1":
            return 2;

        case "BE2":
            return 1;

        default:
            return 0;
    }
}


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
    text,
    type = "error"
) {

    message.textContent = text;

    message.className =
        `message show ${type}`;

}


// ==========================================
// CHECK ADMIN
// ==========================================

async function checkAdmin() {

    const {
        data,
        error
    } = await supabase.auth.getUser();


    if (
        error ||
        !data ||
        !data.user
    ) {

        window.location.href =
            "index.html";

        return false;
    }


    const {
        data: roles,
        error: roleError
    } = await supabase

        .from("user_roles")

        .select(
            "role, approved"
        )

        .eq(
            "user_id",
            data.user.id
        );


    if (roleError) {

        console.error(
            roleError
        );

        showMessage(
            "Unable to verify account permissions."
        );

        return false;
    }


    const approvedRole =
        (roles || []).find(
            role =>
                role.approved === true &&
                (
                    role.role === "admin" ||
                    role.role === "super_admin"
                )
        );


    if (!approvedRole) {

        window.location.href =
            "index.html";

        return false;
    }


    return true;
}


// ==========================================
// LOAD LEARNERS
// ==========================================

async function loadLearners() {

    meritTable.innerHTML = `

        <tr>

            <td
                colspan="8"
                class="empty-row"
            >
                Loading learners...

            </td>

        </tr>

    `;


    const allowed =
        await checkAdmin();


    if (!allowed) {
        return;
    }


    // ======================================
    // STUDENTS
    // ======================================

    const {
        data: students,
        error: studentError
    } = await supabase

        .from("students")

        .select(`
            id,
            user_id,
            admission_number,
            class,
            profiles(
                full_name,
                username
            )
        `);


    if (studentError) {

        console.error(
            studentError
        );

        showMessage(
            studentError.message
        );

        return;
    }


    // ======================================
    // RESULTS
    // ======================================

    const {
        data: results,
        error: resultError
    } = await supabase

        .from("results")

        .select(`
            student_id,
            subject,
            marks,
            term,
            year
        `);


    if (resultError) {

        console.error(
            resultError
        );

        showMessage(
            resultError.message
        );

        return;
    }


    // ======================================
    // BUILD LEARNERS
    // ======================================

    allLearners = [];


    students.forEach(
        student => {

            const studentResults =
                (results || []).filter(
                    result =>
                        result.student_id ===
                        student.id
                );


            const profile =
                Array.isArray(
                    student.profiles
                )
                    ? student.profiles[0]
                    : student.profiles;


            allLearners.push({

                id:
                    student.id,

                admission:
                    student.admission_number ||
                    "-",

                name:
                    profile?.full_name ||
                    "Unknown Learner",

                username:
                    profile?.username ||
                    "-",

                className:
                    student.class ||
                    "-",

                results:
                    studentResults

            });

        }
    );


    populateClasses();

    renderMeritList();

}


// ==========================================
// CALCULATE AVERAGE
// ==========================================

function calculateAverage(results) {

    if (
        !results ||
        results.length === 0
    ) {

        return 0;
    }


    let total = 0;


    results.forEach(
        result => {

            total +=
                Number(
                    result.marks
                ) || 0;

        }
    );


    return total /
        results.length;
}


// ==========================================
// CALCULATE TOTAL POINTS
// ==========================================

function calculatePoints(results) {

    if (
        !results ||
        results.length === 0
    ) {

        return 0;
    }


    let totalPoints = 0;


    results.forEach(
        result => {

            totalPoints +=
                getPoints(
                    result.marks
                );

        }
    );


    return totalPoints;
}


// ==========================================
// POPULATE CLASSES
// ==========================================

function populateClasses() {

    const classes =
        [
            ...new Set(
                allLearners
                    .map(
                        learner =>
                            learner.className
                    )
                    .filter(Boolean)
            )
        ];


    classes.sort();


    classFilter.innerHTML = `

        <option value="all">
            All Classes
        </option>

    `;


    classes.forEach(
        className => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                className;

            option.textContent =
                className;

            classFilter.appendChild(
                option
            );

        }
    );

}


// ==========================================
// GET FILTERED LEARNERS
// ==========================================

function getFilteredLearners() {

    const searchValue =
        search.value
            .trim()
            .toLowerCase();


    const selectedClass =
        classFilter.value;


    const selectedTerm =
        termFilter.value;


    const selectedYear =
        yearFilter.value;


    return allLearners.filter(
        learner => {

            // SEARCH

            const matchesSearch =
                !searchValue ||

                learner.name
                    .toLowerCase()
                    .includes(searchValue) ||

                learner.admission
                    .toLowerCase()
                    .includes(searchValue);


            if (!matchesSearch) {
                return false;
            }


            // CLASS

            if (
                selectedClass !==
                "all" &&
                learner.className !==
                selectedClass
            ) {

                return false;
            }


            // TERM/YEAR

            let relevantResults =
                learner.results;


            if (
                selectedTerm !==
                "all"
            ) {

                relevantResults =
                    relevantResults.filter(
                        result =>
                            result.term ===
                            selectedTerm
                    );

            }


            if (
                selectedYear !==
                "all"
            ) {

                relevantResults =
                    relevantResults.filter(
                        result =>
                            String(
                                result.year
                            ) ===
                            String(
                                selectedYear
                            )
                    );

            }


            if (
                (
                    selectedTerm !==
                    "all"
                ) ||
                (
                    selectedYear !==
                    "all"
                )
            ) {

                if (
                    relevantResults.length ===
                    0
                ) {

                    return false;
                }

            }


            return true;

        }
    );

}


// ==========================================
// RENDER MERIT LIST
// ==========================================

function renderMeritList() {

    let learners =
        getFilteredLearners();


    const selectedTerm =
        termFilter.value;


    const selectedYear =
        yearFilter.value;


    // ======================================
    // CALCULATE PERFORMANCE
    // ======================================

    learners =
        learners.map(
            learner => {

                let relevantResults =
                    learner.results;


                if (
                    selectedTerm !==
                    "all"
                ) {

                    relevantResults =
                        relevantResults.filter(
                            result =>
                                result.term ===
                                selectedTerm
                        );

                }


                if (
                    selectedYear !==
                    "all"
                ) {

                    relevantResults =
                        relevantResults.filter(
                            result =>
                                String(
                                    result.year
                                ) ===
                                String(
                                    selectedYear
                                )
                        );

                }


                const average =
                    calculateAverage(
                        relevantResults
                    );


                const totalPoints =
                    calculatePoints(
                        relevantResults
                    );


                return {

                    ...learner,

                    rankingAverage:
                        average,

                    totalPoints:
                        totalPoints,

                    subjectTotal:
                        relevantResults.length

                };

            }
        );


    // ======================================
    // RANKING
    // ======================================
    //
    // 1. Highest total points first
    // 2. Highest average as tiebreaker
    //
    // ======================================

    learners.sort(
        (a, b) => {

            if (
                b.totalPoints !==
                a.totalPoints
            ) {

                return (
                    b.totalPoints -
                    a.totalPoints
                );

            }


            return (
                b.rankingAverage -
                a.rankingAverage
            );

        }
    );


    // ======================================
    // SUMMARY
    // ======================================

    learnerCount.textContent =
        learners.length;


    if (
        learners.length > 0
    ) {

        highestAverage.textContent =
            `${formatAverage(
                learners[0]
                    .rankingAverage
            )}%`;


        topLearner.textContent =
            learners[0].name;

    } else {

        highestAverage.textContent =
            "0%";

        topLearner.textContent =
            "-";

    }


    // ======================================
    // EMPTY
    // ======================================

    if (
        learners.length === 0
    ) {

        meritTable.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-row"
                >
                    No learners match
                    the selected filters.

                </td>

            </tr>

        `;

        return;
    }


    // ======================================
    // TABLE
    // ======================================

    meritTable.innerHTML = "";


    learners.forEach(
        (learner, index) => {

            const position =
                index + 1;


            const average =
                learner.rankingAverage;


            const grade =
                getCBCGrade(
                    average
                );


            const description =
                getCBCDescription(
                    grade
                );


            const totalPoints =
                learner.totalPoints;


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>

                    <div class="
                        position
                        ${position <= 3
                            ? "top"
                            : ""}
                    ">

                        ${position}

                    </div>

                </td>


                <td>

                    ${escapeHTML(
                        learner.admission
                    )}

                </td>


                <td>

                    <strong>

                        ${escapeHTML(
                            learner.name
                        )}

                    </strong>


                    <small style="
                        display:block;
                        margin-top:4px;
                        color:#697386;
                    ">

                        ${escapeHTML(
                            learner.username
                        )}

                    </small>

                </td>


                <td>

                    ${escapeHTML(
                        learner.className
                    )}

                </td>


                <td>

                    ${learner.subjectTotal}

                </td>


                <td>

                    <strong>

                        ${formatAverage(
                            average
                        )}%

                    </strong>

                </td>


                <td>

                    <strong
                        style="
                            font-size:16px;
                            color:#3730a3;
                        "
                    >

                        ${totalPoints}

                    </strong>

                    <small style="
                        color:#697386;
                        display:block;
                    ">

                        points

                    </small>

                </td>


                <td>

                    <span class="cbc-badge">

                        ${grade}

                    </span>


                    <span
                        class="cbc-description"
                    >

                        ${description}

                    </span>

                </td>

            `;


            meritTable.appendChild(
                row
            );

        }
    );

}


// ==========================================
// FORMAT AVERAGE
// ==========================================

function formatAverage(value) {

    return Math.round(
        Number(value) * 100
    ) / 100;

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

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


// ==========================================
// FILTER EVENTS
// ==========================================

search.addEventListener(
    "input",
    renderMeritList
);


classFilter.addEventListener(
    "change",
    renderMeritList
);


termFilter.addEventListener(
    "change",
    renderMeritList
);


yearFilter.addEventListener(
    "change",
    renderMeritList
);


refreshButton.addEventListener(
    "click",
    loadLearners
);


// ==========================================
// LOGOUT
// ==========================================

document
    .getElementById("logout")
    .addEventListener(
        "click",
        async event => {

            event.preventDefault();


            await supabase.auth.signOut();


            window.location.href =
                "index.html";

        }
    );


// ==========================================
// START
// ==========================================

loadLearners();
