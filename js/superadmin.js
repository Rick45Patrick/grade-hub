import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const dashboardMessage = $("dashboardMessage");
const staffMessage = $("staffMessage");
const staffTableBody = $("staffTableBody");

let currentUser = null;

function setMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) {
        element.classList.add(type);
    }
}

function makeCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    return cell;
}

function makeButton(text, className, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", handler);

    return button;
}

async function getCurrentProfile() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.replace("../index.html");
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !profile || profile.is_active !== true) {
        console.error("Profile verification failed:", profileError);

        await supabase.auth.signOut();
        window.location.replace("../index.html");

        return null;
    }

    if (profile.role !== "super_admin") {
        const destinations = {
            admin: "admin.html",
            class_teacher: "teacher.html",
            student: "student.html"
        };

        const destination = destinations[profile.role];

        if (destination) {
            window.location.replace(destination);
        } else {
            await supabase.auth.signOut();
            window.location.replace("../index.html");
        }

        return null;
    }

    currentUser = user;

    const name = profile.full_name || user.email || "Super Admin";

    $("adminName").textContent = name;
    $("adminAvatar").textContent = name.trim().charAt(0).toUpperCase();

    return profile;
}

async function loadOverview() {
    setMessage(dashboardMessage, "Loading dashboard statistics...");

    try {
        const [
            studentsResult,
            adminsResult,
            teachersResult,
            classesResult
        ] = await Promise.all([
            supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "student"),

            supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "admin")
                .eq("is_active", true),

            supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "class_teacher")
                .eq("is_active", true),

            supabase
                .from("classes")
                .select("id", { count: "exact", head: true })
        ]);

        const results = [
            studentsResult,
            adminsResult,
            teachersResult,
            classesResult
        ];

        const failed = results.find((result) => result.error);

        if (failed) {
            throw failed.error;
        }

        $("totalStudents").textContent = studentsResult.count ?? 0;
        $("totalAdmins").textContent = adminsResult.count ?? 0;
        $("totalTeachers").textContent = teachersResult.count ?? 0;
        $("totalClasses").textContent = classesResult.count ?? 0;

        setMessage(dashboardMessage, "Dashboard statistics updated.", "success");

    } catch (error) {
        console.error("Overview loading failed:", error);

        setMessage(
            dashboardMessage,
            "Could not load some statistics. Check the database permissions.",
            "error"
        );
    }
}

function buildStaffRow(member) {
    const row = document.createElement("tr");

    row.appendChild(makeCell(member.full_name || "Unnamed staff member"));

    const roleCell = document.createElement("td");
    const roleSelect = document.createElement("select");

    roleSelect.setAttribute("aria-label", "Staff role");

    const roles = [
        ["admin", "Administrator"],
        ["class_teacher", "Class Teacher"]
    ];

    for (const [value, label] of roles) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        roleSelect.appendChild(option);
    }

    roleSelect.value = member.role;
    roleCell.appendChild(roleSelect);
    row.appendChild(roleCell);

    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");

    statusSelect.setAttribute("aria-label", "Account status");

    const statuses = [
        ["true", "Active"],
        ["false", "Inactive"]
    ];

    for (const [value, label] of statuses) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        statusSelect.appendChild(option);
    }

    statusSelect.value = String(member.is_active === true);
    statusCell.appendChild(statusSelect);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");

    const saveButton = makeButton(
        "Save",
        "button button-small",
        async () => {
            const requestedRole = roleSelect.value;
            const requestedStatus = statusSelect.value === "true";

            const roleChanged = requestedRole !== member.role;
            const statusChanged = requestedStatus !== member.is_active;

            if (!roleChanged && !statusChanged) {
                setMessage(staffMessage, "There are no changes to save.");
                return;
            }

            const confirmed = window.confirm(
                `Apply changes to ${member.full_name || "this staff member"}?`
            );

            if (!confirmed) return;

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";

            try {
                const { error } = await supabase.rpc(
                    "manage_staff_account",
                    {
                        target_user_id: member.id,
                        new_role: requestedRole,
                        new_is_active: requestedStatus
                    }
                );

                if (error) throw error;

                setMessage(staffMessage, "Staff account updated successfully.", "success");

                await Promise.all([
                    loadStaff(),
                    loadOverview()
                ]);

            } catch (error) {
                console.error("Staff update failed:", error);

                setMessage(
                    staffMessage,
                    error.message || "Unable to update the staff account.",
                    "error"
                );

                saveButton.disabled = false;
                saveButton.textContent = "Save";
            }
        }
    );

    actionCell.appendChild(saveButton);
    row.appendChild(actionCell);

    return row;
}

async function loadStaff() {
    if (!staffTableBody) return;

    $("refreshStaffButton").disabled = true;
    setMessage(staffMessage, "Loading staff accounts...");

    staffTableBody.replaceChildren();

    try {
        const { data: staff, error } = await supabase
            .from("profiles")
            .select("id, full_name, role, is_active")
            .in("role", ["admin", "class_teacher"])
            .order("full_name", { ascending: true });

        if (error) throw error;

        if (!staff || staff.length === 0) {
            const row = document.createElement("tr");
            const cell = makeCell(
                "No administrator or class-teacher profiles found."
            );

            cell.colSpan = 4;
            cell.className = "empty-state";
            row.appendChild(cell);
            staffTableBody.appendChild(row);

            setMessage(
                staffMessage,
                "No staff accounts found. Staff creation will be added separately."
            );

            return;
        }

        for (const member of staff) {
            staffTableBody.appendChild(buildStaffRow(member));
        }

        setMessage(
            staffMessage,
            `Loaded ${staff.length} staff account(s).`,
            "success"
        );

    } catch (error) {
        console.error("Staff loading failed:", error);

        const row = document.createElement("tr");
        const cell = makeCell(
            "Staff records could not be loaded. Check RLS policies and database permissions."
        );

        cell.colSpan = 4;
        cell.className = "empty-state";
        row.appendChild(cell);
        staffTableBody.appendChild(row);

        setMessage(
            staffMessage,
            error.message || "Unable to load staff accounts.",
            "error"
        );
    } finally {
        $("refreshStaffButton").disabled = false;
    }
}

async function signOut() {
    const button = $("logoutButton");

    button.disabled = true;
    button.textContent = "Signing out...";

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("../index.html");

    } catch (error) {
        console.error("Sign-out failed:", error);

        setMessage(dashboardMessage, "Sign-out failed. Please try again.", "error");

        button.disabled = false;
        button.textContent = "Sign out";
    }
}

function setupNavigation() {
    const sidebar = $("sidebar");
    const mobileMenu = $("mobileMenu");
    const backdrop = $("sidebarBackdrop");

    function closeSidebar() {
        sidebar.classList.remove("open");
        backdrop.classList.remove("visible");
    }

    mobileMenu.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        backdrop.classList.toggle("visible");
    });

    backdrop.addEventListener("click", closeSidebar);

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });

            link.classList.add("active");
            closeSidebar();
        });
    });

    document.querySelectorAll("[data-feature]").forEach((button) => {
        button.addEventListener("click", () => {
            const feature = button.dataset.feature;

            setMessage(
                dashboardMessage,
                `${feature} has not been connected yet.`
            );

            $("overview").scrollIntoView({ behavior: "smooth" });
        });
    });
}

async function initializeDashboard() {
    setupNavigation();

    $("logoutButton").addEventListener("click", signOut);
    $("refreshStaffButton").addEventListener("click", loadStaff);
    $("refreshOverview").addEventListener("click", loadOverview);

    const profile = await getCurrentProfile();

    if (!profile) return;

    await Promise.all([
        loadOverview(),
        loadStaff()
    ]);
}

initializeDashboard();
