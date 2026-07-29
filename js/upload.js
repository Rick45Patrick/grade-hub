// ==========================================
// GRADE HUB - RESULT UPLOAD
// ==========================================

import { supabase } from "./supabase.js";



let selectedStudent = null;



// ==========================================
// CHECK LOGIN
// ==========================================

async function checkAdmin(){


const {data} = await supabase.auth.getUser();



if(!data.user){

window.location="index.html";

return;

}


return data.user;


}





// ==========================================
// LOAD SELECTED STUDENT
// ==========================================


async function loadStudent(){


const studentId =
localStorage.getItem("selectedStudent");



if(!studentId){

alert("No student selected");

window.location="admin.html";

return;

}



selectedStudent = studentId;



const {data,error}=await supabase

.from("students")

.select(`

id,

admission_number,

class,

optional_subjects,

profiles(
full_name
)

`)

.eq("id",studentId)

.single();




if(error){

console.log(error.message);

return;

}




document.getElementById("studentInfo")
.innerHTML = `

<h3>
${data.profiles.full_name}
</h3>

<p>
Admission: ${data.admission_number}
</p>

<p>
Class: ${data.class}
</p>

`;





// Load optional subjects

document.getElementById("optionalName1")
.value =
data.optional_subjects[0] || "";



document.getElementById("optionalName2")
.value =
data.optional_subjects[1] || "";



document.getElementById("optionalName3")
.value =
data.optional_subjects[2] || "";



}




// ==========================================
// SAVE RESULTS
// ==========================================


document

.getElementById("resultForm")

.addEventListener("submit",async(e)=>{


e.preventDefault();



const user =
await checkAdmin();



if(!user)
return;



const term =
document.getElementById("term").value;


const year =
document.getElementById("year").value;



const results=[


{
subject:"Mathematics",
marks:
Number(document.getElementById("mathematics").value)
},


{
subject:"English",
marks:
Number(document.getElementById("english").value)
},


{
subject:"Kiswahili",
marks:
Number(document.getElementById("kiswahili").value)
},


{
subject:"CSL",
marks:
Number(document.getElementById("csl").value)
},



{
subject:
document.getElementById("optionalName1").value,

marks:
Number(document.getElementById("optionalMark1").value)
},


{
subject:
document.getElementById("optionalName2").value,

marks:
Number(document.getElementById("optionalMark2").value)
},


{
subject:
document.getElementById("optionalName3").value,

marks:
Number(document.getElementById("optionalMark3").value)
}


];





for(const result of results){


if(result.subject && result.marks){


const {error}=await supabase

.from("results")

.insert({

student_id:selectedStudent,

subject:result.subject,

marks:result.marks,

term:term,

year:Number(year),

uploaded_by:user.id

});



if(error){

document.getElementById("message")
.textContent=error.message;

return;

}


}


}




document.getElementById("message")
.textContent=
"Results uploaded successfully";



});





// ==========================================
// LOGOUT
// ==========================================


document

.getElementById("logout")

.addEventListener("click",async()=>{


await supabase.auth.signOut();


window.location="index.html";


});




// Start

loadStudent();
