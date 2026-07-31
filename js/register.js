import { supabase } from "./supabase.js";


const form =
    document.getElementById("registerForm");

const studentType =
    document.getElementById("studentType");

const adminType =
    document.getElementById("adminType");

const accountType =
    document.getElementById("accountType");

const studentFields =
    document.getElementById("studentFields");

const registerButton =
    document.getElementById("registerButton");

const message =
    document.getElementById("registerMessage");


function setAccountType(type) {

    accountType.value = type;


    studentType.classList.toggle(
        "active",
        type === "student"
    );


    adminType.classList.toggle(
        "active",
        type === "admin"
    );


    if (type === "student") {

        studentFields.style.display =
            "block";

        registerButton.textContent =
            "Create Student Account";

    } else {

        studentFields.style.display =
            "none";

        registerButton.textContent =
            "Request Administrator Account";

    }
}


studentType.addEventListener(
    "click",
    () => setAccountType("student")
);


adminType.addEventListener(
    "click",
    () => setAccountType("admin")
);


form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        message.textContent = "";
        message.className =
            "register-message";


        const type =
            accountType.value;


        const fullName =
            document
                .getElementById("fullName")
                .value
                .trim();


        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const username =
            document
                .getElementById("username")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        const confirmPassword =
            document
                .getElementById("confirmPassword")
                .value;


        if (password.length < 8) {

            showError(
                "Password must contain at least 8 characters."
            );

            return;
        }


        if (password !== confirmPassword) {

            showError(
                "The passwords do not match."
            );

            return;
        }


        let admission = "";
        let className = "";
        let optionalSubjects = [];


        if (type === "student") {

            admission =
                document
                    .getElementById("admission")
                    .value
                    .trim();


            className =
                document
                    .getElementById("className")
                    .value;


            optionalSubjects =
                Array.from(
                    document.querySelectorAll(
                        'input[name="optionalSubject"]:checked'
                    )
                )
                .map(
                    checkbox => checkbox.value
                );


            if (!admission) {

                showError(
                    "Enter the student's admission number."
                );

                return;
            }


            if (!className) {

                showError(
                    "Select the student's class."
                );

                return;
            }


            if (optionalSubjects.length !== 3) {

                showError(
                    "Select exactly 3 optional subjects."
                );

                return;
            }

        }


        registerButton.disabled = true;

        registerButton.textContent =
            "Creating account...";


        try {

            const {
                data,
                error
            } =
                await supabase.auth.signUp({

                    email,

                    password,

                    options: {

                        data: {

                            full_name:
                                fullName,

                            username:
                                username

                        }

                    }

                });


            if (error) {

                throw error;

            }


            if (!data.user) {

                throw new Error(
                    "The account could not be created."
                );

            }


            const userId =
                data.user.id;


            /*
             * PROFILE
             */

            const {
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id: userId,

                        full_name:
                            fullName,

                        username:
                            username,

                        email:
                            email

                    });


            if (profileError) {

                console.error(
                    profileError
                );

                throw profileError;

            }


            /*
             * STUDENT
             */

            if (type === "student") {

                const {
                    error: studentError
                } =
                    await supabase
                        .from("students")
                        .insert({

                            user_id:
                                userId,

                            admission_number:
                                admission,

                            class:
                                className,

                            optional_subjects:
                                optionalSubjects

                        });


                if (studentError) {

                    console.error(
                        studentError
                    );

                    throw studentError;

                }


                const {
                    error: roleError
                } =
                    await supabase
                        .from("user_roles")
                        .insert({

                            user_id:
                                userId,

                            role:
                                "student",

                            approved:
                                true

                        });


                if (roleError) {

                    console.error(
                        roleError
                    );

                    throw roleError;

                }


                showSuccess(
                    "Student account created successfully. You can now sign in."
                );


                form.reset();


                setAccountType(
                    "student"
                );


                return;

            }


            /*
             * ADMIN REQUEST
             */

            const {
                error: requestError
            } =
                await supabase
                    .from("admin_requests")
                    .insert({

                        user_id:
                            userId,

                        full_name:
                            fullName,

                        email:
                            email,

                        username:
                            username,

                        status:
                            "pending"

                    });


            if (requestError) {

                console.error(
                    requestError
                );

                throw requestError;

            }


            showSuccess(
                "Administrator request submitted. The Super Admin must approve your account."
            );


            form.reset();


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            showError(
                error.message ||
                "Registration failed."
            );

        } finally {

            registerButton.disabled =
                false;


            if (
                accountType.value ===
                "student"
            ) {

                registerButton.textContent =
                    "Create Student Account";

            } else {

                registerButton.textContent =
                    "Request Administrator Account";

            }

        }

    }
);


function showError(text) {

    message.textContent =
        text;

    message.className =
        "register-message error";

}


function showSuccess(text) {

    message.textContent =
        text;

    message.className =
        "register-message success";

}
