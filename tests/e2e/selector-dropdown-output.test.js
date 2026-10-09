/**
 * Visual editor selector dropdown output.
 *
 * The visual editor lists every rule of the CSS in a dropdown. Selectors can
 * come from the front-end inspector, which reads them from page markup, so
 * the dropdown must show each selector as text and match it exactly, never
 * insert it as markup.
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site. Point
 * tests/so-tests.env only at a disposable site. The CSS is placed in the
 * editor without saving, so the site's stylesheet is never changed.
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

// A node with this attribute only appears if a selector was inserted as markup.
const PROBE = 'data-xss-probe';

const SEED_CSS = [
	'.a {\n  color: #1d3557;\n}',
	'.a > .b {\n  color: #1d3557;\n}',
	'.c  >\n  .d {\n  color: #1d3557;\n}',
	'a:hover {\n  color: #1d3557;\n}',
	'&:not(.x) {\n  color: #1d3557;\n}',
	`.p<b/${ PROBE }=1> {\n  color: #1d3557;\n}`,
	`@media screen {\n  .m<b/${ PROBE }=2> {\n    color: #1d3557;\n  }\n  .only-in-media {\n    color: #1d3557;\n  }\n}`,
].join( '\n\n' );

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

/**
 * Opens the editor, places the CSS in CodeMirror without saving, and opens
 * the visual editor, which loads its dropdown from the CodeMirror value.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 * @param {string} css The CSS to load.
 */
const openVisualEditor = async ( page, css ) => {
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	await page.evaluate(
		( value ) => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( value ),
		css
	);

	await page.locator( '#so-custom-css-form a.editor-visual' ).click();
	await expect( page.locator( '#so-custom-css-properties' ) ).toBeVisible();
};

/**
 * Reads the dropdown options and the CodeMirror value.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 *
 * @return {Promise<Object>} { options, selected, css, probeNodes }.
 */
const readDropdown = ( page ) => page.evaluate( ( probe ) => {
	const select = document.querySelector( '#so-custom-css-properties .toolbar select' );
	return {
		options: Array.from( select.options ).map( ( option ) => ( {
			text: option.textContent,
			value: option.getAttribute( 'value' ),
			children: option.children.length,
		} ) ),
		selected: select.value,
		css: document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.getValue(),
		probeNodes: document.querySelectorAll( `[${ probe }]` ).length,
	};
}, PROBE );

/**
 * Calls the visual editor's addSelector, as an inspector click does.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 * @param {string} selector The selector to add or select.
 */
const addSelector = ( page, selector ) => page.evaluate(
	( value ) => window.socss.mainEditor.visualProperties.addSelector( value ),
	selector
);

// A menu item whose class carries markup, as stored post content can hold it.
const HOSTILE_CLASS = `x<b/${ PROBE }=9>`;
const MENU_POST_CONTENT = `<!-- wp:html --><ul><li class="menu-item x&lt;b/${ PROBE }=9&gt;"><a class="probe-menu-link" href="#">menu link</a></li></ul><!-- /wp:html -->`;

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
				title: 'SiteOrigin CSS selector dropdown',
				status: 'publish',
				content: MENU_POST_CONTENT,
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
} );

test( 'Selectors are shown as text, and each option value is the raw selector.', async ( { page } ) => {
	await openVisualEditor( page, SEED_CSS );
	const result = await readDropdown( page );

	expect( result.probeNodes ).toBe( 0 );
	result.options.forEach( ( option ) => {
		expect( option.children ).toBe( 0 );
		expect( option.value ).toBe( option.text );
	} );

	const texts = result.options.map( ( option ) => option.text );
	expect( texts ).toContain( `.p<b/${ PROBE }=1>` );
	expect( texts ).toContain( `@media screen: .m<b/${ PROBE }=2>` );
	expect( texts ).toContain( '.a > .b' );
} );

test( 'Adding a selector that already has a rule selects it without adding a rule.', async ( { page } ) => {
	await openVisualEditor( page, SEED_CSS );
	const before = await readDropdown( page );

	// The parser keeps the rule's own whitespace, so take its exact selector.
	const spaced = before.options.find( ( option ) => option.text.startsWith( '.c' ) ).value;
	expect( spaced ).toMatch( /\s{2,}/ );

	for ( const selector of [ '.a', '.a > .b', 'a:hover', '&:not(.x)', spaced ] ) {
		await addSelector( page, selector );
		const after = await readDropdown( page );

		expect( after.selected ).toBe( selector );
		expect( after.options.length ).toBe( before.options.length );
		expect( after.css ).toBe( before.css );
	}
} );

test( 'A selector found only inside @media is added as a top-level rule.', async ( { page } ) => {
	await openVisualEditor( page, SEED_CSS );
	const before = await readDropdown( page );

	await addSelector( page, '.only-in-media' );
	const after = await readDropdown( page );

	expect( after.options.length ).toBe( before.options.length + 1 );
	expect( after.options.filter( ( option ) => option.value === '.only-in-media' ) ).toHaveLength( 1 );
	expect( after.selected ).toBe( '.only-in-media' );
} );

test( 'A new markup-shaped selector is added as text.', async ( { page } ) => {
	await openVisualEditor( page, SEED_CSS );
	const before = await readDropdown( page );
	const selector = `.x<b/${ PROBE }=3>`;

	await addSelector( page, selector );
	const after = await readDropdown( page );

	expect( after.probeNodes ).toBe( 0 );
	expect( after.options.length ).toBe( before.options.length + 1 );
	const added = after.options.filter( ( option ) => option.text === selector );
	expect( added ).toHaveLength( 1 );
	expect( added[ 0 ].children ).toBe( 0 );
	expect( added[ 0 ].value ).toBe( selector );
} );

test( 'Clicking menu item selectors from the preview adds no markup to the visual editor.', async ( { page } ) => {
	// A plain seed, so any markup in the dropdown can only come from the page.
	await openVisualEditor( page, '.entry-title {\n  color: #1d3557;\n}' );

	// The visual editor opens expanded, with the preview frame. Point it at
	// the post holding the hostile menu item.
	const iframe = page.locator( '#preview-iframe' );
	await iframe.evaluate( ( el, url ) => {
		el.src = url + ( url.includes( '?' ) ? '&' : '?' ) + 'so_css_preview=1';
	}, postLink );

	const frame = await ( await iframe.elementHandle() ).contentFrame();
	await frame.waitForSelector( '.probe-menu-link', { state: 'attached' } );
	await frame.waitForFunction( () => window.socssInspector && window.socssInspector.mainInspector );

	// The hostile class reached the page intact.
	const className = await frame.evaluate(
		() => document.querySelector( '.probe-menu-link' ).parentElement.className
	);
	expect( className ).toBe( `menu-item ${ HOSTILE_CLASS }` );

	// Inspect the link, then click every selector the inspector offers.
	const offered = await frame.evaluate( () => {
		const $ = window.jQuery;
		window.socssInspector.mainInspector.setActiveEl( $( '.probe-menu-link' ) );

		const rows = $( '.socss-selectors-window > .socss-selector' );
		const selectors = rows.map( function () {
			return $( this ).data( 'selector' );
		} ).get();
		rows.each( function () {
			$( this ).trigger( 'click' );
		} );
		return selectors;
	} );
	expect( offered ).toContain( '.menu-item' );

	const result = await readDropdown( page );
	expect( result.probeNodes ).toBe( 0 );
	result.options.forEach( ( option ) => {
		expect( option.children ).toBe( 0 );
	} );
	expect( result.options.map( ( option ) => option.value ) ).toContain( '.menu-item' );
} );
