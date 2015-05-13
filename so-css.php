<?php
/*
Plugin Name: SiteOrigin CSS
Description: An advanced CSS editor from SiteOrigin.
Version: dev
Author: SiteOrigin
Author URI: http://siteorigin.com
Plugin URI: http://siteorigin.com/css-editor/
License: GPL3
License URI: https://www.gnu.org/licenses/gpl-3.0.txt
*/

define('SOCSS_VERSION', '1.0');
define('SOCSS_JS_SUFFIX', '');

/**
 * Class SiteOrigin_CSS The main class for the SiteOrigin CSS Editor
 */
class SiteOrigin_CSS {
	private $theme;
	private $snippet_paths;

	static $version = 'dev';

	function __construct(){
		$this->theme = basename( get_template_directory() );
		$this->snippet_paths = array();

		// Main header actions
		add_action( 'wp_head', array($this, 'action_wp_head') );

		// All the admin actions
		add_action( 'admin_menu', array($this, 'action_admin_menu') );
		add_action( 'admin_enqueue_scripts', array($this, 'enqueue_admin_scripts') );
		add_action( 'load-appearance_page_siteorigin_custom_css', array($this, 'add_help_tab') );
		add_action( 'admin_footer', array($this, 'action_admin_footer') );

		if( isset($_GET['so_css_preview']) && !is_admin() ) {
			add_filter( 'show_admin_bar', '__return_false' );
			add_filter( 'wp_enqueue_scripts', array($this, 'enqueue_inspector_scripts') );
			add_filter( 'wp_footer', array($this, 'inspector_hover') );
		}
	}

	/**
	 * Get a singleton of the SiteOrigin CSS.
	 *
	 * @return SiteOrigin_CSS
	 */
	static function single(){
		static $single;

		if( empty($single) ) {
			$single = new SiteOrigin_CSS();
		}

		return $single;
	}

	/**
	 * Display the custom CSS in the header.
	 */
	function action_wp_head(){
		$custom_css = get_option( 'siteorigin_custom_css[' . $this->theme . ']', '' );
		if ( empty( $custom_css ) ) return;

		// We just need to enqueue a dummy style
		echo "<style id='" . sanitize_html_class($this->theme) . "-custom-css' class='siteorigin-custom-css' type='text/css'>\n";
		echo self::sanitize_css( $custom_css ) . "\n";
		echo "</style>\n";
	}

	/**
	 * Action to run on the admin action.
	 */
	function action_admin_menu(){
		add_theme_page( __( 'Custom CSS', 'so-css' ), __( 'Custom CSS', 'so-css' ), 'edit_theme_options', 'siteorigin_custom_css', array( $this, 'display_admin_page' ) );

		if ( current_user_can('edit_theme_options') && isset( $_POST['siteorigin_custom_css_save'] ) ) {
			check_admin_referer( 'custom_css', '_sononce' );
			$theme = basename( get_template_directory() );

			// Sanitize CSS input. Should keep most tags, apart from script and style tags.
			$custom_css = self::sanitize_css( filter_input(INPUT_POST, 'custom_css' ) );

			$current = get_option('siteorigin_custom_css[' . $theme . ']');
			if( $current === false ) {
				add_option( 'siteorigin_custom_css[' . $theme . ']', $custom_css , '', 'no' );
			}
			else {
				update_option( 'siteorigin_custom_css[' . $theme . ']', $custom_css );
			}

			// If this has changed, then add a revision.
			if ( $current != $custom_css ) {
				$revisions = get_option( 'siteorigin_custom_css_revisions[' . $theme . ']' );
				if ( empty( $revisions ) ) {
					add_option( 'siteorigin_custom_css_revisions[' . $theme . ']', array(), '', 'no' );
					$revisions = array();
				}
				$revisions[ time() ] = $custom_css;

				// Sort the revisions and cut off any old ones.
				krsort($revisions);
				$revisions = array_slice($revisions, 0, 15, true);

				update_option( 'siteorigin_custom_css_revisions[' . $theme . ']', $revisions );
			}
		}
	}

	/**
	 * Display the help tab
	 */
	function add_help_tab(){
		$screen = get_current_screen();
		$screen->add_help_tab( array(
			'id' => 'custom-css',
			'title' => __( 'Custom CSS', 'so-css' ),
			'content' => '<p>'
	             . sprintf( __( "SiteOrigin CSS adds any custom CSS you enter here into your site's header. ", 'so-css' ) )
	             . __( "These changes will persist across updates so it's best to make all your changes here. ", 'so-css' )
	             . '</p>'
		) );
	}

	function enqueue_admin_scripts( $page ){
		if( $page != 'appearance_page_siteorigin_custom_css' ) return;

		// Enqueue the codemirror scripts. Call Underscore and Backbone dependencies so they're enqueued first to prevent conflicts.
		wp_enqueue_script( 'codemirror', plugin_dir_url(__FILE__) . 'codemirror/lib/codemirror' . SOCSS_JS_SUFFIX . '.js', array( 'underscore', 'backbone' ), '5.2.0' );
		wp_enqueue_script( 'codemirror-mode-css', plugin_dir_url(__FILE__) . 'codemirror/mode/css/css' . SOCSS_JS_SUFFIX . '.js', array(), '5.2.0' );

		// Add in all the linting libs
		wp_enqueue_script( 'codemirror-lint', plugin_dir_url(__FILE__) . 'codemirror/addon/lint/lint' . SOCSS_JS_SUFFIX . '.js', array( 'codemirror' ), '5.2.0' );
		wp_enqueue_script( 'codemirror-lint-css', plugin_dir_url(__FILE__) . 'codemirror/addon/lint/css-lint' . SOCSS_JS_SUFFIX . '.js', array( 'codemirror', 'codemirror-lint-css-lib' ), '5.2.0' );
		wp_enqueue_script( 'codemirror-lint-css-lib', plugin_dir_url(__FILE__) . 'js/csslint' . SOCSS_JS_SUFFIX . '.js', array(), '0.10.0' );

		// All the Codemirror styles
		wp_enqueue_style( 'codemirror', plugin_dir_url(__FILE__) . 'codemirror/lib/codemirror.css', array(), '5.2.0' );
		wp_enqueue_style( 'codemirror-theme-neat', plugin_dir_url(__FILE__) . 'codemirror/theme/neat.css', array(), '5.2.0' );
		wp_enqueue_style( 'codemirror-lint-css', plugin_dir_url(__FILE__) . 'codemirror/addon/lint/lint.css', array(), '5.2.0' );

		// Enqueue the scripts for theme CSS processing
		wp_enqueue_script( 'siteorigin-custom-css-parser', plugin_dir_url(__FILE__) . 'js/css-parser' . SOCSS_JS_SUFFIX . '.js', array( ), SOCSS_VERSION );

		// All the custom SiteOrigin CSS stuff
		wp_enqueue_script( 'siteorigin-custom-css', plugin_dir_url(__FILE__) . 'js/editor' . SOCSS_JS_SUFFIX . '.js', array( 'jquery', 'underscore', 'backbone', 'siteorigin-custom-css-parser', 'codemirror' ), SOCSS_VERSION, true );
		wp_enqueue_style( 'siteorigin-custom-css', plugin_dir_url(__FILE__) . 'css/admin.css', array( ), SOCSS_VERSION );

		wp_localize_script( 'siteorigin-custom-css', 'socssOptions', array(
			'themeCSS' => SiteOrigin_CSS::single()->get_theme_css(),
			'homeURL' => add_query_arg( 'so_css_preview', '1', site_url() ),
			'snippets' => $this->get_snippets(),
		) );

		// This is for the templates required by the CSS editor
		add_action( 'admin_footer', array($this, 'action_admin_footer') );
	}

	/**
	 * Display the templates for the CSS Editor
	 */
	function action_admin_footer(){
		include plugin_dir_path( __FILE__ ) . 'tpl/js-templates.php';
	}

	function display_admin_page(){
		$theme = basename( get_template_directory() );

		$custom_css = get_option( 'siteorigin_custom_css[' . $theme . ']', '' );
		$custom_css_revisions = get_option('siteorigin_custom_css_revisions[' . $theme . ']');

		if(!empty($_GET['theme']) && $_GET['theme'] == $theme && !empty($_GET['time']) && !empty($custom_css_revisions[$_GET['time']])) {
			$custom_css = $custom_css_revisions[$_GET['time']];
			$revision = true;
		}

		include plugin_dir_path(__FILE__).'/tpl/page.php';
	}

	/**
	 *  Add one or more paths to the registered snippet paths
	 *
	 * @param string|array $path
	 */
	function register_snippet_path( $path ){
		$this->snippet_paths = array_merge( $this->snippet_paths, (array) $path );
	}

	/**
	 * Get all the available snippets
	 *
	 * @return array|bool
	 */
	function get_snippets(){
		// Get the snippet paths
		$snippet_paths = apply_filters( 'siteorigin_css_snippet_paths', $this->snippet_paths );
		if( empty($snippet_paths) ) return array();

		static $snippets = array();
		if( !empty($snippets) ) return $snippets;

		if( !WP_Filesystem() ) return false;
		global $wp_filesystem;
		foreach( $snippet_paths as $path ) {
			foreach( glob($path . '/*.css') as $css_file ) {
				$data = get_file_data( $css_file, array(
					'Name' => 'Name',
					'Description' => 'Description',
				) );

				// Get the CSS and strip out the first header
				$css = $wp_filesystem->get_contents( $css_file );
				$css = preg_replace('!/\*.*?\*/!s', '', $css, 1);

				$snippets[] = wp_parse_args( $data, array(
					'css' => str_replace( "\t", '  ', trim($css) ),
				) );
			}
		}

		usort($snippets, array( $this, 'sort_snippet_callback' ) );
		return $snippets;
	}

	/**
	 * Sort snippets by name.
	 *
	 * @param $a
	 * @param $b
	 *
	 * @return int
	 */
	static function sort_snippet_callback( $a, $b ){
		return $a['Name'] > $b['Name'] ? 1 : -1;
	}

	/**
	 * A very simple CSS sanitization function.
	 *
	 * @param $css
	 *
	 * @return string
	 */
	static function sanitize_css( $css ){
		return trim( strip_tags( $css ) );
	}

	/**
	 * Get all the available theme CSS
	 */
	function get_theme_css(){
		$css = '';
		if( file_exists( get_template_directory() . '/style.css' ) ) {
			$css .= file_get_contents( get_template_directory() . '/style.css' );
		}

		if( is_child_theme() ) {
			$css .= file_get_contents( get_stylesheet_directory() . '/style.css' );
		}

		// Remove all CSS comments
		$regex = array(
			"`^([\t\s]+)`ism"=>'',
			"`^\/\*(.+?)\*\/`ism"=>"",
			"`([\n\A;]+)\/\*(.+?)\*\/`ism"=>"$1",
			"`([\n\A;\s]+)//(.+?)[\n\r]`ism"=>"$1\n",
			"`(^[\r\n]*|[\r\n]+)[\s\t]*[\r\n]+`ism"=>"\n"
		);
		$css = preg_replace( array_keys($regex), $regex, $css );
		$css = preg_replace('/\s+/', ' ', $css);

		return $css;
	}

	/**
	 * Get the editor description
	 *
	 * @return string
	 */
	static function editor_description(){
		$theme = wp_get_theme();
		return sprintf( __( 'Changes apply to %s and its child themes', 'so-css' ), $theme->get('Name') );
	}

	function enqueue_inspector_scripts(){
		wp_enqueue_script('siteorigin-css-sizes', plugin_dir_url(__FILE__) . 'js/jquery.sizes' . SOCSS_JS_SUFFIX . '.js', array( 'jquery' ), '0.33' );
		wp_enqueue_script('siteorigin-css-specificity', plugin_dir_url(__FILE__) . 'js/specificity' . SOCSS_JS_SUFFIX . '.js', array( ) );
		wp_enqueue_script('siteorigin-css-inspector', plugin_dir_url(__FILE__) . 'js/inspector' . SOCSS_JS_SUFFIX . '.js', array( 'jquery', 'underscore' ), SOCSS_VERSION );
		wp_enqueue_style('siteorigin-css-inspector', plugin_dir_url(__FILE__) . 'css/inspector.css', array( ), SOCSS_VERSION );
	}

	function inspector_hover(){
		?>
		<div id="socss-inspector-hover" class="socss-inspector-hover socss-element">
			<div class="socss-padding-indicator"></div>
		</div>

		<div id="socss-selector-dialog" class="socss-selector-dialog socss-element">
			<div class="socss-selector-overlay"></div>
			<div class="socss-selector-window">
				<div class="socss-selector-title"><?php _e('Select', 'so-css') ?></div>

				<ul class="socss-element-parents">

				</ul>

				<ul class="socss-selectors">

				</ul>

				<div class="socss-buttons">
					<div class="socss-button-close"><?php _e('Close', 'so-css') ?></div>
				</div>
			</div>
		</div>
		<?php
	}
}

// Initialize the single
SiteOrigin_CSS::single();