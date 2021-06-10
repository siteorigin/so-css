/* globals jQuery, _, socssOptions, Backbone, CodeMirror, console, cssjs, wp */

( function ( $, _, socssOptions ) {
	
	var socss = {
		model: {},
		collection: {},
		view: {},
		fn: {}
	};
	
	window.socss = socss;
	
	socss.model.CustomCssModel = Backbone.Model.extend( {
		defaults: {
			postId: null,
			postTitle: null,
			css: null,
		},
		
		urlRoot: socssOptions.postCssUrlRoot,
		
		url: function () {
			return this.urlRoot + '&postId=' + this.get( 'postId' );
		}
	} );
	
	socss.model.CustomCssCollection = Backbone.Collection.extend( {
		model: socss.model.CustomCssModel,
		
		modelId: function( attrs ) {
			return attrs.postId;
		},
	} );
	
	socss.model.CSSEditorModel = Backbone.Model.extend( {
		defaults: {
			customCssPosts: null,
		}
	} );
	
	/**
	 * The toolbar view
	 */
	socss.view.toolbar = Backbone.View.extend( {
		
		button: _.template( '<li><a href="#<%= action %>" class="toolbar-button socss-button"><%= text %></a></li>' ),
		
		events: {
			'click .socss-button': 'triggerEvent',
		},
		
		triggerEvent: function ( event ) {
			event.preventDefault();
			var $target = $( event.currentTarget );
			$target.trigger( 'blur' );
			var value = $target.attr( 'href' ).replace( '#', '' );
			this.$el.trigger( 'click_' + value );
		},
		
		addButton: function ( text, action ) {
			var button = $( this.button( { text: text, action: action } ) )
			.appendTo( this.$( '.toolbar-function-buttons .toolbar-buttons' ) );
			
			return button;
		},
	} );
	
	/**
	 * The editor view, which handles codemirror stuff
	 *
	 * model: socss.model.CSSEditorModel
	 *
	 */
	socss.view.editor = Backbone.View.extend( {
		
		codeMirror: null,
		snippets: null,
		toolbar: null,
		visualProperties: null,
		
		inspector: null,
		
		cssSelectors: [],
		
		initValue: null,
		
		events: {
			'click_expand .custom-css-toolbar': 'toggleExpand',
			'click_visual .custom-css-toolbar': 'showVisualEditor',
			'submit': 'onSubmit',
		},
		
		initialize: function ( options ) {
			
			this.listenTo( this.model, 'change:selectedPost', this.getSelectedPostCss );
			
			this.getSelectedPostCss().then( function () {
				
				if ( options.openVisualEditor ) {
					this.showVisualEditor();
				}
			}.bind( this ) );
			
		},
		
		getSelectedPostCss: function () {
			var selectedPost = this.model.get( 'selectedPost' );
			var promise;
			if ( selectedPost && ! selectedPost.has( 'css' ) ) {
				promise = selectedPost.fetch();
			} else {
				promise = new $.Deferred().resolve();
			}
			
			return promise.then( this.render.bind( this ) );
		},
		
		render: function () {
			
			var selectedPost = this.model.get( 'selectedPost' );
			
			if ( selectedPost && !selectedPost.has( 'css' ) ) {
				return this;
			}
			
			if ( !this.codeMirror ) {
				this.setupEditor();
			}
			
			if ( ! this.toolbar ) {
				this.toolbar = new socss.view.toolbar( {
					el: this.$( '.custom-css-toolbar' ),
					model: this.model,
				} );
				this.toolbar.render();
			}
			
			if ( !this.visualProperties ) {
				this.visualProperties = new socss.view.properties( {
					editor: this,
					el: $( '#so-custom-css-properties' )
				} );
				this.visualProperties.render();
			}
			
			if ( !this.preview ) {
				this.preview = new socss.view.preview( {
					editor: this,
					model: this.model,
					el: this.$( '.custom-css-preview' ),
					initURL: socssOptions.homeURL,
				} );
				this.preview.render();
			}
			
			if ( selectedPost ) {
				this.codeMirror.setValue( selectedPost.get( 'css' ) );
				this.codeMirror.clearHistory();
			}
			
			return this;
		},
		
		/**
		 * Do the initial setup of the CodeMirror editor
		 */
		setupEditor: function () {			
			// Setup the Codemirror instance
			var $textArea = this.$( 'textarea.css-editor' );
			this.initValue = $textArea.val();
			// Pad with empty lines so the editor takes up all the white space. To try make sure user gets copy/paste
			// options in context menu.
			var newlineMatches = this.initValue.match( /\n/gm );
			var lineCount = newlineMatches ? newlineMatches.length + 1 : 1;
			var paddedValue = this.initValue;
			$textArea.val( paddedValue );

			var codeMirrorSettings = {
				tabSize: 2,
				lineNumbers: true,
				mode: 'css',
				theme: 'neat',
				inputStyle: 'contenteditable', //necessary to allow context menu (right click) copy/paste etc.
				gutters: [
					"CodeMirror-lint-markers"
				],
				lint: true,
				search: true,
				dialog: true,
				annotateScrollbar: true,
				extraKeys: {
					'Ctrl-F': 'findPersistent',
					'Alt-G': 'jumpToLine',
				},
			}

			if ( typeof wp.codeEditor != "undefined" ) {
				codeMirrorSettings = _.extend(
					wp.codeEditor.defaultSettings.codemirror,
					codeMirrorSettings
				);
				this.codeMirror = wp.codeEditor.initialize( $textArea.get( 0 ), codeMirrorSettings ).codemirror;
			} else {
				this.registerCodeMirrorAutocomplete();
				this.codeMirror = CodeMirror.fromTextArea( $textArea.get( 0 ), codeMirrorSettings );
				this.setupCodeMirrorExtensions();
			}
			
			this.codeMirror.on( 'change', function ( cm, change ) {
				var selectedPost = this.model.get( 'selectedPost' );
				if ( selectedPost && selectedPost.get( 'css' ) !== cm.getValue().trim() ) {
					selectedPost.set( 'css', cm.getValue().trim() );
				}
			}.bind( this ) );
			
			// Make sure the user doesn't leave without saving
			$( window ).on( 'beforeunload', function () {
				var editorValue = this.codeMirror.getValue().trim();
				if ( editorValue !== this.initValue ) {
					return socssOptions.loc.leave;
				}
			}.bind( this ) );
			
			
			// Set the container to visible overflow once the editor is setup
			this.$el.find( '.custom-css-container' ).css( 'overflow', 'visible' );
			this.scaleEditor();
			
			// Scale the editor whenever the window is resized
			$( window ).on( 'resize', function () {
				this.scaleEditor();
			}.bind( this ) );
		},
		
		onSubmit: function () {
			this.initValue = this.codeMirror.getValue().trim();
		},
		
		/**
		 * Register the autocomplete helper. Based on css-hint.js in the codemirror addon folder.
		 */
		registerCodeMirrorAutocomplete: function () {
			var pseudoClasses = {
				link: 1, visited: 1, active: 1, hover: 1, focus: 1,
				"first-letter": 1, "first-line": 1, "first-child": 1,
				before: 1, after: 1, lang: 1
			};
			
			CodeMirror.registerHelper( "hint", "css", function ( cm ) {
				var cur = cm.getCursor(), token = cm.getTokenAt( cur );
				var inner = CodeMirror.innerMode( cm.getMode(), token.state );
				if ( inner.mode.name !== "css" ) {
					return;
				}
				
				if ( token.type === "keyword" && "!important".indexOf( token.string ) === 0 ) {
					return {
						list: [ "!important" ], from: CodeMirror.Pos( cur.line, token.start ),
						to: CodeMirror.Pos( cur.line, token.end )
					};
				}
				
				var start = token.start, end = cur.ch, word = token.string.slice( 0, end - start );
				if ( /[^\w$_-]/.test( word ) ) {
					word = "";
					start = end = cur.ch;
				}
				
				var spec = CodeMirror.resolveMode( "text/css" );
				
				var result = [];
				
				function add( keywords ) {
					for ( var name in keywords ) {
						if ( !word || name.lastIndexOf( word, 0 ) === 0 ) {
							result.push( name );
						}
					}
				}
				
				var st = inner.state.state;
				
				if ( st === 'top' ) {
					// We're going to autocomplete the selector using our own set of rules
					var line = cm.getLine( cur.line ).trim();
					
					var selectors = this.cssSelectors;
					for ( var i = 0; i < selectors.length; i++ ) {
						if ( selectors[ i ].selector.indexOf( line ) !== -1 ) {
							result.push( selectors[ i ].selector );
						}
					}
					
					if ( result.length ) {
						return {
							list: result,
							from: CodeMirror.Pos( cur.line, 0 ),
							to: CodeMirror.Pos( cur.line, end )
						};
					}
				}
				else {
					
					if ( st === "pseudo" || token.type === "variable-3" ) {
						add( pseudoClasses );
					}
					else if ( st === "block" || st === "maybeprop" ) {
						add( spec.propertyKeywords );
					}
					else if ( st === "prop" || st === "parens" || st === "at" || st === "params" ) {
						add( spec.valueKeywords );
						add( spec.colorKeywords );
					}
					else if ( st === "media" || st === "media_parens" ) {
						add( spec.mediaTypes );
						add( spec.mediaFeatures );
					}
					
					if ( result.length ) {
						return {
							list: result,
							from: CodeMirror.Pos( cur.line, start ),
							to: CodeMirror.Pos( cur.line, end )
						};
					}
					
				}
				
			}.bind( this ) );
		},
		
		setupCodeMirrorExtensions: function () {
			
			this.codeMirror.on( 'cursorActivity', function ( cm ) {
				var cur = cm.getCursor(), token = cm.getTokenAt( cur );
				var inner = CodeMirror.innerMode( cm.getMode(), token.state );
				
				// If we have a qualifier selected, then highlight that in the preview
				if ( token.type === 'qualifier' || token.type === 'tag' || token.type === 'builtin' ) {
					var line = cm.getLine( cur.line );
					var selector = line.substring( 0, token.end );
					
					this.preview.highlight( selector );
				}
				else {
					this.preview.clearHighlight();
				}
			}.bind( this ) );
			
			if ( typeof CodeMirror.showHint == 'function' ) {
				// This sets up automatic autocompletion at all times
				this.codeMirror.on( 'keyup', function ( cm, e ) {
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
				} );
			}
		},
		
		/**
		 * Scale the size of the editor depending on whether it's expanded or not
		 */
		scaleEditor: function () {
			var windowHeight = $( window ).outerHeight();
			var areaHeight;
			if ( this.$el.hasClass( 'expanded' ) ) {
				// If we're in the expanded view, then resize the editor
				this.$el.find( '.CodeMirror-scroll' ).css( 'max-height', '' );
				areaHeight = windowHeight - this.$( '.custom-css-toolbar' ).outerHeight();
				this.codeMirror.setSize( '100%', areaHeight );
			}
			else {
				// Attempt to calculate approximate space available for editor when not expanded.
				var $form = $( '#so-custom-css-form' );
				var otherEltsHeight = $( '#wpadminbar' ).outerHeight( true ) +
					$( '#siteorigin-custom-css' ).find( '> h2' ).outerHeight( true ) +
					$form.find( '> .custom-css-toolbar' ).outerHeight( true ) +
					$form.find( '> p.description' ).outerHeight( true ) +
					parseFloat( $( '#wpbody-content' ).css( 'padding-bottom' ) );

				areaHeight = windowHeight - otherEltsHeight;
				// The container has a min-height of 300px so we need to ensure the areaHeight is at least that large.
				if ( areaHeight < 300 ) {
					areaHeight = 300;
				}

				this.$el.find( '.CodeMirror-scroll' ).css( 'min-height', areaHeight + 'px' );
				this.codeMirror.setSize( '100%', 'auto' );
			}
			this.$el.find( '.CodeMirror-code' ).css( 'min-height', areaHeight + 'px' );
		},
		
		/**
		 * Check if the editor is in expanded mode
		 * @returns bool
		 */
		isExpanded: function () {
			return this.$el.hasClass( 'expanded' );
		},
		
		/**
		 * Toggle if this is expanded or not
		 */
		toggleExpand: function () {
			this.$el.toggleClass( 'expanded' );
			this.scaleEditor();
		},
		
		/**
		 * Set the expanded state of the editor
		 * @param expanded
		 */
		setExpand: function ( expanded ) {
			if ( expanded ) {
				this.$el.addClass( 'expanded' );
			}
			else {
				this.$el.removeClass( 'expanded' );
			}
			this.scaleEditor();
		},
		
		/**
		 * Show the visual editor view.
		 */
		showVisualEditor: function () {
			this.visualProperties.loadCSS( this.codeMirror.getValue().trim() );
			this.visualProperties.show();
		},
		
		/**
		 * Set the snippets available to this editor
		 */
		setSnippets: function ( snippets ) {
			if ( !_.isEmpty( snippets ) ) {
				
				this.snippets = new socss.view.snippets( {
					snippets: snippets
				} );
				this.snippets.editor = this;
				
				this.snippets.render();
				this.toolbar.addButton( 'Snippets', 'snippets' );
				this.toolbar.on( 'click_snippets', function () {
					this.snippets.show();
				}.bind( this ) );
			}
		},
		
		/**
		 * Add some CSS to the editor.
		 * @param css
		 */
		addCode: function ( css ) {
			var editor = this.codeMirror;
			
			var before_css = '';
			if ( editor.doc.lineCount() === 1 && editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
				before_css = "";
			}
			else if ( editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
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
		},
		
		addEmptySelector: function ( selector ) {
			this.addCode( selector + " {\n  \n}" );
		},
		
		/**
		 * Sets the inspector view that's being used by the editor
		 */
		setInspector: function ( inspector ) {
			this.inspector = inspector;
			this.cssSelectors = inspector.pageSelectors;
			
			// A selector is clicked in the inspector
			inspector.on( 'click_selector', function ( selector ) {
				if ( this.visualProperties.isVisible() ) {
					this.visualProperties.addSelector( selector );
				}
				else {
					this.addEmptySelector( selector );
				}
			}.bind( this ) );
			
			// A property is clicked in the inspector
			inspector.on( 'click_property', function ( property ) {
				if ( !this.visualProperties.isVisible() ) {
					this.codeMirror.replaceSelection( property + ";\n  " );
				}
			}.bind( this ) );
			
			inspector.on( 'set_active_element', function ( el, selectors ) {
				if ( this.visualProperties.isVisible() && selectors.length ) {
					this.visualProperties.addSelector( selectors[ 0 ].selector );
				}
			}.bind( this ) );
		}
		
	} );
	
	/**
	 * The preview.
	 */
	socss.view.preview = Backbone.View.extend( {
		
		template: _.template( $( '#template-preview-window' ).html() ),
		editor: null,
		originalUri: null,
		currentUri: null,
		
		events: {
			'mouseleave #preview-iframe': 'clearHighlight',
			'keydown #preview-navigator input[type="text"]': 'reloadPreview',
		},
		
		initialize: function ( attr ) {
			this.editor = attr.editor;
			
			this.listenTo( this.model, 'change:selectedPost', this.render.bind( this ) );
			
			this.originalUri = new URI( attr.initURL );
			this.currentUri = new URI( attr.initURL );
			
			this.editor.codeMirror.on( 'change', function ( cm, c ) {
				this.updatePreviewCss();
			}.bind( this ) );
		},
		
		render: function () {
			
			var selectedPost = this.model.get( 'selectedPost' );
			
			if ( selectedPost && !selectedPost.has( 'postUrl' ) ) {
				selectedPost.fetch().then( this.render.bind( this ) );
				return this;
			}
			
			this.$el.html( this.template() );
			
			if ( selectedPost ) {
				this.currentUri = new URI( selectedPost.get( 'postUrl' ) );
			}
			
			this.currentUri.removeQuery( 'so_css_preview', 1 );
			this.$( '#preview-navigator input' ).val( this.currentUri.toString() );
			this.currentUri.addQuery( 'so_css_preview', 1 );
			
			this.$( '#preview-iframe' )
				.attr( 'src', this.currentUri.toString() )
				// 'load' event doesn't bubble so can't be used in the events hash
				.on( 'load', this.initPreview.bind( this ) );
		},
		
		initPreview: function () {
			var $$ = this.$( '#preview-iframe' );
			
			// Update the current URI with the iframe URI
			this.currentUri = new URI( $$.contents().get( 0 ).location.href );
			this.currentUri.removeQuery( 'so_css_preview' );
			this.$( '#preview-navigator input' ).val( this.currentUri.toString() );
			this.currentUri.addQuery( 'so_css_preview', 1 );

			var wcCheck = $$.contents().find( '.single-product' ).length;
			$$.contents().find( 'a' ).each( function () {
				var link = $( this );
				var href = link.attr( 'href' );
				if ( href === undefined || ( wcCheck && link.parents( '.wc-tabs' ).length ) ) {
					return true;
				}

				var firstSeperator = ( href.indexOf( '?' ) === -1 ? '?' : '&' );
				link.attr( 'href', href + firstSeperator + 'so_css_preview=1' );
			} );
			
			this.updatePreviewCss();
		},
		
		reloadPreview: function ( e ) {
			var $$ = this.$( '#preview-navigator input[type="text"]' );
			
			if ( e.keyCode === 13 ) {
				e.preventDefault();
				
				var newUri = new URI( $$.val() );
				
				// Validate the URI
				if (
					this.originalUri.host() !== newUri.host() ||
					this.originalUri.protocol() !== newUri.protocol()
				) {
					$$.trigger( 'blur' );
					alert( $$.data( 'invalid-uri' ) );
					$$.trigger( 'focus' );
				}
				else {
					newUri.addQuery( 'so_css_preview', 1 );
					this.$( '#preview-iframe' ).attr( 'src', newUri.toString() );
				}
			}
		},
		
		/**
		 * Update the preview CSS from the CodeMirror value in the editor
		 */
		updatePreviewCss: function () {
			var preview = this.$( '#preview-iframe' );
			if ( preview.length === 0 ) {
				return;
			}
			
			var head = preview.contents().find( 'head' );
			if ( head.find( 'style.siteorigin-custom-css' ).length === 0 ) {
				head.append( '<style class="siteorigin-custom-css" type="text/css"></style>' );
			}
			var style = head.find( 'style.siteorigin-custom-css' );
			
			// Update the CSS after a short delay
			var css = this.editor.codeMirror.getValue().trim();
			style.html( css );
		},
		
		/**
		 * Highlight all elements with a given selector
		 */
		highlight: function ( selector ) {
			try {
				this.editor.inspector.hl.highlight( selector );
			}
			catch ( err ) {
				console.log( 'No inspector to highlight with' );
			}
		},
		
		/**
		 * Clear the currently highlighted elements in preview
		 */
		clearHighlight: function () {
			try {
				this.editor.inspector.hl.clear();
			}
			catch ( err ) {
				console.log( 'No inspector to highlight with' );
			}
		}
		
	} );
	
	/**
	 * The dialog for the snippets browser
	 */
	socss.view.snippets = Backbone.View.extend( {
		template: _.template( $( '#template-snippet-browser' ).html() ),
		snippet: _.template( '<li class="snippet"><%- name %></li>' ),
		className: 'css-editor-snippet-browser',
		snippets: null,
		editor: null,
		
		events: {
			'click .close': 'hide',
			'click .buttons .insert-snippet': 'insertSnippet',
			'click .snippet': 'clickSnippet',
		},
		
		currentSnippet: null,
		
		initialize: function ( args ) {
			this.snippets = args.snippets;
		},
		
		render: function () {
			this.$el.html( this.template() );
			for ( var i = 0; i < this.snippets.length; i++ ) {
				$( this.snippet( { name: this.snippets[ i ].Name } ) )
				.data( {
					'description': this.snippets[ i ].Description,
					'css': this.snippets[ i ].css
				} )
				.appendTo( this.$( 'ul.snippets' ) );
			}
			
			// Click on the first one
			this.$( '.snippets li.snippet' ).eq( 0 ).trigger( 'click' );
			
			this.attach();
			return this;
		},
		
		clickSnippet: function ( event ) {
			event.preventDefault();
			var $$ = $( event.currentTarget );
			
			this.$( '.snippets li.snippet' ).removeClass( 'active' );
			$( this ).addClass( 'active' );
			this.viewSnippet( {
				name: $$.html(),
				description: $$.data( 'description' ),
				css: $$.data( 'css' )
			} );
		},
		
		viewSnippet: function ( args ) {
			var w = this.$( '.main .snippet-view' );
			
			w.find( '.snippet-title' ).html( args.name );
			w.find( '.snippet-description' ).html( args.description );
			w.find( '.snippet-code' ).html( args.css );
			
			this.currentSnippet = args;
		},
		
		insertSnippet: function () {
			var editor = this.editor.codeMirror;
			var css = this.currentSnippet.css;
			
			var before_css = '';
			if ( editor.doc.lineCount() === 1 && editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
				before_css = "";
			}
			else if ( editor.doc.getLine( editor.doc.lastLine() ).length === 0 ) {
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
		
		attach: function () {
			this.$el.appendTo( 'body' );
		},
		
		show: function () {
			this.$el.show();
		},
		
		hide: function () {
			this.$el.hide();
		}
	} );
	
	
	/**
	 * The visual properties editor
	 */
	socss.view.properties = Backbone.View.extend( {
		
		tabTemplate: _.template( '<li data-section="<%- id %>"><span class="fa fa-<%- icon %>"></span> <%- title %></li>' ),
		sectionTemplate: _.template( '<div class="section" data-section="<%- id %>"><table class="fields-table"><tbody></tbody></table></div>' ),
		controllerTemplate: _.template( '<tr><th scope="row"><%- title %></th><td></td></tr>' ),
		
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
			'click .close': 'hide',
			'click .section-tabs li': 'onTabClick',
			'change .toolbar select': 'onToolbarSelectChange',
		},
		
		/**
		 * Initialize the properties editor with a new model
		 */
		initialize: function ( options ) {
			this.parser = window.css;
			this.editor = options.editor;
		},
		
		/**
		 * Render the property editor
		 */
		render: function () {
			// Clean up for potential re-renders
			this.$( '.section-tabs' ).empty();
			this.$( '.sections' ).empty();
			this.$( '.toolbar select' ).off();
			this.propertyControllers = [];
			
			var controllers = socssOptions.propertyControllers;
			
			for ( var id in controllers ) {
				// Create the tabs
				var $t = $( this.tabTemplate( {
					id: id,
					icon: controllers[ id ].icon,
					title: controllers[ id ].title
				} ) ).appendTo( this.$( '.section-tabs' ) );
				
				// Create the section wrapper
				var $s = $( this.sectionTemplate( {
					id: id
				} ) ).appendTo( this.$( '.sections' ) );
				
				// Now lets add the controllers
				if ( !_.isEmpty( controllers[ id ].controllers ) ) {
					
					for ( var i = 0; i < controllers[ id ].controllers.length; i++ ) {
						
						var $c = $( this.controllerTemplate( {
							title: controllers[ id ].controllers[ i ].title
						} ) ).appendTo( $s.find( 'tbody' ) );
						
						var controllerAtts = controllers[ id ].controllers[ i ];
						var controller;
						
						if ( typeof socss.view.properties.controllers[ controllerAtts.type ] === 'undefined' ) {
							// Setup a default controller
							controller = new socss.view.propertyController( {
								el: $c.find( 'td' ),
								propertiesView: this,
								args: ( typeof controllerAtts.args === 'undefined' ? {} : controllerAtts.args )
							} );
						}
						else {
							// Setup a specific controller
							controller = new socss.view.properties.controllers[ controllerAtts.type ]( {
								el: $c.find( 'td' ),
								propertiesView: this,
								args: ( typeof controllerAtts.args === 'undefined' ? {} : controllerAtts.args )
							} );
						}
						
						this.propertyControllers.push( controller );
						
						// Setup and render the controller
						controller.render();
					}
				}
			}
			
			// Switch to the first tab.
			this.$( '.section-tabs li' ).eq( 0 ).trigger( 'click' );
		},
		
		onTabClick: function ( event ) {
			var $$ = $( event.currentTarget );
			var show = this.$( '.sections .section[data-section="' + $$.data( 'section' ) + '"]' );
			
			this.$( '.sections .section' ).not( show ).hide().removeClass( 'active' );
			show.show().addClass( 'active' );
			
			this.$( '.section-tabs li' ).not( $$ ).removeClass( 'active' );
			$$.addClass( 'active' );
		},
		
		onToolbarSelectChange: function ( event ) {
			this.setActiveSelector( $( event.currentTarget ).find( ':selected' ).data( 'selector' ) );
		},
		
		/**
		 * Sets the rule value for the active selector
		 * @param rule
		 * @param value
		 */
		setRuleValue: function ( rule, value ) {
			if (
				typeof this.activeSelector === 'undefined' ||
				typeof this.activeSelector.declarations === 'undefined'
			) {
				return;
			}
			
			var declarations = this.activeSelector.declarations;
			var newRule = true;
			var valueChanged = false;
			for ( var i = 0; i < declarations.length; i++ ) {
				if ( declarations[ i ].property === rule ) {
					newRule = false;
					var declaration = declarations[ i ];
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
				declarations.push( {
					property: rule,
					value: value,
					type: 'declaration',
				} );
				valueChanged = true;
			}
			
			if ( valueChanged ) {
				this.updateMainEditor( false );
			}
		},
		
		/**
		 * Adds the @import rule value if it doesn't already exist.
		 *
		 * @param newRule
		 *
		 */
		addImport: function ( newRule ) {
			
			// get @import rules
			// check if any have the same value
			// if not, then add the new @ rule
			
			var importRules = _.filter( this.parsed.stylesheet.rules, function ( rule ) {
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
		findImport: function ( value ) {
			return _.find( this.parsed.stylesheet.rules, function ( rule ) {
				return rule.type === 'import' && rule.import.indexOf( value ) > -1;
			} );
		},
		
		/**
		 * Find @import which completely or partially contains the identifier value and update it's import property.
		 *
		 * @param identifier
		 * @param value
		 */
		updateImport: function ( identifier, value ) {
			var importRule = this.findImport( identifier );
			if ( importRule.import !== value.import ) {
				importRule.import = value.import;
				this.updateMainEditor( false );
			}
		},
		
		/**
		 * Find @import which completely or partially contains the identifier value and remove it.
		 *
		 * @param identifier
		 */
		removeImport: function ( identifier ) {
			var importIndex = _.findIndex( this.parsed.stylesheet.rules, function ( rule ) {
				return rule.type === 'import' && rule.import.indexOf( identifier ) > -1;
			} );
			if ( importIndex > -1 ) {
				this.parsed.stylesheet.rules.splice( importIndex, 1 );
			}
		},
		
		/**
		 * Get the rule value for the active selector
		 * @param rule
		 */
		getRuleValue: function ( rule ) {
			if ( typeof this.activeSelector === 'undefined' || typeof this.activeSelector.declarations === 'undefined' ) {
				return '';
			}
			
			var declarations = this.activeSelector.declarations;
			for ( var i = 0; i < declarations.length; i++ ) {
				if ( declarations[ i ].property === rule ) {
					return declarations[ i ].value;
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
			this.editor.setExpand( true );
			
			this.$el.show().animate( { 'left': 0 }, 'fast' );
		},
		
		/**
		 * Hide the properties editor
		 */
		hide: function () {
			this.editor.setExpand( this.editorExpandedBefore );
			this.$el.animate( { 'left': -338 }, 'fast', function () {
				$( this ).hide();
			} );
			
			// Update the main editor with compressed CSS when we close the properties editor
			this.updateMainEditor( true );
		},
		
		/**
		 * @returns boolean
		 */
		isVisible: function () {
			return this.$el.is( ':visible' );
		},
		
		/**
		 * Loads a single CSS selector and associated properties into the model
		 * @param css
		 */
		loadCSS: function ( css, activeSelector ) {
			this.css = css;
			
			// Load the CSS
			this.parsed = this.parser.parse( css, {
				silent: true
			} );
			var rules = this.parsed.stylesheet.rules;
			
			// Add the dropdown menu items
			var dropdown = this.$( '.toolbar select' ).empty();
			for ( var i = 0; i < rules.length; i++ ) {
				var rule = rules[ i ];
				
				// Exclude @import statements
				if ( !_.contains( [ 'rule', 'media' ], rule.type ) ) {
					continue;
				}
				
				if ( rule.type === 'media' ) {
					
					for ( var j = 0; j < rule.rules.length; j++ ) {
						var mediaRule = '@media ' + rule.media;
						var subRule = rule.rules[ j ];
						if ( subRule.type != 'rule' ) {
							continue;
						}
						dropdown.append(
							$( '<option>' )
							.html( mediaRule + ': ' + subRule.selectors.join( ',' ) )
							.attr( 'val', mediaRule + ': ' + subRule.selectors.join( ',' ) )
							.data( 'selector', subRule )
						);
					}
					
				}
				else {
					dropdown.append(
						$( '<option>' )
						.html( rule.selectors.join( ',' ) )
						.attr( 'val', rule.selectors.join( ',' ) )
						.data( 'selector', rule )
					);
				}
			}
			
			if ( typeof activeSelector === 'undefined' ) {
				activeSelector = dropdown.find( 'option' ).eq( 0 ).attr( 'val' );
			}
			if ( !_.isEmpty( activeSelector ) ) {
				dropdown.val( activeSelector ).trigger( 'change' );
			}
		},
		
		/**
		 * Set the selector that we're currently dealing with
		 * @param selector
		 */
		setActiveSelector: function ( selector ) {
			this.activeSelector = selector;
			for ( var i = 0; i < this.propertyControllers.length; i++ ) {
				this.propertyControllers[ i ].refreshFromRule();
			}
		},
		
		/**
		 * Add or select a selector.
		 *
		 * @param selector
		 */
		addSelector: function ( selector ) {
			// Check if this selector already exists
			var dropdown = this.$( '.toolbar select' );
			dropdown.val( selector );
			
			if ( dropdown.val() === selector ) {
				// Trigger a change event to load the existing selector
				dropdown.trigger( 'change' );
			}
			else {
				// The selector doesn't exist, so add it to the CSS, then reload
				this.editor.addEmptySelector( selector );
				this.loadCSS( this.editor.codeMirror.getValue().trim(), selector );
			}
			
			dropdown.addClass( 'highlighted' );
			setTimeout( function () {
				dropdown.removeClass( 'highlighted' );
			}, 2000 );
		}
		
	} );
	
	// The basic property controller
	socss.view.propertyController = Backbone.View.extend( {
		
		template: _.template( '<input type="text" value="" class="socss-property-controller-input"/>' ),
		activeRule: null,
		args: null,
		propertiesView: null,
		
		events: {
			'change .socss-property-controller-input': 'onChange',
			'keyup input.socss-property-controller-input': 'onChange',
		},
		
		initialize: function ( args ) {
			
			this.args = args.args;
			this.propertiesView = args.propertiesView;
			
			// If sub-views items define their own events hash with the same keys as above they will override those on
			// the above events hash.
			this.events = _.extend( socss.view.propertyController.prototype.events, this.events );
			this.delegateEvents( this.events );
			
			// By default, update the active rule whenever things change
			this.on( 'set_value', this.updateRule, this );
			this.on( 'change', this.updateRule, this );
		},
		
		/**
		 * Render the property field controller
		 */
		render: function () {
			this.$el.append( $( this.template( {} ) ) );
			this.field = this.$( 'input.socss-property-controller-input' );
		},
		
		onChange: function () {
			this.trigger( 'change', this.field.val() );
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
			var value = this.propertiesView.getRuleValue( this.args.property );
			this.setValue( value, { silent: true } );
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
		setValue: function ( val, options ) {
			options = _.extend( { silent: false }, options );
			
			this.field.val( val );
			
			if ( !options.silent ) {
				this.trigger( 'set_value', val );
			}
		},
		
		/**
		 * Reset the current value
		 */
		reset: function ( options ) {
			options = _.extend( { silent: false }, options );
			
			this.setValue( '', options );
		}
		
	} );
	
	// All the value controllers
	socss.view.properties.controllers = {};
	
	// The color controller
	socss.view.properties.controllers.color = socss.view.propertyController.extend( {
		
		render: function () {
			socss.view.propertyController.prototype.render.apply( this, arguments );
			// Set this up as a color picker
			this.field.minicolors( {} );
			
		},
		
		onChange: function () {
			this.trigger( 'change', this.field.minicolors( 'value' ) );
		},
		
		getValue: function () {
			return this.field.minicolors( 'value' ).trim();
		},
		
		setValue: function ( val, options ) {
			options = _.extend( { silent: false }, options );
			
			this.field.minicolors( 'value', val );
			
			if ( !options.silent ) {
				this.trigger( 'set_value', val );
			}
		}
		
	} );
	
	// The dropdown select box controller
	socss.view.properties.controllers.select = socss.view.propertyController.extend( {
		template: _.template( '<select class="socss-property-controller-input"></select>' ),
		
		events: {
			'click .select-tab': 'onSelect',
		},
		
		render: function () {
			this.$el.append( $( this.template( {} ) ) );
			this.field = this.$( 'select' );
			
			// Add the unchanged option
			this.field.append( $( '<option value=""></option>' ).html( '' ) );
			
			// Add all the options to the dropdown
			for ( var k in this.args.options ) {
				this.field.append( $( '<option></option>' ).attr( 'value', k ).html( this.args.options[ k ] ) );
			}
			
			if ( typeof this.args.option_icons !== 'undefined' ) {
				this.setupVisualSelect();
			}
		},
		
		setupVisualSelect: function () {
			this.field.hide();
			
			var $tc = $( '<div class="select-tabs"></div>' ).appendTo( this.$el );
			
			// Add the none value
			$( '<div class="select-tab" data-value=""><span class="fa fa-circle-o"></span></div>' ).appendTo( $tc );
			
			// Now add one for each of the option icons
			for ( var k in this.args.option_icons ) {
				$( '<div class="select-tab"></div>' )
				.appendTo( $tc )
				.append(
					$( '<span class="fa"></span>' )
					.addClass( 'fa-' + this.args.option_icons[ k ] )
				)
				.attr( 'data-value', k )
				;
			}
			
			$tc.find( '.select-tab' ).css( 'width', 100 / ( $tc.find( '>div' ).length ) + "%" );
		},
		
		onSelect: function ( event ) {
			this.$( '.select-tab' ).removeClass( 'active' );
			var $t = $( event.currentTarget );
			$t.addClass( 'active' );
			this.field.val( $t.data( 'value' ) ).trigger( 'change' );
		},
		
		/**
		 * Set the current value
		 * @param socss.view.properties val
		 */
		setValue: function ( val, options ) {
			options = _.extend( { silent: false }, options );
			
			this.field.val( val );
			
			this.$( '.select-tabs .select-tab' ).removeClass( 'active' ).filter( '[data-value="' + val + '"]' ).addClass( 'active' );
			
			if ( !options.silent ) {
				this.trigger( 'set_value', val );
			}
		}
		
	} );
	
	// A field that lets a user upload an image
	socss.view.properties.controllers.image = socss.view.propertyController.extend( {
		template: _.template( '<input type="text" value="" /> <span class="select socss-button"><span class="fa fa-upload"></span></span>' ),
		
		events: {
			'click .select': 'openMedia',
		},
		
		render: function () {
			this.media = wp.media( {
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
			} );
			
			this.$el.append( $( this.template( {
				select: socssOptions.loc.select
			} ) ) );
			
			this.field = this.$el.find( 'input' );
			
			this.media.on( 'select', function () {
				// Grab the selected attachment.
				var attachment = this.media.state().get( 'selection' ).first().attributes;
				var val = this.args.value.replace( '{{url}}', attachment.url );
				
				// Change the field value and trigger a change event
				this.field.val( val ).trigger( 'change' );
				this.trigger( 'set_value', val );
				
				// Close the image selector
				this.media.close();
				
			}.bind( this ) );
		},
		
		openMedia: function () {
			this.media.open();
		},
		
	} );
	
	// A simple measurement field
	socss.view.properties.controllers.measurement = socss.view.propertyController.extend( {
		
		wrapperClass: 'socss-field-measurement',
		
		events: {
			'click .toggle-dropdown': 'toggleUnitDropdown',
			'click .dropdown li': 'onSelectUnit',
			'keydown .socss-field-input': 'onInputKeyPress',
			'keyup .socss-field-input': 'onInputKeyUp',
		},
		
		render: function () {
			socss.view.propertyController.prototype.render.apply( this, arguments );
			
			this.setupMeasurementField();
		},
		
		setValue: function ( val, options ) {
			options = _.extend( { silent: false }, options );
			this.field.val( val ).trigger( 'measurement_refresh' );
			if ( !options.silent ) {
				this.trigger( 'set_value', val );
			}
		},
		
		units: [
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
		
		parseUnits: function ( value ) {
			var escapeRegExp = function ( str ) {
				return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
			};
			
			var regexUnits = this.units.map( escapeRegExp );
			var regex = new RegExp( '([0-9\\.\\-]+)(' + regexUnits.join( '|' ) + ')?', 'i' );
			var result = regex.exec( value );
			
			if ( result === null ) {
				return {
					value: '',
					unit: ''
				};
			}
			else {
				return {
					value: result[ 1 ],
					unit: result[ 2 ] === undefined ? '' : result[ 2 ]
				};
			}
		},
		
		setupMeasurementField: function () {
			var defaultUnit = 'px';
			
			this.field.hide();
			this.$el.addClass( this.wrapperClass ).data( 'unit', defaultUnit );
			
			// Create the fake input field
			var $fi = $( '<input type="text" class="socss-field-input"/>' ).appendTo( this.$el );
			$( '<span class="toggle-dropdown dashicons dashicons-arrow-down"></span>' ).appendTo( this.$el );
			var $dd = $( '<ul class="dropdown"></ul>' ).appendTo( this.$el );
			var $u = $( '<span class="units"></span>' ).html( defaultUnit ).appendTo( this.$el );
			
			for ( var i = 0; i < this.units.length; i++ ) {
				var $o = $( '<li></li>' ).html( this.units[ i ] ).data( 'unit', this.units[ i ] );
				if ( this.units[ i ] === defaultUnit ) {
					$o.addClass( 'active' );
				}
				$dd.append( $o );
			}
			
			this.field.on( 'measurement_refresh', function () {
				var value = this.parseUnits( this.field.val() );
				$fi.val( value.value );
				
				var unit = value.unit === '' ? defaultUnit : value.unit;
				this.$el.data( 'unit', unit );
				$u.html( unit );
				
				var $pl = $( '<span class="socss-hidden-placeholder"></span>' )
				.css( {
					'font-size': '14px'
				} )
				.html( value.value )
				.appendTo( 'body' );
				var width = $pl.width();
				width = Math.min( width, 63 );
				$pl.remove();
				
				$u.css( 'left', width + 12 );
			}.bind( this ) );
			
			// Now add the increment/decrement buttons
			var $diw = $( '<div class="socss-diw"></div>' ).appendTo( this.$el );
			var $dec = $( '<div class="dec-button socss-button"><span class="fa fa-minus"></span></div>' ).appendTo( $diw );
			var $inc = $( '<div class="inc-button socss-button"><span class="fa fa-plus"></span></div>' ).appendTo( $diw );
			
			this.setupStepButton( $dec );
			this.setupStepButton( $inc );
			
		},
		
		updateValue: function () {
			var $fi = this.$( '.socss-field-input' );
			var value = this.parseUnits( $fi.val() );
			
			if ( value.unit !== '' && value.unit !== this.$el.data( 'unit' ) ) {
				$fi.val( value.value );
				this.setUnit( value.unit );
			}
			
			if ( value.value === '' ) {
				this.field.val( '' );
			}
			else {
				this.field.val( value.value + this.$el.data( 'unit' ) );
			}
			this.field.trigger( 'change' );
		},
		
		setUnit: function ( unit ) {
			this.$( '.units' ).html( unit );
			this.$el.data( 'unit', unit );
			this.$( '.socss-field-input' ).trigger( 'keydown' );
		},
		
		toggleUnitDropdown: function () {
			this.$( '.dropdown' ).toggle();
		},
		
		onSelectUnit: function ( event ) {
			this.toggleUnitDropdown();
			this.setUnit( $( event.currentTarget ).data( 'unit' ) );
			this.updateValue();
		},
		
		onInputKeyUp: function( event ) {
			this.onInputKeyPress( event );
			this.updateValue();
		},
		
		onInputKeyPress: function ( event ) {
			var $fi = this.$( '.socss-field-input' );
			
			var char = '';
			if ( event.type === 'keydown' ) {
				if ( event.keyCode >= 48 && event.keyCode <= 57 ) {
					char = String.fromCharCode( event.keyCode );
				}
				else if ( event.keyCode === 189 ) {
					char = '-';
				}
				else if ( event.keyCode === 190 ) {
					char = '.';
				}
			}
			
			var $pl = $( '<span class="socss-hidden-placeholder"></span>' )
			.css( {
				'font-size': '14px'
			} )
			.html( $fi.val() + char )
			.appendTo( 'body' );
			var width = $pl.width();
			width = Math.min( width, 63 );
			$pl.remove();
			
			this.$( '.units' ).css( 'left', width + 12 );
		},
		
		stepValue: function ( direction ) {
			var value = Number.parseInt( this.parseUnits( this.field.val() ).value );
			
			if ( Number.isNaN( value ) ) {
				value = 0;
			}
			
			var newVal = value + direction;
			
			this.$( '.socss-field-input' ).val( newVal );
			this.updateValue();
			this.field.trigger( 'measurement_refresh' );
		},
		
		setupStepButton: function ( $button ) {
			var direction = $button.is( '.dec-button' ) ? -1 : 1;
			var intervalId;
			var timeoutId;
			$button.on( 'mousedown', function() {
				this.stepValue( direction );
				timeoutId = setTimeout( function () {
					intervalId = setInterval( function () {
						this.stepValue( direction );
					}.bind( this ), 50 );
				}.bind( this ), 500 );
			}.bind( this ) ).on( 'mouseup mouseout', function () {
				if ( timeoutId ) {
					clearTimeout( timeoutId );
					timeoutId = null;
				}
				if ( intervalId ) {
					clearInterval( intervalId );
					intervalId = null;
				}
			} );
		},
	} );
	
	// A simple measurement field
	socss.view.properties.controllers.number = socss.view.propertyController.extend( {
		
		initialize: function ( args ) {
			socss.view.propertyController.prototype.initialize.apply( this, arguments );
			
			this.args = _.extend( {
				change: null,
				default: 0,
				increment: 1,
				decrement: -1,
				max: null,
				min: null
			}, args.args );
		},
		
		render: function () {
			socss.view.propertyController.prototype.render.apply( this, arguments );
			
			this.setupNumberField();
		},
		
		setupNumberField: function () {
			
			this.$el.addClass( 'socss-field-number' );
			
			// Now add the increment/decrement buttons
			var $diw = $( '<div class="socss-diw"></div>' ).appendTo( this.$el );
			var $dec = $( '<div class="dec-button socss-button"><span class="fa fa-minus"></span></div>' ).appendTo( $diw );
			var $inc = $( '<div class="inc-button socss-button"><span class="fa fa-plus"></span></div>' ).appendTo( $diw );
			
			this.setupStepButton( $dec );
			this.setupStepButton( $inc );
			
			return this;
		},
		
		stepValue: function ( direction ) {
			var value = Number.parseFloat( this.field.val() );
			
			if ( Number.isNaN( value ) ) {
				value = this.args.default;
			}
			
			var newVal = value + direction;
			
			newVal = Math.round( newVal * 100 ) / 100;

				if ( this.args.max !== null ) {
					newVal = Math.min( this.args.max, newVal );
				}

				if ( this.args.min !== null ) {
					newVal = Math.max( this.args.min, newVal );
				}
			
			this.field.val( newVal );
			this.field.trigger( 'change' );
		},
		
		setupStepButton: function ( $button ) {
			var direction = $button.is( '.dec-button' ) ? this.args.decrement : this.args.increment;
			var intervalId;
			var timeoutId;
			$button.on( 'mousedown', function() {
				this.stepValue( direction );
				timeoutId = setTimeout( function () {
					intervalId = setInterval( function () {
						this.stepValue( direction );
					}.bind( this ), 50 );
				}.bind( this ), 500 );
			}.bind( this ) ).on( 'mouseup mouseout', function () {
				if ( timeoutId ) {
					clearTimeout( timeoutId );
					timeoutId = null;
				}
				if ( intervalId ) {
					clearInterval( intervalId );
					intervalId = null;
				}
			} );
		},
		
	} );
	
	
	socss.view.properties.controllers.sides = socss.view.propertyController.extend( {
		
		template: _.template( $( '#template-sides-field' ).html().trim() ),
		
		controllers: [],
		
		events: {
			'click .select-tab': 'onTabClick',
		},
		
		render: function () {
			
			socss.view.propertyController.prototype.render.apply( this, arguments );
			
			if ( !this.args.hasAll ) {
				this.$( '.select-tab' ).eq( 0 ).remove();
				this.$( '.select-tab' ).css( 'width', '25%' );
			}

			if ( ! this.args.isRadius ) {
				this.$( '.select-tabs[data-type="radius"]' ).remove();
			} else {
				this.$( '.select-tabs[data-type="box"]' ).remove();
			}
			
			this.$( '.select-tab' ).each( function ( index, element ) {
				var dir = $( element ).data( 'direction' );
				
				var container = $( '<li class="side">' )
				.appendTo( this.$( '.sides' ) )
				.hide();
				
				for ( var i = 0; i < this.args.controllers.length; i++ ) {
					
					var controllerArgs = this.args.controllers[ i ];
					
					if ( typeof socss.view.properties.controllers[ controllerArgs.type ] ) {
						
						// Create the measurement view
						var property = '';
						if ( dir === 'all' ) {
							property = controllerArgs.args.propertyAll;
						}
						else {
							property = controllerArgs.args.property.replace( '{dir}', dir );
						}
						
						var theseControllerArgs = _.extend( {}, controllerArgs.args, { property: property } );
						
						var controller = new socss.view.properties.controllers[ controllerArgs.type ]( {
							el: $( '<div>' ).appendTo( container ),
							propertiesView: this.propertiesView,
							args: theseControllerArgs
						} );
						
						// Setup and render the measurement controller and register it with the properties view
						controller.render();
						this.propertiesView.propertyControllers.push( controller );
					}
				}
				
			}.bind( this ) );
			
			// Select the first tab by default
			this.$( '.select-tab' ).eq( 0 ).click();
		},
		
		onTabClick: function ( event ) {
			var $tabs = this.$( '.select-tab' );
			$tabs.removeClass( 'active' );
			
			var $tab = $( event.currentTarget );
			$tab.addClass( 'active' );
			
			var $sides = this.$( '.sides .side' )
			$sides.hide();
			
			$sides.eq( $tabs.index( $tab ) ).show();
		},
	} );

	// This is a placeholder for the full font_select in SiteOrigin Premium
	socss.view.properties.controllers.font_select = socss.view.propertyController.extend( {
		template: _.template( $('#template-webfont-teaser').html().trim() )
	});
	
} )( jQuery, _, socssOptions );

// Setup the main editor
jQuery( function ( $ ) {
	var socss = window.socss;
	
	var editorModel = new socss.model.CSSEditorModel( {
		customCssPosts: socssOptions.customCssPosts,
	} );
	
	// Setup the editor
	var editor = new socss.view.editor( {
		el: $( '#so-custom-css-form' ).get( 0 ),
		model: editorModel,
		openVisualEditor: socssOptions.openVisualEditor,
	} );
	// editor.render();
	editor.setSnippets( socssOptions.snippets );
	
	// This is for hiding the getting started video
	$( '#so-custom-css-getting-started a.hide' ).on( 'click', function( e ) {
		e.preventDefault();
		$( '#so-custom-css-getting-started' ).slideUp();
		$.get( $( this ).attr( 'href' ) );
	} );
	
	window.socss.mainEditor = editor;
	$( socss ).trigger( 'initialized' );

	$( '.button-primary[name="siteorigin_custom_css_save"]' ).on( 'click', function() {
		$( '#so-custom-css-form' ).trigger( 'submit' );
	} );
} );
