
/* jQuery */

(function($){

    $.fn.socss = {};

    $.fn.socssSimpleTabs = function( options ){
        options = $.extend(options, {
            clickTab: null
        });

        return this.each(function(){
            var $$ = $(this);
        });

    };

    $.fn.socssMeasurementField = function( options ){

        var units = [
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
        ];

        var parseUnits = function( value ){
            var escapeRegExp = function(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            };

            var regexUnits = units.map(escapeRegExp);
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
        };

        var wrapperClass = 'socss-field-measurement';

        options = $.extend(options, {
            increment: null,
            decrement: null,
            defaultUnit: 'px'
        });

        return this.each(function(){
            var $$ = $(this);
            var $p = $$.parent();

            $$.hide();
            $p.addClass( wrapperClass).data('unit', options.defaultUnit);

            // Create the fake input field
            var $fi = $('<input type="text" class="socss-field-input"/>').appendTo($p);
            var $da = $('<span class="dashicons dashicons-arrow-down"></span>').appendTo($p);
            var $dd = $('<ul class="dropdown"></ul>').appendTo($p);
            var $u = $('<span class="units"></span>').html( options.defaultUnit ).appendTo( $p );

            for( var i = 0; i < units.length; i++ ) {
                var $o = $('<li></li>').html( units[i] ).data('unit', units[i]);
                if( units[i] === options.defaultUnit ) {
                    $o.addClass('active');
                }
                $dd.append( $o );
            }

            var updateValue = function(){
                var value = parseUnits( $fi.val() );
                $fi.val( value.value );

                if( value.value === '' ) {
                    $$.val( '' );
                }
                else {
                    $$.val( value.value + $p.data( 'unit' ) );
                }
            };

            var setUnit = function( unit ){
                $u.html( unit );
                $p.data( 'unit', unit );
            };

            $da.click( function(){
                $dd.toggle();
            } );

            $dd.find('li').click( function(){
                $dd.toggle();
                $dd.find('li').removeClass('active');
                $(this).addClass('active');
                setUnit( $(this).data('unit') );
                updateValue();
                $$.trigger('change');
            } );

            $fi.on( 'keyup keydown', function(e){
                var $$ = $(this);
                var value = parseUnits( $$.val() );

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
                    .html( value.value + char )
                    .appendTo( 'body' );
                var width = $pl.width();
                width = Math.min(width, 63);
                $pl.remove();

                $u.css('left', width + 12);
            } );

            $fi.on('keyup', function(){
                updateValue();
                $$.trigger('change');
            } );

            $$.on('measurement_refresh', function(){
                var value = parseUnits( $$.val() );
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
                var value = parseUnits( $$.val() );
                if( value.value === '' ) {
                    return true;
                }

                var newVal = Math.ceil( value.value * 1.05 );

                $fi.val( newVal );
                updateValue();
                $$.trigger('change').trigger('measurement_refresh');
            } );

            $dec.click( function(){
                var value = parseUnits( $$.val() );
                if( value.value === '' ) {
                    return true;
                }

                var newVal = Math.floor( value.value / 1.05 );

                $fi.val( newVal );
                updateValue();
                $$.trigger('change').trigger('measurement_refresh');
            } );

        });

    };

    $.fn.socssNumberField = function( options ){
        options = $.extend(options, {
            change: null,
            increment: 1,
            decrement: -1
        });

        return this.each( function(){

            var $$ = $(this);
            var $p = $$.parent();
            $p.addClass('socss-field-number');

            // Now add the increment/decrement buttons
            var $diw = $('<div class="socss-diw"></div>').appendTo($p);
            var $dec = $('<div class="dec-button socss-button">-</div>').appendTo($diw);
            var $inc = $('<div class="inc-button socss-button">+</div>').appendTo($diw);

            // Increment is clicked
            $diw.find('> div').click( function(e){
                e.preventDefault();

                var newVal = Math.ceil( Number($$.val()) + ( $(this).is( $dec ) ? options.decrement : options.increment ) );
                console.log(newVal);

                $$.val( newVal );
                $$.trigger('change');
            } );
        } );
    };

})(jQuery);