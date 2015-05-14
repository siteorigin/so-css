
/* globals jQuery, _, SPECIFICITY, window, console */

jQuery( function($){

    var socssInspect = {

        highlight: $('#socss-inspector-hover').html(),
        hover : null,
        pageSelectors: null,

        /**
         * Should we be using mouse inspection
         */
        mouseInspection: false,

        /**
         * Initialize the main inspector.
         */
        initialize: function(){
            var thisInspector = this;

            this.pageSelectors = this.getCssSelectors();

            // Inform the parent frame of the selectors we have
            try {
                parent.socss.mainEditor.registerSelectors( this.pageSelectors );
            }
            catch(err) {
                console.log( "Can't register selectors" );
            }

            // Setup hovering
            $('body').on('mouseover', '*', function(e){
                if( !thisInspector.mouseInspection ) {
                    return true;
                }

                var $$ = $(this);
                if( $$.closest('.socss-element').length === 0 ) {
                    e.stopPropagation();
                    thisInspector.setHoverEl( $(this) );
                }
            });

            // Setup the click event
            $('body *').click(function( e ){
                if( !thisInspector.mouseInspection ) {
                    return true;
                }

                if( !$('body').hasClass('no-inspector') && !$('#socss-selector-dialog').is(':visible') ) {
                    e.preventDefault();
                    e.stopPropagation();
                    var $$ = $(this);
                    $$.blur();
                    thisInspector.selectorDialog.setActive( thisInspector.hover).show();
                }
            });

            // Initialize the selector dialog
            this.selectorDialog.initialize();
        },

        /**
         * Set the element that we're currently hovering over.
         *
         * @param el
         */
        setHoverEl: function(el){
            this.highlighter.highlight( el, true );
            this.hover = el;
        },

        /**
         * Return the selectors used by this page, ordered by specificity.
         *
         * @return {Array}
         */
        getCssSelectors: function(){
            var selectors = [];

            if( !this.browserSupportsStylesheets() ) {
                var stylesheet = null, ruleSpecificity;
                for (var i = 0; i < document.styleSheets.length; i++) {
                    stylesheet = document.styleSheets[i];

                    if (stylesheet.rules === null || ( stylesheet.href !== null && stylesheet.href.indexOf('so-css/css/inspector.css') !== -1 )) {
                        // Skip anything without rules or the inspector css
                        continue;
                    }

                    for (var j = 0; j < stylesheet.rules.length; j++) {
                        if (typeof stylesheet.rules[j].selectorText === 'undefined') {
                            continue;
                        }

                        ruleSpecificity = SPECIFICITY.calculate(stylesheet.rules[j].selectorText);
                        for (var k = 0; k < ruleSpecificity.length; k++) {
                            selectors.push({
                                'selector': ruleSpecificity[k].selector.trim(),
                                'specificity': parseInt(ruleSpecificity[k].specificity.replace(/,/g, ''))
                            });
                        }
                    }
                }
            }

            // Also add selectors for all the elements in the
            $('body *').each(function(){
                var $$ = $(this);
                var elName = '';
                if( $$.attr('id') !== undefined ) {
                    elName += '#' + $$.attr('id');
                }
                if( $$.attr('class') !== undefined ) {
                    elName += '.' + $$.attr('class').replace(/\s+/, '.');
                }

                if( elName === '' ) {
                    elName = $$.prop('tagName').toLowerCase();
                }

                var ruleSpecificity = SPECIFICITY.calculate( elName );
                for (var k = 0; k < ruleSpecificity.length; k++) {
                    selectors.push({
                        'selector': ruleSpecificity[k].selector.trim(),
                        'specificity': parseInt(ruleSpecificity[k].specificity.replace(/,/g, ''))
                    });
                }
            });

            selectors = _.uniq( selectors, false, function( a ){
                return a.selector;
            } );

            selectors.sort(function(a, b){
                return a.specificity > b.specificity ? -1 : 1;
            });

            return selectors;
        },

        /**
         * Start the hover inspector
         */
        startInspector: function(){
            // This body class tells the inspector whether or not it should operate
            this.mouseInspection = true;
        },

        /**
         * Stop the hover inspector
         */
        stopInspector: function(){
            this.mouseInspection = false;
            this.highlighter.clearAll();
        },

        /**
         * A check to see if the browser has support for stylesheets.
         *
         * @return {boolean}
         */
        browserSupportsStylesheets: function(){
            return !!document.styleSheets;
        },

        /**
         * Handles highlighting elements
         */
        highlighter: {
            hlTemplate: _.template( $('#socss-template-hover').html().trim() ),
            highlighted: [],

            highlight: function( els, guides ){
                this.clearAll();
                var parent = this;

                $(els).each(function(i, el){
                    el = $(el);

                    if( !el.is(':visible') ) {
                        // Skip over invisible elements
                        return true;
                    }

                    var hl = $( parent.hlTemplate() );
                    hl.css({
                        'top' : el.offset().top,
                        'left' : el.offset().left,
                        'width' : el.outerWidth(),
                        'height' : el.outerHeight()
                    }).appendTo( 'body' );

                    if( guides ) {
                        var g;

                        var padding = el.padding();
                        for( var k in padding ) {
                            if( parseInt( padding[k] ) > 0 ) {
                                g = hl.find('.socss-guide-padding.socss-guide-' + k).show();
                                if( k === 'top' || k === 'bottom' ) {
                                    g.css('height', padding[k]);
                                }
                            }
                        }

                        var margin = el.margin();
                        for( var k in margin ) {
                            if( parseInt( margin[k] ) > 0 ) {
                                g = hl.find('.socss-guide-margin.socss-guide-' + k).show();
                                if( k === 'top' || k === 'bottom' ) {
                                    g.css('height', margin[k]);
                                }
                            }
                        }

                    }

                    parent.highlighted.push( hl );
                } );
            },

            clearAll: function(){
                while( this.highlighted.length ) {
                    this.highlighted.pop().remove();
                }
            }
        },

        /**
         * Handles the dialog
         */
        selectorDialog: {
            dialogTemplate: _.template( $('#socss-template-selector-dialog').html().trim() ),
            selectorTemplate: _.template( '<li><%= selector %></li>' ),

            /**
             * The dialog jQuery element
             */
            dialog: null,

            initialize: function(){
                var thisDialog = this;
                this.dialog = $( this.dialogTemplate() );
                this.dialog.hide().appendTo('body');

                this.dialog.find('.socss-button-close').click(function(){
                    thisDialog.hide();
                });

                return this;
            },

            setActive: function( activeEl ){
                this.updateSelectors( activeEl );
                this.updateParents( activeEl );
                return this;
            },

            show: function(){
                this.dialog.show();
                return this;
            },

            hide: function(){
                this.dialog.hide();
                return this;
            },

            /**
             * Change the selectors so they represent the given Element
             * @param el
             */
            updateSelectors: function( activeEl ){
                var selectors = socssInspect.pageSelectors.filter( function(a){
                    return activeEl.is( a.selector );
                } );

                var container = this.dialog.find('.socss-selectors').empty();
                var thisDialog = this;

                _.each( selectors, function(selector){
                    container.append(
                        $( thisDialog.selectorTemplate(selector) )
                            .data( selector )
                            .click( function(e){
                                e.preventDefault();
                                if( typeof parent.window !== 'undefined' && typeof parent.window.socss !== 'undefined' ) {
                                    parent.window.socss.mainEditor.addEmptySelector( $(this).data('selector') );
                                }
                            } )
                    );
                } );

                return this;
            },

            updateParents: function( activeEl ){
                var container = this.dialog.find('.socss-element-parents').empty();
                var thisDialog = this;

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
                        $( thisDialog.selectorTemplate( { selector: elName } ) )
                            .data( 'el', cEl )
                            .mouseover(function(){
                                $(this).data('el').trigger('mouseover');
                            })
                            .click( function(){
                                var $$ = $(this);
                                thisDialog.updateSelectors( $$.data('el') );
                                thisDialog.updateParents( $$.data('el') );
                            } )
                    );
                    cEl = cEl.parent();
                } while( cEl.parent().length !== 0 && cEl.prop('tagName') !== 'BODY' );

                return this;
            }

        }

    };
    window.socssInspect = socssInspect;

    // Initialize the inspector
    socssInspect.initialize();

    $('#socss-selector-dialog .socss-button-close').click( function(e){
        $('#socss-selector-dialog').fadeOut('fast');
    } );

} );