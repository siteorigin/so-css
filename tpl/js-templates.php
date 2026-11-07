<script type="text/template" id="template-sides-field">
	<div class="spacing-field">

		<ul class="select-tabs side-tabs" data-type="box">
			<li class="select-tab side-tab" data-direction="all"><div class="spacing-all"></div></li>
			<li class="select-tab side-tab" data-direction="top"><div class="spacing-top"></div></li>
			<li class="select-tab side-tab" data-direction="right"><div class="spacing-right"></div></li>
			<li class="select-tab side-tab" data-direction="bottom"><div class="spacing-bottom"></div></li>
			<li class="select-tab side-tab" data-direction="left"><div class="spacing-left"></div></li>
		</ul>

		<ul class="select-tabs side-tabs" data-type="radius">
			<li class="select-tab side-tab" data-direction="all"><div class="spacing-all"></div></li>
			<li class="select-tab side-tab" data-direction="top-right"><div class="spacing-top spacing-right"></div></li>
			<li class="select-tab side-tab" data-direction="bottom-right"><div class="spacing-bottom spacing-right"></div></li>
			<li class="select-tab side-tab" data-direction="bottom-left"><div class="spacing-bottom spacing-left"></div></li>
			<li class="select-tab side-tab" data-direction="top-left"><div class="spacing-top spacing-left"></div></li>
		</ul>

		<ul class="sides">

		</ul>

	</div>
</script>

<script type="text/template" id="template-preview-window">
	<div id="preview-navigator">
		<input type="text" data-invalid-uri="<?php esc_attr_e( "Invalid URI. Please make sure you're using a URL from the same site.", 'so-css' ); ?>" />
	</div>
	<iframe id="preview-iframe" seamless="seamless"></iframe>
</script>

<script type="text/template" id="template-webfont-teaser">
	<input type="text" value="" class="socss-property-controller-input"/>
	<?php if ( $this->display_teaser() ) { ?>
		<small style="color: #888">
			<?php
			printf(
				esc_html__( 'Get a %sGoogle Font%s selector.', 'so-css' ),
				'<a href="https://siteorigin.com/downloads/premium/?featured_addon=plugin/web-font-selector" target="_blank">',
				'</a>'
			);
			?>
		</small>
	<?php } ?>
</script>
