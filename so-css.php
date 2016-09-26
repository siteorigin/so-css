<?php
/*
Plugin Name: SiteOrigin CSS
Description: An advanced CSS editor from SiteOrigin.
Version: dev
Author: SiteOrigin
Author URI: https://siteorigin.com
Plugin URI: https://siteorigin.com/css/
License: GPL3
License URI: https://www.gnu.org/licenses/gpl-3.0.txt
Text Domain: so-css
*/

// Handle the legacy CSS editor that came with SiteOrigin themes
include plugin_dir_path(__FILE__) . '/inc/legacy.php';

define('SOCSS_VERSION', 'dev');
define('SOCSS_JS_SUFFIX', '');

/**
 * Class SiteOrigin_CSS The main class for the SiteOrigin CSS Editor
 */
class SiteOrigin_CSS {
	private $theme;
	private $snippet_paths;

	function __construct(){
		$this->theme = basename( get_template_directory() );
		$this->snippet_paths = array();

		// Main header actions
		add_action( 'plugins_loaded', array($this, 'set_plugin_textdomain') );
		add_action( 'wp_head', array($this, 'action_wp_head'), 20 );

		// All the admin actions
		add_action( 'admin_menu', array($this, 'action_admin_menu') );
		add_action( 'admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'), 20 );
		add_action( 'admin_enqueue_scripts', array($this, 'dequeue_admin_scripts'), 19 );
		add_action( 'load-appearance_page_so_custom_css', array($this, 'add_help_tab') );
		add_action( 'admin_footer', array($this, 'action_admin_footer') );

		// Add the action links.
		add_action( 'plugin_action_links_' . plugin_basename(__FILE__), array($this, 'plugin_action_links') );

		// The request to hide the getting started video
		add_action( 'wp_ajax_socss_hide_getting_started', array( $this, 'admin_action_hide_getting_started' ) );

		if( isset($_GET['so_css_preview']) && !is_admin() ) {

			add_action( 'plugins_loaded', array($this, 'disable_ngg_resource_manager') );
			add_filter( 'show_admin_bar', '__return_false' );
			add_filter( 'wp_enqueue_scripts', array($this, 'enqueue_inspector_scripts') );
			add_filter( 'wp_footer', array($this, 'inspector_templates') );

			// We'll be grabbing all the enqueued scripts and outputting them
			add_action( 'wp_enqueue_scripts', array($this, 'inline_inspector_scripts'), 100 );
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

	function set_plugin_textdomain(){
		load_plugin_textdomain('so-css', false, plugin_dir_path( __FILE__ ). '/languages/');
	}

	/**
	 * Action to run on the admin action.
	 */
	function action_admin_menu(){
		add_theme_page( __( 'Custom CSS', 'so-css' ), __( 'Custom CSS', 'so-css' ), 'edit_theme_options', 'so_custom_css', array( $this, 'display_admin_page' ) );

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
		if( $page != 'appearance_page_so_custom_css' ) return;

		// Core WordPress stuff that we use
		wp_enqueue_media();

		// Enqueue the codemirror scripts. Call Underscore and Backbone dependencies so they're enqueued first to prevent conflicts.
		wp_enqueue_script( 'codemirror', plugin_dir_url(__FILE__) . 'lib/codemirror/lib/codemirror' . SOCSS_JS_SUFFIX . '.js', array( 'underscore', 'backbone' ), '5.2.0' );
		wp_enqueue_script( 'codemirror-mode-css', plugin_dir_url(__FILE__) . 'lib/codemirror/mode/css/css' . SOCSS_JS_SUFFIX . '.js', array(), '5.2.0' );

		if( !wp_script_is( 'wp-color-picker' ) ) {
			// Add in all the linting libs
			wp_enqueue_script( 'codemirror-lint', plugin_dir_url(__FILE__) . 'lib/codemirror/addon/lint/lint' . SOCSS_JS_SUFFIX . '.js', array( 'codemirror' ), '5.2.0' );
			wp_enqueue_script( 'codemirror-lint-css', plugin_dir_url(__FILE__) . 'lib/codemirror/addon/lint/css-lint' . SOCSS_JS_SUFFIX . '.js', array( 'codemirror', 'codemirror-lint-css-lib' ), '5.2.0' );
			wp_enqueue_script( 'codemirror-lint-css-lib', plugin_dir_url(__FILE__) . 'js/csslint' . SOCSS_JS_SUFFIX . '.js', array(), '0.10.0' );
		}

		// The CodeMirror autocomplete library
		wp_enqueue_script( 'codemirror-show-hint', plugin_dir_url(__FILE__) . 'lib/codemirror/addon/hint/show-hint' . SOCSS_JS_SUFFIX . '.js', array( 'codemirror' ), '5.2.0' );

		// All the CodeMirror styles
		wp_enqueue_style( 'codemirror', plugin_dir_url(__FILE__) . 'lib/codemirror/lib/codemirror.css', array(), '5.2.0' );
		wp_enqueue_style( 'codemirror-theme-neat', plugin_dir_url(__FILE__) . 'lib/codemirror/theme/neat.css', array(), '5.2.0' );
		wp_enqueue_style( 'codemirror-lint-css', plugin_dir_url(__FILE__) . 'lib/codemirror/addon/lint/lint.css', array(), '5.2.0' );
		wp_enqueue_style( 'codemirror-show-hint', plugin_dir_url(__FILE__) . 'lib/codemirror/addon/hint/show-hint.css', array( ), '5.2.0' );

		// Enqueue the scripts for theme CSS processing
		wp_enqueue_script( 'siteorigin-css-parser-lib', plugin_dir_url(__FILE__) . 'js/css' . SOCSS_JS_SUFFIX . '.js', array( 'jquery' ), SOCSS_VERSION );

		// There are conflicts between CSS linting and the built in WordPress color picker, so use something else
		wp_enqueue_style('siteorigin-custom-css-minicolors', plugin_dir_url(__FILE__) . 'lib/minicolors/jquery.minicolors.css', array(), '2.1.7' );
		wp_enqueue_script('siteorigin-custom-css-minicolors', plugin_dir_url(__FILE__) . 'lib/minicolors/jquery.minicolors' . SOCSS_JS_SUFFIX . '.js', array('jquery'), '2.1.7' );

		// We need Font Awesome
		wp_enqueue_style( 'siteorigin-custom-css-font-awesome', plugin_dir_url(__FILE__) . 'lib/fontawesome/css/font-awesome.min.css', array( ), SOCSS_VERSION );

		// URI parsing for preview navigation
		wp_enqueue_script( 'siteorigin-uri', plugin_dir_url(__FILE__) . 'js/URI' . SOCSS_JS_SUFFIX . '.js', array( ), SOCSS_VERSION, true );

		// All the custom SiteOrigin CSS stuff
		wp_enqueue_script( 'siteorigin-custom-css', plugin_dir_url(__FILE__) . 'js/editor' . SOCSS_JS_SUFFIX . '.js', array( 'jquery', 'underscore', 'backbone', 'siteorigin-css-parser-lib', 'codemirror' ), SOCSS_VERSION, true );
		wp_enqueue_style( 'siteorigin-custom-css', plugin_dir_url(__FILE__) . 'css/admin.css', array( ), SOCSS_VERSION );

		wp_localize_script( 'siteorigin-custom-css', 'socssOptions', array(
			'themeCSS' => SiteOrigin_CSS::single()->get_theme_css(),
			'homeURL' => add_query_arg( 'so_css_preview', '1', site_url() ),
			'snippets' => $this->get_snippets(),

			'propertyControllers' => apply_filters( 'siteorigin_css_property_controllers', $this->get_property_controllers() ),

			'loc' => array(
				'unchanged' => __('Unchanged', 'so-css'),
				'select' => __('Select', 'so-css'),
				'select_image' => __('Select Image', 'so-css'),
				'leave' => __('Are you sure you want to leave without saving?', 'so-css'),
			)
		) );

		// This is for the templates required by the CSS editor
		add_action( 'admin_footer', array($this, 'action_admin_footer') );
	}

	/**
	 * @param $page
	 */
	function dequeue_admin_scripts( $page ) {
		if( $page != 'appearance_page_so_custom_css' ) return;

		// Dequeue the core WordPress color picker on the custom CSS page.
		// This script causes conflicts and other plugins seem to be enqueueing it on the SO CSS admin page.
		wp_dequeue_script('wp-color-picker');
		wp_dequeue_style('wp-color-picker');
	}

	/**
	 * Get all the available property controllers
	 */
	function get_property_controllers() {
		return include plugin_dir_path(__FILE__) . 'inc/controller-config.php';
	}

	/**
	 * Display the templates for the CSS Editor
	 */
	function action_admin_footer(){
		include plugin_dir_path( __FILE__ ) . 'tpl/js-templates.php';
	}

	function plugin_action_links( $links ){
		if( isset($links['edit']) ) unset( $links['edit'] );
		$links['css_editor'] = '<a href="' . admin_url('themes.php?page=so_custom_css') . '">'.__('CSS Editor', 'so-css').'</a>';
		$links['support'] = '<a href="https://siteorigin.com/thread/" target="_blank">'.__('Support', 'so-css').'</a>';
		return $links;
	}

	function display_admin_page(){
		$theme = basename( get_template_directory() );

		$custom_css = get_option( 'siteorigin_custom_css[' . $theme . ']', '' );
		$custom_css_revisions = get_option('siteorigin_custom_css_revisions[' . $theme . ']');

		if( !empty( $_GET['theme'] ) && $_GET['theme'] == $theme && !empty( $_GET['time'] ) && !empty( $custom_css_revisions[$_GET['time']] ) ) {
			$custom_css = $custom_css_revisions[$_GET['time']];
			$revision = true;
		}

		include plugin_dir_path(__FILE__).'/tpl/page.php';
	}


	function display_teaser(){
		return apply_filters( 'siteorigin_premium_upgrade_teaser', true ) &&
		! defined( 'SITEORIGIN_PREMIUM_VERSION' );
	}

	/**
	 *
	 */
	function admin_action_hide_getting_started(){
		if( !isset($_GET['_wpnonce']) || !wp_verify_nonce( $_GET['_wpnonce'], 'hide' ) ) return;

		$user = wp_get_current_user();
		if( !empty( $user ) ) {
			update_user_meta( $user->ID, 'socss_hide_gs', true );
		}
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
		if( !current_user_can('edit_theme_options') ) return;

		wp_enqueue_style( 'dashicons' );

		wp_enqueue_script( 'siteorigin-css-parser-lib', plugin_dir_url(__FILE__) . 'js/css' . SOCSS_JS_SUFFIX . '.js', array( 'jquery' ), SOCSS_VERSION );

		wp_enqueue_script('siteorigin-css-sizes', plugin_dir_url(__FILE__) . 'js/jquery.sizes' . SOCSS_JS_SUFFIX . '.js', array( 'jquery' ), '0.33' );
		wp_enqueue_script('siteorigin-css-specificity', plugin_dir_url(__FILE__) . 'js/specificity' . SOCSS_JS_SUFFIX . '.js', array( ) );
		wp_enqueue_script('siteorigin-css-inspector', plugin_dir_url(__FILE__) . 'js/inspector' . SOCSS_JS_SUFFIX . '.js', array( 'jquery', 'underscore', 'backbone' ), SOCSS_VERSION, true );
		wp_enqueue_style('siteorigin-css-inspector', plugin_dir_url(__FILE__) . 'css/inspector.css', array( ), SOCSS_VERSION );

		wp_localize_script('siteorigin-css-inspector', 'socssOptions', array(

		) );
	}

	function inspector_templates(){
		if( !current_user_can('edit_theme_options') ) return;

		include plugin_dir_path( __FILE__ ) . 'tpl/inspector-templates.php';
	}

	/**
	 * Change the stylesheets to all be inline
	 */
	function inline_inspector_scripts(){
		if( !current_user_can('edit_theme_options') ) return;

		$regex = array(
			"`^([\t\s]+)`ism"=>'',
			"`^\/\*(.+?)\*\/`ism"=>"",
			"`([\n\A;]+)\/\*(.+?)\*\/`ism"=>"$1",
			"`([\n\A;\s]+)//(.+?)[\n\r]`ism"=>"$1\n",
			"`(^[\r\n]*|[\r\n]+)[\s\t]*[\r\n]+`ism"=>"\n"
		);

		global $wp_styles;
		if( empty($wp_styles->queue) ) return;

		// Make each of the scripts inline
		foreach( $wp_styles->queue as $handle ) {
			if( $handle === 'siteorigin-css-inspector' || $handle === 'dashicons' ) continue;
			$style = $wp_styles->registered[$handle];
			if( empty($style->src) || substr($style->src, 0, 4) !== 'http' ) continue;
			$response = wp_remote_get( $style->src );
			if( is_wp_error($response) || $response['response']['code'] !== 200 || empty($response['body']) ) continue;

			$css = $response['body'];
			$css = preg_replace( array_keys($regex), $regex, $css );

			?>
			<script type="text/css" class="socss-theme-styles" id="socss-inlined-style-<?php echo sanitize_html_class( $handle ) ?>">
				<?php echo strip_tags( $css ) ?>
			</script>
			<?php
		}
	}

	function disable_ngg_resource_manager() {
		if( !current_user_can('edit_theme_options') ) return;

		//The NextGen Gallery plugin does some weird interfering with the output buffer.
		define('NGG_DISABLE_RESOURCE_MANAGER', true);
	}
}

// Initialize the single
SiteOrigin_CSS::single();
