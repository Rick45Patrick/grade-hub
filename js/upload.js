// ==========================================
// GRADE HUB - RESULT UPLOAD SYSTEM
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let selectedStudent = null;
let currentAdmin = null;


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


// ==========================================
// MESSAGE
// ==========================================

function showMessage(text, type = "success") {

    if (!message) {
        return;
    }

    message.textContent = text;

    message.style.display = "block";

    if (type === "error") {

        message.style.color = "#991b1b";
        message.style.background = "#fee2e2";
        message.style.padding = "12px";
        message.style.borderRadius = "8px";

    } else {

        message.style.color = "#166534";
        message.style.background = "#dcfce7";
        message.style.padding = "12px";
        message.style.borderRadius = "8px";

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
// CHECK ADMIN LOGIN
// ==========================================

async function checkAdmin() {

    console.log(
        "Checking administrator session..."
    );


    const {
        data: {
            session
        },
        error: sessionError
    } = await supabase.auth.getSession();


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

        console.error(
            "No active session."
        );

        window.location.replace(
            "index.html"
        );

        return false;
    }


    currentAdmin =
        session.user;


    console.log(
        "Logged-in user:",
        currentAdmin.id
    );


    // ======================================
    // CHECK USER ROLE
    // ======================================

    const {
        data: roles,
        error: roleError
    } = await supabase
        .from("user_roles")
        .select(`
            role,
            approved
        `)
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
                role.approved !== false
        );


    if (!adminRole) {

        showMessage(
            "This account does not have an approved administrator role.",
            "error"
        );

        return false;
    }


    console.log(
        "Administrator access confirmed."
    );


    return true;
}


// ==========================================
// LOAD SELECTED STUDENT
// ==========================================

async function loadStudent() {

    const allowed =
        await checkAdmin();


    if (!allowed) {
        return;
    }


    // ======================================
    // GET SELECTED STUDENT
    // ======================================

    const studentId =
        localStorage.getItem(
            "selectedStudent"
        );


    if (!studentId) {

        showMessage(
            "No student has been selected.",
            "error"
        );


        setTimeout(() => {

            window.location.replace(
                "admin.html"
            );

        }, 1500);


        return;
    }


    selectedStudent =
        studentId;


    console.log(
        "Selected student:",
        selectedStudent
    );


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
            optional_subjects
        `)
        .eq(
            "id",
            studentId
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


    // ======================================
    // LOAD PROFILE
    // ======================================

    let profile = null;


    if (student.user_id) {

        const {
            data,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                username,
                email
            `)
            .eq(
                "id",
                student.user_id
            )
            .maybeSingle();


        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );

        } else {

            profile = data;

        }
    }


    // ======================================
    // DISPLAY STUDENT INFORMATION
    // ======================================

    studentInfo.innerHTML = `

        <h3>
            ${escapeHTML(
                profile?.full_name ||
                "Student"
            )}
        </h3>

        <p>
            <strong>Admission:</strong>
            ${escapeHTML(
                student.admission_number
            )}
        </p>

        <p>
            <strong>Class:</strong>
            ${escapeHTML(
                student.class
            )}
        </p>

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


    const optionalName1 =
        document.getElementById(
            "optionalName1"
        );

    const optionalName2 =
        document.getElementById(
            "optionalName2"
        );

    const optionalName3 =
        document.getElementById(
            "optionalName3"
        );


    if (optionalName1) {

        optionalName1.value =
            subjects[0] || "";

    }


    if (optionalName2) {

        optionalName2.value =
            subjects[1] || "";

    }


    if (optionalName3) {

        optionalName3.value =
            subjects[2] || "";

    }


    console.log(
        "Student loaded successfully."
    );

}


// ==========================================
// GET MARK
// ==========================================

function getMark(id) {

    const input =
        document.getElementById(id);


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

    console.log(
        "Saving:",
        subject,
        mark,
        term,
        year
    );


    // ======================================
    // CHECK EXISTING RESULT
    // ======================================

    const {
        data: existing,
        error: checkError
    } = await supabase
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


    // ======================================
    // UPDATE
    // ======================================

    if (existing) {

        const {
            error
        } = await supabase
            .from("results")
            .update({
                marks: mark,
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


    // ======================================
    // INSERT
    // ======================================

    const {
        error
    } = await supabase
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
                    "No student selected.",
                    "error"
                );

                return;
            }


            // ==================================
            // TERM
            // ==================================

            const term =
                document
                    .getElementById("term")
                    .value;


            // ==================================
            // YEAR
            // ==================================

            const yearInput =
                document.getElementById(
                    "year"
                );


            const year =
                Number(
                    yearInput.value
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


            // ==================================
            // GET COMPULSORY MARKS
            // ==================================

            const mathematics =
                getMark("mathematics");

            const english =
                getMark("english");

            const kiswahili =
                getMark("kiswahili");

            const csl =
                getMark("csl");


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


            // ==================================
            // OPTIONAL SUBJECTS
            // ==================================

            const optionalSubjects = [];


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


                /*
                 * If the subject exists, a mark
                 * must be entered.
                 */

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
                        Number(markValue);


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


                    optionalSubjects.push({

                        name:
                            name,

                        mark:
                            mark

                    });

                }

            }


            // ==================================
            // BUILD RESULTS
            // ==================================

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


            optionalSubjects.forEach(
                subject => {

                    subjects.push({
                        name:
                            subject.name,

                        mark:
                            subject.mark
                    });

                }
            );


            // ==================================
            // DISABLE FORM
            // ==================================

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

                message.textContent = "";
            }


            try {

                let inserted = 0;
                let updated = 0;


                // ==================================
                // SAVE EACH SUBJECT
                // ==================================

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

                    } else if (
                        action ===
                        "updated"
                    ) {

                        updated++;

                    }

                }


                // ==================================
                // SUCCESS
                // ==================================

                showMessage(
                    `Results saved successfully. ${inserted} new result(s) added and ${updated} result(s) updated.`,
                    "success"
                );


                console.log(
                    "Results saved successfully."
                );

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
// START
// ==========================================

loadStudent();
