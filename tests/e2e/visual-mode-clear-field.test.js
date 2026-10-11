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

	// Accept a beforeunload prompt if one appears, so the reload proceeds;
	// Playwright would otherwise dismiss it and cancel the reload.
	page.on( 'dialog', ( dialog ) => (
		dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()
	) );

	await page.reload();

	return page.locator( '#custom-css-textarea' ).inputValue();
};

test( 'The editor loads when syntax highlighting is disabled.', async ( { page } ) => {
	// With core syntax highlighting disabled, wp_enqueue_code_editor() enqueues
	// nothing, so the editor must fall back to the bundled CodeMirror and still
	// open Visual Mode. The profile setting is read first and restored after.
	const getHighlightingDisabled = async () => {
		await soGoTo( page, 'wp-admin/profile.php' );
		const box = page.locator( '#syntax_highlighting' );
		await expect( box ).toBeAttached();
		return box.isChecked();
	};
	const setHighlightingDisabled = async ( disabled ) => {
		await soGoTo( page, 'wp-admin/profile.php' );
		const box = page.locator( '#syntax_highlighting' );
		await expect( box ).toBeAttached();
		// The box is "Disable syntax highlighting"; checked means disabled.
		if ( ( await box.isChecked() ) !== disabled ) {
			await box.setChecked( disabled );
			await Promise.all( [ page.waitForNavigation(), page.locator( '#submit' ).click() ] );
		}
		// Confirm the value persisted, so neither the test setup nor its cleanup
		// can silently leave the preference wrong.
		await soGoTo( page, 'wp-admin/profile.php' );
		await expect( page.locator( '#syntax_highlighting' ) ).toBeChecked( { checked: disabled } );
	};

	const originalDisabled = await getHighlightingDisabled();
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( String( e ) ) );

	try {
		await setHighlightingDisabled( true );
		await soGoTo( page, EDITOR_URL );
		await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible( { timeout: 20000 } );

		const hasEditor = await page.evaluate(
			() => !! ( window.socss && window.socss.mainEditor && window.socss.mainEditor.codeMirror )
		);
		expect( hasEditor ).toBe( true );

		// The disabled preference is honoured: the fallback editor carries no CSS
		// mode and no linting, so the code is not syntax highlighted.
		const highlighting = await page.evaluate( () => {
			const cm = window.socss.mainEditor.codeMirror;
			return { mode: cm.getOption( 'mode' ), lint: cm.getOption( 'lint' ) };
		} );
		expect( highlighting.mode ).toBeFalsy();
		expect( highlighting.mode ).not.toBe( 'css' );
		expect( highlighting.lint ).toBeFalsy();

		// The notice carries the explanatory text, not just an empty box.
		const notice = page.locator( '#so-custom-css-form .socss-highlighting-off-notice' );
		await expect( notice ).toBeVisible();
		await expect( notice.locator( 'p' ) ).toContainText( 'highlighting' );
		await expect( notice.locator( 'p' ) ).toContainText( 'Autocomplete' );

		// Expanded Mode engages and still fits the viewport with the notice present.
		await page.locator( '#so-custom-css-form a.editor-expand' ).click();
		await expect( page.locator( '#so-custom-css-form' ) ).toHaveClass( /expanded/ );
		const fits = await page.evaluate( () => {
			const cm = document.querySelector( '#so-custom-css-form .CodeMirror' );
			return !! cm && cm.getBoundingClientRect().bottom <= window.innerHeight + 4;
		} );
		expect( fits ).toBe( true );
		await page.locator( '#so-custom-css-form a.editor-expand' ).click();
		await expect( page.locator( '#so-custom-css-form' ) ).not.toHaveClass( /expanded/ );

		// Dismissing the notice reclaims its height: the editor grows. Dismiss before
		// opening Visual Mode, whose panel overlaps the notice.
		const scrollHeight = () => page.evaluate(
			() => document.querySelector( '#so-custom-css-form .CodeMirror-scroll' ).getBoundingClientRect().height
		);
		const heightBefore = await scrollHeight();
		await notice.locator( '.notice-dismiss' ).click();
		await expect( notice ).toHaveCount( 0 );
		await expect.poll( scrollHeight ).toBeGreaterThan( heightBefore );

		await page.locator( '#so-custom-css-form a.editor-visual' ).click();
		await expect( page.locator( '#so-custom-css-properties' ) ).toBeVisible();

		expect( errors.filter( ( e ) => /CodeMirror is not defined/.test( e ) ) ).toEqual( [] );
	} finally {
		await setHighlightingDisabled( originalDisabled );
	}
} );

test( 'Background Size offers only valid keywords and writes valid CSS.', async ( { page } ) => {
	await saveCss( page, '.entry-title { color: #111; }' );

	await page.locator( '#so-custom-css-form a.editor-visual' ).click();
	const properties = page.locator( '#so-custom-css-properties' );
	await expect( properties ).toBeVisible();
	await properties.locator( '.toolbar select' ).selectOption( { label: '.entry-title' } );
	await properties.locator( '.section-tabs li[data-section="decoration"]' ).click();
	const section = properties.locator( '.sections .section[data-section="decoration"]' );
	await expect( section ).toBeVisible();

	const bgSize = section
		.locator( 'tr', { has: page.locator( 'th', { hasText: /^Background Size$/ } ) } )
		.locator( 'select' );

	// The value is what gets written, so every selectable value must be a valid
	// background-size keyword. Ignore the blank "unchanged" option.
	const values = await bgSize.locator( 'option' ).evaluateAll( ( opts ) => opts.map( ( o ) => o.value ) );
	const selectable = values.filter( ( v ) => v !== '' ).sort();
	expect( selectable ).toEqual( [ 'auto', 'contain', 'cover' ] );

	// Selecting a keyword writes a valid declaration, not the literal option name.
	await bgSize.selectOption( 'cover' );
	await expect.poll( () => getEditorCss( page ) ).toContain( 'background-size: cover' );
	expect( await getEditorCss( page ) ).not.toMatch( /background-size:\s*(length|percentage)/ );
} );

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

test( 'A measurement field shows its configured default unit.', async ( { page } ) => {
	const section = await openTextSection( page );

	// Line Height is configured with a default unit of em. The control must
	// show that, not the generic px fallback.
	const unit = await section
		.locator( 'tr', { has: page.locator( 'th', { hasText: /^Line Height$/ } ) } )
		.locator( '.units' )
		.textContent();

	expect( unit.trim() ).toBe( 'em' );
} );

test( 'The default editor gains the preview highlight and keeps WordPress autocomplete.', async ( { page } ) => {
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	// The default install initialises through WordPress's code editor, so this
	// exercises the wp.codeEditor path, not the fallback.
	expect( await page.evaluate( () => (
		typeof window.wp !== 'undefined' && typeof wp.codeEditor !== 'undefined'
	) ) ).toBe( true );

	// Wait for the preview iframe's inspector to connect, so the highlight call
	// reaches a live inspector rather than being swallowed when none exists.
	await page.waitForFunction(
		() => !! ( window.socss && window.socss.mainEditor && window.socss.mainEditor.inspector ),
		null,
		{ timeout: 20000 }
	);

	// Preview highlight runs: moving the cursor onto the selector fires
	// cursorActivity, which calls the connected preview with that selector. The
	// real method is wrapped (not replaced) so it still runs; the spy is
	// installed after the value is set, so only the cursor move is observed.
	const highlighted = await page.evaluate( () => {
		return new Promise( ( resolve ) => {
			const ed = window.socss.mainEditor;
			ed.codeMirror.setValue( '.entry-title {\n  color: red;\n}' );
			ed.codeMirror.setCursor( { line: 1, ch: 0 } );

			const real = ed.preview.highlight.bind( ed.preview );
			let seen = null;
			ed.preview.highlight = ( selector ) => {
				seen = selector;
				real( selector );
			};
			ed.codeMirror.setCursor( { line: 0, ch: 5 } );
			setTimeout( () => resolve( seen ), 50 );
		} );
	} );
	expect( highlighted ).toBe( '.entry-title' );

	// WordPress's own CSS autocomplete is left in place, not overwritten by the
	// plugin's smaller helper: typing a pseudo-class prefix offers nth-child,
	// which only WordPress's helper provides.
	await page.evaluate( () => {
		const ed = window.socss.mainEditor.codeMirror;
		ed.setValue( 'a:' );
		ed.focus();
		ed.setCursor( { line: 0, ch: 2 } );
	} );
	await page.keyboard.type( 'n' );
	const hints = page.locator( '.CodeMirror-hints' );
	await expect( hints ).toBeVisible();
	await expect( hints ).toContainText( 'nth-child' );
	await page.keyboard.press( 'Escape' );
} );

test( 'A toolbar save clears the leave-page warning.', async ( { page } ) => {
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	// Includes a comment, so the reload check also proves the toolbar save
	// stores the CSS verbatim rather than reformatting it.
	const newCss = '.qa-199 { color: #abcdef; /* keep this note */ }';
	await page.evaluate(
		( css ) => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( css ),
		newCss
	);

	// With unsaved changes, leaving warns.
	const before = await page.evaluate( () => ( {
		warning: window.jQuery( window ).triggerHandler( 'beforeunload' ),
		expected: socssOptions.loc.leave,
	} ) );
	expect( before.warning ).toBe( before.expected );

	const saved = page.waitForResponse( ( r ) =>
		r.url().includes( 'admin-ajax.php' ) &&
		r.request().method() === 'POST' &&
		( r.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
		r.ok()
	);
	await page.evaluate( () => window.socss.mainEditor.save() );
	await saved;

	// After the save the baseline advances (poll: the .done callback can run
	// after the response event), so leaving no longer warns.
	await page.waitForFunction(
		() => window.jQuery( window ).triggerHandler( 'beforeunload' ) === undefined,
		null,
		{ timeout: 5000 }
	);
	expect( await page.evaluate( () => window.socss.mainEditor.initValue ) ).toContain( '.qa-199' );

	// The CSS really persisted: reload and read it back from the textarea.
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#custom-css-textarea' ) ).toHaveValue( newCss );
} );

test( 'A save of CSS the server would alter keeps the leave-page warning.', async ( { page } ) => {
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	// The server stores trim( strip_tags() ), so the "<b>" is removed and the
	// stored CSS differs from this. The warning must stay so the user is not
	// told it saved unchanged.
	const taggedCss = '.qa-199-tag::after { content: "<b>"; }';
	await page.evaluate(
		( css ) => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( css ),
		taggedCss
	);

	const saved = page.waitForResponse( ( r ) =>
		r.url().includes( 'admin-ajax.php' ) &&
		r.request().method() === 'POST' &&
		( r.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
		r.ok()
	);
	const revsBefore = await page.evaluate(
		() => ( document.querySelector( '.custom-revisions-list' ) || {} ).innerHTML || ''
	);
	await page.evaluate( () => window.socss.mainEditor.save() );
	await saved;
	// Wait for the .done() callback to run, so the baseline decision is made.
	await page.waitForFunction(
		( before ) => {
			const el = document.querySelector( '.custom-revisions-list' );
			return el && el.innerHTML !== before;
		},
		revsBefore,
		{ timeout: 10000 }
	);

	const result = await page.evaluate( () => ( {
		warning: window.jQuery( window ).triggerHandler( 'beforeunload' ),
		expected: socssOptions.loc.leave,
	} ) );
	expect( result.warning ).toBe( result.expected );
} );

test( 'A save keeps the warning when a dedicated CSS file is the source.', async ( { page } ) => {
	// With a dedicated CSS file, get_custom_css() reads the file back, so an
	// unconfirmed file write must not be reported as a clean save.
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	await page.evaluate( () => {
		window.socssOptions.usesCustomFile = true;
		document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( '.qa-199-file { color: #0a0b0c; }' );
	} );

	const saved = page.waitForResponse( ( r ) =>
		r.url().includes( 'admin-ajax.php' ) &&
		r.request().method() === 'POST' &&
		( r.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
		r.ok()
	);
	const revsBefore = await page.evaluate(
		() => ( document.querySelector( '.custom-revisions-list' ) || {} ).innerHTML || ''
	);
	await page.evaluate( () => window.socss.mainEditor.save() );
	await saved;
	await page.waitForFunction(
		( before ) => {
			const el = document.querySelector( '.custom-revisions-list' );
			return el && el.innerHTML !== before;
		},
		revsBefore,
		{ timeout: 10000 }
	);

	const result = await page.evaluate( () => ( {
		warning: window.jQuery( window ).triggerHandler( 'beforeunload' ),
		expected: socssOptions.loc.leave,
	} ) );
	expect( result.warning ).toBe( result.expected );
} );

test( 'A post-specific toolbar save keeps the leave-page warning.', async ( { page } ) => {
	// On the socss_post_id route the AJAX save still writes the global option,
	// so the warning must stay rather than hide an unsaved post edit.
	const requestUtils = await setupRequestUtils();
	let qaPostId = null;
	try {
		const post = await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/posts',
			data: { title: 'QA 199 post-specific CSS', status: 'publish' },
		} );
		qaPostId = post.id;

		await soGoTo( page, EDITOR_URL + '&socss_post_id=' + qaPostId );
		await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

		await page.evaluate(
			() => document.querySelector( '#so-custom-css-form .CodeMirror' ).CodeMirror.setValue( '.qa-199-post { color: #123456; }' )
		);

		const saved = page.waitForResponse( ( r ) =>
			r.url().includes( 'admin-ajax.php' ) &&
			r.request().method() === 'POST' &&
			( r.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
			r.ok()
		);
		const revsBefore = await page.evaluate(
			() => ( document.querySelector( '.custom-revisions-list' ) || {} ).innerHTML || ''
		);
		await page.evaluate( () => window.socss.mainEditor.save() );
		await saved;
		// Wait until the save's .done() callback has run: it rewrites the
		// revisions list, so the baseline decision has already been made before
		// the warning is checked below.
		await page.waitForFunction(
			( before ) => {
				const el = document.querySelector( '.custom-revisions-list' );
				return el && el.innerHTML !== before;
			},
			revsBefore,
			{ timeout: 10000 }
		);

		// The baseline must NOT advance here, so the leave-page warning still fires.
		const result = await page.evaluate( () => ( {
			warning: window.jQuery( window ).triggerHandler( 'beforeunload' ),
			expected: socssOptions.loc.leave,
		} ) );
		expect( result.warning ).toBe( result.expected );
	} finally {
		if ( qaPostId ) {
			await requestUtils.rest( { method: 'DELETE', path: `/wp/v2/posts/${ qaPostId }`, data: { force: true } } );
		}
		await requestUtils.request.dispose();
	}
} );

test( 'A Visual Mode save clears the leave-page warning.', async ( { page } ) => {
	const section = await openTextSection( page );

	// Change a field so there are unsaved changes.
	const fontSize = section
		.locator( 'tr', { has: page.locator( 'th', { hasText: /^Font Size$/ } ) } )
		.locator( '.socss-field-input' );
	await fontSize.click();
	await fontSize.selectText();
	await fontSize.type( '42' );

	// The field change live-updates the main editor, so leaving warns before
	// saving. Poll, since the update runs on the field's key handler.
	await page.waitForFunction(
		() => window.jQuery( window ).triggerHandler( 'beforeunload' ) !== undefined,
		null,
		{ timeout: 5000 }
	);

	// Save through the Visual Mode toolbar and wait for the AJAX save.
	const saved = page.waitForResponse( ( r ) =>
		r.url().includes( 'admin-ajax.php' ) &&
		r.request().method() === 'POST' &&
		( r.request().postData() || '' ).includes( 'action=socss_save_css' ) &&
		r.ok()
	);
	await page.locator( '#so-custom-css-properties .toolbar .save' ).click();
	await saved;

	// After a Visual save the baseline matches the main editor's content, so
	// leaving no longer warns. Poll, since the .done callback can run after the
	// response event.
	await page.waitForFunction(
		() => window.jQuery( window ).triggerHandler( 'beforeunload' ) === undefined,
		null,
		{ timeout: 5000 }
	);

	// The warning cleared, so the displayed CSS must equal what was stored.
	// Capture the editor's value, reload, and assert the saved CSS matches it
	// exactly (and that the change is there).
	const displayed = await getEditorCss( page );
	expect( displayed ).toContain( 'font-size: 42px' );
	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#custom-css-textarea' ) ).toHaveValue( displayed );
} );

test( 'The removed snippets browser is gone and the editor still loads.', async ( { page } ) => {
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( String( e ) ) );

	await soGoTo( page, EDITOR_URL );
	await expect( page.locator( '#so-custom-css-form .CodeMirror' ) ).toBeVisible();

	const state = await page.evaluate( () => ( {
		hasSnippetView: typeof window.socss.view.snippets,
		hasTemplate: !! document.getElementById( 'template-snippet-browser' ),
		hasEditor: !! ( window.socss.mainEditor && window.socss.mainEditor.codeMirror ),
	} ) );
	expect( state.hasSnippetView ).toBe( 'undefined' );
	expect( state.hasTemplate ).toBe( false );
	expect( state.hasEditor ).toBe( true );
	await expect( page.locator( '#so-custom-css-form .custom-css-toolbar' ) ).not.toContainText( 'Snippets' );

	// The deprecated setSnippets() stub stays callable: an external caller of
	// window.socss.mainEditor gets a no-op, not a TypeError, and no browser opens.
	const stub = await page.evaluate( () => {
		const editor = window.socss.mainEditor;
		const type = typeof editor.setSnippets;
		let threw = false;
		let returned = 'skipped';
		try {
			returned = editor.setSnippets( [ { name: 'Test', css: 'a {}' } ] );
		} catch ( e ) {
			threw = true;
		}
		return {
			type,
			threw,
			returned,
			hasBrowser: !! document.querySelector( '.snippet-browser-dialog' ),
		};
	} );
	expect( stub.type ).toBe( 'function' );
	expect( stub.threw ).toBe( false );
	expect( stub.returned ).toBeUndefined();
	expect( stub.hasBrowser ).toBe( false );

	expect( errors ).toEqual( [] );
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
