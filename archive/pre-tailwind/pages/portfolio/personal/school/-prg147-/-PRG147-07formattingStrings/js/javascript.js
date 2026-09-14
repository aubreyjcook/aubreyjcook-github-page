//debug message
//alert("Page Loaded");

//writes a text block to the paragraph id
function writeToParagraph() {
    //debug message
    //alert("writeToParagraph Loaded");
    
    document.getElementById("paragraph").innerHTML = "\tAkira Kurosawa was a Japanese filmmaker active during the 1950s.\n\n\tAkira is famous for many of his films, chief among them being \"Yojimbo\", \"Seven Samurai\", and \"The Hidden Fortress.\" These films served as an inspiration for other filmmakers such as Sergio Leone\\George Lucas.\n\n\tThe film \"Yojimbo\" and it\'s sequel \"Sanjuro\" served as direct inspiration for Sergio\'s \"A Fistful of Dollars\" and George Lucas has described the characters R2-D2 and C3-PO as being inspired by the two greedy peasants starred in \"The Hidden Fortress\"";
    
}


//function runtime at page load
window.onload = function () {
    //debug message
    //alert("Functions Loaded");
    
    writeToParagraph();
}