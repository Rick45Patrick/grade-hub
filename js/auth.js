import { supabase } from "./supabase.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function showMessage(message, type = "error") {
    const messageElement = document.getElementById("message");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = type;
}

function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : originalText;
}

// =====================================================
// ROLE-BASED REDIRECT
// =====================================================

async function redirectUser() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("Unable to verify your account. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        throw new Error(
            "Your profile could not be found. Contact the administrator."
        );
    }

    if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error("Your account is inactive. Contact the administrator.");
    }

    const dashboards = {
        super_admin: "dashboards/superadmin.html",
        admin: "dashboards/admin.html",
        class_teacher: "dashboards/teacher.html",
        student: "dashboards/student.html"
    };

    const destination = dashboards[profile.role];

    if (!destination) {
        throw new Error("Your account has no valid dashboard role.");
    }

    window.location.replace(destination);
}

// =====================================================
// LOGIN
// =====================================================

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = document.getElementById("loginButton");

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        setLoading(button, true, "Sign In");

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            showMessage("Login successful. Opening your dashboard...", "success");

            await redirectUser();

        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading(button, false, "Sign In");
        }
    });
}

// =====================================================
// REGISTRATION
// =====================================================

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = document.getElementById("registerButton");

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!fullName) {
            showMessage("Please enter your full name.");
            return;
        }

        if (password.length < 8) {
            showMessage("Your password must contain at least 8 characters.");
            return;
        }

        setLoading(button, true, "Create Account");

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            if (data.session) {
                showMessage(
                    "Account created. You can now sign in.",
                    "success"
                );
            } else {
                showMessage(
                    "Registration received. Check your email to confirm your account.",
                    "success"
                );
            }

            registerForm.reset();

        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading(button, false, "Create Account");
        }
    });
}
