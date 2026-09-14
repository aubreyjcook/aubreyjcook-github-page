$(document).ready(function(){
    
    $('#send').click(function(){
        var toAdd = $('input[name=checkListItem]').val();
        $('#list').append('<div class="item">' + toAdd + '</div>');
        $("input[type=text], textarea").val("");
        });
    
    $('#reset').click(function(){
        $("input[type=text], textarea").val("");
        });
        
        $(document).on('click', '.item', function(){
            this.remove();
            });
    });