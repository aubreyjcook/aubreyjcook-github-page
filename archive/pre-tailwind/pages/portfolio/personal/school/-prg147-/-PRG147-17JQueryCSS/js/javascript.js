$(document).ready(function(){
    
    //function for using the revert button to reset the page styling
    $('#revert').click(function(){
        $('#red').removeClass("redClass");
        $('#green').removeClass("greenClass");
        $('#blue').removeClass("blueClass");
        $('#gradient').removeClass("gradientClass");
        $('#marxText').removeClass("hiddenText");
        $('#marxHeader').removeClass("hiddenText");
        $('#smithText').addClass("hiddenText");
        $('#smithHeader').addClass("hiddenText");
    });
    
    $('#red').click(function(){
        $(this).toggleClass("redClass");
    });
    
    $('#green').click(function(){
        $(this).toggleClass("greenClass");
    });
    
    $('#blue').click(function(){
        $(this).toggleClass("blueClass");
    });
    
    $('#gradient').click(function(){
        $(this).toggleClass("gradientClass");
    });
    
    $('#marxText').click(function(){
        $(this).toggleClass("hiddenText");
        $('#marxHeader').toggleClass("hiddenText");
        $('#smithHeader').toggleClass("hiddenText");
        $('#smithText').toggleClass("hiddenText");
    });
    
    $('#smithText').click(function(){
        $(this).toggleClass("hiddenText");
        $('#marxHeader').toggleClass("hiddenText");
        $('#smithHeader').toggleClass("hiddenText");
        $('#marxText').toggleClass("hiddenText");
    });
    
    $('#selfDestruct').click(function(){
        $('*').addClass("selfDestructClass");
    });
});