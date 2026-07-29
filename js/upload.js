// ==========================================
// GRADE HUB - RESULT UPLOAD SYSTEM
// ==========================================

import { supabase } from "./supabase.js";



let selectedStudent = null;
let currentAdmin = null;



// ==========================================
// CHECK ADMIN LOGIN
// ==========================================

async function checkAdmin(){


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
        (
            role.role !== "admin" &&
            role.role !== "super_admin"
        ) ||
        role.approved === false
    ){

        window.location="index.html";

        return null;

    }



    currentAdmin = data.user;

    return data.user;

}





// ==========================================
// LOAD STUDENT
// ==========================================

async function loadStudent(){



    await checkAdmin();



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

        alert(error.message);

        return;

    }






    document.getElementById("studentInfo").innerHTML = `

    <h3>${data.profiles.full_name}</h3>

    <p>
    Admission:
    ${data.admission_number}
    </p>

    <p>
    Class:
    ${data.class}
    </p>

    `;



    document.getElementById("optionalName1").value =
    data.optional_subjects[0] || "";



    document.getElementById("optionalName2").value =
    data.optional_subjects[1] || "";



    document.getElementById("optionalName3").value =
    data.optional_subjects[2] || "";



}






// ==========================================
// SAVE RESULTS WITHOUT DUPLICATES
// ==========================================

document

.getElementById("resultForm")

.addEventListener("submit",async(e)=>{


    e.preventDefault();



    const term =
    document.getElementById("term").value;



    const year =
    Number(
    document.getElementById("year").value
    );




    const subjects = [


        {
            name:"Mathematics",
            mark:
            Number(
            document.getElementById("mathematics").value
            )
        },


        {
            name:"English",
            mark:
            Number(
            document.getElementById("english").value
            )
        },


        {
            name:"Kiswahili",
            mark:
            Number(
            document.getElementById("kiswahili").value
            )
        },


        {
            name:"CSL",
            mark:
            Number(
            document.getElementById("csl").value
            )
        },


        {
            name:
            document.getElementById("optionalName1").value,

            mark:
            Number(
            document.getElementById("optionalMark1").value
            )
        },


        {
            name:
            document.getElementById("optionalName2").value,

            mark:
            Number(
            document.getElementById("optionalMark2").value
            )
        },


        {
            name:
            document.getElementById("optionalName3").value,

            mark:
            Number(
            document.getElementById("optionalMark3").value
            )
        }


    ];






    for(const subject of subjects){



        if(!subject.name)
        continue;




        // Check existing result

        const {data:existing}=await supabase

        .from("results")

        .select("id")

        .eq(
            "student_id",
            selectedStudent
        )

        .eq(
            "subject",
            subject.name
        )

        .eq(
            "term",
            term
        )

        .eq(
            "year",
            year
        )

        .maybeSingle();







        if(existing){


            // Update existing mark


            const {error}=await supabase

            .from("results")

            .update({

                marks:subject.mark,

                uploaded_by:
                currentAdmin.id

            })

            .eq(
                "id",
                existing.id
            );



            if(error){

                alert(error.message);

                return;

            }



        }



        else{



            // Insert new result


            const {error}=await supabase

            .from("results")

            .insert({


                student_id:selectedStudent,


                subject:subject.name,


                marks:subject.mark,


                term:term,


                year:year,


                uploaded_by:
                currentAdmin.id


            });



            if(error){

                alert(error.message);

                return;

            }



        }


    }




    document.getElementById("message")
    .textContent =
    "Results saved successfully (duplicates updated).";



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





loadStudent();
