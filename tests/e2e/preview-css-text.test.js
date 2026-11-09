/**
 * Live preview writes the editor CSS as text.
 *
 * updatePreviewCss (js/editor.js) copies the CodeMirror value into the preview
 * iframe's <style> element. Writing it with jQuery .html() runs jQuery's HTML
 * fallback when the text contains <style>/<script>/<link>, which can build
 * child nodes. Writing it with .text() keeps the value inert and unchanged.
 *
 * This checks the unsaved live preview only: the save handler runs
 * sanitize_css()/strip_tags() (so-css.php), so a <style>-bearing round-trip is
 * not a valid preservation check. A separate test confirms tag-free CSS still
 * round-trips through save and reload.
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site.
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

const EDITOR_URL = 'wp-admin/themes.php?page=so_custom_css';

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
 * Opens a logged-in admin page, runs the callback, and closes the page.
 *
 * @param {import('@playwright/test').Browser} browser  The browser.
 * @param {Function}                           callback Receives the page.
 *
 * @return {Promise<*>} The callback's result.
 */
const withAdminPage = async ( browser, callback ) => {
	const page = await browser.newPage();

	try {
		await login( page );
		return await callback( page );
	} finally {
		await page.close();
	}
};

/**
 * Saves the given CSS through the editor and confirms it landed.
 *
 * @param {import('@playwright/test').Page} page The page.
 * @param {string}                          css  The CSS to save.
 */
const saveCss = async ( page, css ) => {
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	await page.evaluate(
		( value ) => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( value ),
		css
	);

	await Promise.all( [
		page.waitForNavigation(),
		page.locator( 'input[name="siteorigin_custom_css_save"]' ).click(),
	] );

	await expect( page.locator( '#custom-css-textarea' ) ).toHaveValue( css );
};

let originalCss = null;

test.beforeAll( async () => {
	const requestUtils = await setupRequestUtils();

	try {
		const plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );
		const plugin = findPluginUnderTest( plugins );

		if ( plugin.status !== 'active' ) {
			await setPluginStatus( plugin.plugin, 'active' );
			activatedPluginId = plugin.plugin;
		}
	} finally {
		await requestUtils.request.dispose();
	}
} );

test.afterAll( async ( { browser } ) => {
	// Restore the site's CSS first, so a mid-test failure in the save test does
	// not leave probe CSS active. saveCss asserts the restored value.
	if ( originalCss !== null ) {
		await withAdminPage( browser, ( page ) => saveCss( page, originalCss ) );
		originalCss = null;
	}

	if ( activatedPluginId ) {
		await setPluginStatus( activatedPluginId, 'inactive' );
		activatedPluginId = null;
	}
} );

test.beforeEach( async ( { page } ) => {
	await login( page );
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();
	if ( originalCss === null ) {
		originalCss = await page.locator( '#custom-css-textarea' ).inputValue();
	}
} );

test( 'CSS containing a style tag stays inert text in the live preview.', async ( { page } ) => {
	// Valid CSS whose comment holds a well-formed <style></style>. Under .html()
	// jQuery parses this into a child node; under .text() it stays text.
	const css = '.socss-preview-probe { color: rgb(1, 2, 3); } /* <style></style> */';

	await page.evaluate(
		( value ) => {
			document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( value );
		},
		css
	);

	// Wait for the preview style element to receive the CSS.
	await page.waitForFunction( () => {
		const iframe = document.querySelector( '#preview-iframe' );
		const doc = iframe && iframe.contentDocument;
		const style = doc && doc.querySelector( 'style.siteorigin-custom-css' );
		return !! style && style.textContent.indexOf( 'socss-preview-probe' ) !== -1;
	} );

	const result = await page.evaluate( () => {
		const doc = document.querySelector( '#preview-iframe' ).contentDocument;
		const style = doc.querySelector( 'style.siteorigin-custom-css' );
		return {
			textContent: style.textContent,
			childElements: style.children.length,
		};
	} );

	// The style element's text is exactly the editor value: nothing was parsed
	// away or into nodes.
	expect( result.textContent ).toBe( '.socss-preview-probe { color: rgb(1, 2, 3); } /* <style></style> */' );
	// The style element holds no child elements (a parsed <style> would appear).
	expect( result.childElements ).toBe( 0 );
} );

test( 'Tag-free CSS round-trips through save and reload unchanged.', async ( { page } ) => {
	const css = '.socss-roundtrip { color: rgb(4, 5, 6); }';

	// saveCss saves and confirms the textarea value; afterAll restores the
	// original CSS, so a failure here cannot leave the probe CSS on the site.
	await saveCss( page, css );

	await soGoTo( page, EDITOR_URL );
	const saved = await page.evaluate(
		() => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.getValue()
	);
	expect( saved ).toBe( css );
} );
