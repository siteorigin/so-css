/**
 * Fuzz the inspector's selector handling and the editor's dropdown.
 *
 * Page markup (a link's menu-item classes, and any element's own classes and
 * ids) becomes selectors the inspector offers, and a click sends one to the
 * visual editor's dropdown. This test feeds thousands of seeded-random class
 * and id strings through those paths and checks the invariants hold for every
 * one: nothing is ever inserted as markup, every offered selector is usable,
 * and the dropdown matches a selector it already holds.
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
		const { probe, fragments, seed, iterations } = args;
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
		const fuzz = ( parts ) => {
			let out = '';
			for ( let i = 0; i < parts; i++ ) {
				out += fragments[ Math.floor( rng() * fragments.length ) ];
			}
			return out;
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
	}, { probe: PROBE, fragments: FRAGMENTS, seed: 0x5eed, iterations: 2000 } );

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
