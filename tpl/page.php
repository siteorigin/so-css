<?php $snippets = SiteOrigin_CSS::single()->get_snippets(); ?>

<div class="wrap">
	<h2><?php _e( 'Custom CSS', 'so-css' ) ?></h2>

	<?php if(isset($_POST['siteorigin_custom_css_save'])) : ?>
		<div class="updated settings-error">
			<p><?php _e('Custom CSS Updated', 'so-css') ?></p>
		</div>
	<?php endif; ?>

	<?php if(!empty($revision)) : ?>
		<div class="updated settings-error">
			<p><?php _e('Viewing a revision. Save CSS to use this revision.', 'so-css') ?></p>
		</div>
	<?php endif; ?>


	<div id="poststuff">
		<div id="so-custom-css-info">

			<div class="postbox" id="so-custom-css-revisions">
				<h3 class="hndle"><span><?php _e('CSS Revisions', 'so-css') ?></span></h3>
				<div class="inside">
					<ol data-confirm="<?php esc_attr_e('Are you sure you want to load this revision?', 'so-css') ?>">
						<?php
						if( is_array($custom_css_revisions) ) {
							foreach($custom_css_revisions as $time => $css) {
								?>
								<li>
									<a href="<?php echo add_query_arg(array('theme' => $theme, 'time' => $time)) ?>" class="load-css-revision"><?php echo date('j F Y @ H:i:s', $time) ?></a>
									(<?php printf(__('%d chars', 'so-css'), strlen($css)) ?>)
								</li>
								<?php
							}
						}
						?>
					</ol>
				</div>
			</div>

		</div>

		<form action="<?php echo esc_url( add_query_arg( array( 'theme' => false, 'time' => false ) ) ) ?>" method="POST" id="so-custom-css-form">

			<div id="custom-css-toolbar">
				<?php if( !empty($snippets) ) : ?>
					<a href="#" class="toolbar-button" id="css-insert-snippet"><?php _e('Snippets', 'so-css') ?></a>
				<?php endif; ?>

				<a href="#" id="css-editor-expand" class="toolbar-button">
					<span class="dashicons dashicons-editor-expand"></span>
					<span class="dashicons dashicons-no-alt"></span>
				</a>
			</div>

			<div id="custom-css-container">
				<textarea name="custom_css" id="custom-css-textarea" rows="<?php echo max( 10, substr_count( $custom_css, "\n" )+1 ) ?>"><?php echo esc_textarea( $custom_css ) ?></textarea>
				<?php wp_nonce_field( 'custom_css', '_sononce' ) ?>
			</div>
			<p class="description">
				<?php
				$theme = wp_get_theme();
				printf( __( 'Changes apply to %s and its child themes', 'so-css' ), $theme->get('Name') );
				?>
			</p>

			<p class="submit">
				<input type="submit" name="siteorigin_custom_css_save" class="button-primary" value="<?php esc_attr_e( 'Save CSS', 'so-css' ); ?>" />
			</p>

			<div id="custom-css-preview">
				<iframe data-home="<?php echo esc_url( add_query_arg( 'so_css_preview', '1', site_url() ) ) ?>"></iframe>
			</div>

			<div class="decoration"></div>

		</form>

	</div>

	<div class="clear"></div>

	<div id="snippet-browser" style="display: none">
		<div id="snippet-browser-overlay">

		</div>

		<div id="snippet-browser-dialog">
			<div class="toolbar">
				<h1><?php _e('CSS Snippets', 'so-css') ?></h1>
				<a href="#" class="close">
					<span class="icon"></span>
				</a>
			</div>
			<div class="sidebar">
				<input type="text" id="snippet-search" placeholder="<?php esc_attr_e('Search Snippets', 'so-css') ?>" />
				<ul class="snippets">
					<?php foreach( $snippets as $snippet ) : ?>
						<li class="snippet" data-description="<?php echo esc_attr($snippet['Description']) ?>" data-code="<?php echo esc_attr($snippet['css']) ?>"><?php echo esc_html($snippet['Name']) ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
			<div class="main">
				<div class="snippet-view">
					<h2 class="snippet-title"></h2>
					<p class="snippet-description"></p>
					<pre class="snippet-code"></pre>
				</div>
			</div>
			<div class="buttons">
				<input id="so-insert-snippet" type="button" class="button-primary" value="<?php esc_attr_e('Insert Snippet', 'so-css') ?>" />
			</div>
		</div>
	</div>

	<script type="template/css" id="current-theme-css">
		<?php echo SiteOrigin_CSS::single()->get_theme_css(); ?>
	</script>

</div>