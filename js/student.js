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

const studentUsername =
    document.getElementById("studentUsername");

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

const termFilter =
    document.getElementById("termFilter");

const yearFilter =
    document.getElementById("yearFilter");

const refreshButton =
    document.getElementById("refreshButton");

const logoutButton =
    document.getElementById("logoutButton");


// ==========================================
// DATA
// ==========================================

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

    if (!message) {
        return;
    }

    message.textContent = text;

    message.className =
        `message show ${type}`;

}


// ==========================================
// CLEAR MESSAGE
// ==========================================

function clearMessage() {

    if (!message) {
        return;
    }

    message.textContent = "";

    message.className =
        "message";

}


// ==========================================
// HTML ESCAPE
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
// FORMAT NUMBER
// ==========================================

function formatNumber(value) {

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
// GET LOGGED IN USER
// ==========================================

async function getLoggedInUser() {

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

        throw new Error(
            "Unable to verify your login."
        );

    }


    if (
        !data ||
        !data.user
    ) {

        window.location.href =
            "index.html";

        return null;

    }


    return data.user;

}


// ==========================================
// LOAD STUDENT
// ==========================================

async function loadStudent(user) {

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
                class
            `)

            .eq(
                "user_id",
                user.id
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


    return data;

}


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile(user) {

    const {
        data,
        error
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
                user.id
            )

            .maybeSingle();


    if (error) {

        console.error(
            "Profile query error:",
            error
        );

        /*
         * Profile is not essential enough
         * to stop the whole results page.
         */

        return null;

    }


    return data;

}


// ==========================================
// DISPLAY STUDENT
// ==========================================

function displayStudent(
    student,
    profile
) {

    studentName.textContent =
        profile?.full_name ||
        "Learner";

    admissionNumber.textContent =
        student.admission_number ||
        "—";

    studentClass.textContent =
        student.class ||
        "—";

    studentUsername.textContent =
        profile?.username ||
        "—";

}


// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults(studentId) {

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
            "Results query error:",
            error
        );

        throw new Error(
            "Could not load your results: " +
            error.message
        );

    }


    allResults =
        data || [];


    populateYears();

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
            "Grading system query error:",
            error
        );

        throw new Error(
            "Could not load the grading system: " +
            error.message
        );

    }


    gradingSystem =
        data || [];


    /*
     * If Super Admin has not configured
     * any grades, don't leave the page
     * stuck on loading.
     */

    if (
        gradingSystem.length === 0
    ) {

        showMessage(
            "No grading system has been configured by the Super Admin.",
            "info"
        );

    }


    return gradingSystem;

}


// ==========================================
// FIND GRADE
// ==========================================

function getGradeForMarks(marks) {

    const numericMarks =
        Number(marks);


    if (
        Number.isNaN(numericMarks)
    ) {

        return {

            grade: "-",

            points: 0,

            description: "-"

        };

    }


    /*
     * gradingSystem is sorted from
     * highest min_mark to lowest.
     *
     * Example:
     *
     * 90 EE1
     * 80 EE2
     * 70 ME1
     * ...
     */

    const matchingGrade =
        gradingSystem.find(
            grade =>
                numericMarks >=
                Number(
                    grade.min_mark
                )
        );


    if (!matchingGrade) {

        return {

            grade: "-",

            points: 0,

            description: "No grading level"

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
            "-"

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
                            year !== null &&
                            year !== undefined &&
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
                "all" &&
                result.term !==
                selectedTerm
            ) {

                return false;

            }


            if (
                selectedYear !==
                "all" &&
                String(
                    result.year
                ) !==
                String(
                    selectedYear
                )
            ) {

                return false;

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


    if (
        count === 0
    ) {

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

            const grade =
                getGradeForMarks(
                    result.marks
                );


            total +=
                Number(
                    grade.points
                ) || 0;

        }
    );


    return total;

}


// ==========================================
// RENDER SUMMARY
// ==========================================

function renderSummary(
    results
) {

    const avg =
        calculateAverage(
            results
        );


    const points =
        calculateTotalPoints(
            results
        );


    const overall =
        getGradeForMarks(
            avg
        );


    subjectCount.textContent =
        results.length;


    average.textContent =
        `${formatNumber(avg)}%`;


    totalPoints.textContent =
        points;


    overallGrade.textContent =
        overall.grade || "-";

}


// ==========================================
// RENDER RESULTS
// ==========================================

function renderResults() {

    const results =
        getFilteredResults();


    renderSummary(
        results
    );


    if (
        results.length === 0
    ) {

        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-row"
                >

                    No results found for
                    the selected filters.

                </td>

            </tr>

        `;

        return;

    }


    resultsTable.innerHTML =
        results.map(
            result => {

                const grade =
                    getGradeForMarks(
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

                            <strong>

                                ${formatNumber(
                                    result.marks
                                )}

                            </strong>

                        </td>


                        <td>

                            <span class="grade-badge">

                                ${escapeHTML(
                                    grade.grade
                                )}

                            </span>


                            <span
                                class="grade-description"
                            >

                                ${escapeHTML(
                                    grade.description
                                )}

                            </span>

                        </td>


                        <td>

                            <strong>

                                ${grade.points}

                            </strong>

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
// LOAD EVERYTHING
// ==========================================

async function loadStudentDashboard() {

    try {

        clearMessage();


        /*
         * IMPORTANT:
         *
         * Replace "Loading results..."
         * immediately so the page cannot
         * remain stuck indefinitely.
         */

        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-row"
                >

                    Loading results...

                </td>

            </tr>

        `;


        /*
         * 1. Check login
         */

        const user =
            await getLoggedInUser();


        if (!user) {
            return;
        }


        /*
         * 2. Load student record
         */

        const student =
            await loadStudent(
                user
            );


        /*
         * 3. Load profile
         */

        const profile =
            await loadProfile(
                user
            );


        displayStudent(
            student,
            profile
        );


        /*
         * 4. Load results
         */

        await loadResults(
            student.id
        );


        /*
         * 5. Load current grading system
         *
         * This is the important part:
         * the grades are NOT hard-coded.
         */

        await loadGradingSystem();


        /*
         * 6. Render page
         */

        renderResults();


    }

    catch (error) {

        console.error(
            "Student dashboard error:",
            error
        );


        resultsTable.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-row"
                >

                    Unable to load results.

                </td>

            </tr>

        `;


        showMessage(
            error.message ||
            "Something went wrong while loading your results.",
            "error"
        );

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

            await loadStudentDashboard();

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

logoutButton.addEventListener(
    "click",
    async () => {

        const confirmed =
            window.confirm(
                "Are you sure you want to sign out?"
            );


        if (!confirmed) {
            return;
        }


        logoutButton.disabled =
            true;

        logoutButton.textContent =
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
                "Logout failed: " +
                error.message,
                "error"
            );


            logoutButton.disabled =
                false;

            logoutButton.textContent =
                "Logout";

            return;

        }


        window.location.href =
            "index.html";

    }
);


// ==========================================
// START
// ==========================================

loadStudentDashboard();
