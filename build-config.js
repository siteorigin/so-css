module.exports = {
    slug: 'so-css',
    jsMinSuffix: '.min',
    version: {
        src: [
            'so-css.php',
            'readme.txt'
        ]
    },
    less: {
        src:['css/**/*.less'],
        include:[]
    },
    sass: {
        src: [],
        include:[]
    },
    js: {
        src: [
            'js/**/*.js',
            'lib/**/*.js',
            '!js/main.js',                      // Ignore main.js used to compile css.js
            '!{build,build/**}',                // Ignore build/ and contents
            '!{tmp,tmp/**}'                     // Ignore dist/ and contents
        ]
    },
    browserify : {
        src: 'js/main.js',
        dest: 'js/',
        fileName: 'css.js',
		watchFiles: [
			'js/**',
		]
    },
    bust: {
        src: []
    },
    copy: {
        src: [
            '**/!(*.js|*.less)',                // Everything except .js and .less files
            'lib/**/*.*',                       // libraries used at runtime
            '!{node_modules,node_modules/**}',  // Ignore build/ and contents
            '!{build,build/**}',                // Ignore build/ and contents
            '!{tmp,tmp/**}',                    // Ignore tmp/ and contents
            '!{dist,dist/**}',                  // Ignore dist/ and contents
            '!so-css.php',                      // Not the base plugin file. It is copied by the 'version' task.
            '!readme.txt',                      // Not the readme.txt file. It is copied by the 'version' task.
            '!package.json',                    // Not the package.json file.
            '!package-lock.json',                // Not the package-lock.json file.
            'inc/installer/css/*css'           // Include Installer CSS.
        ]
    },
    i18n: {
        src: [
            '**/*.php',                         // All the PHP files.
            '!tmp/**/*.php',                    // Ignore tmp/ and contents
            '!dist/**/*.php'                    // Ignore dist/ and contents
        ],
    },
};
