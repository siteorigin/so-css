=== SiteOrigin CSS ===
Tags: css, design, edit, customize
Requires at least: 3.9
Tested up to: 5.5
Stable tag: trunk
Build time: unbuilt
License: GPLv2 or later
Contributors: gpriday
Donate link: https://siteorigin.com/downloads/premium/

SiteOrigin CSS is the simple, yet powerful CSS editor for WordPress. It gives you visual controls that let you edit the look and feel of your site in real-time.

== Description ==

SiteOrigin CSS is the simple, yet powerful CSS editor for WordPress. It gives you visual controls that let you edit the look and feel of your site in real-time.

We've created a site editing experience that will suit both beginners and advanced users alike. Beginners will love the simple visual controls and real-time preview. Advanced users will love the code autocompletion that makes writing CSS faster than ever.

[vimeo https://vimeo.com/129660380]

= Inspector =

The hardest part of editing your site's design using CSS is usually finding the correct selector to use. The powerful inspector that comes with SiteOrigin CSS makes this easy. While viewing a full preview of your site, just click on an element and it'll help you identify the best selector to use to target that element.

The Inspector will help you even if you have no idea what a CSS selector is.

= Visual Editor =

Don't like playing around with code? No problem. SiteOrigin CSS has a set of simple controls that make it easy to choose colors, styles and measurements. Combined with the Inspector, you'll be able to make changes in just a few clicks.

= CSS Editor =

SiteOrigin CSS has a powerful CSS editor, the likes of which you'd usually only expect from high-end IDEs. It has autocompletion for both CSS selectors and attributes. It also features very useful CSS linting that'll help you identify issues in your code before you publish your changes.

= It's Free =

We're committed to keeping SiteOrigin CSS, free. You can install it on as many sites as you like without ever worrying about licensing. All future updates and upgrades will be free, and we even offer free support over on our friendly support forums.

= Works With Any Theme =

There's an ever-growing collection of awesome WordPress themes, and now with SiteOrigin CSS you can edit every single one of them to your heart's content. No matter what theme you're using, SiteOrigin CSS will work perfectly.

= Actively Developed =

We're actively developing SiteOrigin CSS. Keep track of what's happening over on [GitHub](https://github.com/siteorigin/so-css/).

== Installation ==

1. Upload and install SiteOrigin CSS in the same way you'd install any other plugin.
2. Read the [usage documentation](http://siteorigin.com/css/getting-started/) on SiteOrigin.

== Screenshots ==
1. Inspector for finding elements on your site.
2. Simple visual controls including a background image uploader.
3. A full CSS editor that works in real-time with a preview of your site.
4. Code completion for all your theme's selectors.

== Documentation ==

[Documentation](https://siteorigin.com/css/getting-started/) is available on SiteOrigin.

== Support ==

We offer free support on the [SiteOrigin support forums](https://siteorigin.com/thread/).

== Changelog ==

= 1.2.11 - 21 October 2020 =
* Fixed Background image setting writing to CSS.

= 1.2.10 - 09 September 2020 =
* Increased the specificity of the Save CSS button styling to prevent plugin conflicts.

= 1.2.9 - 29 July 2020 =
* Resolved Font Family field output.

= 1.2.8 - 22 May 2020 =
* Renamed `custom_css` textarea to prevent conflicts.

= 1.2.7 - 19 May 2020 =
* Restored `Save` button functionality.

= 1.2.6 - 15 May 2020 =
* Minor visual editor form styling fixes.
* Resolved PHP 7.4 `preg_replace()` warning.
* Moved the basic editor Save button to the sidebar.

= 1.2.5 - 05 February 2020 =
* Removed `themeCSS` localized script to prevent `preg_replace()` warning.
* Minor form styling fixes.
* Updated CSS NPM library.
* Rebuilt minified files using new build script.

= 1.2.4 - 17 January 2019 =
* Prefix so-css for all codemirror assets.
* Prevent JS error when attempting to set active element to null.

= 1.2.3 - 25 June 2018 =
* Add preview iframe 'load' event listener in `render` function.
* Reverted change to stylesheet hook.

= 1.2.2 - 16 June 2018 =
* Removed reference to non-existent view.

= 1.2.1 - 15 June 2018 =
* Removed `.min` suffix from new stylesheets for CodeMirror plugins.

= 1.2.0 - 6 June 2018 =
* Updated CSS library.
* UI changes to make it more obvious when viewing revision.
* Ensure revisions are sorted in descending time order.
* Don't link to revision currently being displayed.
* Add search functionality to editor.
* Enable persistent search and JumpToLine.

= 1.1.5 - 19 September 2017 =
* Use `home_url` instead of `site_url` to determine where to open CSS preview.
* Increment and decrement buttons work when value empty or zero. Also added repeating action while button held down.
* Scroll editor instead of the whole page so 'Save' button is always visible.
* Set color CSS on visual editor and inspector.
* Saving generated CSS to stylesheet file in uploads directory.

= 1.1.4 - 31 January 2017 =
* Updated CodeMirror to 2.25.2.
* Removed extra line padding.
* Better integration with WordPress.org translation.

= 1.1.3 - 31 January 2017 =
* Removed leading slash in paths after plugin_dir_url().
* Updated to latest CodeMirror.
* Fixed padding issue that was causing problems with Firefox and the color picker.

= 1.1.2 - 11 November 2016 =
* Ignore anything other than actual rules in media query subrules.
* Removed depreciated jQuery function.
* Updated CSSLint library.
* Updated minicolors.

= 1.1.1 - 28 September 2016 =
* Properly handle errors in frontend CSS.
* Added notice about SiteOrigin Premium.

= 1.1 - 26 September 2016 =
* Changed CSS parsing library. Fixed several issues with the visual editor mode.
* Added address bar to preview window.
* Small CSS fixes.
* Small changes to allow adding more visual editor fields.

= 1.0.8 - 15 August 2016 =
* Fixed action link.
* Support for GlotPress.
* Removed unused code.
* Handling of @imports for future addons.

= 1.0.7 - 4 July 2016 =
* Ensure user can copy/paste in editor via context menu.
* Added plugin action links
* Add classes on `body` element to selectors window.

= 1.0.6 - 24 February 2016 =
* Disabled autocompletion on single item (automatic autocompletion).
* Fixed conflict with NextGen Gallery.
* Only display relevant linting messages.

= 1.0.5 - 21 January 2016 =
* Updated to latest version of Code Mirror.

= 1.0.4 - 10 November 2015 =
* Fixed CSS parsing when going into visual mode.

= 1.0.3 - 29 October 2015 =
* Changed video image
* Adjust revision times by GMT offset.
* Don't overwrite media queries sub styles, rather just append them.

= 1.0.2 =
* Dequeue functionality that conflicted with WordPress color picker, if it's enqueued.
* Removed wp_styles for compatibility with older versions of WordPress

= 1.0.1 =
* Fixed conflicts with CSS editor in SiteOrigin themes.
* Force dequeue scripts that cause problems with main editing interface.
* Made it easier to follow links with inspector enabled.

= 1.0 =
* Initial release.
