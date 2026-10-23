
import { supabase } from "./supabase.js";

const form = document.getElementById("createSubjectForm");
const nameInput = document.getElementById("subjectName");
const codeInput = document.getElementById("subjectCode");
const descriptionInput = document.getElementById("subjectDescription");
const button = document.getElementById("createSubjectButton");
const message = document.getElementById("createSubjectMessage");

const subjectsBody = document.getElementById("subjectsTableBody");
const subjectChoices = document.getElementById("combinationSubjectChoices");
const editSubjectChoices = document.getElementById("editCombinationSubjectChoices");

let saving = false;

function showMessage(text, type = "info") {
  if (!message) {
    console[type === "error" ? "error" : "log"](text);
    return;
  }

  message.textContent = text;
  message.style.display = "block";
  message.style.padding = "10px";
  message.style.marginTop = "10px";
  message.style.borderRadius = "6px";
  message.style.background =
    type === "error" ? "#fee2e2" :
    type === "success" ? "#dcfce7" : "#dbeafe";
  message.style.color =
    type === "error" ? "#991b1b" :
    type === "success" ? "#166534" : "#1e40af";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function verifySuperAdmin() {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError) throw userError;

  const user = userData?.user;

  if (!user) {
    throw new Error("Your session has expired. Sign in again.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  if (profile.role !== "super_admin" || !profile.is_active) {
    throw new Error("Only an active Super Admin can manage subjects.");
  }
}

async function refreshCombinationChoices(subjects) {
  const containers = [subjectChoices, editSubjectChoices].filter(Boolean);

  for (const container of containers) {
    const selected = new Set(
      [...container.querySelectorAll('input[type="checkbox"]:checked')]
        .map(input => input.value)
    );

    container.replaceChildren();

    if (!subjects.length) {
      const empty = document.createElement("p");
      empty.textContent = "No active subjects available.";
      container.appendChild(empty);
      continue;
    }

    for (const subject of subjects) {
      if (!subject.is_active) continue;

      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      label.style.margin = "8px 0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "combinationSubjects";
      checkbox.value = subject.id;
      checkbox.checked = selected.has(subject.id);
      checkbox.style.width = "auto";

      const text = document.createElement("span");
      text.textContent = subject.code
        ? `${subject.name} (${subject.code})`
        : subject.name;

      label.append(checkbox, text);
      container.appendChild(label);
    }
  }
}

async function loadSubjects() {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, code, description, is_active, created_at")
    .order("name");

  if (error) throw error;

  const subjects = data ?? [];

  if (subjectsBody) {
    subjectsBody.replaceChildren();

    if (!subjects.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "No subjects have been added yet.";
      row.appendChild(cell);
      subjectsBody.appendChild(row);
    } else {
      for (const subject of subjects) {
        const row = document.createElement("tr");

        const values = [
          subject.code || "—",
          subject.name,
          subject.description || "—",
          subject.is_active ? "Active" : "Inactive"
        ];

        for (const value of values) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        }

        const actionCell = document.createElement("td");
        const toggleButton = document.createElement("button");

        toggleButton.type = "button";
        toggleButton.textContent = subject.is_active ? "Deactivate" : "Activate";
        toggleButton.addEventListener("click", async () => {
          toggleButton.disabled = true;

          try {
            await verifySuperAdmin();

            const { error: updateError } = await supabase
              .from("subjects")
              .update({ is_active: !subject.is_active })
              .eq("id", subject.id);

            if (updateError) throw updateError;

            await loadSubjects();
            showMessage("Subject status updated.", "success");
          } catch (error) {
            showMessage(error.message || "Could not update subject.", "error");
            toggleButton.disabled = false;
          }
        });

        actionCell.appendChild(toggleButton);
        row.appendChild(actionCell);
        subjectsBody.appendChild(row);
      }
    }
  }

  await refreshCombinationChoices(subjects);
  return subjects;
}

async function addSubject(event) {
  event?.preventDefault();

  if (saving) return;

  if (!form || !nameInput || !codeInput || !button) {
    showMessage(
      "Subject form elements are missing. Check the IDs in superadmin.html.",
      "error"
    );
    return;
  }

  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  const description = descriptionInput?.value.trim() || "";

  if (!name) {
    showMessage("Enter a subject name.", "error");
    nameInput.focus();
    return;
  }

  saving = true;
  button.disabled = true;
  button.textContent = "Saving...";
  showMessage("Saving subject...", "info");

  try {
    await verifySuperAdmin();

    const newSubject = {
      name,
      code: code || null,
      description: description || null,
      is_active: true
    };

    const { error } = await supabase
      .from("subjects")
      .insert(newSubject);

    if (error) throw error;

    nameInput.value = "";
    codeInput.value = "";

    if (descriptionInput) descriptionInput.value = "";

    await loadSubjects();

    showMessage(
      `Subject "${name}" was added successfully and the lists were refreshed.`,
      "success"
    );
  } catch (error) {
    console.error("Grade Hub subject creation failed:", error);

    showMessage(
      error.message || "An unexpected error occurred while adding the subject.",
      "error"
    );
  } finally {
    saving = false;
    button.disabled = false;
    button.textContent = "Add Subject";
  }
}

if (!form) {
  console.error(
    "Subject form not found. Expected element ID: createSubjectForm"
  );
} else {
  // Capture handlers before older handlers, preventing duplicate inserts.
  form.addEventListener("submit", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    void addSubject(event);
  }, true);

  if (button) {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      // A submit event will also fire for a submit button. The saving
      // guard prevents duplicate database inserts.
      void addSubject(event);
    }, true);
  }
}

document.getElementById("refreshSubjectsButton")
  ?.addEventListener("click", async event => {
    event.preventDefault();

    try {
      await loadSubjects();
      showMessage("Subjects and combination choices refreshed.", "success");
    } catch (error) {
      showMessage(error.message || "Could not refresh subjects.", "error");
    }
  });

loadSubjects().catch(error => {
  console.error("Initial subject loading failed:", error);
  showMessage(
    `Could not load subjects: ${error.message || "Unknown error"}`,
    "error"
  );
});
