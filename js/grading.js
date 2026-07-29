// ==========================================
// GRADE HUB - CBC GRADING SYSTEM
// ==========================================


// Get CBC achievement level

export function getGrade(mark){


    mark = Number(mark);



    if(mark >= 90){

        return "EE1";

    }


    else if(mark >= 80){

        return "EE2";

    }


    else if(mark >= 70){

        return "ME1";

    }


    else if(mark >= 60){

        return "ME2";

    }


    else if(mark >= 50){

        return "AE1";

    }


    else if(mark >= 40){

        return "AE2";

    }


    else if(mark >= 30){

        return "BE1";

    }


    else{

        return "BE2";

    }


}





// Calculate mean score

export function calculateAverage(results){


    if(results.length === 0){

        return 0;

    }



    let total = 0;



    results.forEach(result=>{

        total += Number(result.marks);

    });



    return Math.round(
        total / results.length
    );


}





// Get overall CBC level

export function getOverallLevel(average){


    return getGrade(average);


}
