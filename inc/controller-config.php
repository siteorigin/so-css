<?php

return array (
	'text' => array(
		'title' => __('Text', 'so-css'),
		'icon' => 'align-left',
		'controllers' => array(
			array(
				'title' => __('Text Color', 'so-css'),
				'type' => 'color',
				'args' => array(
					'property' => 'color'
				)
			),
			array(
				'title' => __('Font Size', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'font-size',
					'defaultUnit' => 'px',
				)
			),
			array(
				'title' => __('Line Height', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'line-height',
					'defaultUnit' => 'em',
				)
			),
			array(
				'title' => __('Font Weight', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'font-weight',
					'options' => array(
						'normal' => __('Normal', 'so-css'),
						'bold' => __('Bold', 'so-css'),
						'bolder' => __('Bolder', 'so-css'),
						'lighter' => __('Lighter', 'so-css'),
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
				'title' => __('Font Style', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'font-style',
					'options' => array(
						'none' => __('None', 'so-css'),
						'normal' => __('Normal', 'so-css'),
						'italic' => __('Italic', 'so-css'),
					),
					'option_icons' => array(
						'normal' => 'font',
						'italic' => 'italic',
					)
				)
			),
			array(
				'title' => __('Text Decoration', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'text-decoration',
					'options' => array(
						'none' => __('None', 'so-css'),
						'underline' => __('Underline', 'so-css'),
						'overline' => __('Overline', 'so-css'),
						'line-through' => __('Line Through', 'so-css'),
					),
					'option_icons' => array(
						'none' => 'font',
						'underline' => 'underline',
						'line-through' => 'strikethrough',
					)
				)
			),
			array(
				'title' => __('Font Variant', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'font-variant',
					'options' => array(
						'normal' => __('Normal', 'so-css'),
						'small-caps' => __('Small Caps', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Text Transform', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'text-transform',
					'options' => array(
						'none' => __('None', 'so-css'),
						'capitalize' => __('Capitalize', 'so-css'),
						'uppercase' => __('Uppercase', 'so-css'),
						'lowercase' => __('Lowercase', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Font Family', 'so-css'),
				'type' => 'font_select',
				'args' => array(
					'property' => 'font-family',
				)
			),
			array(
				'title' => __('Text Align', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'text-align',
					'options' => array(
						'left' => __('Left', 'so-css'),
						'right' => __('Right', 'so-css'),
						'center' => __('Center', 'so-css'),
						'justify' => __('Justify', 'so-css'),
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
				'title' => __('Text Indent', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'text-indent'
				)
			),
			array(
				'title' => __('Letter Spacing', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'letter-spacing'
				)
			),
			array(
				'title' => __('Word Spacing', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'word-spacing'
				)
			),
			array(
				'title' => __('White Space', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'white-space',
					'options' => array(
						'normal' => __('Normal', 'so-css'),
						'encountered' => __('Encountered', 'so-css'),
						'pre' => __('Pre', 'so-css'),
						'pre-line' => __('Pre Line', 'so-css'),
						'pre-wrap' => __('Pre Wrap', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Text Shadow', 'so-css'),
				'type' => 'shadow',
				'args' => array(
					'property' => 'text-shadow',
				)
			),
		)
	),

	//////////////////////////////////////////////////////////////////////

	'decoration' => array(
		'title' => __('Decoration', 'so-css'),
		'icon' => 'eyedropper',
		'controllers' => array(
			array(
				'title' => __('Background Color', 'so-css'),
				'type' => 'color',
				'args' => array(
					'property' => 'background-color'
				)
			),
			array(
				'title' => __('Background Image', 'so-css'),
				'type' => 'image',
				'args' => array(
					'property' => 'background-image',
					'value' => 'url("{{url}}")',
				)
			),
			array(
				'title' => __('Background Position', 'so-css'),
				'type' => 'position',
				'args' => array(
					'property' => 'background-position'
				)
			),
			array(
				'title' => __('Background Repeat', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'background-repeat',
					'options' => array(
						'repeat' => __( 'repeat', 'so-css' ),
						'repeat-x' => __( 'repeat-x', 'so-css' ),
						'repeat-y' => __( 'repeat-y', 'so-css' ),
						'no-repeat' => __( 'no-repeat', 'so-css' ),
					)
				)
			),
			array(
				'title' => __('Background Size', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'background-size',
					'options' => array(
						'auto' => __( 'auto', 'so-css' ),
						'length' => __( 'length', 'so-css' ),
						'percentage' => __( 'percentage', 'so-css' ),
						'cover' => __( 'cover', 'so-css' ),
						'contain' => __( 'contain', 'so-css' ),
					)
				)
			),

			array(
				'title' => __('Box Shadow', 'so-css'),
				'type' => 'shadow',
				'args' => array(
					'property' => 'box-shadow',
				)
			),

			array(
				'title' => __('Opacity', 'so-css'),
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
				'title' => __('Borders', 'so-css'),
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
				'title' => __( 'Border Radius', 'so-css' ),
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
		'title' => __('Layout', 'so-css'),
		'icon' => 'columns',
		'controllers' => array(
			array(
				'title' => __('Margin', 'so-css'),
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
				'title' => __('Padding', 'so-css'),
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
				'title' => __('Position', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'position',
					'options' => array(
						'absolute' => __( 'Absolute', 'so-css' ),
						'fixed' => __( 'Fixed', 'so-css' ),
						'relative' => __( 'Relative', 'so-css' ),
						'static' => __( 'Static', 'so-css' ),
						'inherit' => __( 'Inherit', 'so-css' ),
					)
				)
			),
			array(
				'title' => __('Absolute Position', 'so-css'),
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
				'title' => __('Width', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'width',
					'defaultUnit' => 'px',
				)
			),
			array(
				'title' => __('Height', 'so-css'),
				'type' => 'measurement',
				'args' => array(
					'property' => 'height',
					'defaultUnit' => '%',
				)
			),
			array(
				'title' => __('Display', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'display',
					'options' => array(
						'none' => __( 'None', 'so-css'),
						'inline' => __( 'Inline', 'so-css'),
						'block' => __( 'Block', 'so-css'),
						'flex' => __( 'Flex', 'so-css'),
						'inline-block' => __( 'Inline Block', 'so-css'),
						'inline-flex' => __( 'Inline Flex', 'so-css'),
						'inline-table' => __( 'Inline Table', 'so-css'),
						'list-item' => __( 'List Item', 'so-css'),
						'run-in' => __( 'Run In', 'so-css'),
						'table' => __( 'Table', 'so-css'),
						'table-caption' => __( 'Table Caption', 'so-css'),
						'table-column-group' => __( 'Table Column Group', 'so-css'),
						'table-header-group' => __( 'Table Header Group', 'so-css'),
						'table-footer-group' => __( 'Table Footer Group', 'so-css'),
						'table-row-group' => __( 'Table Row Group', 'so-css'),
						'table-cell' => __( 'Table Cell', 'so-css'),
						'table-column' => __( 'Table Column', 'so-css'),
						'table-row' => __( 'Table Row', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Float', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'float',
					'options' => array(
						'none' => __( 'None', 'so-css'),
						'left' => __( 'Left', 'so-css'),
						'right' => __( 'Right', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Clear', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'clear',
					'options' => array(
						'none' => __( 'None', 'so-css'),
						'left' => __( 'Left', 'so-css'),
						'right' => __( 'Right', 'so-css'),
						'both' => __( 'Both', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Visibility', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'visibility',
					'options' => array(
						'visible' => __( 'Visible', 'so-css'),
						'hidden' => __( 'Hidden', 'so-css'),
						'collapse' => __( 'Collapse', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Overflow', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow',
					'options' => array(
						'visible' => __( 'Visible', 'so-css'),
						'hidden' => __( 'Hidden', 'so-css'),
						'scroll' => __( 'Scroll', 'so-css'),
						'auto' => __( 'Auto', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Overflow X', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow-x',
					'options' => array(
						'visible' => __( 'Visible', 'so-css'),
						'hidden' => __( 'Hidden', 'so-css'),
						'scroll' => __( 'Scroll', 'so-css'),
						'auto' => __( 'Auto', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Overflow Y', 'so-css'),
				'type' => 'select',
				'args' => array(
					'property' => 'overflow-y',
					'options' => array(
						'visible' => __( 'Visible', 'so-css'),
						'hidden' => __( 'Hidden', 'so-css'),
						'scroll' => __( 'Scroll', 'so-css'),
						'auto' => __( 'Auto', 'so-css'),
					)
				)
			),
			array(
				'title' => __('Z-Index', 'so-css'),
				'type' => 'number',
				'args' => array(
					'property' => 'z-index',
				)
			),
		)
	),

);
