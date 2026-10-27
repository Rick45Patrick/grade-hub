import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
let currentUser = null, missingStudents = [], savingMarks = false, savingAnnouncement = false;

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function msg(id, text, type = "success") { const e = $(id); if (!e) return; e.textContent = text; e.classList.remove("success","error"); e.classList.add(type); }
function busy(button, on, text = "Please wait...") { if (!button) return; if (on) { button.dataset.oldText ??= button.textContent; button.disabled = true; button.textContent = text; } else { button.disabled = false; if (button.dataset.oldText) button.textContent = button.dataset.oldText; } }
function errText(context, error) { console.error(`[Grade Hub] ${context}:`, error); return error?.message || "An unexpected error occurred."; }

async function authorize() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Your session has expired. Sign in again.");
  const { data: profile, error } = await supabase.from("profiles").select("id,full_name,role,is_active").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  if (!profile || !profile.is_active || !["admin","super_admin"].includes(profile.role)) throw new Error("Access denied. An active Admin or Super Admin account is required.");
  currentUser = auth.user;
  $("welcomeText").textContent = `Signed in as ${profile.full_name || auth.user.email} (${profile.role.replace("_"," ")}).`;
  if (profile.role === "super_admin") $("superAdminLink").style.display = "block";
}

function openSection(name, button) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  $(`section-${name}`)?.classList.add("active");
  document.querySelectorAll("[data-section]").forEach(b => b.classList.remove("active"));
  button?.classList.add("active");
  $("pageTitle").textContent = ({overview:"Overview",students:"Register Student",marks:"Enter Marks",announcements:"Announcements"})[name] || "Grade Hub";
  $("sidebar").classList.remove("open");
}
function initNavigation() {
  document.querySelectorAll("[data-section]").forEach(b => b.addEventListener("click", () => openSection(b.dataset.section,b)));
  document.querySelectorAll("[data-open-section]").forEach(b => b.addEventListener("click", () => openSection(b.dataset.openSection,document.querySelector(`[data-section="${b.dataset.openSection}"]`))));
  $("mobileMenuButton").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("signOutButton").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return msg("globalMessage", `Could not sign out: ${error.message}`, "error");
    location.href = "../index.html";
  });
}

async function count(table) {
  const { count, error } = await supabase.from(table).select("*",{count:"exact",head:true});
  if (error) throw error;
  return count ?? 0;
}
async function loadOverview() {
  for (const [id,table] of [["totalStudents","students"],["totalExams","exams"],["totalSubjects","subjects"]]) {
    try { $(id).textContent = String(await count(table)); }
    catch (e) { $(id).textContent = "—"; console.error(`Could not count ${table}`,e); }
  }
}

async function loadChoices() {
  $("examSelect").innerHTML = '<option value="">Choose an exam</option>';
  $("subjectSelect").innerHTML = '<option value="">Choose a subject</option>';
  const [er,sr] = await Promise.all([
    supabase.from("exams").select("id,name,academic_year,term,class_id").order("created_at",{ascending:false}),
    supabase.from("subjects").select("id,name,subject_code,is_active").eq("is_active",true).order("name")
  ]);
  if (er.error) throw er.error;
  if (sr.error) throw sr.error;
  (er.data || []).forEach(exam => {
    const o = document.createElement("option");
    o.value = exam.id; o.dataset.classId = exam.class_id || "";
    o.textContent = `${exam.name} (${exam.academic_year}${exam.term ? ", " + exam.term : ""})`;
    $("examSelect").append(o);
  });
  (sr.data || []).forEach(subject => {
    const o = document.createElement("option");
    o.value = subject.id; o.textContent = `${subject.name}${subject.subject_code ? " ("+subject.subject_code+")" : ""}`;
    $("subjectSelect").append(o);
  });
  if (!er.data?.length) msg("marksMessage","No exams are available. Ask a Super Admin to create one.","error");
  else msg("marksMessage","");
}

async function loadMissing(event) {
  event?.preventDefault(); msg("marksMessage",""); msg("saveMarksMessage","");
  const examId = $("examSelect").value, subjectId = $("subjectSelect").value;
  const maxMarks = Number($("totalMarksInput").value);
  const classId = $("examSelect").selectedOptions[0]?.dataset.classId || "";
  if (!examId || !subjectId) return msg("marksMessage","Choose both an exam and a subject.","error");
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) return msg("marksMessage","Maximum marks must be greater than zero.","error");

  busy($("loadMissingButton"),true,"Loading students...");
  $("missingMarksPanel").hidden = false;
  $("missingMarksTableBody").innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    let query = supabase.from("students").select("id,admission_number,profile_id,class_id").order("admission_number");
    if (classId) query = query.eq("class_id",classId);
    const { data: students, error: se } = await query;
    if (se) throw se;
    if (!students?.length) { missingStudents = []; renderMissing(); return msg("marksMessage","No students were found for this exam/class.","error"); }

    const ids = students.map(s => s.id);
    const { data: results, error: re } = await supabase.from("exam_results").select("student_id").eq("exam_id",examId).eq("subject_id",subjectId).in("student_id",ids);
    if (re) throw re;
    const hasResult = new Set((results || []).map(r => r.student_id));
    const missing = students.filter(s => !hasResult.has(s.id));
    const profileIds = [...new Set(missing.map(s => s.profile_id).filter(Boolean))];
    let names = new Map();
    if (profileIds.length) {
      const { data, error } = await supabase.from("profiles").select("id,full_name").in("id",profileIds);
      if (error) throw error;
      names = new Map((data || []).map(p => [p.id,p.full_name]));
    }
    missingStudents = missing.map(s => ({...s,full_name:names.get(s.profile_id) || "Name unavailable"}));
    renderMissing();
    $("missingMarksHint").textContent = `${missingStudents.length} student(s) need marks. Maximum marks: ${maxMarks}.`;
    msg("marksMessage",missingStudents.length ? `Found ${missingStudents.length} student(s) without marks.` : "All students already have marks for this exam and subject.");
  } catch (error) {
    missingStudents = []; renderMissing(); msg("marksMessage",errText("Loading students missing marks",error),"error");
  } finally { busy($("loadMissingButton"),false); }
}

function renderMissing() {
  const maxMarks = Number($("totalMarksInput").value);
  $("saveMarksButton").hidden = !missingStudents.length;
  if (!missingStudents.length) {
    $("missingMarksTableBody").innerHTML = '<tr><td colspan="4" style="text-align:center">No students are missing marks for this selection.</td></tr>';
    return;
  }
  $("missingMarksTableBody").innerHTML = missingStudents.map(s => `<tr>
    <td>${esc(s.admission_number || "—")}</td><td>${esc(s.full_name)}</td>
    <td><input aria-label="Marks for ${esc(s.full_name)}" data-student-marks="${esc(s.id)}" type="number" min="0" max="${esc(maxMarks)}" step="any" required></td>
    <td>${esc(maxMarks)}</td></tr>`).join("");
}

async function saveMarks(event) {
  event.preventDefault(); if (savingMarks) return;
  const examId = $("examSelect").value, subjectId = $("subjectSelect").value, totalMarks = Number($("totalMarksInput").value);
  if (!missingStudents.length) return msg("saveMarksMessage","There are no missing marks to save.","error");
  const rows = [];
  for (const student of missingStudents) {
    const input = document.querySelector(`[data-student-marks="${CSS.escape(student.id)}"]`);
    const marks = Number(input?.value);
    if (!input || input.value.trim() === "" || !Number.isFinite(marks) || marks < 0 || marks > totalMarks) {
      msg("saveMarksMessage",`Enter a valid mark from 0 to ${totalMarks} for every listed student.`,"error"); input?.focus(); return;
    }
    rows.push({exam_id:examId,student_id:student.id,subject_id:subjectId,marks,total_marks:totalMarks,entered_by:currentUser.id});
  }
  savingMarks = true; busy($("saveMarksButton"),true,"Saving marks...");
  try {
    // percentage is database-generated, so it is intentionally not included.
    const { error } = await supabase.from("exam_results").insert(rows);
    if (error) throw error;
    msg("saveMarksMessage",`Saved marks for ${rows.length} student(s).`);
    await loadMissing();
  } catch (error) { msg("saveMarksMessage",errText("Saving marks",error),"error"); }
  finally { savingMarks = false; busy($("saveMarksButton"),false); }
}

async function saveAnnouncement(event) {
  event.preventDefault(); if (savingAnnouncement) return;
  const title = $("announcementTitle").value.trim(), content = $("announcementContent").value.trim();
  const isPublished = $("announcementPublish").checked;
  if (!title || !content) return msg("announcementMessage","Enter both a title and message.","error");
  savingAnnouncement = true; busy($("createAnnouncementButton"),true,"Saving...");
  try {
    const { error } = await supabase.from("announcements").insert({
      title,content,audience:$("announcementAudience").value,is_published:isPublished,
      published_at:isPublished ? new Date().toISOString() : null,created_by:currentUser.id
    });
    if (error) throw error;
    $("announcementForm").reset(); $("announcementPublish").checked = true;
    msg("announcementMessage","Announcement saved successfully.");
  } catch (error) { msg("announcementMessage",errText("Saving announcement",error),"error"); }
  finally { savingAnnouncement = false; busy($("createAnnouncementButton"),false); }
}


let registeringStudent = false;

async function loadStudentChoices() {
  const classSelect = $("studentClassSelect");
  const comboSelect = $("studentCombinationSelect");
  classSelect.innerHTML = '<option value="">Choose a class</option>';
  comboSelect.innerHTML = '<option value="">No combination / not applicable</option>';

  const [classesResult, combosResult] = await Promise.all([
    supabase.from("classes").select("id,name,grade_level,academic_year").eq("is_active", true).order("name"),
    supabase.from("subject_combinations").select("id,name,description").eq("is_active", true).order("name")
  ]);
  if (classesResult.error) throw classesResult.error;
  if (combosResult.error) throw combosResult.error;

  (classesResult.data || []).forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name}${item.grade_level ? " — " + item.grade_level : ""}${item.academic_year ? " (" + item.academic_year + ")" : ""}`;
    classSelect.append(option);
  });
  (combosResult.data || []).forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    comboSelect.append(option);
  });
  if (!classesResult.data?.length) msg("studentRegistrationMessage", "No active classes found. Ask a Super Admin to set up classes first.", "error");
  else msg("studentRegistrationMessage", "");
}

async function loadRecentStudents() {
  const body = $("recentStudentsBody");
  if (!body) return;
  body.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const { data: students, error } = await supabase
      .from("students")
      .select("id,profile_id,admission_number,class_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!students?.length) {
      body.innerHTML = '<tr><td colspan="4">No students registered yet.</td></tr>';
      return;
    }
    const profileIds = [...new Set(students.map(s => s.profile_id).filter(Boolean))];
    const classIds = [...new Set(students.map(s => s.class_id).filter(Boolean))];
    const [profilesResult, classesResult, assignmentsResult] = await Promise.all([
      profileIds.length ? supabase.from("profiles").select("id,full_name").in("id", profileIds) : Promise.resolve({data:[],error:null}),
      classIds.length ? supabase.from("classes").select("id,name").in("id", classIds) : Promise.resolve({data:[],error:null}),
      supabase.from("student_combinations").select("student_id,combination_id").is("ended_at", null).in("student_id", students.map(s => s.id))
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (classesResult.error) throw classesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    const profileMap = new Map((profilesResult.data || []).map(p => [p.id,p.full_name]));
    const classMap = new Map((classesResult.data || []).map(c => [c.id,c.name]));
    const comboIds = [...new Set((assignmentsResult.data || []).map(a => a.combination_id).filter(Boolean))];
    const comboResult = comboIds.length ? await supabase.from("subject_combinations").select("id,name").in("id", comboIds) : {data:[],error:null};
    if (comboResult.error) throw comboResult.error;
    const comboMap = new Map((comboResult.data || []).map(c => [c.id,c.name]));
    const comboByStudent = new Map((assignmentsResult.data || []).map(a => [a.student_id,comboMap.get(a.combination_id) || "—"]));
    body.innerHTML = students.map(s => `<tr><td>${esc(s.admission_number || "—")}</td><td>${esc(profileMap.get(s.profile_id) || "Name unavailable")}</td><td>${esc(classMap.get(s.class_id) || "—")}</td><td>${esc(comboByStudent.get(s.id) || "—")}</td></tr>`).join("");
  } catch (error) {
    body.innerHTML = '<tr><td colspan="4">Could not load recent students.</td></tr>';
    msg("recentStudentsMessage", errText("Loading recent students", error), "error");
  }
}

async function registerStudent(event) {
  event.preventDefault();
  if (registeringStudent) return;
  const fullName = $("studentFullName").value.trim();
  const admissionNumber = $("studentAdmissionNumber").value.trim();
  const email = $("studentEmail").value.trim();
  const password = $("studentTemporaryPassword").value;
  const classId = $("studentClassSelect").value;
  const combinationId = $("studentCombinationSelect").value || null;
  if (!fullName || !email || !password || !classId) {
    return msg("studentRegistrationMessage", "Enter the student's name, email, temporary password, and class.", "error");
  }
  if (password.length < 8) return msg("studentRegistrationMessage", "The temporary password must be at least 8 characters.", "error");
  registeringStudent = true;
  busy($("registerStudentButton"), true, "Registering...");
  try {
    // Auth user creation is handled server-side by an Edge Function. Never place the service-role key in browser JS.
    const { data, error } = await supabase.functions.invoke("register-student", {
      body: {
        full_name: fullName,
        admission_number: admissionNumber || null,
        email,
        temporary_password: password,
        date_of_birth: $("studentDateOfBirth").value || null,
        guardian_name: $("studentGuardianName").value.trim() || null,
        guardian_contact: $("studentGuardianContact").value.trim() || null,
        class_id: classId,
        combination_id: combinationId
      }
    });
    if (error) {
      let detail = error.message || "Could not register student.";
      try { const body = await error.context?.json?.(); if (body?.error) detail = body.error; } catch (_) {}
      throw new Error(detail);
    }
    $("studentRegistrationForm").reset();
    await loadStudentChoices();
    await Promise.allSettled([loadRecentStudents(), loadOverview()]);
    msg("studentRegistrationMessage", `Student registered successfully${data?.email ? ` (${data.email})` : ""}. Provide the temporary login details securely.`);
  } catch (error) {
    msg("studentRegistrationMessage", errText("Registering student", error), "error");
  } finally {
    registeringStudent = false;
    busy($("registerStudentButton"), false);
  }
}

async function initialize() {
  initNavigation();
  try {
    await authorize();
    await Promise.allSettled([loadOverview(),loadChoices(),loadStudentChoices(),loadRecentStudents()]);
    $("refreshExamChoicesButton").addEventListener("click",async()=>{try{await loadChoices();}catch(e){msg("marksMessage",errText("Refreshing choices",e),"error");}});
    $("marksFilterForm").addEventListener("submit",loadMissing);
    $("missingMarksForm").addEventListener("submit",saveMarks);
    $("announcementForm").addEventListener("submit",saveAnnouncement);
    $("studentRegistrationForm").addEventListener("submit",registerStudent);
    $("refreshStudentChoicesButton").addEventListener("click",async()=>{try{await loadStudentChoices();await loadRecentStudents();}catch(e){msg("studentRegistrationMessage",errText("Refreshing student choices",e),"error");}});
  } catch (error) {
    console.error("Dashboard authorization failed",error);
    document.querySelector(".content").innerHTML = `<section class="panel"><h2>Grade Hub</h2><p>${esc(error.message)}</p><a href="../index.html">Return to sign in</a></section>`;
  }
}
initialize();
