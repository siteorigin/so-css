
/* globals jQuery, _, SPECIFICITY, window */

jQuery( function($){

    var inspector = $('#socss-inspector-hover');
    var socssInspect = window.socssInspec = {};

    socssInspect.hover = null;

    socssInspect.setHoverEl = function(el){
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

        socssInspect.hover = el;
    };

    var hoverStack = [];


    $('body').on('mouseover', '*', function(e){
        var $$ = $(this);
        if( $$.closest('.socss-element').length === 0 ) {
            e.stopPropagation();
            socssInspect.setHoverEl( $(this) );
        }
    });

    // Go through all the stylesheets on this page
    socssInspect.getCssSelectors = function(){
        var selectors = [];

        var stylesheet = null, ruleSpecificity;
        for( var i = 0; i < document.styleSheets.length; i++ ) {
            stylesheet = document.styleSheets[i];

            if( stylesheet.rules === null || ( stylesheet.href !== null && stylesheet.href.indexOf('so-css/css/inspector.css') !== -1 ) ) {
                // Skip anything without rules or the inspector css
                continue;
            }

            for( var j = 0; j < stylesheet.rules.length; j++ ) {
                if( typeof stylesheet.rules[j].selectorText === 'undefined' ) {
                    continue;
                }

                ruleSpecificity = SPECIFICITY.calculate( stylesheet.rules[j].selectorText );
                for( var k = 0; k < ruleSpecificity.length; k++ ) {
                    selectors.push( {
                        'selector' : ruleSpecificity[k].selector.trim(),
                        'specificity' : parseInt( ruleSpecificity[k].specificity.replace(/,/g, '') )
                    } );
                }
            }
        }

        selectors = _.uniq( selectors, false, function( a ){
            return a.selector;
        } );

        selectors.sort(function(a, b){
            return a.specificity > b.specificity ? -1 : 1;
        });

        return selectors;
    };
    socssInspect.pageSelectors = socssInspect.getCssSelectors();

    socssInspect.displaySelector = function( activeEl ){

        var dialog = $('#socss-selector-dialog').fadeIn('fast');

        var selectorsContainer = dialog.find('.socss-selectors');
        var parentsContainer = dialog.find('.socss-element-parents');

        var updateSelectors = function( activeEl, container ){
            var selectors = socssInspect.pageSelectors.filter( function(a){
                return activeEl.is( a.selector );
            } );

            container.empty();
            _.each( selectors, function(selector){
                container.append(
                    $('<li></li>')
                        .html( selector.selector )
                        .data( selector )
                        .click( function(e){
                            e.preventDefault();
                            if( typeof parent.window !== 'undefined' && typeof parent.window.socss !== 'undefined' ) {
                                parent.window.socss.mainEditor.addEmptySelector( $(this).data('selector') );
                            }
                        } )
                );
            } );

        };

        var updateParents = function( activeEl, container ){
            var cEl = activeEl, elName;
            container.empty();
            do{
                elName = cEl.prop('tagName').toLowerCase();
                if( cEl.attr('id') !== undefined ) {
                    elName += '#' + cEl.attr('id');
                }
                if( cEl.attr('class') !== undefined ) {
                    elName += '.' + cEl.attr('class').replace(/\s+/, '.');
                }

                container.prepend(
                    $('<li></li>')
                        .html( elName )
                        .data( 'el', cEl )
                        .mouseover(function(){
                            $(this).data('el').trigger('mouseover');
                        })
                        .click( function(){
                            var $$ = $(this);
                            updateSelectors( $$.data('el'), selectorsContainer );
                            updateParents( $$.data('el'), parentsContainer );
                        } )
                );
                cEl = cEl.parent();
            } while( cEl.parent().length !== 0 && cEl.prop('tagName') !== 'BODY' );
        }

        updateSelectors( activeEl, selectorsContainer );
        updateParents( activeEl, parentsContainer );

        // Now lets add the parents
    };

    $('body').addClass('no-inspector');
    $('body *').click(function( e ){

        if( !$('body').hasClass('no-inspector') && !$('#socss-selector-dialog').is(':visible') ) {
            e.preventDefault();
            e.stopPropagation();
            var $$ = $(this);
            $$.blur();
            socssInspect.displaySelector( socssInspect.hover );
        }
    });
    $('#socss-selector-dialog .socss-button-close').click( function(e){
        $('#socss-selector-dialog').fadeOut('fast');
    } );

    socssInspect.startInspector = function(){
        // This body class tells the inspector whether or not it should operate
        $('body').removeClass( 'no-inspector' );
    };

    socssInspect.stopInspector = function(){
        $('body').addClass( 'no-inspector' );
    };
} );