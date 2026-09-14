//debug message
//alert("Page Loaded");

var wordBank = ["WALKER", "BITER", "BLEEDER", "GHOUL", "ZED", "ZOMBIE", "GRINNER", "BLOATER", "LURKER", "CHOKER", "MUNCHER", "SLEEPER", "CRAWLER", "BANSHEE", "FIEND", "FREAK", "SPOOKER", "ZIMBABO"]

var wordBankRandomizer = Math.floor(Math.random() * 18);
var getWord            = wordBank[wordBankRandomizer];

var answerLength      = getWord.length;
var displayLength     = [answerLength];
var lettersInWord     = getWord.split('');
var attemptsRemaining = 10;

var output     = "";
var userLetter = "";

var winVariable = answerLength;

var setup = function () {
    //debug message
    //alert("Setup Function Loaded");

    for (var i = 0; i < answerLength; i++) {
        displayLength[i] = "_ ";
        output = output + displayLength[i];
    }
    document.getElementById("game").innerHTML = output;
    output = "";
}

var userInput = function () {
    //debug message
    //alert("User Input Function Loaded");

    var correctGuessCheck = false;

    output = "";
    userLetter = document.getElementById("letter").value;

    for (var i = 0; i < answerLength; i++) {
        if (userLetter.toUpperCase() == lettersInWord[i]) {
            displayLength[i] = userLetter.toUpperCase();
            winVariable--;

            correctGuessCheck = true;
        }
        output = output + displayLength[i] + " ";
    }

    document.getElementById("game").innerHTML = output;
    output = "";

    if (correctGuessCheck === false) {
        attemptsRemaining--;
        
        switch(attemptsRemaining) {
            case 9:
                document.getElementById("hangmanImage").src = "images/img01.png";
                break;
            case 8:
                document.getElementById("hangmanImage").src = "images/img02.png";
                break;
            case 7:
                document.getElementById("hangmanImage").src = "images/img03.png";
                break;
            case 6:
                document.getElementById("hangmanImage").src = "images/img04.png";
                break;
            case 5:
                document.getElementById("hangmanImage").src = "images/img05.png";
                break;
            case 4:
                document.getElementById("hangmanImage").src = "images/img06.png";
                break;
            case 3:
                document.getElementById("hangmanImage").src = "images/img07.png";
                break;
            case 2:
                document.getElementById("hangmanImage").src = "images/img08.png";
                break;
            case 1:
                document.getElementById("hangmanImage").src = "images/img09.png";
                break;
            case 0:
                document.getElementById("hangmanImage").src = "images/img10.png";
                break;    
            default:
                break;
        }
        
    }

    correctGuessCheck = false;
    
    if (winVariable < 1) {
        document.getElementById("guessesRemaining").innerHTML = "You win.";
    } else if (attemptsRemaining < 1) {
        document.getElementById("guessesRemaining").innerHTML = "You lose.";
    } else {
        document.getElementById("guessesRemaining").innerHTML = "There are <strong>" + attemptsRemaining + "</strong> attempts remaining.";
    }
}

//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");

    setup();
    document.getElementById("submit").onclick = userInput;
}