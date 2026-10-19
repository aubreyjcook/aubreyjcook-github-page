//debug message
//alert("Page Loaded");


var timer;
var image = new Image();
var currentSlide = 0;


var imageArray = ["images/picture01.jpg", "images/picture02.jpg", "images/picture03.jpg", "images/picture04.jpg", "images/picture05.jpg", "images/picture06.jpg", "images/picture07.jpg", "images/picture08.jpg", "images/picture09.jpg", "images/picture10.jpg", "images/picture11.jpg"];

//debug message
//alert("Variables Loaded");

var count = imageArray.length;

var imageArrayPreload = function () {
    for (var i = 0; i < count; i++) {
        image.src = imageArray[i];
        imageArray.push(image);
    }
}

var activateSlideShow = function () {
    var path = document.getElementById("activateButton").innerHTML;
    var testState = new RegExp("Start");


    if (testState.test(path)) {
        document.getElementById("activateButton").innerHTML = "Stop";
        slideShowActive();
    } else {
        document.getElementById("activateButton").innerHTML = "Start";
        clearTimeout(timer);
    }
}

var slideShowActive = function () {
    if (currentSlide > 11) {
        currentSlide = 0;
    }

    document.getElementById("slideShowImage").src = imageArray[currentSlide];

    currentSlide++;
    timer = setTimeout(slideShowActive, 5000);
}

//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");

    imageArrayPreload();
}