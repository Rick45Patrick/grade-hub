// ==========================================
// GRADE HUB ADMIN DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// CHECK ADMIN LOGIN
// ==========================================

async function checkAdmin(){

    const {data} = await supabase.auth.getUser();

    if(!data.user){

        window.location = "index.html";

        return;

    }


    const {data:role}=await supabase

    .from("user_roles")

    .select("role,approved")

    .eq("user_id",data.user.id)
    .single();



    if(
        !role ||
        (role.role !== "admin" &&
        role.role !== "super_admin") ||
        role.approved === false
    ){

        window.location="index.html";

    }

}



checkAdmin();




// ==========================================
// LOAD STUDENTS
// ==========================================

async function loadStudents(){


const table =
document.getElementById("studentTable");



const {data:students,error}=await supabase

.from("students")

.select(`

id,

admission_number,

class,

optional_subjects,

profiles(
full_name
)

`);




if(error){

console.log(error.message);

return;

}



table.innerHTML="";



students.forEach(student=>{


table.innerHTML += `

<tr>


<td>
${student.admission_number}
</td>


<td>
${student.profiles.full_name}
</td>


<td>
${student.class}
</td>


<td>
${student.optional_subjects.join(", ")}
</td>



<td>


<button 
class="btn"
onclick="uploadResults('${student.id}')">

Upload

</button>



<button
class="btn"
style="background:red"
onclick="deleteStudent('${student.id}')">

Delete

</button>



</td>


</tr>


`;


});



document.getElementById("studentCount")
.textContent = students.length;



}




// ==========================================
// SEARCH STUDENTS
// ==========================================


document

.getElementById("searchStudent")

.addEventListener("input",async(e)=>{


const value=e.target.value.toLowerCase();


const rows=document.querySelectorAll("#studentTable tr");



rows.forEach(row=>{


row.style.display =
row.textContent.toLowerCase()
.includes(value)
?
""
:
"none";


});


});





// ==========================================
// OPEN UPLOAD PAGE
// ==========================================


window.uploadResults=function(id){


localStorage.setItem(
"selectedStudent",
id
);


window.location="upload.html";


};




// ==========================================
// DELETE STUDENT
// ==========================================


window.deleteStudent=async function(id){


const confirmDelete =
confirm(
"Are you sure you want to delete this student?"
);



if(!confirmDelete)
return;




const {error}=await supabase

.from("students")

.delete()

.eq("id",id);



if(error){

alert(error.message);

return;

}



alert(
"Student deleted successfully"
);



loadStudents();


};





// ==========================================
// LOGOUT
// ==========================================


document

.getElementById("logout")

.addEventListener("click",async()=>{


await supabase.auth.signOut();


window.location="index.html";


});




// Start dashboard

loadStudents();
