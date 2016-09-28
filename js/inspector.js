
/* globals jQuery, Backbone, _, socssOptions, SPECIFICITY, console */

( function( $, _, socssOptions ){

    var socss = {
        model : { },
        collection : { },
        view : { },
        fn : {}
    };
    
    var getSelectorSpecificity = function(selector, useParts) {
        var specificities = [];
        var ruleSpecificity = SPECIFICITY.calculate( selector );
        for (var i = 0; i < ruleSpecificity.length; i++) {
            var specificity = ruleSpecificity[ i ];
            if ( useParts ) {
                for ( var j = 0; j < specificity.parts.length; j++ ) {
                    var specificityPart = specificity.parts[ j ];
                    // Recursive call to add specificities for parts.
                    specificities = specificities.concat(getSelectorSpecificity(specificityPart.selector));
                }
            } else {
                specificities.push({
                    'selector': specificity.selector.trim(),
                    'specificity': parseInt(specificity.specificity.replace(/,/g, ''))
                });
            }
        }
        return specificities;
    };

    /**
     * This is the main view for the app
     */
    socss.view.inspector = Backbone.View.extend( {

        active: false,
        hl: false,
        hoverEl: false,
        pageSelectors: [],

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

        /**
         * Set the element that's currently being hovered
         *
         * @param hoverEl
         */
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
        setActiveEl: function( el ) {
            var thisView = this;

            var $h = this.$('.socss-hierarchy');
            $h.empty();

            if (el.prop('tagName').toLowerCase() !== 'body') {
                var cel = $(el);
                do {
                    $(this.selectorTemplate({selector: socss.fn.elSelector(cel)}))
                        .prependTo($h)
                        .data('el', cel);
                    cel = cel.parent();
                } while (cel.prop('tagName').toLowerCase() !== 'body');

                $(this.selectorTemplate({selector: 'body'}))
                    .prependTo($h)
                    .data('el', $('body'));

                this.$('.socss-hierarchy .socss-selector')
                    .hover(function () {
                        thisView.hl.highlight($(this).data('el'));
                    })
                    .click(function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        thisView.setActiveEl($(this).data('el'));
                    });
            }

            // Scroll all the way left...
            $h.scrollLeft( 99999 );

            // Now lets add all the CSS selectors
            var selectors = this.pageSelectors.filter( function(a){
                // Use try to catch any malformed selectors
                try {
                    return el.is( a.selector );
                }
                catch(err) {
                    return false;
                }
            } );

            var container = this.$('.socss-selectors-window').empty();

            _.each( selectors, function( selector ){
                container.append(
                    $( thisView.selectorTemplate( selector ) )
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
            var attributes = socss.fn.elementAttributes(el);
            container = this.$('.socss-properties-window').empty();

            _.each( attributes, function(v, k){
                container.append(
                    $( thisView.selectorTemplate( { selector: '<strong>' + k + '</strong>: ' + v } ) )
                        .data( 'property', k + ': ' + v )
                );
            } );

            container.find('> div')
                .click( function(e){
                    e.preventDefault();
                    e.stopPropagation();

                    thisView.trigger( 'click_property', $(this).data('property') );
                });

            // Display the link
            var link = el.closest('a[href]');
            var linkContainer = this.$('.socss-link');
            if( link.length ) {
                linkContainer.show().find('a')
                    .html( link.attr('href').replace(/[\?&]*so_css_preview=1/, '') )
                    .attr('href', link.attr('href') );
            }
            else {
                linkContainer.hide();
            }

            this.trigger('set_active_element', el, selectors);
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
                        else {
                            g.css('width', padding[k]);
                            g.css({
                                'width': padding[k],
                                'top' : padding.top,
                                'bottom' : padding.bottom
                            });
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
                        else {
                            g.css('width', margin[k]);
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

    socss.parsedCss = {};
    socss.fn.getParsedCss = function(){
        // Load all the parsed CSS
        if( Object.keys(socss.parsedCss).length === 0 ) {
            var parser = window.css;
            $('.socss-theme-styles').each(function(){
                var $$ = $(this);
                var p = parser.parse( $$.html(), {
                    silent: true
                } );
                socss.parsedCss[ $$.attr('id') ] = p;
            });
        }
        return socss.parsedCss;
    };

    /**
     * Function to get all the available page selectors
     */
    socss.fn.pageSelectors = function(){
        var selectors = [];
        var parsedCss = socss.fn.getParsedCss();

        for( var k in parsedCss ) {
            var rules = parsedCss[k].stylesheet.rules;
            for( var i = 0; i < rules.length; i++ ) {
                if (typeof rules[i].selectors === 'undefined') {
                    continue;
                }
    
                for(var j = 0; j < rules[i].selectors.length; j++) {
                    selectors = selectors.concat( getSelectorSpecificity( rules[i].selectors[j] ) );
                }
            }
        }

        // Also add selectors for all the elements in the
        $('body *').each(function(){
            var $$ = $(this);
            var elName = socss.fn.elSelector( $$ );
            
            selectors = selectors.concat(getSelectorSpecificity(elName));
        });
    
        var $body = $('body');
        var bName = socss.fn.elSelector($body);
        selectors = selectors.concat(getSelectorSpecificity(bName, true));

        selectors = _.uniq( selectors, false, function( a ){
            return a.selector;
        } );

        selectors.sort(function(a, b){
            return a.specificity > b.specificity ? -1 : 1;
        });

        return selectors;
    };

    socss.fn.elementAttributes = function( el ) {
        if( !document.styleSheets ) {
            return [];
        }

        var elProperties = [];

        var trimFunc = function(e) {
            return e.trim();
        };

        var filterFunc = function(e){
            return e !== '';
        };

        var splitFunc = function(e) {
            return e.split(':').map( trimFunc );
        };

        var parsedCss = socss.fn.getParsedCss();

        var isAtRule = function (ruleType) {
            switch(ruleType) {
                case 'charset':
                case 'custom-media':
                case 'document':
                case 'font-face':
                case 'host':
                case 'import':
                case 'keyframes':
                case 'keyframe':
                case 'media':
                case 'namespace':
                case 'page':
                case 'supports':
                    return true;
                  
            }
            return false;
        };

        for( var k in parsedCss ) {
            var rules = parsedCss[k].stylesheet.rules;
            for( var i = 0; i < rules.length; i++ ) {
                var rule = rules[i];
                if (
                    typeof rule.selectors === 'undefined' || isAtRule(rule.type)
                ) {
                    continue;
                }
                
                for(var j = 0; j < rule.selectors.length; j++) {
                    var ruleSpecificity = SPECIFICITY.calculate( rule.selectors[j] );
                    for (var l = 0; l < ruleSpecificity.length; l++) {
                        try {
                            if ( el.is( ruleSpecificity[l].selector ) ) {
                                var declarations = rule.declarations;
                                for (var l = 0; l < declarations.length; l++) {
                                    elProperties.push({
                                        'name': declarations[l].property,
                                        'value': declarations[l].value,
                                        'specificity': parseInt( ruleSpecificity[l].specificity.replace( /,/g, '' ) )
                                    });
                                }
                            }
                        }
                        catch (e) {
                            // For now, we're just going to ignore rules that trigger errors
                        }
                    }
                }

            }
        }

        elProperties.sort( function(a,b) {
            return a.specificity > b.specificity ? 1 : -1;
        }).reverse();

        var returnProperties = {};
        for( var pi = 0; pi < elProperties.length; pi++ ) {
            if( typeof returnProperties[elProperties[pi].name] === 'undefined' ) {
                returnProperties[elProperties[pi].name] = elProperties[pi].value;
            }
        }

        return returnProperties;
    };

    socss.fn.elSelector = function( el ){
        var elName = '';
        if( el.attr('id') !== undefined ) {
            elName += '#' + el.attr('id');
        }
        if( el.attr('class') !== undefined ) {
            elName += '.' + el.attr('class').replace(/\s+/g, '.');
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
