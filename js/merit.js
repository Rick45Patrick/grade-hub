// ==========================================
// GRADE HUB - MERIT LIST
// DYNAMIC CBC GRADING + POINTS
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
// DEFAULT GRADING
// ==========================================
// Used only if the grading configuration
// cannot be loaded from Supabase.

const DEFAULT_GRADING = [
    {
        grade: "EE1",
        min_marks: 90,
        max_marks: 100,
        points: 8,
        description: "Exceeding Expectations"
    },

    {
        grade: "EE2",
        min_marks: 80,
        max_marks: 89,
        points: 7,
        description: "Exceeding Expectations"
    },

    {
        grade: "ME1",
        min_marks: 70,
        max_marks: 79,
        points: 6,
        description: "Meeting Expectations"
    },

    {
        grade: "ME2",
        min_marks: 60,
        max_marks: 69,
        points: 5,
        description: "Meeting Expectations"
    },

    {
        grade: "AE1",
        min_marks: 50,
        max_marks: 59,
        points: 4,
        description: "Approaching Expectations"
    },

    {
        grade: "AE2",
        min_marks: 40,
        max_marks: 49,
        points: 3,
        description: "Approaching Expectations"
    },

    {
        grade: "BE1",
        min_marks: 30,
        max_marks: 39,
        points: 2,
        description: "Below Expectations"
    },

    {
        grade: "BE2",
        min_marks: 0,
        max_marks: 29,
        points: 1,
        description: "Below Expectations"
    }
];


// Current grading configuration
let gradingSystem = [];


// ==========================================
// MESSAGE
// ==========================================

function showMessage(text, type = "error") {

    message.textContent = text;

    message.className =
        `message show ${type}`;
}


// ==========================================
// HTML SAFETY
// ==========================================

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


// ==========================================
// FORMAT AVERAGE
// ==========================================

function formatAverage(value) {

    return Math.round(
        Number(value) * 100
    ) / 100;
}


// ==========================================
// LOAD GRADING SYSTEM
// ==========================================
//
// IMPORTANT:
// Change "grading_system" below ONLY if the
// table you created in Supabase has a
// different name.
//
// Expected columns:
//
// grade
// min_marks
// max_marks
// points
// description
//
// ==========================================

async function loadGradingSystem() {

    const {
        data,
        error
    } = await supabase

        .from("grading_system")

        .select(`
            grade,
            min_marks,
            max_marks,
            points,
            description
        `)

        .order(
            "min_marks",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Grading system error:",
            error
        );


        console.warn(
            "Using default CBC grading."
        );


        gradingSystem =
            DEFAULT_GRADING;


        return;
    }


    if (
        !data ||
        data.length === 0
    ) {

        console.warn(
            "No grading configuration found. Using defaults."
        );


        gradingSystem =
            DEFAULT_GRADING;


        return;
    }


    gradingSystem =
        data.map(row => ({

            grade:
                row.grade,

            min_marks:
                Number(
                    row.min_marks
                ),

            max_marks:
                Number(
                    row.max_marks
                ),

            points:
                Number(
                    row.points
                ),

            description:
                row.description ||
                ""

        }));


    console.log(
        "Grading system loaded:",
        gradingSystem
    );
}


// ==========================================
// GET CBC GRADE
// ==========================================

function getCBCGrade(marks) {

    marks =
        Number(marks);


    const grade =
        gradingSystem.find(
            item =>
                marks >=
                    item.min_marks &&

                marks <=
                    item.max_marks
        );


    if (grade) {

        return grade.grade;

    }


    return "-";
}


// ==========================================
// GET CBC DESCRIPTION
// ==========================================

function getCBCDescription(grade) {

    const item =
        gradingSystem.find(
            grading =>
                grading.grade ===
                grade
        );


    if (item) {

        return item.description;

    }


    return "-";
}


// ==========================================
// GET POINTS
// ==========================================

function getPoints(marks) {

    marks =
        Number(marks);


    const item =
        gradingSystem.find(
            grade =>
                marks >=
                    grade.min_marks &&

                marks <=
                    grade.max_marks
        );


    if (item) {

        return Number(
            item.points
        ) || 0;

    }


    return 0;
}


// ==========================================
// CHECK ADMIN
// ==========================================

async function checkAdmin() {

    const {
        data,
        error
    } =
        await supabase.auth.getUser();


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
    } =
        await supabase

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
    // LOAD GRADING SYSTEM FIRST
    // ======================================

    await loadGradingSystem();


    // ======================================
    // STUDENTS
    // ======================================

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
    } =
        await supabase

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


    (students || []).forEach(
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
// FILTER LEARNERS
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

            const matchesSearch =
                !searchValue ||

                learner.name
                    .toLowerCase()
                    .includes(
                        searchValue
                    ) ||

                learner.admission
                    .toLowerCase()
                    .includes(
                        searchValue
                    );


            if (!matchesSearch) {

                return false;
            }


            if (
                selectedClass !==
                "all" &&

                learner.className !==
                selectedClass
            ) {

                return false;
            }


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
                selectedTerm !== "all" ||
                selectedYear !== "all"
            ) {

                if (
                    relevantResults.length === 0
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

    }

    else {

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

                        ${escapeHTML(
                            grade
                        )}

                    </span>


                    <span
                        class="cbc-description"
                    >

                        ${escapeHTML(
                            description
                        )}

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


// ==========================================
// REFRESH
// ==========================================

refreshButton.addEventListener(
    "click",
    async () => {

        refreshButton.disabled =
            true;


        refreshButton.textContent =
            "Refreshing...";


        try {

            await loadLearners();

        }

        finally {

            refreshButton.disabled =
                false;


            refreshButton.textContent =
                "Refresh";
        }
    }
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
