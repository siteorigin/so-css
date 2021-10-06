<?php

return array (
	'text' => array(
		'title' => esc_html( 'Text', 'so-css' ),
		'icon' => 'align-left',
		'controllers' => array(
			array(
				'title' => esc_html( 'Text Color', 'so-css' ),
				'type' => 'color',
				'args' => array(
					'property' => 'color'
				)
			),
			array(
				'title' => esc_html( 'Font Size', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'font-size',
					'defaultUnit' => 'px',
				)
			),
			array(
				'title' => esc_html( 'Line Height', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'line-height',
					'defaultUnit' => 'em',
				)
			),
			array(
				'title' => esc_html( 'Font Weight', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'font-weight',
					'options' => array(
						'normal' => esc_html( 'Normal', 'so-css' ),
						'bold' => esc_html( 'Bold', 'so-css' ),
						'bolder' => esc_html( 'Bolder', 'so-css' ),
						'lighter' => esc_html( 'Lighter', 'so-css' ),
						'100' => '100',
						'200' => '200',
						'300' => '300',
						'400' => '400',
						'500' => '500',
						'600' => '600',
						'700' => '700',
						'800' => '800',
						'900' => '900',
					)
				)
			),
			array(
				'title' => esc_html( 'Font Style', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'font-style',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'normal' => esc_html( 'Normal', 'so-css' ),
						'italic' => esc_html( 'Italic', 'so-css' ),
					),
					'option_icons' => array(
						'normal' => 'font',
						'italic' => 'italic',
					)
				)
			),
			array(
				'title' => esc_html( 'Text Decoration', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'text-decoration',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'underline' => esc_html( 'Underline', 'so-css' ),
						'overline' => esc_html( 'Overline', 'so-css' ),
						'line-through' => esc_html( 'Line Through', 'so-css' ),
					),
					'option_icons' => array(
						'none' => 'font',
						'underline' => 'underline',
						'line-through' => 'strikethrough',
					)
				)
			),
			array(
				'title' => esc_html( 'Font Variant', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'font-variant',
					'options' => array(
						'normal' => esc_html( 'Normal', 'so-css' ),
						'small-caps' => esc_html( 'Small Caps', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Text Transform', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'text-transform',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'capitalize' => esc_html( 'Capitalize', 'so-css' ),
						'uppercase' => esc_html( 'Uppercase', 'so-css' ),
						'lowercase' => esc_html( 'Lowercase', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Font Family', 'so-css' ),
				'type' => 'font_select',
				'args' => array(
					'property' => 'font-family',
				)
			),
			array(
				'title' => esc_html( 'Text Align', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'text-align',
					'options' => array(
						'left' => esc_html( 'Left', 'so-css' ),
						'right' => esc_html( 'Right', 'so-css' ),
						'center' => esc_html( 'Center', 'so-css' ),
						'justify' => esc_html( 'Justify', 'so-css' ),
					),
					'option_icons' => array(
						'left' => 'align-left',
						'right' => 'align-right',
						'center' => 'align-center',
						'justify' => 'align-justify',
					)
				)
			),
			array(
				'title' => esc_html( 'Text Indent', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'text-indent'
				)
			),
			array(
				'title' => esc_html( 'Letter Spacing', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'letter-spacing'
				)
			),
			array(
				'title' => esc_html( 'Word Spacing', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'word-spacing'
				)
			),
			array(
				'title' => esc_html( 'White Space', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'white-space',
					'options' => array(
						'normal' => esc_html( 'Normal', 'so-css' ),
						'encountered' => esc_html( 'Encountered', 'so-css' ),
						'pre' => esc_html( 'Pre', 'so-css' ),
						'pre-line' => esc_html( 'Pre Line', 'so-css' ),
						'pre-wrap' => esc_html( 'Pre Wrap', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Text Shadow', 'so-css' ),
				'type' => 'shadow',
				'args' => array(
					'property' => 'text-shadow',
				)
			),
		)
	),

	//////////////////////////////////////////////////////////////////////

	'decoration' => array(
		'title' => esc_html( 'Decoration', 'so-css' ),
		'icon' => 'eyedropper',
		'controllers' => array(
			array(
				'title' => esc_html( 'Background Color', 'so-css' ),
				'type' => 'color',
				'args' => array(
					'property' => 'background-color'
				)
			),
			array(
				'title' => esc_html( 'Background Image', 'so-css' ),
				'type' => 'image',
				'args' => array(
					'property' => 'background-image',
					'value' => 'url("{{url}}")',
				)
			),
			array(
				'title' => esc_html( 'Background Position', 'so-css' ),
				'type' => 'position',
				'args' => array(
					'property' => 'background-position'
				)
			),
			array(
				'title' => esc_html( 'Background Repeat', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'background-repeat',
					'options' => array(
						'repeat' => esc_html( 'repeat', 'so-css' ),
						'repeat-x' => esc_html( 'repeat-x', 'so-css' ),
						'repeat-y' => esc_html( 'repeat-y', 'so-css' ),
						'no-repeat' => esc_html( 'no-repeat', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Background Size', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'background-size',
					'options' => array(
						'auto' => esc_html( 'auto', 'so-css' ),
						'length' => esc_html( 'length', 'so-css' ),
						'percentage' => esc_html( 'percentage', 'so-css' ),
						'cover' => esc_html( 'cover', 'so-css' ),
						'contain' => esc_html( 'contain', 'so-css' ),
					)
				)
			),

			array(
				'title' => esc_html( 'Box Shadow', 'so-css' ),
				'type' => 'shadow',
				'args' => array(
					'property' => 'box-shadow',
				)
			),

			array(
				'title' => esc_html( 'Opacity', 'so-css' ),
				'type' => 'number',
				'args' => array(
					'property' => 'opacity',
					'default' => 1,
					'min' => 0,
					'max' => 1,
					'increment' => 0.05,
					'decrement' => -0.05,
				)
			),

			array(
				'title' => esc_html( 'Borders', 'so-css' ),
				'type' => 'sides',
				'args' => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property' => 'border-{dir}-width',
								'propertyAll' => 'border-width',
								'defaultUnit' => 'px'
							)
						),
						array(
							'type' => 'select',
							'args' => array(
								'property' => 'border-{dir}-style',
								'propertyAll' => 'border-style',
								'options' => array(
									'hidden' => 'Hidden',
									'dotted' => 'Dotted',
									'dashed' => 'Dashed',
									'solid' => 'Solid',
									'double' => 'Double',
									'groove' => 'Groove',
									'ridge' => 'Ridge',
									'inset' => 'Inset',
									'outset' => 'Outset',
								)
							)
						),
						array(
							'type' => 'color',
							'args' => array(
								'property' => 'border-{dir}-color',
								'propertyAll' => 'border-color',
							)
						),
					),
					'hasAll' => true
				)
			),

			array(
				'title' => esc_html( 'Border Radius', 'so-css' ),
				'type' => 'sides',
				'args' => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property' => 'border-{dir}-radius',
								'propertyAll' => 'border-radius',
								'defaultUnit' => 'px'
							)
						),
					),
					'isRadius' => true,
					'hasAll' => true,
				)
			),
		)
	),

	//////////////////////////////////////////////////////////////////////

	'layout' => array(
		'title' => esc_html( 'Layout', 'so-css' ),
		'icon' => 'columns',
		'controllers' => array(
			array(
				'title' => esc_html( 'Margin', 'so-css' ),
				'type' => 'sides',
				'args' => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property' => 'margin-{dir}',
								'propertyAll' => 'margin',
								'defaultUnit' => 'px'
							)
						)
					),
					'hasAll' => true
				)
			),
			array(
				'title' => esc_html( 'Padding', 'so-css' ),
				'type' => 'sides',
				'args' => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property' => 'padding-{dir}',
								'propertyAll' => 'padding',
								'defaultUnit' => 'px'
							)
						)
					),
					'hasAll' => true
				)
			),
			array(
				'title' => esc_html( 'Position', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'position',
					'options' => array(
						'absolute' => esc_html( 'Absolute', 'so-css' ),
						'fixed' => esc_html( 'Fixed', 'so-css' ),
						'relative' => esc_html( 'Relative', 'so-css' ),
						'static' => esc_html( 'Static', 'so-css' ),
						'inherit' => esc_html( 'Inherit', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Absolute Position', 'so-css' ),
				'type' => 'sides',
				'args' => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property' => '{dir}',
								'defaultUnit' => 'px'
							)
						)
					),
					'hasAll' => false
				)
			),
			array(
				'title' => esc_html( 'Width', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'width',
					'defaultUnit' => 'px',
				)
			),
			array(
				'title' => esc_html( 'Height', 'so-css' ),
				'type' => 'measurement',
				'args' => array(
					'property' => 'height',
					'defaultUnit' => '%',
				)
			),
			array(
				'title' => esc_html( 'Display', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'display',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'inline' => esc_html( 'Inline', 'so-css' ),
						'block' => esc_html( 'Block', 'so-css' ),
						'flex' => esc_html( 'Flex', 'so-css' ),
						'inline-block' => esc_html( 'Inline Block', 'so-css' ),
						'inline-flex' => esc_html( 'Inline Flex', 'so-css' ),
						'inline-table' => esc_html( 'Inline Table', 'so-css' ),
						'list-item' => esc_html( 'List Item', 'so-css' ),
						'run-in' => esc_html( 'Run In', 'so-css' ),
						'table' => esc_html( 'Table', 'so-css' ),
						'table-caption' => esc_html( 'Table Caption', 'so-css' ),
						'table-column-group' => esc_html( 'Table Column Group', 'so-css' ),
						'table-header-group' => esc_html( 'Table Header Group', 'so-css' ),
						'table-footer-group' => esc_html( 'Table Footer Group', 'so-css' ),
						'table-row-group' => esc_html( 'Table Row Group', 'so-css' ),
						'table-cell' => esc_html( 'Table Cell', 'so-css' ),
						'table-column' => esc_html( 'Table Column', 'so-css' ),
						'table-row' => esc_html( 'Table Row', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Float', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'float',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'left' => esc_html( 'Left', 'so-css' ),
						'right' => esc_html( 'Right', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Clear', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'clear',
					'options' => array(
						'none' => esc_html( 'None', 'so-css' ),
						'left' => esc_html( 'Left', 'so-css' ),
						'right' => esc_html( 'Right', 'so-css' ),
						'both' => esc_html( 'Both', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Visibility', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'visibility',
					'options' => array(
						'visible' => esc_html( 'Visible', 'so-css' ),
						'hidden' => esc_html( 'Hidden', 'so-css' ),
						'collapse' => esc_html( 'Collapse', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Overflow', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow',
					'options' => array(
						'visible' => esc_html( 'Visible', 'so-css' ),
						'hidden' => esc_html( 'Hidden', 'so-css' ),
						'scroll' => esc_html( 'Scroll', 'so-css' ),
						'auto' => esc_html( 'Auto', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Overflow X', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow-x',
					'options' => array(
						'visible' => esc_html( 'Visible', 'so-css' ),
						'hidden' => esc_html( 'Hidden', 'so-css' ),
						'scroll' => esc_html( 'Scroll', 'so-css' ),
						'auto' => esc_html( 'Auto', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Overflow Y', 'so-css' ),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow-y',
					'options' => array(
						'visible' => esc_html( 'Visible', 'so-css' ),
						'hidden' => esc_html( 'Hidden', 'so-css' ),
						'scroll' => esc_html( 'Scroll', 'so-css' ),
						'auto' => esc_html( 'Auto', 'so-css' ),
					)
				)
			),
			array(
				'title' => esc_html( 'Z-Index', 'so-css' ),
				'type' => 'number',
				'args' => array(
					'property' => 'z-index',
				)
			),
		)
	),

);
