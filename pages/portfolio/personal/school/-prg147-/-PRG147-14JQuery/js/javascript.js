function animationLoop() {
    $("#timeToggle").animate({
        fontSize: "3em"
    }, 500);
    $("#timeToggle").animate({
        fontSize: "1em"
    }, 500);
    animationLoop();
}

$(document).ready(function () {
    $("#timeToggle").hide();
    $("#timeButton").click(function () {
        $("#timeToggle").toggle();
    });
    
    animationLoop();
});

function startTime() {
    var today = new Date();
    var h = today.getHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    m = checkTime(m);
    s = checkTime(s);
    document.getElementById('timeToggle').innerHTML = h + ":" + m + ":" + s;
    var t = setTimeout(startTime, 500);
}

function checkTime(i) {
    if (i < 10) {
        i = "0" + i
    };
    return i;
}

window.onload = function () {
    startTime();
}