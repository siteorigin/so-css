
/* globals jQuery, cssjs */

jQuery( function($){
    var parser = new cssjs();
    var parsed = parser.parseCSS( $('#current-theme-css').html() );
} );