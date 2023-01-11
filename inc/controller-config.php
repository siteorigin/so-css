<?php

return array(
	'text'       => array(
		'title'       => esc_html__( 'Text', 'so-css' ),
		'icon'        => 'align-left',
		'controllers' => array(
			array(
				'title' => esc_html__( 'Text Color', 'so-css' ),
				'type'  => 'color',
				'args'  => array(
					'property' => 'color',
				),
			),
			array(
				'title' => esc_html__( 'Font Size', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property'    => 'font-size',
					'defaultUnit' => 'px',
				),
			),
			array(
				'title' => esc_html__( 'Line Height', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property'    => 'line-height',
					'defaultUnit' => 'em',
				),
			),
			array(
				'title' => esc_html__( 'Font Weight', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'font-weight',
					'options'  => array(
						'normal'  => esc_html__( 'Normal', 'so-css' ),
						'bold'    => esc_html__( 'Bold', 'so-css' ),
						'bolder'  => esc_html__( 'Bolder', 'so-css' ),
						'lighter' => esc_html__( 'Lighter', 'so-css' ),
						'100'     => '100',
						'200'     => '200',
						'300'     => '300',
						'400'     => '400',
						'500'     => '500',
						'600'     => '600',
						'700'     => '700',
						'800'     => '800',
						'900'     => '900',
					),
				),
			),
			array(
				'title' => esc_html__( 'Font Style', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property'     => 'font-style',
					'options'      => array(
						'none'   => esc_html__( 'None', 'so-css' ),
						'normal' => esc_html__( 'Normal', 'so-css' ),
						'italic' => esc_html__( 'Italic', 'so-css' ),
					),
					'option_icons' => array(
						'normal' => 'font',
						'italic' => 'italic',
					),
				),
			),
			array(
				'title' => esc_html__( 'Text Decoration', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property'     => 'text-decoration',
					'options'      => array(
						'none'         => esc_html__( 'None', 'so-css' ),
						'underline'    => esc_html__( 'Underline', 'so-css' ),
						'overline'     => esc_html__( 'Overline', 'so-css' ),
						'line-through' => esc_html__( 'Line Through', 'so-css' ),
					),
					'option_icons' => array(
						'none'         => 'font',
						'underline'    => 'underline',
						'line-through' => 'strikethrough',
					),
				),
			),
			array(
				'title' => esc_html__( 'Font Variant', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'font-variant',
					'options'  => array(
						'normal'     => esc_html__( 'Normal', 'so-css' ),
						'small-caps' => esc_html__( 'Small Caps', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Text Transform', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'text-transform',
					'options'  => array(
						'none'       => esc_html__( 'None', 'so-css' ),
						'capitalize' => esc_html__( 'Capitalize', 'so-css' ),
						'uppercase'  => esc_html__( 'Uppercase', 'so-css' ),
						'lowercase'  => esc_html__( 'Lowercase', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Font Family', 'so-css' ),
				'type'  => 'font_select',
				'args'  => array(
					'property' => 'font-family',
				),
			),
			array(
				'title' => esc_html__( 'Text Align', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property'     => 'text-align',
					'options'      => array(
						'left'    => esc_html__( 'Left', 'so-css' ),
						'right'   => esc_html__( 'Right', 'so-css' ),
						'center'  => esc_html__( 'Center', 'so-css' ),
						'justify' => esc_html__( 'Justify', 'so-css' ),
					),
					'option_icons' => array(
						'left'    => 'align-left',
						'right'   => 'align-right',
						'center'  => 'align-center',
						'justify' => 'align-justify',
					),
				),
			),
			array(
				'title' => esc_html__( 'Text Indent', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property' => 'text-indent',
				),
			),
			array(
				'title' => esc_html__( 'Letter Spacing', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property' => 'letter-spacing',
				),
			),
			array(
				'title' => esc_html__( 'Word Spacing', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property' => 'word-spacing',
				),
			),
			array(
				'title' => esc_html__( 'White Space', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'white-space',
					'options'  => array(
						'normal'      => esc_html__( 'Normal', 'so-css' ),
						'encountered' => esc_html__( 'Encountered', 'so-css' ),
						'pre'         => esc_html__( 'Pre', 'so-css' ),
						'pre-line'    => esc_html__( 'Pre Line', 'so-css' ),
						'pre-wrap'    => esc_html__( 'Pre Wrap', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Text Shadow', 'so-css' ),
				'type'  => 'shadow',
				'args'  => array(
					'property' => 'text-shadow',
				),
			),
		),
	),

	//////////////////////////////////////////////////////////////////////

	'decoration' => array(
		'title'       => esc_html__( 'Decoration', 'so-css' ),
		'icon'        => 'eyedropper',
		'controllers' => array(
			array(
				'title' => esc_html__( 'Background Color', 'so-css' ),
				'type'  => 'color',
				'args'  => array(
					'property' => 'background-color',
				),
			),
			array(
				'title' => esc_html__( 'Background Image', 'so-css' ),
				'type'  => 'image',
				'args'  => array(
					'property' => 'background-image',
					'value'    => 'url("{{url}}")',
				),
			),
			array(
				'title' => esc_html__( 'Background Position', 'so-css' ),
				'type'  => 'position',
				'args'  => array(
					'property' => 'background-position',
				),
			),
			array(
				'title' => esc_html__( 'Background Repeat', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'background-repeat',
					'options'  => array(
						'repeat'    => esc_html__( 'repeat', 'so-css' ),
						'repeat-x'  => esc_html__( 'repeat-x', 'so-css' ),
						'repeat-y'  => esc_html__( 'repeat-y', 'so-css' ),
						'no-repeat' => esc_html__( 'no-repeat', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Background Size', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'background-size',
					'options'  => array(
						'auto'       => esc_html__( 'auto', 'so-css' ),
						'length'     => esc_html__( 'length', 'so-css' ),
						'percentage' => esc_html__( 'percentage', 'so-css' ),
						'cover'      => esc_html__( 'cover', 'so-css' ),
						'contain'    => esc_html__( 'contain', 'so-css' ),
					),
				),
			),

			array(
				'title' => esc_html__( 'Box Shadow', 'so-css' ),
				'type'  => 'shadow',
				'args'  => array(
					'property' => 'box-shadow',
				),
			),

			array(
				'title' => esc_html__( 'Opacity', 'so-css' ),
				'type'  => 'number',
				'args'  => array(
					'property'  => 'opacity',
					'default'   => 1,
					'min'       => 0,
					'max'       => 1,
					'increment' => 0.05,
					'decrement' => -0.05,
				),
			),

			array(
				'title' => esc_html__( 'Borders', 'so-css' ),
				'type'  => 'sides',
				'args'  => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property'    => 'border-{dir}-width',
								'propertyAll' => 'border-width',
								'defaultUnit' => 'px',
							),
						),
						array(
							'type' => 'select',
							'args' => array(
								'property'    => 'border-{dir}-style',
								'propertyAll' => 'border-style',
								'options'     => array(
									'hidden' => 'Hidden',
									'dotted' => 'Dotted',
									'dashed' => 'Dashed',
									'solid'  => 'Solid',
									'double' => 'Double',
									'groove' => 'Groove',
									'ridge'  => 'Ridge',
									'inset'  => 'Inset',
									'outset' => 'Outset',
								),
							),
						),
						array(
							'type' => 'color',
							'args' => array(
								'property'    => 'border-{dir}-color',
								'propertyAll' => 'border-color',
							),
						),
					),
					'hasAll'      => true,
				),
			),

			array(
				'title' => esc_html__( 'Border Radius', 'so-css' ),
				'type'  => 'sides',
				'args'  => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property'    => 'border-{dir}-radius',
								'propertyAll' => 'border-radius',
								'defaultUnit' => 'px',
							),
						),
					),
					'isRadius'    => true,
					'hasAll'      => true,
				),
			),
		),
	),

	//////////////////////////////////////////////////////////////////////

	'layout'     => array(
		'title'       => esc_html__( 'Layout', 'so-css' ),
		'icon'        => 'columns',
		'controllers' => array(
			array(
				'title' => esc_html__( 'Margin', 'so-css' ),
				'type'  => 'sides',
				'args'  => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property'    => 'margin-{dir}',
								'propertyAll' => 'margin',
								'defaultUnit' => 'px',
							),
						),
					),
					'hasAll'      => true,
				),
			),
			array(
				'title' => esc_html__( 'Padding', 'so-css' ),
				'type'  => 'sides',
				'args'  => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property'    => 'padding-{dir}',
								'propertyAll' => 'padding',
								'defaultUnit' => 'px',
							),
						),
					),
					'hasAll'      => true,
				),
			),
			array(
				'title' => esc_html__( 'Position', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'position',
					'options'  => array(
						'absolute' => esc_html__( 'Absolute', 'so-css' ),
						'fixed'    => esc_html__( 'Fixed', 'so-css' ),
						'relative' => esc_html__( 'Relative', 'so-css' ),
						'static'   => esc_html__( 'Static', 'so-css' ),
						'inherit'  => esc_html__( 'Inherit', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Absolute Position', 'so-css' ),
				'type'  => 'sides',
				'args'  => array(
					'controllers' => array(
						array(
							'type' => 'measurement',
							'args' => array(
								'property'    => '{dir}',
								'defaultUnit' => 'px',
							),
						),
					),
					'hasAll'      => false,
				),
			),
			array(
				'title' => esc_html__( 'Width', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property'    => 'width',
					'defaultUnit' => 'px',
				),
			),
			array(
				'title' => esc_html__( 'Height', 'so-css' ),
				'type'  => 'measurement',
				'args'  => array(
					'property'    => 'height',
					'defaultUnit' => '%',
				),
			),
			array(
				'title' => esc_html__( 'Display', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'display',
					'options'  => array(
						'none'               => esc_html__( 'None', 'so-css' ),
						'inline'             => esc_html__( 'Inline', 'so-css' ),
						'block'              => esc_html__( 'Block', 'so-css' ),
						'flex'               => esc_html__( 'Flex', 'so-css' ),
						'inline-block'       => esc_html__( 'Inline Block', 'so-css' ),
						'inline-flex'        => esc_html__( 'Inline Flex', 'so-css' ),
						'inline-table'       => esc_html__( 'Inline Table', 'so-css' ),
						'list-item'          => esc_html__( 'List Item', 'so-css' ),
						'run-in'             => esc_html__( 'Run In', 'so-css' ),
						'table'              => esc_html__( 'Table', 'so-css' ),
						'table-caption'      => esc_html__( 'Table Caption', 'so-css' ),
						'table-column-group' => esc_html__( 'Table Column Group', 'so-css' ),
						'table-header-group' => esc_html__( 'Table Header Group', 'so-css' ),
						'table-footer-group' => esc_html__( 'Table Footer Group', 'so-css' ),
						'table-row-group'    => esc_html__( 'Table Row Group', 'so-css' ),
						'table-cell'         => esc_html__( 'Table Cell', 'so-css' ),
						'table-column'       => esc_html__( 'Table Column', 'so-css' ),
						'table-row'          => esc_html__( 'Table Row', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Float', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'float',
					'options'  => array(
						'none'  => esc_html__( 'None', 'so-css' ),
						'left'  => esc_html__( 'Left', 'so-css' ),
						'right' => esc_html__( 'Right', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Clear', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'clear',
					'options'  => array(
						'none'  => esc_html__( 'None', 'so-css' ),
						'left'  => esc_html__( 'Left', 'so-css' ),
						'right' => esc_html__( 'Right', 'so-css' ),
						'both'  => esc_html__( 'Both', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Visibility', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'visibility',
					'options'  => array(
						'visible'  => esc_html__( 'Visible', 'so-css' ),
						'hidden'   => esc_html__( 'Hidden', 'so-css' ),
						'collapse' => esc_html__( 'Collapse', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Overflow', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'overflow',
					'options'  => array(
						'visible' => esc_html__( 'Visible', 'so-css' ),
						'hidden'  => esc_html__( 'Hidden', 'so-css' ),
						'scroll'  => esc_html__( 'Scroll', 'so-css' ),
						'auto'    => esc_html__( 'Auto', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Overflow X', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'overflow-x',
					'options'  => array(
						'visible' => esc_html__( 'Visible', 'so-css' ),
						'hidden'  => esc_html__( 'Hidden', 'so-css' ),
						'scroll'  => esc_html__( 'Scroll', 'so-css' ),
						'auto'    => esc_html__( 'Auto', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Overflow Y', 'so-css' ),
				'type'  => 'select',
				'args'  => array(
					'property' => 'overflow-y',
					'options'  => array(
						'visible' => esc_html__( 'Visible', 'so-css' ),
						'hidden'  => esc_html__( 'Hidden', 'so-css' ),
						'scroll'  => esc_html__( 'Scroll', 'so-css' ),
						'auto'    => esc_html__( 'Auto', 'so-css' ),
					),
				),
			),
			array(
				'title' => esc_html__( 'Z-Index', 'so-css' ),
				'type'  => 'number',
				'args'  => array(
					'property' => 'z-index',
				),
			),
		),
	),
);
