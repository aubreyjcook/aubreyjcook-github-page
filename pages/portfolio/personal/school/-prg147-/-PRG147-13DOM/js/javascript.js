window.onload = function () {
    "use strict";

    var panelsContainer = document.getElementById("panelsContainer");
    var h2Elements = panelsContainer.getElementsByTagName("h2");
    var h2Node;

    for (var i = 0; i < h2Elements.length; i++) {
        h2Node = h2Elements[i];

        h2Node.onclick = function () {
            var h2 = this;
            if (h2.getAttribute("class") === "open") {
                if (h2.getAttribute("id") === "one") {
                    document.getElementById("i-one").innerHTML = "remove";
                } else if (h2.getAttribute("id") === "two") {
                    document.getElementById("i-two").innerHTML = "remove";
                } else if (h2.getAttribute("id") === "three") {
                    document.getElementById("i-three").innerHTML = "remove";
                } else if (h2.getAttribute("id") === "four") {
                    document.getElementById("i-four").innerHTML = "remove";
                } else if (h2.getAttribute("id") === "five") {
                    document.getElementById("i-five").innerHTML = "remove";
                } else if (h2.getAttribute("id") === "six") {
                    document.getElementById("i-six").innerHTML = "remove";
                }

                h2.setAttribute("class", "close");
            } else {
                h2.setAttribute("class", "open");

                if (h2.getAttribute("id") === "one") {
                    document.getElementById("i-one").innerHTML = "add";
                } else if (h2.getAttribute("id") === "two") {
                    document.getElementById("i-two").innerHTML = "add";
                } else if (h2.getAttribute("id") === "three") {
                    document.getElementById("i-three").innerHTML = "add";
                } else if (h2.getAttribute("id") === "four") {
                    document.getElementById("i-four").innerHTML = "add";
                } else if (h2.getAttribute("id") === "five") {
                    document.getElementById("i-five").innerHTML = "add";
                } else if (h2.getAttribute("id") === "six") {
                    document.getElementById("i-six").innerHTML = "add";
                }

            }

            if (h2.nextElementSibling.getAttribute("class") === "close") {
                h2.nextElementSibling.setAttribute("class", "open");
            } else {
                h2.nextElementSibling.setAttribute("class", "close")
            }

        }
    }
}