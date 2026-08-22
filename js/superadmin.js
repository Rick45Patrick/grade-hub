// ============================================================
// GRADE HUB V2
// Subject combinations, exams, results, documents
// ============================================================

const subjectsTable = document.getElementById("subjectsTable");
const combinationSubjects = document.getElementById("combinationSubjects");
const combinationsList = document.getElementById("combinationsList");

const combinationStudent =
    document.getElementById("combinationStudent");

const studentCombination =
    document.getElementById("studentCombination");

const examsTable =
    document.getElementById("examsTable");

const resultExam =
    document.getElementById("resultExam");

const resultStudent =
    document.getElementById("resultStudent");

const resultSubject =
    document.getElementById("resultSubject");

const documentsTable =
    document.getElementById("documentsTable");

const announcementsList =
    document.getElementById("announcementsList");


// ------------------------------------------------------------
// MESSAGE
// ------------------------------------------------------------

function showV2Message(message, type = "success") {

    const box =
        document.getElementById("saMessage");

    if (!box) return;

    box.textContent = message;

    box.className =
        `sa-message show ${type}`;

    setTimeout(() => {

        box.classList.remove("show");

    }, 4000);
}


// ------------------------------------------------------------
// LOAD SUBJECTS
// ------------------------------------------------------------

async function loadSubjects() {

    const { data, error } =
        await supabase
            .from("subjects")
            .select("*")
            .order("name");

    if (error) {

        console.error(error);

        showV2Message(
            "Could not load subjects.",
            "error"
        );

        return [];

    }

    renderSubjects(data || []);

    renderSubjectCheckboxes(data || []);

    renderResultSubjects(data || []);

    const total =
        document.getElementById("totalSubjects");

    if (total) {

        total.textContent =
            data.length;

    }

    return data || [];
}


// ------------------------------------------------------------
// DISPLAY SUBJECTS
// ------------------------------------------------------------

function renderSubjects(subjects) {

    if (!subjectsTable) return;

    if (!subjects.length) {

        subjectsTable.innerHTML = `
            <tr>
                <td colspan="4" class="empty">
                    No subjects found.
                </td>
            </tr>
        `;

        return;
    }

    subjectsTable.innerHTML =
        subjects.map(subject => {

            return `
                <tr>

                    <td>
                        ${escapeHTML(subject.code || "-")}
                    </td>

                    <td>
                        ${escapeHTML(subject.name)}
                    </td>

                    <td>
                        ${formatDate(subject.created_at)}
                    </td>

                    <td>

                        <button
                            class="danger-button"
                            onclick="deleteSubject('${subject.id}')">

                            Delete

                        </button>

                    </td>

                </tr>
            `;

        }).join("");
}


// ------------------------------------------------------------
// SUBJECT CHECKBOXES
// ------------------------------------------------------------

function renderSubjectCheckboxes(subjects) {

    if (!combinationSubjects) return;

    if (!subjects.length) {

        combinationSubjects.innerHTML =
            "No subjects available.";

        return;
    }

    combinationSubjects.innerHTML =
        subjects.map(subject => {

            return `
                <label class="checkbox-item">

                    <input
                        type="checkbox"
                        value="${subject.id}">

                    ${escapeHTML(subject.name)}

                </label>
            `;

        }).join("");
}


// ------------------------------------------------------------
// ADD SUBJECT
// ------------------------------------------------------------

const subjectForm =
    document.getElementById("subjectForm");

if (subjectForm) {

    subjectForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById("subjectName")
                    .value
                    .trim();

            const code =
                document
                    .getElementById("subjectCode")
                    .value
                    .trim()
                    .toUpperCase();

            if (!name || !code) {

                showV2Message(
                    "Enter both subject name and code.",
                    "warning"
                );

                return;

            }

            const { error } =
                await supabase
                    .from("subjects")
                    .insert({
                        name,
                        code
                    });

            if (error) {

                console.error(error);

                showV2Message(
                    error.message,
                    "error"
                );

                return;

            }

            subjectForm.reset();

            showV2Message(
                "Subject added successfully."
            );

            loadSubjects();

        }
    );

}


// ------------------------------------------------------------
// DELETE SUBJECT
// ------------------------------------------------------------

window.deleteSubject =
    async function (id) {

        const confirmed =
            confirm(
                "Delete this subject?"
            );

        if (!confirmed) return;

        const { error } =
            await supabase
                .from("subjects")
                .delete()
                .eq("id", id);

        if (error) {

            console.error(error);

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Subject deleted."
        );

        loadSubjects();

    };


// ------------------------------------------------------------
// CREATE COMBINATION
// ------------------------------------------------------------

const combinationForm =
    document.getElementById(
        "combinationForm"
    );

if (combinationForm) {

    combinationForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById(
                        "combinationName"
                    )
                    .value
                    .trim();

            const description =
                document
                    .getElementById(
                        "combinationDescription"
                    )
                    .value
                    .trim();

            const selected =
                [
                    ...document.querySelectorAll(
                        "#combinationSubjects input:checked"
                    )
                ].map(
                    checkbox => checkbox.value
                );

            if (!name) {

                showV2Message(
                    "Enter a combination name.",
                    "warning"
                );

                return;

            }

            if (!selected.length) {

                showV2Message(
                    "Select at least one subject.",
                    "warning"
                );

                return;

            }

            const {
                data: combination,
                error: combinationError
            } =
                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .insert({
                        name,
                        description
                    })
                    .select()
                    .single();

            if (combinationError) {

                console.error(
                    combinationError
                );

                showV2Message(
                    combinationError.message,
                    "error"
                );

                return;

            }

            const rows =
                selected.map(subjectId => {

                    return {
                        combination_id:
                            combination.id,

                        subject_id:
                            subjectId
                    };

                });

            const {
                error: subjectError
            } =
                await supabase
                    .from(
                        "combination_subjects"
                    )
                    .insert(rows);

            if (subjectError) {

                console.error(
                    subjectError
                );

                await supabase
                    .from(
                        "subject_combinations"
                    )
                    .delete()
                    .eq(
                        "id",
                        combination.id
                    );

                showV2Message(
                    subjectError.message,
                    "error"
                );

                return;

            }

            combinationForm.reset();

            showV2Message(
                "Combination created successfully."
            );

            loadCombinations();

        }
    );

}


// ------------------------------------------------------------
// LOAD COMBINATIONS
// ------------------------------------------------------------

async function loadCombinations() {

    const {
        data,
        error
    } =
        await supabase
            .from(
                "subject_combinations"
            )
            .select(`
                id,
                name,
                description,
                created_at,
                combination_subjects (
                    subject_id,
                    subjects (
                        id,
                        name,
                        code
                    )
                )
            `)
            .order("name");

    if (error) {

        console.error(error);

        showV2Message(
            "Could not load combinations.",
            "error"
        );

        return;

    }

    renderCombinations(
        data || []
    );

    renderCombinationSelect(
        data || []
    );

}


// ------------------------------------------------------------
// DISPLAY COMBINATIONS
// ------------------------------------------------------------

function renderCombinations(
    combinations
) {

    if (!combinationsList) return;

    if (!combinations.length) {

        combinationsList.innerHTML = `
            <div class="sa-card">
                <div class="empty">
                    No combinations created yet.
                </div>
            </div>
        `;

        return;

    }

    combinationsList.innerHTML =
        combinations.map(
            combination => {

                const subjects =
                    combination
                        .combination_subjects
                        ?.map(
                            row => row.subjects
                        )
                        .filter(Boolean)
                        || [];

                return `
                    <div class="combination-card">

                        <h4>
                            ${escapeHTML(
                                combination.name
                            )}
                        </h4>

                        <p>
                            ${escapeHTML(
                                combination.description
                                || "No description"
                            )}
                        </p>

                        <div class="subject-list">

                            ${
                                subjects.length

                                ? subjects.map(
                                    subject => `
                                        <span
                                            class="subject-tag">

                                            ${escapeHTML(
                                                subject.name
                                            )}

                                        </span>
                                    `
                                ).join("")

                                : `
                                    <span>
                                        No subjects
                                    </span>
                                `
                            }

                        </div>

                        <br>

                        <button
                            class="danger-button"
                            onclick="deleteCombination(
                                '${combination.id}'
                            )">

                            Delete

                        </button>

                    </div>
                `;

            }
        ).join("");

}


// ------------------------------------------------------------
// COMBINATION SELECT
// ------------------------------------------------------------

function renderCombinationSelect(
    combinations
) {

    if (!studentCombination) return;

    studentCombination.innerHTML =
        `
            <option value="">
                Select combination
            </option>
        `;

    combinations.forEach(
        combination => {

            studentCombination.innerHTML += `
                <option value="${combination.id}">
                    ${escapeHTML(
                        combination.name
                    )}
                </option>
            `;

        }
    );

}


// ------------------------------------------------------------
// DELETE COMBINATION
// ------------------------------------------------------------

window.deleteCombination =
    async function (id) {

        const confirmed =
            confirm(
                "Delete this combination?"
            );

        if (!confirmed) return;

        const { error } =
            await supabase
                .from(
                    "subject_combinations"
                )
                .delete()
                .eq("id", id);

        if (error) {

            console.error(error);

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Combination deleted."
        );

        loadCombinations();

    };


// ------------------------------------------------------------
// LOAD STUDENTS
// ------------------------------------------------------------

async function loadV2Students() {

    const {
        data,
        error
    } =
        await supabase
            .from("students")
            .select("*")
            .order("full_name");

    if (error) {

        console.error(error);

        return [];

    }

    renderStudentSelects(
        data || []
    );

    renderStudentsV2(
        data || []
    );

    const total =
        document.getElementById(
            "totalStudents"
        );

    if (total) {

        total.textContent =
            data.length;

    }

    return data || [];

}


// ------------------------------------------------------------
// STUDENT SELECTS
// ------------------------------------------------------------

function renderStudentSelects(
    students
) {

    if (
        !combinationStudent &&
        !resultStudent
    ) return;

    const options =
        students.map(
            student => {

                const name =
                    student.full_name
                    || student.name
                    || student.email
                    || "Student";

                return `
                    <option value="${student.id}">
                        ${escapeHTML(name)}
                    </option>
                `;

            }
        ).join("");

    if (combinationStudent) {

        combinationStudent.innerHTML =
            `
                <option value="">
                    Select student
                </option>
            `
            +
            options;

    }

    if (resultStudent) {

        resultStudent.innerHTML =
            `
                <option value="">
                    Select student
                </option>
            `
            +
            options;

    }

}


// ------------------------------------------------------------
// STUDENT TABLE
// ------------------------------------------------------------

function renderStudentsV2(
    students
) {

    const table =
        document.getElementById(
            "studentsTable"
        );

    if (!table) return;

    if (!students.length) {

        table.innerHTML = `
            <tr>
                <td colspan="4" class="empty">
                    No students found.
                </td>
            </tr>
        `;

        return;

    }

    table.innerHTML =
        students.map(
            student => {

                const name =
                    student.full_name
                    || student.name
                    || "-";

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                student.admission_number
                                || student.admission_no
                                || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(name)}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.class
                                || student.grade
                                || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                student.email
                                || "-"
                            )}
                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ------------------------------------------------------------
// ASSIGN STUDENT COMBINATION
// ------------------------------------------------------------

const studentCombinationForm =
    document.getElementById(
        "studentCombinationForm"
    );

if (studentCombinationForm) {

    studentCombinationForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const studentId =
                combinationStudent.value;

            const combinationId =
                studentCombination.value;

            if (
                !studentId ||
                !combinationId
            ) {

                showV2Message(
                    "Select both student and combination.",
                    "warning"
                );

                return;

            }

            const {
                data,
                error
            } =
                await supabase.rpc(
                    "assign_student_combination",
                    {
                        target_student_id:
                            studentId,

                        target_combination_id:
                            combinationId
                    }
                );

            if (error) {

                console.error(error);

                showV2Message(
                    error.message,
                    "error"
                );

                return;

            }

            studentCombinationForm.reset();

            showV2Message(
                "Student combination updated."
            );

        }
    );

}


// ------------------------------------------------------------
// CREATE EXAM
// ------------------------------------------------------------

const examForm =
    document.getElementById(
        "examForm"
    );

if (examForm) {

    examForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById(
                        "examName"
                    )
                    .value
                    .trim();

            const academicYear =
                Number(
                    document
                        .getElementById(
                            "examYear"
                        )
                        .value
                );

            const term =
                document
                    .getElementById(
                        "examTerm"
                    )
                    .value;

            const examDate =
                document
                    .getElementById(
                        "examDate"
                    )
                    .value
                    || null;

            const {
                error
            } =
                await supabase
                    .from("exams")
                    .insert({
                        name,
                        academic_year:
                            academicYear,

                        term,
                        exam_date:
                            examDate
                    });

            if (error) {

                console.error(error);

                showV2Message(
                    error.message,
                    "error"
                );

                return;

            }

            examForm.reset();

            showV2Message(
                "Exam created."
            );

            loadExams();

        }
    );

}


// ------------------------------------------------------------
// LOAD EXAMS
// ------------------------------------------------------------

async function loadExams() {

    const {
        data,
        error
    } =
        await supabase
            .from("exams")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(error);

        return;

    }

    renderExams(
        data || []
    );

    renderExamSelect(
        data || []
    );

    const total =
        document.getElementById(
            "totalExams"
        );

    if (total) {

        total.textContent =
            data.length;

    }

}


// ------------------------------------------------------------
// DISPLAY EXAMS
// ------------------------------------------------------------

function renderExams(
    exams
) {

    if (!examsTable) return;

    if (!exams.length) {

        examsTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    No exams created.
                </td>
            </tr>
        `;

        return;

    }

    examsTable.innerHTML =
        exams.map(
            exam => {

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                exam.name
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                exam.term || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                exam.exam_date || "-"
                            )}
                        </td>

                        <td>

                            ${
                                exam.is_latest

                                ? `
                                    <span
                                        class="status published">
                                        Latest
                                    </span>
                                `

                                : `
                                    <span
                                        class="status unpublished">
                                        Normal
                                    </span>
                                `
                            }

                        </td>

                        <td>

                            ${
                                exam.is_latest

                                ? ""

                                : `
                                    <button
                                        class="primary-button"
                                        onclick="setLatestExam(
                                            '${exam.id}'
                                        )">

                                        Make Latest

                                    </button>
                                `
                            }

                            <button
                                class="danger-button"
                                onclick="deleteExam(
                                    '${exam.id}'
                                )">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ------------------------------------------------------------
// EXAM SELECT
// ------------------------------------------------------------

function renderExamSelect(
    exams
) {

    if (!resultExam) return;

    resultExam.innerHTML =
        `
            <option value="">
                Select exam
            </option>
        `;

    exams.forEach(
        exam => {

            resultExam.innerHTML += `
                <option value="${exam.id}">
                    ${escapeHTML(
                        exam.name
                    )}
                </option>
            `;

        }
    );

}


// ------------------------------------------------------------
// SET LATEST EXAM
// ------------------------------------------------------------

window.setLatestExam =
    async function (id) {

        const {
            error
        } =
            await supabase.rpc(
                "set_latest_exam",
                {
                    target_exam_id:
                        id
                }
            );

        if (error) {

            console.error(error);

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Latest exam updated."
        );

        loadExams();

    };


// ------------------------------------------------------------
// DELETE EXAM
// ------------------------------------------------------------

window.deleteExam =
    async function (id) {

        const confirmed =
            confirm(
                "Delete this exam and its results?"
            );

        if (!confirmed) return;

        const {
            error
        } =
            await supabase
                .from("exams")
                .delete()
                .eq("id", id);

        if (error) {

            console.error(error);

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Exam deleted."
        );

        loadExams();

    };


// ------------------------------------------------------------
// RESULT SUBJECTS
// ------------------------------------------------------------

function renderResultSubjects(
    subjects
) {

    if (!resultSubject) return;

    resultSubject.innerHTML =
        `
            <option value="">
                Select subject
            </option>
        `;

    subjects.forEach(
        subject => {

            resultSubject.innerHTML += `
                <option value="${subject.id}">
                    ${escapeHTML(
                        subject.name
                    )}
                </option>
            `;

        }
    );

}


// ------------------------------------------------------------
// SAVE RESULT
// ------------------------------------------------------------

const resultForm =
    document.getElementById(
        "resultForm"
    );

if (resultForm) {

    resultForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const examId =
                resultExam.value;

            const studentId =
                resultStudent.value;

            const subjectId =
                resultSubject.value;

            const score =
                Number(
                    document.getElementById(
                        "resultScore"
                    ).value
                );

            const maxScore =
                Number(
                    document.getElementById(
                        "resultMaxScore"
                    ).value
                );

            const comment =
                document.getElementById(
                    "resultComment"
                ).value
                .trim();

            if (
                !examId ||
                !studentId ||
                !subjectId
            ) {

                showV2Message(
                    "Select exam, student and subject.",
                    "warning"
                );

                return;

            }

            if (
                score < 0 ||
                maxScore <= 0 ||
                score > maxScore
            ) {

                showV2Message(
                    "Enter a valid score.",
                    "warning"
                );

                return;

            }

            const {
                error
            } =
                await supabase
                    .from(
                        "exam_results"
                    )
                    .upsert(
                        {
                            exam_id:
                                examId,

                            student_id:
                                studentId,

                            subject_id:
                                subjectId,

                            score,
                            max_score:
                                maxScore,

                            teacher_comment:
                                comment
                        },
                        {
                            onConflict:
                                "exam_id,student_id,subject_id"
                        }
                    );

            if (error) {

                console.error(error);

                showV2Message(
                    error.message,
                    "error"
                );

                return;

            }

            resultForm.reset();

            document
                .getElementById(
                    "resultMaxScore"
                )
                .value = 100;

            showV2Message(
                "Result saved successfully."
            );

        }
    );

}


// ------------------------------------------------------------
// DOCUMENT UPLOAD
// ------------------------------------------------------------

const documentForm =
    document.getElementById(
        "documentForm"
    );

if (documentForm) {

    documentForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const title =
                document
                    .getElementById(
                        "documentTitle"
                    )
                    .value
                    .trim();

            const category =
                document
                    .getElementById(
                        "documentCategory"
                    )
                    .value;

            const description =
                document
                    .getElementById(
                        "documentDescription"
                    )
                    .value
                    .trim();

            const file =
                document
                    .getElementById(
                        "documentFile"
                    )
                    .files[0];

            if (!file) {

                showV2Message(
                    "Choose a file first.",
                    "warning"
                );

                return;

            }

            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

            const path =
                `${Date.now()}_${safeName}`;

            const {
                error: uploadError
            } =
                await supabase
                    .storage
                    .from(
                        "grade-hub-documents"
                    )
                    .upload(
                        path,
                        file
                    );

            if (uploadError) {

                console.error(
                    uploadError
                );

                showV2Message(
                    uploadError.message,
                    "error"
                );

                return;

            }

            const {
                error: databaseError
            } =
                await supabase
                    .from(
                        "documents"
                    )
                    .insert(
                        {
                            title,
                            description,
                            category,

                            file_name:
                                file.name,

                            storage_path:
                                path,

                            file_type:
                                file.type,

                            file_size:
                                file.size,

                            published:
                                true
                        }
                    );

            if (databaseError) {

                console.error(
                    databaseError
                );

                await supabase
                    .storage
                    .from(
                        "grade-hub-documents"
                    )
                    .remove([path]);

                showV2Message(
                    databaseError.message,
                    "error"
                );

                return;

            }

            documentForm.reset();

            showV2Message(
                "Document uploaded successfully."
            );

            loadDocuments();

        }
    );

}


// ------------------------------------------------------------
// LOAD DOCUMENTS
// ------------------------------------------------------------

async function loadDocuments() {

    const {
        data,
        error
    } =
        await supabase
            .from("documents")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(error);

        return;

    }

    renderDocuments(
        data || []
    );

}


// ------------------------------------------------------------
// DISPLAY DOCUMENTS
// ------------------------------------------------------------

function renderDocuments(
    documents
) {

    if (!documentsTable) return;

    if (!documents.length) {

        documentsTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    No documents uploaded.
                </td>
            </tr>
        `;

        return;

    }

    documentsTable.innerHTML =
        documents.map(
            document => {

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                document.title
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                document.category
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                document.created_at
                            )}
                        </td>

                        <td>

                            ${
                                document.published

                                ? `
                                    <span
                                        class="status published">
                                        Published
                                    </span>
                                `

                                : `
                                    <span
                                        class="status unpublished">
                                        Hidden
                                    </span>
                                `
                            }

                        </td>

                        <td>

                            <button
                                class="secondary-button"
                                onclick="toggleDocument(
                                    '${document.id}',
                                    ${document.published}
                                )">

                                ${
                                    document.published
                                    ? "Hide"
                                    : "Publish"
                                }

                            </button>

                            <button
                                class="danger-button"
                                onclick="deleteDocument(
                                    '${document.id}',
                                    '${escapeAttribute(
                                        document.storage_path
                                    )}'
                                )">

                                Delete

                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

}


// ------------------------------------------------------------
// TOGGLE DOCUMENT
// ------------------------------------------------------------

window.toggleDocument =
    async function (
        id,
        current
    ) {

        const {
            error
        } =
            await supabase
                .from("documents")
                .update({
                    published:
                        !current
                })
                .eq("id", id);

        if (error) {

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        loadDocuments();

    };


// ------------------------------------------------------------
// DELETE DOCUMENT
// ------------------------------------------------------------

window.deleteDocument =
    async function (
        id,
        storagePath
    ) {

        const confirmed =
            confirm(
                "Delete this document?"
            );

        if (!confirmed) return;

        const {
            error: storageError
        } =
            await supabase
                .storage
                .from(
                    "grade-hub-documents"
                )
                .remove([
                    storagePath
                ]);

        if (storageError) {

            console.warn(
                storageError
            );

        }

        const {
            error
        } =
            await supabase
                .from("documents")
                .delete()
                .eq("id", id);

        if (error) {

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Document deleted."
        );

        loadDocuments();

    };


// ------------------------------------------------------------
// ANNOUNCEMENT
// ------------------------------------------------------------

const announcementForm =
    document.getElementById(
        "announcementForm"
    );

if (announcementForm) {

    announcementForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const title =
                document
                    .getElementById(
                        "announcementTitle"
                    )
                    .value
                    .trim();

            const message =
                document
                    .getElementById(
                        "announcementMessage"
                    )
                    .value
                    .trim();

            if (!title || !message) {

                showV2Message(
                    "Enter a title and message.",
                    "warning"
                );

                return;

            }

            const {
                error
            } =
                await supabase
                    .from(
                        "announcements"
                    )
                    .insert({
                        title,
                        message,
                        published:
                            true
                    });

            if (error) {

                console.error(error);

                showV2Message(
                    error.message,
                    "error"
                );

                return;

            }

            announcementForm.reset();

            showV2Message(
                "Announcement published."
            );

            loadAnnouncements();

        }
    );

}


// ------------------------------------------------------------
// LOAD ANNOUNCEMENTS
// ------------------------------------------------------------

async function loadAnnouncements() {

    const {
        data,
        error
    } =
        await supabase
            .from(
                "announcements"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(error);

        return;

    }

    renderAnnouncements(
        data || []
    );

}


// ------------------------------------------------------------
// DISPLAY ANNOUNCEMENTS
// ------------------------------------------------------------

function renderAnnouncements(
    announcements
) {

    if (!announcementsList) return;

    if (!announcements.length) {

        announcementsList.innerHTML = `
            <div class="sa-card">
                <div class="empty">
                    No announcements.
                </div>
            </div>
        `;

        return;

    }

    announcementsList.innerHTML =
        announcements.map(
            announcement => {

                return `
                    <div class="sa-card"
                         style="margin-bottom:12px;">

                        <div class="sa-card-body">

                            <h3>
                                ${escapeHTML(
                                    announcement.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    announcement.message
                                )}
                            </p>

                            <small>
                                ${formatDate(
                                    announcement.created_at
                                )}
                            </small>

                            <br>
                            <br>

                            <button
                                class="danger-button"
                                onclick="deleteAnnouncement(
                                    '${announcement.id}'
                                )">

                                Delete

                            </button>

                        </div>

                    </div>
                `;

            }
        ).join("");

}


// ------------------------------------------------------------
// DELETE ANNOUNCEMENT
// ------------------------------------------------------------

window.deleteAnnouncement =
    async function (id) {

        const confirmed =
            confirm(
                "Delete this announcement?"
            );

        if (!confirmed) return;

        const {
            error
        } =
            await supabase
                .from(
                    "announcements"
                )
                .delete()
                .eq(
                    "id",
                    id
                );

        if (error) {

            showV2Message(
                error.message,
                "error"
            );

            return;

        }

        showV2Message(
            "Announcement deleted."
        );

        loadAnnouncements();

    };


// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );

}


function formatDate(
    value
) {

    if (!value) return "-";

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }

    return date.toLocaleDateString();

}


// ------------------------------------------------------------
// INITIALISE GRADE HUB V2
// ------------------------------------------------------------

async function initialiseGradeHubV2() {

    try {

        await loadSubjects();

        await loadCombinations();

        await loadV2Students();

        await loadExams();

        await loadDocuments();

        await loadAnnouncements();

    } catch (error) {

        console.error(
            "Grade Hub V2 initialization error:",
            error
        );

    }

}


// ------------------------------------------------------------
// REFRESH
// ------------------------------------------------------------

const refreshDashboard =
    document.getElementById(
        "refreshDashboard"
    );

if (refreshDashboard) {

    refreshDashboard.addEventListener(
        "click",
        initialiseGradeHubV2
    );

}


initialiseGradeHubV2();
