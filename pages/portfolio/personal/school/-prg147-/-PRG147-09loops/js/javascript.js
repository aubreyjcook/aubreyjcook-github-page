//debug message
//alert("Page Loaded");

var repeatingLoop = function() {
    var bottleCount = 99;
    var loopDisplay = ""
    
    while (bottleCount != 0) {
        
        loopDisplay = loopDisplay + bottleCount + " bottles of beer on the wall take one down pass it around " + (bottleCount - 1) + " bottles of beer on the wall<br/>"
        
        document.getElementById("loop").innerHTML = loopDisplay;
        bottleCount--;
    }
}

//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");
    
    repeatingLoop();
}