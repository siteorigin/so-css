/**
 * Live preview writes the editor CSS as text.
 *
 * updatePreviewCss (js/editor.js) copies the trimmed CodeMirror value into the
 * preview iframe's <style> element and must apply it as plain text: CSS whose
 * text contains <style>/<script>/<link> stays text and builds no child nodes.
 * The value is set in the editor only and never saved, so this mutates no
 * site-wide state.
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site.
 */
const {
	expect,
	test,
} = require( '@playwright/test' );

const path = require( 'path' );

const {
	doLogin,
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

test.beforeAll( async () => {
	// Ensure the plugin is active. Activation is idempotent across parallel
	// workers; the suite never deactivates it, so it cannot disable the plugin
	// out from under another suite.
	const requestUtils = await setupRequestUtils();

	try {
		const plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );
		const plugin = findPluginUnderTest( plugins );

		if ( plugin.status !== 'active' ) {
			await requestUtils.rest( {
				method: 'PUT',
				path: `/wp/v2/plugins/${ plugin.plugin }`,
				data: { status: 'active' },
			} );
		}
	} finally {
		await requestUtils.request.dispose();
	}
} );

test.beforeEach( async ( { page } ) => {
	await doLogin( page );
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
