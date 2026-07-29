// ==========================================
// GRADE HUB - STUDENT DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";

let chart;


// ==========================================
// CBC GRADING SYSTEM
// ==========================================

function getGrade(mark){

    if(mark >= 90){
        return "EE1";
    }

    else if(mark >= 75){
        return "EE2";
    }

    else if(mark >= 50){
        return "ME";
    }

    else if(mark >= 25){
        return "AE";
    }

    else{
        return "BE";
    }

}



// ==========================================
// CHECK STUDENT LOGIN
// ==========================================

async function checkStudent(){

    const {data} = await supabase.auth.getUser();


    if(!data.user){

        window.location="index.html";

        return null;

    }


    const {data:role}=await supabase

    .from("user_roles")

    .select("role,approved")

    .eq("user_id",data.user.id)

    .single();



    if(
        !role ||
        role.role !== "student" ||
        role.approved === false
    ){

        window.location="index.html";

        return null;

    }


    return data.user;

}





// ==========================================
// LOAD STUDENT DATA
// ==========================================


async function loadStudent(){


const user =
await checkStudent();



if(!user)
return;




// Get student profile

const {data:student,error}=await supabase

.from("students")

.select(`

id,

admission_number,

class,

optional_subjects,

profiles(
full_name,
email
)

`)

.eq("user_id",user.id)

.single();




if(error){

console.log(error.message);

return;

}




document.getElementById("studentProfile")
.innerHTML=`

<h3>${student.profiles.full_name}</h3>

<p>
Admission: ${student.admission_number}
</p>

<p>
Class: ${student.class}
</p>

<p>
Email: ${student.profiles.email}
</p>

`;




// Load results

const {data:results}=await supabase

.from("results")

.select("*")

.eq("student_id",student.id);





displayResults(results || []);





}




// ==========================================
// DISPLAY RESULTS
// ==========================================


function displayResults(results){



const table =
document.getElementById("resultTable");



table.innerHTML="";



let total=0;


let subjects=[];


let marks=[];



results.forEach(result=>{


total += result.marks;


subjects.push(result.subject);

marks.push(result.marks);



table.innerHTML +=`

<tr>

<td>
${result.subject}
</td>


<td>
${result.marks}%
</td>


<td>
${getGrade(result.marks)}
</td>


</tr>

`;


});





let average=0;


if(results.length){

average =
Math.round(total/results.length);

}



document.getElementById("averageMarks")
.textContent =
average + "%";



document.getElementById("overallGrade")
.textContent =
getGrade(average);



document.getElementById("subjectCount")
.textContent =
results.length;




createGraph(subjects,marks);



}





// ==========================================
// CREATE PERFORMANCE GRAPH
// ==========================================


function createGraph(subjects,marks){



const ctx =
document

.getElementById("performanceChart")

.getContext("2d");



if(chart){

chart.destroy();

}



chart=new Chart(ctx,{

type:"line",


data:{


labels:subjects,


datasets:[{

label:"Marks",

data:marks,

borderWidth:3,

fill:false

}]


},


options:{

responsive:true,


scales:{

y:{

beginAtZero:true,

max:100

}

}

}

});



}




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

loadStudent();
