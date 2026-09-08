var $ = function (id) {
    return document.getElementById(id);
}

var calculatedCost = function () {
    var frontLength = parseFloat($("frontLength").value);
    var frontWidth = parseFloat($("frontWidth").value);

    var backLength = parseFloat($("backLength").value);
    var backWidth = parseFloat($("backWidth").value);

    var side1Length = parseFloat($("side1Length").value);
    var side1Width = parseFloat($("side1Width").value);

    var side2Length = parseFloat($("side2Length").value);
    var side2Width = parseFloat($("side2Width").value);


    if (isNaN(frontLength) || isNaN(frontWidth) || isNaN(backLength) || isNaN(backWidth) || isNaN(side1Length) || isNaN(side1Width) || isNaN(side2Length) || isNaN(side2Width)) {
        alert("There is a problem with the values you have entered.");
    } else {
        var total = ((frontLength * frontWidth) + (backLength * backWidth) + (side1Length * side1Width) + (side2Length * side2Width));

        total = total * .1;

        $("costTotal").value = "$ " + total;
    }
}

window.onload = function () {
    $("submit").onclick = calculatedCost;
}