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

// Each non-http(s) scheme is kept out of the live href but shown as the label.
for ( const scheme of [ 'data:text/plain,x', 'javascript:void(0)', '//evil.example/x' ] ) {
	test( `A non-http(s) link URL (${ scheme }) is kept out of the href attribute.`, async ( { page } ) => {
		const result = await page.evaluate( ( href ) => {
			const $ = window.jQuery;
			const host = document.createElement( 'div' );
			host.id = 'socss-xss-fixture';
			document.body.appendChild( host );
			const anchor = document.createElement( 'a' );
			anchor.id = 'probe-scheme';
			// setAttribute keeps the exact scheme string (no parser resolution).
			anchor.setAttribute( 'href', href );
			anchor.textContent = 'd';
			host.appendChild( anchor );

			window.socssInspector.mainInspector.setActiveEl( $( '#probe-scheme' ) );

			const linkAnchor = document.querySelector( '.socss-link a' );
			return {
				hasHref: linkAnchor ? linkAnchor.hasAttribute( 'href' ) : null,
				labelText: linkAnchor ? linkAnchor.textContent : null,
			};
		}, scheme );

		expect( result.hasHref ).toBe( false );
		expect( result.labelText ).toBe( scheme );
	} );
}

test( 'Element selectors are escaped in the hierarchy and selector lists, and raw values survive.', async ( { page } ) => {
	const result = await page.evaluate( ( probe ) => {
		const $ = window.jQuery;
		const host = document.createElement( 'div' );
		host.id = 'socss-xss-fixture';
		document.body.appendChild( host );
		// Hostile class on the .menu-item ancestor (reaches the selectors
		// window via the parentClasses branch) and a hostile id on the
		// inspected anchor (reaches the hierarchy bar via elSelector). A real
		// menu-item-7 class exercises the <strong> highlight.
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

		const rawSelector = '.x<b/data-xss-probe=1>';

		// The selectors-window row carrying the hostile class.
		let row = null;
		$( '.socss-selectors-window > .socss-selector' ).each( function () {
			if ( $( this ).data( 'selector' ) === rawSelector ) {
				row = this;
			}
		} );
		const rowData = row ? $( row ).data( 'selector' ) : null;
		const rowText = row ? row.textContent : null;
		if ( row ) {
			$( row ).trigger( 'click' );
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
			rowFound: !! row,
			rowData,
			rowText,
			clickPayload,
			strongCount: strongs.length,
			strongText: strongs.length ? strongs[ 0 ].textContent : null,
		};
	}, PROBE );

	// No value was inserted as markup anywhere in the inspector UI.
	expect( result.probeNodesTotal ).toBe( 0 );
	expect( result.probeNodesHierarchy ).toBe( 0 );
	expect( result.probeNodesSelectors ).toBe( 0 );

	// The hostile selector is shown literally and its raw value is preserved
	// for the row data and the click_selector event.
	expect( result.rowFound ).toBe( true );
	expect( result.rowText ).toContain( '.x<b/data-xss-probe=1>' );
	expect( result.rowData ).toBe( '.x<b/data-xss-probe=1>' );
	expect( result.clickPayload ).toBe( '.x<b/data-xss-probe=1>' );

	// The legitimate important-class highlight still renders as real <strong>.
	expect( result.strongCount ).toBe( 1 );
	expect( result.strongText ).toBe( 'menu-item-7' );
} );
