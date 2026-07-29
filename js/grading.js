// ==========================================
// GRADE HUB - CBC GRADING SYSTEM
// ==========================================


// ==========================================
// GET CBC ACHIEVEMENT LEVEL
// ==========================================

export function getGrade(mark) {

    mark = Number(mark);


    if (mark >= 90 && mark <= 100) {

        return "EE1";

    }


    else if (mark >= 80) {

        return "EE2";

    }


    else if (mark >= 70) {

        return "ME1";

    }


    else if (mark >= 60) {

        return "ME2";

    }


    else if (mark >= 50) {

        return "AE1";

    }


    else if (mark >= 40) {

        return "AE2";

    }


    else if (mark >= 30) {

        return "BE1";

    }


    else {

        return "BE2";

    }

}





// ==========================================
// GET GRADE DESCRIPTION
// ==========================================

export function getGradeDescription(level) {


    switch(level) {


        case "EE1":

            return "Exceeding Expectation Level 1";


        case "EE2":

            return "Exceeding Expectation Level 2";


        case "ME1":

            return "Meeting Expectation Level 1";


        case "ME2":

            return "Meeting Expectation Level 2";


        case "AE1":

            return "Approaching Expectation Level 1";


        case "AE2":

            return "Approaching Expectation Level 2";


        case "BE1":

            return "Below Expectation Level 1";


        case "BE2":

            return "Below Expectation Level 2";


        default:

            return "Not Available";


    }

}





// ==========================================
// CALCULATE AVERAGE MARK
// ==========================================

export function calculateAverage(results) {


    if (!results || results.length === 0) {

        return 0;

    }


    let total = 0;


    results.forEach(result => {

        total += Number(result.marks);

    });



    return Math.round(
        total / results.length
    );


}





// ==========================================
// CALCULATE TOTAL MARKS
// ==========================================

export function calculateTotal(results) {


    let total = 0;


    results.forEach(result => {

        total += Number(result.marks);

    });


    return total;

}





// ==========================================
// GET OVERALL CBC LEVEL
// ==========================================

export function getOverallLevel(results) {


    const average = calculateAverage(results);


    return getGrade(average);


}





// ==========================================
// CHECK SUBJECT STATUS
// ==========================================

export function getStatus(mark) {


    const grade = getGrade(mark);



    if(
        grade === "EE1" ||
        grade === "EE2"
    ){

        return "Excellent";

    }


    if(
        grade === "ME1" ||
        grade === "ME2"
    ){

        return "Good";

    }


    if(
        grade === "AE1" ||
        grade === "AE2"
    ){

        return "Needs Improvement";

    }


    return "Requires Support";


}
