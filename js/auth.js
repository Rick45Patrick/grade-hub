// ==========================================
// GRADE HUB AUTHENTICATION
// ==========================================
console.log("Auth JS loaded");

import { supabase } from "./supabase.js";


// ==========================================
// REGISTER ACCOUNT
// ==========================================

const registerForm = document.getElementById("registerForm");


if (registerForm) {

registerForm.addEventListener("submit", async (e)=>{


e.preventDefault();


const accountType =
document.getElementById("accountType").value;


const email =
document.getElementById("email").value.trim();


const password =
document.getElementById("password").value;


const confirmPassword =
document.getElementById("confirmPassword").value;


const message =
document.getElementById("message");



if(password !== confirmPassword){

message.textContent =
"Passwords do not match";

return;

}



if(password.length < 6){

message.textContent =
"Password must be at least 6 characters";

return;

}




// Create Supabase account

const {data,error} =
await supabase.auth.signUp({

email: email,

password: password

});



if(error){

message.textContent =
error.message;

return;

}



const user = data.user;



// Student registration

if(accountType === "student"){


const student = {

id:user.id,

full_name:
document.getElementById("fullName").value,


username:
document.getElementById("username").value,


email:email

};



await supabase
.from("profiles")
.insert(student);



await supabase
.from("user_roles")
.insert({

user_id:user.id,

role:"student",

approved:true

});



await supabase
.from("students")
.insert({

user_id:user.id,

admission_number:
document.getElementById("admission").value,


class:
document.getElementById("class").value,


optional_subjects:[

document.getElementById("optional1").value,

document.getElementById("optional2").value,

document.getElementById("optional3").value

]

});



message.textContent =
"Student account created successfully";


}



// Admin request

if(accountType === "admin"){


await supabase
.from("admin_requests")
.insert({

user_id:user.id,

full_name:
document.getElementById("adminName").value,


email:email,


username:
document.getElementById("username").value

});



message.textContent =
"Admin request sent. Wait for approval.";

}


});

}




// ==========================================
// LOGIN
// ==========================================


const loginForm =
document.getElementById("loginForm");



if(loginForm){


loginForm.addEventListener("submit", async(e)=>{


e.preventDefault();



const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



const {data,error} =
await supabase.auth.signInWithPassword({

email,

password

});



if(error){

document.getElementById("message").textContent =
error.message;

return;

}



const user=data.user;



const {data:roles}=await supabase

.from("user_roles")

.select("role,approved")

.eq("user_id",user.id);



if(!roles || roles.length===0){

alert("No account role found");

return;

}



const role=roles[0];



if(role.approved===false){

alert("Account waiting for approval");

await supabase.auth.signOut();

return;

}




if(role.role==="student"){

window.location="student.html";

}



if(role.role==="admin" ||
role.role==="super_admin"){

window.location="admin.html";

}



});


}
