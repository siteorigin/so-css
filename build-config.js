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
            '!{build,build/**}',                // Ignore build/ and contents
            '!{tests,tests/**}',                // Ignore tests/ and contents
            '!{tmp,tmp/**}'                     // Ignore dist/ and contents
        ]
    },
    browserify : {
        src: 'js/main.js',
        dest: 'js/',
        fileName: 'css.js',
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
            '!{tests,tests/**}',                // Ignore tests/ and contents
            '!{tmp,tmp/**}',                    // Ignore tmp/ and contents
            '!phpunit.xml',                     // Not the unit tests configuration file.
            '!so-css.php',                      // Not the base plugin file. It is copied by the 'version' task.
            '!readme.txt'                      // Not the readme.txt file. It is copied by the 'version' task.
        ]
    }
};
