//debug message
//alert("Page Loaded");

var i = 0;
var centerThumb = 0;
var leftThumb = 18;
var rightThumb = 1;
var image = new Image();
var image02 = new Image();

var thumbnailsArray = ["images/thumbnails/thumbnail01.jpg", "images/thumbnails/thumbnail02.jpg", "images/thumbnails/thumbnail03.jpg", "images/thumbnails/thumbnail04.jpg", "images/thumbnails/thumbnail05.jpg", "images/thumbnails/thumbnail06.jpg", "images/thumbnails/thumbnail07.jpg", "images/thumbnails/thumbnail08.jpg", "images/thumbnails/thumbnail09.jpg", "images/thumbnails/thumbnail10.jpg", "images/thumbnails/thumbnail11.jpg", "images/thumbnails/thumbnail12.jpg", "images/thumbnails/thumbnail13.jpg", "images/thumbnails/thumbnail14.jpg", "images/thumbnails/thumbnail15.jpg", "images/thumbnails/thumbnail16.jpg", "images/thumbnails/thumbnail17.jpg", "images/thumbnails/thumbnail18.jpg", "images/thumbnails/thumbnail19.jpg", ];
var imageArray = ["images/picture01.jpg", "images/picture02.jpg", "images/picture03.jpg", "images/picture04.jpg", "images/picture05.jpg", "images/picture06.jpg", "images/picture07.jpg", "images/picture08.jpg", "images/picture09.jpg", "images/picture10.jpg", "images/picture11.jpg", "images/picture12.jpg", "images/picture13.jpg", "images/picture14.jpg", "images/picture15.jpg", "images/picture16.jpg", "images/picture17.jpg", "images/picture18.jpg", "images/picture19.jpg", ];
var titlesArray = ["Rabbit", "Bird", "Path", "Dragonfly", "Dragonfly on log", "Pond", "Toad", "Geese", "Butterfly", "Field", "Sunset", "Chipmunk", "Tank", "Feeding Bird", "Morning Bird", "Forest", "Forest Sunray", "Graveyard", "Groundhog", ];
var descriptionsArray = ["Rabbit in the morning", "Small brown bird on a fence", "Meadow path", "Dragonfly landing on a plant", "White dragonfly resting on a log", "Pond in a park", "Large brown toad", "Geese crowding around a pond", "Butterfly amidst blue flowers", "Field near sundown", "Sun setting behind trees", "Alert chipmunk", "Old abandoned watertank", "Bird feeding on a worm", "Bird in a morning field", "Forest early in the day", "Sunray breaking through the forest", "Graveyard in the early morning", "Groundhog perched in a tree", ];

var count = thumbnailsArray.length;

function preload() {
    "use strict";
    for (var i = 0; i < count; i++) {
        image.src = thumbnailsArray[i];
        image02.src = imageArray[i];
        thumbnailsArray.push(image);
        imageArray.push(image02);
    }
}

function changeThumbNext() {
    "use strict";
    centerThumb++;
    if (centerThumb === count) {
        centerThumb = 0;
    }
    if (centerThumb >= 0) {
        document.getElementById("center").src = thumbnailsArray[centerThumb];
    } else if (centerThumb < 0) {
        document.getElementById("center").src = thumbnailsArray[19 - Math.abs(centerThumb)];
    }

    leftThumb++
    if (leftThumb === count) {
        leftThumb = 0;
    }
    if (leftThumb >= 0) {
        document.getElementById("left").src = thumbnailsArray[leftThumb];
    } else {
        document.getElementById("left").src = thumbnailsArray[19 - Math.abs(leftThumb)];
    }

    rightThumb++;
    if (rightThumb === count) {
        rightThumb = 0;
    }
    if (rightThumb >= 0) {
        document.getElementById("right").src = thumbnailsArray[rightThumb];
    } else if (rightThumb < 0) {
        document.getElementById("right").src = thumbnailsArray[19 - Math.abs(rightThumb)];
    }
}

function changeThumbPrev() {
    "use strict";
    centerThumb--;
    if (Math.abs(centerThumb) === count) {
        centerThumb = 0;
    }
    if (centerThumb < 0) {
        document.getElementById("center").src = thumbnailsArray[19 + centerThumb];
    } else {
        document.getElementById("center").src = thumbnailsArray[centerThumb];
    }

    leftThumb--
    if (Math.abs(leftThumb) === count) {
        leftThumb = 0;
    }
    if (leftThumb >= 0) {
        document.getElementById("left").src = thumbnailsArray[Math.abs(leftThumb)];
    } else {
        document.getElementById("left").src = thumbnailsArray[19 - Math.abs(leftThumb)];
    }

    rightThumb--;
    if (Math.abs(rightThumb) === count) {
        rightThumb = 0;
    }
    if (rightThumb >= 0) {
        document.getElementById("right").src = thumbnailsArray[rightThumb];
    } else if (rightThumb < 0) {
        document.getElementById("right").src = thumbnailsArray[19 - Math.abs(rightThumb)];
    }
}

function leftButton() {
    "use strict";
    if (leftThumb >= 0) {
        document.getElementById("mainImage").src = imageArray[leftThumb];
        document.getElementById("title").innerHTML = titlesArray[leftThumb];
        document.getElementById("description").innerHTML = descriptionsArray[leftThumb];
    } else {
        document.getElementById("mainImage").src = imageArray[19 - Math.abs(leftThumb)];
        document.getElementById("title").innerHTML = titlesArray[19 - Math.abs(leftThumb)];
        document.getElementById("description").innerHTML = descriptionsArray[19 - Math.abs(leftThumb)];
    }
}

function rightButton() {
    "use strict";
    if (rightThumb >= 0) {
        document.getElementById("mainImage").src = imageArray[rightThumb];
        document.getElementById("title").innerHTML = titlesArray[rightThumb];
        document.getElementById("description").innerHTML = descriptionsArray[rightThumb];
    } else {
        document.getElementById("mainImage").src = imageArray[19 - Math.abs(rightThumb)];
        document.getElementById("title").innerHTML = titlesArray[19 - Math.abs(rightThumb)];
        document.getElementById("description").innerHTML = descriptionsArray[19 - Math.abs(rightThumb)];
    }
}

function centerButton() {
    "use strict";
    if (rightThumb >= 0) {
        document.getElementById("mainImage").src = imageArray[centerThumb];
        document.getElementById("title").innerHTML = titlesArray[centerThumb];
        document.getElementById("description").innerHTML = descriptionsArray[centerThumb];
    } else {
        document.getElementById("mainImage").src = imageArray[19 - Math.abs(centerThumb)];
        document.getElementById("title").innerHTML = titlesArray[19 - Math.abs(centerThumb)];
        document.getElementById("description").innerHTML = descriptionsArray[19 - Math.abs(centerThumb)];
    }
}

//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");

    "use strict";
    preload();
}