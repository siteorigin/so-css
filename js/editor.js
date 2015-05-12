
/* globals jQuery, _, socssOptions, Backbone, CodeMirror */

( function( $, _, socssOptions ){

    var socss = {
        model : { },
        collection : { },
        view : { },
        fn : {}
    };

    window.socss = socss;

    /**
     * The main CSS model.
     */
    socss.model.css = Backbone.Model.extend( {

        selectors: {},
        css: '',

        initialize: function( args ){
            this.css = args.css;
        },

        parse: function(css) {

        },

        /**
         * Add some CSS to the model
         */
        addCss: function(){

        }

    } );

    /**
     * Model for a CSS selector
     */
    socss.model.cssSelector = Backbone.Model.extend( {

        selector: '',
        specificity: 0,

        initialize: function(){

        }

    } );

    /**
     * Model for a CSS attribute and value
     */
    socss.model.cssAttr = Backbone.Model.extend( {

    } );

    /**
     * The toolbar view
     */
    socss.view.toolbar = Backbone.View.extend( {

        button: _.template('<li><a href="#" class="toolbar-button"><%= text %></a></li>'),

        initialize: function(){
            var thisView = this;
            this.$('.editor-expand').click(function(e){
                e.preventDefault();
                $(this).blur();
                thisView.trigger('click_expand');
            });

            this.$('.editor-inspector').click(function(e){
                e.preventDefault();
                var $$ = $(this);

                $$.blur();
                $$.toggleClass('active');
                var isActive = $$.is('.active');

                thisView.trigger('click_inspector', isActive);
            });
        },

        render: function(){

        },

        addButton: function( text, action ){
            var thisView = this;
            var button = $( this.button( { text: text } ) )
                .appendTo( this.$( '.toolbar-function-buttons .toolbar-buttons' ) )
                .click(function(e){
                    e.preventDefault();
                    $(this).blur();
                    thisView.trigger('click_' + action);
                });

            return button;
        }
    } );

    /**
     * The editor view, which handles codemirror stuff
     */
    socss.view.editor = Backbone.View.extend( {

        codeMirror : null,
        snippets: null,
        toolbar: null,

        initialize: function( args ){
            this.setupEditor();
        },

        render: function(){
            var thisView = this;

            // Setup the toolbar
            this.toolbar = new socss.view.toolbar( {
                el: this.$('.custom-css-toolbar')
            } );
            this.toolbar.render();

            this.toolbar.on('click_expand', function(){
                thisView.toggleExpand();
            });

            this.toolbar.on('click_inspector', function(active){
                if( active ) {
                    thisView.setExpand(true);
                    thisView.preview.startInspector();
                }
                else {
                    thisView.preview.stopInspector();
                }
            });

            this.preview = new socss.view.preview( {
                editor: this,
                el: this.$('.custom-css-preview')
            } );
            this.preview.render();
        },

        /**
         * Do the initial setup of the editor
         */
        setupEditor: function( ) {
            var thisView = this;

            // Setup the Codemirror instance
            this.codeMirror = CodeMirror.fromTextArea( this.$el.find('textarea.css-editor').get( 0 ), {
                tabSize : 2,
                mode: 'css',
                theme:'neat',
                gutters: [
                    "CodeMirror-lint-markers"
                ],
                lint: true,
                extraKeys: {
                }
            } );

            // Set the container to visible overflow once the editor is setup
            this.$el.find('.custom-css-container').css('overflow', 'visible');
            this.scaleEditor();

            // Scale the editor whenever the window is resized
            $(window).resize(function(){
                thisView.scaleEditor();
            });
        },

        /**
         * Scale the size of the editor depending on whether it's expanded or not
         */
        scaleEditor: function(){
            if( this.$el.hasClass('expanded') ) {
                // If we're in the expanded view, then resize the editor
                this.codeMirror.setSize('100%', $(window).outerHeight() - this.$('.custom-css-toolbar').outerHeight() );
            }
            else {
                this.codeMirror.setSize('100%', 'auto');
            }
        },

        /**
         * Toggle if this is expanded or not
         */
        toggleExpand: function(){
            this.$el.toggleClass('expanded');
            this.scaleEditor();
        },

        /**
         * Set the expanded state of the editor
         * @param expanded
         */
        setExpand: function( expanded ){
            if( expanded ) {
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
        setSnippets: function( snippets ){
            if( ! _.isEmpty( snippets ) ) {
                var thisView = this;

                this.snippets = new socss.view.snippets( {
                    snippets: snippets
                } );
                this.snippets.editor = this;

                this.snippets.render();
                this.toolbar.addButton('Snippets', 'snippets');
                this.toolbar.on('click_snippets', function(){
                    thisView.snippets.show();
                });
            }
        }

    } );

    /**
     * The preview.
     */
    socss.view.preview = Backbone.View.extend( {

        template: _.template('<iframe class="preview-iframe"></iframe>'),
        editor: null,

        initialize: function( attr ){
            this.editor = attr.editor;

            var thisView = this;
            this.editor.codeMirror.on('change', function(cm, c){
                thisView.updatePreviewCss();
            });
        },

        render: function(){
            var thisView = this;

            this.$el.html( this.template() );

            this.$('.preview-iframe')
                .attr( 'src', socssOptions.homeURL )
                .load( function(){
                    var $$ = $(this);
                    $$.contents().find('a').each( function(){
                        var href = $(this).attr('href');
                        var firstSeperator = (href.indexOf('?') === -1 ? '?' : '&');
                        $(this).attr('href', href + firstSeperator + 'so_css_preview=1' );
                    } );

                    thisView.updatePreviewCss();
                } );
        },

        updatePreviewCss: function(){
            var preview = this.$('.preview-iframe');
            if( preview.length === 0 ) {
                return;
            }

            if( !preview.is(':visible') ) {
                return;
            }

            var head = preview.contents().find('head');
            if( head.find('style.siteorigin-custom-css').length === 0 ) {
                head.append('<style class="siteorigin-custom-css" type="text/css"></style>');
            }
            var style = head.find('style.siteorigin-custom-css');

            // Update the CSS after a short delay
            var css = this.editor.codeMirror.getValue();
            style.html(css);
        },

        startInspector: function(){
            this.$('.preview-iframe')[0].contentWindow.startInspector();
        },

        stopInspector: function(){
            this.$('.preview-iframe')[0].contentWindow.stopInspector();
        }
    } );

    /**
     * The attribute controller type
     */
    socss.view.attrController = Backbone.View.extend( {

    } );

    /**
     * A single CSS snippet
     */
    socss.model.snippet = Backbone.Model.extend( {

    } );

    /**
     * A collection of snippets
     */
    socss.collection.snippets = Backbone.Collection.extend( {
        model: socss.model.snippet
    } );

    /**
     * The dialog for the snippets browser
     */
    socss.view.snippets = Backbone.View.extend( {
        template: _.template( $('#template-snippet-browser').html() ),
        snippet: _.template('<li class="snippet"><%- name %></li>'),
        className: 'css-editor-snippet-browser',
        snippets: null,
        editor: null,

        events: {
            'click .close' : 'hide',
            'click .buttons .insert-snippet' : 'insertSnippet'
        },

        currentSnippet: null,

        initialize: function( args ){
            this.snippets = args.snippets;
        },

        render: function(){
            var thisView = this;


            var clickSnippet = function(e){
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

            this.$el.html( this.template() );
            for( var i = 0; i < this.snippets.length; i++ ) {
                $( this.snippet( { name: this.snippets[i].Name } ) )
                    .data({
                        'description': this.snippets[i].Description,
                        'css': this.snippets[i].css
                    })
                    .appendTo( this.$('ul.snippets') )
                    .click( clickSnippet );
            }

            // Click on the first one
            thisView.$('.snippets li.snippet').eq(0).click();

            this.attach();
            return this;
        },

        viewSnippet: function( args ){
            var w = this.$('.main .snippet-view');

            w.find('.snippet-title').html( args.name );
            w.find('.snippet-description').html( args.description );
            w.find('.snippet-code').html( args.css );

            this.currentSnippet = args;
        },

        insertSnippet: function(){
            var editor = this.editor.codeMirror;
            var css = this.currentSnippet.css;

            var before_css = '';
            if( editor.doc.lineCount() === 1 && editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
                before_css = "";
            }
            else if( editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
                before_css = "\n";
            }
            else {
                before_css = "\n\n";
            }

            // Now insert the code in the editor
            editor.doc.setCursor(
                editor.doc.lastLine(),
                editor.doc.getLine( editor.doc.lastLine() ).length
            );
            editor.doc.replaceSelection( before_css + css );

            this.hide();
        },

        attach: function(){
            this.$el.appendTo('body');
        },

        show: function(){
            this.$el.show();
        },

        hide: function(){
            this.$el.hide();
        }
    } );

    socss.fn = {
        /**
         * Get the specificity for a given selector.
         * @param selector
         * @return {number}
         * @todo implement this.
         */
        selectorSpecificity: function( selector ){
            return 5;
        }

    };

} ) ( jQuery, _, socssOptions );

// Setup the main editor
jQuery( function($){
    var socss = window.socss;

    // Setup the editor
    var editor = new socss.view.editor( {
        el : $('#so-custom-css-form').get(0)
    } );
    editor.render();
    editor.setSnippets( socssOptions.snippets );
} );