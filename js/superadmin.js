import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupEvents();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage("Could not read your session: " + error.message, "error");
    return;
  }

  if (!data.session) {
    location.href = "index.html";
    return;
  }

  const allowed = await checkSuperAdmin(data.session.user.id);
  if (!allowed) return;

  await refreshAll();
}

async function checkSuperAdmin(userId) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, approved")
    .eq("user_id", userId);

  if (error) {
    console.error("Role check:", error);
    showMessage("Could not verify your account role: " + error.message, "error");
    return false;
  }

  const ok = (data || []).some(
    row => row.role === "super_admin" && row.approved === true
  );

  if (!ok) {
    showMessage("This account does not have Super Admin access.", "error");
    return false;
  }

  return true;
}

function setupEvents() {
  $("logoutButton")?.addEventListener("click", logout);
  $("refreshDashboard")?.addEventListener("click", refreshAll);
}

async function logout() {
  const button = $("logoutButton");
  if (button) button.disabled = true;

  const { error } = await supabase.auth.signOut();

  if (error) {
    if (button) button.disabled = false;
    showMessage("Sign out failed: " + error.message, "error");
    return;
  }

  location.replace("index.html");
}

async function refreshAll() {
  await Promise.all([
    loadRequests(),
    loadAdmins(),
    loadStudents(),
    loadStats()
  ]);
}

async function loadRequests() {
  const body = $("adminRequests");
  if (!body) return;

  body.innerHTML = `<tr><td colspan="6" class="sa-empty">Loading...</td></tr>`;

  const { data, error } = await supabase
    .from("admin_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("admin_requests:", error);
    body.innerHTML = `<tr><td colspan="6" class="sa-empty">Unable to load requests: ${esc(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    body.innerHTML = `<tr><td colspan="6" class="sa-empty">No pending administrator requests.</td></tr>`;
    return;
  }

  body.innerHTML = data.map(r => `
    <tr>
      <td>${esc(r.full_name)}</td>
      <td>${esc(r.username)}</td>
      <td>${esc(r.email)}</td>
      <td>${date(r.created_at)}</td>
      <td><span class="sa-status pending">Pending</span></td>
      <td>
        <button class="sa-btn approve" data-approve="${escAttr(r.id)}">Approve</button>
        <button class="sa-btn reject" data-reject="${escAttr(r.id)}">Reject</button>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => approve(btn.dataset.approve, btn));
  });

  body.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => reject(btn.dataset.reject, btn));
  });
}

async function approve(requestId, button) {
  if (!confirm("Approve this administrator request?")) return;

  button.disabled = true;
  button.textContent = "Approving...";

  const { data, error } = await supabase.rpc("approve_admin_request", {
    request_id: requestId
  });

  console.log("approve_admin_request response:", { data, error });

  if (error) {
    button.disabled = false;
    button.textContent = "Approve";
    showMessage(`Approval failed (${error.code || "RPC"}): ${error.message}`, "error");
    return;
  }

  showMessage(data || "Administrator approved successfully.", "success");
  await refreshAll();
}

async function reject(requestId, button) {
  if (!confirm("Reject this administrator request?")) return;

  button.disabled = true;
  button.textContent = "Rejecting...";

  const { data, error } = await supabase.rpc("reject_admin_request", {
    request_id: requestId
  });

  console.log("reject_admin_request response:", { data, error });

  if (error) {
    button.disabled = false;
    button.textContent = "Reject";
    showMessage(`Rejection failed (${error.code || "RPC"}): ${error.message}`, "error");
    return;
  }

  showMessage(data || "Request rejected.", "success");
  await refreshAll();
}

async function loadAdmins() {
  const body = $("approvedAdmins");
  if (!body) return;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id, role, approved")
    .eq("role", "admin")
    .eq("approved", true);

  if (error) {
    console.error("user_roles:", error);
    body.innerHTML = `<tr><td colspan="4" class="sa-empty">${esc(error.message)}</td></tr>`;
    return;
  }

  if (!roles?.length) {
    body.innerHTML = `<tr><td colspan="4" class="sa-empty">No approved administrators.</td></tr>`;
    return;
  }

  const ids = roles.map(x => x.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, username, email")
    .in("id", ids);

  if (profileError) {
    console.error("profiles:", profileError);
    body.innerHTML = `<tr><td colspan="4" class="sa-empty">${esc(profileError.message)}</td></tr>`;
    return;
  }

  const map = new Map((profiles || []).map(p => [p.id, p]));

  body.innerHTML = roles.map(r => {
    const p = map.get(r.user_id) || {};
    return `
      <tr>
        <td>${esc(p.full_name)}</td>
        <td>${esc(p.username)}</td>
        <td>${esc(p.email)}</td>
        <td><span class="sa-status approved">Approved</span></td>
      </tr>
    `;
  }).join("");
}

async function loadStudents() {
  const body = $("studentTable");
  if (!body) return;

  body.innerHTML = `<tr><td colspan="5" class="sa-empty">Loading...</td></tr>`;

  const { data: students, error } = await supabase
    .from("students")
    .select("*")
    .order("admission_number", { ascending: true });

  if (error) {
    console.error("students:", error);
    body.innerHTML = `<tr><td colspan="5" class="sa-empty">Unable to load students: ${esc(error.message)}</td></tr>`;
    return;
  }

  if (!students?.length) {
    body.innerHTML = `<tr><td colspan="5" class="sa-empty">No students registered.</td></tr>`;
    return;
  }

  const ids = students.map(s => s.user_id).filter(Boolean);
  let profiles = [];

  if (ids.length) {
    const result = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ids);

    if (result.error) {
      console.error("student profiles:", result.error);
    } else {
      profiles = result.data || [];
    }
  }

  const map = new Map(profiles.map(p => [p.id, p]));

  body.innerHTML = students.map(s => {
    const p = map.get(s.user_id) || {};
    const subjects = Array.isArray(s.optional_subjects)
      ? s.optional_subjects.join(", ")
      : (s.optional_subjects || "—");

    return `
      <tr>
        <td>${esc(s.admission_number)}</td>
        <td>${esc(p.full_name)}</td>
        <td>${esc(s.class)}</td>
        <td>${esc(subjects)}</td>
        <td>${esc(p.username)}</td>
      </tr>
    `;
  }).join("");
}

async function loadStats() {
  const [students, admins, pending] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin").eq("approved", true),
    supabase.from("admin_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
  ]);

  $("totalStudents").textContent = students.count ?? 0;
  $("totalAdmins").textContent = admins.count ?? 0;
  $("pendingAdmins").textContent = pending.count ?? 0;

  if (students.error) console.error("student count:", students.error);
  if (admins.error) console.error("admin count:", admins.error);
  if (pending.error) console.error("pending count:", pending.error);
}

function showMessage(text, type = "success") {
  const box = $("saMessage");
  if (!box) return;

  box.textContent = text;
  box.className = `sa-message show ${type}`;

  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    box.className = "sa-message";
    box.textContent = "";
  }, 7000);
}

function date(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function esc(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[c]));
}

function escAttr(value) {
  return esc(value);
}
