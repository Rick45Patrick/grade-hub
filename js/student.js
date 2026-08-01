// ==========================================
// GRADE HUB - STUDENT RESULTS
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const studentName =
    document.getElementById("studentName");

const studentUsername =
    document.getElementById("studentUsername");

const admissionNumber =
    document.getElementById("admissionNumber");

const studentClass =
    document.getElementById("studentClass");

const currentPeriod =
    document.getElementById("currentPeriod");

const subjectCount =
    document.getElementById("subjectCount");

const averageMark =
    document.getElementById("averageMark");

const totalPoints =
    document.getElementById("totalPoints");

const overallGrade =
    document.getElementById("overallGrade");

const resultsTable =
    document.getElementById("resultsTable");

const termFilter =
    document.getElementById("termFilter");

const yearFilter =
    document.getElementById("yearFilter");

const resultMode =
    document.getElementById("resultMode");

const refreshButton =
    document.getElementById("refreshButton");

const message =
    document.getElementById("message");

const chartCanvas =
    document.getElementById("performanceChart");


// ==========================================
// DATA
// ==========================================

let currentUser = null;

let currentStudent = null;

let allResults = [];

let gradingSystem = [];

let performanceChart = null;


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
    text,
    type = "info"
) {

    message.textContent =
        text;

    message.className =
        `message show ${type}`;

}


function hideMessage() {

    message.textContent = "";

    message.className =
        "message";

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
// FORMAT MARK
// ==========================================

function formatMark(value) {

    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return "0";

    }


    return Math.round(
        number * 100
    ) / 100;

}


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkLogin() {

    try {

        const {
            data,
            error
        } =
            await supabase.auth.getUser();


        if (error) {

            console.error(
                "Authentication error:",
                error
            );

            return null;

        }


        if (
            !data ||
            !data.user
        ) {

            return null;

        }


        return data.user;

    }

    catch (error) {

        console.error(
            "Login check failed:",
            error
        );

        return null;

    }

}


// ==========================================
// LOAD CURRENT STUDENT
// ==========================================

async function loadStudent() {

    if (!currentUser) {

        return null;

    }


    const {
        data,
        error
    } =
        await supabase

            .from("students")

            .select(`
                id,
                user_id,
                admission_number,
                class,
                optional_subjects,
                profiles(
                    id,
                    full_name,
                    username,
                    email
                )
            `)

            .eq(
                "user_id",
                currentUser.id
            )

            .maybeSingle();


    if (error) {

        console.error(
            "Student query error:",
            error
        );

        throw new Error(
            "Could not load your student account: " +
            error.message
        );

    }


    if (!data) {

        throw new Error(
            "No student record is linked to this account."
        );

    }


    currentStudent =
        data;


    const profile =
        Array.isArray(
            data.profiles
        )
            ? data.profiles[0]
            : data.profiles;


    studentName.textContent =
        profile?.full_name ||
        "Student";


    studentUsername.textContent =
        profile?.username
            ? "@" + profile.username
            : profile?.email || "Student account";


    admissionNumber.textContent =
        data.admission_number ||
        "—";


    studentClass.textContent =
        data.class ||
        "—";


    return data;

}


// ==========================================
// LOAD GRADING SYSTEM
// ==========================================

async function loadGradingSystem() {

    const {
        data,
        error
    } =
        await supabase

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

        throw new Error(
            "Could not load the grading system: " +
            error.message
        );

    }


    gradingSystem =
        (data || []).map(
            grade => ({

                ...grade,

                min_mark:
                    Number(
                        grade.min_mark
                    ),

                points:
                    Number(
                        grade.points
                    )

            })
        );


    if (
        gradingSystem.length === 0
    ) {

        throw new Error(
            "No grading system has been configured by the administrator."
        );

    }


    return gradingSystem;

}


// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults() {

    if (!currentStudent) {

        return;

    }


    const {
        data,
        error
    } =
        await supabase

            .from("results")

            .select(`
                student_id,
                subject,
                marks,
                term,
                year
            `)

            .eq(
                "student_id",
                currentStudent.id
            );


    if (error) {

        console.error(
            "Results query error:",
            error
        );

        throw new Error(
            "Could not load your results: " +
            error.message
        );

    }


    allResults =
        (data || []).map(
            result => ({

                ...result,

                marks:
                    Number(
                        result.marks
                    ) || 0

            })
        );


    populateYears();

}


// ==========================================
// POPULATE YEARS
// ==========================================

function populateYears() {

    const selectedYear =
        yearFilter.value;


    const years =
        [
            ...new Set(

                allResults

                    .map(
                        result =>
                            result.year
                    )

                    .filter(
                        year =>
                            year !== null &&
                            year !== undefined &&
                            year !== ""
                    )

            )
        ];


    years.sort(
        (a, b) =>
            Number(b) -
            Number(a)
    );


    yearFilter.innerHTML = `

        <option value="all">
            All Years
        </option>

    `;


    years.forEach(
        year => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                String(year);


            option.textContent =
                String(year);


            yearFilter.appendChild(
                option
            );

        }
    );


    if (
        years.some(
            year =>
                String(year) ===
                selectedYear
        )
    ) {

        yearFilter.value =
            selectedYear;

    }

}


// ==========================================
// GET GRADE FOR MARK
// ==========================================

function getGradeForMark(marks) {

    const numericMark =
        Number(marks);


    if (
        gradingSystem.length === 0
    ) {

        return {

            grade: "—",

            points: 0,

            description: "No grading system"

        };

    }


    const matchingGrade =
        gradingSystem.find(
            grade =>
                numericMark >=
                Number(
                    grade.min_mark
                )
        );


    if (!matchingGrade) {

        const lowest =
            gradingSystem[
                gradingSystem.length - 1
            ];


        return {

            grade:
                lowest?.grade || "—",

            points:
                Number(
                    lowest?.points
                ) || 0,

            description:
                lowest?.description ||
                "—"

        };

    }


    return {

        grade:
            matchingGrade.grade,

        points:
            Number(
                matchingGrade.points
            ) || 0,

        description:
            matchingGrade.description ||
            "—"

    };

}


// ==========================================
// GET FILTERED RESULTS
// ==========================================

function getFilteredResults() {

    const selectedTerm =
        termFilter.value;


    const selectedYear =
        yearFilter.value;


    return allResults.filter(
        result => {

            if (
                selectedTerm !==
                "all"
            ) {

                if (
                    result.term !==
                    selectedTerm
                ) {

                    return false;

                }

            }


            if (
                selectedYear !==
                "all"
            ) {

                if (
                    String(
                        result.year
                    ) !==
                    String(
                        selectedYear
                    )
                ) {

                    return false;

                }

            }


            return true;

        }
    );

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


    const total =
        results.reduce(
            (
                sum,
                result
            ) => {

                return sum +
                    (
                        Number(
                            result.marks
                        ) || 0
                    );

            },
            0
        );


    return total /
        results.length;

}


// ==========================================
// CALCULATE POINTS
// ==========================================

function calculateTotalPoints(results) {

    if (
        !results ||
        results.length === 0
    ) {

        return 0;

    }


    return results.reduce(
        (
            total,
            result
        ) => {

            const grade =
                getGradeForMark(
                    result.marks
                );


            return total +
                Number(
                    grade.points
                );

        },
        0
    );

}


// ==========================================
// CALCULATE OVERALL GRADE
// ==========================================

function getOverallGrade(average) {

    return getGradeForMark(
        average
    );

}


// ==========================================
// UPDATE SUMMARY
// ==========================================

function updateSummary(results) {

    const average =
        calculateAverage(
            results
        );


    const points =
        calculateTotalPoints(
            results
        );


    const grade =
        getOverallGrade(
            average
        );


    subjectCount.textContent =
        results.length;


    averageMark.textContent =
        `${formatMark(
            average
        )}%`;


    totalPoints.textContent =
        points;


    overallGrade.textContent =
        grade.grade ||
        "—";


    if (
        termFilter.value === "all" &&
        yearFilter.value === "all"
    ) {

        currentPeriod.textContent =
            "All Results";

    }

    else if (
        termFilter.value !== "all" &&
        yearFilter.value !== "all"
    ) {

        currentPeriod.textContent =
            `${termFilter.value} • ${yearFilter.value}`;

    }

    else if (
        termFilter.value !== "all"
    ) {

        currentPeriod.textContent =
            termFilter.value;

    }

    else {

        currentPeriod.textContent =
            yearFilter.value;

    }

}


// ==========================================
// RENDER RESULTS TABLE
// ==========================================

function renderResultsTable(results) {

    if (
        !results ||
        results.length === 0
    ) {

        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-row"
                >

                    No results found
                    for the selected filters.

                </td>

            </tr>

        `;

        return;

    }


    /*
     * Sort subjects alphabetically.
     */

    const sortedResults =
        [...results].sort(
            (
                a,
                b
            ) =>
                String(
                    a.subject || ""
                ).localeCompare(
                    String(
                        b.subject || ""
                    )
                )
        );


    resultsTable.innerHTML =
        sortedResults.map(
            result => {

                const grade =
                    getGradeForMark(
                        result.marks
                    );


                return `

                    <tr>

                        <td>

                            <strong>

                                ${escapeHTML(
                                    result.subject ||
                                    "Unknown Subject"
                                )}

                            </strong>

                        </td>


                        <td>

                            <span class="mark">

                                ${formatMark(
                                    result.marks
                                )}%

                            </span>

                        </td>


                        <td>

                            <span class="cbc-badge">

                                ${escapeHTML(
                                    grade.grade
                                )}

                            </span>

                        </td>


                        <td>

                            <span class="cbc-description">

                                ${escapeHTML(
                                    grade.description
                                )}

                            </span>

                        </td>


                        <td>

                            <span class="points">

                                ${grade.points}

                            </span>

                        </td>


                        <td>

                            ${escapeHTML(
                                result.term ||
                                "—"
                            )}

                        </td>


                        <td>

                            ${escapeHTML(
                                result.year ||
                                "—"
                            )}

                        </td>

                    </tr>

                `;

            }
        ).join("");

}


// ==========================================
// PREPARE GRAPH DATA
// ==========================================

function prepareGraphData(results) {

    /*
     * If there are duplicate records for the same
     * subject, calculate the average for that subject.
     */

    const subjectMap =
        new Map();


    results.forEach(
        result => {

            const subject =
                String(
                    result.subject ||
                    "Unknown"
                );


            if (
                !subjectMap.has(
                    subject
                )
            ) {

                subjectMap.set(
                    subject,
                    []
                );

            }


            subjectMap
                .get(subject)
                .push(
                    Number(
                        result.marks
                    ) || 0
                );

        }
    );


    const subjects =
        Array.from(
            subjectMap.keys()
        ).sort();


    const marks =
        subjects.map(
            subject => {

                const values =
                    subjectMap.get(
                        subject
                    );


                if (
                    values.length === 0
                ) {

                    return 0;

                }


                const total =
                    values.reduce(
                        (
                            sum,
                            value
                        ) =>
                            sum + value,
                        0
                    );


                return Math.round(
                    (
                        total /
                        values.length
                    ) * 100
                ) / 100;

            }
        );


    return {

        subjects,

        marks

    };

}


// ==========================================
// CREATE / UPDATE GRAPH
// ==========================================

function renderPerformanceChart(results) {

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(
            "Chart.js has not loaded."
        );

        return;

    }


    const graphData =
        prepareGraphData(
            results
        );


    if (
        performanceChart
    ) {

        performanceChart.destroy();

        performanceChart =
            null;

    }


    performanceChart =
        new Chart(
            chartCanvas,
            {

                type: "line",

                data: {

                    labels:
                        graphData.subjects,

                    datasets: [

                        {

                            label:
                                "Marks (%)",

                            data:
                                graphData.marks,

                            tension:
                                0.3,

                            fill:
                                false,

                            pointRadius:
                                5,

                            pointHoverRadius:
                                7

                        }

                    ]

                },


                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },


                    scales: {

                        y: {

                            min:
                                0,

                            max:
                                100,

                            ticks: {

                                callback:
                                    function(value) {

                                        return value +
                                            "%";

                                    }

                            },

                            title: {

                                display:
                                    true,

                                text:
                                    "Marks"

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
                                    function(context) {

                                        return (
                                            " Marks: " +
                                            context.parsed.y +
                                            "%"
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

}


// ==========================================
// RENDER EVERYTHING
// ==========================================

function renderPage() {

    const results =
        getFilteredResults();


    updateSummary(
        results
    );


    renderResultsTable(
        results
    );


    renderPerformanceChart(
        results
    );

}


// ==========================================
// LOAD EVERYTHING
// ==========================================

async function loadStudentPage() {

    try {

        refreshButton.disabled =
            true;

        refreshButton.textContent =
            "Loading...";


        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-row"
                >

                    Loading results...

                </td>

            </tr>

        `;


        showMessage(
            "Loading your academic information...",
            "info"
        );


        /*
         * STEP 1
         * Check authentication.
         */

        currentUser =
            await checkLogin();


        if (!currentUser) {

            window.location.href =
                "index.html";

            return;

        }


        /*
         * STEP 2
         * Find student.
         */

        await loadStudent();


        /*
         * STEP 3
         * Load grading configuration.
         */

        await loadGradingSystem();


        /*
         * STEP 4
         * Load results.
         */

        await loadResults();


        /*
         * STEP 5
         * Render page.
         */

        renderPage();


        hideMessage();


    }

    catch (error) {

        console.error(
            "Student page error:",
            error
        );


        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-row"
                >

                    Unable to load your results.

                </td>

            </tr>

        `;


        showMessage(
            error.message ||
            "Something went wrong while loading your results.",
            "error"
        );

    }

    finally {

        refreshButton.disabled =
            false;

        refreshButton.textContent =
            "Refresh";

    }

}


// ==========================================
// TERM FILTER
// ==========================================

termFilter.addEventListener(
    "change",
    function() {

        renderPage();

    }
);


// ==========================================
// YEAR FILTER
// ==========================================

yearFilter.addEventListener(
    "change",
    function() {

        renderPage();

    }
);


// ==========================================
// RESULT MODE
// ==========================================

resultMode.addEventListener(
    "change",
    function() {

        const mode =
            resultMode.value;


        /*
         * Currently the page always keeps
         * the performance graph visible.
         *
         * The mode can be extended later
         * without changing the database logic.
         */

        if (
            mode === "subjects"
        ) {

            renderPage();

            return;

        }


        if (
            mode === "summary"
        ) {

            renderPage();

        }

    }
);


// ==========================================
// REFRESH
// ==========================================

refreshButton.addEventListener(
    "click",
    async function() {

        await loadStudentPage();

    }
);


// ==========================================
// LOGOUT
// ==========================================

document
    .getElementById("logout")
    .addEventListener(
        "click",
        async function(event) {

            event.preventDefault();


            const confirmed =
                window.confirm(
                    "Are you sure you want to sign out?"
                );


            if (!confirmed) {

                return;

            }


            try {

                this.textContent =
                    "Signing out...";

                this.style.pointerEvents =
                    "none";


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
                    "Logout error:",
                    error
                );


                showMessage(
                    "Sign out failed: " +
                    error.message,
                    "error"
                );


                this.textContent =
                    "Logout";

                this.style.pointerEvents =
                    "";

            }

        }
    );


// ==========================================
// AUTH STATE LISTENER
// ==========================================

supabase.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        if (
            event ===
            "SIGNED_OUT"
        ) {

            window.location.href =
                "index.html";

        }

    }
);


// ==========================================
// START
// ==========================================

loadStudentPage();
