import { supabase } from "./supabase.js";

const adminName = document.getElementById("adminName");
const adminAvatar = document.getElementById("adminAvatar");
const dashboardMessage = document.getElementById("dashboardMessage");
const logoutButton = document.getElementById("logoutButton");

function showMessage(message, isError = false) {
    if (!dashboardMessage) return;

    dashboardMessage.textContent = message;
    dashboardMessage.classList.toggle("error", isError);
}

async function protectDashboard() {
    showMessage("Verifying your account...");

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            window.location.replace("../index.html");
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("full_name, role, is_active")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            console.error("Profile lookup failed:", profileError);
            showMessage(
                "Your profile could not be verified. Contact the system administrator.",
                true
            );
            await supabase.auth.signOut();
            window.location.replace("../index.html");
            return;
        }

        if (profile.is_active !== true) {
            await supabase.auth.signOut();
            window.location.replace("../index.html");
            return;
        }

        if (profile.role !== "super_admin") {
            const dashboards = {
                admin: "admin.html",
                class_teacher: "teacher.html",
                student: "student.html"
            };

            const destination = dashboards[profile.role];

            if (destination) {
                window.location.replace(destination);
            } else {
                await supabase.auth.signOut();
                window.location.replace("../index.html");
            }

            return;
        }

        const name = profile.full_name || user.email || "Super Admin";

        adminName.textContent = name;
        adminAvatar.textContent = name.trim().charAt(0).toUpperCase();

        showMessage(
            "Account verified. The dashboard interface is ready."
        );

    } catch (error) {
        console.error("Dashboard verification error:", error);
        showMessage(
            "Unable to verify your account. Check your connection and try again.",
            true
        );
    }
}

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace("../index.html");
    } catch (error) {
        console.error("Sign-out failed:", error);

        showMessage(
            "Sign-out failed. Please try again.",
            true
        );

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";
    }
});

// Mobile sidebar controls
const sidebar = document.getElementById("sidebar");
const mobileMenu = document.getElementById("mobileMenu");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("visible");
}

mobileMenu.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarBackdrop.classList.toggle("visible");
});

sidebarBackdrop.addEventListener("click", closeSidebar);

document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((item) => {
            item.classList.remove("active");
        });

        link.classList.add("active");
        closeSidebar();
    });
});

// These buttons are intentionally placeholders.
// We will connect each one to its feature as we build it.
document.querySelectorAll("[data-feature]").forEach((button) => {
    button.addEventListener("click", () => {
        const feature = button.dataset.feature;

        showMessage(
            `${feature} is not connected yet. We will implement it next.`
        );
    });
});

protectDashboard();
