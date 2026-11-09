/**
 * Inspector selector evaluation.
 *
 * The front-end inspector (js/inspector.js, loaded on ?so_css_preview=1 for
 * users with edit_theme_options) builds selectors from each element's class
 * and id and from theme stylesheet rules, then matches them against the
 * clicked element. A stored class or id whose value is crafted as a jQuery
 * positional selector preceded by markup must never reach jQuery's HTML
 * parser, and must never be offered as a selector.
 *
 * These tests inject fixtures client-side and recompute the selector list,
 * then wrap jQuery.parseHTML to record its arguments. The payload is a bare,
 * inert <b> tag carrying only a data attribute: it drives jQuery down the
 * markup-parse path without running script. The assertion is that no raw,
 * unescaped probe tag reaches parseHTML; the escaped row templates the
 * inspector parses for its own UI are expected and allowed.
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site. Point
 * tests/so-tests.env only at a disposable site.
 */
const {
	expect,
	test,
} = require( '@playwright/test' );

const path = require( 'path' );

const {
	setupRequestUtils,
	soGoTo,
} = require( 'siteorigin-tests-common/playwright/common' );

// Set in a class or id value, then searched for unescaped in every parseHTML
// argument. '/' separates the tag and attribute so the class value carries no
// whitespace, which elementSelector would otherwise turn into dots.
const PROBE = 'data-socss-xss';
// The raw tag, in the stored slash form and the HTML-normalised space form.
const RAW_PROBE = '<b[/\\s]data-socss-xss';

/**
 * Logs in as the admin.
 *
 * @param {import('@playwright/test').Page} page The Playwright page.
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
 * Finds the SiteOrigin CSS install under test.
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
				title: 'SiteOrigin CSS inspector selector evaluation',
				status: 'publish',
				content: 'Inspector selector evaluation check.',
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

test.beforeEach( async ( { page } ) => {
	await login( page );

	await page.goto( `${ postLink }?so_css_preview=1` );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);
	await expect( page.locator( '#socss-inspector-interface' ) ).toBeAttached();
} );

/**
 * Runs a browser-side step with jQuery.parseHTML wrapped, and reports whether
 * any recorded argument carried the raw, unescaped probe tag.
 *
 * @param {import('@playwright/test').Page} page   The page.
 * @param {string}                          action One of the ACTION_* bodies.
 *
 * @return {Promise<Object>} { result, rawProbeParsed, probeNodes }.
 */
const withParseRecorder = ( page, action ) =>
	page.evaluate(
		( { fnBody, probe, rawSource } ) => {
			const $ = window.jQuery;
			const calls = [];
			const original = $.parseHTML;
			$.parseHTML = function ( data ) {
				calls.push( String( data ) );
				return original.apply( this, arguments );
			};

			let result;
			try {
				// eslint-disable-next-line no-new-func
				result = new Function( '$', fnBody )( $ );
			} finally {
				$.parseHTML = original;
			}

			const raw = new RegExp( rawSource, 'i' );
			return {
				result,
				rawProbeParsed: calls.some( ( s ) => raw.test( s ) ),
				probeNodes: document.querySelectorAll( `[${ probe }]` ).length,
			};
		},
		{ fnBody: action, probe: PROBE, rawSource: RAW_PROBE }
	);

// Injects the fixtures and installs the recomputed selector list, so the
// inspector matches against a list built with the crafted elements present.
const INJECT_AND_RECOMPUTE = `
	const host = document.getElementById( 'socss-eval-fixture' ) || document.createElement( 'div' );
	host.id = 'socss-eval-fixture';
	if ( ! host.parentNode ) { document.body.appendChild( host ); }
	host.innerHTML = '';

	const classEl = document.createElement( 'div' );
	classEl.className = 'x,<b/data-socss-xss>:eq(0)';
	host.appendChild( classEl );

	const idEl = document.createElement( 'div' );
	idEl.setAttribute( 'id', 'x,<b data-socss-xss>:eq(0)' );
	host.appendChild( idEl );

	const starEl = document.createElement( 'div' );
	starEl.className = 'x,*';
	host.appendChild( starEl );

	const safeEl = document.createElement( 'div' );
	safeEl.className = 'safe-class';
	host.appendChild( safeEl );

	window.socssInspector.mainInspector.pageSelectors = window.socssInspector.fn.pageSelectors();
`;

test( 'Clicking a harmless element never parses a stored hostile selector as markup.', async ( { page } ) => {
	const observed = await withParseRecorder(
		page,
		`
		${ INJECT_AND_RECOMPUTE }
		// Precondition: the hostile class must actually be present.
		const present = document.querySelector( '#socss-eval-fixture div' ).className;
		window.socssInspector.mainInspector.setActiveEl( $( '.safe-class' ) );
		return { present };
		`
	);

	expect( observed.result.present ).toContain( '<b/data-socss-xss>' );
	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Setting the hostile class or id element active never parses it as markup.', async ( { page } ) => {
	const observed = await withParseRecorder(
		page,
		`
		${ INJECT_AND_RECOMPUTE }
		const fixtures = document.querySelectorAll( '#socss-eval-fixture div' );
		window.socssInspector.mainInspector.setActiveEl( $( fixtures[ 0 ] ) );
		window.socssInspector.mainInspector.setActiveEl( $( fixtures[ 1 ] ) );
		return {};
		`
	);

	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Highlighting a hostile selector string never parses it as markup.', async ( { page } ) => {
	const observed = await withParseRecorder(
		page,
		`
		window.socssInspector.mainInspector.hl.highlight( '<b/data-socss-xss>:eq(0)' );
		return {};
		`
	);

	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Element attributes for a hostile theme selector are read without parsing markup.', async ( { page } ) => {
	const observed = await withParseRecorder(
		page,
		`
		window.socssInspector.parsedCss = {
			hostile: {
				stylesheet: {
					rules: [ {
						type: 'rule',
						selectors: [ '.safe-class,<b/data-socss-xss>:eq(0)' ],
						declarations: [ { type: 'declaration', property: 'color', value: 'red' } ],
					} ],
				},
			},
		};
		window.socssInspector.fn.elementAttributes( $( 'body' ) );
		return {};
		`
	);

	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Reading element attributes tolerates a matched rule with no declarations.', async ( { page } ) => {
	// In silent mode the parser can return a matched rule with no declarations
	// (e.g. an unterminated block). Reading properties must not throw.
	const outcome = await page.evaluate( () => {
		const $ = window.jQuery;
		window.socssInspector.parsedCss = {
			malformed: {
				stylesheet: {
					rules: [ { type: 'rule', selectors: [ 'body' ] } ],
				},
			},
		};
		try {
			window.socssInspector.fn.elementAttributes( $( 'body' ) );
			return 'ok';
		} catch ( err ) {
			return 'threw: ' + err.message;
		}
	} );

	expect( outcome ).toBe( 'ok' );
} );

test( 'The offered selectors exclude crafted fragments and keep clean ones.', async ( { page } ) => {
	// pageSelectors dedupes and keeps no source, and a theme may legitimately
	// use '*', so provenance is asserted directly on elementSelector: the
	// crafted elements must contribute nothing, the clean one its own selector.
	const observed = await page.evaluate( () => {
		const $ = window.jQuery;
		const host = document.getElementById( 'socss-eval-fixture' ) || document.createElement( 'div' );
		host.id = 'socss-eval-fixture';
		if ( ! host.parentNode ) {
			document.body.appendChild( host );
		}
		host.innerHTML = '';

		const classEl = document.createElement( 'div' );
		classEl.className = 'x,<b/data-socss-xss>:eq(0)';
		host.appendChild( classEl );

		const starEl = document.createElement( 'div' );
		starEl.className = 'x,*';
		host.appendChild( starEl );

		const safeEl = document.createElement( 'div' );
		safeEl.className = 'safe-class';
		host.appendChild( safeEl );

		const fn = window.socssInspector.fn;
		const list = fn.pageSelectors().map( ( s ) => s.selector );

		return {
			list,
			classBuilt: fn.elementSelector( $( classEl ) ),
			starBuilt: fn.elementSelector( $( starEl ) ),
			safeBuilt: fn.elementSelector( $( safeEl ) ),
		};
	} );

	// Each crafted element contributes no selector; the clean one its own.
	expect( observed.classBuilt ).toBe( '' );
	expect( observed.starBuilt ).toBe( '' );
	expect( observed.safeBuilt ).toBe( '.safe-class' );

	// No markup fragment reaches the offered list, and the clean class is there.
	// cssSelectors is a copy of this list (js/editor.js:559).
	expect( observed.list.some( ( s ) => s.indexOf( '<' ) !== -1 ) ).toBe( false );
	expect( observed.list.some( ( s ) => s.indexOf( PROBE ) !== -1 ) ).toBe( false );
	expect( observed.list ).toContain( '.safe-class' );
} );

test( 'A valid theme rule with a universal or quoted selector is preserved.', async ( { page } ) => {
	const list = await page.evaluate( () => {
		// Seed the theme stylesheet cache directly: a universal selector, a
		// valid attribute selector whose quoted value contains '<', a clean
		// class, and an invalid markup rule.
		window.socssInspector.parsedCss = {
			seeded: {
				stylesheet: {
					rules: [
						{ type: 'rule', selectors: [ '*' ], declarations: [] },
						{ type: 'rule', selectors: [ '[title="a<b"]' ], declarations: [] },
						{ type: 'rule', selectors: [ '.safe-class' ], declarations: [] },
						{ type: 'rule', selectors: [ '<b/data-socss-xss>:eq(0)' ], declarations: [] },
					],
				},
			},
		};
		const selectors = window.socssInspector.fn.pageSelectors();
		return selectors.map( ( s ) => s.selector );
	} );

	// Legitimate universal and quoted-attribute selectors survive.
	expect( list ).toContain( '*' );
	expect( list ).toContain( '[title="a<b"]' );
	expect( list ).toContain( '.safe-class' );
	// The invalid markup rule does not.
	expect( list.some( ( s ) => s.indexOf( PROBE ) !== -1 ) ).toBe( false );
} );
