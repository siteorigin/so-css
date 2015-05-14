
/* globals jQuery, Backbone, _, socssOptions */

( function( $, _, socssOptions ){

    var socss = {
        model : { },
        collection : { },
        view : { },
        fn : {}
    };

    /**
     * This is the main view for the app
     */
    socss.view.inspector = Backbone.View.extend( {

        active: false,
        hl: false,
        hoverEl: false,

        selectorTemplate: _.template('<div class="socss-selector"><%= selector %></div>'),

        initialize: function(){
            var thisView = this;

            this.hl = new socss.view.highlighter();
            this.hl.initialize();

            this.pageSelectors = socss.fn.pageSelectors();

            // Setup hovering
            $('body').on('mouseover', '*', function(e){
                if( !thisView.active ) {
                    return true;
                }

                var $$ = $(this);
                if( $$.closest('.socss-element').length === 0 ) {
                    e.stopPropagation();
                    thisView.setHoverEl( $(this) );
                }
            });

            // Setup the click event
            $('body *').click(function( e ){
                if( !thisView.active || thisView.$el.is(':hover') ) {
                    return true;
                }

                e.preventDefault();
                e.stopPropagation();
                var $$ = $(this);
                $$.blur();
                thisView.setActiveEl( thisView.hoverEl );
            });

            this.$('.socss-enable-inspector').click( function(){
                thisView.toggleActive();
            } );

            this.$el.mouseenter( function(){
                thisView.hl.clear();
            } );

            // Try register this inspector with the parent editor
            try {
                parent.socss.mainEditor.setInspector( this );
            }
            catch( err ){
                console.log( 'No editor to register this inspector with' );
            }

        },

        setHoverEl: function( hoverEl ){
            this.hoverEl = hoverEl;
            this.hl.highlight( hoverEl );
        },

        activate: function(){
            this.active = true;
            $('body').addClass('socss-active');
            $('body').removeClass('socss-inactive');
        },

        deactivate: function(){
            this.active = false;
            $('body').addClass('socss-inactive');
            $('body').removeClass('socss-active');
            this.hl.clear();
            this.$('.socss-hierarchy').empty();
        },

        /**
         * Toggle the active status
         */
        toggleActive: function(){
            if( this.active ) {
                this.deactivate();
            }
            else {
                this.activate();
            }
        },

        /**
         * Set the element that we're busy inspecting
         * @param el
         */
        setActiveEl: function( el ){
            var thisView = this;

            var $h = this.$('.socss-hierarchy');
            $h.empty();

            var cel = $(el);
            do {
                $( this.selectorTemplate({ selector: socss.fn.elSelector( cel ) }) )
                    .prependTo($h)
                    .data('el', cel);
                cel = cel.parent();
            } while( cel.prop('tagName').toLowerCase() !== 'body' );

            this.$('.socss-hierarchy .socss-selector')
                .hover(function(){
                    thisView.hl.highlight( $(this).data('el') );
                } )
                .click(function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    thisView.setActiveEl( $(this).data('el') );
                });

            // Scroll all the way left...
            $h.scrollLeft( 99999 );

            // Now lets add all the CSS selectors
            var selectors = this.pageSelectors.filter( function(a){
                return el.is( a.selector );
            } );

            var container = this.$('.socss-selectors-window').empty();

            _.each( selectors, function(selector){
                container.append(
                    $( thisView.selectorTemplate(selector) )
                        .data( selector )
                );
            } );
            container.find('> div')
                .mouseenter( function(){
                    thisView.hl.highlight( $(this).data('selector') );
                } )
                .click( function(e){
                    e.preventDefault();
                    e.stopPropagation();

                    thisView.trigger( 'click_selector', $(this).data('selector') );
                } );

            // And the CSS attributes
        }

    } );

    socss.view.highlighter = Backbone.View.extend( {
        template: _.template( $('#socss-template-hover').html().trim() ),
        highlighted: [ ],

        highlight: function( els ){
            this.clear();
            var thisView = this;

            $(els).each(function(i, el){
                el = $(el);

                if( !el.is(':visible') ) {
                    // Skip over invisible elements
                    return true;
                }

                var hl = $( thisView.template() );
                hl.css({
                    'top' : el.offset().top,
                    'left' : el.offset().left,
                    'width' : el.outerWidth(),
                    'height' : el.outerHeight()
                }).appendTo( 'body' );

                var g;

                var padding = el.padding();
                for( var k in padding ) {
                    if( parseInt( padding[k] ) > 0 ) {
                        g = hl.find( '.socss-guide-padding.socss-guide-' + k ).show();
                        if( k === 'top' || k === 'bottom' ) {
                            g.css('height', padding[k]);
                        }
                    }
                }

                var margin = el.margin();
                for( var k in margin ) {
                    if( parseInt( margin[k] ) > 0 ) {
                        g = hl.find( '.socss-guide-margin.socss-guide-' + k ).show();
                        if( k === 'top' || k === 'bottom' ) {
                            g.css('height', margin[k]);
                        }
                    }
                }

                thisView.highlighted.push( hl );
            } );
        },

        clear: function(){
            while( this.highlighted.length ) {
                this.highlighted.pop().remove();
            }
        }
    } );

    /**
     * Function to get all the available page selectors
     */
    socss.fn.pageSelectors = function(){
        var selectors = [];

        if( document.styleSheets ) {
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
            var elName = socss.fn.elSelector( $$ );
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
    };

    socss.fn.elSelector = function( el ){
        var elName = '';
        if( el.attr('id') !== undefined ) {
            elName += '#' + el.attr('id');
        }
        if( el.attr('class') !== undefined ) {
            elName += '.' + el.attr('class').replace(/\s+/, '.');
        }

        if( elName === '' ) {
            elName = el.prop('tagName').toLowerCase();
        }

        return elName;
    };

    window.socssInspector = socss;

} ) ( jQuery, _, socssOptions );

jQuery( function($){
    var socss = window.socssInspector;

    // Setup the editor
    var inspector = new socss.view.inspector( {
        el : $('#socss-inspector-interface').get(0)
    } );
    inspector.activate();

    window.socssInspector.mainInspector = inspector;
} );