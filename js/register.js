import { supabase } from "./supabase.js";

// ==========================================
// ELEMENTS
// ==========================================

const form = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("registerMessage");

const studentFields = document.getElementById("studentFields");
const admissionGroup = document.getElementById("admissionGroup");

const admissionInput = document.getElementById("admission");
const studentClass = document.getElementById("studentClass");
const subjectCounter = document.getElementById("subjectCounter");


// ==========================================
// MESSAGE
// ==========================================

function showMessage(text, type) {

    message.textContent = text;

    message.className =
        "register-message show " + type;

    // Make sure it is visible
    message.style.display = "block";

    // Scroll to the message
    message.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}


// ==========================================
// ACCOUNT TYPE
// ==========================================

function getAccountType() {

    const selected =
        document.querySelector(
            'input[name="accountType"]:checked'
        );

    return selected
        ? selected.value
        : "student";
}


function updateAccountType() {

    const type = getAccountType();

    const isStudent = type === "student";

    if (studentFields) {

        studentFields.classList.toggle(
            "hidden",
            !isStudent
        );

        studentFields.style.display =
            isStudent ? "block" : "none";
    }


    if (admissionGroup) {

        admissionGroup.classList.toggle(
            "hidden",
            !isStudent
        );

        admissionGroup.style.display =
            isStudent ? "block" : "none";
    }


    if (studentClass) {
        studentClass.required = isStudent;
    }


    if (admissionInput) {
        admissionInput.required = isStudent;
    }


    if (registerButton) {

        registerButton.textContent =
            isStudent
                ? "Create Student Account"
                : "Request Administrator Account";
    }
}


document
    .querySelectorAll(
        'input[name="accountType"]'
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            updateAccountType
        );

    });


// ==========================================
// SUBJECT COUNTER
// ==========================================

function updateSubjectCounter() {

    const selected =
        document.querySelectorAll(
            'input[name="subjects"]:checked'
        );

    const count = selected.length;

    if (subjectCounter) {

        subjectCounter.textContent =
            `${count} subject${count === 1 ? "" : "s"} selected`;
    }
}


document
    .querySelectorAll(
        'input[name="subjects"]'
    )
    .forEach(checkbox => {

        checkbox.addEventListener(
            "change",
            updateSubjectCounter
        );

    });


updateAccountType();
updateSubjectCounter();


// ==========================================
// REGISTRATION
// ==========================================

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        // Clear previous message
        message.textContent = "";
        message.className = "register-message";
        message.style.display = "none";

        registerButton.disabled = true;
        registerButton.textContent = "Creating Account...";


        try {

            // ==================================
            // ACCOUNT TYPE
            // ==================================

            const accountType =
                getAccountType();


            // ==================================
            // BASIC INFORMATION
            // ==================================

            const fullName =
                document
                    .getElementById("fullName")
                    .value
                    .trim();


            const username =
                document
                    .getElementById("username")
                    .value
                    .trim();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                document
                    .getElementById("password")
                    .value;


            const confirmPassword =
                document
                    .getElementById("confirmPassword")
                    .value;


            // ==================================
            // VALIDATION
            // ==================================

            if (!fullName) {

                throw new Error(
                    "Please enter your full name."
                );
            }


            if (!username) {

                throw new Error(
                    "Please enter a username."
                );
            }


            if (!email) {

                throw new Error(
                    "Please enter your email."
                );
            }


            if (password.length < 8) {

                throw new Error(
                    "Password must contain at least 8 characters."
                );
            }


            if (password !== confirmPassword) {

                throw new Error(
                    "The passwords do not match."
                );
            }


            // ==================================
            // STUDENT DATA
            // ==================================

            let admission = null;
            let className = null;
            let optionalSubjects = [];


            if (accountType === "student") {

                admission =
                    admissionInput.value.trim();


                className =
                    studentClass.value;


                optionalSubjects =
                    Array.from(
                        document.querySelectorAll(
                            'input[name="subjects"]:checked'
                        )
                    ).map(
                        checkbox => checkbox.value
                    );


                if (!admission) {

                    throw new Error(
                        "Please enter the admission number."
                    );
                }


                if (!className) {

                    throw new Error(
                        "Please select Grade 10, Grade 11, or Grade 12."
                    );
                }


                if (optionalSubjects.length < 1) {

                    throw new Error(
                        "Please select at least one optional subject."
                    );
                }
            }


            // ==================================
            // CHECK USERNAME
            // ==================================

            const {
                data: existingUsername,
                error: usernameCheckError
            } =
                await supabase
                    .from("profiles")
                    .select("id")
                    .eq("username", username)
                    .maybeSingle();


            if (usernameCheckError) {

                console.error(
                    "Username check error:",
                    usernameCheckError
                );
            }


            if (existingUsername) {

                throw new Error(
                    "That username is already in use."
                );
            }


            // ==================================
            // CREATE AUTH ACCOUNT
            // ==================================

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.signUp({

                    email: email,

                    password: password,

                    options: {

                        data: {

                            full_name: fullName,

                            username: username
                        }
                    }
                });


            if (authError) {

                throw authError;
            }


            if (!authData.user) {

                throw new Error(
                    "The account could not be created."
                );
            }


            const userId =
                authData.user.id;


            console.log(
                "Auth account created:",
                userId
            );


            // ==================================
            // CREATE PROFILE
            // ==================================

            const {
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id: userId,

                        full_name: fullName,

                        username: username,

                        email: email
                    });


            if (profileError) {

                throw profileError;
            }


            // ==================================
            // STUDENT
            // ==================================

            if (accountType === "student") {


                // ------------------------------
                // STUDENT RECORD
                // ------------------------------

                const {
                    error: studentError
                } =
                    await supabase
                        .from("students")
                        .insert({

                            user_id: userId,

                            admission_number: admission,

                            class: className,

                            optional_subjects:
                                optionalSubjects
                        });


                if (studentError) {

                    throw studentError;
                }


                // ------------------------------
                // STUDENT ROLE
                // ------------------------------

                const {
                    error: roleError
                } =
                    await supabase
                        .from("user_roles")
                        .insert({

                            user_id: userId,

                            role: "student"
                        });


                if (roleError) {

                    throw roleError;
                }


                // ==================================
                // SUCCESS
                // ==================================

                showMessage(
                    "Registration successful! Your student account has been created. You can now sign in.",
                    "success"
                );


                // Change button text
                registerButton.textContent =
                    "Registration Successful";


                // Wait before resetting
                setTimeout(() => {

                    form.reset();

                    updateAccountType();

                    updateSubjectCounter();

                    registerButton.disabled = false;

                }, 2500);


                return;
            }


            // ==================================
            // ADMIN REQUEST
            // ==================================

            const {
                error: requestError
            } =
                await supabase
                    .from("admin_requests")
                    .insert({

                        user_id: userId,

                        full_name: fullName,

                        username: username,

                        email: email,

                        status: "pending"
                    });


            if (requestError) {

                throw requestError;
            }


            // ==================================
            // ADMIN SUCCESS
            // ==================================

            showMessage(
                "Registration successful! Your administrator request has been submitted and is waiting for Super Admin approval.",
                "success"
            );


            registerButton.textContent =
                "Request Submitted";


            setTimeout(() => {

                form.reset();

                updateAccountType();

                updateSubjectCounter();

                registerButton.disabled = false;

            }, 2500);

        }


        // ==================================
        // ERROR
        // ==================================

        catch (error) {

            console.error(
                "Registration error:",
                error
            );


            showMessage(
                error.message ||
                "Registration failed. Please try again.",
                "error"
            );


            registerButton.disabled =
                false;

            updateAccountType();
        }

    }
);
