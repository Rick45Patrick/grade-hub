// ==========================================
// GRADE HUB - MERIT LIST
// RANKING BY PERCENTAGE / AVERAGE
// DYNAMIC GRADING SYSTEM
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


// ==========================================
// DATA
// ==========================================

let allLearners = [];

let gradingSystem = [];


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
    text,
    type = "error"
) {

    if (!message) {
        return;
    }

    message.textContent = text;

    message.className =
        `message show ${type}`;

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

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
        .select("role, approved")
        .eq(
            "user_id",
            data.user.id
        );


    if (roleError) {

        console.error(
            "Role check error:",
            roleError
        );

        showMessage(
            "Unable to verify account permissions.",
            "error"
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
// LOAD GRADING SYSTEM
// ==========================================

async function loadGradingSystem() {

    const {
        data,
        error
    } = await supabase
        .from("grading_system")
        .select(`
            id,
            grade,
            min_mark,
            points,
            description
        `)
        .order(
            "min_mark",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Grading system error:",
            error
        );

        gradingSystem = [];

        throw error;

    }


    gradingSystem =
        (data || []).map(
            item => ({

                id:
                    item.id,

                grade:
                    String(
                        item.grade ?? ""
                    ),

                min_mark:
                    Number(
                        item.min_mark
                    ),

                points:
                    Number(
                        item.points
                    ),

                description:
                    String(
                        item.description ?? ""
                    )

            })
        );


    gradingSystem.sort(
        (a, b) =>
            b.min_mark -
            a.min_mark
    );


    if (
        gradingSystem.length === 0
    ) {

        throw new Error(
            "No grading system has been configured by the Super Admin."
        );

    }

}


// ==========================================
// GET GRADE
// ==========================================

function getCBCGrade(marks) {

    const numericMarks =
        Number(marks);


    if (
        Number.isNaN(numericMarks)
    ) {

        return "-";

    }


    const matchingGrade =
        gradingSystem.find(
            grading =>
                numericMarks >=
                grading.min_mark
        );


    if (!matchingGrade) {

        return "-";

    }


    return matchingGrade.grade;

}


// ==========================================
// GET DESCRIPTION
// ==========================================

function getCBCDescription(grade) {

    const matchingGrade =
        gradingSystem.find(
            grading =>
                grading.grade === grade
        );


    if (!matchingGrade) {

        return "-";

    }


    return matchingGrade.description;

}


// ==========================================
// GET POINTS
// ==========================================

function getPoints(marks) {

    const numericMarks =
        Number(marks);


    if (
        Number.isNaN(numericMarks)
    ) {

        return 0;

    }


    const matchingGrade =
        gradingSystem.find(
            grading =>
                numericMarks >=
                grading.min_mark
        );


    if (!matchingGrade) {

        return 0;

    }


    return Number(
        matchingGrade.points
    ) || 0;

}


// ==========================================
// LOAD LEARNERS
// ==========================================

async function loadLearners() {

    if (meritTable) {

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

    }


    const allowed =
        await checkAdmin();


    if (!allowed) {
        return;
    }


    try {

        // ==================================
        // GRADING SYSTEM
        // ==================================

        await loadGradingSystem();


        // ==================================
        // STUDENTS
        // ==================================

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

            throw studentError;

        }


        // ==================================
        // RESULTS
        // ==================================

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

            throw resultError;

        }


        // ==================================
        // BUILD LEARNERS
        // ==================================

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


    } catch (error) {

        console.error(
            "Merit loading error:",
            error
        );


        if (meritTable) {

            meritTable.innerHTML = `

                <tr>

                    <td
                        colspan="8"
                        class="empty-row"
                    >

                        Unable to load merit list.

                    </td>

                </tr>

            `;

        }


        showMessage(
            error.message ||
            "Unable to load merit list.",
            "error"
        );

    }

}


// ==========================================
// CALCULATE AVERAGE / PERCENTAGE
// ==========================================

function calculateAverage(results) {

    if (
        !results ||
        results.length === 0
    ) {

        return 0;

    }


    let total = 0;

    let validResults = 0;


    results.forEach(
        result => {

            const mark =
                Number(
                    result.marks
                );


            if (
                Number.isFinite(mark)
            ) {

                total += mark;

                validResults++;

            }

        }
    );


    if (
        validResults === 0
    ) {

        return 0;

    }


    return (
        total /
        validResults
    );

}


// ==========================================
// CALCULATE TOTAL POINTS
// POINTS ARE DISPLAY ONLY
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
                    .filter(
                        className =>
                            className &&
                            className !== "-"
                    )
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

            // ==============================
            // SEARCH
            // ==============================

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


            // ==============================
            // CLASS
            // ==============================

            if (
                selectedClass !== "all" &&
                learner.className !==
                selectedClass
            ) {

                return false;

            }


            // ==============================
            // TERM/YEAR
            // ==============================

            let relevantResults =
                learner.results;


            if (
                selectedTerm !== "all"
            ) {

                relevantResults =
                    relevantResults.filter(
                        result =>
                            result.term ===
                            selectedTerm
                    );

            }


            if (
                selectedYear !== "all"
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


            /*
             * When a specific term/year
             * is selected, only show learners
             * who have results for it.
             */

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
                    selectedTerm !== "all"
                ) {

                    relevantResults =
                        relevantResults.filter(
                            result =>
                                result.term ===
                                selectedTerm
                        );

                }


                if (
                    selectedYear !== "all"
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
    // RANK BY PERCENTAGE ONLY
    // ======================================

    /*
     * IMPORTANT:
     *
     * Students are ranked ONLY by their
     * average percentage.
     *
     * Points are NOT used for ranking.
     *
     * If two learners have exactly the same
     * percentage, they share the same rank.
     */

    learners.sort(
        (a, b) => {

            return (
                b.rankingAverage -
                a.rankingAverage
            );

        }
    );


    // ======================================
    // SCHOOL TOTAL MEAN
    // ======================================

    let schoolTotalMean = 0;


    if (
        learners.length > 0
    ) {

        let totalAverages = 0;

        let learnersWithResults = 0;


        learners.forEach(
            learner => {

                if (
                    learner.subjectTotal > 0
                ) {

                    totalAverages +=
                        learner.rankingAverage;

                    learnersWithResults++;

                }

            }
        );


        if (
            learnersWithResults > 0
        ) {

            schoolTotalMean =
                totalAverages /
                learnersWithResults;

        }

    }


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


    let currentRank = 0;

    let previousAverage = null;


    learners.forEach(
        (learner, index) => {

            /*
             * Competition ranking:
             *
             * 1
             * 2
             * 2
             * 4
             *
             * Equal percentages receive
             * the same position.
             */

            const average =
                learner.rankingAverage;


            if (
                previousAverage === null ||
                Number(
                    average.toFixed(2)
                ) !==
                Number(
                    previousAverage.toFixed(2)
                )
            ) {

                currentRank =
                    index + 1;

            }


            previousAverage =
                average;


            const position =
                currentRank;


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

                    <strong class="average-value">

                        ${formatAverage(
                            average
                        )}%

                    </strong>

                </td>


                <td>

                    <strong class="points-value">

                        ${totalPoints}

                    </strong>


                    <small class="points-label">

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


    // ======================================
    // TOTAL MEAN ROW
    // ======================================

    const meanRow =
        document.createElement("tr");


    meanRow.className =
        "total-mean-row";


    meanRow.innerHTML = `

        <td colspan="4">

            <strong>
                SCHOOL TOTAL MEAN
            </strong>

        </td>


        <td>

            <strong>
                ${learners.filter(
                    learner =>
                        learner.subjectTotal > 0
                ).length}
            </strong>

            learners

        </td>


        <td>

            <strong
                class="school-total-mean"
            >

                ${formatAverage(
                    schoolTotalMean
                )}%

            </strong>

        </td>


        <td colspan="2">

            Overall mean percentage

        </td>

    `;


    meritTable.appendChild(
        meanRow
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
// FILTER EVENTS
// ==========================================

if (search) {

    search.addEventListener(
        "input",
        renderMeritList
    );

}


if (classFilter) {

    classFilter.addEventListener(
        "change",
        renderMeritList
    );

}


if (termFilter) {

    termFilter.addEventListener(
        "change",
        renderMeritList
    );

}


if (yearFilter) {

    yearFilter.addEventListener(
        "change",
        renderMeritList
    );

}


// ==========================================
// REFRESH
// ==========================================

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        async () => {

            refreshButton.disabled =
                true;


            refreshButton.textContent =
                "Refreshing...";


            try {

                await loadLearners();


                showMessage(
                    "Merit list updated.",
                    "success"
                );

            }

            catch (error) {

                console.error(
                    "Refresh error:",
                    error
                );

            }


            refreshButton.disabled =
                false;


            refreshButton.textContent =
                "Refresh";

        }
    );

}


// ==========================================
// LOGOUT
// ==========================================

const logoutButton =
    document.getElementById(
        "logout"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            logoutButton.textContent =
                "Logging out...";


            await supabase.auth.signOut();


            window.location.href =
                "index.html";

        }
    );

}


// ==========================================
// START
// ==========================================

loadLearners();
