function displayAlert() {
    alert("An event activated this alert.")
}

function hiddenText() {
    document.getElementById("hiddenMessage").value = "Spooky Secret Text";
}

function focusField(x) {
    x.style.background = "yellow";
}

function blurField(x) {
    x.style.background = "white";
}

function imageSwapEnter() {
    document.getElementById("imageSwap").src = "images/picture02.jpg";
}

function imageSwapExit() {
    document.getElementById("imageSwap").src = "images/picture01.jpg";
}

function dragStart(event) {
    event.dataTransfer.setData("Text", event.target.id);
}

function dragging(event) {
    document.getElementById("dragStatusText").innerHTML = "The p element is being dragged";
}

function allowDrop(event) {
    event.preventDefault();
}

function drop(event) {
    event.preventDefault();
    var data = event.dataTransfer.getData("Text");
    event.target.appendChild(document.getElementById(data));
    document.getElementById("dragStatusText").innerHTML = "The p element was dropped";
}