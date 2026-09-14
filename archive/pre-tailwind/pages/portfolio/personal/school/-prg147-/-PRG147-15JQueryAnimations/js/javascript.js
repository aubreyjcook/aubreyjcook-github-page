$(document).ready(function () {
    "use strict";
    var nextSlide = $("#slides image:first-child");
    var nextSlideSource;

    var runSlideShow = function () {
        $("#caption").fadeOut(2000);
        $("#slide").animate({
                height: "0px",
                width: "0px"
            }, 'slow',
            function () {
                if (nextSlide.next().length === 0) {
                    nextSlide = $("#slides img:first-child");
                } else {
                    nextSlide = nextSlide.next();
                }
                nextSlideSource = nextSlide.attr("src");
                $("#slide").attr("src", nextSlideSource).animate({
                    height: "488px", width: "488px"
                });
        });

}

    var timer1 = setInterval (runSlideShow, 4000);
    
    $("#slide").click(function(){
       if(timer1 !== null){
           clearInterval(timer1);
           timer1 = null;
       } else {
           timer1 = setInterval(runSlideShow, 3000);
       }
    });
    
});