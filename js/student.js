import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
let studentRecord = null;
let allResults = [];
let trendChart = null;
let subjectChart = null;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function setMessage(id, text, type = "success") {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove("success", "error");
  if (text) el.classList.add(type);
}
function showError(context, error) {
  console.error(`[Grade Hub Student] ${context}:`, error);
  return error?.message || "Something went wrong. Please refresh and try again.";
}
function openSection(name, button) {
  document.querySelectorAll(".section").forEach(el => el.classList.remove("active"));
  $(`section-${name}`)?.classList.add("active");
  document.querySelectorAll("[data-section]").forEach(el => el.classList.remove("active"));
  button?.classList.add("active");
  $("pageTitle").textContent = ({
    overview:"Student Dashboard",
    subjects:"My Subjects",
    results:"My Results",
    announcements:"Announcements"
  })[name] || "Grade Hub";
  $("sidebar").classList.remove("open");
}
function initNavigation() {
  document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => openSection(button.dataset.section, button));
  });
  document.querySelectorAll("[data-open-section]").forEach(button => {
    button.addEventListener("click", () => openSection(
      button.dataset.openSection,
      document.querySelector(`[data-section="${button.dataset.openSection}"]`)
    ));
  });
  $("mobileMenuButton").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("signOutButton").addEventListener("click", async () => {
    $("signOutButton").disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage("globalMessage", `Could not sign out: ${error.message}`, "error");
      $("signOutButton").disabled = false;
      return;
    }
    location.href = "../index.html";
  });
  $("examFilter").addEventListener("change", renderResults);
  $("printResultsButton").addEventListener("click", () => window.print());
}
async function getCurrentStudent() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) {
    location.href = "../index.html";
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !profile.is_active || profile.role !== "student") {
    throw new Error("This page is for active student accounts only.");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,profile_id,admission_number,class_id,registration_status")
    .eq("profile_id", authData.user.id)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new Error("Your student record was not found. Please contact the school administrator.");

  studentRecord = student;
  $("welcomeText").textContent = `Welcome, ${profile.full_name || authData.user.email}.`;
  $("studentName").textContent = profile.full_name || "—";
  $("admissionNumber").textContent = student.admission_number || "—";
  $("studentEmail").textContent = authData.user.email || "—";

  if (student.class_id) {
    const { data: schoolClass, error: classError } = await supabase
      .from("classes").select("name").eq("id", student.class_id).maybeSingle();
    if (classError) throw classError;
    $("studentClass").textContent = schoolClass?.name || "—";
  } else {
    $("studentClass").textContent = "Not assigned";
  }
  return authData.user;
}

async function loadSubjects() {
  const subjectIds = new Set();

  const { data: direct, error: directError } = await supabase
    .from("student_subjects")
    .select("subject_id")
    .eq("student_id", studentRecord.id);
  if (directError) throw directError;
  (direct || []).forEach(row => subjectIds.add(row.subject_id));

  const { data: combinationRows, error: combinationError } = await supabase
    .from("student_combinations")
    .select("combination_id")
    .eq("student_id", studentRecord.id)
    .is("ended_at", null);
  if (combinationError) throw combinationError;

  const combinationIds = [...new Set((combinationRows || []).map(row => row.combination_id).filter(Boolean))];
  if (combinationIds.length) {
    const { data: combinationSubjects, error: csError } = await supabase
      .from("combination_subjects")
      .select("subject_id")
      .in("combination_id", combinationIds);
    if (csError) throw csError;
    (combinationSubjects || []).forEach(row => subjectIds.add(row.subject_id));
  }

  if (!subjectIds.size) {
    $("subjectGrid").innerHTML = '<p class="muted">No subjects are assigned yet. Contact your school administrator.</p>';
    $("subjectCount").textContent = "0";
    return [];
  }

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id,name,subject_code,description")
    .in("id", [...subjectIds])
    .eq("is_active", true)
    .order("name");
  if (subjectsError) throw subjectsError;

  $("subjectCount").textContent = String(subjects?.length || 0);
  $("subjectGrid").innerHTML = (subjects || []).map(subject => `
    <article class="subject">
      <strong>${esc(subject.name)}</strong>
      <small>${esc(subject.subject_code || "Subject")}</small>
      ${subject.description ? `<p class="muted">${esc(subject.description)}</p>` : ""}
    </article>`).join("") || '<p class="muted">No active assigned subjects were found.</p>';
  return subjects || [];
}


function numericPercentage(row) {
  const raw = row.percentage ?? (
    Number(row.total_marks) > 0
      ? Number(row.marks) / Number(row.total_marks) * 100
      : null
  );
  const value = Number(raw);
  return raw === null || !Number.isFinite(value) ? null : value;
}

function renderPerformanceCharts() {
  if (typeof Chart === "undefined") {
    setMessage("trendChartMessage", "The graph library could not load. Check your internet connection and reload.", "error");
    setMessage("subjectChartMessage", "The graph library could not load. Check your internet connection and reload.", "error");
    return;
  }

  // Group results by exam and show exams chronologically where dates are available.
  const examGroups = new Map();
  allResults.forEach(row => {
    const percent = numericPercentage(row);
    if (percent === null) return;
    const key = row.exam_id || "unknown";
    if (!examGroups.has(key)) {
      examGroups.set(key, {
        label: row.exam?.name || "Exam",
        date: row.exam?.starts_on || row.exam?.created_at || row.created_at || "",
        scores: []
      });
    }
    examGroups.get(key).scores.push(percent);
  });

  const examPoints = [...examGroups.values()]
    .map(group => ({
      label: group.label,
      date: group.date,
      average: group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length
    }))
    .sort((a, b) => {
      if (a.date && b.date) return new Date(a.date) - new Date(b.date);
      return a.label.localeCompare(b.label);
    });

  if (trendChart) trendChart.destroy();
  const trendCanvas = $("performanceTrendChart");
  if (trendCanvas) {
    trendChart = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: examPoints.map(point => point.label),
        datasets: [{
          label: "Average percentage",
          data: examPoints.map(point => Number(point.average.toFixed(2))),
          tension: 0.25,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Percentage (%)" } },
          x: { title: { display: true, text: "Exam" } }
        },
        plugins: { legend: { display: true } }
      }
    });
  }
  setMessage("trendChartMessage",
    examPoints.length ? "" : "A performance trend will appear when exam results are available.");

  const subjectGroups = new Map();
  allResults.forEach(row => {
    const percent = numericPercentage(row);
    const name = row.subject?.name || "Subject";
    if (percent === null) return;
    if (!subjectGroups.has(name)) subjectGroups.set(name, []);
    subjectGroups.get(name).push(percent);
  });
  const subjectPoints = [...subjectGroups.entries()]
    .map(([name, values]) => ({
      name,
      average: values.reduce((sum, value) => sum + value, 0) / values.length
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (subjectChart) subjectChart.destroy();
  const subjectCanvas = $("subjectPerformanceChart");
  if (subjectCanvas) {
    subjectChart = new Chart(subjectCanvas, {
      type: "bar",
      data: {
        labels: subjectPoints.map(point => point.name),
        datasets: [{
          label: "Average percentage",
          data: subjectPoints.map(point => Number(point.average.toFixed(2)))
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, max: 100, title: { display: true, text: "Percentage (%)" } }
        },
        plugins: { legend: { display: true } }
      }
    });
  }
  setMessage("subjectChartMessage",
    subjectPoints.length ? "" : "Subject comparison will appear when exam results are available.");
}

async function loadResults(subjects) {
  const { data: rows, error } = await supabase
    .from("exam_results")
    .select("id,exam_id,subject_id,marks,total_marks,percentage,remarks,created_at")
    .eq("student_id", studentRecord.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const examIds = [...new Set((rows || []).map(row => row.exam_id).filter(Boolean))];
  const subjectIds = [...new Set((rows || []).map(row => row.subject_id).filter(Boolean))];
  const [examResult, subjectResult] = await Promise.all([
    examIds.length
      ? supabase.from("exams").select("id,name,term,academic_year,starts_on").in("id", examIds)
      : Promise.resolve({ data: [], error: null }),
    subjectIds.length
      ? supabase.from("subjects").select("id,name,subject_code").in("id", subjectIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (examResult.error) throw examResult.error;
  if (subjectResult.error) throw subjectResult.error;

  const exams = new Map((examResult.data || []).map(exam => [exam.id, exam]));
  const subjectMap = new Map((subjectResult.data || []).map(subject => [subject.id, subject]));
  allResults = (rows || []).map(row => ({
    ...row,
    exam: exams.get(row.exam_id),
    subject: subjectMap.get(row.subject_id)
  }));

  const percentages = allResults
    .map(row => Number(row.percentage ?? (Number(row.total_marks) > 0 ? Number(row.marks) / Number(row.total_marks) * 100 : 0)))
    .filter(Number.isFinite);
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : null;

  $("resultCount").textContent = String(allResults.length);
  $("averageScore").textContent = average === null ? "—" : `${average.toFixed(1)}%`;

  const select = $("examFilter");
  const previous = select.value;
  select.innerHTML = '<option value="">All exams</option>';
  const uniqueExams = new Map();
  allResults.forEach(row => {
    if (row.exam) uniqueExams.set(row.exam.id, row.exam.name);
  });
  [...uniqueExams.entries()].forEach(([id, name]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    select.append(option);
  });
  if (uniqueExams.has(previous)) select.value = previous;

  renderResults();
  renderPerformanceCharts();
  const recent = allResults.slice(0, 5);
  $("recentResultsBody").innerHTML = recent.length ? recent.map(row => `
    <tr>
      <td>${esc(row.exam?.name || "Exam")}</td>
      <td>${esc(row.subject?.name || "Subject")}</td>
      <td>${esc(row.marks ?? "—")}</td>
      <td>${formatPercent(row)}</td>
    </tr>`).join("") : '<tr><td colspan="4">No results have been published to your account yet.</td></tr>';
}
function formatPercent(row) {
  const value = row.percentage ?? (Number(row.total_marks) > 0 ? Number(row.marks) / Number(row.total_marks) * 100 : null);
  return value === null || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(1)}%`;
}
function gradeLabel(row) {
  // Show a percentage until Grade Hub's grading bands are loaded for the result.
  return formatPercent(row);
}
function renderResults() {
  const filter = $("examFilter").value;
  const rows = allResults.filter(row => !filter || row.exam_id === filter);
  $("allResultsBody").innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${esc(row.exam?.name || "Exam")}${row.exam?.term ? `<br><small>${esc(row.exam.term)} ${esc(row.exam.academic_year || "")}</small>` : ""}</td>
      <td>${esc(row.subject?.name || "Subject")}</td>
      <td>${esc(row.marks ?? "—")}</td>
      <td>${esc(row.total_marks ?? 100)}</td>
      <td><span class="badge">${esc(formatPercent(row))}</span></td>
      <td>${esc(gradeLabel(row))}</td>
    </tr>`).join("") : '<tr><td colspan="6">No results found for this filter.</td></tr>';
}
async function loadAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,content,published_at,created_at,audience")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw error;

  const visible = (data || []).filter(item => {
    const audience = String(item.audience || "all").toLowerCase();
    return ["all", "students", "student", "everyone", "school"].includes(audience);
  });
  const html = visible.length ? visible.map(item => `
    <article class="announcement">
      <h4>${esc(item.title)}</h4>
      <p>${esc(item.content)}</p>
      <small class="muted">${esc(item.published_at ? new Date(item.published_at).toLocaleString() : "")}</small>
    </article>`).join("") : '<p class="muted">There are no published announcements for students right now.</p>';
  $("allAnnouncements").innerHTML = html;
  $("recentAnnouncements").innerHTML = visible.slice(0, 3).map(item => `
    <article class="announcement"><h4>${esc(item.title)}</h4><p>${esc(item.content)}</p></article>
  `).join("") || '<p class="muted">No announcements yet.</p>';
}
async function initialize() {
  initNavigation();
  try {
    await getCurrentStudent();
    await Promise.all([loadSubjects(), loadAnnouncements(), loadResults()]);
  } catch (error) {
    setMessage("globalMessage", showError("Loading dashboard", error), "error");
  }
}
initialize();
