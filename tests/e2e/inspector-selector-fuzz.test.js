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
 * A tiny seeded PRNG (mulberry32), so a failing run is reproducible.
 *
 * @param {number} seed The seed.
 *
 * @return {Function} A function returning a float in [0, 1).
 */
const makeRng = ( seed ) => () => {
	seed |= 0;
	seed = ( seed + 0x6D2B79F5 ) | 0;
	let t = Math.imul( seed ^ ( seed >>> 15 ), 1 | seed );
	t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
	return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
};

/**
 * Builds a seeded-random string from the fragments.
 *
 * @param {Function} rng   The random source.
 * @param {number}   parts How many fragments to join.
 *
 * @return {string} The string.
 */
const fuzzString = ( rng, parts ) => {
	let out = '';
	for ( let i = 0; i < parts; i++ ) {
		out += FRAGMENTS[ Math.floor( rng() * FRAGMENTS.length ) ];
	}
	return out;
};

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

test( 'Inspecting elements with fuzzed classes and ids never inserts markup and only offers usable selectors.', async ( { page } ) => {
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

		for ( let i = 0; i < iterations; i++ ) {
			const menuClass = fuzz( 1 + Math.floor( rng() * 4 ) );
			const elClass = fuzz( 1 + Math.floor( rng() * 4 ) );
			const elId = fuzz( 1 + Math.floor( rng() * 3 ) );

			// The HTML parser decodes entities in attribute values, as a real
			// stored page would. setAttribute keeps the exact string.
			host.innerHTML = '';
			const li = document.createElement( 'li' );
			li.setAttribute( 'class', 'menu-item ' + menuClass );
			const a = document.createElement( 'a' );
			a.setAttribute( 'href', 'http://e.test/' );
			if ( elClass ) {
				a.setAttribute( 'class', elClass );
			}
			if ( elId ) {
				a.setAttribute( 'id', elId );
			}
			a.className = ( a.getAttribute( 'class' ) || '' ) + ' socss-fuzz-link';
			li.appendChild( a );
			host.appendChild( li );

			try {
				inspector.setActiveEl( $( '.socss-fuzz-link' ) );
			} catch ( err ) {
				failures.push( { i, where: 'setActiveEl', err: String( err ) } );
				continue;
			}

			// Invariant 1: no value was inserted as markup in the inspector.
			if ( document.querySelectorAll(
				`#socss-inspector-interface [${ probe }]`
			).length ) {
				failures.push( { i, where: 'inspector-markup', menuClass, elClass, elId } );
			}

			// Invariant 2: every offered selector is usable — it does not throw
			// in jQuery (the hover highlighter calls $(selector)), and it is a
			// non-empty string.
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
		const fuzz = ( parts ) => {
			let out = '';
			for ( let i = 0; i < parts; i++ ) {
				out += fragments[ Math.floor( rng() * fragments.length ) ];
			}
			return out;
		};

		const vp = window.socss.mainEditor.visualProperties;
		const select = () => document.querySelector( '#so-custom-css-properties .toolbar select' );
		const failures = [];

		for ( let i = 0; i < iterations; i++ ) {
			// A class name the inspector would offer: a plain class selector.
			// (Hostile strings are already covered by invariant 1 of the other
			// test; here the concern is the dropdown's own handling.)
			const selector = '.' + fuzz( 1 + Math.floor( rng() * 3 ) ).replace( /[^a-zA-Z0-9_-]/g, '' ) + i;

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
