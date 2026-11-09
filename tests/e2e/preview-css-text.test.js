/**
 * Live preview writes the editor CSS as text.
 *
 * updatePreviewCss (js/editor.js) copies the trimmed CodeMirror value into the
 * preview iframe's <style> element. Writing it with jQuery .html() runs
 * jQuery's HTML fallback when the text contains <style>/<script>/<link>, which
 * can build child nodes. Writing it with .text() applies the trimmed CSS as
 * plain text, never interpreting it as markup.
 *
 * This checks the unsaved live preview only, so it mutates no site-wide state:
 * it sets the editor value in memory and reads the preview. The save path is
 * unchanged by this work and its round-trip is already covered by the
 * visual-mode specs.
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

test.afterAll( async () => {
	if ( activatedPluginId ) {
		await setPluginStatus( activatedPluginId, 'inactive' );
		activatedPluginId = null;
	}
} );

test.beforeEach( async ( { page } ) => {
	await login( page );
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();
} );

test( 'CSS containing a style tag stays inert text in the live preview.', async ( { page } ) => {
	// Valid CSS whose comment holds a well-formed <style></style>. Under .html()
	// jQuery parses this into a child node; under .text() it stays text. The
	// value is set in the editor only and never saved.
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

	// The style element's text is exactly the editor value (already whitespace-
	// trimmed): nothing was parsed away or into nodes.
	expect( result.textContent ).toBe( '.socss-preview-probe { color: rgb(1, 2, 3); } /* <style></style> */' );
	// The style element holds no child elements (a parsed <style> would appear).
	expect( result.childElements ).toBe( 0 );
} );
