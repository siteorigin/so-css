/**
 * Visual Mode field behaviour.
 *
 * Clearing a field removes only that declaration, not the ones after it
 * (so-css#195). Opening a rule with a keyword colour (e.g. `color: red`) keeps
 * that declaration; the Text Color control shows blank for a keyword but the
 * CSS is preserved, and the colour can still be edited or cleared (so-css#208).
 *
 * Runs via `npm run tests`, which starts a throwaway Playground site. Point
 * tests/so-tests.env only at a disposable site: these tests save the CSS
 * repeatedly, and the plugin keeps the latest 15 revisions, so older revisions
 * on that site can drop off. A CI workflow must build the plugin before running
 * the tests, because the shared runner skips its own build under GitHub Actions.
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

const SEED_CSS = '.entry-title { color: #1d3557; font-size: 28px; letter-spacing: 1px; }';

// Every test saves the site's one custom CSS, so run them in order in one
// worker rather than in parallel.
test.describe.configure( { mode: 'default' } );

/**
 * Returns the main CodeMirror editor's current value.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 *
 * @return {Promise<string>} The CSS in the editor.
 */
const getEditorCss = ( page ) => page.evaluate(
	() => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.getValue()
);

/**
 * Checks which declarations the CSS contains.
 *
 * @param {string} css The CSS to check.
 * @param {Object} expected Map of property name to whether it must be present.
 */
const expectDeclarations = ( css, expected ) => {
	for ( const [ property, present ] of Object.entries( expected ) ) {
		const pattern = new RegExp( `(^|[\\s{;])${ property }\\s*:` );

		if ( present ) {
			expect( css, `"${ property }" should remain` ).toMatch( pattern );
		} else {
			expect( css, `"${ property }" should be removed` ).not.toMatch( pattern );
		}
	}
};

/**
 * Saves CSS through the editor form, as the Save CSS button does.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 * @param {string} css The CSS to save.
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

	expect( await page.locator( '#custom-css-textarea' ).inputValue() ).toBe( css );
};

/**
 * Logs in as the admin.
 *
 * The common doLogin can lose the race with wp-login.php's own focus script,
 * which moves focus to the username field 200ms after load and sends the
 * password there. It also returns before the login request finishes. So
 * fill until both fields hold their values, then wait for wp-admin.
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
 * Runs a callback in a new logged in admin page, then closes the page.
 *
 * @param {import('@playwright/test').Browser} browser The Playwright browser.
 * @param {Function} callback Receives the page.
 *
 * @return {Promise<*>} The callback's return value.
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
 * Finds the SiteOrigin CSS install under test.
 *
 * Playground mounts this checkout under its own folder name, so prefer that
 * plugin ID. Fall back to the display name only when a single install has it,
 * so a site with two copies never tests the wrong one.
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
 * Sets the status of the plugin under test.
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

// The site's state before these tests, restored afterwards so a persistent
// site set in so-tests.env keeps its stylesheet and plugin status.
let originalCss = null;
let activatedPluginId = null;

test.beforeAll( async ( { browser } ) => {
	const requestUtils = await setupRequestUtils();
	const plugins = await requestUtils.rest( { path: '/wp/v2/plugins' } );
	await requestUtils.request.dispose();

	const plugin = findPluginUnderTest( plugins );

	if ( plugin.status !== 'active' ) {
		await setPluginStatus( plugin.plugin, 'active' );
		activatedPluginId = plugin.plugin;
	}

	originalCss = await withAdminPage( browser, async ( page ) => {
		await soGoTo( page, EDITOR_URL );
		return page.locator( '#custom-css-textarea' ).inputValue();
	} );
} );

test.afterAll( async ( { browser } ) => {
	try {
		if ( originalCss !== null ) {
			await withAdminPage( browser, ( page ) => saveCss( page, originalCss ) );
		}
	} finally {
		if ( activatedPluginId ) {
			await setPluginStatus( activatedPluginId, 'inactive' );
			activatedPluginId = null;
		}
	}
} );

test.beforeEach( async ( { page } ) => {
	await login( page );
} );

/**
 * Saves the given CSS, then opens Visual Mode on the given selector with the
 * Text tab active.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 * @param {string} css The CSS to save (defaults to the seed).
 * @param {string} label The selector to open (defaults to `.entry-title`).
 *
 * @return {Promise<import('@playwright/test').Locator>} The Text section.
 */
const openTextSection = async ( page, css = SEED_CSS, label = '.entry-title' ) => {
	await saveCss( page, css );

	await page.locator( '#so-custom-css-form a.editor-visual' ).click();

	const properties = page.locator( '#so-custom-css-properties' );
	await expect( properties ).toBeVisible();

	await properties.locator( '.toolbar select' ).selectOption( { label } );
	await properties.locator( '.section-tabs li[data-section="text"]' ).click();

	const section = properties.locator( '.sections .section[data-section="text"]' );
	await expect( section ).toBeVisible();

	return section;
};

/**
 * Clears a text input with real key presses, so the editor's keyup
 * handlers run as they do for a user.
 *
 * @param {import('@playwright/test').Locator} input The input to clear.
 */
const clearInput = async ( input ) => {
	await input.click();
	await input.selectText();
	await input.press( 'Backspace' );
	await expect( input ).toHaveValue( '' );
};

/**
 * Saves from Visual Mode, reloads the page and returns the saved CSS.
 *
 * @param {import('@playwright/test').Page} page The Playwright page object.
 *
 * @return {Promise<string>} The saved CSS.
 */
const saveAndReload = async ( page ) => {
	const saved = page.waitForResponse( ( response ) =>
		response.url().includes( 'admin-ajax.php' ) &&
		response.request().method() === 'POST' &&
		( response.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
		response.ok()
	);

	await page.locator( '#so-custom-css-properties .toolbar .save' ).click();
	await saved;

	// A Visual Mode save leaves the editor's unsaved-changes check dirty, so
	// accept its beforeunload prompt. Playwright would dismiss it and cancel
	// the reload.
	page.on( 'dialog', ( dialog ) => (
		dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()
	) );

	await page.reload();

	return page.locator( '#custom-css-textarea' ).inputValue();
};

test( 'Switching the editor theme applies and reverts it.', async ( { page } ) => {
	await soGoTo( page, EDITOR_URL );
	const cm = page.locator( '#so-custom-css-form .CodeMirror' );
	await expect( cm ).toBeVisible();
	const select = page.locator( '#so_css_editor_theme' );

	// Pick Dark, then Light again. CodeMirror reflects the theme as a
	// cm-s-<theme> class, so switching back to Light must drop the dark theme.
	await select.selectOption( 'ambiance' );
	await expect( cm ).toHaveClass( /cm-s-ambiance/ );

	await select.selectOption( 'neat' );
	await expect( cm ).toHaveClass( /cm-s-neat/ );
	await expect( cm ).not.toHaveClass( /cm-s-ambiance/ );
} );

test( 'Clearing Font Size keeps the declarations after it.', async ( { page } ) => {
	const section = await openTextSection( page );

	await clearInput(
		section.locator( 'tr', { has: page.locator( 'th', { hasText: /^Font Size$/ } ) } )
			.locator( '.socss-field-input' )
	);

	const expected = {
		color: true,
		'font-size': false,
		'letter-spacing': true,
	};

	expectDeclarations( await getEditorCss( page ), expected );
	expectDeclarations( await saveAndReload( page ), expected );
} );

test( 'Clearing Text Color keeps the declarations after it.', async ( { page } ) => {
	const section = await openTextSection( page );

	await clearInput(
		section.locator( 'tr', { has: page.locator( 'th', { hasText: /^Text Color$/ } ) } )
			.locator( 'input.socss-property-controller-input' )
	);

	const expected = {
		color: false,
		'font-size': true,
		'letter-spacing': true,
	};

	expectDeclarations( await getEditorCss( page ), expected );
	expectDeclarations( await saveAndReload( page ), expected );
} );

const openRule = ( page, css ) => openTextSection( page, css, '.a' );

const textColorInput = ( page, section ) =>
	section.locator( 'tr', { has: page.locator( 'th', { hasText: /^Text Color$/ } ) } )
		.locator( 'input.socss-property-controller-input' );

// Opening a rule must not drop its colour. A keyword colour (red/blue/RED) is the
// regression; hex and rgb() must keep working too.
for ( const { value, pattern } of [
	{ value: 'red', pattern: /color:\s*red\b/ },
	{ value: 'blue', pattern: /color:\s*blue\b/ },
	{ value: 'RED', pattern: /color:\s*RED\b/ },
	{ value: '#1d3557', pattern: /color:\s*#1d3557\b/ },
	{ value: 'rgb(255, 0, 0)', pattern: /color:\s*rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/ },
] ) {
	test( `Opening a rule keeps its colour (${ value }).`, async ( { page } ) => {
		await openRule( page, `.a { color: ${ value }; }` );
		expect( await getEditorCss( page ) ).toMatch( pattern );
	} );
}

test( 'A keyword colour and the declaration after it survive a save and reload.', async ( { page } ) => {
	await openRule( page, '.a { color: red; font-size: 20px; }' );

	expect( await getEditorCss( page ) ).toMatch( /color:\s*red\b/ );

	const saved = await saveAndReload( page );
	expect( saved ).toMatch( /color:\s*red\b/ );
	expect( saved ).toMatch( /font-size:\s*20px\b/ );
} );

test( 'After opening on a keyword colour, typing a hex updates the rule.', async ( { page } ) => {
	const section = await openRule( page, '.a { color: red; }' );
	const input = textColorInput( page, section );

	await input.click();
	await input.selectText();
	await input.pressSequentially( '#112233' );
	await input.press( 'Enter' );

	await expect( async () => {
		expect( await getEditorCss( page ) ).toMatch( /color:\s*#112233\b/ );
	} ).toPass();
} );

test( 'Clearing a displayed colour removes the declaration.', async ( { page } ) => {
	// Open on a hex, which the control displays, so the field is not blank.
	const section = await openRule( page, '.a { color: #112233; font-size: 20px; }' );
	const input = textColorInput( page, section );
	await expect( input ).toHaveValue( '#112233' );

	await clearInput( input );

	const expected = { color: false, 'font-size': true };
	expectDeclarations( await getEditorCss( page ), expected );
	expectDeclarations( await saveAndReload( page ), expected );
} );

test( 'A navigation key over the blank keyword field does not drop the colour.', async ( { page } ) => {
	// The field is blank for a keyword colour, so a non-editing key (an arrow)
	// fires keyup over an empty field. The colour must survive.
	const section = await openRule( page, '.a { color: red; font-size: 20px; }' );
	const input = textColorInput( page, section );
	await expect( input ).toHaveValue( '' );

	await input.click();
	await input.press( 'ArrowLeft' );
	await input.press( 'End' );

	const expected = { color: true, 'font-size': true };
	expectDeclarations( await getEditorCss( page ), expected );
	expect( await getEditorCss( page ) ).toMatch( /color:\s*red\b/ );
	const saved = await saveAndReload( page );
	expect( saved ).toMatch( /color:\s*red\b/ );
} );

test( 'A modifier shortcut over the blank keyword field does not drop the colour.', async ( { page } ) => {
	// Ctrl+A / Cmd+C carry a one-character key but are not edits: the field is
	// unchanged, so the colour must survive.
	const section = await openRule( page, '.a { color: red; font-size: 20px; }' );
	const input = textColorInput( page, section );
	await expect( input ).toHaveValue( '' );

	await input.click();
	await input.press( 'Control+a' );
	await input.press( 'Meta+c' );

	expect( await getEditorCss( page ) ).toMatch( /color:\s*red\b/ );
	expect( await saveAndReload( page ) ).toMatch( /color:\s*red\b/ );
} );

test( 'Clearing a keyword colour with Backspace removes the declaration.', async ( { page } ) => {
	// The field is blank for a keyword, but Backspace is an editing key: the
	// user intends to clear it, so the declaration must be removed.
	const section = await openRule( page, '.a { color: red; font-size: 20px; }' );
	const input = textColorInput( page, section );
	await expect( input ).toHaveValue( '' );

	await input.click();
	await input.press( 'Backspace' );
	await input.blur();

	const expected = { color: false, 'font-size': true };
	expectDeclarations( await getEditorCss( page ), expected );
	expectDeclarations( await saveAndReload( page ), expected );
} );
