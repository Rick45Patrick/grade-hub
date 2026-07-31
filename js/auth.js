import { supabase } from "./supabase.js";


const loginForm =
    document.getElementById("loginForm");


const message =
    document.getElementById("message");


const loginButton =
    document.getElementById("loginButton");



loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        message.textContent =
            "Signing in...";


        loginButton.disabled =
            true;


        const {
            data,
            error
        } =
            await supabase.auth.signInWithPassword({

                email: email,

                password: password

            });


        if (error) {

            console.error(error);

            message.textContent =
                error.message;

            loginButton.disabled =
                false;

            return;

        }


        const user =
            data.user;


        console.log(
            "Authenticated user:",
            user.id
        );


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
                    user.id
                );


        if (roleError) {

            console.error(
                "Role error:",
                roleError
            );

            message.textContent =
                "Could not load your account role.";

            await supabase.auth.signOut();

            loginButton.disabled =
                false;

            return;

        }


        console.log(
            "Account roles:",
            roles
        );


        if (
            !roles ||
            roles.length === 0
        ) {

            message.textContent =
                "No account role found.";

            await supabase.auth.signOut();

            loginButton.disabled =
                false;

            return;

        }


        const activeRole =
            roles.find(
                role =>
                    role.approved === true
            );


        if (!activeRole) {

            message.textContent =
                "Your account has not been approved.";

            await supabase.auth.signOut();

            loginButton.disabled =
                false;

            return;

        }


        message.textContent =
            "Login successful. Redirecting...";


        if (
            activeRole.role ===
            "super_admin"
        ) {

            window.location.href =
                "superadmin.html";

        }

        else if (
            activeRole.role ===
            "admin"
        ) {

            window.location.href =
                "admin.html";

        }

        else if (
            activeRole.role ===
            "student"
        ) {

            window.location.href =
                "student.html";

        }

        else {

            message.textContent =
                "Unknown account role.";

            await supabase.auth.signOut();

            loginButton.disabled =
                false;

        }

    }
);
