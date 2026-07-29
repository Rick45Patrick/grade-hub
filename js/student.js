// ==========================================
// GRADE HUB - STUDENT DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";

import {
    getGrade,
    calculateAverage,
    getOverallLevel,
    getGradeDescription
} from "./grading.js";



let chart;



// ==========================================
// CHECK STUDENT LOGIN
// ==========================================

async function checkStudent(){


    const {data} = await supabase.auth.getUser();



    if(!data.user){

        window.location = "index.html";

        return null;

    }




    const {data:role} = await supabase

    .from("user_roles")

    .select("role,approved")

    .eq("user_id", data.user.id)

    .single();



    if(
        !role ||
        role.role !== "student" ||
        role.approved === false
    ){

        window.location = "index.html";

        return null;

    }



    return data.user;

}





// ==========================================
// LOAD STUDENT DATA
// ==========================================

async function loadStudent(){


    const user = await checkStudent();



    if(!user)
    return;




    const {data:student,error} = await supabase

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

    .eq("user_id", user.id)

    .single();




    if(error){

        console.log(error.message);

        return;

    }





    document.getElementById("studentProfile").innerHTML = `

        <h3>
        ${student.profiles.full_name}
        </h3>

        <p>
        Admission Number:
        ${student.admission_number}
        </p>

        <p>
        Class:
        ${student.class}
        </p>

        <p>
        Email:
        ${student.profiles.email}
        </p>

    `;






    const {data:results,error:resultError} = await supabase

    .from("results")

    .select("*")

    .eq("student_id", student.id);




    if(resultError){

        console.log(resultError.message);

        return;

    }



    displayResults(results || []);



}






// ==========================================
// DISPLAY RESULTS
// ==========================================

function displayResults(results){



    const table =
    document.getElementById("resultTable");



    table.innerHTML = "";



    let subjects = [];

    let marks = [];




    results.forEach(result=>{



        const grade =
        getGrade(result.marks);



        table.innerHTML += `

        <tr>


        <td>
        ${result.subject}
        </td>


        <td>
        ${result.marks}%
        </td>


        <td>
        ${grade}
        </td>


        </tr>

        `;



        subjects.push(result.subject);

        marks.push(result.marks);



    });







    const average =
    calculateAverage(results);



    const overall =
    getOverallLevel(results);




    document.getElementById("averageMarks")
    .textContent =
    average + "%";



    document.getElementById("overallGrade")
    .textContent =
    overall;




    document.getElementById("subjectCount")
    .textContent =
    results.length;



    createGraph(
        subjects,
        marks
    );


}







// ==========================================
// PERFORMANCE GRAPH
// ==========================================

function createGraph(subjects,marks){



    const ctx =
    document

    .getElementById("performanceChart")

    .getContext("2d");



    if(chart){

        chart.destroy();

    }




    chart = new Chart(ctx,{


        type:"line",


        data:{


            labels:subjects,


            datasets:[{

                label:"Performance",

                data:marks,

                borderWidth:3

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






loadStudent();
