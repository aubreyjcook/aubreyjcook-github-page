//debug message
//alert("Page Loaded");
"use strict";

function checkFirst() {
    var firstName = document.getElementById("first").value;
    var testName = new RegExp("^[a-zA-z]+$");
    if (!testName.test(firstName)) {
        document.getElementById("errorMessage").innerHTML = "Please include only text and spaces";
        document.getElementById("first").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "First name information entered correctly";
    }
}

function checkLast() {
    var firstName = document.getElementById("last").value;
    var testName = new RegExp("^[a-zA-z]+$");
    if (!testName.test(lastName)) {
        document.getElementById("errorMessage").innerHTML = "Please include only text and spaces";
        document.getElementById("last").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Last name information entered correctly";
    }
}

function checkHome() {
    var phone = document.getElementById("home").value
    var testPhone = new RegExp("^[/(]{1}[0-9]{3}[\)]{1}[ ]{1}[0-9]{3}[\-]{1}[0-9]{4})$");
    if(!testPhone.test(phone)) {
        document.getElementById("errorMessage").innerHTML = "Please include numbers in this format: (800) 455-5555";
        document.getElementById("home").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Home Phone information entered correctly";
    }
}

function checkCell() {
    var phone = document.getElementById("cell").value
    var testPhone = new RegExp("^[/(]{1}[0-9]{3}[\)]{1}[ ]{1}[0-9]{3}[\-]{1}[0-9]{4})$");
    if(!testPhone.test(phone)) {
        document.getElementById("errorMessage").innerHTML = "Please include numbers in this format: (800) 455-5555";
        document.getElementById("cell").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Cell Phone information entered correctly";
    }
}

function checkEmail() {
    var myEmail = document.getElementById("email").value
    var testEmail = new RegExp(".+\@.+\..+");
    if(!testEmail.test(myEmail)) {
        document.getElementById("errorMessage").innerHTML = "Please express your email using @ and the domain name for your email service.";
        document.getElementById("email").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Email information entered correctly.";
    }
}

function checkAddress() {
    var myAddress = document.getElementById("address").value
    var testAddress = new RegExp("^[a-zA-z]+$");
    if(!testAddress.test(myAddress)) {
        document.getElementById("errorMessage").innerHTML = "Please include only text and spaces";
        document.getElementById("address").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Address information entered correctly.";
    }
}

function checkCity() {
    var myCity = document.getElementById("city").value
    var testCity = new RegExp("^[a-zA-z]+$");
    if(!testCity.test(myCity)) {
        document.getElementById("errorMessage").innerHTML = "Please include only text and spaces";
        document.getElementById("city").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "City information entered correctly.";
    }
}

function checkState() {
    var myState = document.getElementById("state").value
    var testState = new RegExp("^[a-zA-z]+$");
    if(!testState.test(myState)) {
        document.getElementById("errorMessage").innerHTML = "Please include only text and spaces";
        document.getElementById("state").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "State information entered correctly.";
    }
}

function checkZip() {
    var myZip = document.getElementById("zip").value
    var testZip = new RegExp("^\d{5}$");
    if(!testZip.test(myZip)) {
        document.getElementById("errorMessage").innerHTML = "Please indicate zip in US format.";
        document.getElementById("zip").value = "";
    } else {
        document.getElementById("errorMessage").innerHTML = "Zip code entered correctly.";
    }
}