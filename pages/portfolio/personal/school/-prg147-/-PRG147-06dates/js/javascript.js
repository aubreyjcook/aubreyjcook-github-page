//debug message
//alert("Page Loaded");

//day of the week display message
function getCurrentDay() {

    var currentDay = new Date();
    var dayOfWeek  = currentDay.getDay();

    switch (dayOfWeek) {
    case 0:
    case 6:
        document.getElementById("currentDay").innerHTML = "It's the weekend.";
        break;
    case 1:
        document.getElementById("currentDay").innerHTML = "The current day is: " + "Monday.";
        break;
    case 2:
        document.getElementById("currentDay").innerHTML = "The current day is: " + "Tuesday.";
        break;
    case 3:
        document.getElementById("currentDay").innerHTML = "The current day is: " + "Wednesday.";
        break;
    case 4:
        document.getElementById("currentDay").innerHTML = "The current day is: " + "Thursday.";
        break;
    case 5:
        document.getElementById("currentDay").innerHTML = "The current day is: " + "Friday.";
        break;

    default:
        document.getElementById("currentDay").innerHTML = "Something went wrong in loading the current date.";
        break;
    }
}

//days until graduation display message
function getDaysUntilGraduation() {
    //debug message
    //alert("getDaysUntilGraduation function loaded");

    var currentDay    = new Date();
    var graduationDay = new Date("12/28/2016");

    var differenceDays = Math.abs((graduationDay.getTime() - currentDay.getTime()) / (1000 * 3600 * 24));
    differenceDays     = Math.round(differenceDays);

    document.getElementById("gradCount").innerHTML = differenceDays;
}

//days since 26/06/2006 display message
function getDaysSinceGraduation() {
    //debug message
    //alert("getDaysSinceGraduation function loaded");
    
    var currentDay = new Date();
    var day        = currentDay.getDate();
    var month      = currentDay.getMonth() + 1;
    var year       = currentDay.getFullYear();
    var monthCount = 0;
    var yearCount  = 0;

    var monthOnDate = 06;
    var yearOnDate  = 2006;

    if (monthOnDate > month) {
        yearCount  = year - yearOnDate  - 1;
        monthCount = 12   - monthOnDate + month;
    }
    
    else {
        yearCount  = year  - yearOnDate;
        monthCount = month - monthOnDate;
    }
    
    document.getElementById("daysSinceGraduation").innerHTML = "It's been <strong>" + yearCount + "</strong> <em>years</em> and <strong>" + monthCount + "</strong> <em>months.</em>";
}

//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");

    getCurrentDay();
    getDaysUntilGraduation();
    getDaysSinceGraduation();
}