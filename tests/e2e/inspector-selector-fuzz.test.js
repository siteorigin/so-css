/**
 * Stress the inspector's selector handling and the editor's dropdown.
 *
 * A link's menu-item classes become selectors the inspector offers, and adding
 * one to the visual editor renders it in the dropdown. Two tests:
 *
 * 1. A combinatorial boundary test over the menu-item filter: every iteration
 *    offers one valid class (listed twice, for dedup), one of a fixed set of
 *    rejected tokens, and a markup tag, in a seeded-random order. It checks the
 *    valid class is offered once, the rest are rejected, every offered selector
 *    is usable, and no markup is inserted.
 * 2. A random fuzz of the dropdown sink: thousands of seeded-random
 *    markup-shaped selectors go through addSelector; each must render as text,
 *    with its option value equal to its text and no duplicate rule.
 *
 * Seeded so a failure is reproducible. Runs via `npm run tests`, which starts
 * a throwaway Playground site. Point tests/so-tests.env only at a disposable
 * site. The CSS is placed in the editor without saving, so the site's
 * stylesheet is never changed.
 */
const {
	expect,
	test
} = require( '@playwright/test' );

const path = require( 'path' );

const {
	setupRequestUtils,
	soGoTo,
} = require( 'siteorigin-tests-common/playwright/common' );

const EDITOR_URL = 'wp-admin/themes.php?page=so_custom_css';

// A node with this attribute only appears if a value was inserted as markup.
const PROBE = 'data-xss-probe';

// Characters that stress the selector, CSS-rule and HTML-parse paths at once.
const FRAGMENTS = [
	'<', '>', '"', '\'', '`', '&', '&lt;', '&gt;', '&amp;', '&#60;',
	'img', 'script', 'onerror=1', '/', '\\', ':', ';', '{', '}', '(', ')',
	'[', ']', '*', '.', '#', '@media', '!important', '\t', '\n', ' ',
	'é', '—', '\u0000', '�', '--foo', '_x', '1a', '-1', 'md:flex',
	'w-1/2', 'foo.bar', `${ PROBE }=1`, 'menu-item', 'menu-item-7', '',
];


/**
 * Logs in as the admin.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 */
const login = async ( page ) => {
	const username = page.locator( '#user_login' );
	const password = page.locator( '#user_pass' );

	await soGoTo( page, 'wp-login.php' );

	await expect( async () => {
		await username.fill( process.env.WP_USERNAME );
		await password.fill( process.env.WP_PASSWORD );
		await expect( username ).toHaveValue( process.env.WP_USERNAME, { timeout: 500 } );
		await expect( password ).toHaveValue( process.env.WP_PASSWORD, { timeout: 500 } );
	} ).toPass();

	await Promise.all( [
		page.waitForURL( /\/wp-admin\//, { waitUntil: 'commit' } ),
		page.locator( '#wp-submit' ).click(),
	] );
};

/**
 * Finds the SiteOrigin CSS install under test, matching the existing suite.
 *
 * @param {Object[]} plugins Plugins from the REST API.
 *
 * @return {Object} The plugin.
 */
const findPluginUnderTest = ( plugins ) => {
	const checkoutId = `${ path.basename( process.cwd() ) }/so-css`;
	const byId = plugins.find( ( item ) => item.plugin === checkoutId );

	if ( byId ) {
		return byId;
	}

	const byName = plugins.filter( ( item ) => item.name === 'SiteOrigin CSS' );

	if ( byName.length !== 1 ) {
		throw new Error( `Expected one SiteOrigin CSS install or "${ checkoutId }", found ${ byName.length }.` );
	}

	return byName[ 0 ];
};

/**
 * Sets the plugin status via REST.
 *
 * @param {string} pluginId The plugin's REST ID.
 * @param {string} status 'active' or 'inactive'.
 */
const setPluginStatus = async ( pluginId, status ) => {
	const requestUtils = await setupRequestUtils();

	try {
		await requestUtils.rest( {
			method: 'PUT',
			path: `/wp/v2/plugins/${ pluginId }`,
			data: { status },
		} );
	} finally {
		await requestUtils.request.dispose();
	}
};

let activatedPluginId = null;
let postId = null;
let postLink = null;

test.beforeAll( async () => {
	const requestUtils = await setupRequestUtils();

	try {
		const plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );
		const plugin = findPluginUnderTest( plugins );

		if ( plugin.status !== 'active' ) {
			await setPluginStatus( plugin.plugin, 'active' );
			activatedPluginId = plugin.plugin;
		}

		const post = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/posts',
			data: {
				title: 'SiteOrigin CSS selector fuzz',
				status: 'publish',
				content: 'Selector fuzz check.',
			},
		} );
		postId = post.id;
		postLink = post.link;
	} finally {
		await requestUtils.request.dispose();
	}
} );

test.afterAll( async () => {
	const requestUtils = await setupRequestUtils();

	try {
		if ( postId ) {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/posts/${ postId }`,
				params: { force: true },
			} );
			postId = null;
		}
	} finally {
		await requestUtils.request.dispose();
	}

	if ( activatedPluginId ) {
		await setPluginStatus( activatedPluginId, 'inactive' );
		activatedPluginId = null;
	}
} );

test( 'Inspecting fuzzed menu items offers each valid class once, rejects the rest, and never inserts markup.', async ( { page } ) => {
	await login( page );
	await page.goto( `${ postLink }?so_css_preview=1` );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);

	const result = await page.evaluate( ( args ) => {
		const { probe, seed, iterations } = args;
		const $ = window.jQuery;

		// Inlined so the generator runs in the page with the same seed.
		let state = seed;
		const rng = () => {
			state |= 0;
			state = ( state + 0x6D2B79F5 ) | 0;
			let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};

		const inspector = window.socssInspector.mainInspector;
		const host = document.createElement( 'div' );
		host.id = 'socss-fuzz-fixture';
		document.body.appendChild( host );

		const failures = [];

		// Tokens that are not plain class names: a markup tag and a set of
		// borderline cases. None may be offered as a menu-item selector.
		const rejected = [
			`<img ${ probe }=R>`, 'md:flex', 'w-1/2', '1a', 'foo.bar', 'a"b', "a'b",
		];

		for ( let i = 0; i < iterations; i++ ) {
			// The menu item carries, in random order: one plain class (valid,
			// listed twice to exercise dedup), one rejected token, and a markup
			// tag. So every iteration probes acceptance, dedup AND rejection.
			// The filter acts on these menu-item classes; the inspected link is
			// kept plain here, and the hostile-id/class path on the inspected
			// element is covered by inspector-output-escaping.test.js.
			const validClass = 'vc' + i;
			const reject = rejected[ Math.floor( rng() * rejected.length ) ];
			const tag = `<img ${ probe }=${ i }>`;
			const parts = [ validClass, validClass, reject, tag ];
			// Fisher-Yates shuffle with the seeded rng.
			for ( let k = parts.length - 1; k > 0; k-- ) {
				const j = Math.floor( rng() * ( k + 1 ) );
				[ parts[ k ], parts[ j ] ] = [ parts[ j ], parts[ k ] ];
			}
			const menuClass = parts.join( ' ' );

			// The HTML parser decodes entities in attribute values, as a real
			// stored page would. setAttribute keeps the exact string.
			host.innerHTML = '';
			const li = document.createElement( 'li' );
			li.setAttribute( 'class', 'menu-item ' + menuClass );
			const a = document.createElement( 'a' );
			a.setAttribute( 'href', 'http://e.test/' );
			a.setAttribute( 'class', 'socss-fuzz-link' );
			li.appendChild( a );
			host.appendChild( li );

			try {
				inspector.setActiveEl( $( '.socss-fuzz-link' ) );
			} catch ( err ) {
				failures.push( { i, where: 'setActiveEl', err: String( err ) } );
				continue;
			}

			// Invariant 1: none of the probe tags became a node in the inspector.
			if ( document.querySelectorAll(
				`#socss-inspector-interface [${ probe }]`
			).length ) {
				failures.push( { i, where: 'inspector-markup', menuClass } );
			}

			const offered = $( '.socss-selectors-window > .socss-selector' )
				.map( function () {
					return $( this ).data( 'selector' );
				} )
				.get();

			// Invariant 1b: the plain class is offered exactly once (acceptance
			// and dedup), and the rejected token is never offered.
			const validCount = offered.filter( ( s ) => s === '.' + validClass ).length;
			if ( validCount !== 1 ) {
				failures.push( { i, where: 'valid-class-count', validClass, validCount } );
			}
			if ( offered.includes( '.' + reject ) ) {
				failures.push( { i, where: 'rejected-offered', reject } );
			}

			// Invariant 2: every offered selector is usable and meaningful. It is
			// a non-empty string, it does not throw in jQuery (the hover
			// highlighter calls $(selector)), and it actually selects the
			// inspected link or one of its ancestors — page selectors are
			// el.is()-filtered and menu-item classes match the ancestor, so a
			// selector that matches nothing in that chain was offered wrongly.
			const link = document.querySelector( '.socss-fuzz-link' );
			$( '.socss-selectors-window > .socss-selector' ).each( function () {
				const selector = $( this ).data( 'selector' );
				if ( typeof selector !== 'string' || selector === '' ) {
					failures.push( { i, where: 'empty-selector', selector: String( selector ) } );
					return;
				}
				try {
					$( selector );
				} catch ( err ) {
					failures.push( { i, where: 'selector-throws', selector } );
					return;
				}
				try {
					if ( link.closest( selector ) === null ) {
						failures.push( { i, where: 'selector-matches-nothing', selector } );
					}
				} catch ( err ) {
					failures.push( { i, where: 'selector-invalid', selector } );
				}
			} );

			if ( failures.length > 20 ) {
				break;
			}
		}

		host.remove();
		return { failures, probeNodes: document.querySelectorAll( `[${ probe }]` ).length };
	}, { probe: PROBE, seed: 0x5eed, iterations: 2000 } );

	expect( result.probeNodes ).toBe( 0 );
	expect( result.failures ).toEqual( [] );
} );

test( 'Adding fuzzed selectors to the dropdown never inserts markup, keeps value equal to text, and re-selects an existing rule.', async ( { page } ) => {
	await login( page );
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	await page.evaluate(
		() => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( '.seed {\n  color: #1d3557;\n}' ),
	);
	await page.locator( '#so-custom-css-form a.editor-visual' ).click();
	await expect( page.locator( '#so-custom-css-properties' ) ).toBeVisible();

	const result = await page.evaluate( ( args ) => {
		const { probe, fragments, seed, iterations } = args;

		let state = seed;
		const rng = () => {
			state |= 0;
			state = ( state + 0x6D2B79F5 ) | 0;
			let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};

		const vp = window.socss.mainEditor.visualProperties;
		const select = () => document.querySelector( '#so-custom-css-properties .toolbar select' );
		const failures = [];

		// Fragments safe to drop into a selector that addSelector writes as a
		// single CSS rule and reparses: no CSS-structural character
		// (`{`, `}`, `;`, newline) and no bare space (which the parser would
		// normalise away).
		const safe = fragments.filter( ( f ) => f !== '' && ! /[{};\s]/.test( f ) );

		for ( let i = 0; i < iterations; i++ ) {
			// Every selector carries a real tag (`<b/...>`) surrounded by random
			// fragments. The option must show it as text: the probe tag may form
			// no node and the option value must equal its text.
			let body = '';
			for ( let j = 0; j < Math.floor( rng() * 3 ); j++ ) {
				body += safe[ Math.floor( rng() * safe.length ) ];
			}
			const selector = `.x${ body }<b/${ probe }=${ i }>`;

			try {
				vp.addSelector( selector );
			} catch ( err ) {
				failures.push( { i, where: 'addSelector', selector, err: String( err ) } );
				continue;
			}

			// Invariant 1: no option carries markup.
			const injected = select().querySelector( 'option *' );
			if ( injected ) {
				failures.push( { i, where: 'option-child', selector, tag: injected.tagName } );
			}

			// Invariant 2: each option's value equals its text.
			Array.from( select().options ).forEach( ( option ) => {
				if ( option.getAttribute( 'value' ) !== option.textContent ) {
					failures.push( { i, where: 'value-text-mismatch', text: option.textContent } );
				}
			} );

			// Invariant 3: the selector we just added is the selected option,
			// and adding it again does not grow the option count.
			if ( select().value !== selector ) {
				failures.push( { i, where: 'not-selected', selector, value: select().value } );
			}
			const count = select().options.length;
			vp.addSelector( selector );
			if ( select().options.length !== count ) {
				failures.push( { i, where: 'duplicate', selector } );
			}

			if ( failures.length > 20 ) {
				break;
			}
		}

		return {
			failures,
			probeNodes: document.querySelectorAll( `[${ probe }]` ).length,
		};
	}, { probe: PROBE, fragments: FRAGMENTS, seed: 0xc0ffee, iterations: 1000 } );

	expect( result.probeNodes ).toBe( 0 );
	expect( result.failures ).toEqual( [] );
} );

test( 'Fuzzed hostile class and id values never let the inspector build attacker nodes.', async ( { page } ) => {
	await login( page );
	const previewUrl = new URL( postLink );
	previewUrl.searchParams.set( 'so_css_preview', '1' );
	await page.goto( previewUrl.toString() );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);

	const result = await page.evaluate( ( args ) => {
		const { fragments, seed, iterations } = args;
		const $ = window.jQuery;

		let state = seed;
		const rng = () => {
			state |= 0;
			state = ( state + 0x6D2B79F5 ) | 0;
			let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};
		const pick = ( arr ) => arr[ Math.floor( rng() * arr.length ) ];

		const insp = window.socssInspector;
		const inspector = insp.mainInspector;
		const realCss = insp.fn.getParsedCss();

		// Detect a genuine attacker node: wrap parseHTML and inspect what it
		// builds. The marker 'data-fuzz' only ever appears as a real attribute on
		// a node the parser created from attacker input; the inspector's own row
		// templates escape the selector, so the marker there is inert text and
		// does not match. This catches detached nodes too, which a DOM query
		// over the document would miss.
		let attackerNodes = 0;
		const attackerSamples = [];
		const origParse = $.parseHTML;
		$.parseHTML = function ( data ) {
			const res = origParse.apply( this, arguments );
			try {
				( res || [] ).forEach( ( n ) => {
					if ( ! n || n.nodeType !== 1 ) {
						return;
					}
					if (
						( n.hasAttribute && n.hasAttribute( 'data-fuzz' ) ) ||
						( n.querySelector && n.querySelector( '[data-fuzz]' ) )
					) {
						attackerNodes++;
						if ( attackerSamples.length < 5 ) {
							attackerSamples.push( String( data ).slice( 0, 80 ) );
						}
					}
				} );
			} catch ( e ) {}
			return res;
		};

		const TAGS = [ 'b', 'i', 'img', 'x', 'span', 'div', 'svg' ];
		const PSEUDOS = [ ':eq(0)', ':first', ':last', ':gt(0)', ':lt(1)', ':nth(0)', ':even', ':odd', ':contains(x)', '' ];
		const COMBINATORS = [ ',', '>', '+', '~', ' ', ',*,' ];

		// Builds a hostile value carrying a markup tag marked with data-fuzz,
		// wrapped in random selector syntax. forId uses a space separator (ids
		// keep spaces); class values use '/' (the inspector dots whitespace).
		const genValue = ( forId ) => {
			const tag = pick( TAGS );
			const sep = forId ? ' ' : '/';
			const markup = '<' + tag + sep + 'data-fuzz' + ( rng() < 0.5 ? '' : '=' + Math.floor( rng() * 9 ) ) + '>';
			const piece = markup + pick( PSEUDOS );
			let noise = '';
			const n = Math.floor( rng() * 4 );
			for ( let k = 0; k < n; k++ ) {
				noise += pick( fragments );
			}
			const head = rng() < 0.7 ? 'fz' + Math.floor( rng() * 5 ) : '';
			const parts = [ head, piece, noise ].filter( ( p ) => p !== '' );
			// Join with random commas/combinators so the markup lands in varied
			// positions relative to the comma split.
			let out = parts[ 0 ] || piece;
			for ( let k = 1; k < parts.length; k++ ) {
				out += pick( COMBINATORS ) + parts[ k ];
			}
			return out;
		};

		const host = document.createElement( 'div' );
		host.id = 'socss-fuzz-host';
		document.body.appendChild( host );

		const failures = [];

		for ( let i = 0; i < iterations; i++ ) {
			const useId = rng() < 0.5;
			const value = genValue( useId );

			host.removeAttribute( 'class' );
			host.removeAttribute( 'id' );
			host.id = 'socss-fuzz-host';
			if ( useId ) {
				host.setAttribute( 'id', value );
			} else {
				host.setAttribute( 'class', value );
			}

			try {
				// The real producer path: rebuild the offered list with the
				// hostile element present, then match against it.
				inspector.pageSelectors = insp.fn.pageSelectors();
				inspector.setActiveEl( $( host ) );
				inspector.setActiveEl( $( 'body' ) );
				// The highlight string sink, with the raw value.
				inspector.hl.highlight( value );
				// The theme-CSS matching sink: a rule whose selector list pairs a
				// clean selector with the hostile fragment.
				insp.parsedCss = {
					fuzz: {
						stylesheet: {
							rules: [ {
								type: 'rule',
								selectors: [ '#socss-fuzz-host,' + value ],
								declarations: [ { type: 'declaration', property: 'color', value: 'red' } ],
							} ],
						},
					},
				};
				insp.fn.elementAttributes( $( host ) );
				insp.parsedCss = realCss;
			} catch ( err ) {
				if ( failures.length < 5 ) {
					failures.push( { i, value: value.slice( 0, 80 ), err: String( err ).slice( 0, 120 ) } );
				}
			}
		}

		$.parseHTML = origParse;
		host.removeAttribute( 'id' );
		host.setAttribute( 'id', 'socss-fuzz-host' );
		const probeNodes = document.querySelectorAll( '[data-fuzz]' ).length;
		host.remove();

		return { attackerNodes, attackerSamples, failures, probeNodes };
	}, { fragments: FRAGMENTS, seed: 0x0f0fed, iterations: 700 } );

	// Not one fuzzed value caused the inspector to build an attacker node,
	// leave one in the document, or throw.
	expect( result.attackerNodes ).toBe( 0 );
	expect( result.probeNodes ).toBe( 0 );
	expect( result.failures ).toEqual( [] );
} );


// Extra bundled themes to widen the harvested selector corpus. Fetched over
// HTTP from the running site; any that are not installed are skipped.
const EXTRA_THEME_CSS = [
	'twentytwentyfive', 'twentytwentyfour', 'twentytwentyone', 'storefront',
	'siteorigin-unwind', 'mesmerize', 'vantage',
];

// Representative framework utility selectors (escaped forms a real Tailwind or
// Bootstrap build emits), to stress the character space portably.
const FRAMEWORK_CSS = [
	'.md\\:flex{}', '.w-1\\/2{}', '.hover\\:bg-red-500{}', '.sm\\:grid-cols-3{}',
	'.lg\\:gap-4{}', '.-mx-2{}', '.2xl\\:block{}', '.text-gray-500\\/50{}',
	'[class~="btn"]{}', '.btn{}', '.btn-primary{}', '.card__title--large{}',
	'.is-active{}', '.col-md-6{}', '.d-none{}', '.visually-hidden{}',
	'.before\\:content-\\[\\x27\\x27\\]{}', '.group-hover\\:opacity-100{}',
].join( '\n' );

test( 'Parity over harvested real theme, block and framework CSS: no user-visible change.', async ( { page } ) => {
	await login( page );
	const previewUrl = new URL( postLink );
	previewUrl.searchParams.set( 'so_css_preview', '1' );
	await page.goto( previewUrl.toString() );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);

	// Fetch extra theme stylesheets over HTTP, best-effort.
	const base = process.env.WP_BASE_URL.replace( /\/$/, '' );
	const extraCss = [];
	for ( const theme of EXTRA_THEME_CSS ) {
		try {
			const res = await page.request.get( `${ base }/wp-content/themes/${ theme }/style.css` );
			if ( res.ok() ) {
				extraCss.push( await res.text() );
			}
		} catch ( e ) {
			// Theme not installed on this site; skip.
		}
	}

	const result = await page.evaluate( ( args ) => {
		const { seed, extraCss, frameworkCss } = args;
		const $ = window.jQuery;
		const insp = window.socssInspector;

		let state = seed;
		const rng = () => {
			state |= 0;
			state = ( state + 0x6D2B79F5 ) | 0;
			let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};

		const isValidCss = ( sel ) => {
			try {
				document.createDocumentFragment().querySelector( sel );
				return true;
			} catch ( e ) {
				return false;
			}
		};

		// Inject the framework utilities and any fetched theme CSS so their
		// selectors enter document.styleSheets and the inspector's parser.
		const inject = ( css, id ) => {
			const style = document.createElement( 'style' );
			style.setAttribute( 'data-parity', id );
			style.textContent = css;
			document.head.appendChild( style );
			// Also feed the inspector's own parser (js/css.js) via a
			// .socss-theme-styles script, the way enqueued stylesheets arrive.
			const script = document.createElement( 'script' );
			script.type = 'text/css';
			script.className = 'socss-theme-styles';
			script.id = 'socss-inlined-style-parity-' + id;
			script.textContent = css;
			document.body.appendChild( script );
		};
		inject( frameworkCss, 'fw' );
		extraCss.forEach( ( css, i ) => inject( css, 't' + i ) );

		// Harvest selectors from every readable stylesheet (CSSOM), recursing
		// into grouping rules, splitting selector lists.
		const harvested = new Set();
		const addFromRules = ( rules ) => {
			for ( const rule of rules || [] ) {
				if ( rule.selectorText ) {
					rule.selectorText.split( ',' ).forEach( ( s ) => {
						s = s.trim();
						if ( s ) {
							harvested.add( s );
						}
					} );
				}
				if ( rule.cssRules ) {
					addFromRules( rule.cssRules );
				}
			}
		};
		for ( const sheet of document.styleSheets ) {
			try {
				addFromRules( sheet.cssRules );
			} catch ( e ) {
				// Cross-origin or unreadable sheet; skip.
			}
		}
		// Also take the selectors the inspector's own parser produced.
		try {
			insp.parsedCss = {};
			insp.fn.pageSelectors().forEach( ( s ) => {
				if ( s && s.selector ) {
					harvested.add( s.selector );
				}
			} );
		} catch ( e ) {}

		// Sample the corpus (seeded shuffle, capped for runtime).
		let selectors = Array.from( harvested );
		for ( let k = selectors.length - 1; k > 0; k-- ) {
			const j = Math.floor( rng() * ( k + 1 ) );
			[ selectors[ k ], selectors[ j ] ] = [ selectors[ j ], selectors[ k ] ];
		}
		selectors = selectors.slice( 0, 3000 );

		const els = Array.from( document.querySelectorAll( 'body, body *' ) ).slice( 0, 150 );

		const oldElSelector = ( el ) => {
			let name = '';
			const id = el.getAttribute( 'id' );
			const cls = el.getAttribute( 'class' );
			if ( id !== null ) {
				name += '#' + id;
			}
			if ( cls !== null ) {
				name += '.' + cls.replace( /\s+/g, '.' );
			}
			return name === '' ? el.tagName.toLowerCase() : name;
		};

		// 1) Matching parity over harvested real selectors.
		const matchDivergences = [];
		let validSelectors = 0;
		let matchedTrue = 0;
		for ( const sel of selectors ) {
			const valid = isValidCss( sel );
			if ( valid ) {
				validSelectors++;
			}
			// Test each selector against a seeded sample of elements.
			for ( let s = 0; s < 25; s++ ) {
				const el = els[ Math.floor( rng() * els.length ) ];
				let jq;
				let nat;
				try {
					jq = $( el ).is( sel );
				} catch ( e ) {
					jq = 'throw';
				}
				try {
					nat = el.matches( sel );
				} catch ( e ) {
					nat = 'throw';
				}
				if ( jq === true && nat === true ) {
					matchedTrue++;
				}
				if ( jq !== nat && valid && matchDivergences.length < 25 ) {
					matchDivergences.push( { sel, jq, nat, el: el.tagName } );
				}
			}
		}

		// 2) Offered-selector parity over every real element's own class/id.
		const buildDivergences = [];
		let buildChecked = 0;
		const probe = document.createElement( 'div' );
		document.body.appendChild( probe );
		for ( const el of els ) {
			const cls = el.getAttribute( 'class' );
			const id = el.getAttribute( 'id' );
			if ( cls === null && id === null ) {
				continue;
			}
			probe.removeAttribute( 'class' );
			probe.removeAttribute( 'id' );
			if ( cls !== null ) {
				probe.setAttribute( 'class', cls );
			}
			if ( id !== null ) {
				probe.setAttribute( 'id', id );
			}
			const oldSel = oldElSelector( probe );
			const newSel = insp.fn.elementSelector( $( probe ) );
			if ( isValidCss( oldSel ) ) {
				buildChecked++;
				if ( oldSel !== newSel && buildDivergences.length < 25 ) {
					buildDivergences.push( { cls, id, oldSel, newSel } );
				}
			}
		}
		probe.remove();

		return {
			harvestedCount: harvested.size,
			selectorsTested: selectors.length,
			validSelectors,
			matchedTrue,
			buildChecked,
			matchDivergences,
			buildDivergences,
		};
	}, { seed: 0x1234abcd & 0x7fffffff, extraCss, frameworkCss: FRAMEWORK_CSS } );

	// The corpus must be large and actually match real elements, or the test is
	// vacuous.
	expect( result.harvestedCount ).toBeGreaterThan( 300 );
	expect( result.matchedTrue ).toBeGreaterThan( 50 );
	expect( result.buildChecked ).toBeGreaterThan( 20 );
	// No user-visible change for any valid real selector or element.
	expect( result.matchDivergences ).toEqual( [] );
	expect( result.buildDivergences ).toEqual( [] );
} );
