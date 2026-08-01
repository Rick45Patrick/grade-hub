// ==========================================
// GRADE HUB - STUDENT RESULTS
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// ELEMENTS
// ==========================================

const message =
    document.getElementById("message");

const studentName =
    document.getElementById("studentName");

const admissionNumber =
    document.getElementById("admissionNumber");

const studentClass =
    document.getElementById("studentClass");

const username =
    document.getElementById("username");

const termFilter =
    document.getElementById("termFilter");

const yearFilter =
    document.getElementById("yearFilter");

const refreshButton =
    document.getElementById("refreshButton");

const subjectCount =
    document.getElementById("subjectCount");

const average =
    document.getElementById("average");

const totalPoints =
    document.getElementById("totalPoints");

const overallGrade =
    document.getElementById("overallGrade");

const resultsTable =
    document.getElementById("resultsTable");

const logout =
    document.getElementById("logout");


// ==========================================
// STATE
// ==========================================

let currentUser = null;

let currentStudent = null;

let allResults = [];

let gradingSystem = [];


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

    const number =
        Number(value) || 0;

    return Math.round(
        number * 100
    ) / 100;

}


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkLogin() {

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


// ==========================================
// LOAD STUDENT
// ==========================================

async function loadStudent() {

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
                optional_subjects
            `)

            .eq(
                "user_id",
                currentUser.id
            )

            .maybeSingle();


    if (error) {

        console.error(
            "Student loading error:",
            error
        );

        throw error;

    }


    if (!data) {

        throw new Error(
            "No student profile is linked to this account."
        );

    }


    currentStudent =
        data;


    // ======================================
    // LOAD PROFILE
    // ======================================

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

            .eq(
                "id",
                currentUser.id
            )

            .maybeSingle();


    if (profileError) {

        console.error(
            "Profile loading error:",
            profileError
        );

    }


    studentName.textContent =
        profile?.full_name ||
        "Learner";


    username.textContent =
        profile?.username ||
        "—";


    admissionNumber.textContent =
        currentStudent.admission_number ||
        "—";


    studentClass.textContent =
        currentStudent.class ||
        "—";

}


// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults() {

    resultsTable.innerHTML = `

        <tr>

            <td
                colspan="8"
                class="empty-row"
            >
                Loading results...

            </td>

        </tr>

    `;


    const {
        data,
        error
    } =
        await supabase

            .from("results")

            .select(`
                id,
                student_id,
                subject,
                marks,
                term,
                year
            `)

            .eq(
                "student_id",
                currentStudent.id
            )

            .order(
                "year",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Results loading error:",
            error
        );

        throw error;

    }


    allResults =
        data || [];


    populateYears();


    renderResults();

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

        throw error;

    }


    gradingSystem =
        data || [];


    /*
     * If the grading table is empty,
     * don't silently use an old grading
     * configuration.
     */

    if (
        gradingSystem.length === 0
    ) {

        throw new Error(
            "The grading system has not been configured by the Super Admin."
        );

    }

}


// ==========================================
// GET GRADE
// ==========================================

function getGrade(marks) {

    const numericMarks =
        Number(marks);


    if (
        Number.isNaN(
            numericMarks
        )
    ) {

        return {

            grade: "—",

            points: 0,

            description: "No grade"

        };

    }


    /*
     * The first grading level whose
     * minimum mark is <= the student's
     * marks is the correct grade.
     */

    const grading =
        gradingSystem.find(
            item =>
                numericMarks >=
                Number(
                    item.min_mark
                )
        );


    if (!grading) {

        return {

            grade: "—",

            points: 0,

            description:
                "No grading level"

        };

    }


    return {

        grade:
            grading.grade,

        points:
            Number(
                grading.points
            ) || 0,

        description:
            grading.description ||
            ""

    };

}


// ==========================================
// POPULATE YEARS
// ==========================================

function populateYears() {

    const currentValue =
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
                            year !==
                            null &&
                            year !==
                            undefined &&
                            year !== ""
                    )

                    .map(
                        year =>
                            String(year)
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
                year;

            option.textContent =
                year;

            yearFilter.appendChild(
                option
            );

        }
    );


    if (
        years.includes(
            currentValue
        )
    ) {

        yearFilter.value =
            currentValue;

    }

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

function calculateAverage(
    results
) {

    if (
        !results ||
        results.length === 0
    ) {

        return 0;

    }


    let total = 0;

    let count = 0;


    results.forEach(
        result => {

            const marks =
                Number(
                    result.marks
                );


            if (
                !Number.isNaN(
                    marks
                )
            ) {

                total += marks;

                count++;

            }

        }
    );


    if (count === 0) {

        return 0;

    }


    return total / count;

}


// ==========================================
// CALCULATE POINTS
// ==========================================

function calculateTotalPoints(
    results
) {

    let total = 0;


    results.forEach(
        result => {

            const grading =
                getGrade(
                    result.marks
                );


            total +=
                Number(
                    grading.points
                ) || 0;

        }
    );


    return total;

}


// ==========================================
// RENDER RESULTS
// ==========================================

function renderResults() {

    const results =
        getFilteredResults();


    // ======================================
    // SUMMARY
    // ======================================

    subjectCount.textContent =
        results.length;


    const studentAverage =
        calculateAverage(
            results
        );


    average.textContent =
        `${formatAverage(
            studentAverage
        )}%`;


    const points =
        calculateTotalPoints(
            results
        );


    totalPoints.textContent =
        points;


    const overall =
        getGrade(
            studentAverage
        );


    overallGrade.textContent =
        overall.grade;


    // ======================================
    // EMPTY
    // ======================================

    if (
        results.length === 0
    ) {

        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-row"
                >
                    No results found for the selected filters.

                </td>

            </tr>

        `;

        return;

    }


    // ======================================
    // TABLE
    // ======================================

    resultsTable.innerHTML = "";


    results.forEach(
        (result, index) => {

            const grading =
                getGrade(
                    result.marks
                );


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${index + 1}
                </td>


                <td>

                    <strong>
                        ${escapeHTML(
                            result.subject ||
                            "—"
                        )}
                    </strong>

                </td>


                <td>

                    <strong>

                        ${escapeHTML(
                            formatAverage(
                                result.marks
                            )
                        )}

                    </strong>

                    %

                </td>


                <td>

                    <span class="grade-badge">

                        ${escapeHTML(
                            grading.grade
                        )}

                    </span>

                </td>


                <td>

                    <span class="description">

                        ${escapeHTML(
                            grading.description
                        )}

                    </span>

                </td>


                <td>

                    <span class="points">

                        ${grading.points}

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

            `;


            resultsTable.appendChild(
                row
            );

        }
    );

}


// ==========================================
// REFRESH
// ==========================================

async function refreshPage() {

    refreshButton.disabled =
        true;

    refreshButton.textContent =
        "Refreshing...";


    try {

        await loadStudent();

        await loadGradingSystem();

        await loadResults();


        showMessage(
            "Results updated successfully.",
            "success"
        );


    }

    catch (error) {

        console.error(
            "Refresh error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to load results.",
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
// FILTER EVENTS
// ==========================================

termFilter.addEventListener(
    "change",
    renderResults
);


yearFilter.addEventListener(
    "change",
    renderResults
);


// ==========================================
// REFRESH BUTTON
// ==========================================

refreshButton.addEventListener(
    "click",
    refreshPage
);


// ==========================================
// LOGOUT
// ==========================================

logout.addEventListener(
    "click",
    async event => {

        event.preventDefault();


        const confirmed =
            window.confirm(
                "Are you sure you want to sign out?"
            );


        if (!confirmed) {
            return;
        }


        logout.disabled =
            true;


        logout.textContent =
            "Signing out...";


        const {
            error
        } =
            await supabase.auth.signOut();


        if (error) {

            console.error(
                "Logout error:",
                error
            );


            showMessage(
                "Sign out failed: " +
                error.message,
                "error"
            );


            logout.disabled =
                false;

            logout.textContent =
                "Logout";

            return;

        }


        window.location.href =
            "index.html";

    }
);


// ==========================================
// INITIALIZE
// ==========================================

async function initialize() {

    try {

        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-row"
                >
                    Loading student account...

                </td>

            </tr>

        `;


        // ----------------------------------
        // LOGIN
        // ----------------------------------

        currentUser =
            await checkLogin();


        if (!currentUser) {

            window.location.href =
                "index.html";

            return;

        }


        // ----------------------------------
        // STUDENT
        // ----------------------------------

        await loadStudent();


        // ----------------------------------
        // GRADING SYSTEM
        // ----------------------------------
        //
        // IMPORTANT:
        // This reads the current grading
        // configuration from the same
        // grading_system table used by
        // Super Admin.
        //
        // ----------------------------------

        await loadGradingSystem();


        // ----------------------------------
        // RESULTS
        // ----------------------------------

        await loadResults();


        console.log(
            "Student page initialized successfully."
        );


    }

    catch (error) {

        console.error(
            "Student page error:",
            error
        );


        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-row"
                >
                    Unable to load results.

                </td>

            </tr>

        `;


        showMessage(
            error.message ||
            "Unable to load student results.",
            "error"
        );

    }

}


// ==========================================
// START
// ==========================================

initialize();
