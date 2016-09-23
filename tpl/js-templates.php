<script type="text/template" id="template-snippet-browser">
	<div class="snippet-browser-overlay">

	</div>

	<div class="snippet-browser-dialog">
		<div class="toolbar">
			<h1><?php _e('CSS Snippets', 'so-css') ?></h1>
			<span href="#" class="close">
				<span class="icon"></span>
			</span>
		</div>
		<div class="sidebar">
			<input type="text" class="snippet-search" placeholder="<?php esc_attr_e('Search Snippets', 'so-css') ?>" />
			<ul class="snippets">
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
			<input type="button" class="insert-snippet button-primary" value="<?php esc_attr_e('Insert Snippet', 'so-css') ?>" />
		</div>
	</div>
</script>

<script type="text/template" id="template-sides-field">
	<div class="spacing-field">

		<ul class="select-tabs side-tabs">
			<li class="select-tab side-tab" data-direction="all"><div class="spacing-all"></div></li>
			<li class="select-tab side-tab" data-direction="top"><div class="spacing-top"></div></li>
			<li class="select-tab side-tab" data-direction="right"><div class="spacing-right"></div></li>
			<li class="select-tab side-tab" data-direction="bottom"><div class="spacing-bottom"></div></li>
			<li class="select-tab side-tab" data-direction="left"><div class="spacing-left"></div></li>
		</ul>

		<ul class="sides">

		</ul>

	</div>
</script>

<script type="text/template" id="template-preview-window">
	<div id="preview-navigator">
		<input type="text" data-invalid-uri="<?php esc_attr_e( "Invalid URI. Please make sure you're using a URL from the same site.", 'so-css' ) ?>" />
	</div>
	<iframe id="preview-iframe" seamless="seamless"></iframe>
</script>