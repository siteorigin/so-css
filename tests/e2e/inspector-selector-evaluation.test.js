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
 * The fixtures are stored in the post content, so they are present when the
 * inspector initialises and builds its selector list, and jQuery.parseHTML is
 * wrapped before navigation (via addInitScript) so the initialisation path is
 * covered as well as later clicks. The payload is a bare, inert <b> tag
 * carrying only a data attribute: it drives jQuery down the markup-parse path
 * without running script. The assertion is that no raw, unescaped probe tag
 * reaches parseHTML; the escaped row templates the inspector parses for its
 * own UI are expected and allowed.
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

// The stored fixtures. The attribute values are written with entities so the
// rendered class/id hold the literal crafted strings. data-fixture locates each
// element without affecting the selector the inspector builds from it.
const FIXTURE_CONTENT =
	'<div data-fixture="class" class="x,&lt;b/data-socss-xss&gt;:eq(0)">class fixture</div>' +
	'<div data-fixture="id" id="x,&lt;b data-socss-xss&gt;:eq(0)">id fixture</div>' +
	'<div data-fixture="star" class="x,*">star fixture</div>' +
	'<div data-fixture="safe" class="safe-class">safe fixture</div>';

/**
 * Logs in as the admin.
 *
 * @param {import('@playwright/test').Page} page The page.
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
				content: FIXTURE_CONTENT,
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

	// Wrap jQuery.parseHTML before any page script runs, so the inspector's
	// one-time initialisation over the stored fixtures is recorded too.
	await page.addInitScript( () => {
		window.__socssParseCalls = [];
		let value;
		Object.defineProperty( window, 'jQuery', {
			configurable: true,
			get() {
				return value;
			},
			set( next ) {
				if ( next && next.parseHTML && ! next.__socssWrapped ) {
					const original = next.parseHTML;
					next.parseHTML = function ( data ) {
						window.__socssParseCalls.push( String( data ) );
						return original.apply( this, arguments );
					};
					next.__socssWrapped = true;
				}
				value = next;
			},
		} );
	} );

	await page.goto( `${ postLink }?so_css_preview=1` );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);
	await expect( page.locator( '#socss-inspector-interface' ) ).toBeAttached();
} );

// Reads whether any recorded parseHTML argument carried the raw probe tag, and
// how many nodes carry the probe attribute.
const readParseResult = ( page ) =>
	page.evaluate(
		( rawSource ) => {
			const raw = new RegExp( rawSource, 'i' );
			return {
				rawProbeParsed: ( window.__socssParseCalls || [] ).some( ( s ) => raw.test( s ) ),
				probeNodes: document.querySelectorAll( '[data-socss-xss]' ).length,
			};
		},
		RAW_PROBE
	);

test( 'The stored hostile class and id render verbatim (precondition).', async ( { page } ) => {
	// If either is altered, the server rewrote the stored value and the
	// class- or id-specific tests would pass without exercising the crafted path.
	const className = await page.getAttribute( '[data-fixture="class"]', 'class' );
	expect( className ).toContain( '<b/data-socss-xss>' );

	const id = await page.getAttribute( '[data-fixture="id"]', 'id' );
	expect( id ).toContain( '<b data-socss-xss>' );
} );

test( 'Initialising and clicking a harmless element never parses stored markup.', async ( { page } ) => {
	await page.evaluate( () => {
		window.socssInspector.mainInspector.setActiveEl( window.jQuery( '[data-fixture="safe"]' ) );
	} );

	const observed = await readParseResult( page );
	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Setting the hostile class or id element active never parses it as markup.', async ( { page } ) => {
	await page.evaluate( () => {
		const $ = window.jQuery;
		window.socssInspector.mainInspector.setActiveEl( $( '[data-fixture="class"]' ) );
		window.socssInspector.mainInspector.setActiveEl( $( '[data-fixture="id"]' ) );
	} );

	const observed = await readParseResult( page );
	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Highlighting a hostile selector string never parses it as markup.', async ( { page } ) => {
	await page.evaluate( () => {
		window.socssInspector.mainInspector.hl.highlight( '<b/data-socss-xss>:eq(0)' );
	} );

	const observed = await readParseResult( page );
	expect( observed.rawProbeParsed ).toBe( false );
	expect( observed.probeNodes ).toBe( 0 );
} );

test( 'Element attributes keep the valid rule and never parse the hostile one.', async ( { page } ) => {
	const properties = await page.evaluate( () => {
		const $ = window.jQuery;
		// Supply a rule whose selector list pairs the element's own class with a
		// crafted fragment, through the real .socss-theme-styles/getParsedCss path.
		const style = document.createElement( 'script' );
		style.type = 'text/css';
		style.className = 'socss-theme-styles';
		style.id = 'socss-inlined-style-hostile';
		style.textContent = '.safe-class,<b/data-socss-xss>:eq(0) { color: rgb(9, 8, 7); }';
		document.body.appendChild( style );
		window.socssInspector.parsedCss = {};
		return window.socssInspector.fn.elementAttributes( $( '[data-fixture="safe"]' ) );
	} );

	// The valid half of the rule still resolves for the element: the fix did not
	// simply stop reading theme declarations.
	expect( properties.color ).toBe( 'rgb(9, 8, 7)' );

	const observed = await readParseResult( page );
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
	// Provenance is asserted directly on elementSelector (pageSelectors dedupes
	// and keeps no source). The list is checked only for the hostile fragment,
	// not for any '<', so a theme's valid [title="a<b"] would not trip it.
	const observed = await page.evaluate( () => {
		const $ = window.jQuery;
		const fn = window.socssInspector.fn;
		const list = fn.pageSelectors().map( ( s ) => s.selector );

		return {
			list,
			classBuilt: fn.elementSelector( $( '[data-fixture="class"]' ) ),
			starBuilt: fn.elementSelector( $( '[data-fixture="star"]' ) ),
			safeBuilt: fn.elementSelector( $( '[data-fixture="safe"]' ) ),
		};
	} );

	// Each crafted element contributes no selector; the clean one its own.
	expect( observed.classBuilt ).toBe( '' );
	expect( observed.starBuilt ).toBe( '' );
	expect( observed.safeBuilt ).toBe( '.safe-class' );

	// No crafted fragment reaches the offered list; the clean class does.
	// cssSelectors is a copy of this list (js/editor.js:559).
	expect( observed.list.some( ( s ) => s.indexOf( PROBE ) !== -1 ) ).toBe( false );
	expect( observed.list.some( ( s ) => s.indexOf( '<b' ) !== -1 ) ).toBe( false );
	expect( observed.list ).toContain( '.safe-class' );
} );

test( 'A valid theme rule with a universal or quoted selector is preserved.', async ( { page } ) => {
	const list = await page.evaluate( () => {
		// Supply rules through the real .socss-theme-styles/getParsedCss path: a
		// universal selector, a valid attribute selector whose quoted value
		// contains '<', a clean class, and an invalid markup rule.
		const style = document.createElement( 'script' );
		style.type = 'text/css';
		style.className = 'socss-theme-styles';
		style.id = 'socss-inlined-style-seeded';
		style.textContent =
			'* { color: red; }' +
			'[title="a<b"] { color: red; }' +
			'.safe-class { color: red; }' +
			'<b/data-socss-xss>:eq(0) { color: red; }';
		document.body.appendChild( style );
		window.socssInspector.parsedCss = {};
		return window.socssInspector.fn.pageSelectors().map( ( s ) => s.selector );
	} );

	// Legitimate universal and quoted-attribute selectors survive.
	expect( list ).toContain( '*' );
	expect( list ).toContain( '[title="a<b"]' );
	expect( list ).toContain( '.safe-class' );
	// The invalid markup rule does not.
	expect( list.some( ( s ) => s.indexOf( PROBE ) !== -1 ) ).toBe( false );
} );
