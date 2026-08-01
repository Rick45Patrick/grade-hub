// ==========================================
// GRADE HUB - RESULT UPLOAD SYSTEM
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let selectedStudent = null;

let currentAdmin = null;

let selectedStudentData = null;


// ==========================================
// ELEMENTS
// ==========================================

const form =
    document.getElementById("resultForm");

const message =
    document.getElementById("message");

const studentInfo =
    document.getElementById("studentInfo");

const logoutButton =
    document.getElementById("logout");

const studentStatusTable =
    document.getElementById(
        "studentStatusTable"
    );

const totalStudents =
    document.getElementById(
        "totalStudents"
    );

const uploadedStudents =
    document.getElementById(
        "uploadedStudents"
    );

const pendingStudents =
    document.getElementById(
        "pendingStudents"
    );

const statusTerm =
    document.getElementById(
        "statusTerm"
    );

const statusYear =
    document.getElementById(
        "statusYear"
    );

const refreshStatus =
    document.getElementById(
        "refreshStatus"
    );


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
    text,
    type = "success"
) {

    if (!message) {
        return;
    }


    message.textContent =
        text;


    message.style.display =
        "block";


    if (type === "error") {

        message.style.color =
            "#991b1b";

        message.style.background =
            "#fee2e2";

    } else {

        message.style.color =
            "#166534";

        message.style.background =
            "#dcfce7";

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
// CHECK ADMIN
// ==========================================

async function checkAdmin() {

    const {
        data: {
            session
        },
        error: sessionError
    } =
        await supabase.auth.getSession();


    if (sessionError) {

        console.error(
            "Session error:",
            sessionError
        );

        window.location.replace(
            "index.html"
        );

        return false;

    }


    if (!session) {

        window.location.replace(
            "index.html"
        );

        return false;

    }


    currentAdmin =
        session.user;


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
                currentAdmin.id
            );


    if (roleError) {

        console.error(
            "Role error:",
            roleError
        );


        showMessage(
            "Unable to verify administrator access: " +
            roleError.message,
            "error"
        );

        return false;

    }


    const adminRole =
        (roles || []).find(
            role =>
                (
                    role.role === "admin" ||
                    role.role === "super_admin"
                ) &&
                role.approved === true
        );


    if (!adminRole) {

        showMessage(
            "This account does not have an approved administrator role.",
            "error"
        );

        return false;

    }


    return true;

}


// ==========================================
// GET STUDENTS
// ==========================================

async function getStudents() {

    const {
        data,
        error
    } =
        await supabase
            .from("students")
            .select(
                "id, user_id, admission_number, class, optional_subjects"
            )
            .order(
                "admission_number",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    return data || [];

}


// ==========================================
// LOAD PROFILES
// ==========================================

async function getProfiles(
    students
) {

    const userIds =
        students
            .map(
                student =>
                    student.user_id
            )
            .filter(Boolean);


    if (userIds.length === 0) {
        return [];
    }


    const {
        data,
        error
    } =
        await supabase
            .from("profiles")
            .select(
                "id, full_name, username, email"
            )
            .in(
                "id",
                userIds
            );


    if (error) {

        throw error;

    }


    return data || [];

}


// ==========================================
// LOAD RESULTS FOR STATUS
// ==========================================

async function getResults(
    studentIds,
    term,
    year
) {

    if (
        !studentIds ||
        studentIds.length === 0
    ) {

        return [];

    }


    const {
        data,
        error
    } =
        await supabase
            .from("results")
            .select(
                "id, student_id, subject, marks, term, year"
            )
            .in(
                "student_id",
                studentIds
            )
            .eq(
                "term",
                term
            )
            .eq(
                "year",
                year
            );


    if (error) {

        throw error;

    }


    return data || [];

}


// ==========================================
// NORMALIZE SUBJECT
// ==========================================

function normalizeSubject(
    subject
) {

    return String(
        subject || ""
    )
        .trim()
        .toLowerCase();

}


// ==========================================
// GET REQUIRED SUBJECTS
// ==========================================

function getRequiredSubjects(
    student
) {

    const subjects = [

        "mathematics",

        "english",

        "kiswahili",

        "csl"

    ];


    const optional =
        Array.isArray(
            student.optional_subjects
        )
            ? student.optional_subjects
            : [];


    optional.forEach(
        subject => {

            if (
                subject &&
                String(subject).trim()
            ) {

                subjects.push(
                    normalizeSubject(
                        subject
                    )
                );

            }

        }
    );


    return subjects;

}


// ==========================================
// CHECK WHETHER STUDENT IS COMPLETE
// ==========================================

function isStudentUploaded(
    student,
    results
) {

    const requiredSubjects =
        getRequiredSubjects(
            student
        );


    const studentResults =
        results.filter(
            result =>
                result.student_id ===
                student.id
        );


    const uploadedSubjects =
        new Set(
            studentResults.map(
                result =>
                    normalizeSubject(
                        result.subject
                    )
            )
        );


    return requiredSubjects.every(
        subject =>
            uploadedSubjects.has(
                normalizeSubject(
                    subject
                )
            )
    );

}


// ==========================================
// RENDER STATUS TABLE
// ==========================================

function renderStudentStatus(
    students,
    profiles,
    results
) {

    const profileMap = {};


    profiles.forEach(
        profile => {

            profileMap[
                profile.id
            ] = profile;

        }
    );


    let uploaded = 0;

    let pending = 0;


    if (
        !students ||
        students.length === 0
    ) {

        totalStudents.textContent =
            "0";

        uploadedStudents.textContent =
            "0";

        pendingStudents.textContent =
            "0";


        studentStatusTable.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="sa-empty"
                >
                    No students registered yet.
                </td>

            </tr>

        `;

        return;

    }


    const rows =
        students.map(
            student => {

                const profile =
                    profileMap[
                        student.user_id
                    ] || {};


                const complete =
                    isStudentUploaded(
                        student,
                        results
                    );


                if (complete) {

                    uploaded++;

                } else {

                    pending++;

                }


                const status =
                    complete
                        ? `
                            <span class="status uploaded">
                                ✓ Uploaded
                            </span>
                        `
                        : `
                            <span class="status pending">
                                ✕ Pending
                            </span>
                        `;


                return `

                    <tr>

                        <td>
                            ${escapeHTML(
                                student.admission_number ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                profile.full_name ||
                                profile.username ||
                                "Student"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.class ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${status}
                        </td>

                        <td>

                            <button
                                type="button"
                                class="upload-student-button"
                                data-student-id="${escapeHTML(
                                    student.id
                                )}"
                            >
                                ${complete
                                    ? "Edit"
                                    : "Upload"
                                }
                            </button>

                        </td>

                    </tr>

                `;

            }
        );


    totalStudents.textContent =
        students.length;


    uploadedStudents.textContent =
        uploaded;


    pendingStudents.textContent =
        pending;


    studentStatusTable.innerHTML =
        rows.join("");

}


// ==========================================
// LOAD STUDENT STATUS
// ==========================================

async function loadStudentStatus() {

    if (!studentStatusTable) {
        return;
    }


    studentStatusTable.innerHTML = `

        <tr>

            <td
                colspan="5"
                class="sa-empty"
            >
                Loading students...
            </td>

        </tr>

    `;


    const term =
        statusTerm.value;


    const year =
        Number(
            statusYear.value
        );


    if (
        !Number.isInteger(year) ||
        year < 2020 ||
        year > 2100
    ) {

        studentStatusTable.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="sa-empty"
                >
                    Enter a valid year.
                </td>

            </tr>

        `;

        return;

    }


    try {

        const students =
            await getStudents();


        const profiles =
            await getProfiles(
                students
            );


        const studentIds =
            students.map(
                student =>
                    student.id
            );


        const results =
            await getResults(
                studentIds,
                term,
                year
            );


        renderStudentStatus(
            students,
            profiles,
            results
        );

    }

    catch (error) {

        console.error(
            "Student status error:",
            error
        );


        studentStatusTable.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="sa-empty"
                >
                    Failed to load student status.
                    ${escapeHTML(
                        error.message
                    )}
                </td>

            </tr>

        `;


        totalStudents.textContent =
            "0";

        uploadedStudents.textContent =
            "0";

        pendingStudents.textContent =
            "0";

    }

}


// ==========================================
// SELECT STUDENT FROM TABLE
// ==========================================

if (studentStatusTable) {

    studentStatusTable.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-student-id]"
                );


            if (!button) {
                return;
            }


            const studentId =
                button.dataset.studentId;


            if (!studentId) {
                return;
            }


            localStorage.setItem(
                "selectedStudent",
                studentId
            );


            await loadStudent(
                studentId
            );


            document
                .querySelector(
                    "#resultForm"
                )
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

        }
    );

}


// ==========================================
// LOAD SELECTED STUDENT
// ==========================================

async function loadStudent(
    studentId = null
) {

    const id =
        studentId ||
        localStorage.getItem(
            "selectedStudent"
        );


    if (!id) {

        studentInfo.innerHTML = `

            <div class="student-detail">

                <span>
                    Student
                </span>

                <strong>
                    Select a student from the table above
                </strong>

            </div>

        `;

        return;

    }


    selectedStudent =
        id;


    localStorage.setItem(
        "selectedStudent",
        id
    );


    const {
        data: student,
        error: studentError
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
                "id",
                id
            )
            .maybeSingle();


    if (studentError) {

        console.error(
            "Student error:",
            studentError
        );


        showMessage(
            "Unable to load student: " +
            studentError.message,
            "error"
        );

        return;

    }


    if (!student) {

        showMessage(
            "The selected student could not be found.",
            "error"
        );

        return;

    }


    selectedStudentData =
        student;


    let profile = null;


    if (student.user_id) {

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(
                    "id, full_name, username, email"
                )
                .eq(
                    "id",
                    student.user_id
                )
                .maybeSingle();


        if (error) {

            console.error(
                "Profile error:",
                error
            );

        } else {

            profile = data;

        }

    }


    studentInfo.innerHTML = `

        <div class="student-detail">

            <span>
                Student
            </span>

            <strong>
                ${escapeHTML(
                    profile?.full_name ||
                    "Student"
                )}
            </strong>

        </div>


        <div class="student-detail">

            <span>
                Admission
            </span>

            <strong>
                ${escapeHTML(
                    student.admission_number ||
                    "—"
                )}
            </strong>

        </div>


        <div class="student-detail">

            <span>
                Class
            </span>

            <strong>
                ${escapeHTML(
                    student.class ||
                    "—"
                )}
            </strong>

        </div>

    `;


    // ======================================
    // OPTIONAL SUBJECTS
    // ======================================

    const subjects =
        Array.isArray(
            student.optional_subjects
        )
            ? student.optional_subjects
            : [];


    for (
        let i = 1;
        i <= 3;
        i++
    ) {

        const input =
            document.getElementById(
                `optionalName${i}`
            );


        const mark =
            document.getElementById(
                `optionalMark${i}`
            );


        const subject =
            subjects[i - 1] || "";


        if (input) {

            input.value =
                subject;

        }


        if (mark) {

            mark.value =
                "";

        }

    }


    // ======================================
    // LOAD EXISTING MARKS
    // ======================================

    await loadExistingResults();

}


// ==========================================
// LOAD EXISTING RESULTS
// ==========================================

async function loadExistingResults() {

    if (!selectedStudent) {
        return;
    }


    const term =
        document.getElementById(
            "term"
        ).value;


    const year =
        Number(
            document.getElementById(
                "year"
            ).value
        );


    if (!Number.isInteger(year)) {
        return;
    }


    const {
        data: results,
        error
    } =
        await supabase
            .from("results")
            .select(
                "subject, marks"
            )
            .eq(
                "student_id",
                selectedStudent
            )
            .eq(
                "term",
                term
            )
            .eq(
                "year",
                year
            );


    if (error) {

        console.error(
            "Existing results error:",
            error
        );

        return;

    }


    const resultMap = {};


    (results || []).forEach(
        result => {

            resultMap[
                normalizeSubject(
                    result.subject
                )
            ] = result.marks;

        }
    );


    const compulsory = [

        [
            "mathematics",
            "mathematics"
        ],

        [
            "english",
            "english"
        ],

        [
            "kiswahili",
            "kiswahili"
        ],

        [
            "csl",
            "csl"
        ]

    ];


    compulsory.forEach(
        ([key, id]) => {

            const input =
                document.getElementById(
                    id
                );


            if (!input) {
                return;
            }


            const value =
                resultMap[key];


            input.value =
                value !== undefined
                    ? value
                    : "";

        }
    );


    for (
        let i = 1;
        i <= 3;
        i++
    ) {

        const nameInput =
            document.getElementById(
                `optionalName${i}`
            );


        const markInput =
            document.getElementById(
                `optionalMark${i}`
            );


        if (
            !nameInput ||
            !markInput
        ) {
            continue;
        }


        const name =
            normalizeSubject(
                nameInput.value
            );


        if (name) {

            const value =
                resultMap[name];


            markInput.value =
                value !== undefined
                    ? value
                    : "";

        }

    }

}


// ==========================================
// GET MARK
// ==========================================

function getMark(id) {

    const input =
        document.getElementById(
            id
        );


    if (!input) {
        return null;
    }


    const value =
        input.value.trim();


    if (value === "") {
        return null;
    }


    const mark =
        Number(value);


    if (
        !Number.isFinite(mark) ||
        mark < 0 ||
        mark > 100
    ) {

        return null;

    }


    return mark;

}


// ==========================================
// SAVE ONE RESULT
// ==========================================

async function saveResult(
    subject,
    mark,
    term,
    year
) {

    const {
        data: existing,
        error: checkError
    } =
        await supabase
            .from("results")
            .select("id")
            .eq(
                "student_id",
                selectedStudent
            )
            .eq(
                "subject",
                subject
            )
            .eq(
                "term",
                term
            )
            .eq(
                "year",
                year
            )
            .maybeSingle();


    if (checkError) {

        throw checkError;

    }


    if (existing) {

        const {
            error
        } =
            await supabase
                .from("results")
                .update({

                    marks:
                        mark,

                    uploaded_by:
                        currentAdmin.id

                })
                .eq(
                    "id",
                    existing.id
                );


        if (error) {

            throw error;

        }


        return "updated";

    }


    const {
        error
    } =
        await supabase
            .from("results")
            .insert({

                student_id:
                    selectedStudent,

                subject:
                    subject,

                marks:
                    mark,

                term:
                    term,

                year:
                    year,

                uploaded_by:
                    currentAdmin.id

            });


    if (error) {

        throw error;

    }


    return "inserted";

}


// ==========================================
// SAVE RESULTS
// ==========================================

if (form) {

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!selectedStudent) {

                showMessage(
                    "Select a student before saving results.",
                    "error"
                );

                return;

            }


            const term =
                document.getElementById(
                    "term"
                ).value;


            const year =
                Number(
                    document.getElementById(
                        "year"
                    ).value
                );


            if (
                !Number.isInteger(year) ||
                year < 2020 ||
                year > 2100
            ) {

                showMessage(
                    "Enter a valid year.",
                    "error"
                );

                return;

            }


            const mathematics =
                getMark(
                    "mathematics"
                );


            const english =
                getMark(
                    "english"
                );


            const kiswahili =
                getMark(
                    "kiswahili"
                );


            const csl =
                getMark(
                    "csl"
                );


            if (
                mathematics === null ||
                english === null ||
                kiswahili === null ||
                csl === null
            ) {

                showMessage(
                    "Enter valid marks from 0 to 100 for all compulsory subjects.",
                    "error"
                );

                return;

            }


            const subjects = [

                {
                    name:
                        "Mathematics",

                    mark:
                        mathematics
                },

                {
                    name:
                        "English",

                    mark:
                        english
                },

                {
                    name:
                        "Kiswahili",

                    mark:
                        kiswahili
                },

                {
                    name:
                        "CSL",

                    mark:
                        csl
                }

            ];


            // ======================================
            // OPTIONAL SUBJECTS
            // ======================================

            for (
                let i = 1;
                i <= 3;
                i++
            ) {

                const name =
                    document
                        .getElementById(
                            `optionalName${i}`
                        )
                        .value
                        .trim();


                const markInput =
                    document.getElementById(
                        `optionalMark${i}`
                    );


                const markValue =
                    markInput.value.trim();


                if (name) {

                    if (
                        markValue === ""
                    ) {

                        showMessage(
                            `Enter a mark for ${name}.`,
                            "error"
                        );

                        return;

                    }


                    const mark =
                        Number(
                            markValue
                        );


                    if (
                        !Number.isFinite(mark) ||
                        mark < 0 ||
                        mark > 100
                    ) {

                        showMessage(
                            `${name} must have a mark between 0 and 100.`,
                            "error"
                        );

                        return;

                    }


                    subjects.push({

                        name:
                            name,

                        mark:
                            mark

                    });

                }

            }


            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Saving Results...";

            }


            if (message) {

                message.style.display =
                    "none";

            }


            try {

                let inserted = 0;

                let updated = 0;


                for (
                    const subject
                    of subjects
                ) {

                    const action =
                        await saveResult(
                            subject.name,
                            subject.mark,
                            term,
                            year
                        );


                    if (
                        action ===
                        "inserted"
                    ) {

                        inserted++;

                    }


                    if (
                        action ===
                        "updated"
                    ) {

                        updated++;

                    }

                }


                showMessage(
                    `Results saved successfully. ${inserted} new result(s) added and ${updated} result(s) updated.`,
                    "success"
                );


                // Refresh the status table
                statusTerm.value =
                    term;

                statusYear.value =
                    year;


                await loadStudentStatus();


                await loadExistingResults();

            }

            catch (error) {

                console.error(
                    "Result upload error:",
                    error
                );


                showMessage(
                    "Result upload failed: " +
                    error.message,
                    "error"
                );

            }

            finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "Save Results";

                }

            }

        }
    );

}


// ==========================================
// TERM/YEAR CHANGES
// ==========================================

if (statusTerm) {

    statusTerm.addEventListener(
        "change",
        async () => {

            await loadStudentStatus();

        }
    );

}


if (statusYear) {

    statusYear.addEventListener(
        "change",
        async () => {

            await loadStudentStatus();

        }
    );

}


if (refreshStatus) {

    refreshStatus.addEventListener(
        "click",
        async () => {

            refreshStatus.disabled =
                true;

            refreshStatus.textContent =
                "Loading...";


            await loadStudentStatus();


            refreshStatus.disabled =
                false;

            refreshStatus.textContent =
                "Refresh";

        }
    );

}


// ==========================================
// FORM TERM/YEAR CHANGE
// LOAD EXISTING MARKS
// ==========================================

const formTerm =
    document.getElementById(
        "term"
    );


const formYear =
    document.getElementById(
        "year"
    );


if (formTerm) {

    formTerm.addEventListener(
        "change",
        async () => {

            await loadExistingResults();

        }
    );

}


if (formYear) {

    formYear.addEventListener(
        "change",
        async () => {

            await loadExistingResults();

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


            logoutButton.disabled =
                true;

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


                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Logout";

                showMessage(
                    "Logout failed: " +
                    error.message,
                    "error"
                );

                return;

            }


            window.location.replace(
                "index.html"
            );

        }
    );

}


// ==========================================
// START
// ==========================================

async function start() {

    const allowed =
        await checkAdmin();


    if (!allowed) {
        return;
    }


    // Load status table
    await loadStudentStatus();


    // Load student previously selected
    const previousStudent =
        localStorage.getItem(
            "selectedStudent"
        );


    if (previousStudent) {

        await loadStudent(
            previousStudent
        );

    }

}


start();
