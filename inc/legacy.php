<?php

/**
 * Remove the menu item for the CSS editor that comes bundled with SiteOrigin themes
 */
function siteorigin_css_legacy_remove_legacy_actions() {
	remove_action( 'admin_menu', 'siteorigin_custom_css_admin_menu' );
	remove_action( 'wp_head', 'siteorigin_custom_css_display', 15 );
}
add_action( 'after_setup_theme', 'siteorigin_css_legacy_remove_legacy_actions', 100 );
