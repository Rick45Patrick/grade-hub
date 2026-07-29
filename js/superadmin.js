// ==========================================
// GRADE HUB - SUPER ADMIN DASHBOARD
// ==========================================

import { supabase } from "./supabase.js";




// ==========================================
// CHECK SUPER ADMIN
// ==========================================

async function checkSuperAdmin(){

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
        role.role !== "super_admin" ||
        role.approved === false
    ){

        window.location="index.html";

        return null;

    }



    return data.user;

}




// ==========================================
// LOAD ADMIN REQUESTS
// ==========================================


async function loadRequests(){


const {data,error}=await supabase

.from("admin_requests")

.select("*")

.eq("status","pending");




if(error){

console.log(error.message);

return;

}



const table =
document.getElementById("adminRequests");


table.innerHTML="";



data.forEach(request=>{


table.innerHTML += `

<tr>

<td>
${request.full_name}
</td>


<td>
${request.email}
</td>


<td>
${request.username}
</td>


<td>


<button 
class="btn"
onclick="approveAdmin('${request.id}','${request.user_id}')">

Approve

</button>



<button

class="btn"

style="background:red"

onclick="rejectAdmin('${request.id}')">

Reject

</button>


</td>


</tr>

`;


});


}




// ==========================================
// APPROVE ADMIN
// ==========================================


window.approveAdmin = async function(
requestId,
userId
){



const {error}=await supabase

.from("user_roles")

.insert({

user_id:userId,

role:"admin",

approved:true

});



if(error){

alert(error.message);

return;

}




await supabase

.from("admin_requests")

.update({

status:"approved"

})

.eq("id",requestId);




alert(
"Administrator approved"
);



loadRequests();



};





// ==========================================
// REJECT ADMIN
// ==========================================


window.rejectAdmin = async function(id){



const confirmReject =
confirm(
"Reject this administrator request?"
);



if(!confirmReject)
return;



await supabase

.from("admin_requests")

.update({

status:"rejected"

})

.eq("id",id);




loadRequests();


};





// ==========================================
// LOAD ADMINS
// ==========================================


async function loadAdmins(){



const {data,error}=await supabase

.from("user_roles")

.select(`

id,

role,

approved,

profiles(

full_name,

email

)

`)

.in("role",["admin"]);





if(error){

console.log(error.message);

return;

}




const table =
document.getElementById("adminList");


table.innerHTML="";



data.forEach(admin=>{


table.innerHTML += `

<tr>

<td>
${admin.profiles.full_name}
</td>


<td>
${admin.profiles.email}
</td>


<td>
${admin.role}
</td>


<td>

<button

class="btn"

style="background:red"

onclick="removeAdmin('${admin.id}')">

Remove

</button>


</td>


</tr>

`;


});



}





// ==========================================
// REMOVE ADMIN
// ==========================================


window.removeAdmin = async function(id){



const confirmRemove =
confirm(
"Remove this administrator?"
);



if(!confirmRemove)
return;



await supabase

.from("user_roles")

.delete()

.eq("id",id);




alert(
"Administrator removed"
);



loadAdmins();


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




// START

async function start(){


const user =
await checkSuperAdmin();



if(user){

loadRequests();

loadAdmins();

}


}



start();
