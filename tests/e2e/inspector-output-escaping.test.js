/**
 * Inspector output escaping.
 *
 * The front-end inspector (js/inspector.js, loaded on ?so_css_preview=1 for
 * users with edit_theme_options) displays a clicked element's link URL and its
 * CSS selectors. These values must be shown as text, never inserted as markup,
 * so a page element whose href or class/id carries HTML cannot inject nodes
 * into the inspector running in the viewer's session.
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site. Point
 * tests/so-tests.env only at a disposable site. The tests use inert markers
 * (a bare element carrying a data attribute); none run script.
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

// A node with this attribute only appears if a value was inserted as markup.
// The payload uses '/' as the tag/attribute separator: esc/KSES and the
// inspector's own whitespace splitting both mangle a space, so a space would
// never form a single injected node.
const PROBE = 'data-xss-probe';

/**
 * Logs in as the admin.
 *
 * Mirrors visual-mode-clear-field.test.js: fill until both fields hold their
 * values (wp-login.php's focus script can otherwise steal the password into
 * the username field), then wait for wp-admin.
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
				title: 'SiteOrigin CSS inspector escaping',
				status: 'publish',
				content: 'Inspector output escaping check.',
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

	// The inspector arms on init for an edit_theme_options user on
	// ?so_css_preview=1. Wait for its global handle and interface.
	await page.goto( `${ postLink }?so_css_preview=1` );
	await page.waitForFunction(
		() => window.socssInspector && window.socssInspector.mainInspector
	);
	await expect( page.locator( '#socss-inspector-interface' ) ).toBeAttached();
} );

test( 'A link URL is displayed as text, not inserted as markup.', async ( { page } ) => {
	const result = await page.evaluate( ( probe ) => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-xss-fixture';
		document.body.appendChild( host );
		// The HTML parser decodes the entities into the href attribute value.
		host.innerHTML =
			`<a id="probe-href" href="http://e.test/?x=&lt;b/${ probe }=1&gt;">hi</a>`;

		window.socssInspector.mainInspector.setActiveEl( $( '#probe-href' ) );

		const linkAnchor = document.querySelector( '.socss-link a' );
		return {
			probeNodes: document.querySelectorAll( `.socss-link [${ probe }]` ).length,
			labelText: linkAnchor ? linkAnchor.textContent : null,
			href: linkAnchor ? linkAnchor.getAttribute( 'href' ) : null,
		};
	}, PROBE );

	expect( result.probeNodes ).toBe( 0 );
	expect( result.labelText ).toBe( 'http://e.test/?x=<b/data-xss-probe=1>' );
	// A normal http(s) link stays navigable.
	expect( result.href ).toBe( 'http://e.test/?x=<b/data-xss-probe=1>' );
} );

test( 'The navigate-to label reads with a single colon.', async ( { page } ) => {
	// Inspecting a link shows the label, a space, then the link URL. The checks
	// read the label around the known URL, so they do not assume the translated
	// wording — only that a space separates the label from the URL and that no
	// separator is doubled.
	const url = 'http://e.test/page';
	const label = await page.evaluate( ( href ) => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-203-fixture';
		document.body.appendChild( host );
		host.innerHTML = '<a id="probe-203" href="' + href + '">hi</a>';

		window.socssInspector.mainInspector.setActiveEl( $( '#probe-203' ) );

		const link = document.querySelector( '.socss-link' );
		return link ? link.textContent.replace( /\s+/g, ' ' ).trim() : null;
	}, url );

	expect( label ).not.toBeNull();
	const idx = label.indexOf( url );
	expect( idx ).toBeGreaterThan( 0 );
	// A space separates the label from the URL: guards against the label and
	// URL being glued together when a translation omits a trailing space.
	expect( /\s/.test( label.charAt( idx - 1 ) ) ).toBe( true );
	// The separator is not doubled: guards the duplicate-colon regression.
	expect( label ).not.toMatch( /:\s*:/ );
} );

/**
 * Drives setActiveEl on an anchor with the given href and reports the displayed
 * link's href attribute and label text.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 * @param {string} href The href to set on the fixture anchor.
 *
 * @return {Promise<Object>} { hasHref, href, labelText }.
 */
const inspectHref = ( page, href ) => page.evaluate( ( value ) => {
	const $ = window.jQuery;
	const existing = document.getElementById( 'socss-xss-fixture' );
	if ( existing ) {
		existing.remove();
	}
	const host = document.createElement( 'div' );
	host.id = 'socss-xss-fixture';
	document.body.appendChild( host );
	const anchor = document.createElement( 'a' );
	anchor.id = 'probe-scheme';
	// setAttribute keeps the exact string (no parser resolution).
	anchor.setAttribute( 'href', value );
	anchor.textContent = 'x';
	host.appendChild( anchor );

	window.socssInspector.mainInspector.setActiveEl( $( '#probe-scheme' ) );

	const linkAnchor = document.querySelector( '.socss-link a' );
	return {
		hasHref: linkAnchor ? linkAnchor.hasAttribute( 'href' ) : null,
		href: linkAnchor ? linkAnchor.getAttribute( 'href' ) : null,
		labelText: linkAnchor ? linkAnchor.textContent : null,
	};
}, href );

// Safe links keep a usable href: no scheme (relative, fragment, query,
// protocol-relative) and the http/https/mailto/tel schemes.
for ( const href of [
	'/about', 'about.html', '#top', '?p=2', '//cdn.example/x',
	'mailto:a@b.com', 'tel:+123', 'http://x.test/', 'HTTPS://X.test/', '',
] ) {
	test( `A safe link URL (${ JSON.stringify( href ) }) keeps its href.`, async ( { page } ) => {
		const result = await inspectHref( page, href );
		expect( result.hasHref ).toBe( true );
		expect( result.href ).toBe( href );
	} );
}

// Dangerous schemes are dropped from the live href but still shown as the label,
// including whitespace/case-obfuscated variants.
for ( const href of [
	'javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)',
	'  javascript:alert(1)', 'JaVaScript:alert(1)', 'java\tscript:alert(1)',
	'\u0000javascript:alert(1)', '�javascript:alert(1)',
	'file:///etc/passwd', 'blob:http://x.test/abc',
] ) {
	test( `A dangerous link URL (${ JSON.stringify( href ) }) is kept out of the href attribute.`, async ( { page } ) => {
		const result = await inspectHref( page, href );
		// The security property: the dangerous value never reaches the live href.
		expect( result.hasHref ).toBe( false );
		// It is still shown as text, not dropped. (The browser may normalize
		// control characters in the label, so this is a non-empty check.)
		expect( typeof result.labelText ).toBe( 'string' );
		expect( result.labelText.length ).toBeGreaterThan( 0 );
	} );
}

test( 'Element selectors are escaped in the hierarchy, and a hostile menu item class is not offered.', async ( { page } ) => {
	const result = await page.evaluate( ( probe ) => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-xss-fixture';
		document.body.appendChild( host );
		// Hostile class on the .menu-item ancestor (the parentClasses branch
		// must not offer it) and a hostile id on the inspected anchor (reaches
		// the hierarchy bar via elSelector). A real menu-item-7 class exercises
		// the <strong> highlight.
		host.innerHTML =
			`<li class="menu-item menu-item-7 x&lt;b/${ probe }=1&gt;">` +
			`<a id="y&lt;b/${ probe }=2&gt;" class="probe-cls" href="http://e.test/">m</a>` +
			`</li>`;

		const li = host.querySelector( 'li' );

		// Capture the click_selector payload without a real mouse click, which
		// would fire mouseenter -> highlighter -> $(selector).
		let clickPayload = null;
		window.socssInspector.mainInspector.on(
			'click_selector',
			( value ) => { clickPayload = value; }
		);

		window.socssInspector.mainInspector.setActiveEl( $( '.probe-cls' ) );

		const rowFor = ( selector ) => {
			let found = null;
			$( '.socss-selectors-window > .socss-selector' ).each( function () {
				if ( $( this ).data( 'selector' ) === selector ) {
					found = this;
				}
			} );
			return found;
		};

		const hostileRow = rowFor( '.x<b/data-xss-probe=1>' );
		const classRow = rowFor( '.menu-item-7' );
		if ( classRow ) {
			$( classRow ).trigger( 'click' );
		}

		// The hierarchy row for the <li> ancestor should carry the highlight.
		let liRow = null;
		$( '.socss-hierarchy .socss-selector' ).each( function () {
			const el = $( this ).data( 'el' );
			if ( el && el[ 0 ] === li ) {
				liRow = this;
			}
		} );
		const strongs = liRow ? liRow.querySelectorAll( 'strong' ) : [];

		return {
			probeNodesTotal: document.querySelectorAll(
				`#socss-inspector-interface [${ probe }]`
			).length,
			probeNodesHierarchy: document.querySelectorAll(
				`.socss-hierarchy [${ probe }]`
			).length,
			probeNodesSelectors: document.querySelectorAll(
				`.socss-selectors-window [${ probe }]`
			).length,
			hostileRowFound: !! hostileRow,
			classRowText: classRow ? classRow.textContent : null,
			clickPayload,
			strongCount: strongs.length,
			strongText: strongs.length ? strongs[ 0 ].textContent : null,
		};
	}, PROBE );

	// No value was inserted as markup anywhere in the inspector UI.
	expect( result.probeNodesTotal ).toBe( 0 );
	expect( result.probeNodesHierarchy ).toBe( 0 );
	expect( result.probeNodesSelectors ).toBe( 0 );

	// The hostile class is never offered as a selector, while a plain menu
	// item class is, and clicking it sends that selector.
	expect( result.hostileRowFound ).toBe( false );
	expect( result.classRowText ).toBe( '.menu-item-7' );
	expect( result.clickPayload ).toBe( '.menu-item-7' );

	// The legitimate important-class highlight still renders as real <strong>.
	expect( result.strongCount ).toBe( 1 );
	expect( result.strongText ).toBe( 'menu-item-7' );
} );

test( 'Menu item classes are offered once each, and only when they are plain class names.', async ( { page } ) => {
	const counts = await page.evaluate( () => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-xss-fixture';
		document.body.appendChild( host );
		// menu-item-7 repeats; foo.bar is one class that .foo.bar would
		// mistake for foo and bar together; md:flex and 1a only work after the
		// dot when escaped; the trailing space leaves an empty entry.
		host.innerHTML =
			'<li class="menu-item menu-item-7 menu-item-7 foo bar foo.bar md:flex 1a é ">' +
			'<a class="probe-menu-link" href="http://e.test/">m</a>' +
			'</li>';

		window.socssInspector.mainInspector.setActiveEl( $( '.probe-menu-link' ) );

		const offered = {};
		$( '.socss-selectors-window > .socss-selector' ).each( function () {
			const selector = $( this ).data( 'selector' );
			offered[ selector ] = ( offered[ selector ] || 0 ) + 1;
		} );
		return offered;
	} );

	expect( counts[ '.menu-item' ] ).toBe( 1 );
	expect( counts[ '.menu-item-7' ] ).toBe( 1 );
	expect( counts[ '.foo' ] ).toBe( 1 );
	expect( counts[ '.bar' ] ).toBe( 1 );
	expect( counts[ '.é' ] ).toBe( 1 );
	expect( counts[ '.foo.bar' ] ).toBeUndefined();
	expect( counts[ '.md:flex' ] ).toBeUndefined();
	expect( counts[ '.1a' ] ).toBeUndefined();
	expect( counts[ '.' ] ).toBeUndefined();
} );

test( 'Hovering the selector rows for a real menu item fires the highlighter without error.', async ( { page } ) => {
	const pageErrors = [];
	page.on( 'pageerror', ( error ) => pageErrors.push( String( error ) ) );

	await page.evaluate( () => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-xss-fixture';
		document.body.appendChild( host );
		// The exact class string WordPress core gives a classic menu item,
		// plus a Tailwind-style class and a markup-shaped class a page might
		// carry. Only the plain core classes may be offered.
		host.innerHTML =
			'<ul class="menu"><li class="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children menu-item-30387 md:flex x&lt;b/data-xss-probe=1&gt;">' +
			'<a class="probe-menu-link" href="http://e.test/">Item</a>' +
			'</li></ul>';

		window.socssInspector.mainInspector.setActiveEl( $( '.probe-menu-link' ) );
	} );

	const rows = page.locator( '.socss-selectors-window > .socss-selector' );
	const count = await rows.count();
	expect( count ).toBeGreaterThan( 0 );

	// Real mouse hover over each row, which fires the row's mouseenter ->
	// hl.highlight( selector ). An unescaped selector would throw here.
	for ( let i = 0; i < count; i++ ) {
		await rows.nth( i ).hover();
	}

	// Hover a row whose class only this fixture carries, and confirm the
	// highlighter drew its overlay, so a removed hover handler fails here.
	const uniqueRow = page.locator( '.socss-selectors-window > .socss-selector', {
		hasText: /^\.menu-item-30387$/,
	} );
	await uniqueRow.hover();
	await expect( page.locator( 'body > .socss-inspector-hover' ) ).toHaveCount( 1 );

	const result = await page.evaluate( () => {
		const $ = window.jQuery;
		const offered = $( '.socss-selectors-window > .socss-selector' )
			.map( function () {
				return $( this ).data( 'selector' );
			} )
			.get();
		return {
			offered,
			probeNodes: document.querySelectorAll( '[data-xss-probe]' ).length,
		};
	} );

	expect( pageErrors ).toEqual( [] );
	expect( result.probeNodes ).toBe( 0 );
	// Every plain core menu class is offered.
	for ( const selector of [
		'.menu-item', '.menu-item-type-post_type', '.menu-item-object-page',
		'.menu-item-has-children', '.menu-item-30387',
	] ) {
		expect( result.offered ).toContain( selector );
	}
	// The escaping-required classes are not.
	expect( result.offered ).not.toContain( '.md:flex' );
	expect( result.offered ).not.toContain( '.x<b/data-xss-probe=1>' );
} );
