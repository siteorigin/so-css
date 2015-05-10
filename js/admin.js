/**
 * Copyright SiteOrigin 2014. Licensed under GPL 2.0
 */

/* globals jQuery, CodeMirror, confirm */

jQuery( function ( $ ) {
    var editor = CodeMirror.fromTextArea( $( '#custom-css-textarea' ).get( 0 ), {
        tabSize : 2,
        mode: 'css',
        theme:'neat',
        gutters: [
            "CodeMirror-lint-markers"
        ],
        lint: true,
        extraKeys: {
            Tab: function(cm) {
                var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
                cm.replaceSelection(spaces);
            }
        }
    } );

    // After CodeMirror is setup, we'll make overflow visible.
    $('#custom-css-container').css('overflow', 'visible');

    $('#so-custom-css-info a').click(function(e){
        if( !confirm( $(this).closest('ol').data('confirm') ) ) {
            e.preventDefault();
        }
    });

    // This is for the toolbars
    $('#css-insert-snippet').click( function(e){
        e.preventDefault();
        var $$ = $(this).blur();
        showSnippetBrowser();
    } );

    var browser = $('#snippet-browser');
    var showSnippetBrowser = function(){
        var active = browser.find('.snippets li.snippet.active');

        if( active.length === 0 ) {
            browser.find('.snippet-view').hide();
            browser.find('#so-insert-snippet').attr('disabled','disabled');
        }
        else {
            browser.find('.snippet-view').show();
            browser.find('#so-insert-snippet').removeAttr('disabled');
        }

        browser.find('#snippet-search').val('').keyup();

        browser.show();
    };

    // Set up the snippet browser
    browser.find('.toolbar .close').click(function(e){
        e.preventDefault();
        browser.hide();
    });

    browser.find('.snippets li.snippet').click(function(){
        var $$ = $(this);
        browser.find('.snippets li.snippet').removeClass('active');
        $$.addClass('active');
        browser.find('#so-insert-snippet').removeAttr('disabled');

        // Load the display
        var w = browser.find('.main .snippet-view');
        w.find('.snippet-title').html( $$.html() );
        w.find('.snippet-description').html( $$.data('description') );
        w.find('.snippet-code').html( $$.data('code') );
        browser.find('.snippet-view').show();
    });

    // Now handle the inset button click
    browser.find('#so-insert-snippet').click(function(){
        var active = browser.find('.snippets li.snippet.active');
        var css = active.data('code');
        browser.hide();

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
    });

    browser.find('#snippet-search').keyup( function(){
        var $s = $(this);

        if( $s.val() === '' ) {
            browser.find('.snippets li.snippet').show();
        }
        else {
            browser.find('.snippets li.snippet').each(function(){
                var $$ = $(this);

                var val = $s.val().toLowerCase();

                if( $$.html().toLowerCase().indexOf( val ) !== -1 || $$.data('description').toLowerCase().indexOf( val ) !== -1 ) {
                    $$.show();
                }
                else {
                    $$.hide();
                }
            });
        }
    } );

    // Handle expanding the editor into full screen mode.
    $('#css-editor-expand').click(function(e){
        e.preventDefault();
        var $$ = $(this);
        $$.blur();

        var form = $('#so-custom-css-form');

        form.toggleClass('expanded');
        if( form.hasClass('expanded') ) {
            $('body').css('overflow', 'hidden');

            var iframe = $('#custom-css-preview iframe');
            if( iframe.data('home') ) {
                iframe.attr('src', iframe.data('home') );
                iframe.data('home', false);
            }

            $(window).resize();
        }
        else {
            editor.setSize('100%', 'auto');
            $('body').css('overflow', 'visible');
        }
    });

    $(window).resize(function(){
        if( $('#so-custom-css-form').hasClass('expanded') ) {
            // If we're in the expanded view, then resize the editor
            editor.setSize('100%', $(window).outerHeight() - $('#custom-css-toolbar').outerHeight() );
        }
    });

    var updateInterval;
    // This is triggered every time we have new CSS
    var updatePreviewCss = function(){
        var preview = $('#custom-css-preview iframe');
        if( !preview.is(':visible') ) {
            return;
        }

        var head = preview.contents().find('head');
        if( head.find('style.siteorigin-custom-css').length === 0 ) {
            head.append('<style class="siteorigin-custom-css" type="text/css"></style>');
        }
        var style = head.find('style.siteorigin-custom-css');

        // Update the CSS after a short delay
        clearTimeout(updateInterval);
        updateInterval = setTimeout(function(){
            var css = editor.getValue();
            style.html(css);
        }, 250);
    };

    editor.on('change', function(cm, c){
        updatePreviewCss();
    });

    $('#custom-css-preview iframe').load( function(){
        var $$ = $(this);
        $$.contents().find('a').each(function(){
            var href = $(this).attr('href');

            var firstSeperator = (href.indexOf('?') === -1 ? '?' : '&');
            $(this).attr('href', href + firstSeperator + 'so_css_preview=1' );
        });

        updatePreviewCss();
    } );
} );