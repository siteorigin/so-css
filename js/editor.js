/* globals jQuery, _, socssOptions, Backbone, CodeMirror, console, cssjs, wp */

(function ($, _, socssOptions) {

    var socss = {
        model: {},
        collection: {},
        view: {},
        fn: {}
    };

    window.socss = socss;

    /**
     * The toolbar view
     */
    socss.view.toolbar = Backbone.View.extend({

        button: _.template('<li><a href="#" class="toolbar-button socss-button"><%= text %></a></li>'),

        editor: null,

        initialize: function ( attr ) {
            this.editor = attr.editor;

            var thisView = this;
            this.$('.editor-expand').click(function (e) {
                e.preventDefault();
                $(this).blur();
                thisView.trigger('click_expand');
            });

            this.$('.editor-visual').click(function (e) {
                e.preventDefault();
                $(this).blur();
                thisView.trigger('click_visual');
            });
        },

        addButton: function (text, action) {
            var thisView = this;
            var button = $(this.button({text: text}))
                .appendTo(this.$('.toolbar-function-buttons .toolbar-buttons'))
                .click(function (e) {
                    e.preventDefault();
                    $(this).blur();
                    thisView.trigger('click_' + action);
                });

            return button;
        }
    });

    /**
     * The editor view, which handles codemirror stuff
     */
    socss.view.editor = Backbone.View.extend({

        codeMirror: null,
        snippets: null,
        toolbar: null,
        visualProperties: null,

        inspector: null,

        cssSelectors: [],

        initialize: function (args) {
            this.setupEditor();
        },

        render: function () {
            var thisView = this;

            // Setup the toolbar
            this.toolbar = new socss.view.toolbar({
                editor: this,
                el: this.$('.custom-css-toolbar')
            });
            this.toolbar.editor = this;
            this.toolbar.render();

            // Create the visual properties view
            this.visualProperties = new socss.view.properties({
                editor: this,
                el: $('#so-custom-css-properties')
            });
            this.visualProperties.render();

            this.toolbar.on('click_expand', function () {
                thisView.toggleExpand();
            });

            this.toolbar.on('click_visual', function () {
                thisView.visualProperties.loadCSS( thisView.codeMirror.getValue().trim() );
                thisView.visualProperties.show();
            });

            this.preview = new socss.view.preview({
                editor: this,
                el: this.$('.custom-css-preview')
            });
            this.preview.render();
        },

        /**
         * Do the initial setup of the CodeMirror editor
         */
        setupEditor: function () {
            var thisView = this;
            this.registerCodeMirrorAutocomplete();

            // Setup the Codemirror instance
            var $textArea = this.$('textarea.css-editor');
            var initValue = $textArea.val();
            // Pad with empty lines so the editor takes up all the white space. To try make sure user gets copy/paste
            // options in context menu.
            var newlineMatches = initValue.match(/\n/gm);
            var lineCount = newlineMatches ? newlineMatches.length+1 : 1;
            var paddedValue = initValue;
            $textArea.val(paddedValue);
            this.codeMirror = CodeMirror.fromTextArea($textArea.get(0), {
                tabSize: 2,
                lineNumbers: true,
                mode: 'css',
                theme: 'neat',
                inputStyle: 'contenteditable', //necessary to allow context menu (right click) copy/paste etc.
                gutters: [
                    "CodeMirror-lint-markers"
                ],
                lint: true,
            });

            // Make sure the user doesn't leave without saving
            this.$el.on('submit', function(){
                initValue = thisView.codeMirror.getValue().trim();
            });
            $(window).bind('beforeunload', function(){
                var editorValue = thisView.codeMirror.getValue().trim();
                if( editorValue !== initValue ) {
                    return socssOptions.loc.leave;
                }
            });


            // Set the container to visible overflow once the editor is setup
            this.$el.find('.custom-css-container').css('overflow', 'visible');
            this.scaleEditor();

            // Scale the editor whenever the window is resized
            $(window).resize(function () {
                thisView.scaleEditor();
            });

            // Setup the extensions
            this.setupCodeMirrorExtensions();
        },

        /**
         * Register the autocomplete helper. Based on css-hint.js in the codemirror addon folder.
         */
        registerCodeMirrorAutocomplete: function () {
            var thisView = this;

            var pseudoClasses = {
                link: 1, visited: 1, active: 1, hover: 1, focus: 1,
                "first-letter": 1, "first-line": 1, "first-child": 1,
                before: 1, after: 1, lang: 1
            };

            CodeMirror.registerHelper("hint", "css", function (cm) {
                var cur = cm.getCursor(), token = cm.getTokenAt(cur);
                var inner = CodeMirror.innerMode(cm.getMode(), token.state);
                if (inner.mode.name !== "css") {
                    return;
                }

                if (token.type === "keyword" && "!important".indexOf(token.string) === 0) {
                    return {
                        list: ["!important"], from: CodeMirror.Pos(cur.line, token.start),
                        to: CodeMirror.Pos(cur.line, token.end)
                    };
                }

                var start = token.start, end = cur.ch, word = token.string.slice(0, end - start);
                if (/[^\w$_-]/.test(word)) {
                    word = "";
                    start = end = cur.ch;
                }

                var spec = CodeMirror.resolveMode("text/css");

                var result = [];

                function add(keywords) {
                    for (var name in keywords) {
                        if (!word || name.lastIndexOf(word, 0) === 0) {
                            result.push(name);
                        }
                    }
                }

                var st = inner.state.state;

                if (st === 'top') {
                    // We're going to autocomplete the selector using our own set of rules
                    var line = cm.getLine(cur.line).trim();

                    var selectors = thisView.cssSelectors;
                    for (var i = 0; i < selectors.length; i++) {
                        if (selectors[i].selector.indexOf(line) !== -1) {
                            result.push(selectors[i].selector);
                        }
                    }

                    if (result.length) {
                        return {
                            list: result,
                            from: CodeMirror.Pos(cur.line, 0),
                            to: CodeMirror.Pos(cur.line, end)
                        };
                    }
                }
                else {

                    if (st === "pseudo" || token.type === "variable-3") {
                        add(pseudoClasses);
                    }
                    else if (st === "block" || st === "maybeprop") {
                        add(spec.propertyKeywords);
                    }
                    else if (st === "prop" || st === "parens" || st === "at" || st === "params") {
                        add(spec.valueKeywords);
                        add(spec.colorKeywords);
                    }
                    else if (st === "media" || st === "media_parens") {
                        add(spec.mediaTypes);
                        add(spec.mediaFeatures);
                    }

                    if (result.length) {
                        return {
                            list: result,
                            from: CodeMirror.Pos(cur.line, start),
                            to: CodeMirror.Pos(cur.line, end)
                        };
                    }

                }

            });
        },

        setupCodeMirrorExtensions: function () {
            var thisView = this;

            this.codeMirror.on('cursorActivity', function (cm) {
                var cur = cm.getCursor(), token = cm.getTokenAt(cur);
                var inner = CodeMirror.innerMode(cm.getMode(), token.state);

                // If we have a qualifier selected, then highlight that in the preview
                if (token.type === 'qualifier' || token.type === 'tag' || token.type === 'builtin') {
                    var line = cm.getLine(cur.line);
                    var selector = line.substring(0, token.end);

                    thisView.preview.highlight(selector);
                }
                else {
                    thisView.preview.clearHighlight();
                }
            });

            // This sets up automatic autocompletion at all times
            this.codeMirror.on('keyup', function (cm, e) {
                if (
                    ( e.keyCode >= 65 && e.keyCode <= 90 ) ||
                    ( e.keyCode === 189 && !e.shiftKey ) ||
                    ( e.keyCode === 190 && !e.shiftKey ) ||
                    ( e.keyCode === 51 && e.shiftKey ) ||
                    ( e.keyCode === 189 && e.shiftKey )
                ) {
                    cm.showHint( {
                        completeSingle: false
                    } );
                }
            });
        },

        /**
         * Scale the size of the editor depending on whether it's expanded or not
         */
        scaleEditor: function () {
            if (this.$el.hasClass('expanded')) {
                // If we're in the expanded view, then resize the editor
                this.codeMirror.setSize('100%', $(window).outerHeight() - this.$('.custom-css-toolbar').outerHeight());
            }
            else {
                this.codeMirror.setSize('100%', 'auto');
            }
        },

        /**
         * Check if the editor is in expanded mode
         * @returns bool
         */
        isExpanded: function () {
            return this.$el.hasClass('expanded');
        },

        /**
         * Toggle if this is expanded or not
         */
        toggleExpand: function () {
            this.$el.toggleClass('expanded');
            this.scaleEditor();
        },

        /**
         * Set the expanded state of the editor
         * @param expanded
         */
        setExpand: function (expanded) {
            if (expanded) {
                this.$el.addClass('expanded');
            }
            else {
                this.$el.removeClass('expanded');
            }
            this.scaleEditor();
        },

        /**
         * Set the snippets available to this editor
         */
        setSnippets: function (snippets) {
            if (!_.isEmpty(snippets)) {
                var thisView = this;

                this.snippets = new socss.view.snippets({
                    snippets: snippets
                });
                this.snippets.editor = this;

                this.snippets.render();
                this.toolbar.addButton('Snippets', 'snippets');
                this.toolbar.on('click_snippets', function () {
                    thisView.snippets.show();
                });
            }
        },

        /**
         * Add some CSS to the editor.
         * @param css
         */
        addCode: function (css) {
            var editor = this.codeMirror;

            var before_css = '';
            if (editor.doc.lineCount() === 1 && editor.doc.getLine(editor.doc.lastLine()).length === 0) {
                before_css = "";
            }
            else if (editor.doc.getLine(editor.doc.lastLine()).length === 0) {
                before_css = "\n";
            }
            else {
                before_css = "\n\n";
            }

            // Now insert the code in the editor
            editor.doc.setCursor(
                editor.doc.lastLine(),
                editor.doc.getLine(editor.doc.lastLine()).length
            );
            editor.doc.replaceSelection(before_css + css);
        },

        addEmptySelector: function (selector) {
            this.addCode(selector + " {\n  \n}");
        },

        /**
         * Sets the inspector view that's being used by the editor
         */
        setInspector: function (inspector) {
            var thisView = this;
            this.inspector = inspector;
            this.cssSelectors = inspector.pageSelectors;

            // A selector is clicked in the inspector
            inspector.on('click_selector', function (selector) {
                if ( thisView.visualProperties.isVisible() ) {
                    thisView.visualProperties.addSelector(selector);
                }
                else {
                    thisView.addEmptySelector(selector);
                }
            });

            // A property is clicked in the inspector
            inspector.on('click_property', function (property) {
                if ( ! thisView.visualProperties.isVisible() ) {
                    thisView.codeMirror.replaceSelection(property + ";\n  ");
                }
            });

            inspector.on('set_active_element', function(el, selectors){
                if ( thisView.visualProperties.isVisible() && selectors.length ) {
                    thisView.visualProperties.addSelector( selectors[0].selector );
                }
            });
        }

    });

    /**
     * The preview.
     */
    socss.view.preview = Backbone.View.extend({

        template: _.template( $('#template-preview-window').html() ),
        editor: null,
        originalUri: null,
        currentUri: null,

        initialize: function (attr) {
            this.editor = attr.editor;

            var thisView = this;
            this.editor.codeMirror.on('change', function (cm, c) {
                thisView.updatePreviewCss();
            });
        },

        render: function () {
            var thisView = this;

            this.$el.html( this.template() );

            this.$( '#preview-iframe' )
                .attr( 'src', socssOptions.homeURL )
                .on( 'load', function () {
                    var $$ = $(this);

                    // Update the current URI with the iframe URI
                    thisView.currentUri = new URI( $$.contents().get(0).location.href );
                    thisView.currentUri.removeQuery( 'so_css_preview' );
                    thisView.$( '#preview-navigator input' ).val( thisView.currentUri.toString() );
                    thisView.currentUri.addQuery( 'so_css_preview', 1 );

                    $$.contents().find('a').each(function () {
                        var href = $(this).attr('href');
                        if (href === undefined) {
                            return true;
                        }

                        var firstSeperator = (href.indexOf('?') === -1 ? '?' : '&');
                        $(this).attr('href', href + firstSeperator + 'so_css_preview=1');
                    });

                    thisView.updatePreviewCss();
                })
                .mouseleave(function () {
                    thisView.clearHighlight();
                });

            this.$( '#preview-navigator input' ).keydown( function( e ){
                var $$ = $(this);

                if( e.keyCode == 13 ) {
                    e.preventDefault();

                    var newUri = new URI( $$.val() );

                    // Validate the URI
                    if(
                        thisView.originalUri.host() !== newUri.host() ||
                        thisView.originalUri.protocol() !== newUri.protocol()
                    ) {
                        $$.blur();
                        alert( $$.data( 'invalid-uri' ) );
                        $$.focus();
                    }
                    else {
                        newUri.addQuery( 'so_css_preview', 1 );
                        thisView.$( '#preview-iframe' ).attr( 'src', newUri.toString() );
                    }
                }
            } );

            this.originalUri = new URI( socssOptions.homeURL );
            this.currentUri = new URI( socssOptions.homeURL );

            this.currentUri.removeQuery( 'so_css_preview' );
            this.$('#preview-navigator input').val( this.currentUri.toString() );
            this.currentUri.addQuery( 'so_css_preview', 1 );
        },

        /**
         * Update the preview CSS from the CodeMirror value in the editor
         */
        updatePreviewCss: function () {
            var preview = this.$('#preview-iframe');
            if (preview.length === 0) {
                return;
            }

            var head = preview.contents().find('head');
            if (head.find('style.siteorigin-custom-css').length === 0) {
                head.append('<style class="siteorigin-custom-css" type="text/css"></style>');
            }
            var style = head.find('style.siteorigin-custom-css');

            // Update the CSS after a short delay
            var css = this.editor.codeMirror.getValue().trim();
            style.html(css);
        },

        /**
         * Highlight all elements with a given selector
         */
        highlight: function (selector) {
            try {
                this.editor.inspector.hl.highlight(selector);
            }
            catch (err) {
                console.log('No inspector to highlight with');
            }
        },

        /**
         * Clear the currently highlighted elements in preview
         */
        clearHighlight: function () {
            try {
                this.editor.inspector.hl.clear();
            }
            catch (err) {
                console.log('No inspector to highlight with');
            }
        }

    });

    /**
     * The dialog for the snippets browser
     */
    socss.view.snippets = Backbone.View.extend({
        template: _.template($('#template-snippet-browser').html()),
        snippet: _.template('<li class="snippet"><%- name %></li>'),
        className: 'css-editor-snippet-browser',
        snippets: null,
        editor: null,

        events: {
            'click .close': 'hide',
            'click .buttons .insert-snippet': 'insertSnippet'
        },

        currentSnippet: null,

        initialize: function (args) {
            this.snippets = args.snippets;
        },

        render: function () {
            var thisView = this;


            var clickSnippet = function (e) {
                e.preventDefault();
                var $$ = $(this);

                thisView.$('.snippets li.snippet').removeClass('active');
                $(this).addClass('active');
                thisView.viewSnippet({
                    name: $$.html(),
                    description: $$.data('description'),
                    css: $$.data('css')
                });
            };

            this.$el.html(this.template());
            for (var i = 0; i < this.snippets.length; i++) {
                $(this.snippet({name: this.snippets[i].Name}))
                    .data({
                        'description': this.snippets[i].Description,
                        'css': this.snippets[i].css
                    })
                    .appendTo(this.$('ul.snippets'))
                    .click(clickSnippet);
            }

            // Click on the first one
            thisView.$('.snippets li.snippet').eq(0).click();

            this.attach();
            return this;
        },

        viewSnippet: function (args) {
            var w = this.$('.main .snippet-view');

            w.find('.snippet-title').html(args.name);
            w.find('.snippet-description').html(args.description);
            w.find('.snippet-code').html(args.css);

            this.currentSnippet = args;
        },

        insertSnippet: function () {
            var editor = this.editor.codeMirror;
            var css = this.currentSnippet.css;

            var before_css = '';
            if (editor.doc.lineCount() === 1 && editor.doc.getLine(editor.doc.lastLine()).length === 0) {
                before_css = "";
            }
            else if (editor.doc.getLine(editor.doc.lastLine()).length === 0) {
                before_css = "\n";
            }
            else {
                before_css = "\n\n";
            }

            // Now insert the code in the editor
            editor.doc.setCursor(
                editor.doc.lastLine(),
                editor.doc.getLine(editor.doc.lastLine()).length
            );
            editor.doc.replaceSelection(before_css + css);

            this.hide();
        },

        attach: function () {
            this.$el.appendTo('body');
        },

        show: function () {
            this.$el.show();
        },

        hide: function () {
            this.$el.hide();
        }
    });


    /**
     * The visual properties editor
     */
    socss.view.properties = Backbone.View.extend({

        model: socss.model.cssRules,

        tabTemplate: _.template('<li data-section="<%- id %>"><span class="fa fa-<%- icon %>"></span> <%- title %></li>'),
        sectionTemplate: _.template('<div class="section" data-section="<%- id %>"><table class="fields-table"><tbody></tbody></table></div>'),
        controllerTemplate: _.template('<tr><th scope="row"><%- title %></th><td></td></tr>'),

        /**
         * The controllers for each of the properties
         */
        propertyControllers: [],

        /**
         * The editor view
         */
        editor: null,

        /**
         * The current, raw CSS
         */
        css: '',

        /**
         * Parsed CSS
         */
        parsed: {},

        /**
         * The current active selector
         */
        activeSelector: '',

        /**
         * Was the editor expanded before we went into the property editor
         */
        editorExpandedBefore: false,

        events: {
            'click .close': 'hide'
        },

        /**
         * Initialize the properties editor with a new model
         */
        initialize: function ( attr ) {
            this.parser = window.css;
            this.editor = attr.editor;
        },

        /**
         * Render the property editor
         */
        render: function () {
            var thisView = this;

            // Clean up for potential re-renders
            this.$('.section-tabs').empty();
            this.$('.sections').empty();
            this.$('.toolbar select').off();
            thisView.propertyControllers = [];

            var controllers = socssOptions.propertyControllers;

            for (var id in controllers) {
                // Create the tabs
                var $t = $(this.tabTemplate({
                    id: id,
                    icon: controllers[id].icon,
                    title: controllers[id].title
                })).appendTo(this.$('.section-tabs'));

                // Create the section wrapper
                var $s = $(this.sectionTemplate({
                    id: id
                })).appendTo(this.$('.sections'));

                // Now lets add the controllers
                if (!_.isEmpty(controllers[id].controllers)) {

                    for (var i = 0; i < controllers[id].controllers.length; i++) {

                        var $c = $(thisView.controllerTemplate({
                            title: controllers[id].controllers[i].title
                        })).appendTo($s.find('tbody'));

                        var controllerAtts = controllers[id].controllers[i];
                        var controller;

                        if (typeof socss.view.properties.controllers[controllerAtts.type] === 'undefined') {
                            // Setup a default controller
                            controller = new socss.view.propertyController({
                                el: $c.find('td'),
                                propertiesView: thisView,
                                args: ( typeof controllerAtts.args === 'undefined' ? {} : controllerAtts.args )
                            });
                        }
                        else {
                            // Setup a specific controller
                            controller = new socss.view.properties.controllers[controllerAtts.type]({
                                el: $c.find('td'),
                                propertiesView: thisView,
                                args: ( typeof controllerAtts.args === 'undefined' ? {} : controllerAtts.args )
                            });
                        }

                        thisView.propertyControllers.push(controller);

                        // Setup and render the controller
                        controller.render();
                        controller.initChangeEvents();
                    }
                }
            }

            // Setup the tab switching for the property sections
            this.$('.section-tabs li').click(function () {
                var $$ = $(this);
                var show = thisView.$('.sections .section[data-section="' + $$.data('section') + '"]');

                thisView.$('.sections .section').not(show).hide().removeClass('active');
                show.show().addClass('active');

                thisView.$('.section-tabs li').not($$).removeClass('active');
                $$.addClass('active');
            }).eq(0).click();

            this.$('.toolbar select').change(function () {
                thisView.setActivateSelector($(this).find(':selected').data('selector'));
            });
        },

        /**
         * Sets the rule value for the active selector
         * @param rule
         * @param value
         */
        setRuleValue: function (rule, value) {
            if (
              typeof this.activeSelector === 'undefined' ||
              typeof this.activeSelector.declarations === 'undefined'
            ) {
                return;
            }

            var declarations = this.activeSelector.declarations;
            var newRule = true;
            var valueChanged = false;
            for (var i = 0; i < declarations.length; i++) {
                if (declarations[i].property === rule) {
                    newRule = false;
                    var declaration = declarations[i];
                    if ( declaration.value !== value ) {
                        declaration.value = value;
                        valueChanged = true;
                    }
                    
                    // Remove empty declarations
                    if ( _.isEmpty( declaration.value ) ) {
                        declarations.splice( declarations.indexOf( declaration ) );
                    }
                    break;
                }
            }

            if ( newRule && !_.isEmpty( value ) ) {
                declarations.push({
                    property: rule,
                    value: value,
                    type: 'declaration',
                });
                valueChanged = true;
            }

            if ( valueChanged ) {
                this.updateMainEditor(false);
            }
        },

        /**
         * Adds the @import rule value if it doesn't already exist.
         *
         * @param newRule
         *
         */
        addImport: function (newRule) {

            // get @import rules
            // check if any have the same value
            // if not, then add the new @ rule

            var importRules = _.filter( this.parsed.stylesheet.rules, function ( rule) {
                return rule.type === 'import';
            } );
            var exists = _.any( importRules, function ( rule ) {
                return rule.import === newRule.import;
              } );

            if ( !exists ) {
                // Add it to the top!
                // @import statements must precede other rule types.
                this.parsed.stylesheet.rules.unshift( newRule );
                this.updateMainEditor( false );
            }

        },

        /**
         * Find @import which completely or partially contains the specified value.
         *
         * @param value
         */
        findImport: function(value) {
            return _.find( this.parsed.stylesheet.rules, function ( rule ) {
                return rule.type === 'import' && rule.import.indexOf(value) > -1;
            } );
        },

        /**
         * Find @import which completely or partially contains the identifier value and update it's import property.
         *
         * @param identifier
         * @param value
         */
        updateImport: function(identifier, value) {
            var importRule = this.findImport(identifier);
            if ( importRule.import !== value.import ) {
                importRule.import = value.import;
                this.updateMainEditor(false);
            }
        },

        /**
         * Find @import which completely or partially contains the identifier value and remove it.
         *
         * @param identifier
         */
        removeImport: function(identifier) {
            var importIndex = _.findIndex( this.parsed.stylesheet.rules, function ( rule ) {
                return rule.type === 'import' && rule.import.indexOf(identifier) > -1;
            } );
            if ( importIndex > -1 ) {
                this.parsed.stylesheet.rules.splice(importIndex, 1);
            }
        },

        /**
         * Get the rule value for the active selector
         * @param rule
         */
        getRuleValue: function (rule) {
            if (typeof this.activeSelector === 'undefined' || typeof this.activeSelector.declarations === 'undefined') {
                return '';
            }

            var declarations = this.activeSelector.declarations;
            for (var i = 0; i < declarations.length; i++) {
                if (declarations[i].property === rule) {
                    return declarations[i].value;
                }
            }
            return '';
        },

        /**
         * Update the main editor with the value of the parsed CSS
         */
        updateMainEditor: function ( compress ) {
          //TODO: add back compress option to remove/merge duplicated CSS selectors.
          this.editor.codeMirror.setValue( this.parser.stringify( this.parsed ) );
        },

        /**
         * Show the properties editor
         */
        show: function () {
            this.editorExpandedBefore = this.editor.isExpanded();
            this.editor.setExpand(true);

            this.$el.show().animate({'left': 0}, 'fast');
        },

        /**
         * Hide the properties editor
         */
        hide: function () {
            this.editor.setExpand(this.editorExpandedBefore);
            this.$el.animate( {'left': -338}, 'fast', function(){
                $(this).hide();
            } );

            // Update the main editor with compressed CSS when we close the properties editor
            this.updateMainEditor( true );
        },

        /**
         * @returns boolean
         */
        isVisible: function () {
            return this.$el.is(':visible');
        },

        /**
         * Loads a single CSS selector and associated properties into the model
         * @param css
         */
        loadCSS: function (css, activeSelector) {
            this.css = css;

            // Load the CSS
            this.parsed = this.parser.parse(css, {
                silent:true
            } );
            var rules = this.parsed.stylesheet.rules;

            // Add the dropdown menu items
            var dropdown = this.$('.toolbar select').empty();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];

                // Exclude @import statements
                if ( ! _.contains( [ 'rule', 'media' ], rule.type) ) {
                    continue;
                }

                if( rule.type === 'media' ) {

                    for (var j = 0; j < rule.rules.length; j++) {
                        var mediaRule = '@media ' + rule.media;
                        var subRule = rule.rules[j];
                        if(subRule.type != 'rule') {
                            continue;
                        }
                        dropdown.append(
                            $('<option>')
                                .html( mediaRule + ': ' + subRule.selectors.join(',') )
                                .attr( 'val', mediaRule + ': ' + subRule.selectors.join(',') )
                                .data( 'selector', subRule )
                        );
                    }

                }
                else {
                    dropdown.append(
                        $('<option>')
                            .html( rule.selectors.join(',') )
                            .attr( 'val', rule.selectors.join(',') )
                            .data( 'selector', rule )
                    );
                }
            }

            if (typeof activeSelector === 'undefined') {
                activeSelector = dropdown.find('option').eq(0).attr('val');
            }
            if(!_.isEmpty(activeSelector)) {
                dropdown.val(activeSelector).change();
            }
        },

        /**
         * Set the selector that we're currently dealing with
         * @param selector
         */
        setActivateSelector: function (selector) {
            this.activeSelector = selector;
            for (var i = 0; i < this.propertyControllers.length; i++) {
                this.propertyControllers[i].refreshFromRule();
            }
        },

        /**
         * Add or select a selector.
         *
         * @param selector
         */
        addSelector: function(selector) {
            // Check if this selector already exists
            var dropdown = this.$('.toolbar select');
            dropdown.val( selector );

            if( dropdown.val() === selector ) {
                // Trigger a change event to load the existing selector
                dropdown.change();
            }
            else {
                // The selector doesn't exist, so add it to the CSS, then reload
                this.editor.addEmptySelector(selector);
                this.loadCSS( this.editor.codeMirror.getValue().trim(), selector );
            }

            dropdown.addClass('highlighted');
            setTimeout(function(){
                dropdown.removeClass('highlighted');
            }, 2000);
        }

    });

    // The basic property controller
    socss.view.propertyController = Backbone.View.extend({

        template: _.template('<input type="text" value="" />'),
        activeRule: null,
        args: null,
        propertiesView: null,

        initialize: function (args) {

            this.args = args.args;
            this.propertiesView = args.propertiesView;

            // By default, update the active rule whenever things change
            this.on('set_value', this.updateRule, this);
            this.on('change', this.updateRule, this);
        },

        /**
         * Render the property field controller
         */
        render: function () {
            this.$el.append( $(this.template( {} )) );
            this.field = this.$('input');
        },

        /**
         * Initialize the events that constitute a change
         */
        initChangeEvents: function () {
            var thisView = this;
            this.field.on( 'change keyup', function () {
                thisView.trigger('change', $(this).val());
            } );
        },


        /**
         * Update the value of an active rule
         */
        updateRule: function () {
            this.propertiesView.setRuleValue(
                this.args.property,
                this.getValue()
            );
        },

        /**
         * This is called when the selector changes
         */
        refreshFromRule: function () {
            var value = this.propertiesView.getRuleValue(this.args.property);
            this.setValue(value, {silent: true});
        },

        /**
         * Get the current value
         * @return string
         */
        getValue: function () {
            return this.field.val();
        },

        /**
         * Set the current value
         * @param socss.view.properties val
         */
        setValue: function (val, options) {
            options = _.extend({silent: false}, options);

            this.field.val(val);

            if (!options.silent) {
                this.trigger('set_value', val);
            }
        },

        /**
         * Reset the current value
         */
        reset: function (options) {
            options = _.extend({silent: false}, options);

            this.setValue('', options);
        }

    });

    // All the value controllers
    socss.view.properties.controllers = {};

    // The color controller
    socss.view.properties.controllers.color = socss.view.propertyController.extend({

        template: _.template('<input type="text" value="" />'),

        render: function () {
            var thisView = this;

            this.$el.append($(this.template({})));

            // Set this up as a color picker
            this.field = this.$el.find('input');
            this.field.minicolors({});

        },

        initChangeEvents: function () {
            var thisView = this;
            this.field.on('change keyup', function () {
                thisView.trigger('change', thisView.field.minicolors('value'));
            });
        },

        getValue: function () {
            return this.field.minicolors('value').trim();
        },

        setValue: function (val, options) {
            options = _.extend({silent: false}, options);

            this.field.minicolors('value', val);

            if (!options.silent) {
                this.trigger('set_value', val);
            }
        }

    });

    // The dropdown select box controller
    socss.view.properties.controllers.select = socss.view.propertyController.extend( {
        template: _.template('<select></select>'),

        render: function(){
            var thisView = this;

            this.$el.append($(this.template({})));
            this.field = this.$el.find('select');

            // Add the unchanged option
            this.field.append( $('<option value=""></option>').html('') );

            // Add all the options to the dropdown
            for( var k in this.args.options ) {
                this.field.append( $('<option></option>').attr('value', k).html( this.args.options[k] ) );
            }

            if( typeof this.args.option_icons !== 'undefined' ) {
                this.setupVisualSelect();
            }
        },

        setupVisualSelect: function(){
            var thisView = this;
            this.field.hide();

            var $tc = $('<div class="select-tabs"></div>').appendTo( this.$el );

            // Add the none value
            $('<div class="select-tab" data-value=""><span class="fa fa-circle-o"></span></div>').appendTo($tc);

            // Now add one for each of the option icons
            for ( var k in this.args.option_icons ) {
                $('<div class="select-tab"></div>')
                    .appendTo($tc)
                    .append(
                        $('<span class="fa"></span>')
                            .addClass('fa-' + this.args.option_icons[k])
                    )
                    .attr('data-value', k)
                ;
            }

            $tc.find('.select-tab')
                .css('width', 100/( $tc.find('>div').length ) + "%" )
                .click( function(){
                    var $t = $(this);
                    $tc.find('.select-tab').removeClass('active');
                    $t.addClass('active');
                    thisView.field.val( $t.data('value')).change();
                } );
        },

        /**
         * Set the current value
         * @param socss.view.properties val
         */
        setValue: function (val, options) {
            options = _.extend({silent: false}, options);

            this.field.val(val);

            this.$('.select-tabs .select-tab').removeClass('active').filter('[data-value="' + val + '"]').addClass('active');

            if (!options.silent) {
                this.trigger('set_value', val);
            }
        }

    } );

    // A field that lets a user upload an image
    socss.view.properties.controllers.image = socss.view.propertyController.extend( {
        template: _.template('<input type="text" value="" /> <span class="select socss-button"><span class="fa fa-upload"></span></span>'),

        render: function(){
            var thisView = this;

            this.media = wp.media({
                // Set the title of the modal.
                title: socssOptions.loc.select_image,

                // Tell the modal to show only images.
                library: {
                    type: 'image'
                },

                // Customize the submit button.
                button: {
                    // Set the text of the button.
                    text: socssOptions.loc.select,
                    // Tell the button not to close the modal, since we're
                    // going to refresh the page when the image is selected.
                    close: false
                }
            });

            this.$el.append( $(this.template({
                select: socssOptions.loc.select
            })) );

            this.field = this.$el.find('input');

            this.$('.select').click(function(){
                thisView.media.open();
            });

            this.media.on('select', function(){
                // Grab the selected attachment.
                var attachment = this.state().get('selection').first().attributes;
                var val = thisView.args.value.replace('{{url}}', attachment.url);

                // Change the field value and trigger a change event
                thisView.field.val( val ).change();

                // Close the image selector
                thisView.media.close();

            }, this.media);
        }

    } );

    // A simple measurement field
    socss.view.properties.controllers.measurement = socss.view.propertyController.extend( {

        wrapperClass: 'socss-field-measurement',

        render: function(){
            this.$el.append($(this.template({})));
            this.field = this.$('input');
            this.setupMeasurementField( this.field, {} );
        },

        setValue: function (val, options) {
            options = _.extend({silent: false}, options);
            this.field.val(val).trigger('measurement_refresh');
            if (!options.silent) {
                this.trigger('set_value', val);
            }
        },

        units : [
            'px',
            '%',
            'em',
            'cm',
            'mm',
            'in',
            'pt',
            'pc',
            'ex',
            'ch',
            'rem',
            'vw',
            'vh',
            'vmin',
            'vmax'
        ],

        parseUnits: function( value ){
            var escapeRegExp = function(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            };

            var regexUnits = this.units.map(escapeRegExp);
            var regex = new RegExp('([0-9\\.\\-]+)(' + regexUnits.join('|') + ')?', 'i');
            var result = regex.exec( value );

            if( result === null ) {
                return {
                    value: '',
                    unit: ''
                };
            }
            else {
                return {
                    value: result[1],
                    unit: result[2] === undefined ? '' : result[2]
                };
            }
        },

        setupMeasurementField: function( $el, options ){
            var thisView = this;
            var $p = $el.parent();

            options = _.extend( {
                defaultUnit: 'px'
            }, options );

            $el.hide();
            $p.addClass( this.wrapperClass ).data('unit', options.defaultUnit);

            // Create the fake input field
            var $fi = $('<input type="text" class="socss-field-input"/>').appendTo($p);
            var $da = $('<span class="dashicons dashicons-arrow-down"></span>').appendTo($p);
            var $dd = $('<ul class="dropdown"></ul>').appendTo($p);
            var $u = $('<span class="units"></span>').html( options.defaultUnit ).appendTo( $p );

            for( var i = 0; i < thisView.units.length; i++ ) {
                var $o = $('<li></li>').html( thisView.units[i] ).data('unit', thisView.units[i]);
                if( thisView.units[i] === options.defaultUnit ) {
                    $o.addClass('active');
                }
                $dd.append( $o );
            }

            var updateValue = function(){
                var value = thisView.parseUnits( $fi.val() );

                if( value.unit !== '' && value.unit !== $p.data( 'unit' ) ) {
                    $fi.val( value.value );
                    setUnit( value.unit );
                }

                if( value.value === '' ) {
                    $el.val( '' );
                }
                else {
                    $el.val( value.value + $p.data( 'unit' ) );
                }
            };

            var setUnit = function( unit ){
                $u.html( unit );
                $p.data( 'unit', unit );
                $fi.trigger('keydown');
            };

            $da.click( function(){
                $dd.toggle();
            } );

            $dd.find('li').click( function(){
                $dd.toggle();
                setUnit( $(this).data('unit') );
                updateValue();
                $el.trigger('change');
            } );

            $fi.on( 'keyup keydown', function(e){
                var $$ = $(this);

                var char = '';
                if( e.type === 'keydown' ) {
                    if(e.keyCode >= 48 && e.keyCode <= 57 ) {
                        char = String.fromCharCode(e.keyCode);
                    }
                    else if( e.keyCode === 189 ) {
                        char = '-';
                    }
                    else if( e.keyCode === 190 ) {
                        char = '.';
                    }
                }

                var $pl = $('<span class="socss-hidden-placeholder"></span>')
                    .css( {
                        'font-size' : '14px'
                    } )
                    .html( $fi.val() + char )
                    .appendTo( 'body' );
                var width = $pl.width();
                width = Math.min(width, 63);
                $pl.remove();

                $u.css('left', width + 12);
            } );

            $fi.on('keyup', function(e){
                updateValue();
                $el.trigger('change');
            } );

            $el.on('measurement_refresh', function(){
                var value = thisView.parseUnits( $el.val() );
                $fi.val( value.value );

                var unit = value.unit === '' ?  options.defaultUnit : value.unit;
                $p.data( 'unit', unit );
                $u.html( unit );

                var $pl = $('<span class="socss-hidden-placeholder"></span>')
                    .css({
                        'font-size' : '14px'
                    })
                    .html( value.value )
                    .appendTo( 'body' );
                var width = $pl.width();
                width = Math.min(width, 63);
                $pl.remove();

                $u.css('left', width + 12);
            } );

            // Now add the increment/decrement buttons
            var $diw = $('<div class="socss-diw"></div>').appendTo($p);
            var $dec = $('<div class="dec-button socss-button"><span class="fa fa-minus"></span></div>').appendTo($diw);
            var $inc = $('<div class="inc-button socss-button"><span class="fa fa-plus"></span></div>').appendTo($diw);

            // Increment is clicked
            $inc.click( function(){
                var value = thisView.parseUnits( $el.val() );
                if( value.value === '' ) {
                    return true;
                }

                var newVal = Math.ceil( value.value * 1.05 );

                $fi.val( newVal );
                updateValue();
                $el.trigger('change').trigger('measurement_refresh');
            } );

            $dec.click( function(){
                var value = thisView.parseUnits( $el.val() );
                if( value.value === '' ) {
                    return true;
                }

                var newVal = Math.floor( value.value / 1.05 );

                $fi.val( newVal );
                updateValue();
                $el.trigger('change').trigger('measurement_refresh');
            } );
        }

    } );

    // A simple measurement field
    socss.view.properties.controllers.number = socss.view.propertyController.extend( {

        render: function(){
            this.$el.append($(this.template({})));
            this.field = this.$('input');

            // Setup the measurement field
            this.setupNumberField(this.field, this.args);
        },

        /**
         * Setup the number field
         * @param el
         * @param options
         */
        setupNumberField: function($el, options){
            options = _.extend({
                change: null,
                default: 0,
                increment: 1,
                decrement: -1,
                max: null,
                min: null
            }, options);

            var $p = $el.parent();
            $p.addClass('socss-field-number');

            // Now add the increment/decrement buttons
            var $diw = $('<div class="socss-diw"></div>').appendTo($p);
            var $dec = $('<div class="dec-button socss-button">-</div>').appendTo($diw);
            var $inc = $('<div class="inc-button socss-button">+</div>').appendTo($diw);

            // Increment is clicked
            $diw.find('> div').click( function(e){
                e.preventDefault();

                var val = options.default;
                if( $el.val() !== '' ) {
                    val = Number($el.val());
                }
                val = val + ( $(this).is( $dec ) ? options.decrement : options.increment );

                val = Math.round(val*100)/100;

                if( options.max !== null ) {
                    val = Math.min( options.max, val);
                }

                if( options.min !== null ) {
                    val = Math.max( options.min, val);
                }

                $el.val( val );
                $el.trigger('change');
            } );

            return this;
        }

    } );


    socss.view.properties.controllers.sides = socss.view.propertyController.extend( {

        template: _.template( $('#template-sides-field').html().trim() ),

        controllers: [],

        render: function(){
            var thisView = this;

            this.$el.append( $(this.template({})) );
            this.field = this.$el.find('input');

            if( !thisView.args.hasAll ) {
                this.$('.select-tab').eq(0).remove();
                this.$('.select-tab').css('width', '25%');
            }

            this.$('.select-tab').each( function(){
                var dir = $(this).data('direction');

                var container = $('<li class="side">')
                    .appendTo( thisView.$('.sides') )
                    .hide();

                for( var i = 0; i < thisView.args.controllers.length; i++ ) {

                    var controllerArgs = thisView.args.controllers[i];

                    if( typeof socss.view.properties.controllers[ controllerArgs.type ] ) {

                        // Create the measurement view
                        var property = '';
                        if( dir === 'all' ) {
                            property = controllerArgs.args.propertyAll;
                        }
                        else {
                            property = controllerArgs.args.property.replace('{dir}', dir);
                        }

                        var theseControllerArgs = _.extend({}, controllerArgs.args, {property: property});

                        var controller = new socss.view.properties.controllers[ controllerArgs.type ]( {
                            el: $('<div>').appendTo( container ),
                            propertiesView: thisView.propertiesView,
                            args: theseControllerArgs
                        } );

                        // Setup and render the measurement controller and register it with the properties view
                        controller.render();
                        controller.initChangeEvents();
                        thisView.propertiesView.propertyControllers.push(controller);

                    }

                }

                $(this).on( 'click', function(){
                    thisView.$('.select-tab').removeClass('active');
                    $(this).addClass('active');

                    thisView.$('.sides .side').hide();
                    container.show();
                } );

            } );

            // Select the first tab by default
            this.$('.select-tab').eq(0).click();
        }

    } );

})(jQuery, _, socssOptions);

// Setup the main editor
jQuery(function ($) {
    var socss = window.socss;

    // Setup the editor
    var editor = new socss.view.editor({
        el: $('#so-custom-css-form').get(0)
    });
    editor.render();
    editor.setSnippets(socssOptions.snippets);

    window.socss.mainEditor = editor;

    // This is for hiding the getting started video
    $('#so-custom-css-getting-started a.hide').click( function(e){
        e.preventDefault();
        $('#so-custom-css-getting-started').slideUp();
        $.get( $(this).attr('href') );
    } );
});
