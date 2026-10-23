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
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : originalText;
}

// LOGIN
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = document.getElementById("loginButton");
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        setLoading(button, true, "Sign In");

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            const user = data.user;

            showMessage("Login successful. Redirecting...", "success");

            // This is a temporary destination.
            // We'll replace it with role-based routing later.
            window.location.href = "dashboard.html";

        } catch (error) {
            showMessage(error.message);
        } finally {
            setLoading(button, false, "Sign In");
        }
    });
}

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
                    "Account created successfully. You can now sign in.",
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
