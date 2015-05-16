<?php

return array (
	'text' => array(
		'title' => __('Text', 'so-css'),
		'icon' => 'media-text',
		'controllers' => array(
			array(
				'title' => __('Text Color', 'so-css'),
				'type' => 'color',
				'args' => array(
					'property' => 'color'
				)
			)
		)
	),

	//////////////////////////////////////////////////////////////////////

	'decoration' => array(
		'title' => __('Decoration', 'so-css'),
		'icon' => 'admin-appearance',
		'controllers' => array(
			array(
				'title' => __('Background Color', 'so-css'),
				'type' => 'color',
				'args' => array(
					'property' => 'background-color'
				)
			)
		)
	),

	//////////////////////////////////////////////////////////////////////

	'layout' => array(
		'title' => __('Layout', 'so-css'),
		'icon' => 'align-left',
	),

);