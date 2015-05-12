
/* globals jQuery */

jQuery( function($){

    var inspector = $('#socss-inspector-hover');
    var hoverEl = null;
    var setHoverEl = function(el){
        inspector
            .css({
                'top' : el.offset().top - 1,
                'left' : el.offset().left - 1,
                'width' : el.outerWidth(),
                'height' : el.outerHeight()
            })
            .show();

        var elPadding = el.padding();
        var elMargin = el.padding();

        hoverEl = el;
    };

    var hoverStack = [];

    $('body *')
        .mouseover(function(e) {
            e.stopPropagation();
            setHoverEl( $(this) );
        })
        .mouseout(function(e) {
            e.stopPropagation();
        });


    $('body').addClass('no-inspector');
    $('body *').click(function( e ){
        if( !$('body').hasClass('no-inspector') ) {
            e.preventDefault();
            e.stopPropagation();
            var $$ = $(this);
            $$.blur();
            console.log('Display inspector dropdown');
        }
    })

    window.setSelectors = function( selectors ){

    };

    window.startInspector = function(){
        $('body').removeClass( 'no-inspector' );
    };

    window.stopInspector = function(){
        $('body').addClass( 'no-inspector' );
    };
} );